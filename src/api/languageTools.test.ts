import { afterEach, describe, expect, it, vi } from 'vitest'
import { transcribeAudio, translateText } from './languageTools'

describe('language tools API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends translation requests as JSON', async () => {
    const payload = { text: 'Hello', sourceLanguage: 'en', targetLanguage: 'mr', translatedText: 'Namaskar' }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(translateText({ text: 'Hello', sourceLanguage: 'en', targetLanguage: 'mr' }))
      .resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8765/language/translate',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ text: 'Hello', sourceLanguage: 'en', targetLanguage: 'mr' }) }))
  })

  it('uploads audio with its spoken language', async () => {
    const payload = { text: 'Test', language: 'ta' }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const file = new File(['audio'], 'sample.wav', { type: 'audio/wav' })
    await expect(transcribeAudio(file, 'ta')).resolves.toEqual(payload)
    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData
    expect(body.get('file')).toBe(file)
    expect(body.get('language')).toBe('ta')
  })
})
