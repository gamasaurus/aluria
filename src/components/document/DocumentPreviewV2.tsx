'use client'
import { useState } from 'react'
import type { KnowledgeBaseV2, FunctionalRequirement, BusinessRule } from '@/lib/types'
import { calculateDepthV2, computeProgressV2 } from '@/lib/ai/depth'
import { generateBPMNFromV2, generateUMLSequence, generateERD } from '@/lib/ai/bpmn'
import MermaidDiagram from '@/components/document/MermaidDiagram'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractMermaid(diagramStr: string): string {
  const match = diagramStr.match(new RegExp('```mermaid\\n([\\s\\S]*?)```'))
  return match ? match[1].trim() : ""
}

// ─── EditableText ────────────────────────────────────────────────────────────

function EditableText({
  value,
  onSave,
  placeholder = "(not yet defined)",
  multiline = false,
}: {
  value: string
  onSave: (v: string) => void
  placeholder?: string
  multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function commit() {
    setEditing(false)
    if (draft.trim() !== value) onSave(draft.trim())
  }

  if (editing) {
    return multiline ? (
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        rows={4}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid var(--accent)",
          background: "var(--bg)",
          color: "var(--text-primary)",
          fontSize: 14,
          lineHeight: 1.6,
          resize: "vertical",
          outline: "none",
          fontFamily: "inherit",
        }}
      />
    ) : (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        style={{
          width: "100%",
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid var(--accent)",
          background: "var(--bg)",
          color: "var(--text-primary)",
          fontSize: 14,
          outline: "none",
          fontFamily: "inherit",
        }}
      />
    )
  }

  return (
    <div
      onClick={() => { setDraft(value); setEditing(true) }}
      title="Click to edit"
      style={{
        cursor: "text",
        padding: "6px 10px",
        borderRadius: 8,
        border: "1px dashed transparent",
        color: value ? "var(--text-primary)" : "var(--text-subtle)",
        fontSize: 14,
        lineHeight: 1.6,
        transition: "border-color 0.15s, background 0.15s",
        whiteSpace: "pre-wrap",
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-strong)"
        ;(e.currentTarget as HTMLDivElement).style.background = "var(--surface-hover)"
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = "transparent"
        ;(e.currentTarget as HTMLDivElement).style.background = "transparent"
      }}
    >
      {value || placeholder}
    </div>
  )
}

// ─── EditableList ────────────────────────────────────────────────────────────

function EditableList({
  items,
  onSave,
  placeholder = "(none yet)",
}: {
  items: string[]
  onSave: (items: string[]) => void
  placeholder?: string
}) {
  function updateItem(i: number, val: string) {
    const next = [...items]
    if (val.trim() === "") {
      next.splice(i, 1)
    } else {
      next[i] = val.trim()
    }
    onSave(next)
  }

  if (items.length === 0) {
    return <div style={{ color: "var(--text-subtle)", fontSize: 13, padding: "4px 10px" }}>{placeholder}</div>
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
          <span style={{ color: "var(--text-muted)", fontSize: 13, paddingTop: 7, minWidth: 16 }}>•</span>
          <div style={{ flex: 1 }}>
            <EditableText value={item} onSave={(v) => updateItem(i, v)} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({
  id,
  num,
  title,
  badge,
  children,
}: {
  id?: string
  num: number
  title: string
  badge?: string | number
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      style={{
        marginBottom: 32,
        paddingBottom: 24,
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--accent)",
          background: "var(--accent-light)",
          borderRadius: 6,
          padding: "2px 7px",
          minWidth: 24,
          textAlign: "center",
        }}>{num}</span>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{title}</h2>
        {badge !== undefined && (
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 999,
            background: "var(--accent-light)",
            color: "var(--accent)",
          }}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </section>
  )
}

// ─── Sub-label ───────────────────────────────────────────────────────────────

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.05em" }}>
      {children}
    </div>
  )
}

// ─── Table helpers ───────────────────────────────────────────────────────────

const TH_STYLE: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  fontWeight: 700,
  color: "var(--text-muted)",
  fontSize: 11,
  borderBottom: "1px solid var(--border)",
  background: "var(--bg)",
}

const TD_STYLE: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 13,
  color: "var(--text-secondary)",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "top",
}

const TABLE_STYLE: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
}

const EMPTY: React.CSSProperties = {
  color: "var(--text-subtle)",
  fontSize: 13,
  fontStyle: "italic",
  padding: "4px 10px",
}

// ─── PSB section nav list ─────────────────────────────────────────────────────

const PSB_SECTIONS = [
  { id: "executive-summary",       num: 1,  label: "Executive Summary" },
  { id: "problem-statement",       num: 2,  label: "Problem Statement" },
  { id: "business-objectives",     num: 3,  label: "Business Objectives" },
  { id: "stakeholders",            num: 4,  label: "Stakeholders" },
  { id: "as-is-process",           num: 5,  label: "AS-IS Process" },
  { id: "to-be-process",           num: 6,  label: "TO-BE Process" },
  { id: "key-improvements",        num: 7,  label: "Key Improvements" },
  { id: "use-cases",               num: 8,  label: "Use Cases" },
  { id: "process-flow",            num: 9,  label: "Process Flow" },
  { id: "functional-requirements", num: 10, label: "Functional Req." },
  { id: "business-rules",          num: 11, label: "Business Rules" },
  { id: "data-model",              num: 12, label: "Data Model" },
  { id: "system-architecture",     num: 13, label: "System Architecture" },
  { id: "api-design",              num: 14, label: "API Design" },
  { id: "ux-guidelines",           num: 15, label: "UI/UX Guidelines" },
  { id: "security",                num: 16, label: "Security" },
  { id: "performance",             num: 17, label: "Performance" },
  { id: "risk-register",           num: 18, label: "Risk Register" },
  { id: "roadmap",                 num: 19, label: "Roadmap" },
] as const

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  kb: KnowledgeBaseV2
  projectName: string
  onKBUpdate: (kb: KnowledgeBaseV2) => void
  onBackToChat: () => void
  onDownload: () => void
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function DocumentPreviewV2({ kb, projectName, onKBUpdate, onBackToChat, onDownload }: Props) {
  // Normalize KB to prevent crashes from partially-migrated objects
  kb = {
    business: { problem: kb?.business?.problem ?? '', objectives: kb?.business?.objectives ?? [], success_metrics: kb?.business?.success_metrics ?? [], stakeholders: kb?.business?.stakeholders ?? [] },
    actors: kb?.actors ?? [],
    use_cases: { normal: kb?.use_cases?.normal ?? [], edge: kb?.use_cases?.edge ?? [] },
    process_flow: kb?.process_flow ?? [],
    functional_requirements: kb?.functional_requirements ?? [],
    business_rules: kb?.business_rules ?? [],
    data_model: { entities: kb?.data_model?.entities ?? [], relationships: kb?.data_model?.relationships ?? [] },
    system_design: { architecture: { frontend: kb?.system_design?.architecture?.frontend ?? '', backend: kb?.system_design?.architecture?.backend ?? '', database: kb?.system_design?.architecture?.database ?? '', ai_layer: kb?.system_design?.architecture?.ai_layer ?? '' }, api_endpoints: kb?.system_design?.api_endpoints ?? [] },
    ux: { user_flow: kb?.ux?.user_flow ?? [], screens: kb?.ux?.screens ?? [] },
    completion: { score: kb?.completion?.score ?? 0, depth: kb?.completion?.depth ?? 0, prompt_version: kb?.completion?.prompt_version ?? 2 },
  }
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
  const completion = Math.round(computeProgressV2(kb) * 100)
  const depth = calculateDepthV2(kb)
  const [generating, setGenerating] = useState(false)
  const [activeNav, setActiveNav] = useState<string>("executive-summary")

  // Diagram strings (computed once per render)
  const bpmnStr = generateBPMNFromV2(kb)
  const umlStr = generateUMLSequence(kb)
  const erdStr = generateERD(kb)
  const bpmnChart = bpmnStr ? extractMermaid(bpmnStr) : ""
  const umlChart = umlStr ? extractMermaid(umlStr) : ""
  const erdChart = erdStr ? extractMermaid(erdStr) : ""

  function update(patch: Partial<KnowledgeBaseV2>) {
    onKBUpdate({ ...kb, ...patch })
  }

  function updateBusiness(patch: Partial<KnowledgeBaseV2["business"]>) {
    onKBUpdate({ ...kb, business: { ...kb.business, ...patch } })
  }

  // Export handlers
  async function handleExportMarkdown() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/brd?project_id=${encodeURIComponent(projectName)}`)
      const data = await res.json()
      const content = data.brd ?? ''
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'psb.md'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // Fallback: generate locally
      const { generatePSB } = await import('@/lib/ai/bpmn')
      const content = generatePSB(kb, projectName)
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'psb.md'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setGenerating(false)
    }
  }

  function handleExportJSON() {
    const content = JSON.stringify(kb, null, 2)
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'kb.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Security rules filter
  const securityRules = kb.business_rules.filter((r: BusinessRule) =>
    /\b(auth|permission|access|role|secure|encrypt|password|token|login|admin)\b/i.test(r.condition + " " + r.action)
  )

  // Risk rules filter
  const riskRules = kb.business_rules.filter((r: BusinessRule) =>
    /\b(IF|WHEN|UNLESS|IF NOT)\b/i.test(r.condition)
  )

  // Roadmap phases
  const total = kb.functional_requirements.length
  const third = Math.ceil(total / 3)
  const phase1 = kb.functional_requirements.slice(0, third)
  const phase2 = kb.functional_requirements.slice(third, third * 2)
  const phase3 = kb.functional_requirements.slice(third * 2)

  const arch = kb.system_design.architecture

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "calc(100vh - 32px)",
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      overflow: "hidden",
      position: "relative",
    }}>
      {/* ── Fixed Header ── */}
      <div style={{
        padding: "14px 20px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexShrink: 0,
        background: "var(--surface)",
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>
            Product System Blueprint — {projectName}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            Generated {date} &nbsp;·&nbsp; Completion: <strong>{completion}%</strong> &nbsp;·&nbsp; Depth Score: <strong>{depth}/100</strong>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            onClick={onBackToChat}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid var(--border-strong)",
              background: "var(--bg)",
              color: "var(--text-secondary)",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            ← Back to Chat
          </button>
          <button
            onClick={handleExportMarkdown}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid var(--border-strong)",
              background: "var(--bg)",
              color: "var(--text-secondary)",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            ↓ Markdown
          </button>
          <button
            disabled
            title="Coming soon"
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--text-subtle)",
              fontWeight: 600,
              fontSize: 13,
              cursor: "not-allowed",
              opacity: 0.5,
            }}
          >
            ↓ .docx (coming soon)
          </button>
          <button
            onClick={onDownload}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              background: "var(--accent)",
              color: "white",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            ↓ PDF
          </button>
        </div>
      </div>

      {/* ── Body: Nav sidebar + Scrollable content ── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>

        {/* Left nav */}
        <div style={{
          width: 180,
          flexShrink: 0,
          borderRight: "1px solid var(--border)",
          background: "var(--surface)",
          overflow: "auto",
          padding: "12px 0",
        }}>
          {PSB_SECTIONS.map(({ id, num, label }) => {
            const isActive = activeNav === id
            return (
              <button
                key={id}
                onClick={() => {
                  setActiveNav(id)
                  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "7px 14px",
                  border: "none",
                  borderLeft: isActive ? "3px solid var(--accent)" : "3px solid transparent",
                  background: isActive ? "var(--accent-light)" : "transparent",
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 12,
                  cursor: "pointer",
                  textAlign: "left",
                  lineHeight: 1.3,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? "var(--accent)" : "var(--text-muted)", minWidth: 16, flexShrink: 0 }}>{num}</span>
                <span>{label}</span>
              </button>
            )
          })}
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflow: "auto", padding: "28px 32px" }}>
        {/* 1. Executive Summary */}
        <Section num={1} id="executive-summary" title="Executive Summary">
          {kb.business.problem ? (
            <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)", margin: 0 }}>
              {kb.business.problem}
            </p>
          ) : (
            <div style={EMPTY}>*(Not yet defined)*</div>
          )}
        </Section>

        {/* 2. Problem Statement */}
        <Section num={2} id="problem-statement" title="Problem Statement">
          <EditableText
            value={kb.business.problem}
            onSave={(v) => updateBusiness({ problem: v })}
            placeholder="(not yet defined — click to edit)"
            multiline
          />
        </Section>

        {/* 3. Business Objectives */}
        <Section num={3} id="business-objectives" title="Business Objectives" badge={kb.business.objectives.length}>
          <EditableList
            items={kb.business.objectives}
            onSave={(v) => updateBusiness({ objectives: v })}
            placeholder="*(Not yet defined)*"
          />
        </Section>

        {/* 4. Stakeholders */}
        <Section num={4} id="stakeholders" title="Stakeholders" badge={kb.business.stakeholders.length}>
          {kb.business.stakeholders.length === 0 ? (
            <div style={EMPTY}>*(Not yet defined)*</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {kb.business.stakeholders.map((s, i) => (
                <div key={i} style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", marginBottom: 6 }}>{s.name}</div>
                  {s.goals.length > 0 && (
                    <div style={{ marginBottom: 4 }}>
                      <SubLabel>GOALS</SubLabel>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                        {s.goals.map((g, j) => <li key={j}>{g}</li>)}
                      </ul>
                    </div>
                  )}
                  {s.pain_points.length > 0 && (
                    <div>
                      <SubLabel>PAIN POINTS</SubLabel>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                        {s.pain_points.map((p, j) => <li key={j}>{p}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
        {/* 5. AS-IS Process */}
        <Section num={5} id="as-is-process" title="AS-IS Process" badge={kb.process_flow.length}>
          {kb.process_flow.length === 0 ? (
            <div style={EMPTY}>*(Not yet defined)*</div>
          ) : (
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
              {kb.process_flow.map((step, i) => (
                <li key={i}><strong>{step.actor || "System"}:</strong> {step.action}</li>
              ))}
            </ol>
          )}
        </Section>

        {/* 6. TO-BE Process */}
        <Section num={6} id="to-be-process" title="TO-BE Process" badge={kb.process_flow.length}>
          {kb.process_flow.length === 0 ? (
            <div style={EMPTY}>*(Not yet defined)*</div>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 0, marginBottom: 10 }}>
                Improved process flow with system automation:
              </p>
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
                {kb.process_flow.map((step, i) => (
                  <li key={i}>
                    <strong>{step.actor || "System"}:</strong> {step.action}
                    {step.system && (
                      <em style={{ color: "var(--text-muted)", marginLeft: 6 }}>(System: {step.system})</em>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}
        </Section>

        {/* 7. Key Improvements */}
        <Section num={7} id="key-improvements" title="Key Improvements" badge={kb.business.objectives.length}>
          {kb.business.objectives.length === 0 ? (
            <div style={EMPTY}>*(Not yet defined)*</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
              {kb.business.objectives.map((o, i) => <li key={i}>{o}</li>)}
            </ul>
          )}
        </Section>
        {/* 8. Use Cases */}
        <Section num={8} id="use-cases" title="Use Cases" badge={kb.use_cases.normal.length + kb.use_cases.edge.length}>
          {kb.use_cases.normal.length === 0 && kb.use_cases.edge.length === 0 ? (
            <div style={EMPTY}>*(Not yet defined)*</div>
          ) : (
            <>
              {kb.use_cases.normal.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <SubLabel>NORMAL USE CASES</SubLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {kb.use_cases.normal.map((uc, i) => (
                      <div key={i} style={{
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--bg)",
                      }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>{uc.title}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>Actor: {uc.actor}</div>
                        {uc.steps.length > 0 && (
                          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                            {uc.steps.map((s, j) => <li key={j}>{s}</li>)}
                          </ol>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {umlChart && (
                <div style={{ marginBottom: 16 }}>
                  <SubLabel>UML SEQUENCE DIAGRAM</SubLabel>
                  <MermaidDiagram chart={umlChart} />
                </div>
              )}
              {kb.use_cases.edge.length > 0 && (
                <div>
                  <SubLabel>EDGE CASES</SubLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {kb.use_cases.edge.map((uc, i) => (
                      <div key={i} style={{
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--bg)",
                      }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>{uc.title}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Condition: {uc.condition}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Response: {uc.system_response || "(not defined)"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </Section>
        {/* 9. Process Flow */}
        <Section num={9} id="process-flow" title="Process Flow" badge={kb.process_flow.length}>
          {kb.process_flow.length === 0 ? (
            <div style={EMPTY}>*(Not yet defined)*</div>
          ) : (
            <>
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: 16 }}>
                {kb.process_flow.map((step, i) => (
                  <li key={i}><strong>[{step.actor || "System"}]</strong> {step.action}</li>
                ))}
              </ol>
              {bpmnChart && (
                <>
                  <SubLabel>BPMN FLOWCHART</SubLabel>
                  <MermaidDiagram chart={bpmnChart} />
                </>
              )}
            </>
          )}
        </Section>

        {/* 10. Functional Requirements */}
        <Section num={10} id="functional-requirements" title="Functional Requirements" badge={kb.functional_requirements.length}>
          {kb.functional_requirements.length === 0 ? (
            <div style={EMPTY}>*(Not yet defined)*</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {kb.functional_requirements.map((req: FunctionalRequirement, i) => (
                <div key={i} style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--accent)",
                      background: "var(--accent-light)",
                      borderRadius: 6,
                      padding: "2px 8px",
                    }}>{req.id}</span>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{req.name}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 8px 0", lineHeight: 1.7 }}>
                    {req.description}
                  </p>
                  {(req.acceptance_criteria ?? []).length > 0 && (
                    <>
                      <SubLabel>ACCEPTANCE CRITERIA</SubLabel>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                        {(req.acceptance_criteria ?? []).map((ac, j) => <li key={j}>{ac}</li>)}
                      </ul>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
        {/* 11. Business Rules */}
        <Section num={11} id="business-rules" title="Business Rules" badge={kb.business_rules.length}>
          {kb.business_rules.length === 0 ? (
            <div style={EMPTY}>*(Not yet defined)*</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {kb.business_rules.map((rule: BusinessRule, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#D97706",
                    background: "#FEF3C7",
                    borderRadius: 6,
                    padding: "2px 8px",
                    marginTop: 4,
                    flexShrink: 0,
                    minWidth: 40,
                    textAlign: "center",
                  }}>{rule.id}</span>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, paddingTop: 4 }}>
                    <strong>IF</strong> {rule.condition} <strong>THEN</strong> {rule.action || "(action not defined)"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 12. Data Model (ERD) */}
        <Section num={12} id="data-model" title="Data Model (ERD)" badge={kb.data_model.entities.length}>
          {kb.data_model.entities.length === 0 ? (
            <div style={EMPTY}>*(Not yet defined)*</div>
          ) : (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                {kb.data_model.entities.map((entity, i) => (
                  <div key={i} style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    minWidth: 160,
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", marginBottom: 6 }}>{entity.name}</div>
                    {entity.fields.map((f, j) => (
                      <div key={j} style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
                        <span style={{ color: "var(--accent)", fontWeight: 600 }}>{f.type}</span> {f.name}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {erdChart && (
                <>
                  <SubLabel>ENTITY RELATIONSHIP DIAGRAM</SubLabel>
                  <MermaidDiagram chart={erdChart} />
                </>
              )}
            </>
          )}
        </Section>
        {/* 13. System Architecture */}
        <Section num={13} id="system-architecture" title="System Architecture">
          {!arch.frontend && !arch.backend && !arch.database && !arch.ai_layer ? (
            <div style={EMPTY}>*(Not yet defined)*</div>
          ) : (
            <table style={TABLE_STYLE}>
              <thead><tr>
                <th style={TH_STYLE}>Layer</th>
                <th style={TH_STYLE}>Technology</th>
              </tr></thead>
              <tbody>
                {arch.frontend && <tr><td style={{ ...TD_STYLE, fontWeight: 600, color: "var(--text-primary)" }}>Frontend</td><td style={TD_STYLE}>{arch.frontend}</td></tr>}
                {arch.backend && <tr><td style={{ ...TD_STYLE, fontWeight: 600, color: "var(--text-primary)" }}>Backend</td><td style={TD_STYLE}>{arch.backend}</td></tr>}
                {arch.database && <tr><td style={{ ...TD_STYLE, fontWeight: 600, color: "var(--text-primary)" }}>Database</td><td style={TD_STYLE}>{arch.database}</td></tr>}
                {arch.ai_layer && <tr><td style={{ ...TD_STYLE, fontWeight: 600, color: "var(--text-primary)" }}>AI Layer</td><td style={TD_STYLE}>{arch.ai_layer}</td></tr>}
              </tbody>
            </table>
          )}
        </Section>

        {/* 14. API Design */}
        <Section num={14} id="api-design" title="API Design" badge={kb.system_design.api_endpoints.length}>
          {kb.system_design.api_endpoints.length === 0 ? (
            <div style={EMPTY}>*(Not yet defined)*</div>
          ) : (
            <table style={TABLE_STYLE}>
              <thead><tr>
                <th style={TH_STYLE}>Method</th>
                <th style={TH_STYLE}>Path</th>
                <th style={TH_STYLE}>Description</th>
              </tr></thead>
              <tbody>
                {kb.system_design.api_endpoints.map((ep, i) => (
                  <tr key={i}>
                    <td style={TD_STYLE}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                        background: ep.method === "GET" ? "#DCFCE7" : ep.method === "POST" ? "#DBEAFE" : ep.method === "DELETE" ? "#FEE2E2" : "#FEF3C7",
                        color: ep.method === "GET" ? "#166534" : ep.method === "POST" ? "#1D4ED8" : ep.method === "DELETE" ? "#991B1B" : "#92400E",
                      }}>{ep.method}</span>
                    </td>
                    <td style={{ ...TD_STYLE, fontFamily: "monospace", fontSize: 12 }}>{ep.path}</td>
                    <td style={TD_STYLE}>{ep.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
        {/* 15. UI/UX Guidelines */}
        <Section num={15} id="ux-guidelines" title="UI/UX Guidelines">
          {kb.ux.user_flow.length === 0 && kb.ux.screens.length === 0 ? (
            <div style={EMPTY}>*(Not yet defined)*</div>
          ) : (
            <>
              {kb.ux.user_flow.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <SubLabel>USER FLOW</SubLabel>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
                    {kb.ux.user_flow.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}
              {kb.ux.screens.length > 0 && (
                <div>
                  <SubLabel>SCREENS</SubLabel>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {kb.ux.screens.map((s, i) => (
                      <span key={i} style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "var(--bg)",
                        fontSize: 12,
                        color: "var(--text-secondary)",
                      }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </Section>

        {/* 16. Security Considerations */}
        <Section num={16} id="security" title="Security Considerations">
          {securityRules.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
              {securityRules.map((r: BusinessRule, i) => (
                <li key={i}>IF {r.condition} THEN {r.action}</li>
              ))}
            </ul>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
              <li>All user data must be encrypted at rest and in transit</li>
              <li>Authentication required for all protected routes</li>
              <li>Role-based access control enforced at API layer</li>
            </ul>
          )}
        </Section>

        {/* 17. Performance Requirements */}
        <Section num={17} id="performance" title="Performance Requirements">
          <table style={TABLE_STYLE}>
            <thead><tr>
              <th style={TH_STYLE}>Metric</th>
              <th style={TH_STYLE}>Target</th>
            </tr></thead>
            <tbody>
              <tr><td style={{ ...TD_STYLE, fontWeight: 600, color: "var(--text-primary)" }}>API Response Time</td><td style={TD_STYLE}>&lt; 2 seconds</td></tr>
              <tr><td style={{ ...TD_STYLE, fontWeight: 600, color: "var(--text-primary)" }}>Availability</td><td style={TD_STYLE}>99.9% uptime</td></tr>
              <tr><td style={{ ...TD_STYLE, fontWeight: 600, color: "var(--text-primary)" }}>Concurrent Users</td><td style={TD_STYLE}>Scalable without degradation</td></tr>
            </tbody>
          </table>
        </Section>
        {/* 18. Risk Register */}
        <Section num={18} id="risk-register" title="Risk Register">
          {riskRules.length === 0 ? (
            <div style={EMPTY}>*(Not yet defined)*</div>
          ) : (
            <table style={TABLE_STYLE}>
              <thead><tr>
                <th style={TH_STYLE}>Risk</th>
                <th style={TH_STYLE}>Condition</th>
                <th style={TH_STYLE}>Mitigation</th>
              </tr></thead>
              <tbody>
                {riskRules.map((r: BusinessRule, i) => (
                  <tr key={i}>
                    <td style={{ ...TD_STYLE, fontWeight: 600, color: "var(--text-primary)" }}>{r.id}</td>
                    <td style={TD_STYLE}>{r.condition}</td>
                    <td style={TD_STYLE}>{r.action || "To be defined"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* 19. Implementation Roadmap */}
        <Section num={19} id="roadmap" title="Implementation Roadmap">
          {kb.functional_requirements.length === 0 ? (
            <div style={EMPTY}>*(Not yet defined)*</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { label: "Phase 1 — Core", items: phase1, color: "#166534", bg: "#DCFCE7" },
                { label: "Phase 2 — Extended", items: phase2, color: "#1D4ED8", bg: "#DBEAFE" },
                { label: "Phase 3 — Advanced", items: phase3, color: "#7C3AED", bg: "#EDE9FE" },
              ].filter(p => p.items.length > 0).map((phase, pi) => (
                <div key={pi} style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: phase.color,
                    background: phase.bg,
                    display: "inline-block",
                    padding: "2px 10px",
                    borderRadius: 6,
                    marginBottom: 8,
                  }}>{phase.label}</div>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
                    {phase.items.map((r: FunctionalRequirement, j) => (
                      <li key={j}><strong>{r.id}:</strong> {r.name}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Section>

        <div style={{ height: 40 }} />
      </div>
      </div>{/* end flex body */}

      {/* ── Generating overlay ── */}
      {generating && (
        <div style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.45)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          zIndex: 100,
          borderRadius: 12,
        }}>
          <style>{`
            @keyframes _psb_spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "4px solid rgba(255,255,255,0.25)",
            borderTopColor: "#ffffff",
            animation: "_psb_spin 0.75s linear infinite",
          }} />
          <span style={{
            color: "#ffffff",
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}>
            Generating PSB…
          </span>
        </div>
      )}
    </div>
  )
}