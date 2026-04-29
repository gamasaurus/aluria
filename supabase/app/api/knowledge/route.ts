import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createEmptyKB } from '@/lib/ai/extract'
import type { KnowledgeBase } from '@/lib/types'
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { project_ id, ...updates } = body
    if (!project_ id) {
      return NextResponse.json({ error: 'Missing project_ id' }, { status: 400 })
    }
    const supabase = await createClient()    const { data: { user } } = await supabase. auth.getUser()
    if (!user) {      return NextResponse. json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: kbRow } = await supabase
      .from('knowledge_ bases')
      .select('json_ content')
      .eq('project_ id', project_ id)
      .single()    const currentKB: KnowledgeBase = kbRow?.json_ content ?? createEmptyKB()
    const updatedKB: KnowledgeBase = { ...currentKB, ...updates }
    await supabase. from('knowledge_ bases').upsert({      project_ id,
      json_ content: updatedKB,
      updated_ at: new Date().toISOString(),    })
    return NextResponse. json({ kb: updatedKB })  } catch (err) {
    console. error('[knowledge/ route] Error:', err)
    return NextResponse. json({ error: 'Internal server error' }, { status: 500 })
  }
}