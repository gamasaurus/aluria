import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createEmptyKB, createEmptyKBV2 } from '@/lib/ai/extract'
import { bootstrapKB, getBootstrapFirstQuestion } from '@/lib/ai/bootstrap'
import { calculateDepth, computeProgress, calculateDepthV2, computeProgressV2 } from '@/lib/ai/depth'
import { TEMPLATES } from '@/lib/templates'
import { buildProjectTypeDetectionPrompt, type ProjectType } from '@/lib/ai/prompt'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ─── Detect project type from description ────────────────────────────────────

async function detectProjectType(description: string): Promise<ProjectType> {
  const prompt = buildProjectTypeDetectionPrompt(description)

  // Try OpenAI first
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const res = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 100,
        response_format: { type: 'json_object' },
      })
      const raw = res.choices[0]?.message?.content ?? '{}'
      const parsed = JSON.parse(raw)
      if (parsed.project_type) return parsed.project_type as ProjectType
    } catch { /* fall through */ }
  }

  // Try Gemini
  const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
      const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 100, responseMimeType: 'application/json' } })
      const raw = result.response.text()
      const parsed = JSON.parse(raw)
      if (parsed.project_type) return parsed.project_type as ProjectType
    } catch { /* fall through */ }
  }

  // Default fallback
  return 'new_system'
}

export async function POST(request: NextRequest) {
  try {
    // Support both FormData (new onboarding with file upload) and JSON (legacy/templates)
    const contentType = request.headers.get('content-type') ?? ''
    let name = '', description = '', template_id = '', project_type = 'new_system', focus_clusters: string[] = []

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      name = (formData.get('name') as string) ?? ''
      description = (formData.get('description') as string) ?? ''
      project_type = (formData.get('project_type') as string) ?? 'new_system'
      const fc = formData.get('focus_clusters') as string
      try { focus_clusters = fc ? JSON.parse(fc) : [] } catch { focus_clusters = [] }
      // File upload — extract text content for bootstrapping (basic extraction)
      const file = formData.get('document') as File | null
      if (file && file.size > 0) {
        try {
          const text = await file.text()
          // Append first 2000 chars of document to description as context
          const excerpt = text.slice(0, 2000).replace(/\s+/g, ' ').trim()
          if (excerpt) description += `\n\nUploaded document context:\n${excerpt}`
        } catch { /* ignore file read errors */ }
      }
    } else {
      const body = await request.json()
      name = body.name ?? ''
      description = body.description ?? ''
      template_id = body.template_id ?? ''
      project_type = body.project_type ?? 'new_system'
    }

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const desc = (description || '').trim()

    // Create project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({ user_id: user.id, name: name.trim(), description: desc })
      .select()
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
    }

    // Check if a valid template was selected
    const template = template_id && TEMPLATES[template_id] ? TEMPLATES[template_id] : null

    if (template) {
      // Use template KB as the initial KnowledgeBaseV2
      const templateKB = {
        ...template.kb,
        completion: {
          ...template.kb.completion,
          prompt_version: 2,
        },
      }

      const depthScore = calculateDepthV2(templateKB)
      const completionScore = computeProgressV2(templateKB)

      await supabase.from('knowledge_bases').insert({
        project_id: project.id,
        json_content: templateKB,
        kb_version: 2,
        depth_score: depthScore,
        completion_score: completionScore,
      })

      const firstQuestion = 'Your project has been pre-loaded with a template. What would you like to customize or explore first?'

      await supabase.from('messages').insert({
        project_id: project.id,
        role: 'ai',
        content: firstQuestion,
      })

      return NextResponse.json({
        project,
        first_question: firstQuestion,
        kb: templateKB,
        bootstrapped: true,
      })
    }

    // No template — use existing bootstrap logic
    const bootstrappedKB = desc.length >= 10
      ? await bootstrapKB(desc)
      : createEmptyKB()

    // Use explicit project_type from onboarding form; fall back to AI detection only if not provided
    let resolvedProjectType: ProjectType = project_type as ProjectType
    if (!resolvedProjectType || resolvedProjectType === 'new_system') {
      if (desc.length >= 10) {
        try { resolvedProjectType = await detectProjectType(desc) } catch { /* use default */ }
      }
    }

    // Compute initial scores
    const depthScore = calculateDepth(bootstrappedKB)
    const completionScore = computeProgress(bootstrappedKB)

    const kbWithScores = {
      ...bootstrappedKB,
      metadata: {
        ...bootstrappedKB.metadata,
        depth_score: depthScore,
        completion_score: completionScore,
      },
    }

    // Save KB — store project_type and focus_clusters for V2 routing
    await supabase.from('knowledge_bases').insert({
      project_id: project.id,
      json_content: { ...kbWithScores, _project_type: resolvedProjectType, _focus_clusters: focus_clusters },
      depth_score: depthScore,
      completion_score: completionScore,
    })

    // Generate context-aware first question
    const firstQuestion = getBootstrapFirstQuestion(bootstrappedKB)

    await supabase.from('messages').insert({
      project_id: project.id,
      role: 'ai',
      content: firstQuestion,
    })

    return NextResponse.json({
      project,
      first_question: firstQuestion,
      kb: kbWithScores,
      bootstrapped: desc.length >= 10,
    })
  } catch (err) {
    console.error('[projects/route] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: projects } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    return NextResponse.json({ projects: projects ?? [] })
  } catch (err) {
    console.error('[projects/route] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
