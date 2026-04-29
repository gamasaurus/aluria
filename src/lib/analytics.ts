/**
 * Lightweight analytics helper.
 *
 * - Development: logs to console.
 * - Production (client): fire-and-forget POST to /api/analytics.
 * - Production (server): fire-and-forget POST to /api/analytics using absolute URL,
 *   or falls back to a no-op if the base URL is unavailable.
 * - Never throws.
 */
export function trackEvent(event: string, data?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === 'development') {
    console.log('[analytics]', event, data)
    return
  }

  // Production: fire-and-forget, swallow all errors silently
  try {
    // Determine the correct URL — relative works in browser, absolute needed on server
    const isServer = typeof window === 'undefined'
    let url: string

    if (isServer) {
      // On the server, build an absolute URL from NEXT_PUBLIC_SITE_URL or VERCEL_URL
      const base =
        process.env.NEXT_PUBLIC_SITE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)

      if (!base) {
        // No base URL available — skip the HTTP call silently
        return
      }
      url = `${base}/api/analytics`
    } else {
      url = '/api/analytics'
    }

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data }),
    }).catch(() => {
      // intentionally swallowed
    })
  } catch {
    // intentionally swallowed
  }
}
