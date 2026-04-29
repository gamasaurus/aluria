'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      style={{
        padding: '6px 12px', borderRadius: 7,
        border: '1px solid var(--border)', background: 'var(--bg)',
        color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      Sign out
    </button>
  )
}
