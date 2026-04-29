'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useAnimation, AnimatePresence } from 'framer-motion'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#060812',
  surface: '#0D0F1E',
  surface2: '#131629',
  border: 'rgba(255,255,255,0.07)',
  borderHover: 'rgba(99,102,241,0.4)',
  accent: '#6366F1',
  accentLight: 'rgba(99,102,241,0.12)',
  accentGlow: 'rgba(99,102,241,0.3)',
  purple: '#8B5CF6',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  textSubtle: '#475569',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
}

// ─── Reusable animation variants ─────────────────────────────────────────────
const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }
const fadeIn = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.4 } } }
const stagger = { visible: { transition: { staggerChildren: 0.1 } } }

function useScrollReveal() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return { ref, inView }
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  const { ref, inView } = useScrollReveal()
  useEffect(() => {
    if (!inView) return
    let start = 0
    const step = Math.ceil(to / 40)
    const timer = setInterval(() => {
      start += step
      if (start >= to) { setVal(to); clearInterval(timer) }
      else setVal(start)
    }, 30)
    return () => clearInterval(timer)
  }, [inView, to])
  return <span ref={ref}>{val}{suffix}</span>
}

export default function LandingPage() {
  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: 'var(--font-inter), system-ui, sans-serif', minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: rgba(99,102,241,0.35); }
        html { scroll-behavior: smooth; }
        .card-hover { transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease; }
        .card-hover:hover { transform: translateY(-4px); border-color: rgba(99,102,241,0.35) !important; box-shadow: 0 16px 40px rgba(99,102,241,0.12); }
        .btn-primary { transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease; }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 0 48px rgba(99,102,241,0.45) !important; }
        .btn-primary:active { transform: translateY(0); }
        .btn-ghost { transition: background 0.15s ease, border-color 0.15s ease; }
        .btn-ghost:hover { background: rgba(255,255,255,0.06) !important; border-color: rgba(255,255,255,0.18) !important; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes pulse-ring { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(1.6);opacity:0} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .cursor { display:inline-block; width:2px; height:1em; background:currentColor; margin-left:2px; animation:blink 1s step-end infinite; vertical-align:text-bottom; }
        @media (max-width: 768px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .comparison-cols { grid-template-columns: 1fr 80px 80px !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <Nav />
      <Hero />
      <TrustBar />
      <Problem />
      <HowItWorks />
      <SystemBuilderDemo />
      <DepthScoring />
      <PSBOutput />
      <Comparison />
      <Features />
      <FinalCTA />
      <Footer />
    </div>
  )
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])
  return (
    <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, transition: 'background 0.3s, border-color 0.3s', background: scrolled ? 'rgba(6,8,18,0.92)' : 'transparent', backdropFilter: scrolled ? 'blur(16px)' : 'none', borderBottom: scrolled ? `1px solid ${C.border}` : '1px solid transparent', padding: '0 24px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 16px ${C.accentGlow}` }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M10 4l6 6-6 6" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>Aluria</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link href="/auth" className="btn-ghost" style={{ padding: '8px 18px', borderRadius: 8, border: `1px solid ${C.border}`, color: C.textMuted, textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>Sign in</Link>
          <Link href="/app" className="btn-primary" style={{ padding: '9px 20px', borderRadius: 8, background: C.accent, color: 'white', textDecoration: 'none', fontSize: 14, fontWeight: 700, boxShadow: `0 0 24px ${C.accentGlow}` }}>Get started →</Link>
        </div>
      </div>
    </nav>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{ position: 'relative', overflow: 'hidden', padding: '140px 24px 100px', minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      {/* Background glows */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '10%', left: '30%', width: 600, height: 600, background: 'radial-gradient(circle, rgba(99,102,241,0.14) 0%, transparent 65%)', transform: 'translate(-50%,-50%)' }} />
        <div style={{ position: 'absolute', top: '40%', right: '10%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 65%)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 200, background: 'linear-gradient(to top, rgba(6,8,18,1) 0%, transparent 100%)' }} />
      </div>

      <div style={{ maxWidth: 1120, margin: '0 auto', width: '100%', position: 'relative' }}>
        <motion.div initial="hidden" animate="visible" variants={stagger} style={{ textAlign: 'center', marginBottom: 64 }}>
          <motion.div variants={fadeUp} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 999, border: '1px solid rgba(99,102,241,0.35)', background: 'rgba(99,102,241,0.08)', marginBottom: 28, fontSize: 13, color: '#A5B4FC', fontWeight: 500 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#A5B4FC', display: 'inline-block', boxShadow: '0 0 8px #A5B4FC' }} />
            AI System Architect Platform
          </motion.div>

          <motion.h1 variants={fadeUp} style={{ fontSize: 'clamp(42px, 6.5vw, 80px)', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.03em', marginBottom: 24 }}>
            <span style={{ background: 'linear-gradient(135deg, #fff 0%, #C7D2FE 40%, #A78BFA 70%, #fff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundSize: '200% auto' }}>
              From Idea to Product<br />System Blueprint
            </span>
            <br />
            <span style={{ color: C.text }}>in 30 Minutes</span>
          </motion.h1>

          <motion.p variants={fadeUp} style={{ fontSize: 19, color: C.textMuted, lineHeight: 1.7, maxWidth: 580, margin: '0 auto 40px' }}>
            Aluria is an AI System Architect that structures your system, asks the right questions, and generates production-ready BRD, SRS, BPMN, UML, and ERD.
          </motion.p>

          <motion.div variants={fadeUp} style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
            <Link href="/app" className="btn-primary" style={{ padding: '15px 32px', borderRadius: 10, background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, color: 'white', textDecoration: 'none', fontWeight: 700, fontSize: 16, boxShadow: `0 0 40px ${C.accentGlow}`, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              Create Your First Project →
            </Link>
            <a href="#demo" className="btn-ghost" style={{ padding: '15px 28px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)', color: C.text, textDecoration: 'none', fontWeight: 600, fontSize: 16 }}>
              See Demo
            </a>
          </motion.div>
          <motion.p variants={fadeUp} style={{ fontSize: 13, color: C.textSubtle }}>No credit card required · Free to start</motion.p>
        </motion.div>

        {/* Hero animation */}
        <HeroAnimation />
      </div>
    </section>
  )
}

// ─── Hero Animation ───────────────────────────────────────────────────────────
function HeroAnimation() {
  const [step, setStep] = useState(0)
  const [score, setScore] = useState(0)
  const [completion, setCompletion] = useState(0)
  const [actors, setActors] = useState<string[]>([])
  const [reqs, setReqs] = useState<string[]>([])

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    timers.push(setTimeout(() => setStep(1), 800))
    timers.push(setTimeout(() => { setStep(2); setActors(['Customer']) }, 1800))
    timers.push(setTimeout(() => setActors(['Customer', 'Admin']), 2400))
    timers.push(setTimeout(() => setActors(['Customer', 'Admin', 'Driver']), 3000))
    timers.push(setTimeout(() => { setStep(3); setReqs(['Order placement']) }, 3600))
    timers.push(setTimeout(() => setReqs(r => [...r, 'Payment processing']), 4200))
    timers.push(setTimeout(() => setReqs(r => [...r, 'Delivery tracking']), 4800))
    timers.push(setTimeout(() => setStep(4), 5200))

    // Animate score
    let s = 0
    const scoreTimer = setInterval(() => {
      if (s >= 68) { clearInterval(scoreTimer); return }
      s += 2; setScore(s)
    }, 80)
    timers.push(scoreTimer as unknown as ReturnType<typeof setTimeout>)

    // Animate completion
    let c = 0
    const compTimer = setInterval(() => {
      if (c >= 75) { clearInterval(compTimer); return }
      c += 1; setCompletion(c)
    }, 100)
    timers.push(compTimer as unknown as ReturnType<typeof setTimeout>)

    return () => timers.forEach(t => clearTimeout(t))
  }, [])

  const statusColor = score >= 70 ? C.success : score >= 30 ? C.warning : C.danger
  const statusLabel = score >= 70 ? 'Ready' : score >= 30 ? 'Moderate' : 'Shallow'

  return (
    <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 20, boxShadow: '0 40px 100px rgba(0,0,0,0.6)', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 3, marginBottom: 16 }}>
        {['#FF5F57','#FFBD2E','#28CA41'].map((c, i) => <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />)}
        <span style={{ marginLeft: 8, fontSize: 12, color: C.textSubtle }}>aluria.app — Order Management System</span>
      </div>

      <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Chat side */}
        <div style={{ background: C.surface2, borderRadius: 14, padding: 18, minHeight: 320 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textSubtle, letterSpacing: '0.08em', marginBottom: 14 }}>ALURIA CHAT</div>
          <AnimatePresence>
            {step >= 1 && (
              <motion.div key="q1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 10 }}>
                <ChatBubble role="ai" text="What system are you building?" />
              </motion.div>
            )}
            {step >= 1 && (
              <motion.div key="a1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} style={{ marginBottom: 10 }}>
                <ChatBubble role="user" text="Order Management System" />
              </motion.div>
            )}
            {step >= 2 && (
              <motion.div key="q2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 10 }}>
                <ChatBubble role="ai" text="Who are the main actors in this system?" />
              </motion.div>
            )}
            {step >= 3 && (
              <motion.div key="a2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ marginBottom: 10 }}>
                <ChatBubble role="user" text="Customer, Admin, and Driver" />
              </motion.div>
            )}
            {step >= 4 && (
              <motion.div key="q3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 10 }}>
                <ChatBubble role="ai" text="Walk me through the order flow step by step." />
              </motion.div>
            )}
          </AnimatePresence>
          {step < 4 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.accent, animation: 'pulse-ring 1s ease-out infinite' }} />
              <span style={{ fontSize: 12, color: C.textSubtle }}>Aluria is thinking…</span>
            </div>
          )}
        </div>

        {/* System Builder side */}
        <div style={{ background: C.surface2, borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textSubtle, letterSpacing: '0.08em', marginBottom: 14 }}>SYSTEM BUILDER</div>

          {/* Scores */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: C.textSubtle, marginBottom: 2 }}>COMPLETION</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.success }}>{completion}%</div>
            </div>
            <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: C.textSubtle, marginBottom: 2 }}>DEPTH SCORE</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.warning }}>{score}/100</div>
            </div>
          </div>

          {/* Status badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, border: `1px solid ${statusColor}40`, background: `${statusColor}12`, marginBottom: 14 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: statusColor }}>{statusLabel}</span>
          </div>

          {/* Actors */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textSubtle, marginBottom: 6 }}>ACTORS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <AnimatePresence>
                {actors.map((a) => (
                  <motion.span key={a} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} style={{ padding: '3px 10px', borderRadius: 6, background: C.accentLight, border: `1px solid rgba(99,102,241,0.25)`, fontSize: 12, color: '#A5B4FC', fontWeight: 600 }}>
                    {a}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Requirements */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textSubtle, marginBottom: 6 }}>REQUIREMENTS</div>
            <AnimatePresence>
              {reqs.map((r) => (
                <motion.div key={r} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, marginBottom: 6, fontSize: 12, color: C.textMuted }}>
                  <span style={{ color: C.success, fontSize: 10 }}>✓</span> {r}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function ChatBubble({ role, text }: { role: 'ai' | 'user'; text: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: role === 'user' ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: 10, fontSize: 13, lineHeight: 1.5, background: role === 'user' ? C.accent : 'rgba(255,255,255,0.05)', border: role === 'user' ? 'none' : `1px solid ${C.border}`, color: role === 'user' ? 'white' : C.textMuted }}>
        {role === 'ai' && <span style={{ fontSize: 10, fontWeight: 700, color: '#A5B4FC', display: 'block', marginBottom: 3 }}>Aluria</span>}
        {text}
      </div>
    </div>
  )
}

// ─── Trust Bar ────────────────────────────────────────────────────────────────
function TrustBar() {
  const stats = [
    { value: 30, suffix: 'min', label: 'Average time to PSB' },
    { value: 19, suffix: '', label: 'Document sections generated' },
    { value: 100, suffix: '%', label: 'Structured output' },
    { value: 0, suffix: ' CC', label: 'No credit card required' },
  ]
  return (
    <div style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, background: 'rgba(13,15,30,0.8)', padding: '32px 24px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 24 }}>
        {stats.map((s, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: C.text, letterSpacing: '-0.02em' }}>
              <Counter to={s.value} suffix={s.suffix} />
            </div>
            <div style={{ fontSize: 13, color: C.textSubtle, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ badge, title, sub }: { badge?: string; title: string; sub: string }) {
  const { ref, inView } = useScrollReveal()
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? 'visible' : 'hidden'} variants={stagger} style={{ textAlign: 'center', marginBottom: 56 }}>
      {badge && (
        <motion.div variants={fadeUp} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 999, border: `1px solid rgba(99,102,241,0.3)`, background: 'rgba(99,102,241,0.07)', marginBottom: 20, fontSize: 12, color: '#A5B4FC', fontWeight: 600, letterSpacing: '0.04em' }}>
          {badge}
        </motion.div>
      )}
      <motion.h2 variants={fadeUp} style={{ fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.025em', marginBottom: 16 }}>{title}</motion.h2>
      <motion.p variants={fadeUp} style={{ fontSize: 17, color: C.textMuted, maxWidth: 540, margin: '0 auto', lineHeight: 1.65 }}>{sub}</motion.p>
    </motion.div>
  )
}

// ─── Problem ──────────────────────────────────────────────────────────────────
function Problem() {
  const { ref, inView } = useScrollReveal()
  const items = [
    { icon: '⏱', title: 'Writing BRD takes days', desc: 'Manual documentation is slow, tedious, and error-prone. Teams spend more time writing than building.' },
    { icon: '🔍', title: 'Requirements are incomplete', desc: 'Missing edge cases, business rules, and actor responsibilities cause scope creep and rework.' },
    { icon: '💬', title: 'Constant clarification requests', desc: 'Developers keep asking "what did you mean?" mid-sprint, blocking progress and burning time.' },
    { icon: '💸', title: 'Costly rework', desc: 'Miscommunication leads to expensive rebuilds, missed deadlines, and frustrated stakeholders.' },
  ]
  return (
    <section style={{ padding: '100px 24px', background: `linear-gradient(180deg, ${C.bg} 0%, rgba(13,15,30,0.8) 100%)` }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <SectionHeader badge="THE PROBLEM" title="Traditional requirements gathering is broken" sub="Most teams ship with incomplete, inconsistent, or unclear requirements — and pay for it later." />
        <motion.div ref={ref} initial="hidden" animate={inView ? 'visible' : 'hidden'} variants={stagger}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          {items.map((item, i) => (
            <motion.div key={i} variants={fadeUp} className="card-hover" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(248,113,113,0.5), transparent)' }} />
              <div style={{ fontSize: 36, marginBottom: 16 }}>{item.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: C.text }}>{item.title}</h3>
              <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.65 }}>{item.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ─── How It Works ─────────────────────────────────────────────────────────────
function HowItWorks() {
  const { ref, inView } = useScrollReveal()
  const steps = [
    { n: '01', title: 'Describe your idea', desc: 'Start with a project name and description — or just a rough concept. Aluria handles the rest.', icon: '💡' },
    { n: '02', title: 'AI pre-analyzes instantly', desc: 'Aluria bootstraps your knowledge base from your description before asking the first question.', icon: '⚡' },
    { n: '03', title: 'Guided questioning', desc: 'One sharp, context-aware question at a time — like a senior consultant, not a chatbot.', icon: '🎯' },
    { n: '04', title: 'Live system builder', desc: 'Watch your system structure take shape in real-time as you answer each question.', icon: '🏗' },
    { n: '05', title: 'Generate your PSB', desc: 'Export a complete 19-section Product System Blueprint as PDF or Markdown instantly.', icon: '📄' },
  ]
  return (
    <section style={{ padding: '100px 24px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <SectionHeader badge="HOW IT WORKS" title="A structured way to design systems" sub="Five steps from idea to production-ready documentation." />
        <motion.div ref={ref} initial="hidden" animate={inView ? 'visible' : 'hidden'} variants={stagger}
          className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          {steps.map((step, i) => (
            <motion.div key={i} variants={fadeUp} style={{ position: 'relative' }}>
              {i < steps.length - 1 && (
                <div style={{ position: 'absolute', top: 28, left: '60%', right: '-40%', height: 1, background: 'linear-gradient(90deg, rgba(99,102,241,0.4), transparent)', zIndex: 0 }} />
              )}
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, position: 'relative', zIndex: 1, height: '100%' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: C.accentLight, border: `1px solid rgba(99,102,241,0.25)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 16 }}>
                  {step.icon}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, marginBottom: 8, letterSpacing: '0.06em' }}>{step.n}</div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: C.text }}>{step.title}</h3>
                <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ─── System Builder Demo ──────────────────────────────────────────────────────
function SystemBuilderDemo() {
  const { ref, inView } = useScrollReveal()
  const sections = [
    { key: 'business', label: 'Business', filled: true },
    { key: 'actors', label: 'Actors', filled: true },
    { key: 'use-cases', label: 'Use Cases', filled: true },
    { key: 'process', label: 'Process', filled: true },
    { key: 'data-model', label: 'Data Model', filled: false },
    { key: 'requirements', label: 'Requirements', filled: true },
    { key: 'system-design', label: 'System Design', filled: false },
  ]
  const messages = [
    { role: 'ai', text: 'Walk me through the order flow, step by step.' },
    { role: 'user', text: 'Customer orders → system validates → kitchen prepares → driver picks up → delivers' },
    { role: 'ai', text: 'What happens if the kitchen rejects an order?' },
    { role: 'user', text: 'Customer gets notified and can reorder or get a refund' },
  ]
  return (
    <section id="demo" style={{ padding: '100px 24px', background: `linear-gradient(180deg, ${C.bg} 0%, rgba(13,15,30,0.9) 100%)` }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <SectionHeader badge="LIVE SYSTEM BUILDER" title="Your system builds itself as you talk" sub="The right panel updates in real-time as Aluria extracts structured data from your answers." />
        <motion.div ref={ref} initial={{ opacity: 0, y: 32 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }}>
          {/* Window chrome */}
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8, background: C.surface2 }}>
            {['#FF5F57','#FFBD2E','#28CA41'].map((c, i) => <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />)}
            <span style={{ marginLeft: 8, fontSize: 12, color: C.textSubtle }}>Restaurant Order System — aluria.app</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 480 }}>
            {/* Chat */}
            <div style={{ padding: 28, borderRight: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Restaurant Order System</div>
                  <div style={{ fontSize: 12, color: C.textSubtle }}>Stage: <span style={{ color: '#A5B4FC', fontWeight: 600 }}>process</span></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: C.textSubtle }}>75%</span>
                  <div style={{ width: 80, height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: '75%', height: '100%', background: `linear-gradient(90deg, ${C.accent}, ${C.purple})` }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.map((m, i) => <ChatBubble key={i} role={m.role as 'ai' | 'user'} text={m.text} />)}
              </div>
            </div>

            {/* System Builder Panel */}
            <div style={{ display: 'flex' }}>
              {/* Nav */}
              <div style={{ width: 140, borderRight: `1px solid ${C.border}`, padding: '16px 0', background: C.surface2 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.textSubtle, padding: '0 14px', marginBottom: 10, letterSpacing: '0.08em' }}>SECTIONS</div>
                {sections.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', fontSize: 12, color: s.filled ? C.text : C.textSubtle, fontWeight: s.filled ? 600 : 400, borderLeft: s.key === 'process' ? `2px solid ${C.accent}` : '2px solid transparent', background: s.key === 'process' ? C.accentLight : 'transparent' }}>
                    <span>{s.label}</span>
                    {!s.filled && <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.warning, display: 'inline-block' }} />}
                  </div>
                ))}
              </div>

              {/* Content */}
              <div style={{ flex: 1, padding: 20, overflow: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: C.textSubtle, marginBottom: 2 }}>COMPLETION</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: C.success }}>75%</div>
                  </div>
                  <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: C.textSubtle, marginBottom: 2 }}>DEPTH</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: C.warning }}>68/100</div>
                  </div>
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.textSubtle, marginBottom: 8 }}>PROCESS FLOW</div>
                {['Customer places order', 'System validates payment', 'Kitchen receives & prepares', 'Driver picks up order', 'Delivery confirmed'].map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, marginBottom: 6, fontSize: 12, color: C.textMuted }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: C.accentLight, border: `1px solid rgba(99,102,241,0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#A5B4FC', flexShrink: 0 }}>{i + 1}</span>
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ─── Depth Scoring ────────────────────────────────────────────────────────────
function DepthScoring() {
  const { ref, inView } = useScrollReveal()
  const sections = [
    { label: 'Normal Use Cases', score: 20, max: 20, pct: 100 },
    { label: 'Edge Use Cases', score: 16, max: 24, pct: 67 },
    { label: 'Process Flow', score: 15, max: 15, pct: 100 },
    { label: 'Data Model', score: 6, max: 18, pct: 33 },
    { label: 'Requirements', score: 11, max: 24, pct: 46 },
  ]
  return (
    <section style={{ padding: '100px 24px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <SectionHeader badge="DEPTH SCORING" title="Know when your system is actually ready" sub="Aluria measures requirement quality across every dimension — not just quantity." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
          <motion.div ref={ref} initial={{ opacity: 0, x: -24 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6 }}>
            <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Weighted scoring across 5 dimensions</h3>
            <p style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.7, marginBottom: 28 }}>
              Unlike simple word counts, Aluria's depth score measures the structural completeness of your system — edge cases, process steps, data entities, and more.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[{ label: 'Shallow', color: C.danger, range: '0–29' }, { label: 'Moderate', color: C.warning, range: '30–69' }, { label: 'Ready', color: C.success, range: '70–100' }].map((s) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, border: `1px solid ${s.color}40`, background: `${s.color}10` }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: s.color }}>{s.label}</span>
                  <span style={{ fontSize: 12, color: C.textSubtle }}>{s.range}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 24 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6, delay: 0.15 }}
            style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 13, color: C.textSubtle, marginBottom: 4 }}>Overall Depth Score</div>
                <div style={{ fontSize: 40, fontWeight: 900, color: C.warning, letterSpacing: '-0.02em' }}>68<span style={{ fontSize: 20, color: C.textSubtle }}>/100</span></div>
              </div>
              <div style={{ padding: '6px 16px', borderRadius: 999, border: `1px solid ${C.warning}40`, background: `${C.warning}10`, fontSize: 13, fontWeight: 700, color: C.warning }}>Moderate</div>
            </div>
            {sections.map((s, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: C.textMuted }}>{s.label}</span>
                  <span style={{ fontSize: 12, color: C.textSubtle }}>{s.score}/{s.max}</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
                  <motion.div initial={{ width: 0 }} animate={inView ? { width: `${s.pct}%` } : {}} transition={{ duration: 0.8, delay: 0.3 + i * 0.1, ease: 'easeOut' }}
                    style={{ height: '100%', borderRadius: 999, background: s.pct >= 80 ? C.success : s.pct >= 40 ? C.warning : C.danger }} />
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ─── PSB Output ───────────────────────────────────────────────────────────────
function PSBOutput() {
  const { ref, inView } = useScrollReveal()
  const sections = [
    { num: 1, title: 'Executive Summary', preview: 'Restaurant order management system solving order tracking...' },
    { num: 2, title: 'Problem Statement', preview: 'Orders are lost between kitchen and delivery staff...' },
    { num: 8, title: 'Use Cases', preview: '3 normal flows · 2 edge cases · UML sequence diagram' },
    { num: 9, title: 'Process Flow', preview: '5 steps · BPMN flowchart · decision points' },
    { num: 12, title: 'Data Model (ERD)', preview: 'Order, Customer, Driver, Product · 4 relationships' },
    { num: 14, title: 'API Design', preview: 'POST /orders · GET /orders/:id · PATCH /orders/:id/status' },
    { num: 18, title: 'Risk Register', preview: '3 risks identified from business rules' },
    { num: 19, title: 'Implementation Roadmap', preview: 'Phase 1: Core · Phase 2: Extended · Phase 3: Advanced' },
  ]
  return (
    <section style={{ padding: '100px 24px', background: `linear-gradient(180deg, ${C.bg} 0%, rgba(13,15,30,0.9) 100%)` }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <SectionHeader badge="PSB OUTPUT" title="Generate a complete Product System Blueprint" sub="19 structured sections covering every aspect of your system — ready to share with your team." />
        <motion.div ref={ref} initial={{ opacity: 0, y: 32 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
          {/* Header */}
          <div style={{ padding: '20px 28px', borderBottom: `1px solid ${C.border}`, background: C.surface2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Product System Blueprint — Restaurant Order System</div>
              <div style={{ fontSize: 12, color: C.textSubtle }}>Generated · Completion: 75% · Depth Score: 68/100</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ padding: '6px 14px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 12, color: C.textMuted, fontWeight: 600 }}>↓ Markdown</div>
              <div style={{ padding: '6px 14px', borderRadius: 7, background: C.accent, fontSize: 12, color: 'white', fontWeight: 700 }}>Download PSB</div>
            </div>
          </div>

          {/* Two-column layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr' }}>
            {/* Nav */}
            <div style={{ borderRight: `1px solid ${C.border}`, padding: '16px 0', background: C.surface2 }}>
              {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19].slice(0, 10).map((n) => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', fontSize: 11, color: n === 9 ? '#A5B4FC' : C.textSubtle, fontWeight: n === 9 ? 700 : 400, borderLeft: n === 9 ? `2px solid ${C.accent}` : '2px solid transparent', background: n === 9 ? C.accentLight : 'transparent' }}>
                  <span style={{ fontSize: 10, minWidth: 16 }}>{n}</span>
                  <span>{['Exec Summary','Problem','Objectives','Stakeholders','AS-IS','TO-BE','Improvements','Use Cases','Process Flow','Functional Req.'][n-1]}</span>
                </div>
              ))}
              <div style={{ padding: '6px 14px', fontSize: 11, color: C.textSubtle }}>···</div>
            </div>

            {/* Content preview */}
            <div style={{ padding: 28 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {sections.map((s, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.1 + i * 0.06 }}
                    style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: C.accent, background: C.accentLight, padding: '2px 7px', borderRadius: 4 }}>{s.num}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{s.title}</span>
                    </div>
                    <p style={{ fontSize: 12, color: C.textSubtle, lineHeight: 1.5 }}>{s.preview}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ─── Comparison ───────────────────────────────────────────────────────────────
function Comparison() {
  const { ref, inView } = useScrollReveal()
  const rows = [
    { feature: 'Structured system thinking', chatgpt: false, aluria: true },
    { feature: 'Guided questioning (1 Q at a time)', chatgpt: false, aluria: true },
    { feature: 'Depth scoring & quality gates', chatgpt: false, aluria: true },
    { feature: 'Live knowledge base builder', chatgpt: false, aluria: true },
    { feature: 'Anti-shallow guard', chatgpt: false, aluria: true },
    { feature: 'BPMN + UML + ERD diagrams', chatgpt: false, aluria: true },
    { feature: '19-section PSB output', chatgpt: false, aluria: true },
    { feature: 'Deterministic, reproducible output', chatgpt: false, aluria: true },
  ]
  return (
    <section style={{ padding: '100px 24px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <SectionHeader badge="COMPARISON" title="Not just another AI chatbot" sub="Aluria thinks like a senior system analyst — structured, deterministic, and thorough." />
        <motion.div ref={ref} initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, overflow: 'hidden' }}>
          {/* Header row */}
          <div className="comparison-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: C.textSubtle }}>FEATURE</div>
            <div style={{ padding: '16px 0', fontSize: 12, fontWeight: 700, color: C.textSubtle, textAlign: 'center' }}>ChatGPT</div>
            <div style={{ padding: '16px 0', fontSize: 12, fontWeight: 700, color: '#A5B4FC', textAlign: 'center', background: 'rgba(99,102,241,0.07)' }}>Aluria</div>
          </div>
          {rows.map((row, i) => (
            <motion.div key={i} initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ delay: 0.1 + i * 0.06 }}
              className="comparison-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ padding: '14px 24px', fontSize: 14, color: C.textMuted }}>{row.feature}</div>
              <div style={{ padding: '14px 0', textAlign: 'center', fontSize: 18, color: C.textSubtle }}>—</div>
              <div style={{ padding: '14px 0', textAlign: 'center', background: 'rgba(99,102,241,0.04)' }}>
                <motion.span initial={{ scale: 0 }} animate={inView ? { scale: 1 } : {}} transition={{ delay: 0.3 + i * 0.06, type: 'spring', stiffness: 300 }}
                  style={{ display: 'inline-block', fontSize: 16, color: C.success, fontWeight: 700 }}>✓</motion.span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────────
function Features() {
  const { ref, inView } = useScrollReveal()
  const features = [
    { icon: '🚀', title: 'AI Bootstrap', desc: 'Analyzes your description and pre-fills the knowledge base before the first question — saving 10+ minutes.' },
    { icon: '🎯', title: 'Guided Questioning', desc: 'One sharp, context-aware question at a time. No generic prompts. No information overload.' },
    { icon: '📊', title: 'Depth Scoring V2', desc: 'Weighted scoring across use cases, process, data model, and requirements. Know when you\'re actually ready.' },
    { icon: '🏗', title: 'Live System Builder', desc: 'Watch your system structure build in real-time. Edit any field inline without re-entering the chat.' },
    { icon: '🛡', title: 'Anti-Shallow Guard', desc: 'Automatically detects shallow requirements and forces deeper exploration before advancing stages.' },
    { icon: '📄', title: 'PSB Export', desc: 'Download a complete 19-section Product System Blueprint as PDF or Markdown — ready to share.' },
  ]
  return (
    <section style={{ padding: '100px 24px', background: `linear-gradient(180deg, ${C.bg} 0%, rgba(13,15,30,0.9) 100%)` }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <SectionHeader badge="FEATURES" title="Built for system analysts and product teams" sub="Everything you need to go from idea to production-ready documentation." />
        <motion.div ref={ref} initial="hidden" animate={inView ? 'visible' : 'hidden'} variants={stagger}
          className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {features.map((f, i) => (
            <motion.div key={i} variants={fadeUp} className="card-hover" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, rgba(99,102,241,0.4), transparent)` }} />
              <div style={{ width: 52, height: 52, borderRadius: 14, background: C.accentLight, border: `1px solid rgba(99,102,241,0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 18 }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: C.text }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.65 }}>{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ─── Final CTA ────────────────────────────────────────────────────────────────
function FinalCTA() {
  const { ref, inView } = useScrollReveal()
  return (
    <section style={{ padding: '100px 24px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <motion.div ref={ref} initial={{ opacity: 0, y: 32 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}
          style={{ position: 'relative', background: `linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%)`, border: '1px solid rgba(99,102,241,0.3)', borderRadius: 24, padding: '72px 48px', textAlign: 'center', overflow: 'hidden' }}>
          {/* Glow */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 400, height: 400, background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 999, border: '1px solid rgba(99,102,241,0.35)', background: 'rgba(99,102,241,0.08)', marginBottom: 24, fontSize: 12, color: '#A5B4FC', fontWeight: 600 }}>
              🚀 Start building in 2 minutes
            </div>
            <h2 style={{ fontSize: 'clamp(30px, 4.5vw, 52px)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.025em', marginBottom: 18 }}>
              Start building systems<br />the right way
            </h2>
            <p style={{ fontSize: 17, color: C.textMuted, marginBottom: 40, lineHeight: 1.6 }}>
              Join teams who replaced manual BRD writing with Aluria.<br />No credit card required.
            </p>
            <Link href="/app" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '16px 40px', borderRadius: 12, background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, color: 'white', textDecoration: 'none', fontWeight: 700, fontSize: 17, boxShadow: `0 0 48px ${C.accentGlow}` }}>
              Create Your First Project →
            </Link>
            <div style={{ marginTop: 20, fontSize: 13, color: C.textSubtle }}>
              Free to start · No credit card · PSB in 30 minutes
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${C.border}`, padding: '40px 24px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M10 4l6 6-6 6" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em' }}>Aluria</span>
        </div>
        <div style={{ fontSize: 13, color: C.textSubtle }}>© 2026 Aluria — AI System Architect Platform</div>
        <div style={{ display: 'flex', gap: 20 }}>
          <Link href="/auth" style={{ fontSize: 13, color: C.textSubtle, textDecoration: 'none' }}>Sign in</Link>
          <Link href="/app" style={{ fontSize: 13, color: C.textSubtle, textDecoration: 'none' }}>Get started</Link>
        </div>
      </div>
    </footer>
  )
}
