// Core types for Aluria — Thinking System Analyst Workspace

export type Stage = 'problem' | 'actors' | 'process' | 'functional' | 'rules' | 'complete'

export type DepthLevel = 'shallow' | 'partial' | 'complete'

// Depth scoring model (0-1 per dimension)
export interface DepthScore {
  clarity: number       // Is the answer clear?
  specificity: number   // Are there details/examples?
  completeness: number  // Are all aspects covered?
  consistency: number   // Does it conflict with existing data?
}

// Actor with full details
export interface Actor {
  name: string
  role: string
  responsibility: string
}

// Knowledge Base — single source of truth
export interface KnowledgeBase {
  problem: string
  affected_who: string[]   // Who is affected
  problem_why: string[]    // Why it matters

  actors: Actor[]

  process_flow: string[]
  decision_points: string[]
  edge_cases: string[]

  functional_requirements: string[]
  business_rules: string[]

  metadata: {
    depth_score: number       // 0-100 integer
    completion_score: number  // 0-1 float
    stage: Stage
  }
}

// AI Extracted data (partial KB update)
export interface AIExtracted {
  problem?: string
  affected_who?: string[]
  problem_why?: string[]
  actors?: Actor[]
  process_flow?: string[]
  decision_points?: string[]
  edge_cases?: string[]
  functional_requirements?: string[]
  business_rules?: string[]
}

// AI Response shape
export interface AIResponse {
  insight: string
  depth_level: DepthLevel
  depth_score: DepthScore
  reasoning: string
  extracted: AIExtracted
  next_question: string
}

// Chat API response
export interface ChatResponse {
  insight: string
  depth_level: DepthLevel
  depth_score: DepthScore
  next_question: string
  kb: KnowledgeBase
  stage: Stage
  is_complete: boolean
  is_clarify?: boolean
  is_fallback?: boolean
  // V2 fields
  kb_version?: 1 | 2
  guard_triggered?: boolean
  depth_breakdown?: DepthBreakdown
  recommendations?: string[]
  diagram_intent?: { diagram_type: string; confidence: number; reason: string } | null
}

export interface Project {
  id: string
  user_id: string
  name: string
  description: string
  created_at: string
}

export interface Message {
  id: string
  project_id: string
  role: 'user' | 'ai'
  content: string
  created_at: string
}

// Per-section depth breakdown (stored in knowledge_depth table)
export interface SectionDepth {
  score: number  // 0-3 points
}

export interface ActorsDepth extends SectionDepth {
  count: number
  has_roles: boolean
  has_permissions: boolean
}

export interface ProcessDepth extends SectionDepth {
  step_count: number
  has_decisions: boolean
  has_edge_cases: boolean
}

export interface FunctionalDepth extends SectionDepth {
  count: number
  has_actions: boolean
  has_io: boolean
}

export interface RulesDepth extends SectionDepth {
  has_constraints: boolean
  has_validations: boolean
}

export interface KnowledgeDepth {
  actors_depth: ActorsDepth
  process_depth: ProcessDepth
  functional_depth: FunctionalDepth
  rules_depth: RulesDepth
}

import type { User as SupabaseUser } from '@supabase/supabase-js'
export type User = SupabaseUser

// ─── KB V2 Types ──────────────────────────────────────────────────────────────

export interface ActorV2 {
  name: string
  description: string
  permissions: string[]
  goals: string[]
}

export interface NormalUseCase {
  title: string
  actor: string
  steps: string[]
}

export interface EdgeUseCase {
  title: string
  condition: string
  system_response: string
}

export interface ProcessFlowStep {
  id: string
  actor: string
  action: string
  system: string
  next: string
}

export interface FunctionalRequirement {
  id: string
  name: string
  description: string
  acceptance_criteria: string[]
}

export interface BusinessRule {
  id: string
  condition: string
  action: string
}

export interface EntityField {
  name: string
  type: string
}

export interface Entity {
  name: string
  fields: EntityField[]
}

export type Cardinality = '1:1' | '1:N' | 'N:N'

export interface Relationship {
  from: string
  to: string
  cardinality: Cardinality
}

export interface SystemArchitecture {
  frontend: string
  backend: string
  database: string
  ai_layer: string
}

export interface APIEndpoint {
  method: string
  path: string
  description: string
}

export interface KnowledgeBaseV2 {
  business: {
    problem: string
    objectives: string[]
    success_metrics: string[]
    stakeholders: Array<{ name: string; goals: string[]; pain_points: string[] }>
  }
  actors: ActorV2[]
  use_cases: {
    normal: NormalUseCase[]
    edge: EdgeUseCase[]
  }
  process_flow: ProcessFlowStep[]
  functional_requirements: FunctionalRequirement[]
  business_rules: BusinessRule[]
  data_model: {
    entities: Entity[]
    relationships: Relationship[]
  }
  system_design: {
    architecture: SystemArchitecture
    api_endpoints: APIEndpoint[]
  }
  ux: {
    user_flow: string[]
    screens: string[]
  }
  completion: {
    score: number   // 0-100
    depth: number   // 0-100
    prompt_version?: number  // default 2 when absent
  }
}

export interface DepthBreakdownSection {
  score: number
  max: number
  items: number
}

export interface DepthBreakdown {
  use_cases_normal: DepthBreakdownSection
  use_cases_edge: DepthBreakdownSection
  process_flow: DepthBreakdownSection
  data_model: DepthBreakdownSection
  functional_requirements: DepthBreakdownSection
  total: number
}

export interface AntiShallowGuardResult {
  blocked: boolean
  reason?: string
  forced_question?: string
}
