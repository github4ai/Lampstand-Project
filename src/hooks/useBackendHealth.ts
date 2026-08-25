import { useCallback, useEffect, useRef, useState } from 'react'

import { AIOS_API_BASE_URL } from '../config/api'

export type BackendHealth = 'checking' | 'connected' | 'unavailable'

export function useBackendHealth() {
  const [status, setStatus] = useState<BackendHealth>('checking')
  const requestRef = useRef<AbortController | null>(null)

  const check = useCallback(async () => {
    requestRef.current?.abort()
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 4000)
    requestRef.current = controller

    try {
      const response = await fetch(`${AIOS_API_BASE_URL}/health`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!controller.signal.aborted) setStatus(response.ok ? 'connected' : 'unavailable')
    } catch {
      if (requestRef.current === controller) setStatus('unavailable')
    } finally {
      window.clearTimeout(timeout)
      if (requestRef.current === controller) requestRef.current = null
    }
  }, [])

  useEffect(() => {
    void check()
    const timer = window.setInterval(() => void check(), 10000)
    const checkWhenVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    window.addEventListener('focus', checkWhenVisible)
    document.addEventListener('visibilitychange', checkWhenVisible)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', checkWhenVisible)
      document.removeEventListener('visibilitychange', checkWhenVisible)
      requestRef.current?.abort()
    }
  }, [check])

  return { status, check }
}
