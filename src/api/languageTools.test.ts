import { afterEach, describe, expect, it, vi } from 'vitest'
import { getLanguageProviderStatus, transcribeAudio, translateDocument, translateText } from './languageTools'

describe('language tools API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('loads language provider readiness', async () => {
    const payload = { mode: 'hybrid', providers: { ollama: { configured: true, available: true } } }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(getLanguageProviderStatus()).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:9656/language/providers', { signal: undefined })
  })

  it('sends translation requests as JSON', async () => {
    const payload = { text: 'Hello', sourceLanguage: 'en', targetLanguage: 'mr', translatedText: 'Namaskar' }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(translateText({ text: 'Hello', sourceLanguage: 'en', targetLanguage: 'mr' }))
      .resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:9656/language/translate',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ text: 'Hello', sourceLanguage: 'en', targetLanguage: 'mr' }) }))
  })

  it('supports automatic source-language detection', async () => {
    const payload = { text: 'Namaste', sourceLanguage: 'auto', targetLanguage: 'en', translatedText: 'Hello' }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await translateText({ text: 'Namaste', sourceLanguage: 'auto', targetLanguage: 'en' })
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:9656/language/translate',
      expect.objectContaining({ body: JSON.stringify({ text: 'Namaste', sourceLanguage: 'auto', targetLanguage: 'en' }) }))
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

  it('uploads a document and returns its translated download metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Blob(['translated']), { status: 200, headers: {
      'Content-Disposition': 'attachment; filename="guide-hi.docx"', 'X-AIOS-Layout-Fidelity': 'native', 'X-AIOS-Segments': '7',
    } }))
    vi.stubGlobal('fetch', fetchMock)
    const file = new File(['document'], 'guide.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    const result = await translateDocument(file, 'auto', 'hi')
    expect(result).toMatchObject({ filename: 'guide-hi.docx', fidelity: 'native', segments: 7 })
    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData
    expect(body.get('file')).toBe(file); expect(body.get('sourceLanguage')).toBe('auto'); expect(body.get('targetLanguage')).toBe('hi')
  })
})
