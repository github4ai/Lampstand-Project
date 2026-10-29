import { useCallback, useEffect, useRef, useState } from 'react'

import { AIOS_API_BASE_URL } from '../config/api'

export type GraphicsReadout = {
  name: string
  vendor: string
  percent: number | null
  memoryUsedBytes: number
  memoryTotalBytes: number
}

export type SystemResources = {
  cpu: { model: string; cores: number; percent: number | null }
  memory: { totalBytes: number; usedBytes: number }
  gpu: GraphicsReadout | null
  app: { bytes: number | null; scope: 'app' | 'gateway' }
}

const POLL_INTERVAL_MS = 5000

/**
 * A failed read clears the figures on purpose: a number that stopped moving looks like a
 * quiet machine, and the panel is there to warn about the opposite.
 */
export function useSystemResources() {
  const [resources, setResources] = useState<SystemResources | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  const check = useCallback(async () => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller

    try {
      const response = await fetch(`${AIOS_API_BASE_URL}/system/resources`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      })
      const payload = response.ok ? (await response.json() as SystemResources) : null
      if (!controller.signal.aborted) setResources(payload)
    } catch {
      if (requestRef.current === controller) setResources(null)
    } finally {
      if (requestRef.current === controller) requestRef.current = null
    }
  }, [])

  useEffect(() => {
    void check()
    const timer = window.setInterval(() => {
      if (!document.hidden) void check()
    }, POLL_INTERVAL_MS)
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

  return resources
}
