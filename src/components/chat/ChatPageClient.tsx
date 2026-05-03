'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calculateDepthV2, computeProgressV2 } from '@/lib/ai/depth'
import { useTheme } from '@/lib/theme'
import DocumentPreviewV2 from '@/components/document/DocumentPreviewV2'
import SystemBuilderPanel from '@/components/chat/SystemBuilderPanel'
import OnboardingOverlay from '@/components/chat/OnboardingOverlay'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import type { ChatResponse, KnowledgeBaseV2, Message, Project, Stage, User } from '@/lib/types'
import { trackEvent } from '@/lib/analytics'

function formatRole(role: 'user' | 'ai') {
  return role === 'user' ? 'You' : 'Aluria'
}

export default function ChatPageClient({
  project,
  initialMessages,
  initialKB,
  user,
}: {
  project: Project
  initialMessages: Message[]
  initialKB: KnowledgeBaseV2
  user: User
}) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [kb, setKB] = useState<KnowledgeBaseV2>(initialKB)
  const [guardTriggered, setGuardTriggered] = useState(false)
  const [activeSection, setActiveSection] = useState<string | undefined>(undefined)
  const [stage, setStage] = useState<Stage>('problem')
  const [isComplete, setIsComplete] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState<string>('')
  const [mode, setMode] = useState<'chat' | 'review'>('chat')
  const [recommendations, setRecommendations] = useState<string[]>([])
  const [diagramIntent, setDiagramIntent] = useState<{ diagram_type: string; confidence: number } | null>(null)
  const [critique, setCritique] = useState<{ summary: string; gaps: string[]; risks: string[]; improvements: string[]; score: number } | null>(null)
  const [critiqueLoading, setCritiqueLoading] = useState(false)
  const [showCritique, setShowCritique] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const { theme, toggle } = useTheme()

  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(true)
  useEffect(() => {
    const seen = localStorage.getItem('aluria_has_seen_onboarding') === 'true'
    setHasSeenOnboarding(seen)
  }, [])

  function handleOnboardingComplete() {
    localStorage.setItem('aluria_has_seen_onboarding', 'true')
    setHasSeenOnboarding(true)
  }

  const progress = useMemo(() => computeProgressV2(kb), [kb])
  const progressPercent = Math.round(progress * 100)
  const depthScore = useMemo(() => calculateDepthV2(kb), [kb])
  const readyForReview = progressPercent >= 80

  function handleKBUpdate(updatedKB: KnowledgeBaseV2) { setKB(updatedKB) }

  async function runCritique() {
    setCritiqueLoading(true)
    setShowCritique(true)
    try {
      const res = await fetch('/api/critique', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: project.id }),
      })
      const data = await res.json()
      if (data.critique) setCritique(data.critique)
    } catch { /* ignore */ } finally {
      setCritiqueLoading(false)
    }
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth')
    router.refresh()
  }

  function scrollToBottom() {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }))
  }

  async function sendMessage() {
    const message = input.trim()
    if (!message || sending) return
    setSending(true); setError(''); setInput('')
    trackEvent('chat_message_sent')
    setMessages((m) => [...m, { id: `optimistic-user-${Date.now()}`, project_id: project.id, role: 'user', content: message, created_at: new Date().toISOString() }])
    scrollToBottom()
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: project.id, message }) })
      const contentType = res.headers.get('content-type')
      if (contentType?.includes('text/event-stream')) {
        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = '', fullText = ''
        if (!reader) throw new Error('No reader')
        setStreamingText('')
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n'); buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const p = JSON.parse(line.slice(6))
                if (p.token) { fullText += p.token; setStreamingText(fullText); scrollToBottom() }
                else if (p.done) { fullText = p.full || fullText }
              } catch { /* ignore */ }
            }
          }
        }
        const finalRes = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: project.id, message: '__STREAM_COMPLETE__' }) })
        const data = (await finalRes.json()) as ChatResponse | { error?: string }
        if (!finalRes.ok || !('next_question' in data)) throw new Error('Failed to finalize')
        const chatData = data as ChatResponse
        setStreamingText('')
        setKB(chatData.kb as unknown as KnowledgeBaseV2); setStage(chatData.stage); setIsComplete(chatData.is_complete); setGuardTriggered(chatData.guard_triggered ?? false)
        if (chatData.recommendations?.length) setRecommendations(chatData.recommendations)
        if (chatData.diagram_intent) setDiagramIntent(chatData.diagram_intent)
        setMessages((m) => [...m, { id: `optimistic-ai-${Date.now()}`, project_id: project.id, role: 'ai', content: fullText || chatData.next_question, created_at: new Date().toISOString() }])
        scrollToBottom(); setActiveSection(stageToSection(chatData.stage))
        if (chatData.is_complete) setTimeout(() => setMode('review'), 800)
        return
      }
      const data = (await res.json()) as ChatResponse | { error?: string }
      if (!res.ok || !('next_question' in data)) throw new Error('error' in data ? data.error : 'Failed')
      setKB(data.kb as unknown as KnowledgeBaseV2); setStage(data.stage); setIsComplete(data.is_complete); setGuardTriggered(data.guard_triggered ?? false)
      if (data.recommendations?.length) setRecommendations(data.recommendations)
      if (data.diagram_intent) setDiagramIntent(data.diagram_intent)
      setMessages((m) => [...m, { id: `optimistic-ai-${Date.now()}`, project_id: project.id, role: 'ai', content: data.next_question, created_at: new Date().toISOString() }])
      scrollToBottom(); setActiveSection(stageToSection(data.stage))
      if (data.is_complete) setTimeout(() => setMode('review'), 800)
    } catch {
      setError('I need a moment. Could you rephrase that?')
      setMessages((m) => [...m, { id: `optimistic-ai-error-${Date.now()}`, project_id: project.id, role: 'ai', content: 'I need a moment. Could you rephrase that?', created_at: new Date().toISOString() }])
      scrollToBottom()
    } finally { setSending(false) }
  }

  async function downloadBRD() {
    window.open(`/api/pdf?project_id=${encodeURIComponent(project.id)}`, '_blank')
  }

  // ─── Top bar (no PDF button, no Sign out button) ──────────────────────────
  const TopBar = (
    <div style={{ height: 52, borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0, gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <Link href="/app" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 600, flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Projects
        </Link>
        <span style={{ color: 'var(--border)', fontSize: 16 }}>·</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</span>
        {guardTriggered && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#FEF3C7', color: '#92400E', flexShrink: 0 }}>⚠ Depth check</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{progressPercent}% · Depth {depthScore}/100</div>
          <div style={{ width: 100, height: 5, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', background: readyForReview ? 'var(--success)' : 'var(--accent)', transition: 'width 0.3s ease-out' }} />
          </div>
        </div>
        {mode === 'chat' && (readyForReview || isComplete) && (
          <button onClick={() => setMode('review')} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: 'var(--success)', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Review →</button>
        )}
        {mode === 'review' && (
          <button onClick={() => setMode('chat')} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>← Chat</button>
        )}
        <button onClick={toggle} title={theme === 'dark' ? 'Light mode' : 'Dark mode'} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>
          {theme === 'dark' ? '☀' : '🌙'}
        </button>
      </div>
    </div>
  )

  // ─── Review Mode ─────────────────────────────────────────────────────────────
  if (mode === 'review') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
        {TopBar}
        <div style={{ flex: 1, overflow: 'hidden', padding: 16 }}>
          <DocumentPreviewV2 kb={kb} projectName={project.name} onKBUpdate={handleKBUpdate} onBackToChat={() => setMode('chat')} onDownload={downloadBRD} />
        </div>
      </div>
    )
  }

  // ─── Chat Mode — 50/50 layout ─────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
      {TopBar}
      <div style={{ flex: 1, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 12 }}>

        {/* ── Left: System Builder Panel or Critique Panel ── */}
        <div style={{ overflow: 'hidden', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 0, flexShrink: 0, background: 'var(--surface)', borderRadius: '12px 12px 0 0', borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={() => setShowCritique(false)}
              style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: '12px 0 0 0', background: !showCritique ? 'var(--accent-light)' : 'transparent', color: !showCritique ? 'var(--accent)' : 'var(--text-muted)', fontWeight: !showCritique ? 700 : 500, fontSize: 13, cursor: 'pointer', borderBottom: !showCritique ? '2px solid var(--accent)' : '2px solid transparent' }}
            >
              System Builder
            </button>
            <button
              onClick={() => { setShowCritique(true); if (!critique && !critiqueLoading) runCritique() }}
              style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: '0 12px 0 0', background: showCritique ? 'rgba(251,191,36,0.1)' : 'transparent', color: showCritique ? '#D97706' : 'var(--text-muted)', fontWeight: showCritique ? 700 : 500, fontSize: 13, cursor: 'pointer', borderBottom: showCritique ? '2px solid #D97706' : '2px solid transparent' }}
            >
              🔍 Architect Review {critique ? `· ${critique.score}/100` : ''}
            </button>
          </div>

          <div style={{ flex: 1, overflow: 'hidden' }}>
            {showCritique ? (
              <CritiquePanel critique={critique} loading={critiqueLoading} onRefresh={runCritique} />
            ) : (
              <ErrorBoundary fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>Something went wrong. Reload the page.</div>}>
                <SystemBuilderPanel kb={kb} onKBUpdate={handleKBUpdate} activeSection={activeSection} />
              </ErrorBoundary>
            )}
          </div>
        </div>

        {/* ── Right: Chat ── */}
        <main style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Stage: <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{stage}</span></div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Aluria Chat</div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            {messages.length === 0 ? (
              <div style={{ border: '1px solid var(--border)', background: 'var(--bg)', borderRadius: 12, padding: 18, maxWidth: 420, margin: '24px auto', color: 'var(--text-muted)' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Start defining your system with Aluria.</div>
                <div style={{ fontSize: 13 }}>Try: "I want to build an order management system for my restaurant."</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {messages.map((m) => {
                  const isUser = m.role === 'user'
                  return (
                    <div key={m.id} className="animate-fade-up" style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                      <div style={{ maxWidth: '82%', borderRadius: 14, padding: '10px 12px', border: isUser ? '1px solid transparent' : '1px solid var(--border)', background: isUser ? 'var(--user-bubble-bg)' : 'var(--ai-bubble-bg)', color: isUser ? 'var(--user-bubble-text)' : 'var(--ai-bubble-text)', boxShadow: isUser ? 'none' : '0 1px 2px rgba(0,0,0,0.04)', whiteSpace: 'pre-wrap' }}>
                        <div style={{ fontSize: 11, opacity: isUser ? 0.9 : 0.65, marginBottom: 4, fontWeight: 600 }}>{formatRole(m.role)}</div>
                        <div style={{ fontSize: 14, lineHeight: 1.55 }}>{m.content}</div>
                      </div>
                    </div>
                  )
                })}
                {sending && streamingText && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ maxWidth: '82%', borderRadius: 14, padding: '10px 12px', border: '1px solid var(--border)', background: 'var(--ai-bubble-bg)', color: 'var(--ai-bubble-text)', whiteSpace: 'pre-wrap' }}>
                      <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 4, fontWeight: 600 }}>Aluria</div>
                      <div style={{ fontSize: 14, lineHeight: 1.55 }}>{streamingText}</div>
                    </div>
                  </div>
                )}
                {sending && !streamingText && (
                  <>
                    <style>{`@keyframes aluria-opacity-pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }`}</style>
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <div style={{ maxWidth: '82%', borderRadius: 14, padding: '10px 12px', border: '1px solid var(--border)', background: 'var(--ai-bubble-bg)', color: 'var(--ai-bubble-text)', animation: 'aluria-opacity-pulse 1.6s ease-in-out infinite' }}>
                        <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 4, fontWeight: 600 }}>Aluria</div>
                        <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-muted)', fontStyle: 'italic' }}>Aluria is thinking…</div>
                      </div>
                    </div>
                  </>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', padding: '12px', flexShrink: 0 }}>
            {error && <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid #FECACA', background: '#FEF2F2', color: '#991B1B', fontSize: 13 }}>{error}</div>}

            {/* Diagram intent notification */}
            {diagramIntent && (
              <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.06)', fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>📊 Diagram detected: <strong>{diagramIntent.diagram_type.replace('_', ' ').toUpperCase()}</strong> — visible in Review mode</span>
                <button onClick={() => setDiagramIntent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}>×</button>
              </div>
            )}

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.06)', fontSize: 12 }}>
                <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span>💡 AI Recommendations</span>
                  <button onClick={() => setRecommendations([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}>×</button>
                </div>
                {recommendations.slice(0, 3).map((r, i) => <div key={i} style={{ color: 'var(--text-secondary)', marginBottom: 3 }}>• {r}</div>)}
              </div>
            )}

            {/* Critique panel */}
            {showCritique && critique && (
              <div style={{ marginBottom: 10, padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(251,191,36,0.35)', background: 'rgba(251,191,36,0.06)', fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, color: '#D97706', fontSize: 13 }}>🔍 Senior Architect Review — Score: {critique.score}/100</span>
                  <button onClick={() => setShowCritique(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}>×</button>
                </div>
                <div style={{ color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>{critique.summary}</div>
                {critique.gaps.length > 0 && <div style={{ marginBottom: 4 }}><span style={{ fontWeight: 700, color: '#DC2626' }}>Gaps: </span>{critique.gaps.slice(0, 2).join(' · ')}</div>}
                {critique.risks.length > 0 && <div style={{ marginBottom: 4 }}><span style={{ fontWeight: 700, color: '#D97706' }}>Risks: </span>{critique.risks.slice(0, 2).join(' · ')}</div>}
                {critique.improvements.length > 0 && <div><span style={{ fontWeight: 700, color: 'var(--success)' }}>Improvements: </span>{critique.improvements.slice(0, 2).join(' · ')}</div>}
              </div>
            )}
            {showCritique && critiqueLoading && (
              <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.06)', fontSize: 12, color: '#D97706' }}>
                ⏳ Running senior architect review…
              </div>
            )}
            {(readyForReview || isComplete) && (
              <div style={{ marginBottom: 10, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--success)', background: '#F0FDF4', color: '#166534', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span>✓ Requirements are ready for review.</span>
                <button onClick={() => setMode('review')} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--success)', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>Open Review →</button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
            <textarea
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  // Auto-grow
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage() } }}
                placeholder="Type your answer… (Shift+Enter for new line)"
                disabled={sending}
                rows={1}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text-primary)', outline: 'none', fontSize: 14, fontFamily: 'inherit', lineHeight: 1.5, resize: 'none', overflow: 'hidden', minHeight: 42 }}
              />
              <button onClick={() => void sendMessage()} disabled={sending || !input.trim()} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: sending || !input.trim() ? 'var(--border-strong)' : 'var(--accent)', color: 'white', fontWeight: 800, cursor: sending || !input.trim() ? 'not-allowed' : 'pointer', fontSize: 14 }}>
                {sending ? '…' : 'Send'}
              </button>
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-subtle)' }}>Aluria asks one focused question at a time.</div>
          </div>
        </main>
      </div>
      {messages.length === 0 && !hasSeenOnboarding && <OnboardingOverlay onComplete={handleOnboardingComplete} />}
    </div>
  )
}

function stageToSection(stage: string): string {
  const map: Record<string, string> = { problem: 'business', actors: 'actors', process: 'process', functional: 'requirements', rules: 'requirements', complete: 'business' }
  return map[stage] ?? 'business'
}

// ─── Critique Panel ───────────────────────────────────────────────────────────

function CritiquePanel({
  critique,
  loading,
  onRefresh,
}: {
  critique: { summary: string; gaps: string[]; risks: string[]; inconsistencies?: string[]; improvements: string[]; score: number } | null
  loading: boolean
  onRefresh: () => void
}) {
  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'var(--surface)', padding: 32 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(251,191,36,0.2)', borderTopColor: '#D97706', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: 14, color: '#D97706', fontWeight: 600 }}>Running senior architect review…</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 260 }}>Analyzing gaps, risks, inconsistencies, and improvements across your system design.</div>
      </div>
    )
  }

  if (!critique) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--surface)', padding: 32 }}>
        <div style={{ fontSize: 36 }}>🔍</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Architect Review</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
          Get a senior architect's assessment of your system — gaps, risks, inconsistencies, and improvements.
        </div>
        <button onClick={onRefresh} style={{ marginTop: 8, padding: '10px 24px', borderRadius: 9, border: 'none', background: '#D97706', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          Run Review
        </button>
      </div>
    )
  }

  const scoreColor = critique.score >= 70 ? 'var(--success)' : critique.score >= 40 ? '#D97706' : '#DC2626'
  const scoreLabel = critique.score >= 70 ? 'Strong' : critique.score >= 40 ? 'Moderate' : 'Weak'

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--surface)', padding: '20px 20px 40px' }}>
      {/* Score header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: '16px 18px', borderRadius: 12, border: `1px solid ${scoreColor}30`, background: `${scoreColor}08` }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 4 }}>SYSTEM SCORE</div>
          <div style={{ fontSize: 36, fontWeight: 900, color: scoreColor, letterSpacing: '-0.02em' }}>{critique.score}<span style={{ fontSize: 16, color: 'var(--text-muted)' }}>/100</span></div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ padding: '4px 14px', borderRadius: 999, border: `1px solid ${scoreColor}40`, background: `${scoreColor}12`, fontSize: 13, fontWeight: 700, color: scoreColor, marginBottom: 8 }}>{scoreLabel}</div>
          <button onClick={onRefresh} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>↻ Re-run</button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ marginBottom: 20, padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 8 }}>SUMMARY</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{critique.summary}</div>
      </div>

      {/* Gaps */}
      {critique.gaps.length > 0 && (
        <CritiqueSection title="Gaps" icon="⚠" color="#DC2626" bg="#FEF2F2" border="#FECACA" items={critique.gaps} />
      )}

      {/* Risks */}
      {critique.risks.length > 0 && (
        <CritiqueSection title="Risks" icon="🔴" color="#D97706" bg="#FFFBEB" border="#FDE68A" items={critique.risks} />
      )}

      {/* Inconsistencies */}
      {(critique.inconsistencies ?? []).length > 0 && (
        <CritiqueSection title="Inconsistencies" icon="⚡" color="#7C3AED" bg="#F5F3FF" border="#DDD6FE" items={critique.inconsistencies!} />
      )}

      {/* Improvements */}
      {critique.improvements.length > 0 && (
        <CritiqueSection title="Improvements" icon="✅" color="#059669" bg="#F0FDF4" border="#BBF7D0" items={critique.improvements} />
      )}
    </div>
  )
}

function CritiqueSection({ title, icon, color, bg, border, items }: { title: string; icon: string; color: string; bg: string; border: string; items: string[] }) {
  return (
    <div style={{ marginBottom: 16, borderRadius: 10, border: `1px solid ${border}`, background: bg, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color, letterSpacing: '0.06em' }}>{title.toUpperCase()}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color, background: `${color}15`, padding: '1px 7px', borderRadius: 999 }}>{items.length}</span>
      </div>
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            <span style={{ color, fontSize: 10, paddingTop: 4, flexShrink: 0 }}>●</span>
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}
