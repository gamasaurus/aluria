import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')

  // If there's no code, send them back to sign-in.
  if (!code) {
    return NextResponse.redirect(new URL('/auth', request.url))
  }

  // We must write auth cookies on the redirect response.
  let response = NextResponse.redirect(new URL('/app', request.url))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Only write cookies to the outgoing response.
          response = NextResponse.redirect(new URL('/app', request.url))
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.exchangeCodeForSession(code)

  return response
}

