import { describe, expect, it, vi } from 'vitest'
import { translateWithProviders, transcribeWithProviders } from './providers.mjs'

const config = {
  providerMode: 'hybrid', ollamaUrl: 'http://ollama', ollamaModel: 'local-model',
  whisperUrl: 'http://whisper', whisperModel: 'whisper-1', openaiUrl: 'https://api.openai.com/v1',
  voiceStudioUrl: 'http://voicestudio', voiceStudioTranscriptionModel: 'whisper-1',
  openaiApiKey: 'test-key', openaiTextModel: 'cloud-model', openaiTranscriptionModel: 'cloud-audio',
  geminiUrl: 'https://generativelanguage.googleapis.com/v1beta', geminiApiKey: '', geminiTextModel: 'gemini-test',
  anthropicUrl: 'https://api.anthropic.com/v1', anthropicApiKey: '', anthropicTextModel: 'claude-test',
}

describe('hybrid language providers', () => {
  it('uses local translation first', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: { content: 'Namaskar' } }), { status: 200 }))
    const result = await translateWithProviders({ text: 'Hello', sourceLanguage: 'en', targetLanguage: 'mr' }, config, fetcher)
    expect(result).toMatchObject({ translatedText: 'Namaskar', provider: 'ollama' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('falls back to OpenAI when local translation fails', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('offline', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ models: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ output_text: 'Hello' }), { status: 200 }))
    const result = await translateWithProviders({ text: 'Namaste', sourceLanguage: 'auto', targetLanguage: 'en' }, config, fetcher)
    expect(result.provider).toBe('openai')
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('uses the Voice Studio transcription endpoint before local Whisper', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: 'Test transcript' }), { status: 200 }))
    const file = new File(['audio'], 'sample.wav', { type: 'audio/wav' })
    const result = await transcribeWithProviders(file, 'ta', config, fetcher)
    expect(result).toMatchObject({ text: 'Test transcript', language: 'ta', provider: 'voice studio' })
    expect(fetcher.mock.calls[0][0]).toBe('http://voicestudio/v1/audio/transcriptions')
  })

  it('falls back to local Whisper when Voice Studio is unavailable', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ text: 'Test transcript' }), { status: 200 }))
    const file = new File(['audio'], 'sample.wav', { type: 'audio/wav' })
    const result = await transcribeWithProviders(file, 'ta', config, fetcher)
    expect(result).toMatchObject({ text: 'Test transcript', provider: 'local whisper' })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('uses Gemini as the first cloud fallback when it is configured', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('offline', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ models: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: 'Vanakkam' }] } }],
      }), { status: 200 }))
    const result = await translateWithProviders(
      { text: 'Hello', sourceLanguage: 'en', targetLanguage: 'ta' },
      { ...config, geminiApiKey: 'gemini-key' },
      fetcher,
    )
    expect(result).toMatchObject({ translatedText: 'Vanakkam', provider: 'gemini', model: 'gemini-test' })
    expect(fetcher.mock.calls[2][0]).toContain('/models/gemini-test:generateContent')
  })

  it('falls back to Anthropic when it is the configured cloud provider', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('offline', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ models: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        content: [{ type: 'text', text: 'Namaskar' }],
      }), { status: 200 }))
    const result = await translateWithProviders(
      { text: 'Hello', sourceLanguage: 'en', targetLanguage: 'mr' },
      { ...config, openaiApiKey: '', anthropicApiKey: 'anthropic-key' },
      fetcher,
    )
    expect(result).toMatchObject({ translatedText: 'Namaskar', provider: 'anthropic', model: 'claude-test' })
    expect(fetcher.mock.calls[2][0]).toBe('https://api.anthropic.com/v1/messages')
  })
})
