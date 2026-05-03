import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildCritiquePrompt, type CritiqueResult } from '@/lib/ai/prompt'
import type { KnowledgeBaseV2 } from '@/lib/types'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

async function callAI(prompt: string): Promise<string | null> {
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const res = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      })
      return res.choices[0]?.message?.content ?? null
    } catch { /* fall through */ }
  }
  const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 800, responseMimeType: 'application/json' },
      })
      return result.response.text() || null
    } catch { /* fall through */ }
  }
  return null
}

/**
 * POST /api/critique
 * Body: { project_id: string }
 * Returns a senior architect critique of the current KB.
 */
export async function POST(request: NextRequest) {
  try {
    const { project_id } = await request.json()
    if (!project_id) return NextResponse.json({ error: 'Missing project_id' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: project } = await supabase
      .from('projects').select('name').eq('id', project_id).eq('user_id', user.id).single()
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const { data: kbRow } = await supabase
      .from('knowledge_bases').select('json_content').eq('project_id', project_id).single()

    const kb = kbRow?.json_content as KnowledgeBaseV2
    if (!kb) return NextResponse.json({ error: 'No knowledge base found' }, { status: 404 })

    // Normalize to prevent crashes on partially-migrated KB objects
    const safeKB = {
      actors: kb?.actors ?? [],
      use_cases: { normal: kb?.use_cases?.normal ?? [], edge: kb?.use_cases?.edge ?? [] },
      data_model: { entities: kb?.data_model?.entities ?? [], relationships: kb?.data_model?.relationships ?? [] },
      process_flow: kb?.process_flow ?? [],
      functional_requirements: kb?.functional_requirements ?? [],
      business_rules: kb?.business_rules ?? [],
      business: kb?.business ?? { problem: '', objectives: [], success_metrics: [], stakeholders: [] },
      system_design: kb?.system_design ?? { architecture: { frontend: '', backend: '', database: '', ai_layer: '' }, api_endpoints: [] },
      ux: kb?.ux ?? { user_flow: [], screens: [] },
      completion: kb?.completion ?? { score: 0, depth: 0 },
    } as KnowledgeBaseV2

    const prompt = buildCritiquePrompt(safeKB, project.name)
    const raw = await callAI(prompt)

    if (!raw) {
      // Fallback: rule-based critique
      const fallback: CritiqueResult = {
        summary: 'AI critique unavailable. Basic analysis performed.',
        gaps: [
          ...(safeKB.actors.length < 2 ? ['Less than 2 actors defined'] : []),
          ...(safeKB.use_cases.edge.length === 0 ? ['No edge cases defined'] : []),
          ...(safeKB.data_model.entities.length === 0 ? ['No data model entities defined'] : []),
          ...(safeKB.process_flow.length < 3 ? ['Process flow has fewer than 3 steps'] : []),
        ],
        risks: [
          ...(safeKB.use_cases.edge.length === 0 ? ['No failure scenarios — system may not handle errors gracefully'] : []),
          ...(safeKB.business_rules.length === 0 ? ['No business rules — constraints are undefined'] : []),
        ],
        inconsistencies: [],
        improvements: ['Define at least 2 actors', 'Add at least 1 edge case', 'Define data model entities'],
        score: Math.min(
          40 + (safeKB.actors.length >= 2 ? 10 : 0) + (safeKB.use_cases.edge.length > 0 ? 10 : 0) +
          (safeKB.data_model.entities.length > 0 ? 10 : 0) + (safeKB.process_flow.length >= 3 ? 10 : 0) +
          (safeKB.business_rules.length > 0 ? 10 : 0) + (safeKB.functional_requirements.length >= 2 ? 10 : 0),
          100
        ),
      }
      return NextResponse.json({ critique: fallback })
    }

    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const critique: CritiqueResult = JSON.parse(cleaned)
    return NextResponse.json({ critique })

  } catch (err) {
    console.error('[critique/route] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
