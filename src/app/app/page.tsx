import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'

type Project = { id: string; name: string; created_at: string; description?: string | null }

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data } = await supabase
    .from('projects')
    .select('id, name, created_at, description')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const projects: Project[] = data ?? []

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top nav ── */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: '0 32px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
              <path d="M4 10h12M10 4l6 6-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>Aluria</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user.email}</span>
          <SignOutButton />
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ flex: 1, padding: '40px 32px', maxWidth: 960, width: '100%', margin: '0 auto' }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Projects</h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>
              {projects.length === 0
                ? 'No projects yet — create your first one.'
                : `${projects.length} project${projects.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <Link
            href="/app/new"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 18px', borderRadius: 9,
              background: 'var(--accent)', color: 'white',
              fontWeight: 700, fontSize: 14, textDecoration: 'none',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M10 4v12M4 10h12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            New Project
          </Link>
        </div>

        {/* Empty state */}
        {projects.length === 0 && (
          <div style={{
            border: '2px dashed var(--border)',
            borderRadius: 14,
            padding: '60px 32px',
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              No projects yet
            </div>
            <div style={{ fontSize: 14, marginBottom: 24 }}>
              Create your first project to start defining your system with Aluria.
            </div>
            <Link
              href="/app/new"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '10px 20px', borderRadius: 9,
                background: 'var(--accent)', color: 'white',
                fontWeight: 700, fontSize: 14, textDecoration: 'none',
              }}
            >
              Create Project
            </Link>
          </div>
        )}

        {/* Project grid */}
        {projects.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
          }}>
            {projects.map((p) => (
              <Link key={p.id} href={`/app/project/${p.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '20px',
                  cursor: 'pointer',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  boxSizing: 'border-box',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9,
                    background: 'var(--accent-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="3"/>
                      <path d="M8 12h8M8 8h5M8 16h3"/>
                    </svg>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {p.name}
                  </div>
                  {p.description && (
                    <div style={{
                      fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    } as React.CSSProperties}>
                      {p.description}
                    </div>
                  )}
                  <div style={{ marginTop: 'auto', paddingTop: 4, fontSize: 12, color: 'var(--text-subtle)' }}>
                    {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
