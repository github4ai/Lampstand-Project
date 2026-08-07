import { useCallback, useEffect, useState } from 'react'
import { getAgents } from '../services/api'
import type { AgentSummary } from '../services/api'

export function useAgents() {
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    setError('')

    try {
      setAgents(await getAgents())
      return true
    } catch {
      setError('Unable to load AIOS agents.')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { agents, loading, error, refresh }
}
