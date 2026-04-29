'use client'

import { useState } from 'react'

const STEPS = [
  {
    title: 'Chat with Aluria to define your system',
    description:
      'Answer Aluria\u2019s focused questions to capture your problem, actors, process flow, and requirements \u2014 one step at a time.',
  },
  {
    title: 'Watch your Knowledge Base build up on the right',
    description:
      'As you chat, the Knowledge Base panel on the right fills in automatically, giving you a live view of your system definition.',
  },
  {
    title: 'Generate your Product System Blueprint when ready',
    description:
      'Once your Knowledge Base is complete, generate a full 19-section Product System Blueprint with one click.',
  },
]

export default function OnboardingOverlay({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0)

  const isFirst = step === 0
  const isLast = step === STEPS.length - 1
  const current = STEPS[step]

  function handleNext() {
    if (isLast) {
      onComplete()
    } else {
      setStep((s) => s + 1)
    }
  }

  function handleBack() {
    if (!isFirst) {
      setStep((s) => s - 1)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Aluria"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.55)',
      }}
    >
      <div
        style={{
          background: 'var(--surface, #ffffff)',
          border: '1px solid var(--border, #e5e7eb)',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
          padding: '36px 40px',
          maxWidth: 480,
          width: '90%',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 20 : 8,
                height: 8,
                borderRadius: 999,
                background: i === step ? 'var(--accent, #6366f1)' : 'var(--border, #e5e7eb)',
                transition: 'width 0.25s ease, background 0.25s ease',
              }}
            />
          ))}
        </div>

        {/* Step label */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--accent, #6366f1)',
              marginBottom: 10,
            }}
          >
            Step {step + 1} of {STEPS.length}
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: 'var(--text-primary, #111827)',
              lineHeight: 1.3,
              marginBottom: 12,
            }}
          >
            {current.title}
          </div>
          <div
            style={{
              fontSize: 14,
              color: 'var(--text-muted, #6b7280)',
              lineHeight: 1.6,
            }}
          >
            {current.description}
          </div>
        </div>

        {/* Navigation buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          {!isFirst && (
            <button
              onClick={handleBack}
              style={{
                padding: '10px 20px',
                borderRadius: 10,
                border: '1px solid var(--border, #e5e7eb)',
                background: 'var(--bg, #f9fafb)',
                color: 'var(--text-secondary, #374151)',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            style={{
              padding: '10px 28px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--accent, #6366f1)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {isLast ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
