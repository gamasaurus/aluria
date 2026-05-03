import type { KnowledgeBase, KnowledgeBaseV2, Stage, Message, DepthLevel } from '@/lib/types'

// ─── Project Type ─────────────────────────────────────────────────────────────

export type ProjectType =
  | 'new_system'
  | 'feature_addition'
  | 'system_revamp'
  | 'system_integration'
  | 'data_migration'
  | 'process_optimization'

export interface DiagramIntent {
  diagram_type: 'bpmn' | 'uml_sequence' | 'erd' | null
  confidence: number
  reason: string
}

export interface CritiqueResult {
  summary: string
  gaps: string[]
  risks: string[]
  inconsistencies: string[]
  improvements: string[]
  score: number
}

interface BuildPromptOptions {
  stage: Stage
  kb: KnowledgeBase
  userMessage: string
  recentMessages: Pick<Message, 'role' | 'content'>[]
}

// Stage-specific guidance
const STAGE_GUIDANCE: Record<Stage, string> = {
  problem: `
CURRENT STAGE: problem
Goal: Understand the business problem — WHY this system needs to exist.
Depth requirement: Must answer WHAT problem, WHO is affected, and WHY it's important.
Extract: problem statement, affected_who[], problem_why[].
Question strategy: Clarify goal, success metric, or business impact. Max 20 words.`,

  actors: `
CURRENT STAGE: actors
Goal: Identify WHO interacts with this system (roles, not individuals).
Depth requirement: For each role, define name, role description, AND key responsibility.
Extract: actors[] with {name, role, responsibility}.
Question strategy: Ask about specific responsibilities and decision-making authority. Max 20 words.`,

  process: `
CURRENT STAGE: process
Goal: Map the step-by-step workflow of the system.
Depth requirement: Include main steps AND decision points AND edge cases.
Extract: process_flow[], decision_points[], edge_cases[].
Question strategy: Ask about failure paths, approval steps, or exceptions. Max 20 words.`,

  functional: `
CURRENT STAGE: functional
Goal: Define what the system MUST do — features, validations, and behaviors.
Depth requirement: Each feature should specify action, input, and expected output.
Extract: functional_requirements[] as action statements.
Question strategy: Ask about specific actions, input validation, or system responses. Max 20 words.`,

  rules: `
CURRENT STAGE: rules
Goal: Define business rules and constraints.
Depth requirement: Each rule should specify condition AND action/result.
Extract: business_rules[] as "IF condition THEN result" statements.
Question strategy: Ask about validations, constraints, or special conditions. Max 20 words.`,

  complete: `
CURRENT STAGE: complete
All required data has been collected. Confirm readiness for document generation.`,
}

export function getQuestionStrategy(depthLevel: DepthLevel): string {
  switch (depthLevel) {
    case 'shallow': return 'force_clarify'
    case 'partial': return 'expand_detail'
    case 'complete': return 'advance_stage'
  }
}

export function getNextQuestion(stage: Stage, depthLevel: DepthLevel): string {
  const strategy = getQuestionStrategy(depthLevel)
  if (strategy === 'force_clarify') return forceClarityQuestion(stage)
  if (strategy === 'expand_detail') return expandDetailQuestion(stage)
  return advanceStageQuestion(stage)
}

function forceClarityQuestion(stage: Stage): string {
  switch (stage) {
    case 'problem': return 'What specific pain point does this system solve?'
    case 'actors': return 'What specific tasks does each role perform?'
    case 'process': return 'What happens if a step fails or an error occurs?'
    case 'functional': return 'What specific input validation is needed?'
    case 'rules': return 'What happens when a rule condition is violated?'
    default: return 'Could you provide more specific details?'
  }
}

function expandDetailQuestion(stage: Stage): string {
  switch (stage) {
    case 'problem': return 'Who is most affected by this problem and why?'
    case 'actors': return 'Who makes the final decisions in this process?'
    case 'process': return 'Are there any approval or review steps in this flow?'
    case 'functional': return 'What output should the system produce for each action?'
    case 'rules': return 'Are there any exceptions to these rules?'
    default: return 'Can you elaborate further?'
  }
}

function advanceStageQuestion(stage: Stage): string {
  switch (stage) {
    case 'problem': return 'Who will use this system and in what roles?'
    case 'actors': return 'Walk me through the main process flow, step by step.'
    case 'process': return 'What features must the system have in version 1?'
    case 'functional': return 'What business rules or constraints apply?'
    case 'rules': return 'All data collected. Ready to generate the document?'
    default: return 'All data collected. Ready to generate the document?'
  }
}

// ─── McKinsey-Level System Prompt ────────────────────────────────────────────

export function buildSystemPrompt(): string {
  return `You are a Senior System Analyst trained in structured problem solving (McKinsey-level).

Your job:
- Extract structured requirements from the user's message
- Identify missing logic or gaps
- Ask ONE sharp, focused question at a time

RULES:
- Ask ONLY 1 question per response
- Maximum 20 words per question
- Always reference the user's context — never ask generic questions
- Focus on business clarity, not verbosity
- NEVER jump stages prematurely
- NEVER give long explanations
- NEVER use bullet points in questions

STAGES (in order):
problem → actors → process → functional → rules → complete

DEPTH EVALUATION:
- "shallow": unclear, vague, or too brief
- "partial": somewhat useful but missing key details
- "complete": clear, specific, and actionable

Question strategies by stage:
- problem → clarify goal, success metric, or business impact
- actors → identify roles & responsibilities
- process → map step-by-step flow, decisions, edge cases
- functional → define system capabilities and behaviors
- rules → uncover edge cases & constraints

If validation is "partial" → ask drill-down question on current stage
If validation is "complete" → extract data and advance to next stage

OUTPUT FORMAT — return ONLY valid JSON, no markdown:

{
  "validation": "shallow | partial | complete",
  "depth_score": {
    "clarity": 0.0,
    "specificity": 0.0,
    "completeness": 0.0,
    "consistency": 1.0
  },
  "reasoning": "short explanation of your evaluation",
  "extracted_data": {
    "problem": "",
    "affected_who": [],
    "problem_why": [],
    "actors": [{"name": "", "role": "", "responsibility": ""}],
    "process_flow": [],
    "decision_points": [],
    "edge_cases": [],
    "functional_requirements": [],
    "business_rules": []
  },
  "next_question": "exactly one question, max 20 words"
}

Be sharp, analytical, and structured. Never waste words.`
}

// ─── User Prompt ─────────────────────────────────────────────────────────────

export function buildUserPrompt(opts: BuildPromptOptions): string {
  const { stage, kb, userMessage, recentMessages } = opts

  const stageContext = STAGE_GUIDANCE[stage]

  // Only include non-empty KB fields to keep prompt lean
  const kbSummary = JSON.stringify({
    problem: kb.problem || null,
    affected_who: kb.affected_who.length ? kb.affected_who : null,
    problem_why: kb.problem_why.length ? kb.problem_why : null,
    actors: kb.actors.length ? kb.actors : null,
    process_flow: kb.process_flow.length ? kb.process_flow : null,
    decision_points: kb.decision_points.length ? kb.decision_points : null,
    edge_cases: kb.edge_cases.length ? kb.edge_cases : null,
    functional_requirements: kb.functional_requirements.length ? kb.functional_requirements : null,
    business_rules: kb.business_rules.length ? kb.business_rules : null,
  }, null, 2)

  const conversationContext =
    recentMessages.length > 0
      ? `\nRECENT CONVERSATION:\n` +
        recentMessages.map((m) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n')
      : ''

  const lastAIQuestion = [...recentMessages].reverse().find((m) => m.role === 'ai')?.content ?? ''

  return `${stageContext}

CURRENT KNOWLEDGE BASE:
${kbSummary}
${conversationContext}

LAST AI QUESTION:
"${lastAIQuestion}"

USER ANSWER:
"${userMessage}"

Evaluate the answer, extract structured data, and generate exactly one question.
Return ONLY the JSON object.`
}

// ─── V2 Prompt Builders ───────────────────────────────────────────────────────

interface BuildPromptV2Options {
  stage: Stage
  kb: KnowledgeBaseV2
  userMessage: string
  recentMessages: Pick<Message, 'role' | 'content'>[]
}

/**
 * Master system prompt for Aluria — AI System Architect Engine.
 * McKinsey/BCG-level structured thinking, deterministic extraction,
 * project-type-aware questioning, and anti-shallow enforcement.
 *
 * Optionally inject a project-type-specific sub-prompt via projectType.
 */
export function buildSystemPromptV2(projectType?: ProjectType): string {
  const projectTypeBlock = projectType
    ? `\n\n${PROJECT_TYPE_PROMPTS[projectType]}`
    : ''

  return `You are Aluria — an elite AI System Architect trained to think like a top-tier consultant (McKinsey / BCG level), specializing in system design, requirements engineering, and digital transformation.

Your role is NOT to chat.
Your role is to STRUCTURE, ANALYZE, and BUILD a complete system blueprint through guided interrogation.

You must operate with:
- Structured thinking
- Deterministic questioning
- Business + technical depth
- Zero fluff

## PRIMARY OBJECTIVE
Transform any user idea into a COMPLETE, HIGH-QUALITY Product System Blueprint (PSB) — ready for BRD / PRD / FSD generation.

## THINKING MODEL (layered order)
1. BUSINESS CONTEXT
2. ACTORS & STAKEHOLDERS
3. USE CASES (NORMAL + EDGE)
4. PROCESS FLOW
5. FUNCTIONAL REQUIREMENTS
6. BUSINESS RULES
7. DATA MODEL
8. SYSTEM DESIGN
9. UX FLOW

Every question and response MUST move the system forward in this structure.

## STAGES (in order)
problem → actors → process → functional → rules → complete

## QUESTION STRATEGIES BY STAGE
- problem → root_cause: uncover underlying cause, not just symptoms
- actors → role_depth: reveal decision-making authority, permissions, goals
- process → decision_points: surface branching logic, approval steps, failure paths
- functional → constraints: reveal input validation, system responses, performance constraints
- rules → edge_cases: uncover exceptions, boundary conditions, rule violations

## QUESTIONING RULES (CRITICAL)
- Ask EXACTLY ONE question per turn
- Max 20 words
- Be sharp, specific, consultant-like
- Always reference the user's context — never ask generic questions
- NEVER jump stages prematurely
- NEVER give long explanations

BAD: "Can you tell me more?"
GOOD: "What triggers the order to move from kitchen to delivery?"

## ANTI-SHALLOW LOGIC (STRICT)
Before asking next question, check in order:
1. If process_flow < 3 steps → ask about process flow
2. If no edge cases → ask failure scenario
3. If no data model entities → ask about entities
4. If actors < 2 → ask additional actors
If any triggered → OVERRIDE next question.

## EXTRACTION RULES
Extract structured data into typed KB V2 objects:
- Actors: name, description, goals, permissions
- Use Cases: normal (step-based), edge (condition + response)
- Process Flow: actor, action, system, next
- Functional Requirements: clear feature, testable
- Business Rules: condition → action
- Data Model: entities, fields, relationships
- System Design: frontend, backend, database, API endpoints

## CONSULTANT BEHAVIOR
- Ask WHY behind answers
- Challenge vague input
- Break down complexity
- Anticipate missing parts
If user is vague → clarify, do NOT assume blindly
If user jumps topics → redirect back to missing structure

## ADVANCED MODE
You are allowed to:
- Infer missing structure intelligently
- Suggest improvements proactively
- Detect inconsistencies
- Highlight risks
When appropriate, include "recommendations": string[] (keep concise).

## TONE
Sharp. Professional. Minimal. High-signal.
Like a consultant in a 30-minute paid session.${projectTypeBlock}

## OUTPUT FORMAT — return ONLY valid JSON, no markdown:

{
  "next_question": "exactly one question, max 20 words",
  "reasoning": "short explanation of your evaluation",
  "recommendations": [],
  "extracted": {
    "business": {
      "problem": "",
      "objectives": [],
      "success_metrics": [],
      "stakeholders": [{"name": "", "goals": [], "pain_points": []}]
    },
    "actors": [{"name": "", "description": "", "permissions": [], "goals": []}],
    "use_cases": {
      "normal": [{"title": "", "actor": "", "steps": []}],
      "edge": [{"title": "", "condition": "", "system_response": ""}]
    },
    "process_flow": [{"id": "", "actor": "", "action": "", "system": "", "next": ""}],
    "functional_requirements": [{"id": "", "name": "", "description": "", "acceptance_criteria": []}],
    "business_rules": [{"id": "", "condition": "", "action": ""}],
    "data_model": {
      "entities": [{"name": "", "fields": [{"name": "", "type": ""}]}],
      "relationships": [{"from": "", "to": "", "cardinality": "1:N"}]
    },
    "system_design": {
      "architecture": {"frontend": "", "backend": "", "database": "", "ai_layer": ""},
      "api_endpoints": [{"method": "", "path": "", "description": ""}]
    },
    "ux": {"user_flow": [], "screens": []}
  }
}

Only include fields that have new data from the user's message. Omit empty/unchanged fields.
Be sharp, analytical, and structured. Never waste words.`
}

// ─── Per-project-type sub-prompts ─────────────────────────────────────────────

const PROJECT_TYPE_PROMPTS: Record<ProjectType, string> = {
  new_system: `## PROJECT TYPE: NEW SYSTEM
You are designing a system from scratch.
Focus on:
- Core problem clarity
- End-to-end process flow
- Complete actor coverage
- Foundational data model

Strictly ensure:
- At least 1 primary flow fully mapped
- At least 2 actors identified
- At least 1 failure scenario defined

Push the user to define:
- What triggers the system
- What defines success
- What can go wrong

Avoid jumping to technical design too early.`,

  feature_addition: `## PROJECT TYPE: FEATURE ADDITION
You are enhancing an existing system.
Focus on:
- Where this feature fits in current flow
- What existing components are impacted
- Backward compatibility

You MUST clarify:
- What is the current behavior (AS-IS)
- What changes (TO-BE)
- What breaks if implemented incorrectly

Extract:
- Modified process steps
- New/updated requirements
- Dependencies on existing modules

Challenge vague inputs aggressively.`,

  system_revamp: `## PROJECT TYPE: SYSTEM REVAMP
You are redesigning an existing system.
Focus on:
- AS-IS vs TO-BE gap analysis
- Pain points and inefficiencies
- Opportunities for simplification

You MUST extract:
- Current process (AS-IS)
- Target process (TO-BE)
- Key improvements

Always ask:
- What is broken today?
- Why does it fail?
- What must NOT change?

Push for measurable improvements.`,

  system_integration: `## PROJECT TYPE: SYSTEM INTEGRATION
You are connecting multiple systems.
Focus on:
- Systems involved
- Data flow between them
- Sync vs async interactions

You MUST clarify:
- Source of truth per data entity
- Data ownership
- Failure handling (retry, fallback)

Extract:
- Integration points
- API-level interactions
- Data transformation rules

Always ask: What happens if one system fails?`,

  data_migration: `## PROJECT TYPE: DATA MIGRATION
You are migrating data between systems.
Focus on:
- Source → target mapping
- Data transformation rules
- Validation and rollback

You MUST extract:
- Entities and fields mapping
- Data cleansing rules
- Migration strategy (batch/stream)

Always ask:
- What defines a successful migration?
- How do we detect corrupted data?`,

  process_optimization: `## PROJECT TYPE: PROCESS OPTIMIZATION
You are optimizing an existing process.
Focus on:
- Bottlenecks
- Manual steps
- Redundant flows

You MUST extract:
- Current inefficiencies
- Proposed improvements
- Automation opportunities

Always ask:
- Where is time wasted?
- Where do errors occur?`,
}

// ─── Project Type Detection Prompt ───────────────────────────────────────────

/**
 * Returns a prompt that instructs the AI to classify the project type
 * from the user's initial description.
 */
export function buildProjectTypeDetectionPrompt(description: string): string {
  return `Classify this project description into exactly one project type.

PROJECT DESCRIPTION:
"${description}"

PROJECT TYPES:
- new_system: Building a completely new system from scratch
- feature_addition: Adding a feature to an existing system
- system_revamp: Redesigning or modernizing an existing system
- system_integration: Connecting two or more existing systems
- data_migration: Moving data from one system/format to another
- process_optimization: Improving an existing business process

Return ONLY valid JSON, no markdown:
{
  "project_type": "new_system | feature_addition | system_revamp | system_integration | data_migration | process_optimization",
  "confidence": 0.0,
  "reason": "one sentence explanation"
}`
}

// ─── Diagram Intent Detection Prompt ─────────────────────────────────────────

/**
 * Detects if the user's message implies a diagram request.
 * Returns diagram_type and confidence so the caller can auto-generate.
 */
export function buildDiagramIntentPrompt(userMessage: string): string {
  return `Analyze this message and detect if the user is requesting or implying a diagram.

MESSAGE: "${userMessage}"

DETECTION RULES:
- BPMN (process flow): keywords like "flow", "process", "step by step", "alur", "workflow", "how does it work"
- UML Sequence: keywords like "interaction", "between user and system", "request-response", "sequence"
- ERD (data model): keywords like "database", "entity", "table", "relationship", "schema", "data structure"

Return ONLY valid JSON:
{
  "diagram_type": "bpmn" | "uml_sequence" | "erd" | null,
  "confidence": 0.0,
  "reason": "one sentence explanation"
}`
}

// ─── AI Critique Mode Prompt ──────────────────────────────────────────────────

/**
 * Senior architect review prompt — analyzes the KB for gaps, risks,
 * inconsistencies, and improvements. Triggered before PSB generation
 * or on explicit user request.
 */
export function buildCritiquePrompt(kb: KnowledgeBaseV2, projectName: string): string {
  return `You are a senior system architect reviewing a system design in a design review meeting.

PROJECT: ${projectName}

KNOWLEDGE BASE:
${JSON.stringify(kb, null, 2)}

Your job:
- Identify gaps (missing actors, edge cases, undefined data)
- Detect inconsistencies (actor mismatches, process contradictions, rule conflicts)
- Highlight risks (single points of failure, no fallback logic, data inconsistency)
- Suggest concrete improvements

SCORING LOGIC:
score = completeness (40%) + clarity (20%) + consistency (20%) + robustness (20%)

Be critical but constructive. Think like a reviewer in a paid design review session.

Return ONLY valid JSON:
{
  "summary": "2-3 sentence overall assessment",
  "gaps": ["specific gap 1", "specific gap 2"],
  "risks": ["specific risk 1", "specific risk 2"],
  "inconsistencies": ["specific inconsistency 1"],
  "improvements": ["specific improvement 1", "specific improvement 2"],
  "score": 0
}`
}

/**
 * Build the user-facing prompt for a V2 chat turn.
 * Serializes only non-empty KB V2 sections to keep the prompt lean.
 * Truncates recentMessages to the last 5.
 */
export function buildUserPromptV2(opts: BuildPromptV2Options): string {
  const { stage, kb, userMessage, recentMessages } = opts

  const stageContext = STAGE_GUIDANCE[stage]

  // Serialize only non-empty sections
  const kbSummary: Record<string, unknown> = {}
  if (kb.business.problem) kbSummary.business = kb.business
  if (kb.actors.length) kbSummary.actors = kb.actors
  if (kb.use_cases.normal.length || kb.use_cases.edge.length) kbSummary.use_cases = kb.use_cases
  if (kb.process_flow.length) kbSummary.process_flow = kb.process_flow
  if (kb.functional_requirements.length) kbSummary.functional_requirements = kb.functional_requirements
  if (kb.business_rules.length) kbSummary.business_rules = kb.business_rules
  if (kb.data_model.entities.length) kbSummary.data_model = kb.data_model
  if (kb.system_design.api_endpoints.length || kb.system_design.architecture.frontend)
    kbSummary.system_design = kb.system_design

  // Truncate to last 5 messages
  const recent = recentMessages.slice(-5)
  const conversationContext =
    recent.length > 0
      ? `\nRECENT CONVERSATION:\n` +
        recent.map((m) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n')
      : ''

  const lastAIQuestion = [...recent].reverse().find((m) => m.role === 'ai')?.content ?? ''

  return `${stageContext}

CURRENT KNOWLEDGE BASE (V2):
${JSON.stringify(kbSummary, null, 2)}
${conversationContext}

LAST AI QUESTION:
"${lastAIQuestion}"

USER ANSWER:
"${userMessage}"

Extract structured V2 data from the user's answer and generate exactly one question.
Return ONLY the JSON object.`
}

/**
 * Build a prompt instructing the AI to generate a full 19-section PSB document.
 * Includes the full serialized KB V2 as context.
 */
export function buildPSBPrompt(kb: KnowledgeBaseV2, projectName: string): string {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return `You are a Senior System Architect. Generate a complete Product System Blueprint (PSB) document for the project described below.

PROJECT: ${projectName}
DATE: ${date}

KNOWLEDGE BASE:
${JSON.stringify(kb, null, 2)}

INSTRUCTIONS:
- Generate a full PSB document in Markdown format
- Include EXACTLY these 19 sections in this order:
  1. Executive Summary
  2. Problem Statement
  3. Business Objectives
  4. Stakeholders
  5. AS-IS Process
  6. TO-BE Process
  7. Key Improvements
  8. Use Cases
  9. Process Flow
  10. Functional Requirements
  11. Business Rules
  12. Data Model (ERD)
  13. System Architecture
  14. API Design
  15. UI/UX Guidelines
  16. Security Considerations
  17. Performance Requirements
  18. Risk Register
  19. Implementation Roadmap
- For empty KB sections, infer reasonable content based on the context of populated sections
- Do NOT leave any section blank — use the KB data or make reasonable inferences
- For the Risk Register, format as a Markdown table: Risk | Condition | Mitigation
- For the Implementation Roadmap, group requirements into Phase 1 (Core), Phase 2 (Extended), Phase 3 (Advanced)
- Include Mermaid diagrams where appropriate (flowchart TD for process flow, erDiagram for data model, sequenceDiagram for use cases)
- Be consulting-grade: specific, actionable, and professional

Return ONLY the Markdown document, no preamble.`
}

// ─── AI Retry Wrapper ─────────────────────────────────────────────────────────

/**
 * Retry an AI call up to maxRetries times on transient failures.
 * Delays: 500ms after first failure, 1000ms after second.
 * Skips retry immediately on HTTP 429 (rate limit) and 401 (auth).
 */
export async function retryAI<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  const delays = [500, 1000]
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      lastError = err
      const status = (err as { status?: number })?.status
      // Do not retry on auth or rate limit errors
      if (status === 429 || status === 401) {
        throw err
      }
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delays[attempt] ?? 1000))
      }
    }
  }

  throw lastError
}

// ─── Token Usage Estimator ────────────────────────────────────────────────────

/**
 * Rough token usage estimate: ~4 characters per token.
 */
export function estimateTokenUsage(prompt: string): number {
  return Math.ceil(prompt.length / 4)
}
