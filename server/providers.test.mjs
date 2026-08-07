import { describe, expect, it, vi } from 'vitest'
import { translateWithProviders, transcribeWithProviders } from './providers.mjs'

const config = {
  providerMode: 'hybrid', ollamaUrl: 'http://ollama', ollamaModel: 'local-model',
  whisperUrl: 'http://whisper', whisperModel: 'whisper-1', openaiUrl: 'https://api.openai.com/v1',
  openaiApiKey: 'test-key', openaiTextModel: 'cloud-model', openaiTranscriptionModel: 'cloud-audio',
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
      .mockResolvedValueOnce(new Response(JSON.stringify({ output_text: 'Hello' }), { status: 200 }))
    const result = await translateWithProviders({ text: 'Namaste', sourceLanguage: 'auto', targetLanguage: 'en' }, config, fetcher)
    expect(result.provider).toBe('openai')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('uses the local Whisper-compatible transcription endpoint first', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: 'Test transcript' }), { status: 200 }))
    const file = new File(['audio'], 'sample.wav', { type: 'audio/wav' })
    const result = await transcribeWithProviders(file, 'ta', config, fetcher)
    expect(result).toMatchObject({ text: 'Test transcript', language: 'ta', provider: 'local whisper' })
    expect(fetcher.mock.calls[0][0]).toBe('http://whisper/v1/audio/transcriptions')
  })
})
