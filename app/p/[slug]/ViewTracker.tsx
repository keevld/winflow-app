'use client'

import { useEffect, useRef } from 'react'

// Fires a 'view' beacon on mount and a 'time_spent' beacon when the
// prospect leaves the page or backgrounds the tab. Fire-and-forget:
// tracking failures must never affect what the prospect sees.
export default function ViewTracker({ slug, disabled = false }: { slug: string; disabled?: boolean }) {
  const startRef = useRef<number>(Date.now())
  const sentRef = useRef(false)

  useEffect(() => {
    if (disabled) return
    const trackUrl = `/api/public/proposals/${slug}/track`

    fetch(trackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'view' }),
      keepalive: true,
    }).catch(() => {})

    const sendTimeSpent = () => {
      if (sentRef.current) return
      sentRef.current = true
      const durationSeconds = Math.round((Date.now() - startRef.current) / 1000)
      if (durationSeconds < 1) return

      const payload = JSON.stringify({ event_type: 'time_spent', duration_seconds: durationSeconds })
      if (navigator.sendBeacon) {
        navigator.sendBeacon(trackUrl, new Blob([payload], { type: 'application/json' }))
      } else {
        fetch(trackUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {})
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') sendTimeSpent()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', sendTimeSpent)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', sendTimeSpent)
    }
  }, [slug, disabled])

  return null
}
