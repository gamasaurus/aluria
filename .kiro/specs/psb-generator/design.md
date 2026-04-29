# Design Document: PSB Generator

## Overview

Aluria is being upgraded from an MVP chatbot into a production-grade **AI System Architect Platform**. The PSB Generator feature transforms the existing flat Knowledge Base (KB V1) into a hierarchical KB V2 schema, adds a consulting-grade AI Orchestration Engine, introduces weighted Depth Scoring V2, auto-generates BPMN/UML/ERD diagrams, replaces the simple Knowledge Panel with an Interactive System Builder UI, and produces a unified 19-section **Product System Blueprint (PSB)** document.

The upgrade is fully backward-compatible: existing KB V1 projects continue to work without modification. All new logic is additive — new types, new functions, new components — with version-gating at the API and UI layers to route V1 and V2 data through their respective pipelines.

### Key Design Decisions

1. **Additive-only changes**: No existing types, functions, or components are modified or removed. New V2 variants are added alongside V1 equivalents.
2. **Version-gated routing**: The `kb_version` column in Supabase determines which pipeline (V1 or V2) handles each project. This is checked at the API layer and propagated to the UI.
3. **Pure functions for all KB transformations**: `calculateDepthV2`, `generatePSB`, `generateBPMNFromV2`, `generateUMLSequence`, `generateERD`, and `migrateKBV1toV2` are all pure functions with no side effects, enabling deterministic testing.
4. **No new npm dependencies**: All diagram generation uses the existing Mermaid integration. No new packages are introduced.
5. **Inline styles throughout**: All new React components use inline style objects, consistent with the existing codebase. No Tailwind classes in components or pages.
6. **Anti-Shallow Guard as a shared module**: The guard logic lives in `src/lib/ai/guard.ts` (extended) and is called identically from both AI mode and Guided Mode, ensuring behavioral parity.

---

## Architecture

The upgrade follows the existing layered architecture of the application:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js App Router                        │
│                                                                   │
│  /app/project/[id]  →  ChatPageClient (V1) or                   │
│                         ChatPageClient with SystemBuilderPanel   │
│                         (V2, based on kb_version)                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
              ┌─────────────▼──────────────┐
              │       API Routes            │
              │  /api/chat  (V1 + V2)       │
              │  /api/brd   (V1 → USD,      │
              │              V2 → PSB)      │
              │  /api/pdf   (unchanged)     │
              └─────────────┬──────────────┘
                            │
        ┌───────────────────▼───────────────────────┐
        │              AI Library (src/lib/ai/)       │
        │                                             │
        │  types.ts      — KnowledgeBaseV2, types    │
        │  depth.ts      — calculateDepthV2,          │
        │                  getDepthBreakdown          │
        │  extract.ts    — migrateKBV1toV2,           │
        │                  createEmptyKBV2,           │
        │                  applyExtractionV2          │
        │  prompt.ts     — buildSystemPromptV2,       │
        │                  buildPSBPrompt             │
        │  bpmn.ts       — generateBPMNFromV2,        │
        │                  generateUMLSequence,       │
        │                  generateERD,               │
        │                  generatePSB                │
        │  guided.ts     — guidedModeHandlerV2        │
        │  guard.ts      — checkAntiShallowGuard      │
        └───────────────────┬───────────────────────┘
                            │
        ┌───────────────────▼───────────────────────┐
        │              Supabase                       │
        │  knowledge_bases.kb_version (new)           │
        │  knowledge_bases.depth_score (updated)      │
        │  knowledge_bases.completion_score (updated) │
        │  projects.description (from migration 001)  │
        └────────────────────────────────────────────┘
```

### Data Flow: Chat Turn (V2)

```
User message
    │
    ▼
POST /api/chat
    │
    ├─ Load KB from Supabase (with kb_version)
    │
    ├─ if kb_version = 1 → existing V1 pipeline (unchanged)
    │
    └─ if kb_version = 2:
           │
           ├─ checkAntiShallowGuard(kb) → guard_triggered?
           │
           ├─ USE_AI=true:
           │      buildSystemPromptV2() + buildUserPromptV2()
           │      → callAI() → parseAIResponseV2()
           │      → applyExtractionV2(kb, extracted)
           │
           ├─ USE_AI=false:
           │      guidedModeHandlerV2(message, kb)
           │
           ├─ calculateDepthV2(updatedKB) → depth_score
           ├─ computeProgressV2(updatedKB) → completion_score
           │
           ├─ Supabase upsert (json_content, kb_version=2,
           │                   depth_score, completion_score)
           │
           └─ Return ChatResponse with kb_version, guard_triggered,
                      depth_breakdown
```

### Data Flow: Document Generation (V2)

```
GET /api/brd?project_id=X
    │
    ├─ Load KB + kb_version from Supabase
    │
    ├─ if kb_version = 1 → generateUSD(kb, name) (unchanged)
    │
    └─ if kb_version = 2:
           │
           ├─ mode=psb (query param):
           │      buildPSBPrompt(kb, name) → callAI() → return AI PSB
           │
           └─ default:
                  generatePSB(kb, name) → return deterministic PSB
```

---

## Components and Interfaces

### 1. `src/lib/types.ts` — New Types

#### `KnowledgeBaseV2`

The hierarchical KB schema. All sections are typed objects rather than flat string arrays.

```typescript
// Actor V2 — richer than V1 Actor
interface ActorV2 {
  name: string
  description: string
  permissions: string[]
  goals: string[]
}

// Use case types
interface NormalUseCase {
  title: string
  actor: string
  steps: string[]
}

interface EdgeUseCase {
  title: string
  condition: string
  system_response: string
}

// Process flow step — structured, not a plain string
interface ProcessFlowStep {
  id: string
  actor: string
  action: string
  system: string
  next: string   // id of next step, or '' for terminal
}

// Functional requirement with acceptance criteria
interface FunctionalRequirement {
  id: string
  name: string
  description: string
  acceptance_criteria: string[]
}

// Business rule — condition → action
interface BusinessRule {
  id: string
  condition: string
  action: string
}

// Data model
interface EntityField {
  name: string
  type: string
}

interface Entity {
  name: string
  fields: EntityField[]
}

type Cardinality = '1:1' | '1:N' | 'N:N'

interface Relationship {
  from: string
  to: string
  cardinality: Cardinality
}

// System design
interface SystemArchitecture {
  frontend: string
  backend: string
  database: string
  ai_layer: string
}

interface APIEndpoint {
  method: string
  path: string
  description: string
}

// KB V2 top-level
interface KnowledgeBaseV2 {
  business: {
    problem: string
    objectives: string[]
    success_metrics: string[]
    stakeholders: Array<{ name: string; goals: string[]; pain_points: string[] }>
  }
  actors: ActorV2[]
  use_cases: {
    normal: NormalUseCase[]
    edge: EdgeUseCase[]
  }
  process_flow: ProcessFlowStep[]
  functional_requirements: FunctionalRequirement[]
  business_rules: BusinessRule[]
  data_model: {
    entities: Entity[]
    relationships: Relationship[]
  }
  system_design: {
    architecture: SystemArchitecture
    api_endpoints: APIEndpoint[]
  }
  ux: {
    user_flow: string[]
    screens: string[]
  }
  completion: {
    score: number   // 0-100
    depth: number   // 0-100
  }
}
```

#### `DepthBreakdown`

Returned by `getDepthBreakdown()`:

```typescript
interface DepthBreakdownSection {
  score: number
  max: number
  items: number
}

interface DepthBreakdown {
  use_cases_normal: DepthBreakdownSection
  use_cases_edge: DepthBreakdownSection
  process_flow: DepthBreakdownSection
  data_model: DepthBreakdownSection
  functional_requirements: DepthBreakdownSection
  total: number
}
```

#### Extended `ChatResponse`

```typescript
interface ChatResponse {
  // existing fields (unchanged)
  insight: string
  depth_level: DepthLevel
  depth_score: DepthScore
  next_question: string
  kb: KnowledgeBase
  stage: Stage
  is_complete: boolean
  is_clarify?: boolean
  is_fallback?: boolean
  // new V2 fields
  kb_version?: 1 | 2
  guard_triggered?: boolean
  depth_breakdown?: DepthBreakdown
}
```

#### `AntiShallowGuardResult`

```typescript
interface AntiShallowGuardResult {
  blocked: boolean
  reason?: string
  forced_question?: string
}
```

---

### 2. `src/lib/ai/depth.ts` — New Functions

#### `calculateDepthV2(kb: KnowledgeBaseV2): number`

Pure function. Applies the weighted formula:

```
score = (use_cases.normal.length × 5)
      + (use_cases.edge.length × 8)
      + (process_flow.length × 3)
      + (data_model.entities.length × 6)
      + (functional_requirements.length × 4)

return Math.min(score, 100)
```

#### `getDepthBreakdown(kb: KnowledgeBaseV2): DepthBreakdown`

Pure function. Returns per-section scores with their maximums and item counts. The `total` field equals `calculateDepthV2(kb)`.

#### `getDepthStatus(score: number): 'Shallow' | 'Moderate' | 'Ready'`

Pure function. Returns `'Shallow'` if score < 30, `'Moderate'` if 30 ≤ score ≤ 69, `'Ready'` if score ≥ 70.

#### `computeProgressV2(kb: KnowledgeBaseV2): number`

Pure function returning a 0–1 float. Weights: business=0.15, actors=0.15, use_cases=0.2, process_flow=0.2, functional_requirements=0.15, data_model=0.15.

---

### 3. `src/lib/ai/guard.ts` — Extended

#### `checkAntiShallowGuard(kb: KnowledgeBaseV2, currentStage: Stage): AntiShallowGuardResult`

Pure function. Checks all four guard conditions in order:

1. `process_flow.length < 3` → blocked, forced question about process steps
2. `use_cases.edge.length === 0` (when advancing from process) → blocked, forced edge-case question
3. `data_model.entities.length === 0` (when functional stage otherwise complete) → blocked, forced data model question
4. `actors.length < 2` (when actors stage otherwise complete) → blocked, forced actor question

Returns `{ blocked: false }` if none apply.

The existing `enforceQuestionRules()` function is preserved unchanged.

---

### 4. `src/lib/ai/extract.ts` — New Functions

#### `createEmptyKBV2(): KnowledgeBaseV2`

Factory function returning a fully initialized KB V2 with all arrays empty and all strings empty.

#### `migrateKBV1toV2(kb: KnowledgeBase): KnowledgeBaseV2`

Pure function. Maps flat V1 fields to V2 equivalents:

| V1 field | V2 field | Mapping rule |
|---|---|---|
| `problem` | `business.problem` | Direct copy |
| `affected_who` | `business.stakeholders` | Each string → `{name: s, goals: [], pain_points: []}` |
| `problem_why` | `business.objectives` | Direct copy |
| `actors[].name` | `actors[].name` | Direct copy |
| `actors[].role` | `actors[].description` | Direct copy |
| `actors[].responsibility` | `actors[].goals[0]` | Wrap in array |
| `process_flow[]` (string) | `process_flow[]` (object) | `{id: 'step-N', actor: '', action: s, system: '', next: ''}` |
| `functional_requirements[]` (string) | `functional_requirements[]` (object) | `{id: 'fr-N', name: s.slice(0,40), description: s, acceptance_criteria: []}` |
| `business_rules[]` (string) | `business_rules[]` (object) | Split on 'THEN' (case-insensitive): `{id: 'br-N', condition: before, action: after}` |
| `edge_cases[]` | `use_cases.edge[]` | `{title: s, condition: s, system_response: ''}` |
| `decision_points[]` | Discarded (no direct V2 equivalent; absorbed into process_flow steps) | — |

#### `applyExtractionV2(kb: KnowledgeBaseV2, extracted: Partial<KnowledgeBaseV2>): KnowledgeBaseV2`

Pure function. Merges extracted V2 data into the existing KB V2, deduplicating by id or name where applicable.

---

### 5. `src/lib/ai/prompt.ts` — New Functions

#### `buildSystemPromptV2(): string`

Returns a consulting-grade system prompt instructing the AI to:
- Extract structured KB V2 data (typed objects, not flat strings)
- Apply the 5 question strategies based on current stage
- Return valid JSON matching the V2 extraction schema
- Ask exactly one question per turn, max 20 words

#### `buildUserPromptV2(opts): string`

Accepts `{ stage, kb: KnowledgeBaseV2, userMessage, recentMessages }`. Serializes only non-empty KB V2 sections to keep the prompt lean.

#### `buildPSBPrompt(kb: KnowledgeBaseV2, projectName: string): string`

Constructs a prompt instructing the AI to generate a full 19-section PSB document from the KB. Includes the full serialized KB V2 as context. Instructs the AI to infer reasonable content for empty sections based on populated sections.

---

### 6. `src/lib/ai/bpmn.ts` — New Functions

All existing functions (`generateBPMNXml`, `generateMermaid`, `generateUSD`) are preserved unchanged.

#### `generateBPMNFromV2(kb: KnowledgeBaseV2): string`

Pure function. Produces a text-based BPMN-style flow:

```
▶ Start → [Actor: action] → [decision?] → … → ■ End
```

Also produces a Mermaid `flowchart TD` block. Decision points are inferred from `business_rules` entries containing conditional keywords (IF/WHEN/UNLESS). Returns empty string if `process_flow` is empty.

#### `generateUMLSequence(kb: KnowledgeBaseV2): string`

Pure function. Produces a Mermaid `sequenceDiagram` from `use_cases.normal`. Each use case step renders as `Actor->>System: action`. Returns empty string if `use_cases.normal` is empty.

#### `generateERD(kb: KnowledgeBaseV2): string`

Pure function. Produces a Mermaid `erDiagram` from `data_model.entities` and `data_model.relationships`. Cardinality mapping: `1:1` → `||--||`, `1:N` → `||--o{`, `N:N` → `}o--o{`. Returns empty string if `data_model.entities` is empty.

#### `generatePSB(kb: KnowledgeBaseV2, projectName: string): string`

Pure function. Returns a Markdown string with exactly 19 sections in this order:

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

Empty sections render `*(Not yet defined)*`. The Risk Register is populated from `business_rules` entries containing conditional logic, formatted as a Markdown table with columns: Risk, Condition, Mitigation. The Implementation Roadmap groups `functional_requirements` into Phase 1 (first third), Phase 2 (middle third), Phase 3 (final third).

---

### 7. `src/lib/ai/guided.ts` — Extended

#### `guidedModeHandlerV2(message: string, kb: KnowledgeBaseV2): GuidedResultV2`

Deterministic handler for `USE_AI=false` with KB V2. Mirrors the structure of the existing `guidedModeHandler` but extracts structured V2 objects (typed `ProcessFlowStep`, `FunctionalRequirement`, etc.) rather than flat strings. The Anti-Shallow Guard is applied before returning the next question.

---

### 8. `src/app/api/chat/route.ts` — Updated

The route is extended to:
1. Load `kb_version` alongside `json_content` from Supabase
2. Route to V1 pipeline (unchanged) when `kb_version = 1`
3. Route to V2 pipeline when `kb_version = 2`:
   - Call `checkAntiShallowGuard()` before extraction
   - Call `buildSystemPromptV2()` / `buildUserPromptV2()` in AI mode
   - Call `guidedModeHandlerV2()` in guided mode
   - Update `depth_score` and `completion_score` columns on save
4. Include `kb_version`, `guard_triggered`, and `depth_breakdown` in every response

---

### 9. `src/app/api/brd/route.ts` — Updated

The route is extended to:
1. Load `kb_version` from Supabase
2. When `kb_version = 1`: call `generateUSD()` (unchanged)
3. When `kb_version = 2`:
   - Default: call `generatePSB(kb, projectName)`
   - `mode=psb` query param: call `buildPSBPrompt()` → AI → return AI-generated PSB

---

### 10. `src/components/chat/SystemBuilderPanel.tsx` — New Component

Replaces the current Knowledge Panel (`<aside>` in `ChatPageClient.tsx`) when `kb_version = 2`. The three-column layout is preserved; only the right panel content changes.

**Sub-components** (all in the same file, inline styles only):

- `SystemBuilderHeader` — Completion %, Depth Score, Status badge
- `SectionNavigator` — 7 clickable section entries with active highlight and missing-data indicators
- `ActorCard` — name, description, permissions list, goals list
- `UseCaseCard` — title, actor/condition, steps/system_response
- `ProcessFlowViewer` — numbered table with actor, action, system columns
- `EntityCard` — entity name, fields with types
- `RequirementCard` — id, name, description, acceptance criteria count
- `DepthBreakdownBar` — per-section progress bar

**Inline editing**: Clicking any text field renders an `<input>` or `<textarea>` in place. On blur or Enter, the value is saved to KB state and persisted to Supabase. Clearing a field removes the item from its array. After any edit, `calculateDepthV2` is called and the header metrics update without a page reload.

**Auto-scroll**: When the parent component receives a new `ChatResponse`, the panel scrolls the section referenced by the AI's last response into view using `scrollIntoView({ behavior: 'smooth' })`.

---

### 11. `src/components/document/DocumentPreviewV2.tsx` — New Component

Renders the 19-section PSB layout when `kb_version = 2`. The existing `DocumentPreview` component is preserved unchanged for `kb_version = 1`.

**Structure**:
- Header: PSB title, generation date, Completion %, Depth Score
- Scrollable body: 19 sections, each with an `EditableText`/`EditableList` for inline editing
- Embedded `MermaidDiagram` components for BPMN (section 9), UML (section 8), ERD (section 12)
- All styles inline, consistent with `DocumentPreview.tsx`

---

### 12. `supabase/migrations/002_kb_v2_upgrade.sql` — New Migration

Additive-only SQL. Adds:
- `knowledge_bases.kb_version` integer (default 1)
- `knowledge_bases.depth_score` integer (default 0) — note: migration 001 added a `float` version; this migration changes it to integer if needed, or adds a separate `depth_score_v2` integer column
- `knowledge_bases.completion_score` numeric(5,2) (default 0)
- `projects.description` text (nullable) — already added by migration 001 with `add column if not exists`, so this is a no-op

No columns or tables are dropped. No RLS policies are modified.

---

## Data Models

### KB V1 → KB V2 Migration Mapping (Visual)

```
KnowledgeBase (V1)                    KnowledgeBaseV2
─────────────────────────────────     ──────────────────────────────────────
problem: string               ──────► business.problem: string
affected_who: string[]        ──────► business.stakeholders[].name
problem_why: string[]         ──────► business.objectives: string[]
actors[].name                 ──────► actors[].name
actors[].role                 ──────► actors[].description
actors[].responsibility       ──────► actors[].goals[0]
process_flow: string[]        ──────► process_flow[].action (id auto-gen)
decision_points: string[]     ──────► (absorbed into process_flow steps)
edge_cases: string[]          ──────► use_cases.edge[].condition
functional_requirements[]     ──────► functional_requirements[].description
business_rules: string[]      ──────► business_rules[].condition / .action
metadata.depth_score          ──────► completion.depth
metadata.completion_score     ──────► completion.score
metadata.stage                ──────► (resolved dynamically, not stored)
```

### Supabase Schema After Migration 002

```sql
-- knowledge_bases table (additions only)
ALTER TABLE public.knowledge_bases
  ADD COLUMN IF NOT EXISTS kb_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS depth_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_score numeric(5,2) NOT NULL DEFAULT 0;

-- Index for version-based queries
CREATE INDEX IF NOT EXISTS kb_version_idx
  ON public.knowledge_bases(kb_version);
```

Note: Migration 001 already added `depth_score float` and `completion_score float`. Migration 002 uses `ADD COLUMN IF NOT EXISTS` so it is safe to run even if those columns exist. The `kb_version` column is the only truly new addition.

### Depth Score V2 Formula

```
score = min(
  (use_cases.normal.length × 5) +
  (use_cases.edge.length   × 8) +
  (process_flow.length     × 3) +
  (data_model.entities.length × 6) +
  (functional_requirements.length × 4),
  100
)
```

Maximum theoretical score breakdown:
- 4 normal use cases × 5 = 20 pts
- 3 edge use cases × 8 = 24 pts
- 5 process steps × 3 = 15 pts
- 3 entities × 6 = 18 pts
- 6 requirements × 4 = 24 pts
- Total cap: 100

### Anti-Shallow Guard Conditions

| Condition | Stage | Forced Question |
|---|---|---|
| `process_flow.length < 3` | process | "Walk me through at least 3 steps in this process." |
| `use_cases.edge.length === 0` | process → functional | "What happens when something goes wrong in this flow?" |
| `data_model.entities.length === 0` | functional → rules | "What are the main data entities this system stores?" |
| `actors.length < 2` | actors | "Who else interacts with this system besides the primary user?" |

---

