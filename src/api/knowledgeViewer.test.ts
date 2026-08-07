import { afterEach, describe, expect, it, vi } from 'vitest'
import { getChunkContext, getKnowledgeViewer } from './knowledgeViewer'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getKnowledgeViewer', () => {
  it('encodes route values and returns viewer data', async () => {
    const payload = { category: 'Ministry', document: 'Test File', statistics: {}, chunk: {} }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      getKnowledgeViewer('Ministry Notes', 'Test File', 7),
    ).resolves.toEqual(payload)

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8765/knowledge/Ministry%20Notes/Test%20File/viewer/7',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('uses the backend detail message on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ detail: 'Chunk was not found.' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    await expect(
      getKnowledgeViewer('Ministry', 'Test', 999),
    ).rejects.toThrow('Chunk was not found.')
  })
})

describe('getChunkContext', () => {
  it('adds the requested context radius', async () => {
    const payload = { chunks: [], radius: 3 }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      getChunkContext('Ministry', 'Test', 12, 3),
    ).resolves.toEqual(payload)

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8765/knowledge/Ministry/Test/viewer/12/context?radius=3',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('forwards an abort signal', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{}', { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await getChunkContext('Ministry', 'Test', 1, 1, controller.signal)

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    )
  })
})
