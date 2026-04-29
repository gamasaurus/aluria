import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createEmptyKB, createEmptyKBV2 } from '@/lib/ai/extract'
import { bootstrapKB, getBootstrapFirstQuestion } from '@/lib/ai/bootstrap'
import { calculateDepth, computeProgress, calculateDepthV2, computeProgressV2 } from '@/lib/ai/depth'
import { TEMPLATES } from '@/lib/templates'

export async function POST(request: NextRequest) {
  try {
    const { name, description, template_id } = await request.json()

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

    // Save KB
    await supabase.from('knowledge_bases').insert({
      project_id: project.id,
      json_content: kbWithScores,
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
