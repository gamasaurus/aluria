/**
 * KB Version Snapshots — create, diff, and manage KB version history.
 * All functions are pure (no side effects) except saveProjectVersion.
 */

import type { KnowledgeBaseV2 } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface KBSnapshot {
  version: number
  timestamp: string
  kb: KnowledgeBaseV2
  changed_by?: string
}

export interface KBDiff {
  added: string[]
  removed: string[]
  modified: string[]
}

/**
 * Create a snapshot of the current KB state.
 * Pure function — returns a new snapshot object.
 */
export function createSnapshot(kb: KnowledgeBaseV2, version: number, changedBy?: string): KBSnapshot {
  return {
    version,
    timestamp: new Date().toISOString(),
    kb: JSON.parse(JSON.stringify(kb)) as KnowledgeBaseV2, // deep clone
    changed_by: changedBy,
  }
}

/**
 * Compute a structural diff between two KB snapshots.
 * Returns lists of added, removed, and modified section keys.
 */
export function diffSnapshots(a: KBSnapshot, b: KBSnapshot): KBDiff {
  const added: string[] = []
  const removed: string[] = []
  const modified: string[] = []

  const sections = [
    'business',
    'actors',
    'use_cases',
    'process_flow',
    'functional_requirements',
    'business_rules',
    'data_model',
    'system_design',
    'ux',
  ] as const

  for (const section of sections) {
    const aVal = JSON.stringify(a.kb[section])
    const bVal = JSON.stringify(b.kb[section])

    if (aVal === bVal) continue

    // Determine if items were added, removed, or modified
    const aArr = Array.isArray(a.kb[section]) ? (a.kb[section] as unknown[]) : null
    const bArr = Array.isArray(b.kb[section]) ? (b.kb[section] as unknown[]) : null

    if (aArr !== null && bArr !== null) {
      if (bArr.length > aArr.length) {
        added.push(section)
      } else if (bArr.length < aArr.length) {
        removed.push(section)
      } else {
        modified.push(section)
      }
    } else {
      modified.push(section)
    }
  }

  return { added, removed, modified }
}

/**
 * Determine whether a new snapshot should be created.
 * Returns true every 5 updates OR when the stage changes.
 */
export function shouldCreateSnapshot(updateCount: number, stageChanged: boolean): boolean {
  return stageChanged || updateCount % 5 === 0
}

/**
 * Save a project version snapshot to Supabase.
 * Reads the current max version, increments by 1, inserts a new row.
 */
export async function saveProjectVersion(
  projectId: string,
  kb: KnowledgeBaseV2,
  supabase: SupabaseClient
): Promise<void> {
  // Get current max version
  const { data: existing } = await supabase
    .from('project_versions')
    .select('version')
    .eq('project_id', projectId)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  const nextVersion = (existing?.version ?? 0) + 1

  await supabase.from('project_versions').insert({
    project_id: projectId,
    version: nextVersion,
    kb_snapshot: kb,
    created_at: new Date().toISOString(),
  })
}
