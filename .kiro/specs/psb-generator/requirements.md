# Requirements Document

## Introduction

Aluria is being upgraded from an MVP chatbot into a production-grade **AI System Architect Platform**. The current system collects requirements through a flat Knowledge Base (KB) and generates a basic BRD+SRS document. This upgrade — codenamed **PSB Generator** — transforms Aluria into a structured, depth-aware platform that produces a unified **Product System Blueprint (PSB)**: a single authoritative document combining BRD, SRS, ERD, BPMN, UML, and system architecture into 19 sections.

The upgrade spans six capability areas: a hierarchical KB V2 schema, a consulting-grade AI Orchestration Engine, a weighted Depth Scoring V2 system, an Auto-Generation Engine for diagrams, an Interactive System Builder UI panel, and the PSB Document Generator itself. All changes must be backward-compatible with existing Supabase data and must not break auth, guided mode, chat flow, or PDF export.

---

## Glossary

- **Platform**: The upgraded Aluria AI System Architect Platform (the system under specification).
- **KB**: Knowledge Base — the structured JSON object that accumulates all project intelligence during a session.
- **KB V2**: The new hierarchical KB schema replacing the flat MVP schema.
- **PSB**: Product System Blueprint — the unified output document combining BRD + SRS + diagrams.
- **Depth Score**: A weighted integer (0–100) measuring how thoroughly each KB section has been populated.
- **Completion Score**: A float (0–1) measuring what fraction of required KB sections have been filled.
- **Stage**: The current phase of the AI questioning workflow (problem → actors → process → functional → rules → complete).
- **Question Strategy Engine**: The rule-based component that selects the next consulting-grade question based on KB state.
- **Anti-Shallow Guard**: A rule-based gate that forces additional questions when KB sections are insufficiently populated.
- **BPMN Generator**: The component that converts `process_flow` structured steps into BPMN-style text diagrams.
- **UML Generator**: The component that produces UML Sequence Diagrams from actor–system interaction data.
- **ERD Generator**: The component that converts `data_model` entities into Entity-Relationship Diagram text.
- **Interactive System Builder**: The upgraded right-panel UI component replacing the current simple Knowledge Panel.
- **Section Navigator**: The clickable sidebar within the Interactive System Builder that shows section completion status.
- **ActorCard / UseCaseCard / ProcessFlowViewer / EntityCard / RequirementCard**: Typed UI sub-components within the Interactive System Builder.
- **Guided Mode**: The deterministic fallback mode when `USE_AI=false`, which must continue to function after the upgrade.
- **Migration**: An additive-only SQL migration applied to the existing Supabase schema; no columns or tables are dropped.
- **PSB Document Generator**: The upgraded document generation pipeline that produces the 19-section PSB.

---

## Requirements

### Requirement 1: KB V2 Hierarchical Schema

**User Story:** As a platform developer, I want a structured hierarchical KB schema, so that all project intelligence is organized into typed, queryable sections rather than flat arrays.

#### Acceptance Criteria

1. THE Platform SHALL define a `KnowledgeBaseV2` TypeScript type in `src/lib/types.ts` containing the following top-level sections: `business`, `actors`, `use_cases`, `process_flow`, `functional_requirements`, `business_rules`, `data_model`, `system_design`, `ux`, and `completion`.
2. THE Platform SHALL define the `business` section with typed sub-fields: `problem` (string), `objectives` (string[]), `success_metrics` (string[]), and `stakeholders` (array of `{name, goals[], pain_points[]}`).
3. THE Platform SHALL define the `actors` section as an array of `{name, description, permissions[], goals[]}`.
4. THE Platform SHALL define the `use_cases` section with two sub-arrays: `normal` (array of `{title, actor, steps[]}`) and `edge` (array of `{title, condition, system_response}`).
5. THE Platform SHALL define the `process_flow` section as an array of structured objects `{id, actor, action, system, next}` rather than plain strings.
6. THE Platform SHALL define the `functional_requirements` section as an array of `{id, name, description, acceptance_criteria[]}`.
7. THE Platform SHALL define the `business_rules` section as an array of `{id, condition, action}`.
8. THE Platform SHALL define the `data_model` section with `entities` (array of `{name, fields: {name, type}[]}`) and `relationships` (array of `{from, to, cardinality}` where cardinality is one of `1:1`, `1:N`, `N:N`).
9. THE Platform SHALL define the `system_design` section with an `architecture` object containing `frontend`, `backend`, `database`, and `ai_layer` string fields, plus an `api_endpoints` array of `{method, path, description}`.
10. THE Platform SHALL define the `ux` section with `user_flow` (string[]) and `screens` (string[]) arrays.
11. THE Platform SHALL define the `completion` section with a `score` (number, 0–100) and `depth` (number, 0–100) field.
12. WHEN a project's existing KB data uses the flat MVP schema, THE Platform SHALL read and display it without errors by applying a backward-compatibility migration function that maps flat fields to their KB V2 equivalents.
13. THE Platform SHALL export a `createEmptyKBV2()` factory function that returns a fully initialized `KnowledgeBaseV2` with all arrays empty and all strings empty.
14. WHEN KB V2 data is persisted to Supabase, THE Platform SHALL store it in the existing `knowledge_bases.json_content` JSONB column without requiring a column type change.
15. THE Platform SHALL enforce that all generated outputs must be traceable to KB entries.
16. THE Platform SHALL include source references for each PSB section linking back to KB nodes.


---

### Requirement 2: Supabase Schema Migration (Additive Only)

**User Story:** As a platform operator, I want the database schema to be extended without breaking existing data, so that existing projects continue to work after the upgrade.

#### Acceptance Criteria

1. THE Platform SHALL provide a SQL migration file at `supabase/migrations/002_kb_v2_upgrade.sql` that adds new columns and indexes without dropping or altering existing ones.
2. WHEN the migration is applied, THE Platform SHALL add a `kb_version` integer column (default `1`) to the `knowledge_bases` table to distinguish flat MVP KB (version 1) from KB V2 (version 2).
3. WHEN the migration is applied, THE Platform SHALL add a `depth_score` integer column (default `0`) and a `completion_score` numeric(5,2) column (default `0`) to the `knowledge_bases` table for indexed querying.
4. THE Platform SHALL add a `projects.description` text column (nullable) if it does not already exist, to store the initial project description used for KB bootstrapping.
5. IF a `knowledge_bases` row has `kb_version = 1`, THEN THE Platform SHALL treat its `json_content` as a flat MVP KB and apply the backward-compatibility migration function before use.
6. IF a `knowledge_bases` row has `kb_version = 2`, THEN THE Platform SHALL treat its `json_content` as a `KnowledgeBaseV2` object directly.
7. THE Platform SHALL classify conflicts into:
- Logical conflict
- Role conflict
- Process conflict
- Rule conflict
8. THE Platform SHALL store conflict resolution history in KB.


---

### Requirement 3: Consulting-Grade AI Questioning Engine

**User Story:** As a user defining a system, I want the AI to ask sharp, context-aware questions one at a time, so that I am guided to articulate my system thoroughly without feeling interrogated.

#### Acceptance Criteria

1. WHEN the AI generates a question, THE Platform SHALL produce exactly one question per response turn.
2. WHEN the AI generates a question, THE Platform SHALL limit the question to a maximum of 20 words.
3. WHEN the AI generates a question, THE Platform SHALL reference specific context already present in the KB rather than asking generic questions.
4. THE Platform SHALL never repeat a question that has already been asked in the current session's message history.
5. WHEN the current stage is `problem`, THE Platform SHALL apply the `root_cause` question strategy: ask questions that uncover the underlying cause of the problem, not just its symptoms.
6. WHEN the current stage is `actors`, THE Platform SHALL apply the `role_depth` question strategy: ask questions that reveal decision-making authority, permissions, and goals for each actor.
7. WHEN the current stage is `process`, THE Platform SHALL apply the `decision_points` question strategy: ask questions that surface branching logic, approval steps, and failure paths.
8. WHEN the current stage is `functional`, THE Platform SHALL apply the `constraints` question strategy: ask questions that reveal input validation rules, system responses, and performance constraints.
9. WHEN the current stage is `rules`, THE Platform SHALL apply the `edge_cases` question strategy: ask questions that uncover exceptions, boundary conditions, and rule violations.
10. THE Platform SHALL increase question depth with each turn: early questions establish context, later questions drill into specifics.
11. THE Platform SHALL maintain version snapshots for KB on every major update.
12. THE Platform SHALL allow rollback to previous KB versions.
13. THE Platform SHALL store diff logs between KB versions.


---

### Requirement 4: Anti-Shallow Guard

**User Story:** As a platform developer, I want the system to detect and reject shallow KB states before advancing stages, so that the generated PSB document is always substantive.

#### Acceptance Criteria

1. WHEN `process_flow` contains fewer than 3 structured steps, THE Anti-Shallow Guard SHALL block stage advancement and force at least one additional process question.
2. WHEN `use_cases.edge` is empty, THE Anti-Shallow Guard SHALL block stage advancement from `process` to `functional` and force at least one edge-case question.
3. WHEN `data_model.entities` is empty after the `functional` stage is otherwise complete, THE Anti-Shallow Guard SHALL force at least one data model question before advancing to `rules`.
4. WHEN `actors` contains fewer than 2 entries after the `actors` stage is otherwise complete, THE Anti-Shallow Guard SHALL force at least one additional actor-identification question.
5. THE Anti-Shallow Guard SHALL operate identically in both AI mode and Guided Mode (`USE_AI=false`).
6. WHEN the Anti-Shallow Guard blocks advancement, THE Platform SHALL include a `guard_triggered: true` flag in the chat API response so the UI can display an appropriate indicator.

---

### Requirement 5: Depth Scoring V2 (Weighted)

**User Story:** As a user, I want to see a meaningful depth score that reflects how thoroughly each section of my system has been defined, so that I know exactly what is missing before generating the PSB.

#### Acceptance Criteria

1. THE Platform SHALL compute the Depth Score V2 using the following weighted formula: `(use_cases.normal.length × 5) + (use_cases.edge.length × 8) + (process_flow.length × 3) + (data_model.entities.length × 6) + (functional_requirements.length × 4)`, capped at 100.
2. THE Platform SHALL expose a `calculateDepthV2(kb: KnowledgeBaseV2): number` function in `src/lib/ai/depth.ts` that returns an integer between 0 and 100.
3. THE Platform SHALL expose a `getDepthBreakdown(kb: KnowledgeBaseV2): DepthBreakdown` function that returns per-section scores: `use_cases_normal`, `use_cases_edge`, `process_flow`, `data_model`, `functional_requirements`, each as `{score: number, max: number, items: number}`.
4. WHEN the Depth Score V2 is below 30, THE Platform SHALL classify the status as `Shallow`.
5. WHEN the Depth Score V2 is between 30 and 69 inclusive, THE Platform SHALL classify the status as `Moderate`.
6. WHEN the Depth Score V2 is 70 or above, THE Platform SHALL classify the status as `Ready`.
7. THE Platform SHALL store the computed Depth Score V2 in `kb.completion.depth` after each chat turn.
8. THE Platform SHALL maintain the existing `calculateDepth()` function without modification to preserve backward compatibility with existing KB V1 data.

---

### Requirement 6: BPMN Auto-Generator

**User Story:** As a user, I want the system to automatically generate a BPMN-style process flow diagram from my structured process steps, so that I can visualize the workflow without drawing it manually.

#### Acceptance Criteria

1. WHEN `process_flow` contains at least one structured step, THE BPMN Generator SHALL produce a text-based BPMN-style flow in the format: `▶ Start → [actor: action] → [decision?] → … → ■ End`.
2. THE BPMN Generator SHALL include each step's `actor` and `action` fields in the diagram node label.
3. WHEN a `process_flow` step has a `next` field referencing another step's `id`, THE BPMN Generator SHALL render a directed arrow between those nodes.
4. THE BPMN Generator SHALL also produce a Mermaid `flowchart TD` representation of the same process flow for rendering in the UI.
5. THE BPMN Generator SHALL be implemented as an updated `generateBPMNFromV2(kb: KnowledgeBaseV2): string` function in `src/lib/ai/bpmn.ts`.
6. THE Platform SHALL preserve the existing `generateBPMNXml()` and `generateMermaid()` functions without modification for backward compatibility.
7. THE BPMN Generator SHALL detect decision points based on conditional rules.
8. THE BPMN Generator SHALL support branching and parallel flows.
9. THE UML Generator SHALL differentiate between synchronous and asynchronous calls.
---

### Requirement 7: UML Sequence Diagram Generator

**User Story:** As a user, I want the system to generate a UML Sequence Diagram from my use cases, so that I can see how actors, the system, and the database interact.

#### Acceptance Criteria

1. WHEN `use_cases.normal` contains at least one use case, THE UML Generator SHALL produce a UML Sequence Diagram in Mermaid `sequenceDiagram` syntax.
2. THE UML Generator SHALL render the interaction pattern: `Actor → System → Database → System → Actor` for each use case step.
3. THE UML Generator SHALL use the `actor` field from each use case as the participant label.
4. THE UML Generator SHALL be implemented as a `generateUMLSequence(kb: KnowledgeBaseV2): string` function in `src/lib/ai/bpmn.ts`.
5. WHEN `use_cases.normal` is empty, THE UML Generator SHALL return an empty string.

---

### Requirement 8: ERD Generator

**User Story:** As a user, I want the system to generate an Entity-Relationship Diagram from my data model, so that I can review the database structure without writing SQL.

#### Acceptance Criteria

1. WHEN `data_model.entities` contains at least one entity, THE ERD Generator SHALL produce an ERD in Mermaid `erDiagram` syntax.
2. THE ERD Generator SHALL render each entity with its field names and types.
3. WHEN `data_model.relationships` contains entries, THE ERD Generator SHALL render each relationship with the correct cardinality notation (`||--o{`, `||--||`, `}o--o{`).
4. THE ERD Generator SHALL be implemented as a `generateERD(kb: KnowledgeBaseV2): string` function in `src/lib/ai/bpmn.ts`.
5. WHEN `data_model.entities` is empty, THE ERD Generator SHALL return an empty string.

---

### Requirement 9: Interactive System Builder UI Panel

**User Story:** As a user, I want the right-side Knowledge Panel to show a structured, navigable view of my system as it is being built, so that I can see what has been captured and what is still missing at a glance.

#### Acceptance Criteria

1. THE Interactive System Builder SHALL replace the current simple Knowledge Panel in `src/components/chat/ChatPageClient.tsx` while preserving the three-column layout.
2. THE Interactive System Builder header SHALL display: Completion % (rounded integer), Depth Score (integer 0–100), and Status label (`Shallow`, `Moderate`, or `Ready`).
3. THE Interactive System Builder SHALL include a Section Navigator with clickable entries for: Business, Actors, Use Cases, Process, Data Model, Requirements, System Design.
4. WHEN a section is active (currently being populated by the AI), THE Section Navigator SHALL highlight that section with a distinct visual indicator using inline styles.
5. WHEN a section has no data, THE Section Navigator SHALL display a missing-data indicator (e.g., a dot or badge) next to the section name.
6. THE Interactive System Builder SHALL render an `ActorCard` sub-component for each entry in `kb.actors`, showing name, description, permissions, and goals.
7. THE Interactive System Builder SHALL render a `UseCaseCard` sub-component for each entry in `kb.use_cases.normal` and `kb.use_cases.edge`, showing title, actor/condition, and steps/system_response.
8. THE Interactive System Builder SHALL render a `ProcessFlowViewer` sub-component that displays `kb.process_flow` as a numbered list with actor, action, and system columns.
9. THE Interactive System Builder SHALL render an `EntityCard` sub-component for each entry in `kb.data_model.entities`, showing entity name and its fields with types.
10. THE Interactive System Builder SHALL render a `RequirementCard` sub-component for each entry in `kb.functional_requirements`, showing id, name, description, and acceptance criteria count.
11. THE Interactive System Builder SHALL display a per-section depth breakdown bar showing the section's contribution to the overall Depth Score V2.
12. ALL Interactive System Builder styles SHALL use inline style objects; no Tailwind utility classes shall be used.
13. WHEN the AI generates a response referencing a specific KB section, THE Interactive System Builder SHALL scroll that section into view automatically.

---

### Requirement 10: Inline Editing in Interactive System Builder

**User Story:** As a user, I want to directly edit KB fields within the Interactive System Builder panel, so that I can correct or refine captured data without re-entering the chat.

#### Acceptance Criteria

1. WHEN a user clicks on a text field within any card in the Interactive System Builder, THE Platform SHALL render an inline text input or textarea in place of the display value.
2. WHEN a user presses Enter or clicks away from an inline input, THE Platform SHALL save the updated value to the KB state and persist it to Supabase.
3. WHEN a user clears an inline input and saves, THE Platform SHALL remove that item from its parent array.
4. THE inline editing behavior SHALL be consistent with the existing `EditableText` and `EditableList` components in `src/components/document/DocumentPreview.tsx`.
5. WHEN an inline edit is saved, THE Platform SHALL recompute the Depth Score V2 and update the header metrics without a full page reload.

---

### Requirement 11: PSB Document Generator

**User Story:** As a user, I want to generate a single unified Product System Blueprint document from my completed KB, so that I have one authoritative artifact covering business requirements, system specification, diagrams, and architecture.

#### Acceptance Criteria

1. THE PSB Document Generator SHALL produce a document with exactly the following 19 sections in order: Executive Summary, Problem Statement, Business Objectives, Stakeholders, AS-IS Process, TO-BE Process, Key Improvements, Use Cases, Process Flow, Functional Requirements, Business Rules, Data Model (ERD), System Architecture, API Design, UI/UX Guidelines, Security Considerations, Performance Requirements, Risk Register, and Implementation Roadmap.
2. THE PSB Document Generator SHALL be implemented as a `generatePSB(kb: KnowledgeBaseV2, projectName: string): string` function in `src/lib/ai/bpmn.ts` that returns a Markdown string.
3. WHEN `data_model.entities` is non-empty, THE PSB Document Generator SHALL embed the ERD Mermaid diagram in the Data Model section.
4. WHEN `process_flow` is non-empty, THE PSB Document Generator SHALL embed the BPMN Mermaid flowchart in the Process Flow section.
5. WHEN `use_cases.normal` is non-empty, THE PSB Document Generator SHALL embed the UML Sequence Diagram in the Use Cases section.
6. THE PSB Document Generator SHALL include a document header with: project name, generation date, document type label "Product System Blueprint (PSB)", completion %, and depth score.
7. WHEN a KB section is empty, THE PSB Document Generator SHALL render a `*(Not yet defined)*` placeholder for that section rather than omitting the section heading.
8. THE `/api/brd` route SHALL be updated to call `generatePSB()` when the project's KB is version 2, and SHALL continue to call the existing `generateUSD()` function when the KB is version 1.
9. THE `/api/pdf` route SHALL continue to function without modification; it SHALL render the PSB Markdown output via the existing print-to-PDF HTML page.
10. THE PSB Document Generator SHALL include a Risk Register section populated from `business_rules` entries that contain conditional logic, formatted as a table with columns: Risk, Condition, Mitigation.
11. THE PSB Document Generator SHALL include an Implementation Roadmap section that groups `functional_requirements` into phases (Phase 1: Core, Phase 2: Extended, Phase 3: Advanced) based on their position in the array.

---

### Requirement 12: PSB Prompt (AI Mode)

**User Story:** As a platform developer, I want the AI system prompt to instruct the model to generate a full PSB from the KB, so that the AI-assisted document output is comprehensive and consulting-grade.

#### Acceptance Criteria

1. THE Platform SHALL implement a `buildPSBPrompt(kb: KnowledgeBaseV2, projectName: string): string` function in `src/lib/ai/prompt.ts` that constructs a prompt instructing the AI to generate a PSB document.
2. WHEN `buildPSBPrompt` is called, THE Platform SHALL include the full serialized KB V2 as context in the prompt.
3. THE PSB prompt SHALL instruct the AI to produce output in the 19-section PSB format defined in Requirement 11.
4. THE PSB prompt SHALL instruct the AI to infer reasonable content for any empty KB sections based on the context of populated sections, rather than leaving them blank.
5. THE Platform SHALL expose `buildPSBPrompt` via the `/api/brd` route when the request includes a `mode=psb` query parameter.

---

### Requirement 13: Guided Mode Compatibility

**User Story:** As a platform operator, I want all new features to work when `USE_AI=false`, so that the platform remains fully functional without an AI API key.

#### Acceptance Criteria

1. WHEN `USE_AI=false`, THE Platform SHALL use deterministic question selection from the Question Strategy Engine rather than calling an AI API.
2. WHEN `USE_AI=false`, THE Anti-Shallow Guard SHALL apply the same blocking rules as in AI mode.
3. WHEN `USE_AI=false`, THE BPMN Generator, UML Generator, and ERD Generator SHALL produce diagrams from KB data without any AI API calls.
4. WHEN `USE_AI=false`, THE PSB Document Generator SHALL produce the full 19-section PSB document from KB data without any AI API calls.
5. THE `src/lib/ai/guided.ts` module SHALL be updated to produce KB V2 structured data (not flat strings) when operating in guided mode.

---

### Requirement 14: Backward Compatibility — Existing KB Data

**User Story:** As an existing user, I want my previously created projects to continue working after the upgrade, so that I do not lose any work.

#### Acceptance Criteria

1. THE Platform SHALL implement a `migrateKBV1toV2(kb: KnowledgeBase): KnowledgeBaseV2` function in `src/lib/ai/extract.ts` that maps all flat MVP KB fields to their KB V2 equivalents.
2. WHEN migrating a flat `actors` array (with `name`, `role`, `responsibility` fields) to KB V2, THE Migration Function SHALL map `role` to `description` and `responsibility` to the first entry in `goals[]`.
3. WHEN migrating a flat `process_flow` string array to KB V2, THE Migration Function SHALL convert each string to a structured `{id, actor, action, system, next}` object, using the string as the `action` field and generating sequential `id` values.
4. WHEN migrating flat `functional_requirements` strings to KB V2, THE Migration Function SHALL convert each string to `{id, name, description, acceptance_criteria: []}`.
5. WHEN migrating flat `business_rules` strings to KB V2, THE Migration Function SHALL convert each string to `{id, condition: string, action: string}` by splitting on the first occurrence of "THEN" (case-insensitive) if present, otherwise placing the full string in `condition`.
6. WHEN migrating flat `problem`, `affected_who`, and `problem_why` fields to KB V2, THE Migration Function SHALL map them to `business.problem`, `business.stakeholders`, and `business.objectives` respectively.
7. FOR ALL valid flat KB V1 objects, migrating to KB V2 and back to V1 SHALL produce an object semantically equivalent to the original (round-trip property).

---

### Requirement 15: Chat API V2 Integration

**User Story:** As a platform developer, I want the chat API to produce and consume KB V2 data, so that all new AI questioning and extraction logic operates on the structured schema.

#### Acceptance Criteria

1. THE `/api/chat` route SHALL detect the KB version from the `knowledge_bases.kb_version` column and route to the appropriate extraction logic.
2. WHEN processing a KB V2 project, THE `/api/chat` route SHALL call updated extraction functions that populate KB V2 fields rather than flat arrays.
3. THE chat API response SHALL include a `kb_version` field indicating which schema version was used.
4. WHEN the chat API saves an updated KB to Supabase, THE Platform SHALL also update the `depth_score` and `completion_score` columns in `knowledge_bases`.
5. THE chat API SHALL include the `guard_triggered` boolean field in every response, set to `true` when the Anti-Shallow Guard blocked stage advancement.
6. THE existing `ChatResponse` TypeScript type SHALL be extended (not replaced) to include `kb_version`, `guard_triggered`, and an optional `depth_breakdown` field.

---

### Requirement 16: Document Preview V2

**User Story:** As a user, I want the Document Preview panel to render the full 19-section PSB when my project uses KB V2, so that I can review and edit the complete blueprint before downloading.

#### Acceptance Criteria

1. WHEN a project uses KB V2, THE Document Preview SHALL render the 19-section PSB layout instead of the current 6-section BRD+SRS layout.
2. THE Document Preview V2 SHALL preserve all existing inline editing capabilities from the current `DocumentPreview` component.
3. THE Document Preview V2 SHALL render the embedded Mermaid diagrams (BPMN, UML, ERD) using the existing `MermaidDiagram` component.
4. THE Document Preview V2 header SHALL display the PSB document title, generation date, completion %, and depth score.
5. WHEN a project uses KB V1, THE Document Preview SHALL continue to render the existing 6-section BRD+SRS layout without modification.
6. THE Document Preview V2 SHALL use inline styles exclusively, consistent with the existing codebase.

---

### Requirement 17: Performance and Reliability

**User Story:** As a user, I want the platform to remain responsive during KB updates and document generation, so that I am not blocked waiting for slow operations.

#### Acceptance Criteria

1. WHEN the Depth Score V2 is recomputed after a chat turn, THE Platform SHALL complete the computation within 50ms for any KB V2 object with up to 100 items per section.
2. WHEN the PSB Document Generator produces a document, THE Platform SHALL complete generation within 500ms for any KB V2 object with up to 100 items per section (excluding AI API call time).
3. WHEN the BPMN, UML, or ERD generators produce diagrams, THE Platform SHALL complete generation within 100ms for any KB V2 object with up to 50 items per section.
4. WHEN a Supabase write fails during KB persistence, THE Platform SHALL retain the updated KB in React state and display an error indicator, rather than reverting the UI to the previous state.
5. WHEN the chat API returns an error, THE Platform SHALL display the error message in the chat UI and allow the user to retry without losing their input.

---

### Requirement 18: Type Safety and Code Quality

**User Story:** As a platform developer, I want all new code to be fully typed and consistent with the existing codebase conventions, so that the upgrade does not introduce runtime errors or style inconsistencies.

#### Acceptance Criteria

1. THE Platform SHALL define all new types in `src/lib/types.ts` and export them for use across the codebase.
2. ALL new TypeScript code SHALL compile without errors under the existing `tsconfig.json` configuration.
3. ALL new React components SHALL use inline style objects; no Tailwind utility classes shall be introduced in application pages or components.
4. THE Platform SHALL not introduce any new npm dependencies without explicit justification; all diagram generation SHALL use the existing Mermaid integration.
5. ALL new functions that transform KB data SHALL be pure functions with no side effects, enabling deterministic unit testing.
6. THE Platform SHALL not modify the Supabase RLS policies defined in `supabase/schema.sql`; the migration file SHALL only add columns and indexes.

Gas. Ini gue langsung **inject improvement ke requirement doc lu** tanpa ngerusak struktur existing — jadi tinggal copas & replace/add.

Gue tandain sebagai **NEW REQUIREMENTS (16–22)** + sedikit refinement biar konsisten sama existing spec.

---

# 🔥 **ADDENDUM — Critical System Upgrades (V2.1)**

---

## **Requirement 19: Source of Truth Enforcement (Deterministic Integrity Layer)**

**User Story:**
As a platform architect, I want all generated outputs to strictly originate from the Knowledge Base, so that the system remains deterministic and audit-safe.

### Acceptance Criteria

1. THE Platform SHALL enforce that all generated PSB content is traceable to specific KB nodes.
2. THE Platform SHALL NOT allow the AI to introduce new entities, actors, rules, or requirements that do not exist in the KB.
3. THE Platform SHALL allow AI to enhance wording, formatting, and clarity ONLY, without altering semantic meaning.
4. THE Platform SHALL include internal references (metadata, not UI-visible) linking PSB sections to KB sources.
5. WHEN AI mode is used, THE Platform SHALL validate AI output against KB before rendering.
6. IF AI output contains data not present in KB, THE Platform SHALL discard or correct it before returning response.

---

## **Requirement 20: Advanced Conflict Resolution Engine**

**User Story:**
As a user, I want the system to intelligently detect, classify, and track conflicts, so that inconsistencies are resolved systematically.

### Acceptance Criteria

1. THE Platform SHALL classify conflicts into:

   * Logical Conflict
   * Role Conflict
   * Process Conflict
   * Rule Conflict
2. THE Platform SHALL detect conflict when:

   * Same actor + conflicting action
   * Same condition + different outcomes
3. WHEN conflict is detected:

   * THE Platform SHALL pause progression
   * THE Platform SHALL inject a clarification question
4. THE Platform SHALL store conflict entries in KB:

```
conflicts: [
  {
    id,
    type,
    description,
    related_nodes[],
    status: "unresolved" | "resolved",
    resolution_note
  }
]
```

5. THE Platform SHALL track resolution history for audit purposes.
6. THE Platform SHALL prevent document generation if unresolved conflicts exist.

---

## **Requirement 21: Knowledge Base Versioning & Audit Trail**

**User Story:**
As a system owner, I want version control over KB changes, so that I can track, compare, and rollback system evolution.

### Acceptance Criteria

1. THE Platform SHALL create a version snapshot of KB on:

   * Every 5 updates OR
   * Stage completion
2. THE Platform SHALL store snapshots in:
   `knowledge_base_versions` table
3. EACH snapshot SHALL contain:

   * version number
   * timestamp
   * full KB JSON
4. THE Platform SHALL support rollback to previous versions.
5. THE Platform SHALL generate diff logs between versions.
6. THE Platform SHALL maintain audit trail:

   * who changed
   * what changed
   * when changed

---

## **Requirement 22: Intelligent Diagram Generation Engine**

**User Story:**
As a user, I want diagrams that reflect real business logic, not just linear flows.

### Acceptance Criteria

### BPMN Enhancements

1. THE BPMN Generator SHALL detect:

   * decision nodes (if/else)
   * parallel flows
2. THE BPMN Generator SHALL render:

   * gateways for branching
   * merge points
3. THE BPMN Generator SHALL infer decision points from:

   * business_rules
   * conditional actions

### UML Enhancements

4. THE UML Generator SHALL support:

   * synchronous vs asynchronous calls
   * system boundaries
5. THE UML Generator SHALL differentiate:

   * user → system
   * system → database
   * system → external API

---

## **Requirement 23: Depth Scoring V3 (Quality + Quantity Hybrid)**

**User Story:**
As a user, I want depth score to reflect real quality, not just amount of data.

### Acceptance Criteria

1. THE Platform SHALL compute Depth Score using:

   * Quantity Score (existing)
   * Semantic Quality Score (NEW)
2. THE Semantic Score SHALL evaluate:

   * clarity (is it understandable)
   * specificity (not vague)
   * completeness (covers edge cases)
3. THE Platform SHALL compute:

```
final_depth = (quantity_score * 0.6) + (semantic_score * 0.4)
```

4. THE Platform SHALL prevent score inflation from duplicate or low-quality entries.
5. THE Platform SHALL expose per-section quality scoring.

---

## **Requirement 24: Insight & Recommendation Engine**

**User Story:**
As a user, I want the system to act like a consultant, not just a recorder.

### Acceptance Criteria

1. THE Platform SHALL generate insights per KB section:

   * missing elements
   * potential risks
   * improvement suggestions
2. THE Platform SHALL generate:

   * optimization recommendations
   * simplification suggestions
3. THE Platform SHALL display insights:

   * inline in UI
   * optionally in PSB document
4. THE Platform SHALL NOT modify KB automatically based on insights.

---

## **Requirement 25: Progressive UX & Focus Mode**

**User Story:**
As a user, I want a clean and focused interface to avoid overload.

### Acceptance Criteria

1. THE UI SHALL progressively reveal sections based on stage.
2. THE UI SHALL support Focus Mode:

   * show only active section
3. THE UI SHALL collapse completed sections by default.
4. THE UI SHALL highlight missing or weak sections.

---

## **Requirement 26: Project Initialization Intelligence**

**User Story:**
As a user, I want the system to understand my project instantly from initial input.

### Acceptance Criteria

1. WHEN user submits initial project description:

   * THE Platform SHALL extract:

     * problem
     * actors
     * initial process hints
2. THE Platform SHALL auto-populate KB before chat starts.
3. THE Platform SHALL display extracted data for confirmation/edit.
4. THE Platform SHALL allow file input:

   * text
   * image (future OCR)

---

## **Requirement 27: Reusable Knowledge Patterns (Future-Ready)**

**User Story:**
As a user, I want to reuse knowledge across projects.

### Acceptance Criteria

1. THE Platform SHALL allow saving KB as reusable templates.
2. THE Platform SHALL allow initializing new projects from templates.
3. THE Platform SHALL support pattern suggestions (future AI feature).

---

# 🔥 **SMALL BUT IMPORTANT PATCHES (Modify Existing)**

---

### 🔧 Update Requirement 11 (PSB Generator)

ADD:

```
11. THE PSB SHALL include a "Insights & Recommendations" section at the end.

12. THE PSB SHALL include traceability metadata (hidden or appendix).
```

---

### 🔧 Update Requirement 15 (Chat API)

ADD:

```
7. THE chat API SHALL validate AI outputs against KB (source-of-truth enforcement).
```

---

### 🔧 Update Requirement 17 (Performance)

ADD:

```
6. AI validation layer SHALL not exceed 100ms processing overhead.
```
