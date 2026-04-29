/**
 * AI Bootstrap Engine
 * Analyzes a project description and generates an initial Knowledge Base.
 * This runs once when a project is created — so the AI never starts from zero.
 *
 * Priority: OpenAI → Gemini → rule-based fallback
 */

import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createEmptyKB } from '@/lib/ai/extract'
import type { KnowledgeBase, Actor } from '@/lib/types'

// ─── Bootstrap prompt ────────────────────────────────────────────────────────

const BOOTSTRAP_SYSTEM = `You are a Senior System Analyst. Given a project description, extract an initial structured knowledge base.

Output ONLY valid JSON matching this exact schema:
{
  "problem": "clear problem statement derived from description",
  "affected_who": ["stakeholder1", "stakeholder2"],
  "problem_why": ["business reason 1", "business reason 2"],
  "actors": [
    {"name": "Role Name", "role": "role description", "responsibility": "what they do"}
  ],
  "process_flow": ["step 1", "step 2", "step 3"],
  "decision_points": [],
  "edge_cases": [],
  "functional_requirements": ["feature 1", "feature 2"],
  "business_rules": []
}

Rules:
- Extract ONLY what is explicitly stated or strongly implied
- DO NOT hallucinate details not in the description
- Keep each item concise (max 15 words)
- Minimum: fill problem, affected_who, and actors if inferable
- If description is too vague, fill only problem`

// ─── AI callers ───────────────────────────────────────────────────────────────

async function callOpenAI(description: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  try {
    const openai = new OpenAI({ apiKey })
    const res = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: BOOTSTRAP_SYSTEM },
        { role: 'user', content: `Project description:\n${description}` },
      ],
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    })
    return res.choices[0]?.message?.content ?? null
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status
    if (status === 429 || status === 401) return null
    throw err
  }
}

async function callGemini(description: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (!apiKey) return null
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: BOOTSTRAP_SYSTEM,
    })
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `Project description:\n${description}` }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 800, responseMimeType: 'application/json' },
    })
    return result.response.text() || null
  } catch {
    return null
  }
}

// ─── Rule-based fallback ──────────────────────────────────────────────────────

const ROLE_KEYWORDS: Record<string, string> = {
  admin: 'Manages system configuration and user access',
  administrator: 'Manages system configuration and user access',
  user: 'Interacts with the system to complete tasks',
  customer: 'Uses the system to access services or products',
  manager: 'Oversees operations and approves actions',
  staff: 'Performs day-to-day operational tasks',
  employee: 'Performs day-to-day operational tasks',
  driver: 'Handles delivery or transportation tasks',
  vendor: 'Supplies products or services to the system',
  supplier: 'Provides goods or materials',
  operator: 'Operates and monitors system processes',
  cashier: 'Handles payment and transaction processing',
  owner: 'Has full control over the system',
}

function ruleBasedBootstrap(description: string): Partial<KnowledgeBase> {
  const lower = description.toLowerCase()
  const words = lower.split(/\s+/)

  // Extract problem — use the description itself
  const problem = description.trim().slice(0, 300)

  // Detect actors from keywords
  const actors: Actor[] = []
  const seen = new Set<string>()
  for (const [keyword, responsibility] of Object.entries(ROLE_KEYWORDS)) {
    if (lower.includes(keyword) && !seen.has(keyword)) {
      seen.add(keyword)
      actors.push({
        name: keyword.charAt(0).toUpperCase() + keyword.slice(1),
        role: keyword.charAt(0).toUpperCase() + keyword.slice(1),
        responsibility,
      })
    }
  }

  // Detect affected_who — look for "for X" or "by X" patterns
  const affectedMatch = description.match(/(?:for|used by|designed for)\s+([^.,]+)/i)
  const affected_who = affectedMatch ? [affectedMatch[1].trim()] : []

  // Detect functional hints — look for action verbs
  const actionVerbs = ['manage', 'track', 'monitor', 'process', 'generate', 'send', 'receive', 'approve', 'create', 'update', 'delete', 'view', 'report']
  const functional_requirements: string[] = []
  for (const verb of actionVerbs) {
    const regex = new RegExp(`${verb}\\s+([\\w\\s]+?)(?:[.,]|$)`, 'i')
    const match = description.match(regex)
    if (match && match[1].trim().length > 3) {
      const req = `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${match[1].trim()}`
      if (!functional_requirements.includes(req)) {
        functional_requirements.push(req)
      }
    }
    if (functional_requirements.length >= 4) break
  }

  return {
    problem,
    affected_who,
    problem_why: [],
    actors,
    process_flow: [],
    decision_points: [],
    edge_cases: [],
    functional_requirements,
    business_rules: [],
  }
}

// ─── Parse AI response ────────────────────────────────────────────────────────

function parseBootstrapResponse(raw: string): Partial<KnowledgeBase> | null {
  try {
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()
    const parsed = JSON.parse(cleaned)

    return {
      problem: typeof parsed.problem === 'string' ? parsed.problem.trim() : '',
      affected_who: Array.isArray(parsed.affected_who) ? parsed.affected_who.filter(Boolean) : [],
      problem_why: Array.isArray(parsed.problem_why) ? parsed.problem_why.filter(Boolean) : [],
      actors: Array.isArray(parsed.actors)
        ? parsed.actors
            .filter((a: unknown) => a && typeof a === 'object')
            .map((a: Record<string, string>) => ({
              name: String(a.name || '').trim(),
              role: String(a.role || '').trim(),
              responsibility: String(a.responsibility || '').trim(),
            }))
            .filter((a: Actor) => a.name)
        : [],
      process_flow: Array.isArray(parsed.process_flow) ? parsed.process_flow.filter(Boolean) : [],
      decision_points: Array.isArray(parsed.decision_points) ? parsed.decision_points.filter(Boolean) : [],
      edge_cases: Array.isArray(parsed.edge_cases) ? parsed.edge_cases.filter(Boolean) : [],
      functional_requirements: Array.isArray(parsed.functional_requirements)
        ? parsed.functional_requirements.filter(Boolean)
        : [],
      business_rules: Array.isArray(parsed.business_rules) ? parsed.business_rules.filter(Boolean) : [],
    }
  } catch {
    return null
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function bootstrapKB(description: string): Promise<KnowledgeBase> {
  const base = createEmptyKB()

  // Skip bootstrap if description is too short to be useful
  if (!description || description.trim().length < 10) {
    return base
  }

  let extracted: Partial<KnowledgeBase> | null = null

  // Try AI if enabled
  if (process.env.USE_AI !== 'false') {
    try {
      const raw = (await callOpenAI(description)) ?? (await callGemini(description))
      if (raw) extracted = parseBootstrapResponse(raw)
    } catch (err) {
      console.error('[bootstrap] AI failed:', err)
    }
  }

  // Fallback to rule-based
  if (!extracted || !extracted.problem) {
    console.log('[bootstrap] Using rule-based fallback')
    extracted = ruleBasedBootstrap(description)
  }

  // Merge into empty KB
  const kb: KnowledgeBase = {
    ...base,
    problem: extracted.problem || base.problem,
    affected_who: extracted.affected_who?.length ? extracted.affected_who : base.affected_who,
    problem_why: extracted.problem_why?.length ? extracted.problem_why : base.problem_why,
    actors: extracted.actors?.length ? extracted.actors : base.actors,
    process_flow: extracted.process_flow?.length ? extracted.process_flow : base.process_flow,
    decision_points: extracted.decision_points?.length ? extracted.decision_points : base.decision_points,
    edge_cases: extracted.edge_cases?.length ? extracted.edge_cases : base.edge_cases,
    functional_requirements: extracted.functional_requirements?.length
      ? extracted.functional_requirements
      : base.functional_requirements,
    business_rules: extracted.business_rules?.length ? extracted.business_rules : base.business_rules,
  }

  return kb
}

/**
 * Generate the first AI question based on bootstrapped KB.
 * Instead of always asking "What system are you building?",
 * ask about the weakest area of the bootstrapped KB.
 */
export function getBootstrapFirstQuestion(kb: KnowledgeBase): string {
  if (!kb.problem) return 'What system are you trying to build, and what problem does it solve?'
  if (kb.actors.length === 0) return `I understand you're building: "${kb.problem.slice(0, 60)}…". Who are the main roles that will use this system?`
  if (kb.process_flow.length === 0) return `I've identified ${kb.actors.length} actor(s). Walk me through the main workflow, step by step.`
  if (kb.functional_requirements.length === 0) return 'What are the core features this system must have in version 1?'
  return `Based on your description, I've pre-filled the knowledge base. What aspect should we refine first — actors, process flow, or requirements?`
}
