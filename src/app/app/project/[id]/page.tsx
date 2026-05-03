import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createEmptyKBV2, migrateKBV1toV2 } from '@/lib/ai/extract'
import ChatPageClient from '@/components/chat/ChatPageClient'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import type { KnowledgeBase, KnowledgeBaseV2 } from '@/lib/types'

// Ensures every required field of KnowledgeBaseV2 exists, filling gaps with empty defaults.
// Handles partially-migrated, malformed, or legacy KB objects safely.
function normalizeKBV2(raw: unknown): KnowledgeBaseV2 {
  const empty = createEmptyKBV2()
  if (!raw || typeof raw !== 'object') return empty
  const r = raw as Record<string, unknown>

  const business = (r.business && typeof r.business === 'object') ? r.business as Record<string, unknown> : {}
  const dataModel = (r.data_model && typeof r.data_model === 'object') ? r.data_model as Record<string, unknown> : {}
  const systemDesign = (r.system_design && typeof r.system_design === 'object') ? r.system_design as Record<string, unknown> : {}
  const arch = (systemDesign.architecture && typeof systemDesign.architecture === 'object') ? systemDesign.architecture as Record<string, unknown> : {}
  const useCases = (r.use_cases && typeof r.use_cases === 'object') ? r.use_cases as Record<string, unknown> : {}
  const ux = (r.ux && typeof r.ux === 'object') ? r.ux as Record<string, unknown> : {}
  const completion = (r.completion && typeof r.completion === 'object') ? r.completion as Record<string, unknown> : {}

  return {
    business: {
      problem: typeof business.problem === 'string' ? business.problem : '',
      objectives: Array.isArray(business.objectives) ? business.objectives : [],
      success_metrics: Array.isArray(business.success_metrics) ? business.success_metrics : [],
      stakeholders: Array.isArray(business.stakeholders) ? business.stakeholders : [],
    },
    actors: Array.isArray(r.actors)
      ? (r.actors as Record<string, unknown>[]).map(a => ({
          name: typeof a?.name === 'string' ? a.name : '',
          description: typeof a?.description === 'string' ? a.description : '',
          permissions: Array.isArray(a?.permissions) ? a.permissions : [],
          goals: Array.isArray(a?.goals) ? a.goals : [],
        }))
      : [],
    use_cases: {
      normal: Array.isArray(useCases.normal) ? useCases.normal : [],
      edge: Array.isArray(useCases.edge) ? useCases.edge : [],
    },
    process_flow: Array.isArray(r.process_flow) ? r.process_flow : [],
    functional_requirements: Array.isArray(r.functional_requirements)
      ? (r.functional_requirements as Record<string, unknown>[]).map(req => ({
          id: typeof req?.id === 'string' ? req.id : '',
          name: typeof req?.name === 'string' ? req.name : '',
          description: typeof req?.description === 'string' ? req.description : '',
          acceptance_criteria: Array.isArray(req?.acceptance_criteria) ? req.acceptance_criteria : [],
        }))
      : [],
    business_rules: Array.isArray(r.business_rules)
      ? (r.business_rules as Record<string, unknown>[]).map(rule => ({
          id: typeof rule?.id === 'string' ? rule.id : '',
          condition: typeof rule?.condition === 'string' ? rule.condition : '',
          action: typeof rule?.action === 'string' ? rule.action : '',
        }))
      : [],
    data_model: {
      entities: Array.isArray(dataModel.entities)
        ? (dataModel.entities as Record<string, unknown>[]).map(e => ({
            name: typeof e?.name === 'string' ? e.name : '',
            fields: Array.isArray(e?.fields)
              ? (e.fields as Record<string, unknown>[]).map(f => ({
                  name: typeof f?.name === 'string' ? f.name : '',
                  type: typeof f?.type === 'string' ? f.type : '',
                }))
              : [],
          }))
        : [],
      relationships: Array.isArray(dataModel.relationships) ? dataModel.relationships : [],
    },
    system_design: {
      architecture: {
        frontend: typeof arch.frontend === 'string' ? arch.frontend : '',
        backend: typeof arch.backend === 'string' ? arch.backend : '',
        database: typeof arch.database === 'string' ? arch.database : '',
        ai_layer: typeof arch.ai_layer === 'string' ? arch.ai_layer : '',
      },
      api_endpoints: Array.isArray(systemDesign.api_endpoints) ? systemDesign.api_endpoints : [],
    },
    ux: {
      user_flow: Array.isArray(ux.user_flow) ? ux.user_flow : [],
      screens: Array.isArray(ux.screens) ? ux.screens : [],
    },
    completion: {
      score: typeof completion.score === 'number' ? completion.score : 0,
      depth: typeof completion.depth === 'number' ? completion.depth : 0,
      prompt_version: typeof completion.prompt_version === 'number' ? completion.prompt_version : 2,
    },
  }
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!project) redirect('/app')

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: true })

  const { data: kbRow } = await supabase
    .from('knowledge_bases')
    .select('json_content, kb_version')
    .eq('project_id', id)
    .single()

  const { data: allProjects } = await supabase
    .from('projects')
    .select('id, name, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Always use V2 — migrate V1 KB on the fly if needed
  const rawKB = kbRow?.json_content
  const kbVersion = kbRow?.kb_version ?? 1
  let kbV2
  if (kbVersion === 2 && rawKB && typeof rawKB === 'object' && 'business' in rawKB) {
    kbV2 = normalizeKBV2(rawKB)
  } else if (rawKB && typeof rawKB === 'object') {
    kbV2 = normalizeKBV2(migrateKBV1toV2(rawKB as KnowledgeBase))
  } else {
    kbV2 = createEmptyKBV2()
  }

  return (
    <ErrorBoundary>
      <ChatPageClient
        project={project}
        initialMessages={messages ?? []}
        initialKB={kbV2}
        user={user}
      />
    </ErrorBoundary>
  )
}