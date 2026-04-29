/**
 * System Boundary Definition — derives and checks system boundaries from KB V2.
 * All functions are pure (no side effects).
 */

import type { KnowledgeBaseV2 } from '@/lib/types'

export interface SystemBoundary {
  internal: string[]   // Components/actors inside the system
  external: string[]   // External actors/systems that interact with the system
  interfaces: string[] // API endpoints and integration points
}

/**
 * Derive the system boundary from actors, use_cases, and system_design sections.
 * Internal: actors with permissions defined (they operate within the system)
 * External: actors without permissions (they interact from outside)
 * Interfaces: API endpoints
 */
export function getSystemBoundary(kb: KnowledgeBaseV2): SystemBoundary {
  const internal: string[] = []
  const external: string[] = []
  const interfaces: string[] = []

  // Classify actors as internal or external
  for (const actor of kb.actors) {
    if (actor.permissions.length > 0) {
      internal.push(actor.name)
    } else {
      external.push(actor.name)
    }
  }

  // Add system components from architecture
  const arch = kb.system_design.architecture
  if (arch.frontend) internal.push(`Frontend: ${arch.frontend}`)
  if (arch.backend) internal.push(`Backend: ${arch.backend}`)
  if (arch.database) internal.push(`Database: ${arch.database}`)
  if (arch.ai_layer) internal.push(`AI Layer: ${arch.ai_layer}`)

  // Add API endpoints as interfaces
  for (const endpoint of kb.system_design.api_endpoints) {
    interfaces.push(`${endpoint.method} ${endpoint.path}`)
  }

  // Add use case actors as external if not already classified
  const allActorNames = new Set([...internal, ...external].map((n) => n.toLowerCase()))
  for (const uc of kb.use_cases.normal) {
    if (uc.actor && !allActorNames.has(uc.actor.toLowerCase())) {
      external.push(uc.actor)
      allActorNames.add(uc.actor.toLowerCase())
    }
  }

  return { internal, external, interfaces }
}

/**
 * Check if an entity name is within the defined system boundary.
 * Checks both internal and external lists (case-insensitive).
 */
export function isWithinBoundary(entity: string, boundary: SystemBoundary): boolean {
  const entityLower = entity.toLowerCase()
  return (
    boundary.internal.some((i) => i.toLowerCase().includes(entityLower)) ||
    boundary.external.some((e) => e.toLowerCase().includes(entityLower)) ||
    boundary.interfaces.some((i) => i.toLowerCase().includes(entityLower))
  )
}
