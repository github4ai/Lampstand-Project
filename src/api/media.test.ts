import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateMedia } from './media'

describe('generateMedia', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends a provider-neutral media request', async () => {
    const payload = { id: 'job-1', kind: 'image', status: 'queued', prompt: 'A lamp', createdAt: 'now' }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(generateMedia({ kind: 'image', prompt: 'A lamp', aspectRatio: '16:9' }))
      .resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8765/media/generate',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ kind: 'image', prompt: 'A lamp', aspectRatio: '16:9' }) }))
  })

  it('reports backend errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Provider unavailable', { status: 503 })))
    await expect(generateMedia({ kind: 'audio', prompt: 'Read this' }))
      .rejects.toThrow('Provider unavailable')
  })
})
