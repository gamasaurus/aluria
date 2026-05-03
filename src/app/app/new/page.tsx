'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProjectMode = 'greenfield' | 'analysis'

type ProjectType =
  | 'new_system'
  | 'feature_addition'
  | 'system_revamp'
  | 'system_integration'
  | 'data_migration'
  | 'process_optimization'

type FocusCluster =
  | 'security'
  | 'data_registry'
  | 'performance'
  | 'api_design'
  | 'user_experience'
  | 'integrations'
  | 'compliance'
  | 'scalability'

interface OnboardingState {
  // Phase 1
  mode: ProjectMode | null
  projectType: ProjectType | null
  // Phase 2
  name: string
  description: string
  // Phase 3
  focusClusters: FocusCluster[]
  // Phase 4
  techStack: string
  scale: string
  integrations: string
  // Upload (for analysis types)
  uploadedFile: File | null
  uploadedFileName: string
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg: 'var(--bg)',
  surface: 'var(--surface)',
  surface2: 'rgba(0,0,0,0.04)',
  border: 'var(--border)',
  borderStrong: 'var(--border-strong)',
  accent: 'var(--accent)',
  accentLight: 'var(--accent-light)',
  text: 'var(--text-primary)',
  muted: 'var(--text-muted)',
  subtle: 'var(--text-subtle)',
  success: 'var(--success)',
  warning: 'var(--warning)',
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ANALYSIS_TYPES: { type: ProjectType; label: string; icon: string; desc: string; uploadLabel: string; uploadHint: string }[] = [
  { type: 'feature_addition', label: 'Feature Addition', icon: '➕', desc: 'Enhance an existing system with new capabilities', uploadLabel: 'Upload existing system docs', uploadHint: 'BRD, PRD, API spec, or architecture diagram' },
  { type: 'system_revamp', label: 'System Revamp', icon: '🔄', desc: 'Redesign and modernize an existing system', uploadLabel: 'Upload current system documentation', uploadHint: 'AS-IS process docs, architecture, or pain point analysis' },
  { type: 'system_integration', label: 'System Integration', icon: '🔗', desc: 'Connect and synchronize multiple systems', uploadLabel: 'Upload system specs or API contracts', uploadHint: 'OpenAPI spec, data schema, or integration diagram' },
  { type: 'data_migration', label: 'Data Migration', icon: '🗃️', desc: 'Migrate data between systems or formats', uploadLabel: 'Upload source schema or data model', uploadHint: 'DB schema SQL, ERD, or data dictionary' },
  { type: 'process_optimization', label: 'Process Optimization', icon: '⚡', desc: 'Identify bottlenecks and automate workflows', uploadLabel: 'Upload current process documentation', uploadHint: 'BPMN, workflow diagram, or process description' },
]

const FOCUS_CLUSTERS: { key: FocusCluster; label: string; icon: string; desc: string }[] = [
  { key: 'security', label: 'Security', icon: '🛡', desc: 'Auth, permissions, encryption, compliance' },
  { key: 'data_registry', label: 'Data Registry', icon: '🗄', desc: 'Entities, relationships, data model' },
  { key: 'performance', label: 'Performance', icon: '⚡', desc: 'Scalability, caching, response time' },
  { key: 'api_design', label: 'API Design', icon: '🔌', desc: 'Endpoints, contracts, versioning' },
  { key: 'user_experience', label: 'User Experience', icon: '🎨', desc: 'User flows, screens, interactions' },
  { key: 'integrations', label: 'Integrations', icon: '🔗', desc: 'Third-party systems, webhooks, sync' },
  { key: 'compliance', label: 'Compliance', icon: '📋', desc: 'Regulatory, audit trail, data privacy' },
  { key: 'scalability', label: 'Scalability', icon: '📈', desc: 'Load handling, distributed systems' },
]

const SCALE_OPTIONS = ['< 1K users', '1K–10K users', '10K–100K users', '100K+ users', 'Enterprise']

// ─── Main component ───────────────────────────────────────────────────────────

export default function NewProjectPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [state, setState] = useState<OnboardingState>({
    mode: null,
    projectType: null,
    name: '',
    description: '',
    focusClusters: [],
    techStack: '',
    scale: '',
    integrations: '',
    uploadedFile: null,
    uploadedFileName: '',
  })

  const update = useCallback((patch: Partial<OnboardingState>) => {
    setState(prev => ({ ...prev, ...patch }))
  }, [])

  function toggleCluster(key: FocusCluster) {
    setState(prev => ({
      ...prev,
      focusClusters: prev.focusClusters.includes(key)
        ? prev.focusClusters.filter(k => k !== key)
        : [...prev.focusClusters, key],
    }))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) update({ uploadedFile: file, uploadedFileName: file.name })
  }

  async function handleLaunch() {
    if (!state.name.trim() || !state.description.trim()) return
    setLoading(true)
    setError('')

    try {
      // Build enriched description from all phases
      const enrichedDescription = buildEnrichedDescription(state)

      const formData = new FormData()
      formData.append('name', state.name.trim())
      formData.append('description', enrichedDescription)
      formData.append('project_type', state.projectType ?? 'new_system')
      formData.append('focus_clusters', JSON.stringify(state.focusClusters))
      formData.append('tech_stack', state.techStack)
      formData.append('scale', state.scale)
      formData.append('integrations', state.integrations)
      if (state.uploadedFile) formData.append('document', state.uploadedFile)

      const res = await fetch('/api/projects', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok || !data.project) {
        setError(data.error ?? 'Failed to initialize project')
        setLoading(false)
        return
      }

      router.push(`/app/project/${data.project.id}`)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const canAdvancePhase2 = state.name.trim().length > 0 && state.description.trim().length >= 20
  const isAnalysisMode = state.mode === 'analysis'

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .cluster-card { transition: border-color 0.15s, background 0.15s, transform 0.15s; }
        .cluster-card:hover { transform: translateY(-2px); }
        .type-card { transition: border-color 0.15s, background 0.15s, transform 0.15s; }
        .type-card:hover { transform: translateY(-2px); }
        .input-field:focus { border-color: var(--accent) !important; outline: none; }
        .btn-primary { transition: opacity 0.15s, transform 0.15s; }
        .btn-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
        .drop-zone { transition: border-color 0.15s, background 0.15s; }
        .drop-zone:hover { border-color: var(--accent) !important; background: var(--accent-light) !important; }
      `}</style>

      {/* Top bar */}
      <div style={{ padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M10 4l6 6-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 16, color: C.text }}>Aluria</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <PhaseIndicator current={phase} total={4} />
          <Link href="/app" style={{ fontSize: 13, color: C.muted, textDecoration: 'none' }}>← Projects</Link>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 680 }}>

          {/* ── Phase 1: Intelligence Protocol ── */}
          {phase === 1 && (
            <Phase1
              state={state}
              update={update}
              onNext={() => setPhase(2)}
            />
          )}

          {/* ── Phase 2: Vision Statement ── */}
          {phase === 2 && (
            <Phase2
              state={state}
              update={update}
              isAnalysis={isAnalysisMode}
              fileInputRef={fileInputRef}
              onFileChange={handleFileChange}
              canAdvance={canAdvancePhase2}
              onBack={() => setPhase(1)}
              onNext={() => setPhase(3)}
            />
          )}

          {/* ── Phase 3: Focus Clusters ── */}
          {phase === 3 && (
            <Phase3
              state={state}
              toggleCluster={toggleCluster}
              onBack={() => setPhase(2)}
              onNext={() => setPhase(4)}
            />
          )}

          {/* ── Phase 4: Strategic Constraints ── */}
          {phase === 4 && (
            <Phase4
              state={state}
              update={update}
              loading={loading}
              error={error}
              onBack={() => setPhase(3)}
              onLaunch={handleLaunch}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Phase indicator ──────────────────────────────────────────────────────────

function PhaseIndicator({ current, total }: { current: number; total: number }) {
  const labels = ['Protocol', 'Vision', 'Focus', 'Constraints']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, background: done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--border)', color: done || active ? 'white' : 'var(--text-muted)', transition: 'all 0.2s' }}>
                {done ? '✓' : n}
              </div>
              <span style={{ fontSize: 11, fontWeight: active ? 700 : 400, color: active ? C.text : C.subtle, display: 'none' }}>{labels[i]}</span>
            </div>
            {n < total && <div style={{ width: 20, height: 1, background: done ? 'var(--success)' : 'var(--border)' }} />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Phase 1: Intelligence Protocol ──────────────────────────────────────────

function Phase1({ state, update, onNext }: { state: OnboardingState; update: (p: Partial<OnboardingState>) => void; onNext: () => void }) {
  function selectGreenfield() {
    update({ mode: 'greenfield', projectType: 'new_system' })
    onNext()
  }

  function selectAnalysis(type: ProjectType) {
    update({ mode: 'analysis', projectType: type })
    onNext()
  }

  return (
    <div>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: '0.1em', marginBottom: 10 }}>PHASE 01 — INTELLIGENCE PROTOCOL</div>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: C.text, lineHeight: 1.15, marginBottom: 12, letterSpacing: '-0.02em' }}>
          What are we building?
        </h1>
        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.6 }}>
          Select your mission type. Aluria will adapt its analysis engine accordingly.
        </p>
      </div>

      {/* Greenfield */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.subtle, letterSpacing: '0.08em', marginBottom: 12 }}>NEW SYSTEM</div>
        <button
          className="type-card"
          onClick={selectGreenfield}
          style={{ width: '100%', textAlign: 'left', padding: '20px 24px', borderRadius: 14, border: `1px solid ${C.border}`, background: C.surface, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16 }}
        >
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🌱</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 4 }}>Greenfield Genesis</div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Build a complete Product System Blueprint from a new idea. Full end-to-end analysis.</div>
          </div>
          <div style={{ fontSize: 18, color: C.subtle }}>→</div>
        </button>
      </div>

      {/* Analysis types */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.subtle, letterSpacing: '0.08em', marginBottom: 12 }}>SYSTEM ANALYSIS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ANALYSIS_TYPES.map(({ type, label, icon, desc }) => (
            <button
              key={type}
              className="type-card"
              onClick={() => selectAnalysis(type)}
              style={{ width: '100%', textAlign: 'left', padding: '16px 20px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(0,0,0,0.04)', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{desc}</div>
              </div>
              <div style={{ fontSize: 16, color: C.subtle }}>→</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Phase 2: Vision Statement ────────────────────────────────────────────────

function Phase2({
  state, update, isAnalysis, fileInputRef, onFileChange, canAdvance, onBack, onNext,
}: {
  state: OnboardingState
  update: (p: Partial<OnboardingState>) => void
  isAnalysis: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  canAdvance: boolean
  onBack: () => void
  onNext: () => void
}) {
  const analysisConfig = ANALYSIS_TYPES.find(t => t.type === state.projectType)

  const placeholders: Record<string, string> = {
    new_system: 'Describe the system you want to build — the problem it solves, who uses it, and what it must do. The more context you provide, the deeper Aluria\'s initial analysis.',
    feature_addition: 'Describe the feature you want to add — what it does, which part of the existing system it affects, and why it\'s needed.',
    system_revamp: 'Describe the current system and what\'s broken — what needs to change, what must stay, and what success looks like.',
    system_integration: 'Describe the systems involved — what data flows between them, which is the source of truth, and what triggers the sync.',
    data_migration: 'Describe the source and target systems — what data needs to move, any transformation rules, and what defines a successful migration.',
    process_optimization: 'Describe the current process — where time is wasted, where errors occur, and what the optimized flow should look like.',
  }

  const placeholder = placeholders[state.projectType ?? 'new_system']

  return (
    <div>
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: '0.1em', marginBottom: 10 }}>PHASE 02 — VISION STATEMENT</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: C.text, lineHeight: 1.2, marginBottom: 10, letterSpacing: '-0.02em' }}>
          Define the mission
        </h1>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>
          Name your project and articulate the core business logic. This becomes Aluria's primary signal.
        </p>
      </div>

      {/* Project name */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: '0.06em', marginBottom: 8 }}>
          PROJECT NAME <span style={{ color: '#DC2626' }}>*</span>
        </label>
        <input
          className="input-field"
          type="text"
          value={state.name}
          onChange={e => update({ name: e.target.value })}
          placeholder="e.g. Restaurant Order Management System"
          autoFocus
          style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: `1px solid ${C.borderStrong}`, background: C.bg, color: C.text, fontSize: 15, fontWeight: 600, fontFamily: 'inherit', transition: 'border-color 0.15s' }}
        />
      </div>

      {/* Description */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: '0.06em', marginBottom: 8 }}>
          BUSINESS CONTEXT <span style={{ color: '#DC2626' }}>*</span>
        </label>
        <textarea
          className="input-field"
          value={state.description}
          onChange={e => update({ description: e.target.value })}
          placeholder={placeholder}
          rows={5}
          style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: `1px solid ${C.borderStrong}`, background: C.bg, color: C.text, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.65, resize: 'vertical', transition: 'border-color 0.15s' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontSize: 12, color: state.description.length >= 20 ? 'var(--success)' : C.subtle }}>
            {state.description.length >= 20 ? '✓ Sufficient context for AI pre-analysis' : `${Math.max(0, 20 - state.description.length)} more characters for AI analysis`}
          </span>
          <span style={{ fontSize: 12, color: C.subtle }}>{state.description.length} chars</span>
        </div>
      </div>

      {/* Document upload — only for analysis types */}
      {isAnalysis && analysisConfig && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: '0.06em', marginBottom: 8 }}>
            {analysisConfig.uploadLabel.toUpperCase()} <span style={{ fontSize: 11, fontWeight: 400, color: C.subtle }}>(optional)</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md,.sql,.json,.yaml,.yml,.png,.jpg,.jpeg"
            onChange={onFileChange}
            style={{ display: 'none' }}
          />
          <div
            className="drop-zone"
            onClick={() => fileInputRef.current?.click()}
            style={{ border: `2px dashed ${state.uploadedFile ? 'var(--success)' : C.border}`, borderRadius: 12, padding: '24px', textAlign: 'center', cursor: 'pointer', background: state.uploadedFile ? 'rgba(52,211,153,0.04)' : 'transparent', transition: 'all 0.15s' }}
          >
            {state.uploadedFile ? (
              <div>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📎</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)', marginBottom: 4 }}>{state.uploadedFileName}</div>
                <div style={{ fontSize: 12, color: C.muted }}>Click to replace</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>Drop file or click to upload</div>
                <div style={{ fontSize: 12, color: C.muted }}>{analysisConfig.uploadHint}</div>
                <div style={{ fontSize: 11, color: C.subtle, marginTop: 6 }}>PDF, DOCX, TXT, MD, SQL, JSON, YAML, PNG, JPG</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button onClick={onBack} style={{ padding: '12px 20px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>← Back</button>
        <button
          className="btn-primary"
          onClick={onNext}
          disabled={!canAdvance}
          style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: C.accent, color: 'white', fontSize: 14, fontWeight: 700, cursor: canAdvance ? 'pointer' : 'not-allowed' }}
        >
          Continue to Focus Clusters →
        </button>
      </div>
    </div>
  )
}

// ─── Phase 3: Focus Clusters ──────────────────────────────────────────────────

function Phase3({ state, toggleCluster, onBack, onNext }: {
  state: OnboardingState
  toggleCluster: (k: FocusCluster) => void
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div>
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: '0.1em', marginBottom: 10 }}>PHASE 03 — FOCUS CLUSTERS</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: C.text, lineHeight: 1.2, marginBottom: 10, letterSpacing: '-0.02em' }}>
          Select analysis domains
        </h1>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>
          Choose the technical domains Aluria should prioritize. Selected clusters receive deeper analysis in the PSB.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 28 }}>
        {FOCUS_CLUSTERS.map(({ key, label, icon, desc }) => {
          const selected = state.focusClusters.includes(key)
          return (
            <button
              key={key}
              className="cluster-card"
              onClick={() => toggleCluster(key)}
              style={{ textAlign: 'left', padding: '16px', borderRadius: 12, border: selected ? `2px solid ${C.accent}` : `1px solid ${C.border}`, background: selected ? C.accentLight : C.surface, cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: selected ? C.accent : C.text }}>{label}</span>
                {selected && <span style={{ marginLeft: 'auto', fontSize: 12, color: C.accent }}>✓</span>}
              </div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.4 }}>{desc}</div>
            </button>
          )
        })}
      </div>

      {state.focusClusters.length > 0 && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: C.accentLight, border: `1px solid rgba(99,102,241,0.2)`, marginBottom: 20, fontSize: 13, color: C.accent }}>
          <strong>{state.focusClusters.length} cluster{state.focusClusters.length > 1 ? 's' : ''} selected</strong> — Aluria will generate deeper analysis for: {state.focusClusters.map(k => FOCUS_CLUSTERS.find(c => c.key === k)?.label).join(', ')}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onBack} style={{ padding: '12px 20px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>← Back</button>
        <button
          className="btn-primary"
          onClick={onNext}
          style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: C.accent, color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          {state.focusClusters.length === 0 ? 'Skip — Continue →' : 'Continue to Constraints →'}
        </button>
      </div>
    </div>
  )
}

// ─── Phase 4: Strategic Constraints ──────────────────────────────────────────

function Phase4({ state, update, loading, error, onBack, onLaunch }: {
  state: OnboardingState
  update: (p: Partial<OnboardingState>) => void
  loading: boolean
  error: string
  onBack: () => void
  onLaunch: () => void
}) {
  const canLaunch = !loading

  return (
    <div>
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: '0.1em', marginBottom: 10 }}>PHASE 04 — STRATEGIC CONSTRAINTS</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: C.text, lineHeight: 1.2, marginBottom: 10, letterSpacing: '-0.02em' }}>
          Define the boundaries
        </h1>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>
          Optional but powerful. These constraints shape the architecture and technical recommendations.
        </p>
      </div>

      {/* Tech stack */}
      <div style={{ marginBottom: 18 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: '0.06em', marginBottom: 8 }}>
          TECH STACK <span style={{ fontSize: 11, fontWeight: 400, color: C.subtle }}>(optional)</span>
        </label>
        <input
          className="input-field"
          type="text"
          value={state.techStack}
          onChange={e => update({ techStack: e.target.value })}
          placeholder="e.g. Next.js, Node.js, PostgreSQL, Redis"
          style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: `1px solid ${C.borderStrong}`, background: C.bg, color: C.text, fontSize: 14, fontFamily: 'inherit', transition: 'border-color 0.15s' }}
        />
      </div>

      {/* Scale */}
      <div style={{ marginBottom: 18 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: '0.06em', marginBottom: 8 }}>
          PROJECTED SCALE <span style={{ fontSize: 11, fontWeight: 400, color: C.subtle }}>(optional)</span>
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SCALE_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => update({ scale: state.scale === opt ? '' : opt })}
              style={{ padding: '8px 14px', borderRadius: 8, border: state.scale === opt ? `2px solid ${C.accent}` : `1px solid ${C.border}`, background: state.scale === opt ? C.accentLight : C.surface, color: state.scale === opt ? C.accent : C.muted, fontSize: 13, fontWeight: state.scale === opt ? 700 : 500, cursor: 'pointer', transition: 'all 0.15s' }}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Integration endpoints */}
      <div style={{ marginBottom: 28 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: '0.06em', marginBottom: 8 }}>
          CRITICAL INTEGRATIONS <span style={{ fontSize: 11, fontWeight: 400, color: C.subtle }}>(optional)</span>
        </label>
        <input
          className="input-field"
          type="text"
          value={state.integrations}
          onChange={e => update({ integrations: e.target.value })}
          placeholder="e.g. Stripe, Twilio, Salesforce, internal ERP"
          style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: `1px solid ${C.borderStrong}`, background: C.bg, color: C.text, fontSize: 14, fontFamily: 'inherit', transition: 'border-color 0.15s' }}
        />
      </div>

      {/* Summary brief */}
      <div style={{ padding: '16px 20px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.subtle, letterSpacing: '0.08em', marginBottom: 12 }}>TECHNICAL BRIEF PREVIEW</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <BriefRow label="Project" value={state.name} />
          <BriefRow label="Type" value={ANALYSIS_TYPES.find(t => t.type === state.projectType)?.label ?? 'Greenfield Genesis'} />
          <BriefRow label="Focus" value={state.focusClusters.length > 0 ? state.focusClusters.map(k => FOCUS_CLUSTERS.find(c => c.key === k)?.label).join(', ') : 'General analysis'} />
          {state.techStack && <BriefRow label="Stack" value={state.techStack} />}
          {state.scale && <BriefRow label="Scale" value={state.scale} />}
          {state.integrations && <BriefRow label="Integrations" value={state.integrations} />}
          {state.uploadedFile && <BriefRow label="Document" value={state.uploadedFileName} />}
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #FECACA', background: '#FEF2F2', color: '#991B1B', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onBack} style={{ padding: '12px 20px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>← Back</button>
        <button
          className="btn-primary"
          onClick={onLaunch}
          disabled={!canLaunch}
          style={{ flex: 1, padding: '14px', borderRadius: 10, border: 'none', background: loading ? C.border : C.accent, color: 'white', fontSize: 15, fontWeight: 800, cursor: canLaunch ? 'pointer' : 'not-allowed', letterSpacing: '-0.01em' }}
        >
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
              Initializing AI Analysis…
            </span>
          ) : '⚡ Launch Analysis →'}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function BriefRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: C.subtle, minWidth: 80, paddingTop: 1 }}>{label}</span>
      <span style={{ fontSize: 13, color: C.text, lineHeight: 1.4 }}>{value}</span>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildEnrichedDescription(state: OnboardingState): string {
  const parts: string[] = [state.description.trim()]

  if (state.focusClusters.length > 0) {
    parts.push(`Focus areas: ${state.focusClusters.join(', ')}.`)
  }
  if (state.techStack) {
    parts.push(`Tech stack: ${state.techStack}.`)
  }
  if (state.scale) {
    parts.push(`Expected scale: ${state.scale}.`)
  }
  if (state.integrations) {
    parts.push(`Key integrations: ${state.integrations}.`)
  }

  return parts.join(' ')
}
