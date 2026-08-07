import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchKnowledge } from './knowledgeSearch'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('searchKnowledge', () => {
  it('builds the expected query parameters', async () => {
    const payload = { query: 'tree of life', results: [] }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      searchKnowledge({
        query: '  tree of life  ',
        category: 'Ministry Notes',
        topK: 8,
        includeText: true,
      }),
    ).resolves.toEqual(payload)

    const requestUrl = String(fetchMock.mock.calls[0]?.[0])
    const url = new URL(requestUrl)

    expect(url.pathname).toBe('/knowledge/search')
    expect(url.searchParams.get('q')).toBe('tree of life')
    expect(url.searchParams.get('category')).toBe('Ministry Notes')
    expect(url.searchParams.get('top_k')).toBe('8')
    expect(url.searchParams.get('include_text')).toBe('true')
  })

  it('defaults include_text to false', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"results":[]}', { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await searchKnowledge({
      query: 'life',
      category: 'Ministry',
      topK: 5,
    })

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.searchParams.get('include_text')).toBe('false')
  })

  it('forwards an abort signal', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"results":[]}', { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await searchKnowledge({
      query: 'life',
      category: 'Ministry',
      topK: 5,
      signal: controller.signal,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    )
  })

  it('uses the backend detail message on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ detail: 'Search index is unavailable.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    await expect(
      searchKnowledge({
        query: 'life',
        category: 'Ministry',
        topK: 5,
      }),
    ).rejects.toThrow('Search index is unavailable.')
  })
})
