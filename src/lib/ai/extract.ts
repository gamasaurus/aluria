import {
  KnowledgeBase, AIExtracted, AIResponse, Actor, DepthScore, DepthLevel,
  KnowledgeBaseV2, ActorV2, ProcessFlowStep, FunctionalRequirement, BusinessRule,
  NormalUseCase, EdgeUseCase, Entity, Relationship,
} from '@/lib/types'

export function parseAIResponse(raw: string): AIResponse | null {
  try {
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    if (
      typeof parsed.validation !== 'string' ||
      typeof parsed.next_question !== 'string' ||
      typeof parsed.extracted_data !== 'object'
    ) {
      return null
    }

    const depthScore: DepthScore = {
      clarity: typeof parsed.depth_score?.clarity === 'number' ? parsed.depth_score.clarity : 0,
      specificity: typeof parsed.depth_score?.specificity === 'number' ? parsed.depth_score.specificity : 0,
      completeness: typeof parsed.depth_score?.completeness === 'number' ? parsed.depth_score.completeness : 0,
      consistency: typeof parsed.depth_score?.consistency === 'number' ? parsed.depth_score.consistency : 1,
    }

    const extracted = parsed.extracted_data || {}

    return {
      insight: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
      depth_level: (parsed.depth_level || parsed.validation) as DepthLevel || 'shallow',
      depth_score: depthScore,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
      extracted: {
        problem: typeof extracted.problem === 'string' ? extracted.problem : '',
        affected_who: Array.isArray(extracted.affected_who) ? extracted.affected_who : [],
        problem_why: Array.isArray(extracted.problem_why) ? extracted.problem_why : [],
        actors: parseActors(extracted.actors),
        process_flow: Array.isArray(extracted.process_flow) ? extracted.process_flow : [],
        decision_points: Array.isArray(extracted.decision_points) ? extracted.decision_points : [],
        edge_cases: Array.isArray(extracted.edge_cases) ? extracted.edge_cases : [],
        functional_requirements: Array.isArray(extracted.functional_requirements)
          ? extracted.functional_requirements
          : [],
        business_rules: Array.isArray(extracted.business_rules) ? extracted.business_rules : [],
      },
      next_question: parsed.next_question,
    }
  } catch {
    return null
  }
}

function parseActors(raw: unknown): Actor[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((a) => ({
      name: typeof a?.name === 'string' ? a.name : '',
      role: typeof a?.role === 'string' ? a.role : '',
      responsibility: typeof a?.responsibility === 'string' ? a.responsibility : '',
    }))
    .filter((a) => a.name || a.role)
}

export function applyExtraction(kb: KnowledgeBase, extracted: AIExtracted): KnowledgeBase {
  const updated: KnowledgeBase = { ...kb }

  if (extracted.problem && extracted.problem.trim().length > 0) {
    updated.problem = extracted.problem.trim()
  }

  if (extracted.affected_who && extracted.affected_who.length > 0) {
    updated.affected_who = dedup([...kb.affected_who, ...extracted.affected_who])
  }

  if (extracted.problem_why && extracted.problem_why.length > 0) {
    updated.problem_why = dedup([...kb.problem_why, ...extracted.problem_why])
  }

  if (extracted.actors && extracted.actors.length > 0) {
    const existingNames = new Set(kb.actors.map((a) => a.name.toLowerCase()))
    const newActors = extracted.actors.filter((a) => !existingNames.has(a.name.toLowerCase()))
    updated.actors = [...kb.actors, ...newActors]
  }

  if (extracted.process_flow && extracted.process_flow.length > 0) {
    updated.process_flow = dedup([...kb.process_flow, ...extracted.process_flow.map((s) => s.trim())])
  }

  if (extracted.decision_points && extracted.decision_points.length > 0) {
    updated.decision_points = dedup([...kb.decision_points, ...extracted.decision_points.map((s) => s.trim())])
  }

  if (extracted.edge_cases && extracted.edge_cases.length > 0) {
    updated.edge_cases = dedup([...kb.edge_cases, ...extracted.edge_cases.map((s) => s.trim())])
  }

  if (extracted.functional_requirements && extracted.functional_requirements.length > 0) {
    updated.functional_requirements = dedup([
      ...kb.functional_requirements,
      ...extracted.functional_requirements.map((s) => s.trim()),
    ])
  }

  if (extracted.business_rules && extracted.business_rules.length > 0) {
    updated.business_rules = dedup([...kb.business_rules, ...extracted.business_rules.map((s) => s.trim())])
  }

  return updated
}

function dedup(arr: string[]): string[] {
  const seen = new Set<string>()
  return arr.filter((item) => {
    const key = item.toLowerCase().trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function hasValidExtraction(extracted: AIExtracted): boolean {
  return !!(
    (extracted.problem && extracted.problem.trim().length > 0) ||
    (extracted.affected_who && extracted.affected_who.length > 0) ||
    (extracted.actors && extracted.actors.length > 0) ||
    (extracted.process_flow && extracted.process_flow.length > 0) ||
    (extracted.functional_requirements && extracted.functional_requirements.length > 0) ||
    (extracted.business_rules && extracted.business_rules.length > 0)
  )
}

export function createEmptyKB(): KnowledgeBase {
  return {
    problem: '',
    affected_who: [],
    problem_why: [],
    actors: [],
    process_flow: [],
    decision_points: [],
    edge_cases: [],
    functional_requirements: [],
    business_rules: [],
    metadata: {
      depth_score: 0,
      completion_score: 0,
      stage: 'problem',
    },
  }
}

// ─── KB V2 Functions ──────────────────────────────────────────────────────────

/**
 * Factory: returns a fully initialized KnowledgeBaseV2 with all arrays empty
 * and all strings empty.
 */
export function createEmptyKBV2(): KnowledgeBaseV2 {
  return {
    business: {
      problem: '',
      objectives: [],
      success_metrics: [],
      stakeholders: [],
    },
    actors: [],
    use_cases: {
      normal: [],
      edge: [],
    },
    process_flow: [],
    functional_requirements: [],
    business_rules: [],
    data_model: {
      entities: [],
      relationships: [],
    },
    system_design: {
      architecture: {
        frontend: '',
        backend: '',
        database: '',
        ai_layer: '',
      },
      api_endpoints: [],
    },
    ux: {
      user_flow: [],
      screens: [],
    },
    completion: {
      score: 0,
      depth: 0,
      prompt_version: 2,
    },
  }
}

/**
 * Migrate a flat V1 KnowledgeBase to the hierarchical KnowledgeBaseV2 schema.
 * Pure function — does not mutate the input.
 */
export function migrateKBV1toV2(kb: KnowledgeBase): KnowledgeBaseV2 {
  const v2 = createEmptyKBV2()

  // business section
  v2.business.problem = kb.problem || ''
  v2.business.objectives = Array.isArray(kb.problem_why) ? [...kb.problem_why] : []
  v2.business.stakeholders = Array.isArray(kb.affected_who)
    ? kb.affected_who.map((s) => ({ name: s, goals: [], pain_points: [] }))
    : []

  // actors
  v2.actors = Array.isArray(kb.actors)
    ? kb.actors.map((a): ActorV2 => ({
        name: a.name || '',
        description: a.role || '',
        permissions: [],
        goals: a.responsibility ? [a.responsibility] : [],
      }))
    : []

  // process_flow: strings → structured objects
  v2.process_flow = Array.isArray(kb.process_flow)
    ? kb.process_flow.map((s, i): ProcessFlowStep => ({
        id: `step-${i + 1}`,
        actor: '',
        action: s,
        system: '',
        next: i < kb.process_flow.length - 1 ? `step-${i + 2}` : '',
      }))
    : []

  // functional_requirements: strings → objects
  v2.functional_requirements = Array.isArray(kb.functional_requirements)
    ? kb.functional_requirements.map((s, i): FunctionalRequirement => ({
        id: `fr-${i + 1}`,
        name: s.slice(0, 40),
        description: s,
        acceptance_criteria: [],
      }))
    : []

  // business_rules: strings → objects (split on THEN)
  v2.business_rules = Array.isArray(kb.business_rules)
    ? kb.business_rules.map((s, i): BusinessRule => {
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
    : []

  // edge_cases → use_cases.edge
  v2.use_cases.edge = Array.isArray(kb.edge_cases)
    ? kb.edge_cases.map((s): EdgeUseCase => ({
        title: s,
        condition: s,
        system_response: '',
      }))
    : []

  // decision_points are discarded (absorbed into process_flow steps)

  // completion scores
  v2.completion.depth = kb.metadata?.depth_score ?? 0
  v2.completion.score = Math.round((kb.metadata?.completion_score ?? 0) * 100)

  return v2
}

/**
 * Merge extracted V2 data into an existing KB V2, deduplicating by id or name.
 * Pure function — returns a new object.
 */
export function applyExtractionV2(
  kb: KnowledgeBaseV2,
  extracted: Partial<KnowledgeBaseV2>
): KnowledgeBaseV2 {
  const updated: KnowledgeBaseV2 = {
    ...kb,
    business: { ...kb.business },
    actors: [...kb.actors],
    use_cases: {
      normal: [...kb.use_cases.normal],
      edge: [...kb.use_cases.edge],
    },
    process_flow: [...kb.process_flow],
    functional_requirements: [...kb.functional_requirements],
    business_rules: [...kb.business_rules],
    data_model: {
      entities: [...kb.data_model.entities],
      relationships: [...kb.data_model.relationships],
    },
    system_design: {
      architecture: { ...kb.system_design.architecture },
      api_endpoints: [...kb.system_design.api_endpoints],
    },
    ux: {
      user_flow: [...kb.ux.user_flow],
      screens: [...kb.ux.screens],
    },
    completion: { ...kb.completion },
  }

  if (extracted.business) {
    if (extracted.business.problem) updated.business.problem = extracted.business.problem
    if (extracted.business.objectives?.length) {
      updated.business.objectives = dedupStrings([
        ...updated.business.objectives,
        ...extracted.business.objectives,
      ])
    }
    if (extracted.business.success_metrics?.length) {
      updated.business.success_metrics = dedupStrings([
        ...updated.business.success_metrics,
        ...extracted.business.success_metrics,
      ])
    }
    if (extracted.business.stakeholders?.length) {
      const existingNames = new Set(updated.business.stakeholders.map((s) => s.name.toLowerCase()))
      const newStakeholders = extracted.business.stakeholders.filter(
        (s) => !existingNames.has(s.name.toLowerCase())
      )
      updated.business.stakeholders = [...updated.business.stakeholders, ...newStakeholders]
    }
  }

  if (extracted.actors?.length) {
    const existingNames = new Set(updated.actors.map((a) => a.name.toLowerCase()))
    const newActors = extracted.actors.filter((a) => !existingNames.has(a.name.toLowerCase()))
    updated.actors = [...updated.actors, ...newActors]
  }

  if (extracted.use_cases) {
    if (extracted.use_cases.normal?.length) {
      const existingTitles = new Set(updated.use_cases.normal.map((u) => u.title.toLowerCase()))
      const newNormal = extracted.use_cases.normal.filter(
        (u) => !existingTitles.has(u.title.toLowerCase())
      )
      updated.use_cases.normal = [...updated.use_cases.normal, ...newNormal]
    }
    if (extracted.use_cases.edge?.length) {
      const existingTitles = new Set(updated.use_cases.edge.map((u) => u.title.toLowerCase()))
      const newEdge = extracted.use_cases.edge.filter(
        (u) => !existingTitles.has(u.title.toLowerCase())
      )
      updated.use_cases.edge = [...updated.use_cases.edge, ...newEdge]
    }
  }

  if (extracted.process_flow?.length) {
    const existingIds = new Set(updated.process_flow.map((s) => s.id))
    const newSteps = extracted.process_flow.filter((s) => !existingIds.has(s.id))
    updated.process_flow = [...updated.process_flow, ...newSteps]
  }

  if (extracted.functional_requirements?.length) {
    const existingIds = new Set(updated.functional_requirements.map((r) => r.id))
    const newReqs = extracted.functional_requirements.filter((r) => !existingIds.has(r.id))
    updated.functional_requirements = [...updated.functional_requirements, ...newReqs]
  }

  if (extracted.business_rules?.length) {
    const existingIds = new Set(updated.business_rules.map((r) => r.id))
    const newRules = extracted.business_rules.filter((r) => !existingIds.has(r.id))
    updated.business_rules = [...updated.business_rules, ...newRules]
  }

  if (extracted.data_model) {
    if (extracted.data_model.entities?.length) {
      const existingNames = new Set(updated.data_model.entities.map((e) => e.name.toLowerCase()))
      const newEntities = extracted.data_model.entities.filter(
        (e) => !existingNames.has(e.name.toLowerCase())
      )
      updated.data_model.entities = [...updated.data_model.entities, ...newEntities]
    }
    if (extracted.data_model.relationships?.length) {
      updated.data_model.relationships = [
        ...updated.data_model.relationships,
        ...extracted.data_model.relationships,
      ]
    }
  }

  if (extracted.system_design) {
    if (extracted.system_design.architecture) {
      updated.system_design.architecture = {
        ...updated.system_design.architecture,
        ...extracted.system_design.architecture,
      }
    }
    if (extracted.system_design.api_endpoints?.length) {
      updated.system_design.api_endpoints = [
        ...updated.system_design.api_endpoints,
        ...extracted.system_design.api_endpoints,
      ]
    }
  }

  if (extracted.ux) {
    if (extracted.ux.user_flow?.length) {
      updated.ux.user_flow = dedupStrings([...updated.ux.user_flow, ...extracted.ux.user_flow])
    }
    if (extracted.ux.screens?.length) {
      updated.ux.screens = dedupStrings([...updated.ux.screens, ...extracted.ux.screens])
    }
  }

  return updated
}

function dedupStrings(arr: string[]): string[] {
  const seen = new Set<string>()
  return arr.filter((item) => {
    const key = item.toLowerCase().trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}
