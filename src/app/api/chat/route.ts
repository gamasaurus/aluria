import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'
import {
  resolveStage,
  isComplete,
  calculateDepth,
  computeProgress,
  DEFAULT_DEPTH_SCORE,
  calculateDepthV2,
  computeProgressV2,
  getDepthBreakdown,
} from '@/lib/ai/depth'
import { buildSystemPrompt, buildUserPrompt, buildSystemPromptV2, buildUserPromptV2, retryAI, estimateTokenUsage } from '@/lib/ai/prompt'
import {
  parseAIResponse,
  applyExtraction,
  createEmptyKB,
  hasValidExtraction,
  createEmptyKBV2,
  applyExtractionV2,
  migrateKBV1toV2,
} from '@/lib/ai/extract'
import { enforceQuestionRules, checkAntiShallowGuard } from '@/lib/ai/guard'
import { isTooShort, clarifyResponse } from '@/lib/ai/validate'
import { guidedModeHandler, guidedModeHandlerV2 } from '@/lib/ai/guided'
import { validateAIOutputAgainstKB } from '@/lib/ai/validation'
import type { KnowledgeBase, KnowledgeBaseV2, DepthScore, Stage, DepthLevel } from '@/lib/types'
import { FEATURES } from '@/lib/features'

// ─── Feature flag ─────────────────────────────────────────────────────────────

function useAI(): boolean {
  return FEATURES.AI_ENABLED
}

// ─── AI Providers ─────────────────────────────────────────────────────────────

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
    max_tokens: 600,
    response_format: { type: 'json_object' },
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
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 600,
      responseMimeType: 'application/json',
    },
  })
  return result.response.text() || null
}

/**
 * Try OpenAI first. On quota/auth failure (429/401), fall back to Gemini.
 */
async function callAI(opts: { system: string; user: string }): Promise<string | null> {
  const hasOpenAI = !!process.env.OPENAI_API_KEY
  const hasGemini = !!(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY)

  if (hasOpenAI) {
    try {
      return await callOpenAI(opts)
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status === 429 || status === 401) {
        console.warn(`[chat] OpenAI unavailable (${status}), falling back to Gemini`)
      } else {
        throw err
      }
    }
  }

  if (hasGemini) {
    return await callGemini(opts)
  }

  return null
}

/**
 * Stream V2 AI response via OpenAI streaming API.
 * Returns a ReadableStream of SSE chunks, or null if streaming is unavailable.
 * Each chunk is a JSON string: { token: string } or { done: true, full: string }
 */
async function callOpenAIStream(opts: { system: string; user: string }): Promise<ReadableStream<Uint8Array> | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const openai = new OpenAI({ apiKey })
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: opts.system },
            { role: 'user', content: opts.user },
          ],
          temperature: 0.3,
          max_tokens: 600,
          stream: true,
        })

        let fullText = ''
        for await (const chunk of completion) {
          const token = chunk.choices[0]?.delta?.content ?? ''
          if (token) {
            fullText += token
            const data = `data: ${JSON.stringify({ token })}\n\n`
            controller.enqueue(encoder.encode(data))
          }
        }
        // Send final complete message
        const done = `data: ${JSON.stringify({ done: true, full: fullText })}\n\n`
        controller.enqueue(encoder.encode(done))
        controller.close()
      } catch (err) {
        const errData = `data: ${JSON.stringify({ error: String(err) })}\n\n`
        controller.enqueue(encoder.encode(errData))
        controller.close()
      }
    },
  })

  return stream
}

export async function POST(request: NextRequest) {
  try {
    const { project_id, message } = await request.json()

    if (!project_id || !message) {
      return NextResponse.json({ error: 'Missing project_id or message' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Gate: message too short — return current KB, not empty KB
    if (isTooShort(message)) {
      // Load KB first so we don't reset the client state
      const { data: kbRowShort } = await supabase
        .from('knowledge_bases')
        .select('json_content, kb_version')
        .eq('project_id', project_id)
        .single()
      const currentKB: KnowledgeBase = kbRowShort?.json_content ?? createEmptyKB()
      const clarify = clarifyResponse()
      return NextResponse.json({
        insight: clarify.insight,
        depth_level: 'shallow' as DepthLevel,
        depth_score: DEFAULT_DEPTH_SCORE,
        next_question: clarify.next_question,
        kb: currentKB,
        stage: resolveStage(currentKB),
        is_complete: isComplete(currentKB),
        is_clarify: true,
        kb_version: (kbRowShort?.kb_version ?? 1) as 1 | 2,
      })
    }

    // Load KB
    const { data: kbRow } = await supabase
      .from('knowledge_bases')
      .select('json_content, kb_version')
      .eq('project_id', project_id)
      .single()

    const kbVersion: 1 | 2 = (kbRow?.kb_version ?? 1) as 1 | 2

    const kb: KnowledgeBase = kbRow?.json_content ?? createEmptyKB()

    // Save user message
    await supabase.from('messages').insert({ project_id, role: 'user', content: message })

    // ── V2 ROUTING BRANCH ─────────────────────────────────────────────────────
    if (kbVersion === 2 && FEATURES.PSB_V2) {
      const rawKB = kbRow?.json_content
      const kbV2: KnowledgeBaseV2 = rawKB && typeof rawKB === 'object' && 'business' in rawKB
        ? rawKB as KnowledgeBaseV2
        : createEmptyKBV2()

      // ── V2 GUIDED MODE ──────────────────────────────────────────────────────
      if (!useAI()) {
        console.log('[chat] V2 Guided mode active (USE_AI=false)')

        const guardResult = checkAntiShallowGuard(kbV2, resolveStage(kb))
        if (guardResult.blocked) {
          const forcedQ = enforceQuestionRules(guardResult.forced_question ?? 'Please provide more details.')
          await supabase.from('messages').insert({ project_id, role: 'ai', content: forcedQ })
          return NextResponse.json({
            insight: 'Anti-Shallow Guard triggered',
            depth_level: 'shallow' as DepthLevel,
            depth_score: DEFAULT_DEPTH_SCORE,
            next_question: forcedQ,
            kb: kbV2,
            stage: resolveStage(kb),
            is_complete: false,
            guard_triggered: true,
            kb_version: 2 as const,
            depth_breakdown: getDepthBreakdown(kbV2),
          })
        }

        const result = guidedModeHandlerV2(message, kbV2)
        const depthScore = calculateDepthV2(result.updatedKB)
        const completionScore = computeProgressV2(result.updatedKB)

        await supabase.from('knowledge_bases').upsert({
          project_id,
          json_content: result.updatedKB,
          kb_version: 2,
          depth_score_v2: depthScore,
          completion_score_v2: Math.round(completionScore * 100) / 100,
          updated_at: new Date().toISOString(),
        })

        const guardedQuestion = enforceQuestionRules(result.next_question)
        await supabase.from('messages').insert({ project_id, role: 'ai', content: guardedQuestion })

        return NextResponse.json({
          insight: result.insight,
          depth_level: result.depth_level,
          depth_score: result.depth_score,
          next_question: guardedQuestion,
          kb: result.updatedKB,
          stage: result.stage,
          is_complete: result.is_complete,
          guard_triggered: result.guard_triggered,
          kb_version: 2 as const,
          depth_breakdown: getDepthBreakdown(result.updatedKB),
          is_guided: true,
        })
      }

      // ── V2 AI MODE ──────────────────────────────────────────────────────────
      const guardResult = checkAntiShallowGuard(kbV2, resolveStage(kb))
      if (guardResult.blocked) {
        const forcedQ = enforceQuestionRules(guardResult.forced_question ?? 'Please provide more details.')
        await supabase.from('messages').insert({ project_id, role: 'ai', content: forcedQ })
        return NextResponse.json({
          insight: 'Anti-Shallow Guard triggered',
          depth_level: 'shallow' as DepthLevel,
          depth_score: DEFAULT_DEPTH_SCORE,
          next_question: forcedQ,
          kb: kbV2,
          stage: resolveStage(kb),
          is_complete: false,
          guard_triggered: true,
          kb_version: 2 as const,
          depth_breakdown: getDepthBreakdown(kbV2),
        })
      }

      // Load recent messages for V2 context
      const { data: recentMsgsV2 } = await supabase
        .from('messages')
        .select('role, content')
        .eq('project_id', project_id)
        .order('created_at', { ascending: false })
        .limit(5)

      const lastMsgsV2 = (recentMsgsV2 ?? []).reverse()
      const stageV2 = resolveStage(kb)

      // Route to correct prompt builder based on prompt_version (default 2)
      const promptVersion = kbV2.completion.prompt_version ?? 2
      const systemPromptV2 = promptVersion === 2 ? buildSystemPromptV2() : buildSystemPromptV2()
      const userPromptV2 = buildUserPromptV2({
        stage: stageV2,
        kb: kbV2,
        userMessage: message,
        recentMessages: lastMsgsV2,
      })

      let aiRawV2: string | null = null
      try {
        aiRawV2 = await callAI({ system: systemPromptV2, user: userPromptV2 })
      } catch (err) {
        console.error('[chat] V2 AI call failed:', err)
        aiRawV2 = null
      }

      let updatedKBV2 = kbV2

      if (aiRawV2) {
        try {
          const cleaned = aiRawV2
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/```\s*$/i, '')
            .trim()
          const parsed = JSON.parse(cleaned)
          const extracted = parsed.extracted as Partial<KnowledgeBaseV2>
          if (extracted) {
            const sanitized = validateAIOutputAgainstKB(extracted, kbV2)
            updatedKBV2 = applyExtractionV2(kbV2, sanitized)
          }

          const depthScore = calculateDepthV2(updatedKBV2)
          const completionScore = computeProgressV2(updatedKBV2)
          updatedKBV2 = {
            ...updatedKBV2,
            completion: {
              depth: depthScore,
              score: Math.round(completionScore * 100),
            },
          }

          await supabase.from('knowledge_bases').upsert({
            project_id,
            json_content: updatedKBV2,
            kb_version: 2,
            depth_score_v2: depthScore,
            completion_score_v2: Math.round(completionScore * 100) / 100,
            updated_at: new Date().toISOString(),
          })

          const nextQuestion = parsed.next_question
            ? enforceQuestionRules(parsed.next_question)
            : enforceQuestionRules('What else should we define about this system?')

          await supabase.from('messages').insert({ project_id, role: 'ai', content: nextQuestion })

          return NextResponse.json({
            insight: parsed.reasoning ?? '',
            depth_level: 'partial' as DepthLevel,
            depth_score: DEFAULT_DEPTH_SCORE,
            next_question: nextQuestion,
            kb: updatedKBV2,
            stage: stageV2,
            is_complete: false,
            guard_triggered: false,
            kb_version: 2 as const,
            depth_breakdown: getDepthBreakdown(updatedKBV2),
          })
        } catch (err) {
          console.error('[chat] V2 AI response parse failed, falling back to guided mode:', err)
        }
      }

      // V2 AI fallback → guided mode V2
      const fallbackResult = guidedModeHandlerV2(message, kbV2)
      const depthScoreFb = calculateDepthV2(fallbackResult.updatedKB)
      const completionScoreFb = computeProgressV2(fallbackResult.updatedKB)

      await supabase.from('knowledge_bases').upsert({
        project_id,
        json_content: fallbackResult.updatedKB,
        kb_version: 2,
        depth_score_v2: depthScoreFb,
        completion_score_v2: Math.round(completionScoreFb * 100) / 100,
        updated_at: new Date().toISOString(),
      })

      const fallbackQ = enforceQuestionRules(fallbackResult.next_question)
      await supabase.from('messages').insert({ project_id, role: 'ai', content: fallbackQ })

      return NextResponse.json({
        insight: fallbackResult.insight,
        depth_level: fallbackResult.depth_level,
        depth_score: fallbackResult.depth_score,
        next_question: fallbackQ,
        kb: fallbackResult.updatedKB,
        stage: fallbackResult.stage,
        is_complete: fallbackResult.is_complete,
        guard_triggered: fallbackResult.guard_triggered,
        kb_version: 2 as const,
        depth_breakdown: getDepthBreakdown(fallbackResult.updatedKB),
        is_fallback: true,
      })
    }

    // ── V1 PIPELINE (unchanged below) ─────────────────────────────────────────

    // ── GUIDED MODE (USE_AI=false) ────────────────────────────────────────────
    if (!useAI()) {
      console.log('[chat] Guided mode active (USE_AI=false)')

      const currentStage = resolveStage(kb)

      // At complete stage — don't re-extract, just confirm and return existing KB
      if (currentStage === 'complete') {
        const depthInt = calculateDepth(kb)
        const completionFloat = computeProgress(kb)
        const finalKB: KnowledgeBase = {
          ...kb,
          metadata: { ...kb.metadata, depth_score: depthInt, completion_score: completionFloat, stage: 'complete' },
        }
        const reply = 'All requirements are collected. Opening document preview now.'
        await supabase.from('messages').insert({ project_id, role: 'ai', content: reply })
        return NextResponse.json({
          insight: 'Semua kebutuhan sudah terkumpul',
          depth_level: 'complete' as DepthLevel,
          depth_score: DEFAULT_DEPTH_SCORE,
          next_question: reply,
          kb: finalKB,
          stage: 'complete' as Stage,
          is_complete: true,
          is_guided: true,
        })
      }

      const result = guidedModeHandler(message, kb)

      await supabase.from('knowledge_bases').upsert({
        project_id,
        json_content: result.updatedKB,
        updated_at: new Date().toISOString(),
      })

      const guardedQuestion = enforceQuestionRules(result.next_question)
      await supabase.from('messages').insert({ project_id, role: 'ai', content: guardedQuestion })

      return NextResponse.json({
        insight: result.insight,
        depth_level: result.depth_level,
        depth_score: result.depth_score,
        next_question: guardedQuestion,
        kb: result.updatedKB,
        stage: result.stage,
        is_complete: result.is_complete,
        is_guided: true,
      })
    }

    // ── AI MODE ───────────────────────────────────────────────────────────────

    // Load recent messages for context
    const { data: recentMessages } = await supabase
      .from('messages')
      .select('role, content')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false })
      .limit(3)

    const lastMessages = (recentMessages ?? []).reverse()
    const stage = resolveStage(kb)

    const systemPrompt = buildSystemPrompt()
    const userPrompt = buildUserPrompt({ stage, kb, userMessage: message, recentMessages: lastMessages })

    let aiRaw: string | null = null
    try {
      aiRaw = await callAI({ system: systemPrompt, user: userPrompt })
    } catch (err) {
      console.error('[chat] AI call failed:', err)
      aiRaw = null
    }

    const aiResponse = aiRaw ? parseAIResponse(aiRaw) : null

    let updatedKB = kb
    let depthScore: DepthScore = DEFAULT_DEPTH_SCORE
    let depthLevel: DepthLevel = 'shallow'

    // AI failed entirely — fall back to guided mode
    if (!aiResponse) {
      console.warn('[chat] AI unavailable, falling back to guided mode')

      const currentStage = resolveStage(kb)
      if (currentStage === 'complete') {
        const reply = 'All requirements are collected. Opening document preview now.'
        await supabase.from('messages').insert({ project_id, role: 'ai', content: reply })
        return NextResponse.json({
          insight: 'Semua kebutuhan sudah terkumpul',
          depth_level: 'complete' as DepthLevel,
          depth_score: DEFAULT_DEPTH_SCORE,
          next_question: reply,
          kb,
          stage: 'complete' as Stage,
          is_complete: true,
          is_fallback: true,
        })
      }

      const result = guidedModeHandler(message, kb)

      await supabase.from('knowledge_bases').upsert({
        project_id,
        json_content: result.updatedKB,
        updated_at: new Date().toISOString(),
      })

      const guardedQuestion = enforceQuestionRules(result.next_question)
      await supabase.from('messages').insert({ project_id, role: 'ai', content: guardedQuestion })

      return NextResponse.json({
        insight: result.insight,
        depth_level: result.depth_level,
        depth_score: result.depth_score,
        next_question: guardedQuestion,
        kb: result.updatedKB,
        stage: result.stage,
        is_complete: result.is_complete,
        is_fallback: true,
      })
    }

    // Apply AI extraction
    if (hasValidExtraction(aiResponse.extracted)) {
      updatedKB = applyExtraction(kb, aiResponse.extracted)
      depthScore = aiResponse.depth_score
      depthLevel = aiResponse.depth_level

      const depthInt = calculateDepth(updatedKB)
      const completionFloat = computeProgress(updatedKB)

      updatedKB = {
        ...updatedKB,
        metadata: {
          ...updatedKB.metadata,
          depth_score: depthInt,
          completion_score: completionFloat,
          stage: resolveStage(updatedKB),
        },
      }

      await supabase.from('knowledge_bases').upsert({
        project_id,
        json_content: updatedKB,
        updated_at: new Date().toISOString(),
      })
    } else {
      console.warn('[chat] Empty AI extraction; KB not updated')
    }

    const nextStage = resolveStage(updatedKB)
    const complete = isComplete(updatedKB)
    const guardedQuestion = enforceQuestionRules(aiResponse.next_question)

    await supabase.from('messages').insert({ project_id, role: 'ai', content: guardedQuestion })

    return NextResponse.json({
      insight: aiResponse.reasoning,
      depth_level: depthLevel,
      depth_score: depthScore,
      next_question: guardedQuestion,
      kb: updatedKB,
      stage: nextStage,
      is_complete: complete,
    })
  } catch (err) {
    console.error('[chat/route] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
