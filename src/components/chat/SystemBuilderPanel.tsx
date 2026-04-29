'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { KnowledgeBaseV2, ActorV2, ProcessFlowStep, FunctionalRequirement, BusinessRule, NormalUseCase, EdgeUseCase, Entity } from '@/lib/types'
import { calculateDepthV2, computeProgressV2, getDepthStatus, getDepthBreakdown } from '@/lib/ai/depth'
import { generateSuggestions, type Suggestion } from '@/lib/ai/quality'

interface SystemBuilderPanelProps {
  kb: KnowledgeBaseV2
  onKBUpdate: (kb: KnowledgeBaseV2) => void
  activeSection?: string
}

// ─── Shared inline-edit primitives ───────────────────────────────────────────

function EditableText({
  value,
  onSave,
  placeholder = '(click to edit)',
  multiline = false,
  style: extraStyle,
}: {
  value: string
  onSave: (v: string) => void
  placeholder?: string
  multiline?: boolean
  style?: React.CSSProperties
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function commit() {
    setEditing(false)
    onSave(draft.trim())
  }

  if (editing) {
    const base: React.CSSProperties = {
      width: '100%',
      padding: '6px 10px',
      borderRadius: 8,
      border: '1px solid var(--accent)',
      background: 'var(--bg)',
      color: 'var(--text-primary)',
      fontSize: 13,
      lineHeight: 1.6,
      outline: 'none',
      fontFamily: 'inherit',
      boxSizing: 'border-box',
      ...extraStyle,
    }
    return multiline ? (
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        rows={3}
        style={{ ...base, resize: 'vertical' }}
      />
    ) : (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        style={base}
      />
    )
  }

  return (
    <div
      onClick={() => { setDraft(value); setEditing(true) }}
      title="Click to edit"
      style={{
        cursor: 'text',
        padding: '5px 10px',
        borderRadius: 8,
        border: '1px dashed transparent',
        color: value ? 'var(--text-primary)' : 'var(--text-subtle)',
        fontSize: 13,
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
        transition: 'border-color 0.15s, background 0.15s',
        ...extraStyle,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'var(--border-strong)'
        el.style.background = 'var(--surface-hover, rgba(0,0,0,0.04))'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'transparent'
        el.style.background = 'transparent'
      }}
    >
      {value || placeholder}
    </div>
  )
}


// ─── 1. SystemBuilderHeader ───────────────────────────────────────────────────

function SystemBuilderHeader({ kb, saving }: { kb: KnowledgeBaseV2; saving?: boolean }) {
  const completion = Math.round(computeProgressV2(kb) * 100)
  const depth = calculateDepthV2(kb)
  const status = getDepthStatus(depth)

  const badgeColor =
    status === 'Ready' ? '#16A34A' :
    status === 'Moderate' ? '#D97706' :
    '#DC2626'

  const badgeBg =
    status === 'Ready' ? '#F0FDF4' :
    status === 'Moderate' ? '#FFFBEB' :
    '#FEF2F2'

  const badgeBorder =
    status === 'Ready' ? '#BBF7D0' :
    status === 'Moderate' ? '#FDE68A' :
    '#FECACA'

  return (
    <div style={{
      padding: '14px 16px',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      flexWrap: 'wrap',
      flexShrink: 0,
    }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>COMPLETION</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{completion}%</div>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>DEPTH SCORE</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{depth}/100</div>
      </div>
      <div style={{
        padding: '4px 12px',
        borderRadius: 999,
        border: `1px solid ${badgeBorder}`,
        background: badgeBg,
        color: badgeColor,
        fontWeight: 700,
        fontSize: 13,
        alignSelf: 'center',
      }}>
        {status}
      </div>
      {saving && (
        <div style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          fontStyle: 'italic',
          alignSelf: 'center',
          marginLeft: 'auto',
        }}>
          Saving…
        </div>
      )}
    </div>
  )
}

// ─── 2. SectionNavigator ─────────────────────────────────────────────────────

const SECTIONS = [
  { key: 'business',     label: 'Business' },
  { key: 'actors',       label: 'Actors' },
  { key: 'use-cases',    label: 'Use Cases' },
  { key: 'process',      label: 'Process' },
  { key: 'data-model',   label: 'Data Model' },
  { key: 'requirements', label: 'Requirements' },
  { key: 'system-design',label: 'System Design' },
] as const

type SectionKey = typeof SECTIONS[number]['key']

function isSectionMissing(key: SectionKey, kb: KnowledgeBaseV2): boolean {
  switch (key) {
    case 'business':      return !kb.business.problem
    case 'actors':        return kb.actors.length === 0
    case 'use-cases':     return kb.use_cases.normal.length === 0 && kb.use_cases.edge.length === 0
    case 'process':       return kb.process_flow.length === 0
    case 'data-model':    return kb.data_model.entities.length === 0
    case 'requirements':  return kb.functional_requirements.length === 0
    case 'system-design': return !kb.system_design.architecture.frontend
    default:              return false
  }
}

function SectionNavigator({
  activeSection,
  onSectionChange,
  kb,
}: {
  activeSection?: string
  onSectionChange: (key: string) => void
  kb: KnowledgeBaseV2
}) {
  function scrollTo(key: string) {
    onSectionChange(key)
    document.getElementById('section-' + key)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div style={{
      padding: '8px 0',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      flexShrink: 0,
    }}>
      {SECTIONS.map(({ key, label }) => {
        const isActive = activeSection === key
        const missing = isSectionMissing(key, kb)
        return (
          <button
            key={key}
            onClick={() => scrollTo(key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '7px 14px',
              border: 'none',
              borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
              background: isActive ? 'var(--accent-light)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: isActive ? 700 : 500,
              fontSize: 13,
              cursor: 'pointer',
              textAlign: 'left',
              borderRadius: '0 6px 6px 0',
              transition: 'background 0.12s',
            }}
          >
            <span>{label}</span>
            {missing && (
              <span style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#F59E0B',
                display: 'inline-block',
                flexShrink: 0,
              }} />
            )}
          </button>
        )
      })}
    </div>
  )
}


// ─── 3. ActorCard ─────────────────────────────────────────────────────────────

function ActorCard({
  actor,
  index,
  onUpdate,
}: {
  actor: ActorV2
  index: number
  onUpdate: (updated: ActorV2) => void
}) {
  function updatePermission(i: number, val: string) {
    const next = [...actor.permissions]
    if (val.trim() === '') next.splice(i, 1)
    else next[i] = val.trim()
    onUpdate({ ...actor, permissions: next })
  }

  function updateGoal(i: number, val: string) {
    const next = [...actor.goals]
    if (val.trim() === '') next.splice(i, 1)
    else next[i] = val.trim()
    onUpdate({ ...actor, goals: next })
  }

  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 10,
      border: '1px solid var(--border)',
      background: 'var(--bg)',
      marginBottom: 10,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>NAME</div>
          <EditableText
            value={actor.name}
            onSave={(v) => onUpdate({ ...actor, name: v })}
            placeholder="Actor name"
          />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>DESCRIPTION</div>
          <EditableText
            value={actor.description}
            onSave={(v) => onUpdate({ ...actor, description: v })}
            placeholder="Description"
            multiline
          />
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>PERMISSIONS</div>
        {actor.permissions.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-subtle)', padding: '4px 10px' }}>(none)</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {actor.permissions.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 12, minWidth: 12 }}>•</span>
                <div style={{ flex: 1 }}>
                  <EditableText value={p} onSave={(v) => updatePermission(i, v)} placeholder="Permission" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>GOALS</div>
        {actor.goals.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-subtle)', padding: '4px 10px' }}>(none)</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {actor.goals.map((g, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 12, minWidth: 12 }}>→</span>
                <div style={{ flex: 1 }}>
                  <EditableText value={g} onSave={(v) => updateGoal(i, v)} placeholder="Goal" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 4. UseCaseCard ───────────────────────────────────────────────────────────

function NormalUseCaseCard({
  uc,
  onUpdate,
}: {
  uc: NormalUseCase
  onUpdate: (updated: NormalUseCase) => void
}) {
  function updateStep(i: number, val: string) {
    const next = [...uc.steps]
    if (val.trim() === '') next.splice(i, 1)
    else next[i] = val.trim()
    onUpdate({ ...uc, steps: next })
  }

  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 10,
      border: '1px solid var(--border)',
      background: 'var(--bg)',
      marginBottom: 10,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>TITLE</div>
          <EditableText value={uc.title} onSave={(v) => onUpdate({ ...uc, title: v })} placeholder="Use case title" />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>ACTOR</div>
          <EditableText value={uc.actor} onSave={(v) => onUpdate({ ...uc, actor: v })} placeholder="Actor" />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>STEPS</div>
        {uc.steps.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-subtle)', padding: '4px 10px' }}>(none)</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {uc.steps.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <span style={{
                  minWidth: 20, height: 20,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  color: 'white',
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: 6, flexShrink: 0,
                }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <EditableText value={s} onSave={(v) => updateStep(i, v)} placeholder="Step" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EdgeUseCaseCard({
  uc,
  onUpdate,
}: {
  uc: EdgeUseCase
  onUpdate: (updated: EdgeUseCase) => void
}) {
  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 10,
      border: '1px solid #FDE68A',
      background: '#FFFBEB',
      marginBottom: 10,
    }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', marginBottom: 2 }}>TITLE</div>
        <EditableText value={uc.title} onSave={(v) => onUpdate({ ...uc, title: v })} placeholder="Edge case title" />
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', marginBottom: 2 }}>CONDITION</div>
        <EditableText value={uc.condition} onSave={(v) => onUpdate({ ...uc, condition: v })} placeholder="Triggering condition" multiline />
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', marginBottom: 2 }}>SYSTEM RESPONSE</div>
        <EditableText value={uc.system_response} onSave={(v) => onUpdate({ ...uc, system_response: v })} placeholder="How the system responds" multiline />
      </div>
    </div>
  )
}


// ─── 5. ProcessFlowViewer ─────────────────────────────────────────────────────

function ProcessFlowViewer({
  steps,
  onUpdate,
}: {
  steps: ProcessFlowStep[]
  onUpdate: (steps: ProcessFlowStep[]) => void
}) {
  function updateCell(i: number, field: keyof ProcessFlowStep, val: string) {
    const next = steps.map((s, idx) => idx === i ? { ...s, [field]: val } : s)
    onUpdate(next)
  }

  if (steps.length === 0) {
    return <div style={{ fontSize: 13, color: 'var(--text-subtle)', padding: '8px 0' }}>(no steps yet)</div>
  }

  const thStyle: React.CSSProperties = {
    padding: '8px 10px',
    textAlign: 'left',
    fontWeight: 700,
    fontSize: 11,
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg)',
  }

  const tdStyle: React.CSSProperties = {
    padding: '4px 6px',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'top',
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 36 }}>#</th>
            <th style={thStyle}>Actor</th>
            <th style={thStyle}>Action</th>
            <th style={thStyle}>System</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((step, i) => (
            <tr key={step.id || i}>
              <td style={{ ...tdStyle, color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center' }}>
                {i + 1}
              </td>
              <td style={tdStyle}>
                <EditableText value={step.actor} onSave={(v) => updateCell(i, 'actor', v)} placeholder="Actor" />
              </td>
              <td style={tdStyle}>
                <EditableText value={step.action} onSave={(v) => updateCell(i, 'action', v)} placeholder="Action" />
              </td>
              <td style={tdStyle}>
                <EditableText value={step.system} onSave={(v) => updateCell(i, 'system', v)} placeholder="System response" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── 6. EntityCard ────────────────────────────────────────────────────────────

function EntityCard({
  entity,
  onUpdate,
}: {
  entity: Entity
  onUpdate: (updated: Entity) => void
}) {
  function updateField(i: number, key: 'name' | 'type', val: string) {
    const next = entity.fields.map((f, idx) => idx === i ? { ...f, [key]: val } : f)
    onUpdate({ ...entity, fields: next })
  }

  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 10,
      border: '1px solid var(--border)',
      background: 'var(--bg)',
      marginBottom: 10,
    }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>ENTITY</div>
        <EditableText
          value={entity.name}
          onSave={(v) => onUpdate({ ...entity, name: v })}
          placeholder="Entity name"
          style={{ fontWeight: 700 }}
        />
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>FIELDS</div>
        {entity.fields.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-subtle)', padding: '4px 10px' }}>(no fields)</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {entity.fields.map((f, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 6 }}>
                <EditableText value={f.name} onSave={(v) => updateField(i, 'name', v)} placeholder="field_name" />
                <EditableText
                  value={f.type}
                  onSave={(v) => updateField(i, 'type', v)}
                  placeholder="type"
                  style={{ color: 'var(--accent)', fontFamily: 'monospace', fontSize: 12 }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 7. RequirementCard ───────────────────────────────────────────────────────

function RequirementCard({
  req,
  onUpdate,
}: {
  req: FunctionalRequirement
  onUpdate: (updated: FunctionalRequirement) => void
}) {
  function updateCriteria(i: number, val: string) {
    const next = [...req.acceptance_criteria]
    if (val.trim() === '') next.splice(i, 1)
    else next[i] = val.trim()
    onUpdate({ ...req, acceptance_criteria: next })
  }

  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 10,
      border: '1px solid var(--border)',
      background: 'var(--bg)',
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: 'var(--accent)',
          padding: '2px 8px',
          borderRadius: 4,
          background: 'var(--accent-light)',
          flexShrink: 0,
        }}>
          {req.id}
        </span>
        <div style={{ flex: 1 }}>
          <EditableText value={req.name} onSave={(v) => onUpdate({ ...req, name: v })} placeholder="Requirement name" style={{ fontWeight: 600 }} />
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>DESCRIPTION</div>
        <EditableText value={req.description} onSave={(v) => onUpdate({ ...req, description: v })} placeholder="Description" multiline />
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
          ACCEPTANCE CRITERIA ({req.acceptance_criteria.length})
        </div>
        {req.acceptance_criteria.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-subtle)', padding: '4px 10px' }}>(none)</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {req.acceptance_criteria.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <span style={{ color: 'var(--success, #16A34A)', fontSize: 12, paddingTop: 6, flexShrink: 0 }}>✓</span>
                <div style={{ flex: 1 }}>
                  <EditableText value={c} onSave={(v) => updateCriteria(i, v)} placeholder="Criterion" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


// ─── 8. DepthBreakdownBar ─────────────────────────────────────────────────────

function DepthBreakdownBar({ kb }: { kb: KnowledgeBaseV2 }) {
  const breakdown = getDepthBreakdown(kb)

  const rows: Array<{ label: string; score: number; max: number; items: number }> = [
    { label: 'Normal Use Cases', score: breakdown.use_cases_normal.score, max: breakdown.use_cases_normal.max, items: breakdown.use_cases_normal.items },
    { label: 'Edge Use Cases',   score: breakdown.use_cases_edge.score,   max: breakdown.use_cases_edge.max,   items: breakdown.use_cases_edge.items },
    { label: 'Process Flow',     score: breakdown.process_flow.score,     max: breakdown.process_flow.max,     items: breakdown.process_flow.items },
    { label: 'Data Model',       score: breakdown.data_model.score,       max: breakdown.data_model.max,       items: breakdown.data_model.items },
    { label: 'Requirements',     score: breakdown.functional_requirements.score, max: breakdown.functional_requirements.max, items: breakdown.functional_requirements.items },
  ]

  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 10,
      border: '1px solid var(--border)',
      background: 'var(--bg)',
      marginBottom: 16,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>DEPTH BREAKDOWN</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(({ label, score, max, items }) => {
          const pct = max > 0 ? Math.round((score / max) * 100) : 0
          return (
            <div key={label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{score}/{max} · {items} item{items !== 1 ? 's' : ''}</span>
              </div>
              <div style={{
                height: 6,
                background: 'var(--border)',
                borderRadius: 999,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: pct >= 80 ? '#16A34A' : pct >= 40 ? '#D97706' : '#DC2626',
                  borderRadius: 999,
                  transition: 'width 0.3s ease-out',
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function SBSection({
  id,
  title,
  badge,
  children,
}: {
  id: string
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
        scrollMarginTop: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
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


// ─── 9. Main SystemBuilderPanel ───────────────────────────────────────────────

export default function SystemBuilderPanel({ kb, onKBUpdate, activeSection }: SystemBuilderPanelProps) {
  // Track active nav section based on scroll or prop
  const [navSection, setNavSection] = useState<string>(activeSection ?? 'business')
  const [saving, setSaving] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set())

  // Debounced KB update — calls onKBUpdate after 400ms of inactivity
  const debouncedUpdate = useCallback((updatedKB: KnowledgeBaseV2) => {
    setSaving(true)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      onKBUpdate(updatedKB)
      setSaving(false)
    }, 400)
  }, [onKBUpdate])

  // Auto-scroll when activeSection prop changes
  useEffect(() => {
    if (activeSection) {
      setNavSection(activeSection)
      document.getElementById('section-' + activeSection)?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [activeSection])

  // ── Helpers to update nested KB fields ──────────────────────────────────────

  const updateBusiness = useCallback((field: keyof KnowledgeBaseV2['business'], value: unknown) => {
    debouncedUpdate({ ...kb, business: { ...kb.business, [field]: value } })
  }, [kb, debouncedUpdate])

  const updateActors = useCallback((actors: ActorV2[]) => {
    debouncedUpdate({ ...kb, actors })
  }, [kb, debouncedUpdate])

  const updateNormalUC = useCallback((index: number, updated: NormalUseCase) => {
    const next = kb.use_cases.normal.map((uc, i) => i === index ? updated : uc)
    debouncedUpdate({ ...kb, use_cases: { ...kb.use_cases, normal: next } })
  }, [kb, debouncedUpdate])

  const updateEdgeUC = useCallback((index: number, updated: EdgeUseCase) => {
    const next = kb.use_cases.edge.map((uc, i) => i === index ? updated : uc)
    debouncedUpdate({ ...kb, use_cases: { ...kb.use_cases, edge: next } })
  }, [kb, debouncedUpdate])

  const updateProcessFlow = useCallback((steps: ProcessFlowStep[]) => {
    debouncedUpdate({ ...kb, process_flow: steps })
  }, [kb, debouncedUpdate])

  const updateEntities = useCallback((index: number, updated: Entity) => {
    const next = kb.data_model.entities.map((e, i) => i === index ? updated : e)
    debouncedUpdate({ ...kb, data_model: { ...kb.data_model, entities: next } })
  }, [kb, debouncedUpdate])

  const updateRequirement = useCallback((index: number, updated: FunctionalRequirement) => {
    const next = kb.functional_requirements.map((r, i) => i === index ? updated : r)
    debouncedUpdate({ ...kb, functional_requirements: next })
  }, [kb, debouncedUpdate])

  const updateStakeholder = useCallback((index: number, field: 'name' | 'goals' | 'pain_points', value: unknown) => {
    const next = kb.business.stakeholders.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    )
    debouncedUpdate({ ...kb, business: { ...kb.business, stakeholders: next } })
  }, [kb, debouncedUpdate])

  const updateObjective = useCallback((index: number, val: string) => {
    const next = [...kb.business.objectives]
    if (val.trim() === '') next.splice(index, 1)
    else next[index] = val.trim()
    updateBusiness('objectives', next)
  }, [kb, updateBusiness])

  const updateMetric = useCallback((index: number, val: string) => {
    const next = [...kb.business.success_metrics]
    if (val.trim() === '') next.splice(index, 1)
    else next[index] = val.trim()
    updateBusiness('success_metrics', next)
  }, [kb, updateBusiness])

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
      <SystemBuilderHeader kb={kb} saving={saving} />

      {/* Scrollable body — no nav, sections scroll freely */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 20px 40px' }}>

        {/* Depth Breakdown */}
        <DepthBreakdownBar kb={kb} />

        {/* ── Business ── */}
        <SBSection id="section-business" title="Business Context">
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>PROBLEM STATEMENT</div>
            <EditableText
              value={kb.business.problem}
              onSave={(v) => updateBusiness('problem', v)}
              placeholder="Describe the core problem…"
              multiline
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>OBJECTIVES</div>
            {kb.business.objectives.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-subtle)', padding: '4px 10px' }}>(none)</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {kb.business.objectives.map((obj, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12, minWidth: 12 }}>•</span>
                    <div style={{ flex: 1 }}>
                      <EditableText value={obj} onSave={(v) => updateObjective(i, v)} placeholder="Objective" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>SUCCESS METRICS</div>
            {kb.business.success_metrics.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-subtle)', padding: '4px 10px' }}>(none)</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {kb.business.success_metrics.map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--accent)', fontSize: 12, minWidth: 12 }}>↗</span>
                    <div style={{ flex: 1 }}>
                      <EditableText value={m} onSave={(v) => updateMetric(i, v)} placeholder="Metric" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {kb.business.stakeholders.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>STAKEHOLDERS</div>
              {kb.business.stakeholders.map((s, i) => (
                <div key={i} style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  marginBottom: 8,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>NAME</div>
                  <EditableText value={s.name} onSave={(v) => updateStakeholder(i, 'name', v)} placeholder="Stakeholder name" />
                </div>
              ))}
            </div>
          )}
        </SBSection>

        {/* ── Actors ── */}
        <SBSection id="section-actors" title="Actors & Roles" badge={kb.actors.length}>
          {kb.actors.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-subtle)' }}>(no actors yet)</div>
          ) : (
            kb.actors.map((actor, i) => (
              <ActorCard
                key={i}
                actor={actor}
                index={i}
                onUpdate={(updated) => {
                  const next = kb.actors.map((a, idx) => idx === i ? updated : a)
                  updateActors(next)
                }}
              />
            ))
          )}
        </SBSection>

        {/* ── Use Cases ── */}
        <SBSection
          id="section-use-cases"
          title="Use Cases"
          badge={kb.use_cases.normal.length + kb.use_cases.edge.length}
        >
          {kb.use_cases.normal.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>NORMAL FLOWS</div>
              {kb.use_cases.normal.map((uc, i) => (
                <NormalUseCaseCard key={i} uc={uc} onUpdate={(updated) => updateNormalUC(i, updated)} />
              ))}
            </div>
          )}
          {kb.use_cases.edge.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', marginBottom: 8 }}>EDGE CASES</div>
              {kb.use_cases.edge.map((uc, i) => (
                <EdgeUseCaseCard key={i} uc={uc} onUpdate={(updated) => updateEdgeUC(i, updated)} />
              ))}
            </div>
          )}
          {kb.use_cases.normal.length === 0 && kb.use_cases.edge.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-subtle)' }}>(no use cases yet)</div>
          )}
        </SBSection>

        {/* ── Process ── */}
        <SBSection id="section-process" title="Process Flow" badge={kb.process_flow.length}>
          <ProcessFlowViewer steps={kb.process_flow} onUpdate={updateProcessFlow} />
        </SBSection>

        {/* ── Data Model ── */}
        <SBSection id="section-data-model" title="Data Model" badge={kb.data_model.entities.length}>
          {kb.data_model.entities.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-subtle)' }}>(no entities yet)</div>
          ) : (
            kb.data_model.entities.map((entity, i) => (
              <EntityCard key={i} entity={entity} onUpdate={(updated) => updateEntities(i, updated)} />
            ))
          )}
          {kb.data_model.relationships.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>RELATIONSHIPS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {kb.data_model.relationships.map((rel, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    fontSize: 13,
                  }}>
                    <span style={{ fontWeight: 600 }}>{rel.from}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>──{rel.cardinality}──▶</span>
                    <span style={{ fontWeight: 600 }}>{rel.to}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SBSection>

        {/* ── Requirements ── */}
        <SBSection id="section-requirements" title="Functional Requirements" badge={kb.functional_requirements.length}>
          {kb.functional_requirements.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-subtle)' }}>(no requirements yet)</div>
          ) : (
            kb.functional_requirements.map((req, i) => (
              <RequirementCard key={req.id || i} req={req} onUpdate={(updated) => updateRequirement(i, updated)} />
            ))
          )}
        </SBSection>

        {/* ── System Design ── */}
        <SBSection id="section-system-design" title="System Design">
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>ARCHITECTURE</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {(
                [
                  { key: 'frontend', label: 'Frontend' },
                  { key: 'backend',  label: 'Backend' },
                  { key: 'database', label: 'Database' },
                  { key: 'ai_layer', label: 'AI Layer' },
                ] as const
              ).map(({ key, label }) => (
                <div key={key} style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>{label.toUpperCase()}</div>
                  <EditableText
                    value={kb.system_design.architecture[key]}
                    onSave={(v) => debouncedUpdate({
                      ...kb,
                      system_design: {
                        ...kb.system_design,
                        architecture: { ...kb.system_design.architecture, [key]: v },
                      },
                    })}
                    placeholder={`${label} stack`}
                  />
                </div>
              ))}
            </div>
          </div>

          {kb.system_design.api_endpoints.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>API ENDPOINTS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {kb.system_design.api_endpoints.map((ep, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    fontSize: 13,
                  }}>
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: ep.method === 'GET' ? '#DBEAFE' : ep.method === 'POST' ? '#D1FAE5' : ep.method === 'DELETE' ? '#FEE2E2' : '#FEF3C7',
                      color: ep.method === 'GET' ? '#1D4ED8' : ep.method === 'POST' ? '#065F46' : ep.method === 'DELETE' ? '#991B1B' : '#92400E',
                      fontWeight: 700,
                      fontSize: 11,
                      flexShrink: 0,
                      fontFamily: 'monospace',
                    }}>
                      {ep.method}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>{ep.path}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{ep.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SBSection>

        {/* ── Suggestions ── */}
        {(() => {
          const allSuggestions = generateSuggestions(kb)
          const visible = allSuggestions.filter((s: Suggestion) => !dismissedSuggestions.has(s.suggestion))
          if (visible.length === 0) return null
          return (
            <section style={{ marginBottom: 32, paddingBottom: 24, scrollMarginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Suggestions</h2>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'var(--accent-light)',
                  color: 'var(--accent)',
                }}>
                  {visible.length}
                </span>
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {visible.map((s: Suggestion) => (
                  <li
                    key={s.suggestion}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <span style={{ flex: 1, lineHeight: 1.5 }}>{s.suggestion}</span>
                    <button
                      onClick={() => setDismissedSuggestions(prev => new Set([...prev, s.suggestion]))}
                      title="Dismiss"
                      style={{
                        flexShrink: 0,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        fontSize: 16,
                        lineHeight: 1,
                        padding: '0 2px',
                        borderRadius: 4,
                      }}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })()}

      </div>
    </div>
  )
}

