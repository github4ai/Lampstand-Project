import { useCallback, useEffect, useRef, useState } from 'react'
import { getAgents } from '../services/api'
import type { AgentSummary } from '../services/api'

export function useAgents() {
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestIdRef = useRef(0)

  const refresh = useCallback(async (): Promise<boolean> => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError('')

    try {
      const nextAgents = await getAgents()
      if (requestId !== requestIdRef.current) return false
      setAgents(nextAgents)
      return true
    } catch {
      if (requestId !== requestIdRef.current) return false
      setError('Unable to load AIOS agents.')
      return false
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { agents, loading, error, refresh }
}
