'use client'

import { useState } from 'react'
import type { KnowledgeBase, Actor } from '@/lib/types'
import { calculateDepth, computeProgress } from '@/lib/ai/depth'
import MermaidDiagram from '@/components/document/MermaidDiagram'

// ─── Mermaid BPMN diagram (inline, no external lib needed) ───────────────────

function generateMermaid(kb: KnowledgeBase): string {
  const steps = kb.process_flow
  if (steps.length === 0) return ''

  let diagram = 'flowchart TD\n'
  diagram += '  Start([▶ Start])\n'

  steps.forEach((step, i) => {
    const label = step.length > 40 ? step.substring(0, 40) + '…' : step
    const safe = label.replace(/"/g, "'").replace(/\[/g, '(').replace(/\]/g, ')')
    diagram += `  Step${i + 1}["${safe}"]\n`
  })

  kb.decision_points.forEach((d, i) => {
    const label = d.length > 35 ? d.substring(0, 35) + '…' : d
    const safe = label.replace(/"/g, "'")
    diagram += `  Dec${i + 1}{"${safe}"}\n`
  })

  diagram += '  End([■ End])\n'
  diagram += '  Start --> Step1\n'
  for (let i = 0; i < steps.length - 1; i++) {
    diagram += `  Step${i + 1} --> Step${i + 2}\n`
  }
  diagram += `  Step${steps.length} --> End\n`

  kb.decision_points.forEach((_, i) => {
    if (i < steps.length) {
      diagram += `  Step${i + 1} -.->|decision| Dec${i + 1}\n`
    }
  })

  return diagram
}

// ─── Inline-editable section ─────────────────────────────────────────────────

function EditableText({
  value,
  onSave,
  placeholder = '(not yet defined)',
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
          width: '100%',
          padding: '8px 10px',
          borderRadius: 8,
          border: '1px solid var(--accent)',
          background: 'var(--bg)',
          color: 'var(--text-primary)',
          fontSize: 14,
          lineHeight: 1.6,
          resize: 'vertical',
          outline: 'none',
          fontFamily: 'inherit',
        }}
      />
    ) : (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        style={{
          width: '100%',
          padding: '6px 10px',
          borderRadius: 8,
          border: '1px solid var(--accent)',
          background: 'var(--bg)',
          color: 'var(--text-primary)',
          fontSize: 14,
          outline: 'none',
          fontFamily: 'inherit',
        }}
      />
    )
  }

  return (
    <div
      onClick={() => { setDraft(value); setEditing(true) }}
      title="Click to edit"
      style={{
        cursor: 'text',
        padding: '6px 10px',
        borderRadius: 8,
        border: '1px dashed transparent',
        color: value ? 'var(--text-primary)' : 'var(--text-subtle)',
        fontSize: 14,
        lineHeight: 1.6,
        transition: 'border-color 0.15s, background 0.15s',
        whiteSpace: 'pre-wrap',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)'
        ;(e.currentTarget as HTMLDivElement).style.background = 'var(--surface-hover)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'
        ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
      }}
    >
      {value || placeholder}
    </div>
  )
}

function EditableList({
  items,
  onSave,
  placeholder = '(none yet)',
  renderItem,
}: {
  items: string[]
  onSave: (items: string[]) => void
  placeholder?: string
  renderItem?: (item: string, i: number) => React.ReactNode
}) {
  function updateItem(i: number, val: string) {
    const next = [...items]
    if (val.trim() === '') {
      next.splice(i, 1)
    } else {
      next[i] = val.trim()
    }
    onSave(next)
  }

  if (items.length === 0) {
    return <div style={{ color: 'var(--text-subtle)', fontSize: 13, padding: '4px 10px' }}>{placeholder}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 13, paddingTop: 7, minWidth: 16 }}>
            {renderItem ? null : '•'}
          </span>
          <div style={{ flex: 1 }}>
            <EditableText value={item} onSave={(v) => updateItem(i, v)} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  id,
  title,
  badge,
  children,
}: {
  id?: string
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
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h2>
        {badge !== undefined && (
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 999,
            background: 'var(--accent-light)',
            color: 'var(--accent)',
          }}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </section>
  )
}

// ─── Metrics bar ─────────────────────────────────────────────────────────────

function MetricsBar({ kb }: { kb: KnowledgeBase }) {
  const completion = Math.round(computeProgress(kb) * 100)
  const depth = calculateDepth(kb)

  return (
    <div style={{
      display: 'flex',
      gap: 24,
      padding: '12px 20px',
      background: 'var(--accent-light)',
      borderRadius: 10,
      marginBottom: 28,
      flexWrap: 'wrap',
    }}>
      <Metric label="Completion" value={`${completion}%`} color={completion >= 80 ? 'var(--success)' : 'var(--warning)'} />
      <Metric label="Depth" value={`${depth}/100`} color={depth >= 70 ? 'var(--success)' : 'var(--warning)'} />
      <Metric label="Actors" value={kb.actors.length} />
      <Metric label="Process Steps" value={kb.process_flow.length} />
      <Metric label="Requirements" value={kb.functional_requirements.length} />
      <Metric label="Business Rules" value={kb.business_rules.length} />
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color ?? 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}

// ─── Main DocumentPreview ─────────────────────────────────────────────────────

interface Props {
  kb: KnowledgeBase
  projectName: string
  onKBUpdate: (kb: KnowledgeBase) => void
  onBackToChat: () => void
  onDownload: () => void
}

export default function DocumentPreview({ kb, projectName, onKBUpdate, onBackToChat, onDownload }: Props) {
  const mermaid = generateMermaid(kb)

  function updateField<K extends keyof KnowledgeBase>(field: K, value: KnowledgeBase[K]) {
    onKBUpdate({ ...kb, [field]: value })
  }

  function updateActor(i: number, field: keyof Actor, value: string) {
    const next = kb.actors.map((a, idx) => idx === i ? { ...a, [field]: value } : a)
    updateField('actors', next)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 32px)',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
            {projectName}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Document Preview — BRD + SRS
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onBackToChat}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid var(--border-strong)',
              background: 'var(--bg)',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            ← Back to Chat
          </button>
          <button
            onClick={onDownload}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent)',
              color: 'white',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Download PRD
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>
        <MetricsBar kb={kb} />

        {/* 1. Executive Summary */}
        <Section id="executive-summary" title="1. Executive Summary">
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
              PROBLEM STATEMENT
            </div>
            <EditableText
              value={kb.problem}
              onSave={(v) => updateField('problem', v)}
              placeholder="(not yet defined — click to edit)"
              multiline
            />
          </div>

          {kb.affected_who.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                AFFECTED STAKEHOLDERS
              </div>
              <EditableList
                items={kb.affected_who}
                onSave={(v) => updateField('affected_who', v)}
              />
            </div>
          )}

          {kb.problem_why.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                BUSINESS IMPACT
              </div>
              <EditableList
                items={kb.problem_why}
                onSave={(v) => updateField('problem_why', v)}
              />
            </div>
          )}
        </Section>

        {/* 2. Actors & Roles */}
        <Section id="actors" title="2. Actors & Roles" badge={kb.actors.length}>
          {kb.actors.length === 0 ? (
            <div style={{ color: 'var(--text-subtle)', fontSize: 13 }}>(none yet)</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {kb.actors.map((actor, i) => (
                <div key={i} style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>NAME</div>
                      <EditableText value={actor.name} onSave={(v) => updateActor(i, 'name', v)} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>ROLE</div>
                      <EditableText value={actor.role} onSave={(v) => updateActor(i, 'role', v)} placeholder="(no role)" />
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>RESPONSIBILITY</div>
                    <EditableText value={actor.responsibility} onSave={(v) => updateActor(i, 'responsibility', v)} placeholder="(no responsibility)" multiline />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 3. Process Flow */}
        <Section id="process-flow" title="3. Process Flow" badge={kb.process_flow.length}>
          {kb.process_flow.length === 0 ? (
            <div style={{ color: 'var(--text-subtle)', fontSize: 13 }}>(none yet)</div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>MAIN STEPS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {kb.process_flow.map((step, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{
                        minWidth: 24, height: 24,
                        borderRadius: '50%',
                        background: 'var(--accent)',
                        color: 'white',
                        fontSize: 11,
                        fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginTop: 6, flexShrink: 0,
                      }}>
                        {i + 1}
                      </span>
                      <div style={{ flex: 1 }}>
                        <EditableText
                          value={step}
                          onSave={(v) => {
                            const next = [...kb.process_flow]
                            if (v === '') next.splice(i, 1)
                            else next[i] = v
                            updateField('process_flow', next)
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {kb.decision_points.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>DECISION POINTS</div>
                  <EditableList items={kb.decision_points} onSave={(v) => updateField('decision_points', v)} />
                </div>
              )}

              {kb.edge_cases.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>EDGE CASES / ERROR SCENARIOS</div>
                  <EditableList items={kb.edge_cases} onSave={(v) => updateField('edge_cases', v)} />
                </div>
              )}

              {/* BPMN Diagram */}
              {mermaid && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>PROCESS FLOW DIAGRAM</div>
                  <MermaidDiagram chart={mermaid} />
                </div>
              )}
            </>
          )}
        </Section>

        {/* 4. Functional Requirements */}
        <Section id="functional" title="4. Functional Requirements" badge={kb.functional_requirements.length}>
          {kb.functional_requirements.length === 0 ? (
            <div style={{ color: 'var(--text-subtle)', fontSize: 13 }}>(none yet)</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {kb.functional_requirements.map((req, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: 'var(--accent)',
                    padding: '4px 6px',
                    borderRadius: 4,
                    background: 'var(--accent-light)',
                    marginTop: 4,
                    flexShrink: 0,
                    minWidth: 40,
                    textAlign: 'center',
                  }}>
                    FR-{i + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <EditableText
                      value={req}
                      onSave={(v) => {
                        const next = [...kb.functional_requirements]
                        if (v === '') next.splice(i, 1)
                        else next[i] = v
                        updateField('functional_requirements', next)
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 5. Business Rules */}
        <Section id="business-rules" title="5. Business Rules" badge={kb.business_rules.length}>
          {kb.business_rules.length === 0 ? (
            <div style={{ color: 'var(--text-subtle)', fontSize: 13 }}>(none yet)</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {kb.business_rules.map((rule, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: '#D97706',
                    padding: '4px 6px',
                    borderRadius: 4,
                    background: '#FEF3C7',
                    marginTop: 4,
                    flexShrink: 0,
                    minWidth: 40,
                    textAlign: 'center',
                  }}>
                    BR-{i + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <EditableText
                      value={rule}
                      onSave={(v) => {
                        const next = [...kb.business_rules]
                        if (v === '') next.splice(i, 1)
                        else next[i] = v
                        updateField('business_rules', next)
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 6. System Specification (SRS) */}
        <Section id="srs" title="6. System Specification (SRS)">
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
              ROLES → PERMISSIONS
            </div>
            {kb.actors.length === 0 ? (
              <div style={{ color: 'var(--text-subtle)', fontSize: 13 }}>(no actors defined)</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    {['Role', 'Responsibility', 'System Access'].map((h) => (
                      <th key={h} style={{
                        padding: '8px 12px',
                        textAlign: 'left',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        fontSize: 11,
                        borderBottom: '1px solid var(--border)',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kb.actors.map((actor, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{actor.name}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{actor.role || '—'}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{actor.responsibility || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
              FLOW → SYSTEM BEHAVIOR
            </div>
            {kb.process_flow.length === 0 ? (
              <div style={{ color: 'var(--text-subtle)', fontSize: 13 }}>(no process defined)</div>
            ) : (
              <ol style={{ paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.8 }}>
                {kb.process_flow.map((step, i) => <li key={i}>{step}</li>)}
              </ol>
            )}
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
              FUNCTIONAL → MODULES
            </div>
            {kb.functional_requirements.length === 0 ? (
              <div style={{ color: 'var(--text-subtle)', fontSize: 13 }}>(no requirements defined)</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {kb.functional_requirements.map((req, i) => (
                  <span key={i} style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: 'var(--accent-light)',
                    color: 'var(--accent)',
                    fontSize: 12,
                    fontWeight: 600,
                  }}>
                    {req.length > 50 ? req.substring(0, 50) + '…' : req}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Section>

        <div style={{ height: 40 }} />
      </div>
    </div>
  )
}
