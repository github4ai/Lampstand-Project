import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  getKnowledgeLibrary,
} from '../services/knowledge'

import type {
  KnowledgeLibrary,
} from '../services/knowledge'

interface UseKnowledgeResult {
  data: KnowledgeLibrary | null
  loading: boolean
  refreshing: boolean
  error: string
  refresh: () => Promise<boolean>
}

function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof DOMException &&
    error.name === 'AbortError'
  ) {
    return ''
  }

  if (error instanceof Error) {
    return error.message
  }

  return (
    'An unexpected error occurred while ' +
    'loading the Knowledge Library.'
  )
}

export function useKnowledge():
  UseKnowledgeResult {
  const [
    data,
    setData,
  ] =
    useState<KnowledgeLibrary | null>(
      null,
    )

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    refreshing,
    setRefreshing,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState('')

  const loadKnowledge =
    useCallback(
      async (
        controller?: AbortController,
        isRefresh = false,
      ): Promise<boolean> => {
        if (isRefresh) {
          setRefreshing(true)
        } else {
          setLoading(true)
        }

        setError('')

        try {
          const library =
            await getKnowledgeLibrary(
              controller?.signal,
            )

          setData(library)

          return true
        } catch (
          requestError
        ) {
          const message =
            getErrorMessage(
              requestError,
            )

          if (message) {
            setError(message)
          }

          return false
        } finally {
          if (isRefresh) {
            setRefreshing(false)
          } else {
            setLoading(false)
          }
        }
      },
      [],
    )

  useEffect(() => {
    const controller =
      new AbortController()

    void loadKnowledge(
      controller,
      false,
    )

    return () => {
      controller.abort()
    }
  }, [loadKnowledge])

  const refresh =
    useCallback(
      async (): Promise<boolean> =>
        loadKnowledge(
          undefined,
          true,
        ),
      [loadKnowledge],
    )

  return {
    data,
    loading,
    refreshing,
    error,
    refresh,
  }
}