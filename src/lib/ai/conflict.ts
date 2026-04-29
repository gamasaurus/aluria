/**
 * Conflict Resolution Engine — detects and resolves conflicts in KB V2.
 * All functions are pure (no side effects).
 */

import type { KnowledgeBaseV2 } from '@/lib/types'

export type ConflictType = 'logical' | 'role' | 'process' | 'rule'

export interface ConflictEntry {
  id: string
  type: ConflictType
  description: string
  related_nodes: string[]
  status: 'unresolved' | 'resolved'
  resolution_note?: string
}

/**
 * Detect conflicts in a KB V2 object.
 * Checks for:
 * - Same actor + conflicting action across process steps (process conflict)
 * - Same condition + different outcomes in business rules (rule conflict)
 * Returns an empty array if no conflicts are found.
 */
export function detectConflicts(kb: KnowledgeBaseV2): ConflictEntry[] {
  const conflicts: ConflictEntry[] = []
  let conflictIdx = 0

  // Process conflicts: same actor with contradictory actions
  const actorActionMap = new Map<string, string[]>()
  for (const step of kb.process_flow) {
    if (!step.actor) continue
    const key = step.actor.toLowerCase().trim()
    if (!actorActionMap.has(key)) actorActionMap.set(key, [])
    actorActionMap.get(key)!.push(step.action)
  }

  for (const [actor, actions] of actorActionMap.entries()) {
    if (actions.length < 2) continue
    // Check for contradictory verbs (approve/reject, create/delete, enable/disable)
    const contradictions: Array<[string, string]> = [
      ['approve', 'reject'],
      ['create', 'delete'],
      ['enable', 'disable'],
      ['allow', 'deny'],
      ['add', 'remove'],
    ]
    for (const [verbA, verbB] of contradictions) {
      const hasA = actions.some((a) => new RegExp(`\\b${verbA}\\b`, 'i').test(a))
      const hasB = actions.some((a) => new RegExp(`\\b${verbB}\\b`, 'i').test(a))
      if (hasA && hasB) {
        conflictIdx++
        conflicts.push({
          id: `conflict-${conflictIdx}`,
          type: 'process',
          description: `Actor "${actor}" has conflicting actions: "${verbA}" and "${verbB}"`,
          related_nodes: actions.filter((a) =>
            new RegExp(`\\b${verbA}\\b|\\b${verbB}\\b`, 'i').test(a)
          ),
          status: 'unresolved',
        })
      }
    }
  }

  // Rule conflicts: same condition + different outcomes
  const conditionMap = new Map<string, string[]>()
  for (const rule of kb.business_rules) {
    const key = rule.condition.toLowerCase().trim()
    if (!conditionMap.has(key)) conditionMap.set(key, [])
    conditionMap.get(key)!.push(rule.action)
  }

  for (const [condition, actions] of conditionMap.entries()) {
    if (actions.length < 2) continue
    // Multiple different actions for the same condition = conflict
    const uniqueActions = [...new Set(actions.map((a) => a.toLowerCase().trim()))]
    if (uniqueActions.length > 1) {
      conflictIdx++
      conflicts.push({
        id: `conflict-${conflictIdx}`,
        type: 'rule',
        description: `Condition "${condition}" has ${uniqueActions.length} different outcomes`,
        related_nodes: actions,
        status: 'unresolved',
      })
    }
  }

  return conflicts
}

/**
 * Mark a conflict as resolved in the KB.
 * Pure function — returns a new KB object with the conflict updated.
 * Note: conflicts are stored in the KB's business_rules metadata conceptually;
 * this function returns the KB unchanged since conflicts are computed dynamically.
 * In practice, the caller should store ConflictEntry[] alongside the KB.
 */
export function resolveConflict(
  kb: KnowledgeBaseV2,
  conflictId: string,
  resolutionNote: string
): KnowledgeBaseV2 {
  // KB V2 does not have a conflicts array in its schema.
  // This function is a no-op on the KB itself — conflict state is managed externally.
  // Returning the KB unchanged preserves the pure function contract.
  void conflictId
  void resolutionNote
  return { ...kb }
}

/**
 * Check if any conflicts in the provided list are unresolved.
 */
export function hasUnresolvedConflicts(conflicts: ConflictEntry[]): boolean {
  return conflicts.some((c) => c.status === 'unresolved')
}
