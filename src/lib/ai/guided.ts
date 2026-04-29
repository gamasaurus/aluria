/**
 * Guided Mode — deterministic KB extraction + question generation.
 * Used when USE_AI=false or when all AI providers are unavailable.
 *
 * Design principle:
 * - One message fills one stage field, then advances to the next stage question.
 * - No AI calls. No hallucination. Fully deterministic.
 * - KB updates, scores, and review mode trigger identically to AI mode.
 */

import type { KnowledgeBase, Stage, DepthLevel, DepthScore, Actor } from '@/lib/types'
import { applyExtraction } from '@/lib/ai/extract'
import { resolveStage, calculateDepth, computeProgress, DEFAULT_DEPTH_SCORE } from '@/lib/ai/depth'

// ─── Stage questions ──────────────────────────────────────────────────────────

const NEXT_QUESTION: Record<Stage, string> = {
  problem:     'Who are the main actors (roles) in this system? You can list them separated by commas.',
  actors:      'Walk me through the main process flow, step by step. List each step on a new line or separated by commas.',
  process:     'What features must the system have? List the main functional requirements.',
  functional:  'What business rules or constraints apply? (e.g. "Only admins can delete orders")',
  rules:       'All requirements collected. Ready to review the document?',
  complete:    'All requirements collected. Ready to review the document?',
}

const STAGE_INSIGHT: Record<Stage, string> = {
  problem:    'Memahami tujuan sistem',
  actors:     'Mengidentifikasi peran pengguna',
  process:    'Memetakan alur bisnis',
  functional: 'Menentukan fitur sistem',
  rules:      'Menentukan constraint',
  complete:   'Semua kebutuhan sudah terkumpul',
}

// ─── Parsing helpers ──────────────────────────────────────────────────────────

/**
 * Split text into a list of items.
 * Handles: numbered lists, bullet lists, newline-separated, comma-separated.
 */
export function splitList(text: string): string[] {
  // Numbered: "1. foo\n2. bar"
  if (/^\d+\.\s/m.test(text)) {
    return text.split(/\n/).map((l) => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean)
  }
  // Bullets: "- foo" or "• foo" or "* foo"
  if (/^[-•*]\s/m.test(text)) {
    return text.split(/\n/).map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)
  }
  // Newline-separated (multi-line input)
  if (text.includes('\n')) {
    const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length >= 2) return lines
  }
  // Comma-separated
  if (text.includes(',')) {
    const parts = text.split(',').map((s) => s.trim()).filter((s) => s.length > 1)
    if (parts.length >= 2) return parts
  }
  // Single item
  return [text.trim()].filter(Boolean)
}

/** Normalize for deduplication */
export function normalize(str: string): string {
  return str.toLowerCase().trim()
}

/**
 * Parse actors from text.
 * Supports: "Admin, Customer, Driver" or "Admin - manages orders, Customer - places orders"
 */
function parseActors(text: string): Actor[] {
  const items = splitList(text)
  const seen = new Set<string>()

  return items
    .map((item): Actor => {
      // "Name - role description" or "Name: role description"
      const dashMatch = item.match(/^(.+?)\s*[-:]\s*(.+)$/)
      if (dashMatch) {
        return {
          name: dashMatch[1].trim(),
          role: dashMatch[2].trim(),
          responsibility: dashMatch[2].trim(),
        }
      }
      // "Name manages/handles/approves X"
      const verbMatch = item.match(
        /^(.+?)\s+(manages?|handles?|is responsible for|approves?|creates?|reviews?|submits?|processes?)\s+(.+)$/i
      )
      if (verbMatch) {
        return {
          name: verbMatch[1].trim(),
          role: `${verbMatch[2]} ${verbMatch[3]}`.trim(),
          responsibility: item.trim(),
        }
      }
      // Plain name
      return { name: item.trim(), role: '', responsibility: '' }
    })
    .filter((a) => {
      if (!a.name) return false
      const key = normalize(a.name)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

// ─── Stage extraction ─────────────────────────────────────────────────────────

type Extracted = Partial<{
  problem: string
  affected_who: string[]
  problem_why: string[]
  actors: Actor[]
  process_flow: string[]
  decision_points: string[]
  functional_requirements: string[]
  business_rules: string[]
}>

function extractForStage(stage: Stage, message: string): Extracted {
  const text = message.trim()

  switch (stage) {
    case 'problem':
      // Save the full message as the problem statement
      return { problem: text }

    case 'actors': {
      const actors = parseActors(text)
      return { actors: actors.length > 0 ? actors : [{ name: text, role: '', responsibility: '' }] }
    }

    case 'process': {
      const steps = splitList(text)
      // Lines starting with decision keywords → decision_points
      const decisions = steps.filter((s) =>
        /^(if |when |check |verify |approve |validate |decide )/i.test(s)
      )
      const mainSteps = steps.filter((s) => !decisions.includes(s))
      return {
        process_flow: mainSteps.length > 0 ? mainSteps : steps,
        ...(decisions.length > 0 ? { decision_points: decisions } : {}),
      }
    }

    case 'functional':
      return { functional_requirements: splitList(text) }

    case 'rules':
      return { business_rules: splitList(text) }

    default:
      return {}
  }
}

// ─── Insight builder ──────────────────────────────────────────────────────────

function buildInsight(stage: Stage, extracted: Extracted): string {
  switch (stage) {
    case 'problem':
      return `${STAGE_INSIGHT.problem} — problem statement captured.`
    case 'actors':
      return `${STAGE_INSIGHT.actors} — ${extracted.actors?.length ?? 0} actor(s) identified.`
    case 'process':
      return `${STAGE_INSIGHT.process} — ${extracted.process_flow?.length ?? 0} step(s) mapped.`
    case 'functional':
      return `${STAGE_INSIGHT.functional} — ${extracted.functional_requirements?.length ?? 0} requirement(s) recorded.`
    case 'rules':
      return `${STAGE_INSIGHT.rules} — ${extracted.business_rules?.length ?? 0} rule(s) added.`
    default:
      return STAGE_INSIGHT.complete
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface GuidedResult {
  next_question: string
  insight: string
  updatedKB: KnowledgeBase
  stage: Stage
  is_complete: boolean
  depth_level: DepthLevel
  depth_score: DepthScore
}

export function guidedModeHandler(message: string, kb: KnowledgeBase): GuidedResult {
  // Resolve stage BEFORE extraction (based on current KB state)
  const currentStage = resolveStage(kb)

  // Extract data for this stage
  const extracted = extractForStage(currentStage, message)

  // Apply to KB
  const updatedKB = Object.keys(extracted).length > 0
    ? applyExtraction(kb, extracted)
    : kb

  // Recalculate scores
  const depthInt = calculateDepth(updatedKB)
  const completionFloat = computeProgress(updatedKB)

  const finalKB: KnowledgeBase = {
    ...updatedKB,
    metadata: {
      ...updatedKB.metadata,
      depth_score: depthInt,
      completion_score: completionFloat,
      stage: resolveStage(updatedKB),
    },
  }

  // Resolve NEXT stage (after extraction)
  const nextStage = resolveStage(finalKB)

  const is_complete = !!(
    finalKB.problem &&
    finalKB.actors.length >= 1 &&
    finalKB.process_flow.length >= 1 &&
    finalKB.functional_requirements.length >= 1
  )

  const depth_level: DepthLevel =
    depthInt < 40 ? 'shallow' : depthInt < 70 ? 'partial' : 'complete'

  return {
    next_question: NEXT_QUESTION[nextStage],
    insight: buildInsight(currentStage, extracted),
    updatedKB: finalKB,
    stage: nextStage,
    is_complete,
    depth_level,
    depth_score: DEFAULT_DEPTH_SCORE,
  }
}

// ─── Guided Mode V2 ───────────────────────────────────────────────────────────

import type {
  KnowledgeBaseV2, ProcessFlowStep, FunctionalRequirement, BusinessRule,
  ActorV2, NormalUseCase, EdgeUseCase,
} from '@/lib/types'
import { createEmptyKBV2, applyExtractionV2 } from '@/lib/ai/extract'
import { calculateDepthV2, computeProgressV2 } from '@/lib/ai/depth'
import { checkAntiShallowGuard } from '@/lib/ai/guard'

export interface GuidedResultV2 {
  next_question: string
  insight: string
  updatedKB: KnowledgeBaseV2
  stage: Stage
  is_complete: boolean
  depth_level: DepthLevel
  depth_score: DepthScore
  guard_triggered: boolean
}

const NEXT_QUESTION_V2: Record<Stage, string> = {
  problem:    'Who are the main actors (roles) in this system? List them separated by commas.',
  actors:     'Walk me through the main process flow, step by step. List each step on a new line.',
  process:    'What features must the system have? List the main functional requirements.',
  functional: 'What business rules or constraints apply? (e.g. "Only admins can delete orders")',
  rules:      'All requirements collected. Ready to review the document?',
  complete:   'All requirements collected. Ready to review the document?',
}

/** Resolve the current V2 stage from KB state */
function resolveStageV2(kb: KnowledgeBaseV2): Stage {
  if (!kb.business.problem) return 'problem'
  if (kb.actors.length === 0) return 'actors'
  if (kb.process_flow.length === 0) return 'process'
  if (kb.functional_requirements.length === 0) return 'functional'
  if (kb.business_rules.length === 0) return 'rules'
  return 'complete'
}

/** Extract structured V2 objects from a user message for the given stage */
function extractForStageV2(stage: Stage, message: string): Partial<KnowledgeBaseV2> {
  const text = message.trim()

  switch (stage) {
    case 'problem':
      return { business: { problem: text, objectives: [], success_metrics: [], stakeholders: [] } }

    case 'actors': {
      const items = splitList(text)
      const actors: ActorV2[] = items.map((item) => {
        const dashMatch = item.match(/^(.+?)\s*[-:]\s*(.+)$/)
        if (dashMatch) {
          return {
            name: dashMatch[1].trim(),
            description: dashMatch[2].trim(),
            permissions: [],
            goals: [],
          }
        }
        return { name: item.trim(), description: '', permissions: [], goals: [] }
      }).filter((a) => a.name)
      return { actors }
    }

    case 'process': {
      const steps = splitList(text)
      const processFlow: ProcessFlowStep[] = steps.map((s, i) => ({
        id: `step-${i + 1}`,
        actor: '',
        action: s,
        system: '',
        next: i < steps.length - 1 ? `step-${i + 2}` : '',
      }))
      return { process_flow: processFlow }
    }

    case 'functional': {
      const items = splitList(text)
      const reqs: FunctionalRequirement[] = items.map((s, i) => ({
        id: `fr-${i + 1}`,
        name: s.slice(0, 40),
        description: s,
        acceptance_criteria: [],
      }))
      return { functional_requirements: reqs }
    }

    case 'rules': {
      const items = splitList(text)
      const rules: BusinessRule[] = items.map((s, i) => {
        const thenIdx = s.search(/\bTHEN\b/i)
        if (thenIdx !== -1) {
          return {
            id: `br-${i + 1}`,
            condition: s.slice(0, thenIdx).trim(),
            action: s.slice(thenIdx + 4).trim(),
          }
        }
        return { id: `br-${i + 1}`, condition: s, action: '' }
      })
      return { business_rules: rules }
    }

    default:
      return {}
  }
}

/**
 * Deterministic guided mode handler for KB V2.
 * Mirrors guidedModeHandler but extracts structured V2 objects.
 * Applies Anti-Shallow Guard before returning the next question.
 */
export function guidedModeHandlerV2(message: string, kb: KnowledgeBaseV2): GuidedResultV2 {
  const currentStage = resolveStageV2(kb)

  // Extract structured V2 data for this stage
  const extracted = extractForStageV2(currentStage, message)

  // Apply to KB
  const updatedKB = Object.keys(extracted).length > 0
    ? applyExtractionV2(kb, extracted)
    : kb

  // Recalculate scores
  const depthInt = calculateDepthV2(updatedKB)
  const completionFloat = computeProgressV2(updatedKB)

  const finalKB: KnowledgeBaseV2 = {
    ...updatedKB,
    completion: {
      depth: depthInt,
      score: Math.round(completionFloat * 100),
    },
  }

  // Resolve next stage
  const nextStage = resolveStageV2(finalKB)

  // Check Anti-Shallow Guard
  const guardResult = checkAntiShallowGuard(finalKB, nextStage)
  const guardTriggered = guardResult.blocked

  const nextQuestion = guardTriggered
    ? (guardResult.forced_question ?? NEXT_QUESTION_V2[nextStage])
    : NEXT_QUESTION_V2[nextStage]

  const is_complete = !!(
    finalKB.business.problem &&
    finalKB.actors.length >= 1 &&
    finalKB.process_flow.length >= 1 &&
    finalKB.functional_requirements.length >= 1
  )

  const depth_level: DepthLevel =
    depthInt < 40 ? 'shallow' : depthInt < 70 ? 'partial' : 'complete'

  const insight = `Stage: ${currentStage} — depth: ${depthInt}/100, completion: ${Math.round(completionFloat * 100)}%`

  return {
    next_question: nextQuestion,
    insight,
    updatedKB: finalKB,
    stage: nextStage,
    is_complete,
    depth_level,
    depth_score: DEFAULT_DEPTH_SCORE,
    guard_triggered: guardTriggered,
  }
}
