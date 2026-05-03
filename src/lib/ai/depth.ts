import type { DepthScore, KnowledgeBase, Stage, DepthLevel, AIExtracted, KnowledgeDepth, ActorsDepth, ProcessDepth, FunctionalDepth, RulesDepth, KnowledgeBaseV2, DepthBreakdown, DepthBreakdownSection } from '@/lib/types'

export const DEFAULT_DEPTH_SCORE: DepthScore = {
  clarity: 0,
  specificity: 0,
  completeness: 0,
  consistency: 1,
}

// ─── Per-section depth breakdown (spec-compliant) ────────────────────────────

export function computeKnowledgeDepth(kb: KnowledgeBase): KnowledgeDepth {
  // Actors depth: +1 count≥2, +1 roles described, +1 permissions mentioned
  const actors = kb.actors ?? []
  const actorsDepth: ActorsDepth = {
    count: actors.length,
    has_roles: actors.some(a => a.role && a.role.length > 3),
    has_permissions: actors.some(a =>
      /permission|access|can |cannot |allowed|restricted|admin|manage/i.test(a.responsibility || a.role || '')
    ),
    score: 0,
  }
  actorsDepth.score =
    (actorsDepth.count >= 2 ? 1 : 0) +
    (actorsDepth.has_roles ? 1 : 0) +
    (actorsDepth.has_permissions ? 1 : 0)

  // Process depth: +1 steps≥3, +1 decision logic, +1 edge cases
  const processDepth: ProcessDepth = {
    step_count: (kb.process_flow ?? []).length,
    has_decisions: (kb.decision_points ?? []).length > 0,
    has_edge_cases: (kb.edge_cases ?? []).length > 0,
    score: 0,
  }
  processDepth.score =
    (processDepth.step_count >= 3 ? 1 : 0) +
    (processDepth.has_decisions ? 1 : 0) +
    (processDepth.has_edge_cases ? 1 : 0)

  // Functional depth: +1 ≥3 features, +1 each has action verb, +1 input/output defined
  const functionalReqs = kb.functional_requirements ?? []
  const toFuncText = (r: unknown): string =>
    typeof r === 'string' ? r : `${(r as {name?: string}).name ?? ''} ${(r as {description?: string}).description ?? ''}`
  const hasActionVerbs = functionalReqs.some(r =>
    /\b(create|update|delete|view|send|receive|generate|process|validate|approve|track|manage|notify|calculate|export|import)\b/i.test(toFuncText(r))
  )
  const hasIO = functionalReqs.some(r =>
    /\b(input|output|return|display|show|result|response|data|field|form|report)\b/i.test(toFuncText(r))
  )
  const functionalDepth: FunctionalDepth = {
    count: functionalReqs.length,
    has_actions: hasActionVerbs,
    has_io: hasIO,
    score: 0,
  }
  functionalDepth.score =
    (functionalDepth.count >= 3 ? 1 : 0) +
    (functionalDepth.has_actions ? 1 : 0) +
    (functionalDepth.has_io ? 1 : 0)

  // Rules depth: +1 constraints exist, +1 validations exist
  const businessRules = kb.business_rules ?? []
  const hasValidations = businessRules.some(r => {
    const text = typeof r === 'string' ? r : `${(r as {condition?: string}).condition ?? ''} ${(r as {action?: string}).action ?? ''}`
    return /\b(must|cannot|only|require|validate|check|verify|ensure|if|when|unless)\b/i.test(text)
  })
  const rulesDepth: RulesDepth = {
    has_constraints: businessRules.length > 0,
    has_validations: hasValidations,
    score: 0,
  }
  rulesDepth.score =
    (rulesDepth.has_constraints ? 1 : 0) +
    (rulesDepth.has_validations ? 1 : 0)

  return { actors_depth: actorsDepth, process_depth: processDepth, functional_depth: functionalDepth, rules_depth: rulesDepth }
}

// ─── Integer depth score 0-100 ───────────────────────────────────────────────

export function calculateDepth(kb: KnowledgeBase): number {
  const d = computeKnowledgeDepth(kb)
  // Max points: actors=3, process=3, functional=3, rules=2 = 11
  // Plus problem bonus: 2
  const maxPoints = 13
  let points = d.actors_depth.score + d.process_depth.score + d.functional_depth.score + d.rules_depth.score

  // Problem bonus
  const problem = kb.problem ?? ''
  if (problem.length > 50) points += 2
  else if (problem.length > 20) points += 1

  return Math.round(Math.min(points / maxPoints, 1) * 100)
}

// ─── Depth warnings for UI ────────────────────────────────────────────────────

export interface DepthWarning {
  section: string
  message: string
  severity: 'low' | 'medium' | 'high'
}

export function getDepthWarnings(kb: KnowledgeBase): DepthWarning[] {
  const warnings: DepthWarning[] = []
  const d = computeKnowledgeDepth(kb)

  if (!kb.problem) {
    warnings.push({ section: 'Problem', message: 'Problem statement is missing', severity: 'high' })
  } else if (kb.problem.length < 20) {
    warnings.push({ section: 'Problem', message: 'Problem statement is too vague', severity: 'medium' })
  }

  if ((kb.actors ?? []).length === 0) {
    warnings.push({ section: 'Actors', message: 'No actors defined yet', severity: 'high' })
  } else if (!d.actors_depth.has_roles) {
    warnings.push({ section: 'Actors', message: 'Actors have no role descriptions', severity: 'medium' })
  } else if (!d.actors_depth.has_permissions) {
    warnings.push({ section: 'Actors', message: 'No permissions or access levels defined', severity: 'low' })
  }

  if ((kb.process_flow ?? []).length === 0) {
    warnings.push({ section: 'Process', message: 'No process steps defined', severity: 'high' })
  } else if (!d.process_depth.has_decisions) {
    warnings.push({ section: 'Process', message: 'Process has no decision logic', severity: 'medium' })
  } else if (!d.process_depth.has_edge_cases) {
    warnings.push({ section: 'Process', message: 'No edge cases or error scenarios', severity: 'low' })
  }

  if ((kb.functional_requirements ?? []).length === 0) {
    warnings.push({ section: 'Functional', message: 'No functional requirements defined', severity: 'high' })
  } else if (!d.functional_depth.has_actions) {
    warnings.push({ section: 'Functional', message: 'Requirements lack action verbs', severity: 'low' })
  }

  if ((kb.business_rules ?? []).length === 0) {
    warnings.push({ section: 'Rules', message: 'No business rules or constraints', severity: 'medium' })
  }

  return warnings
}

// ─── Readiness gate (rule-based, not AI) ─────────────────────────────────────

export function isReady(kb: KnowledgeBase): boolean {
  return (
    !!kb.problem &&
    kb.actors.length > 0 &&
    kb.process_flow.length > 0 &&
    kb.functional_requirements.length > 0
  )
}

export function isReadyForReview(kb: KnowledgeBase): boolean {
  const completion = computeProgress(kb)
  return completion >= 0.8 && isReady(kb)
}

// ─── Dimensional depth score (for AI evaluation) ─────────────────────────────

export function computeDepthScore(
  extracted: AIExtracted,
  currentKB: KnowledgeBase
): DepthScore {
  const text = extracted.problem?.toString() ?? ''
  const actors = extracted.actors ?? []
  const process = extracted.process_flow ?? []
  const functional = extracted.functional_requirements ?? []
  const rules = extracted.business_rules ?? []

  let clarity = 0
  let specificity = 0
  let completeness = 0

  if (text.length >= 20) clarity += 0.5
  else if (text.length >= 5) clarity += 0.2

  if (/\d+\s*(users?|orders?|items?|transactions?)/i.test(text)) specificity += 0.4
  specificity += Math.min(actors.length * 0.2, 0.4)
  specificity += Math.min(process.length * 0.15, 0.4)
  specificity += Math.min(functional.length * 0.15, 0.4)

  if (extracted.affected_who && extracted.affected_who.length > 0) completeness += 0.3
  if (extracted.problem_why && extracted.problem_why.length > 0) completeness += 0.3
  if (text.length > 20) completeness += 0.4

  if (actors.length > 0) {
    const withResp = actors.filter((a) => a.responsibility && a.responsibility.length > 5).length
    completeness += Math.min(withResp / actors.length, 1) * 0.5
  }
  if (process.length >= 1) completeness += Math.min(process.length / 3, 0.5)
  if (rules.length > 0) completeness += Math.min(rules.length * 0.2, 0.5)

  let consistency = 1
  if (currentKB.problem && extracted.problem) {
    const existingWords = new Set(currentKB.problem.toLowerCase().split(/\s+/))
    const newWords = extracted.problem.toString().toLowerCase().split(/\s+/)
    let conflict = 0
    for (const word of newWords) {
      if (word.length > 3 && !existingWords.has(word)) conflict += 1
    }
    if (conflict > existingWords.size * 0.5) consistency = 0.5
  }

  return {
    clarity: Math.min(clarity, 1),
    specificity: Math.min(specificity, 1),
    completeness: Math.min(completeness, 1),
    consistency: Math.min(consistency, 1),
  }
}

export function getDepthLevel(score: DepthScore): DepthLevel {
  const avg = (score.clarity + score.specificity + score.completeness + score.consistency) / 4
  if (avg < 0.6) return 'shallow'
  if (avg < 0.8) return 'partial'
  return 'complete'
}

export function getWeightedDepthScore(score: DepthScore): number {
  return (
    score.clarity * 0.25 +
    score.specificity * 0.25 +
    score.completeness * 0.3 +
    score.consistency * 0.2
  )
}

// ─── Stage resolution (rule-based) ───────────────────────────────────────────

export function resolveStage(kb: KnowledgeBase): Stage {
  if (!kb.problem) return 'problem'
  if (kb.actors.length === 0) return 'actors'
  if (kb.process_flow.length === 0) return 'process'
  if (kb.functional_requirements.length === 0) return 'functional'
  if (kb.business_rules.length === 0) return 'rules'
  return 'complete'
}

export function isComplete(kb: KnowledgeBase): boolean {
  return (
    !!kb.problem &&
    kb.actors.length >= 1 &&
    kb.process_flow.length >= 1 &&
    kb.functional_requirements.length >= 1
  )
}

// ─── Weighted completion score (0-1) ─────────────────────────────────────────
// Weights: problem=0.2, actors=0.2, process=0.25, functional=0.25, rules=0.1

export function computeProgress(kb: KnowledgeBase): number {
  const problemScore = kb.problem && kb.problem.length > 5 ? 1 : 0
  const actorsScore = kb.actors.length >= 1 ? Math.min(kb.actors.length / 2, 1) : 0
  const processScore = kb.process_flow.length >= 1 ? Math.min(kb.process_flow.length / 3, 1) : 0
  const functionalScore = kb.functional_requirements.length >= 1
    ? Math.min(kb.functional_requirements.length / 3, 1)
    : 0
  const rulesScore = kb.business_rules.length >= 1 ? 1 : 0

  return (
    problemScore * 0.2 +
    actorsScore * 0.2 +
    processScore * 0.25 +
    functionalScore * 0.25 +
    rulesScore * 0.1
  )
}

// ─── KB V2 Depth Functions ────────────────────────────────────────────────────

/**
 * Compute the weighted Depth Score V2 (0–100).
 * Formula: (use_cases.normal × 5) + (use_cases.edge × 8) + (process_flow × 3)
 *        + (data_model.entities × 6) + (functional_requirements × 4), capped at 100.
 */
export function calculateDepthV2(kb: KnowledgeBaseV2): number {
  const ucNormal = kb?.use_cases?.normal?.length ?? 0
  const ucEdge = kb?.use_cases?.edge?.length ?? 0
  const pf = kb?.process_flow?.length ?? 0
  const dm = kb?.data_model?.entities?.length ?? 0
  const fr = kb?.functional_requirements?.length ?? 0
  const score = (ucNormal * 5) + (ucEdge * 8) + (pf * 3) + (dm * 6) + (fr * 4)
  return Math.min(score, 100)
}

/**
 * Return per-section depth breakdown for the V2 KB.
 */
export function getDepthBreakdown(kb: KnowledgeBaseV2): DepthBreakdown {
  const ucNormalLen = kb?.use_cases?.normal?.length ?? 0
  const ucEdgeLen = kb?.use_cases?.edge?.length ?? 0
  const pfLen = kb?.process_flow?.length ?? 0
  const dmLen = kb?.data_model?.entities?.length ?? 0
  const frLen = kb?.functional_requirements?.length ?? 0

  const ucNormal: DepthBreakdownSection = { score: Math.min(ucNormalLen * 5, 20), max: 20, items: ucNormalLen }
  const ucEdge: DepthBreakdownSection = { score: Math.min(ucEdgeLen * 8, 24), max: 24, items: ucEdgeLen }
  const pf: DepthBreakdownSection = { score: Math.min(pfLen * 3, 15), max: 15, items: pfLen }
  const dm: DepthBreakdownSection = { score: Math.min(dmLen * 6, 18), max: 18, items: dmLen }
  const fr: DepthBreakdownSection = { score: Math.min(frLen * 4, 24), max: 24, items: frLen }

  return {
    use_cases_normal: ucNormal,
    use_cases_edge: ucEdge,
    process_flow: pf,
    data_model: dm,
    functional_requirements: fr,
    total: calculateDepthV2(kb),
  }
}

/**
 * Classify depth score into a human-readable status.
 */
export function getDepthStatus(score: number): 'Shallow' | 'Moderate' | 'Ready' {
  if (score < 30) return 'Shallow'
  if (score < 70) return 'Moderate'
  return 'Ready'
}

/**
 * Compute weighted completion progress (0–1) for a V2 KB.
 * Weights: business=0.15, actors=0.15, use_cases=0.2, process_flow=0.2,
 *          functional_requirements=0.15, data_model=0.15
 */
export function computeProgressV2(kb: KnowledgeBaseV2): number {
  // Guard against partially-migrated or malformed KB objects
  const business = kb?.business ?? { problem: '', objectives: [], success_metrics: [], stakeholders: [] }
  const actors = kb?.actors ?? []
  const useCasesNormal = kb?.use_cases?.normal ?? []
  const useCasesEdge = kb?.use_cases?.edge ?? []
  const processFlow = kb?.process_flow ?? []
  const functionalReqs = kb?.functional_requirements ?? []
  const entities = kb?.data_model?.entities ?? []

  const businessScore = (business.problem?.length ?? 0) > 5 ? 1 : 0
  const actorsScore = actors.length >= 1 ? Math.min(actors.length / 2, 1) : 0
  const useCasesScore =
    (useCasesNormal.length >= 1 ? Math.min(useCasesNormal.length / 2, 0.5) : 0) +
    (useCasesEdge.length >= 1 ? 0.5 : 0)
  const processScore = processFlow.length >= 1 ? Math.min(processFlow.length / 3, 1) : 0
  const frScore = functionalReqs.length >= 1 ? Math.min(functionalReqs.length / 3, 1) : 0
  const dmScore = entities.length >= 1 ? Math.min(entities.length / 2, 1) : 0

  return (
    businessScore * 0.15 +
    actorsScore * 0.15 +
    useCasesScore * 0.2 +
    processScore * 0.2 +
    frScore * 0.15 +
    dmScore * 0.15
  )
}
