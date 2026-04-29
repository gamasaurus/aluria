'use client'

import type { KBInsight } from '@/lib/ai/quality'

interface Props {
  insights: KBInsight[]
  onSectionFocus: (section: string) => void
}

export default function AIInsightPanel({ insights, onSectionFocus }: Props) {
  if (insights.length === 0) return null

  const high = insights.filter((i) => i.severity === 'high')
  const medium = insights.filter((i) => i.severity === 'medium')
  const low = insights.filter((i) => i.severity === 'low')

  const groups: Array<{ label: string; items: KBInsight[]; color: string; bg: string; border: string }> = [
    { label: 'High Priority', items: high, color: '#991B1B', bg: '#FEF2F2', border: '#FECACA' },
    { label: 'Medium Priority', items: medium, color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
    { label: 'Low Priority', items: low, color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  ].filter((g) => g.items.length > 0)

  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 10,
      border: '1px solid var(--border)',
      background: 'var(--bg)',
      marginBottom: 16,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>
        AI INSIGHTS
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {groups.map(({ label, items, color, bg, border }) => (
          <div key={label}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color,
              background: bg,
              border: `1px solid ${border}`,
              borderRadius: 6,
              padding: '3px 8px',
              display: 'inline-block',
              marginBottom: 6,
            }}>
              {label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {items.map((insight, i) => (
                <div
                  key={i}
                  onClick={() => onSectionFocus(insight.section)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: `1px solid ${border}`,
                    background: bg,
                    cursor: 'pointer',
                    fontSize: 12,
                    color,
                    lineHeight: 1.5,
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '0.8' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '1' }}
                >
                  <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{insight.section.replace(/_/g, ' ')}: </span>
                  {insight.message}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
