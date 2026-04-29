/**
 * Quality Factor Scoring — semantic quality evaluation for KB V2.
 * All functions are pure (no side effects).
 */

import type { KnowledgeBaseV2 } from '@/lib/types'
import { calculateDepthV2 } from '@/lib/ai/depth'

// ─── Semantic Score ───────────────────────────────────────────────────────────

/**
 * Evaluate semantic quality of a text string.
 * Returns 0–1 score based on clarity, specificity, and length.
 */
function scoreText(text: string): number {
  if (!text || text.trim().length === 0) return 0
  const t = text.trim()

  let score = 0

  // Clarity: reasonable length (not too short, not just noise)
  if (t.length >= 20) score += 0.4
  else if (t.length >= 10) score += 0.2

  // Specificity: contains numbers, proper nouns, or technical terms
  if (/\d+/.test(t)) score += 0.2
  if (/\b(must|shall|should|will|can|cannot|only|always|never)\b/i.test(t)) score += 0.2

  // Completeness: contains a verb (action-oriented)
  if (/\b(create|update|delete|view|send|receive|generate|process|validate|approve|track|manage|notify|calculate|export|import|allow|deny|check|verify|ensure)\b/i.test(t)) {
    score += 0.2
  }

  return Math.min(score, 1)
}

/**
 * Compute a semantic quality score (0–100) for the KB V2.
 * Evaluates clarity, specificity, and completeness of text fields.
 */
export function computeSemanticScore(kb: KnowledgeBaseV2): number {
  const scores: number[] = []

  // Business problem
  scores.push(scoreText(kb.business.problem))

  // Objectives
  if (kb.business.objectives.length > 0) {
    const avg = kb.business.objectives.reduce((s, o) => s + scoreText(o), 0) / kb.business.objectives.length
    scores.push(avg)
  }

  // Actors
  if (kb.actors.length > 0) {
    const avg = kb.actors.reduce((s, a) => s + scoreText(a.description), 0) / kb.actors.length
    scores.push(avg)
  }

  // Process flow
  if (kb.process_flow.length > 0) {
    const avg = kb.process_flow.reduce((s, p) => s + scoreText(p.action), 0) / kb.process_flow.length
    scores.push(avg)
  }

  // Functional requirements
  if (kb.functional_requirements.length > 0) {
    const avg = kb.functional_requirements.reduce((s, r) => s + scoreText(r.description), 0) / kb.functional_requirements.length
    scores.push(avg)
  }

  // Business rules
  if (kb.business_rules.length > 0) {
    const avg = kb.business_rules.reduce((s, r) => s + scoreText(r.condition), 0) / kb.business_rules.length
    scores.push(avg)
  }

  if (scores.length === 0) return 0

  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
  return Math.round(avgScore * 100)
}

/**
 * Compute a combined quality+depth score (0–100).
 * Formula: (quantity_score × 0.6) + (semantic_score × 0.4)
 */
export function computeQualityDepth(kb: KnowledgeBaseV2): number {
  const quantityScore = calculateDepthV2(kb)
  const semanticScore = computeSemanticScore(kb)
  return Math.round(quantityScore * 0.6 + semanticScore * 0.4)
}

/**
 * Return per-section quality scores keyed by section name.
 */
export function getPerSectionQuality(kb: KnowledgeBaseV2): Record<string, number> {
  const result: Record<string, number> = {}

  // business
  result.business = Math.round(scoreText(kb.business.problem) * 100)

  // actors
  if (kb.actors.length > 0) {
    const avg = kb.actors.reduce((s, a) => s + scoreText(a.description), 0) / kb.actors.length
    result.actors = Math.round(avg * 100)
  } else {
    result.actors = 0
  }

  // use_cases
  const allUC = [...kb.use_cases.normal, ...kb.use_cases.edge]
  if (allUC.length > 0) {
    const avg = allUC.reduce((s, u) => s + scoreText(u.title), 0) / allUC.length
    result.use_cases = Math.round(avg * 100)
  } else {
    result.use_cases = 0
  }

  // process_flow
  if (kb.process_flow.length > 0) {
    const avg = kb.process_flow.reduce((s, p) => s + scoreText(p.action), 0) / kb.process_flow.length
    result.process_flow = Math.round(avg * 100)
  } else {
    result.process_flow = 0
  }

  // functional_requirements
  if (kb.functional_requirements.length > 0) {
    const avg = kb.functional_requirements.reduce((s, r) => s + scoreText(r.description), 0) / kb.functional_requirements.length
    result.functional_requirements = Math.round(avg * 100)
  } else {
    result.functional_requirements = 0
  }

  // business_rules
  if (kb.business_rules.length > 0) {
    const avg = kb.business_rules.reduce((s, r) => s + scoreText(r.condition), 0) / kb.business_rules.length
    result.business_rules = Math.round(avg * 100)
  } else {
    result.business_rules = 0
  }

  // data_model
  if (kb.data_model.entities.length > 0) {
    const avg = kb.data_model.entities.reduce((s, e) => s + scoreText(e.name), 0) / kb.data_model.entities.length
    result.data_model = Math.round(avg * 100)
  } else {
    result.data_model = 0
  }

  return result
}

// ─── KB Insight & Suggestions ─────────────────────────────────────────────────

export interface KBInsight {
  section: string
  severity: 'high' | 'medium' | 'low'
  message: string
}

/**
 * Analyze KB weaknesses and return actionable insights.
 * Returns an empty array if no weaknesses are detected.
 */
export function analyzeKBWeakness(kb: KnowledgeBaseV2): KBInsight[] {
  const insights: KBInsight[] = []

  if (kb.actors.length === 0) {
    insights.push({ section: 'actors', severity: 'high', message: 'No actors defined. Add at least 2 actors to describe who uses the system.' })
  }

  if (kb.use_cases.edge.length === 0) {
    insights.push({ section: 'use_cases', severity: 'high', message: 'No edge cases defined. Add failure scenarios to improve system robustness.' })
  }

  if (kb.process_flow.length < 3) {
    insights.push({ section: 'process_flow', severity: 'medium', message: `Only ${kb.process_flow.length} process step(s) defined. Add at least 3 steps for a meaningful flow.` })
  }

  if (kb.data_model.entities.length === 0) {
    insights.push({ section: 'data_model', severity: 'medium', message: 'No data entities defined. Add the main data objects your system stores.' })
  }

  if (kb.functional_requirements.length < 2) {
    insights.push({ section: 'functional_requirements', severity: 'low', message: `Only ${kb.functional_requirements.length} functional requirement(s). Add more to fully specify system behavior.` })
  }

  return insights
}

export interface Suggestion {
  type: 'missing' | 'improve'
  section: string
  suggestion: string
}

/**
 * Generate smart suggestions for improving the KB.
 */
export function generateSuggestions(kb: KnowledgeBaseV2): Suggestion[] {
  const suggestions: Suggestion[] = []

  if (kb.use_cases.edge.length === 0) {
    suggestions.push({
      type: 'missing',
      section: 'use_cases',
      suggestion: "You haven't defined failure scenarios. Add at least 1 edge case.",
    })
  }

  if (kb.actors.length === 1) {
    suggestions.push({
      type: 'missing',
      section: 'actors',
      suggestion: 'Only 1 actor defined. Consider adding a second role (e.g., admin, manager).',
    })
  }

  if (kb.system_design.api_endpoints.length === 0) {
    suggestions.push({
      type: 'missing',
      section: 'system_design',
      suggestion: 'No API endpoints defined. Add at least one endpoint to describe system interfaces.',
    })
  }

  if (kb.business.success_metrics.length === 0) {
    suggestions.push({
      type: 'improve',
      section: 'business',
      suggestion: 'No success metrics defined. Add measurable goals to track project success.',
    })
  }

  if (kb.data_model.relationships.length === 0 && kb.data_model.entities.length > 1) {
    suggestions.push({
      type: 'improve',
      section: 'data_model',
      suggestion: 'Entities defined but no relationships. Add relationships between entities.',
    })
  }

  return suggestions
}
