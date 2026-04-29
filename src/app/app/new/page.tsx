'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TEMPLATES } from '@/lib/templates'

export default function NewProjectPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), template_id: selectedTemplate }),
      })
      const data = await res.json()

      if (!res.ok || !data.project) {
        setError(data.error ?? 'Failed to create project')
        setLoading(false)
        return
      }

      router.push(`/app/project/${data.project.id}`)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const canSubmit = name.trim().length > 0 && !loading

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '520px' }}>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path d="M4 10h12M10 4l6 6-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span style={{ fontWeight: '700', fontSize: '18px' }}>Aluria</span>
            </div>
            <Link href="/app" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              ← Projects
            </Link>
          </div>

          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
            Start a new session
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Describe your project and Aluria will pre-analyze it before the first question.
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '28px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <form onSubmit={handleCreate}>

            {/* Project name */}
            <label style={{
              display: 'block', fontSize: '13px', fontWeight: '600',
              color: 'var(--text-secondary)', marginBottom: '6px',
            }}>
              Project name <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              id="project-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Order Management System"
              autoFocus
              required
              style={{
                width: '100%', padding: '10px 14px',
                borderRadius: '8px', border: '1px solid var(--border-strong)',
                background: 'var(--bg)', color: 'var(--text-primary)',
                fontSize: '14px', marginBottom: '20px',
                outline: 'none', transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border-strong)')}
            />

            {/* Description */}
            <label style={{
              display: 'block', fontSize: '13px', fontWeight: '600',
              color: 'var(--text-secondary)', marginBottom: '6px',
            }}>
              Project description
              <span style={{ fontWeight: '400', color: 'var(--text-muted)', marginLeft: '6px' }}>
                (optional — helps Aluria pre-analyze your system)
              </span>
            </label>
            <textarea
              id="project-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you're building, who will use it, and what problem it solves. The more detail you provide, the smarter Aluria's first questions will be."
              rows={5}
              style={{
                width: '100%', padding: '10px 14px',
                borderRadius: '8px', border: '1px solid var(--border-strong)',
                background: 'var(--bg)', color: 'var(--text-primary)',
                fontSize: '14px', marginBottom: '8px',
                outline: 'none', transition: 'border-color 0.15s',
                resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.6',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border-strong)')}
            />

            {/* Description hint */}
            {description.length > 0 && description.length < 10 && (
              <p style={{ fontSize: '12px', color: 'var(--warning)', marginBottom: '16px' }}>
                Add a bit more detail for AI pre-analysis to kick in.
              </p>
            )}
            {description.length >= 10 && (
              <p style={{ fontSize: '12px', color: 'var(--success)', marginBottom: '16px' }}>
                ✓ Aluria will pre-analyze this description before your first question.
              </p>
            )}
            {description.length === 0 && (
              <p style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '16px' }}>
                Skip to start from scratch.
              </p>
            )}

            {/* Template cards */}
            <div style={{ marginBottom: '20px' }}>
              <p style={{
                fontSize: '13px', fontWeight: '600',
                color: 'var(--text-secondary)', marginBottom: '10px',
              }}>
                Or start from a template
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
              }}>
                {Object.entries(TEMPLATES).map(([key, tpl]) => {
                  const isSelected = selectedTemplate === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedTemplate(null)
                        } else {
                          setSelectedTemplate(key)
                          setDescription(tpl.description)
                        }
                      }}
                      style={{
                        textAlign: 'left',
                        padding: '12px',
                        borderRadius: '8px',
                        border: isSelected
                          ? '2px solid var(--accent)'
                          : '1px solid var(--border-strong)',
                        background: isSelected
                          ? 'color-mix(in srgb, var(--accent) 8%, var(--bg))'
                          : 'var(--bg)',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s, background 0.15s',
                      }}
                    >
                      <div style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                        marginBottom: '4px',
                      }}>
                        {tpl.label}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        lineHeight: '1.4',
                      }}>
                        {tpl.description}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {error && (
              <p style={{
                color: '#DC2626', fontSize: '13px', marginBottom: '16px',
                padding: '10px 12px', background: '#FEF2F2',
                borderRadius: '6px', border: '1px solid #FECACA',
              }}>
                {error}
              </p>
            )}

            <button
              id="create-project-btn"
              type="submit"
              disabled={!canSubmit}
              style={{
                width: '100%', padding: '11px',
                borderRadius: '8px',
                background: !canSubmit ? 'var(--border-strong)' : 'var(--accent)',
                color: 'white', fontWeight: '600', fontSize: '14px',
                border: 'none', cursor: !canSubmit ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {loading
                ? (description.length >= 10 ? 'Analyzing description…' : 'Creating…')
                : 'Start session →'}
            </button>
          </form>
        </div>

        <p style={{ marginTop: '16px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: '12px' }}>
          Examples: Inventory System, Booking Platform, Delivery Tracker
        </p>
      </div>
    </div>
  )
}
