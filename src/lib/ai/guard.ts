/**
 * Hard output guard — enforces single question, max 120 chars.
 * Never trust AI 100%. This runs on every response before sending to client.
 */
export function enforceQuestionRules(raw: string): string {
  // Take only the first question (everything before first "?")
  const firstPart = raw.split('?')[0].trim()

  // Cap at 120 chars
  const capped = firstPart.slice(0, 120)

  return capped + '?'
}

// ─── Anti-Shallow Guard (V2) ──────────────────────────────────────────────────

import type { KnowledgeBaseV2, AntiShallowGuardResult, Stage } from '@/lib/types'

/**
 * Check all four Anti-Shallow Guard conditions in order.
 * Returns { blocked: false } if none apply.
 * Pure function — no side effects.
 */
export function checkAntiShallowGuard(
  kb: KnowledgeBaseV2,
  currentStage: Stage
): AntiShallowGuardResult {
  // 1. Process flow must have at least 3 steps
  if (kb.process_flow.length < 3) {
    return {
      blocked: true,
      reason: 'process_flow_too_short',
      forced_question: 'Walk me through at least 3 steps in this process.',
    }
  }

  // 2. Edge cases must exist when advancing from process stage
  if (currentStage === 'process' && kb.use_cases.edge.length === 0) {
    return {
      blocked: true,
      reason: 'no_edge_cases',
      forced_question: 'What happens when something goes wrong in this flow?',
    }
  }

  // 3. Data model entities must exist when functional stage is otherwise complete
  if (currentStage === 'functional' && kb.data_model.entities.length === 0) {
    return {
      blocked: true,
      reason: 'no_data_model_entities',
      forced_question: 'What are the main data entities this system stores?',
    }
  }

  // 4. At least 2 actors required when actors stage is otherwise complete
  if (currentStage === 'actors' && kb.actors.length < 2) {
    return {
      blocked: true,
      reason: 'too_few_actors',
      forced_question: 'Who else interacts with this system besides the primary user?',
    }
  }

  return { blocked: false }
}
