import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event, data } = body as { event?: string; data?: Record<string, unknown> }

    if (!event || typeof event !== 'string') {
      return NextResponse.json({ ok: true })
    }

    // Attempt to get user_id if a session exists — but don't require it
    let user_id: string | null = null
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      user_id = user?.id ?? null
    } catch {
      // No session or cookie error — proceed anonymously
    }

    try {
      const supabase = await createClient()
      await supabase.from('analytics_events').insert({
        event,
        data: data ?? null,
        user_id: user_id ?? null,
      })
    } catch {
      // Intentionally swallowed — analytics must never break the caller
    }

    return NextResponse.json({ ok: true })
  } catch {
    // Intentionally swallowed — analytics must never break the caller
    return NextResponse.json({ ok: true })
  }
}
