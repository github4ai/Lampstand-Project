import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateMedia, getMediaGeneration } from './media'

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

  it('loads an encoded generation job', async () => {
    const payload = { id: 'job/1', kind: 'video', status: 'completed', prompt: 'Clip', createdAt: 'now' }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(getMediaGeneration('job/1')).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8765/media/generations/job%2F1', expect.objectContaining({ signal: undefined }))
  })

  it('reports backend errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Provider unavailable', { status: 503 })))
    await expect(generateMedia({ kind: 'audio', prompt: 'Read this' }))
      .rejects.toThrow('Provider unavailable')
  })

  it('includes audio mode and language in generation requests', async () => {
    const payload = { id: 'audio-1', kind: 'audio', status: 'queued', prompt: 'A worship song', createdAt: 'now' }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    await generateMedia({
      kind: 'audio', prompt: 'A worship song', audioMode: 'song', language: 'ml',
    })
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      body: JSON.stringify({
        kind: 'audio', prompt: 'A worship song', audioMode: 'song', language: 'ml',
      }),
    }))
  })

})
