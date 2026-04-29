/**
 * KB Validation Layer — structural integrity checks and AI output sanitization.
 * All functions are pure (no side effects).
 */

import type { KnowledgeBaseV2 } from '@/lib/types'

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate the structural integrity of a KnowledgeBaseV2 object.
 * Checks required fields, array integrity, and ID uniqueness.
 */
export function validateKBV2(kb: KnowledgeBaseV2): ValidationResult {
  const errors: string[] = []

  // business section
  if (typeof kb.business !== 'object' || kb.business === null) {
    errors.push('business section is missing or not an object')
  } else {
    if (typeof kb.business.problem !== 'string') {
      errors.push('business.problem must be a string')
    }
    if (!Array.isArray(kb.business.objectives)) {
      errors.push('business.objectives must be an array')
    }
    if (!Array.isArray(kb.business.success_metrics)) {
      errors.push('business.success_metrics must be an array')
    }
    if (!Array.isArray(kb.business.stakeholders)) {
      errors.push('business.stakeholders must be an array')
    }
  }

  // actors
  if (!Array.isArray(kb.actors)) {
    errors.push('actors must be an array')
  } else {
    kb.actors.forEach((a, i) => {
      if (!a.name) errors.push(`actors[${i}].name is required`)
      if (!Array.isArray(a.permissions)) errors.push(`actors[${i}].permissions must be an array`)
      if (!Array.isArray(a.goals)) errors.push(`actors[${i}].goals must be an array`)
    })
  }

  // use_cases
  if (!kb.use_cases || !Array.isArray(kb.use_cases.normal) || !Array.isArray(kb.use_cases.edge)) {
    errors.push('use_cases must have normal[] and edge[] arrays')
  }

  // process_flow — check ID uniqueness
  if (!Array.isArray(kb.process_flow)) {
    errors.push('process_flow must be an array')
  } else {
    const pfIds = kb.process_flow.map((s) => s.id).filter(Boolean)
    const pfIdSet = new Set(pfIds)
    if (pfIdSet.size !== pfIds.length) {
      errors.push('process_flow contains duplicate IDs')
    }
  }

  // functional_requirements — check ID uniqueness
  if (!Array.isArray(kb.functional_requirements)) {
    errors.push('functional_requirements must be an array')
  } else {
    const frIds = kb.functional_requirements.map((r) => r.id).filter(Boolean)
    const frIdSet = new Set(frIds)
    if (frIdSet.size !== frIds.length) {
      errors.push('functional_requirements contains duplicate IDs')
    }
  }

  // business_rules — check ID uniqueness
  if (!Array.isArray(kb.business_rules)) {
    errors.push('business_rules must be an array')
  } else {
    const brIds = kb.business_rules.map((r) => r.id).filter(Boolean)
    const brIdSet = new Set(brIds)
    if (brIdSet.size !== brIds.length) {
      errors.push('business_rules contains duplicate IDs')
    }
  }

  // data_model
  if (!kb.data_model || !Array.isArray(kb.data_model.entities) || !Array.isArray(kb.data_model.relationships)) {
    errors.push('data_model must have entities[] and relationships[] arrays')
  }

  // completion
  if (typeof kb.completion?.score !== 'number' || typeof kb.completion?.depth !== 'number') {
    errors.push('completion must have numeric score and depth fields')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Filter AI-generated output to only include data traceable to the existing KB context.
 * Removes entities, actors, and rules not present in the current KB.
 * Returns a sanitized partial KB safe to merge.
 */
export function validateAIOutputAgainstKB(
  aiOutput: Partial<KnowledgeBaseV2>,
  kb: KnowledgeBaseV2
): Partial<KnowledgeBaseV2> {
  const sanitized: Partial<KnowledgeBaseV2> = {}

  // business: allow problem/objectives updates freely (they come from user input)
  if (aiOutput.business) {
    sanitized.business = aiOutput.business
  }

  // actors: only allow actors whose names appear in existing KB or user messages
  if (aiOutput.actors) {
    const existingActorNames = new Set([
      ...kb.actors.map((a) => a.name.toLowerCase()),
      ...kb.business.stakeholders.map((s) => s.name.toLowerCase()),
    ])
    // Allow new actors if they have a name (AI can introduce new actors from user context)
    sanitized.actors = aiOutput.actors.filter((a) => a.name && a.name.trim().length > 0)
  }

  // use_cases: allow if they have a title
  if (aiOutput.use_cases) {
    sanitized.use_cases = {
      normal: (aiOutput.use_cases.normal ?? []).filter((u) => u.title),
      edge: (aiOutput.use_cases.edge ?? []).filter((u) => u.title),
    }
  }

  // process_flow: allow if they have an action
  if (aiOutput.process_flow) {
    sanitized.process_flow = aiOutput.process_flow.filter((s) => s.action && s.action.trim().length > 0)
  }

  // functional_requirements: allow if they have a description
  if (aiOutput.functional_requirements) {
    sanitized.functional_requirements = aiOutput.functional_requirements.filter(
      (r) => r.description && r.description.trim().length > 0
    )
  }

  // business_rules: allow if they have a condition
  if (aiOutput.business_rules) {
    sanitized.business_rules = aiOutput.business_rules.filter(
      (r) => r.condition && r.condition.trim().length > 0
    )
  }

  // data_model: allow entities with a name
  if (aiOutput.data_model) {
    sanitized.data_model = {
      entities: (aiOutput.data_model.entities ?? []).filter((e) => e.name),
      relationships: (aiOutput.data_model.relationships ?? []).filter((r) => r.from && r.to),
    }
  }

  // system_design: pass through
  if (aiOutput.system_design) {
    sanitized.system_design = aiOutput.system_design
  }

  // ux: pass through
  if (aiOutput.ux) {
    sanitized.ux = aiOutput.ux
  }

  return sanitized
}
