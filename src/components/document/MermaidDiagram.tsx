'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  chart: string
}

// Unique ID counter so multiple diagrams on the same page don't clash
let idCounter = 0

export default function MermaidDiagram({ chart }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'rendered' | 'error'>('loading')
  const idRef = useRef(`mermaid-${++idCounter}`)

  useEffect(() => {
    if (!chart) return

    // Reset to loading state whenever the chart string changes
    setStatus('loading')

    let cancelled = false

    async function render() {
      try {
        // Dynamically import mermaid — works with both npm install and CDN fallback
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let mermaid: any

        try {
          // Use the installed npm package
          mermaid = (await import('mermaid')).default
        } catch {
          // Fallback: load from CDN via window global
          mermaid = (window as unknown as Record<string, unknown>)['mermaid']
          if (!mermaid) {
            await loadMermaidFromCDN()
            mermaid = (window as unknown as Record<string, unknown>)['mermaid']
          }
        }

        if (!mermaid || cancelled) return

        mermaid.initialize({
          startOnLoad: false,
          theme: 'neutral',
          flowchart: {
            curve: 'basis',
            padding: 20,
            nodeSpacing: 50,
            rankSpacing: 60,
          },
          themeVariables: {
            primaryColor: '#EEF2FF',
            primaryTextColor: '#111827',
            primaryBorderColor: '#6366F1',
            lineColor: '#6366F1',
            secondaryColor: '#F3F4F6',
            tertiaryColor: '#FFFFFF',
            fontSize: '13px',
          },
        })

        const { svg } = await mermaid.render(idRef.current, chart)

        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg
          // Make SVG responsive
          const svgEl = containerRef.current.querySelector('svg')
          if (svgEl) {
            svgEl.style.maxWidth = '100%'
            svgEl.style.height = 'auto'
            svgEl.removeAttribute('width')
          }
          setStatus('rendered')
        }
      } catch (err) {
        console.error('[MermaidDiagram] render error:', err)
        if (!cancelled) setStatus('error')
      }
    }

    render()
    return () => { cancelled = true }
  }, [chart])

  if (!chart) return null

  return (
    <div>
      {status === 'loading' && (
        <div style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 13,
          border: '1px solid var(--border)',
          borderRadius: 10,
          background: 'var(--bg)',
        }}>
          <div style={{ animation: 'pulse-subtle 1.2s ease-in-out infinite' }}>Rendering diagram…</div>
        </div>
      )}

      {status === 'error' && (
        <div style={{
          padding: '16px',
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'var(--bg)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            Could not render diagram. Raw definition:
          </div>
          <pre style={{
            fontFamily: 'monospace',
            fontSize: 11,
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {chart}
          </pre>
        </div>
      )}

      {/* SVG is injected here by mermaid.render() */}
      <div
        ref={containerRef}
        style={{
          display: status === 'rendered' ? 'block' : 'none',
          padding: '16px',
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'var(--bg)',
          overflow: 'auto',
          textAlign: 'center',
        }}
      />

      {status === 'rendered' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={() => downloadSVG(containerRef.current)}
            style={{
              padding: '5px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-strong)',
              background: 'var(--bg)',
              color: 'var(--text-secondary)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ↓ SVG
          </button>
          <button
            onClick={() => downloadPNG(containerRef.current)}
            style={{
              padding: '5px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-strong)',
              background: 'var(--bg)',
              color: 'var(--text-secondary)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ↓ PNG
          </button>
        </div>
      )}
    </div>
  )
}

// ─── CDN loader ───────────────────────────────────────────────────────────────

function loadMermaidFromCDN(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('mermaid-cdn')) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.id = 'mermaid-cdn'
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Mermaid from CDN'))
    document.head.appendChild(script)
  })
}

// ─── Download helpers ─────────────────────────────────────────────────────────

function downloadSVG(container: HTMLDivElement | null) {
  if (!container) return
  const svg = container.querySelector('svg')
  if (!svg) return

  const serializer = new XMLSerializer()
  const svgStr = serializer.serializeToString(svg)
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'process-flow.svg'
  a.click()
  URL.revokeObjectURL(url)
}

function downloadPNG(container: HTMLDivElement | null) {
  if (!container) return
  const svg = container.querySelector('svg')
  if (!svg) return

  const serializer = new XMLSerializer()
  const svgStr = serializer.serializeToString(svg)

  // Get actual dimensions
  const bbox = svg.getBoundingClientRect()
  const width = Math.max(bbox.width, 800)
  const height = Math.max(bbox.height, 400)

  const canvas = document.createElement('canvas')
  canvas.width = width * 2   // 2x for retina
  canvas.height = height * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.scale(2, 2)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  const img = new Image()
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  img.onload = () => {
    ctx.drawImage(img, 0, 0)
    URL.revokeObjectURL(url)
    const a = document.createElement('a')
    a.download = 'process-flow.png'
    a.href = canvas.toDataURL('image/png')
    a.click()
  }
  img.src = url
}
