# Implementation Plan: PSB Generator

## Overview

Upgrade Aluria from an MVP chatbot into a production-grade AI System Architect Platform. All changes are additive and backward-compatible. Implementation follows the dependency order: types → DB migration → core AI lib → new AI modules → API routes → UI components → integration wiring.

Key constraints throughout:
- All existing V1 functions remain unchanged
- All new React components use inline styles only (no Tailwind)
- `USE_AI=false` guided mode must work for all V2 features
- No new npm dependencies
- All KB transformation functions must be pure (no side effects)

---

## Tasks

- [x] 1. Extend `src/lib/types.ts` with all KB V2 types
  - Add `ActorV2`, `NormalUseCase`, `EdgeUseCase`, `ProcessFlowStep`, `FunctionalRequirement`, `BusinessRule`, `EntityField`, `Entity`, `Cardinality`, `Relationship`, `SystemArchitecture`, `APIEndpoint` interfaces
  - Add `KnowledgeBaseV2` top-level interface with sections: `business`, `actors`, `use_cases`, `process_flow`, `functional_requirements`, `business_rules`, `data_model`, `system_design`, `ux`, `completion`
  - Add `DepthBreakdownSection` and `DepthBreakdown` interfaces
  - Add `AntiShallowGuardResult` interface
  - Extend `ChatResponse` interface with optional `kb_version?: 1 | 2`, `guard_triggered?: boolean`, `depth_breakdown?: DepthBreakdown` fields — do NOT remove or change existing fields
  - Export all new types
  - _Requirements: 1.1–1.11, 1.13, 4.6, 5.3, 15.6_

- [x] 2. Create `supabase/migrations/002_kb_v2_upgrade.sql`
  - Add `kb_version integer NOT NULL DEFAULT 1` to `knowledge_bases` using `ADD COLUMN IF NOT EXISTS`
  - Add `depth_score integer NOT NULL DEFAULT 0` using `ADD COLUMN IF NOT EXISTS`
  - Add `completion_score numeric(5,2) NOT NULL DEFAULT 0` using `ADD COLUMN IF NOT EXISTS`
  - Add `projects.description text` using `ADD COLUMN IF NOT EXISTS` (nullable)
  - Create index `kb_version_idx` on `knowledge_bases(kb_version)` using `CREATE INDEX IF NOT EXISTS`
  - Do NOT drop any columns, tables, or RLS policies
  - _Requirements: 2.1–2.4, 18.6_

- [x] 3. Extend `src/lib/ai/depth.ts` with V2 depth functions
  - [x] 3.1 Implement `calculateDepthV2(kb: KnowledgeBaseV2): number`
    - Pure function applying the weighted formula: `(use_cases.normal.length × 5) + (use_cases.edge.length × 8) + (process_flow.length × 3) + (data_model.entities.length × 6) + (functional_requirements.length × 4)`, capped at 100 via `Math.min`
    - _Requirements: 5.1, 5.2_
  - [x] 3.2 Implement `getDepthBreakdown(kb: KnowledgeBaseV2): DepthBreakdown`
    - Pure function returning per-section `{score, max, items}` objects for `use_cases_normal`, `use_cases_edge`, `process_flow`, `data_model`, `functional_requirements`
    - `total` field equals `calculateDepthV2(kb)`
    - _Requirements: 5.3_
  - [x] 3.3 Implement `getDepthStatus(score: number): 'Shallow' | 'Moderate' | 'Ready'`
    - Pure function: `< 30` → `'Shallow'`, `30–69` → `'Moderate'`, `>= 70` → `'Ready'`
    - _Requirements: 5.4, 5.5, 5.6_
  - [x] 3.4 Implement `computeProgressV2(kb: KnowledgeBaseV2): number`
    - Pure function returning 0–1 float with weights: business=0.15, actors=0.15, use_cases=0.2, process_flow=0.2, functional_requirements=0.15, data_model=0.15
    - _Requirements: 5.7_
  - Preserve all existing V1 functions (`calculateDepth`, `computeProgress`, etc.) without modification
  - _Requirements: 5.8_

- [x] 4. Extend `src/lib/ai/extract.ts` with V2 extraction functions
  - [x] 4.1 Implement `createEmptyKBV2(): KnowledgeBaseV2`
    - Factory function returning a fully initialized `KnowledgeBaseV2` with all arrays empty and all strings empty
    - _Requirements: 1.13_
  - [x] 4.2 Implement `migrateKBV1toV2(kb: KnowledgeBase): KnowledgeBaseV2`
    - Pure function mapping flat V1 fields to V2 equivalents per the mapping table in the design
    - `problem` → `business.problem`; `affected_who` → `business.stakeholders[].name`; `problem_why` → `business.objectives`
    - `actors[].role` → `actors[].description`; `actors[].responsibility` → `actors[].goals[0]`
    - `process_flow[]` (string) → `process_flow[]` objects with `{id: 'step-N', actor: '', action: s, system: '', next: ''}`
    - `functional_requirements[]` (string) → `{id: 'fr-N', name: s.slice(0,40), description: s, acceptance_criteria: []}`
    - `business_rules[]` (string) → split on 'THEN' (case-insensitive): `{id: 'br-N', condition: before, action: after}`
    - `edge_cases[]` → `use_cases.edge[]` as `{title: s, condition: s, system_response: ''}`
    - `decision_points[]` → discarded (absorbed into process_flow steps)
    - _Requirements: 14.1–14.6_
  - [x] 4.3 Implement `applyExtractionV2(kb: KnowledgeBaseV2, extracted: Partial<KnowledgeBaseV2>): KnowledgeBaseV2`
    - Pure function merging extracted V2 data into existing KB V2, deduplicating by `id` or `name` where applicable
    - _Requirements: 15.2_
  - Preserve all existing V1 functions (`createEmptyKB`, `applyExtraction`, `parseAIResponse`, etc.) without modification
  - _Requirements: 14.1_

- [x] 5. Extend `src/lib/ai/guard.ts` with Anti-Shallow Guard
  - Add `checkAntiShallowGuard(kb: KnowledgeBaseV2, currentStage: Stage): AntiShallowGuardResult`
  - Pure function checking all four guard conditions in order:
    1. `process_flow.length < 3` → blocked, forced question: "Walk me through at least 3 steps in this process."
    2. `use_cases.edge.length === 0` (when advancing from process) → blocked, forced edge-case question
    3. `data_model.entities.length === 0` (when functional stage otherwise complete) → blocked, forced data model question
    4. `actors.length < 2` (when actors stage otherwise complete) → blocked, forced actor question
  - Returns `{ blocked: false }` if none apply
  - Preserve existing `enforceQuestionRules()` function without modification
  - _Requirements: 4.1–4.5_

- [x] 6. Checkpoint — Verify pure functions compile and are importable
  - Ensure all tasks pass TypeScript compilation under existing `tsconfig.json`
  - Ensure all V1 exports remain intact and unchanged
  - Ask the user if questions arise.

- [x] 7. Extend `src/lib/ai/prompt.ts` with V2 prompt builders
  - [x] 7.1 Implement `buildSystemPromptV2(): string`
    - Returns a consulting-grade system prompt instructing the AI to extract structured KB V2 data (typed objects, not flat strings)
    - Applies the 5 question strategies based on current stage
    - Instructs AI to return valid JSON matching the V2 extraction schema
    - Enforces: exactly one question per turn, max 20 words
    - _Requirements: 3.1–3.10, 12.1_
  - [x] 7.2 Implement `buildUserPromptV2(opts: { stage: Stage, kb: KnowledgeBaseV2, userMessage: string, recentMessages: Pick<Message, 'role' | 'content'>[] }): string`
    - Serializes only non-empty KB V2 sections to keep the prompt lean
    - _Requirements: 3.3, 12.2_
  - [x] 7.3 Implement `buildPSBPrompt(kb: KnowledgeBaseV2, projectName: string): string`
    - Constructs a prompt instructing the AI to generate a full 19-section PSB document
    - Includes the full serialized KB V2 as context
    - Instructs the AI to infer reasonable content for empty sections based on populated sections
    - _Requirements: 12.1–12.4_
  - Preserve all existing V1 prompt functions without modification
  - _Requirements: 18.5_

- [x] 8. Extend `src/lib/ai/bpmn.ts` with V2 diagram generators and PSB generator
  - [x] 8.1 Implement `generateBPMNFromV2(kb: KnowledgeBaseV2): string`
    - Pure function producing a text-based BPMN-style flow: `▶ Start → [Actor: action] → [decision?] → … → ■ End`
    - Also produces a Mermaid `flowchart TD` block
    - Infers decision points from `business_rules` entries containing conditional keywords (IF/WHEN/UNLESS)
    - Returns empty string if `process_flow` is empty
    - _Requirements: 6.1–6.6_
  - [x] 8.2 Implement `generateUMLSequence(kb: KnowledgeBaseV2): string`
    - Pure function producing a Mermaid `sequenceDiagram` from `use_cases.normal`
    - Each use case step renders as `Actor->>System: action`
    - Returns empty string if `use_cases.normal` is empty
    - _Requirements: 7.1–7.5_
  - [x] 8.3 Implement `generateERD(kb: KnowledgeBaseV2): string`
    - Pure function producing a Mermaid `erDiagram` from `data_model.entities` and `data_model.relationships`
    - Cardinality mapping: `1:1` → `||--||`, `1:N` → `||--o{`, `N:N` → `}o--o{`
    - Returns empty string if `data_model.entities` is empty
    - _Requirements: 8.1–8.5_
  - [x] 8.4 Implement `generatePSB(kb: KnowledgeBaseV2, projectName: string): string`
    - Pure function returning a Markdown string with exactly 19 sections in the specified order
    - Sections: Executive Summary, Problem Statement, Business Objectives, Stakeholders, AS-IS Process, TO-BE Process, Key Improvements, Use Cases, Process Flow, Functional Requirements, Business Rules, Data Model (ERD), System Architecture, API Design, UI/UX Guidelines, Security Considerations, Performance Requirements, Risk Register, Implementation Roadmap
    - Empty sections render `*(Not yet defined)*`
    - Embeds Mermaid diagrams from `generateBPMNFromV2`, `generateUMLSequence`, `generateERD` in their respective sections
    - Risk Register populated from `business_rules` entries containing conditional logic, as a Markdown table: Risk | Condition | Mitigation
    - Implementation Roadmap groups `functional_requirements` into Phase 1 (first third), Phase 2 (middle third), Phase 3 (final third)
    - Document header includes: project name, generation date, "Product System Blueprint (PSB)" label, completion %, depth score
    - _Requirements: 11.1–11.11_
  - Preserve all existing V1 functions (`generateBPMNXml`, `generateMermaid`, `generateUSD`) without modification
  - _Requirements: 6.6, 18.5_

- [x] 9. Extend `src/lib/ai/guided.ts` with V2 guided mode handler
  - Add `GuidedResultV2` interface mirroring `GuidedResult` but with `updatedKB: KnowledgeBaseV2`
  - Implement `guidedModeHandlerV2(message: string, kb: KnowledgeBaseV2): GuidedResultV2`
    - Deterministic handler for `USE_AI=false` with KB V2
    - Extracts structured V2 objects (`ProcessFlowStep`, `FunctionalRequirement`, `BusinessRule`, etc.) rather than flat strings
    - Calls `checkAntiShallowGuard()` before returning the next question; if guard is triggered, returns the forced question and sets `guard_triggered: true`
    - Calls `calculateDepthV2()` and `computeProgressV2()` to update scores
  - Preserve existing `guidedModeHandler` and all helpers without modification
  - _Requirements: 13.1, 13.2, 13.5, 4.5_

- [x] 10. Checkpoint — Verify all AI lib extensions compile cleanly
  - Run TypeScript compilation check on all modified files in `src/lib/ai/`
  - Ensure no V1 function signatures have changed
  - Ask the user if questions arise.

- [x] 11. Create `src/lib/ai/conflict.ts` — Conflict Resolution Engine
  - Define `ConflictType` type: `'logical' | 'role' | 'process' | 'rule'`
  - Define `ConflictEntry` interface: `{ id, type: ConflictType, description, related_nodes: string[], status: 'unresolved' | 'resolved', resolution_note?: string }`
  - Implement `detectConflicts(kb: KnowledgeBaseV2): ConflictEntry[]`
    - Detects: same actor + conflicting action across process steps; same condition + different outcomes in business rules
    - Returns array of detected conflicts (empty array if none)
  - Implement `resolveConflict(kb: KnowledgeBaseV2, conflictId: string, resolutionNote: string): KnowledgeBaseV2`
    - Pure function returning updated KB with the conflict marked as resolved
  - Implement `hasUnresolvedConflicts(kb: KnowledgeBaseV2): boolean`
    - Returns `true` if any conflict in `kb` has `status === 'unresolved'`
  - _Requirements: 20.1–20.5_

- [x] 12. Create `src/lib/ai/validation.ts` — KB Validation Layer
  - Implement `validateKBV2(kb: KnowledgeBaseV2): ValidationResult`
    - Checks structural integrity: required fields present, arrays not malformed, IDs unique
    - Returns `{ valid: boolean, errors: string[] }`
  - Implement `validateAIOutputAgainstKB(aiOutput: Partial<KnowledgeBaseV2>, kb: KnowledgeBaseV2): Partial<KnowledgeBaseV2>`
    - Filters out any AI-generated entities, actors, or rules not traceable to existing KB context
    - Returns sanitized output safe to merge into KB
  - _Requirements: 19.1–19.6, 15.7_

- [x] 13. Create `src/lib/ai/quality.ts` — Quality Factor Scoring
  - Implement `computeSemanticScore(kb: KnowledgeBaseV2): number`
    - Evaluates clarity (understandable text), specificity (non-vague), completeness (edge cases covered)
    - Returns 0–100 integer
  - Implement `computeQualityDepth(kb: KnowledgeBaseV2): number`
    - Combines quantity score and semantic score: `(calculateDepthV2(kb) * 0.6) + (computeSemanticScore(kb) * 0.4)`
    - Returns 0–100 integer
  - Implement `getPerSectionQuality(kb: KnowledgeBaseV2): Record<string, number>`
    - Returns per-section quality scores keyed by section name
  - _Requirements: 23.1–23.5_

- [x] 14. Create `src/lib/ai/versioning.ts` — KB Version Snapshots
  - Define `KBSnapshot` interface: `{ version: number, timestamp: string, kb: KnowledgeBaseV2, changed_by?: string }`
  - Define `KBDiff` interface: `{ added: string[], removed: string[], modified: string[] }`
  - Implement `createSnapshot(kb: KnowledgeBaseV2, version: number): KBSnapshot`
    - Pure function returning a snapshot object
  - Implement `diffSnapshots(a: KBSnapshot, b: KBSnapshot): KBDiff`
    - Pure function computing a structural diff between two snapshots
  - Implement `shouldCreateSnapshot(updateCount: number, stageChanged: boolean): boolean`
    - Returns `true` every 5 updates OR when stage changes
  - _Requirements: 21.1–21.5_

- [x] 15. Create `src/lib/ai/boundary.ts` — System Boundary Definition
  - Implement `getSystemBoundary(kb: KnowledgeBaseV2): SystemBoundary`
    - Derives system boundary from `actors`, `use_cases`, and `system_design` sections
    - Returns `{ internal: string[], external: string[], interfaces: string[] }`
  - Implement `isWithinBoundary(entity: string, boundary: SystemBoundary): boolean`
    - Pure function checking if an entity is within the defined system boundary
  - _Requirements: 22.4, 22.5_

- [x] 16. Checkpoint — Verify all new AI modules compile and export correctly
  - Ensure `conflict.ts`, `validation.ts`, `quality.ts`, `versioning.ts`, `boundary.ts` all compile under `tsconfig.json`
  - Ask the user if questions arise.

- [x] 17. Update `src/app/api/chat/route.ts` — Add V2 routing branch
  - [x] 17.1 Load `kb_version` alongside `json_content` from Supabase in the existing KB fetch query
    - Change `.select('json_content')` to `.select('json_content, kb_version')`
    - _Requirements: 15.1_
  - [x] 17.2 Add V2 routing branch after the existing KB load
    - When `kb_version === 2`: parse `json_content` as `KnowledgeBaseV2`; when `kb_version === 1` (or absent): use existing V1 pipeline unchanged
    - _Requirements: 2.5, 2.6, 15.1_
  - [x] 17.3 Implement V2 guided mode path (`USE_AI=false` + `kb_version === 2`)
    - Call `guidedModeHandlerV2(message, kb)` instead of `guidedModeHandler`
    - Call `checkAntiShallowGuard()` before extraction; if blocked, return forced question with `guard_triggered: true`
    - Upsert KB with `kb_version: 2`, `depth_score`, `completion_score` columns updated
    - _Requirements: 13.1, 13.2, 4.5, 4.6, 15.4_
  - [x] 17.4 Implement V2 AI mode path (`USE_AI=true` + `kb_version === 2`)
    - Call `checkAntiShallowGuard()` before extraction
    - Call `buildSystemPromptV2()` and `buildUserPromptV2()` instead of V1 equivalents
    - Parse AI response into `Partial<KnowledgeBaseV2>`, validate via `validateAIOutputAgainstKB()`, then call `applyExtractionV2()`
    - Call `calculateDepthV2()` and `computeProgressV2()` to compute updated scores
    - Upsert KB with `kb_version: 2`, `depth_score`, `completion_score` columns updated
    - _Requirements: 15.2, 15.4, 19.5, 19.6_
  - [x] 17.5 Include `kb_version`, `guard_triggered`, and `depth_breakdown` in every V2 response
    - `depth_breakdown` comes from `getDepthBreakdown(updatedKB)`
    - _Requirements: 15.3, 15.5, 15.6_
  - Do NOT modify any existing V1 code paths
  - _Requirements: 14.1_

- [x] 18. Update `src/app/api/brd/route.ts` — Add V2 routing and PSB generation
  - Load `kb_version` from Supabase alongside `json_content`
  - When `kb_version === 1`: call existing `generateUSD()` unchanged
  - When `kb_version === 2` and no `mode` param: call `generatePSB(kb, project.name)` and return result
  - When `kb_version === 2` and `mode=psb` query param: call `buildPSBPrompt(kb, project.name)` → `callAI()` → return AI-generated PSB
  - Check `hasUnresolvedConflicts(kb)` before generation; if true, return 409 with conflict list
  - _Requirements: 11.8, 12.5, 20.6_

- [x] 19. Checkpoint — Verify API routes compile and V1 behavior is unchanged
  - Confirm existing V1 chat and BRD flows still work end-to-end (no regressions)
  - Ask the user if questions arise.

- [x] 20. Create `src/components/chat/SystemBuilderPanel.tsx` — Interactive System Builder
  - [x] 20.1 Implement `SystemBuilderHeader` sub-component
    - Displays Completion % (rounded integer), Depth Score (integer 0–100), Status badge (`Shallow` / `Moderate` / `Ready`)
    - Status badge color: red for Shallow, amber for Moderate, green for Ready
    - All styles inline
    - _Requirements: 9.2_
  - [x] 20.2 Implement `SectionNavigator` sub-component
    - 7 clickable section entries: Business, Actors, Use Cases, Process, Data Model, Requirements, System Design
    - Active section highlighted with distinct inline style (accent border + background)
    - Missing-data sections show a dot/badge indicator
    - _Requirements: 9.3, 9.4, 9.5_
  - [x] 20.3 Implement `ActorCard` sub-component
    - Displays name, description, permissions list, goals list
    - Inline editing: clicking any text field renders `<input>` or `<textarea>` in place; on blur/Enter saves to KB state
    - Clearing a field removes the item from its array
    - _Requirements: 9.6, 10.1–10.3_
  - [x] 20.4 Implement `UseCaseCard` sub-component
    - Displays title, actor/condition, steps/system_response
    - Separate cards for `use_cases.normal` and `use_cases.edge`
    - Inline editing consistent with `ActorCard`
    - _Requirements: 9.7, 10.1–10.3_
  - [x] 20.5 Implement `ProcessFlowViewer` sub-component
    - Numbered table with actor, action, system columns from `kb.process_flow`
    - Inline editing per cell
    - _Requirements: 9.8, 10.1–10.3_
  - [x] 20.6 Implement `EntityCard` sub-component
    - Displays entity name and fields with types
    - Inline editing
    - _Requirements: 9.9, 10.1–10.3_
  - [x] 20.7 Implement `RequirementCard` sub-component
    - Displays id, name, description, acceptance criteria count
    - Inline editing
    - _Requirements: 9.10, 10.1–10.3_
  - [x] 20.8 Implement `DepthBreakdownBar` sub-component
    - Per-section progress bar showing each section's contribution to overall Depth Score V2
    - Uses `getDepthBreakdown()` data
    - _Requirements: 9.11_
  - [x] 20.9 Wire `SystemBuilderPanel` main component
    - Accepts props: `kb: KnowledgeBaseV2`, `onKBUpdate: (kb: KnowledgeBaseV2) => void`, `activeSection?: string`
    - Composes all sub-components
    - After any inline edit: calls `calculateDepthV2()` and updates header metrics without page reload
    - Persists edits to Supabase via a passed-in `onKBUpdate` callback
    - Auto-scroll: when `activeSection` prop changes, scrolls that section into view using `scrollIntoView({ behavior: 'smooth' })`
    - All styles inline; no Tailwind
    - _Requirements: 9.1, 9.12, 9.13, 10.4, 10.5_

- [x] 21. Create `src/components/document/DocumentPreviewV2.tsx` — 19-section PSB preview
  - Reuse `EditableText` and `EditableList` patterns from `DocumentPreview.tsx` (copy inline, do not import from V1 file)
  - Render document header: PSB title, generation date, Completion %, Depth Score
  - Render all 19 PSB sections in order, each with inline-editable fields
  - Embed `MermaidDiagram` component for BPMN (section 9 — Process Flow), UML (section 8 — Use Cases), ERD (section 12 — Data Model)
  - Empty sections render `*(Not yet defined)*` placeholder
  - Props: `kb: KnowledgeBaseV2`, `projectName: string`, `onKBUpdate: (kb: KnowledgeBaseV2) => void`, `onBackToChat: () => void`, `onDownload: () => void`
  - All styles inline, consistent with `DocumentPreview.tsx`
  - _Requirements: 16.1–16.6_

- [x] 22. Update `src/components/chat/ChatPageClient.tsx` — Wire V2 components
  - [x] 22.1 Add `kb_version` state (default `1`) initialized from a new `initialKBVersion` prop
    - Update the component's props interface to accept `initialKBVersion?: 1 | 2`
    - _Requirements: 15.3_
  - [x] 22.2 Update `sendMessage` to read `kb_version` and `guard_triggered` from `ChatResponse` and update state
    - When `guard_triggered` is true, display a subtle indicator in the chat UI (e.g., a banner or badge)
    - _Requirements: 4.6, 15.3_
  - [x] 22.3 Replace the right-panel `<aside>` Knowledge Panel with `SystemBuilderPanel` when `kb_version === 2`
    - When `kb_version === 1`: render existing Knowledge Panel unchanged
    - When `kb_version === 2`: render `<SystemBuilderPanel kb={kb as KnowledgeBaseV2} onKBUpdate={handleKBUpdate} activeSection={activeSection} />`
    - Pass the section referenced by the last AI response as `activeSection`
    - _Requirements: 9.1, 9.13_
  - [x] 22.4 Route to `DocumentPreviewV2` in review mode when `kb_version === 2`
    - When `kb_version === 1`: render existing `DocumentPreview` unchanged
    - When `kb_version === 2`: render `<DocumentPreviewV2 kb={kb as KnowledgeBaseV2} ... />`
    - _Requirements: 16.1, 16.5_
  - Do NOT modify any existing V1 rendering paths
  - _Requirements: 14.1_

- [x] 23. Checkpoint — End-to-end integration verification
  - Verify V1 projects still load and chat correctly (no regressions)
  - Verify V2 project flow: chat → KB V2 populated → SystemBuilderPanel updates → review mode shows DocumentPreviewV2 → BRD route returns PSB
  - Verify `USE_AI=false` guided mode works for V2 projects
  - Ask the user if questions arise.

- [x] 24. Update `src/app/app/project/[id]/page.tsx` — Pass `kb_version` to `ChatPageClient`
  - Fetch `kb_version` from `knowledge_bases` table alongside `json_content`
  - Pass `initialKBVersion` prop to `ChatPageClient`
  - _Requirements: 15.1_

- [x] 25. Final checkpoint — Full compilation and smoke test
  - Ensure all files compile without TypeScript errors under existing `tsconfig.json`
  - Ensure no new npm packages have been added to `package.json`
  - Ensure all inline styles are used in new components (no Tailwind classes)
  - Ensure all V1 exports remain intact and callable
  - Ask the user if questions arise.

---

## Phase 2 — Reliability & Cost Control

- [x] 26. Add AI streaming response to `/api/chat` and `ChatPageClient`
  - [x] 26.1 Update `/api/chat` V2 AI path to support streaming via `ReadableStream` + `TransformStream`
    - Use Next.js App Router streaming pattern: return `new Response(stream)` with `Content-Type: text/event-stream`
    - Pipe AI provider token chunks into the `TransformStream` writer; close the stream on completion
    - V1 path and guided mode path remain non-streaming (return JSON as before)
  - [x] 26.2 Update `ChatPageClient.tsx` to consume the streaming response
    - Detect `Content-Type: text/event-stream` on the fetch response and read via `response.body.getReader()`
    - Render partial AI message text progressively as chunks arrive, updating React state on each chunk
    - Show a "typing indicator" (animated dots or skeleton bubble) while the stream is open and hide it on stream close

- [x] 27. Implement AI retry wrapper and provider fallback
  - [x] 27.1 Implement `retryAI(fn: () => Promise<T>, maxRetries?: number): Promise<T>` in `src/lib/ai/prompt.ts`
    - Retry up to 2 times on transient failures; delays: 500ms after first failure, 1000ms after second
    - Skip retry immediately on HTTP 429 (rate limit) and 401 (auth) — surface those errors directly
  - [x] 27.2 Enforce provider fallback priority in the V2 AI path of `/api/chat`
    - Attempt OpenAI first; on failure attempt Gemini; on failure fall back to `guidedModeHandlerV2()`
    - Verify the existing V2 path already has this ordering; add or correct it if not
    - Log which provider was ultimately used in the response (add optional `provider_used?: string` to `ChatResponse`)

- [x] 28. Add prompt versioning to KB and routing
  - [x] 28.1 Add optional `prompt_version?: number` field to `KnowledgeBaseV2.completion` in `src/lib/types.ts`
    - Default value is `2` when absent; field is optional so existing KB objects remain valid
  - [x] 28.2 Store `prompt_version: 2` when creating new V2 projects in `/api/projects`
    - Write the field into the initial `KnowledgeBaseV2` object produced by `createEmptyKBV2()` or `bootstrapKB()`
  - [x] 28.3 Route to the correct prompt builder based on `kb.completion.prompt_version` in `/api/chat` V2 path
    - `prompt_version === 2` (or absent) → `buildSystemPromptV2()` / `buildUserPromptV2()`
    - Structure the branch so future versions (3, 4, …) can be added without touching existing cases

- [x] 29. Enforce AI cost controls in the V2 chat path
  - [x] 29.1 Verify `max_tokens` caps are applied in all V2 AI calls in `/api/chat` and `/api/brd`
    - Chat turns: `max_tokens: 600`; PSB generation: `max_tokens: 1500`
    - Add or correct these values if they are missing or exceed the caps
  - [x] 29.2 Truncate `recentMessages` to the last 5 messages inside `buildUserPromptV2()`
    - Slice the `recentMessages` array to `recentMessages.slice(-5)` before serializing into the prompt
  - [x] 29.3 Implement `estimateTokenUsage(prompt: string): number` in `src/lib/ai/prompt.ts`
    - Rough estimate: `Math.ceil(prompt.length / 4)`; returns an integer
    - Export the function for use in route handlers to log or gate oversized prompts

- [x] 30. Add KB auto-save debouncing in `SystemBuilderPanel`
  - [x] 30.1 Debounce the Supabase upsert triggered by inline edits in `SystemBuilderPanel.tsx`
    - Use a `useRef`-based timeout (400ms); clear and reset the timer on every edit before the delay elapses
    - Only the final value within the debounce window is written to Supabase
  - [x] 30.2 Show a "Saving…" indicator in the `SystemBuilderHeader` while the debounced write is pending
    - Set a `saving` boolean state to `true` when the timer starts and `false` in the Supabase upsert callback
    - Render a small inline "Saving…" label next to the Completion % using inline styles

- [x] 31. Implement document versioning (project snapshots)
  - [x] 31.1 Create `supabase/migrations/003_project_versions.sql`
    - Table: `project_versions (id uuid primary key default gen_random_uuid(), project_id uuid references projects(id) on delete cascade, version int not null, kb_snapshot jsonb not null, created_at timestamptz not null default now())`
    - RLS policy: users can only select/insert rows where `project_id` belongs to their own projects
    - Index: `CREATE INDEX IF NOT EXISTS project_versions_project_id_idx ON project_versions(project_id)`
  - [x] 31.2 Implement `saveProjectVersion(projectId: string, kb: KnowledgeBaseV2, supabase: SupabaseClient): Promise<void>` in `src/lib/ai/versioning.ts`
    - Reads the current max `version` for the project, increments by 1, inserts a new row
    - Call this from `/api/brd` before PSB generation and from `/api/chat` when `shouldCreateSnapshot()` returns `true`
  - [x] 31.3 Add `GET /api/versions?project_id=X` route
    - Queries `project_versions` for the given project, returns `{ versions: { version: number, created_at: string }[] }`
    - Enforce auth: return 401 if no session, 403 if project does not belong to the requesting user

---

## Phase 3 — UX Intelligence

- [x] 32. Add export options beyond PDF in `DocumentPreviewV2`
  - [x] 32.1 Add a Markdown export button in `DocumentPreviewV2.tsx`
    - On click: fetch `/api/brd?project_id=X` (default mode, returns PSB Markdown), create a `Blob`, trigger a `<a download="psb.md">` click
    - Button uses inline styles consistent with the existing Download PDF button
  - [x] 32.2 Add a JSON (raw KB) export button in `DocumentPreviewV2.tsx`
    - On click: serialize the current `kb` prop via `JSON.stringify(kb, null, 2)`, create a `Blob`, trigger a `<a download="kb.json">` click
  - [x] 32.3 Add a disabled "Export .docx (coming soon)" placeholder button in `DocumentPreviewV2.tsx`
    - Rendered as a visually distinct disabled button with `cursor: not-allowed` and reduced opacity via inline styles
    - No click handler; purely a UI placeholder

- [x] 33. Implement AI Insight Panel
  - [x] 33.1 Implement `analyzeKBWeakness(kb: KnowledgeBaseV2): KBInsight[]` in `src/lib/ai/quality.ts`
    - `KBInsight` interface: `{ section: string, severity: 'high' | 'medium' | 'low', message: string }`
    - Rules: empty `actors` → high; `use_cases.edge.length === 0` → high; `process_flow.length < 3` → medium; empty `data_model.entities` → medium; `functional_requirements.length < 2` → low
    - Returns an empty array if no weaknesses are detected
  - [x] 33.2 Create `src/components/chat/AIInsightPanel.tsx`
    - Accepts props: `insights: KBInsight[]`, `onSectionFocus: (section: string) => void`
    - Groups insights by severity (high → medium → low), renders each group with a colored header (red/amber/green) using inline styles
    - Each insight row is clickable; clicking calls `onSectionFocus(section)` so the parent can scroll `SystemBuilderPanel` to that section
    - All styles inline; no Tailwind

- [x] 34. Implement Smart Suggestions Engine
  - [x] 34.1 Implement `generateSuggestions(kb: KnowledgeBaseV2): Suggestion[]` in `src/lib/ai/quality.ts`
    - `Suggestion` interface: `{ type: 'missing' | 'improve', section: string, suggestion: string }`
    - Example rules: no edge cases → `{ type: 'missing', section: 'use_cases', suggestion: "You haven't defined failure scenarios. Add at least 1 edge case." }`; single actor → suggest adding a second; no API endpoints → suggest defining at least one
  - [x] 34.2 Surface suggestions in `SystemBuilderPanel.tsx` as a dismissible "Suggestions" section at the bottom of the panel
    - Render suggestions returned by `generateSuggestions(kb)` as a list with a dismiss (×) button per item
    - Dismissed suggestions are stored in a `Set` in local component state and filtered out on re-render
    - All styles inline

- [x] 35. Add loading states throughout the UI
  - [x] 35.1 Add an "Aluria is thinking…" skeleton bubble in `ChatPageClient.tsx` while `sending === true`
    - Render a placeholder chat bubble with animated opacity pulse (CSS `@keyframes` via a `<style>` tag or inline `animation` property) when `sending` is `true`
    - Remove the skeleton bubble when the response arrives and the real message is rendered
  - [x] 35.2 Verify `MermaidDiagram.tsx` loading state works correctly for V2 diagrams
    - Confirm the component shows a loading indicator while Mermaid renders and hides it on completion
    - Fix or add the loading state if it is absent or broken for V2 diagram strings
  - [x] 35.3 Add a full-panel loading overlay in `DocumentPreviewV2.tsx` during PSB generation
    - Show an overlay with a spinner and "Generating PSB…" label (inline styles) while the `/api/brd` fetch is in flight
    - Hide the overlay once the response resolves or rejects

- [x] 36. Harden `ErrorBoundary` coverage in the project page
  - Verify `ErrorBoundary` wraps `ChatPageClient` in `src/app/app/project/[id]/page.tsx`; add it if missing
  - Add a second `ErrorBoundary` instance wrapping `SystemBuilderPanel` specifically inside `ChatPageClient.tsx`, so a panel crash does not take down the entire chat view
  - Both boundaries should render a minimal inline-styled fallback UI (e.g., "Something went wrong. Reload the page.")

---

## Phase 4 — Growth & Experimentation

- [x] 37. Add minimal analytics tracking
  - [x] 37.1 Implement `trackEvent(event: string, data?: Record<string, unknown>): void` in `src/lib/analytics.ts`
    - In development (`process.env.NODE_ENV === 'development'`): `console.log('[analytics]', event, data)`
    - In production: fire-and-forget `fetch('/api/analytics', { method: 'POST', body: JSON.stringify({ event, data }) })`
    - Never throws; wrap the fetch in a try/catch and swallow errors silently
  - [x] 37.2 Create `/api/analytics` POST route and `supabase/migrations/004_analytics.sql`
    - Migration: `analytics_events (id uuid primary key default gen_random_uuid(), event text not null, data jsonb, user_id uuid, created_at timestamptz not null default now())`
    - Route: insert one row per POST; return `{ ok: true }`; no auth required (anonymous events allowed)
    - Call `trackEvent('chat_message_sent')` in `ChatPageClient` on each send, `trackEvent('psb_generated')` in `/api/brd` on successful generation

- [x] 38. Implement feature flag system
  - [x] 38.1 Create `src/lib/features.ts` exporting a `FEATURES` constant object
    - `FEATURES.AI_ENABLED`: reads `process.env.USE_AI === 'true'`
    - `FEATURES.PSB_V2`: reads `process.env.PSB_V2 !== 'false'` (on by default)
    - `FEATURES.STREAMING`: reads `process.env.STREAMING === 'true'`
    - `FEATURES.ANALYTICS`: reads `process.env.ANALYTICS === 'true'`
  - [x] 38.2 Replace direct `process.env.USE_AI` checks in `/api/chat` and `guided.ts` with `FEATURES.AI_ENABLED`
    - Import `FEATURES` from `src/lib/features.ts` and substitute all `process.env.USE_AI === 'true'` expressions
  - [x] 38.3 Gate PSB V2 routing in `/api/chat` and `/api/brd` behind `FEATURES.PSB_V2`
    - When `FEATURES.PSB_V2` is `false`, treat all projects as V1 regardless of `kb_version`

- [x] 39. Add onboarding flow for first-time users
  - [x] 39.1 Persist onboarding state to `localStorage`
    - Key: `aluria_has_seen_onboarding`; value: `'true'` after the user completes or dismisses the overlay
    - Read the key on mount in `ChatPageClient.tsx` to determine whether to show the overlay
  - [x] 39.2 Create `src/components/chat/OnboardingOverlay.tsx`
    - 3-step walkthrough: Step 1 — "Chat with Aluria to define your system"; Step 2 — "Watch your Knowledge Base build up on the right"; Step 3 — "Generate your Product System Blueprint when ready"
    - Navigation: "Next" / "Back" buttons; final step shows "Get Started" which calls an `onComplete` prop callback
    - Full-screen semi-transparent backdrop with a centered card; all styles inline
  - [x] 39.3 Wire `OnboardingOverlay` into `ChatPageClient.tsx`
    - Show the overlay when `messages.length === 0` AND `hasSeenOnboarding === false`
    - On `onComplete`: set `localStorage.aluria_has_seen_onboarding = 'true'` and hide the overlay

- [x] 40. Add sample project templates
  - [x] 40.1 Create `src/lib/templates.ts` with 4 pre-built `KnowledgeBaseV2` template objects
    - Templates: `erp-system`, `marketplace`, `hr-system`, `inventory`
    - Each template has realistic pre-filled values for `business`, `actors`, `use_cases`, `process_flow`, and `functional_requirements`
    - Export a `TEMPLATES` record: `Record<string, { label: string, description: string, kb: KnowledgeBaseV2 }>`
  - [x] 40.2 Add template selection UI to `src/app/app/new/page.tsx`
    - Render 4 clickable cards below the description textarea, one per template
    - Selecting a card sets a `selectedTemplate` state and visually highlights the chosen card (inline styles)
    - Selecting a template pre-fills the description textarea with the template's description
  - [x] 40.3 Accept `template_id` in the `/api/projects` POST body
    - When `template_id` is present and matches a key in `TEMPLATES`, use that template's `kb` as the initial `KnowledgeBaseV2` instead of running `bootstrapKB()`
    - Set `kb_version: 2` and `prompt_version: 2` on the initial KB when a template is used

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Phase 1 implementation order is strict: types (1) → DB (2) → depth/extract/guard (3–5) → prompt/bpmn/guided (7–9) → new modules (11–15) → API routes (17–18) → UI (20–22) → wiring (24)
- Phase 2 priority order for production readiness: retry+fallback (27) → cost control (29) → versioning (31) → streaming (26)
- Phase 3 priority order for UX: insight panel (33) → suggestions (34) → onboarding (39)
- Phase 4 priority order for growth: templates (40) → analytics (37) → feature flags (38)
- All KB transformation functions (`calculateDepthV2`, `generatePSB`, `migrateKBV1toV2`, etc.) are pure — test them in isolation before wiring into routes
- The `kb_version` column is the single routing gate; never infer version from KB shape
- Supabase upserts for V2 must always include `kb_version: 2`, `depth_score`, and `completion_score` to keep columns in sync
- Task 32.3 is marked optional (`*`) and must NOT be implemented by a coding agent — it is a UI placeholder only

