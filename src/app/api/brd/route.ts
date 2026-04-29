import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { trackEvent } from '@/lib/analytics'
import { generateUSD, generateMermaid, generateBPMNXml, generatePSB } from '@/lib/ai/bpmn'
import { createEmptyKB, createEmptyKBV2 } from '@/lib/ai/extract'
import { calculateDepth, computeProgress, calculateDepthV2, computeProgressV2 } from '@/lib/ai/depth'
import { buildPSBPrompt } from '@/lib/ai/prompt'
import { detectConflicts, hasUnresolvedConflicts } from '@/lib/ai/conflict'
import type { KnowledgeBase, KnowledgeBaseV2 } from '@/lib/types'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { FEATURES } from '@/lib/features'

// ─── AI call helper (same pattern as chat route) ──────────────────────────────

async function callOpenAI(opts: { system: string; user: string }): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  const openai = new OpenAI({ apiKey })
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
    temperature: 0.3,
    max_tokens: 1500,
  })
  return completion.choices[0]?.message?.content ?? null
}

async function callGemini(opts: { system: string; user: string }): Promise<string | null> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (!apiKey) return null
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: opts.system,
  })
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: opts.user }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 1500 },
  })
  return result.response.text() || null
}

async function callAI(opts: { system: string; user: string }): Promise<string | null> {
  if (process.env.OPENAI_API_KEY) {
    try {
      return await callOpenAI(opts)
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status !== 429 && status !== 401) throw err
    }
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY) {
    return await callGemini(opts)
  }
  return null
}

// ─── GET /api/brd ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const project_id = searchParams.get('project_id')
    const format = searchParams.get('format') || 'usd'
    const mode = searchParams.get('mode')

    if (!project_id) {
      return NextResponse.json({ error: 'Missing project_id' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: project } = await supabase
      .from('projects')
      .select('name')
      .eq('id', project_id)
      .eq('user_id', user.id)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const { data: kbRow } = await supabase
      .from('knowledge_bases')
      .select('json_content, kb_version')
      .eq('project_id', project_id)
      .single()

    const kbVersion: 1 | 2 = (kbRow?.kb_version ?? 1) as 1 | 2

    // ── V2 ROUTING ────────────────────────────────────────────────────────────
    if (kbVersion === 2 && FEATURES.PSB_V2) {
      const rawKB = kbRow?.json_content
      const kbV2: KnowledgeBaseV2 = rawKB && typeof rawKB === 'object' && 'business' in rawKB
        ? rawKB as KnowledgeBaseV2
        : createEmptyKBV2()

      // Check for unresolved conflicts before generation
      const conflicts = detectConflicts(kbV2)
      if (hasUnresolvedConflicts(conflicts)) {
        return NextResponse.json(
          {
            error: 'Unresolved conflicts detected. Resolve all conflicts before generating the PSB.',
            conflicts,
          },
          { status: 409 }
        )
      }

      // AI-assisted PSB generation
      if (mode === 'psb') {
        const prompt = buildPSBPrompt(kbV2, project.name)
        let aiPSB: string | null = null
        try {
          aiPSB = await callAI({
            system: 'You are a Senior System Architect. Generate a complete PSB document in Markdown.',
            user: prompt,
          })
        } catch (err) {
          console.error('[brd] AI PSB generation failed:', err)
        }

        const psb = aiPSB ?? generatePSB(kbV2, project.name)
        trackEvent('psb_generated')
        return NextResponse.json({
          brd: psb,
          kb_version: 2,
          metadata: {
            depth_score: calculateDepthV2(kbV2),
            completion_score: Math.round(computeProgressV2(kbV2) * 100),
            actors: kbV2.actors.length,
            process_steps: kbV2.process_flow.length,
            functional_requirements: kbV2.functional_requirements.length,
            business_rules: kbV2.business_rules.length,
          },
        })
      }

      // Default: deterministic PSB generation
      const psb = generatePSB(kbV2, project.name)
      trackEvent('psb_generated')
      return NextResponse.json({
        brd: psb,
        kb_version: 2,
        metadata: {
          depth_score: calculateDepthV2(kbV2),
          completion_score: Math.round(computeProgressV2(kbV2) * 100),
          actors: kbV2.actors.length,
          process_steps: kbV2.process_flow.length,
          functional_requirements: kbV2.functional_requirements.length,
          business_rules: kbV2.business_rules.length,
        },
      })
    }

    // ── V1 ROUTING (unchanged) ────────────────────────────────────────────────
    const kb: KnowledgeBase = kbRow?.json_content ?? createEmptyKB()

    if (format === 'mermaid') {
      return NextResponse.json({ mermaid: generateMermaid(kb) })
    }

    if (format === 'bpmn') {
      return NextResponse.json({ bpmn: generateBPMNXml(kb) })
    }

    // Default: unified BRD + SRS document
    const brd = generateUSD(kb, project.name)
    return NextResponse.json({
      brd,
      kb_version: 1,
      metadata: {
        depth_score: calculateDepth(kb),
        completion_score: Math.round(computeProgress(kb) * 100),
        actors: kb.actors.length,
        process_steps: kb.process_flow.length,
        functional_requirements: kb.functional_requirements.length,
        business_rules: kb.business_rules.length,
      },
    })
  } catch (err) {
    console.error('[brd/route] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
