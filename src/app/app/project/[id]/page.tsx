import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createEmptyKBV2, migrateKBV1toV2 } from '@/lib/ai/extract'
import ChatPageClient from '@/components/chat/ChatPageClient'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import type { KnowledgeBase } from '@/lib/types'

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
    kbV2 = rawKB
  } else if (rawKB && typeof rawKB === 'object') {
    kbV2 = migrateKBV1toV2(rawKB as KnowledgeBase)
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