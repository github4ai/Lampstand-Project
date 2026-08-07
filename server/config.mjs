const cleanUrl = (value, fallback) => (value?.trim() || fallback).replace(/\/+$/, '')

export function loadConfig(env = process.env) {
  return {
    host: env.AIOS_API_HOST?.trim() || '127.0.0.1',
    port: Number(env.AIOS_API_PORT || 8765),
    providerMode: env.AIOS_PROVIDER_MODE?.trim() || 'hybrid',
    allowedOrigins: (env.AIOS_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174')
      .split(',').map((value) => value.trim()).filter(Boolean),
    ollamaUrl: cleanUrl(env.OLLAMA_URL, 'http://127.0.0.1:11434'),
    ollamaModel: env.OLLAMA_TRANSLATION_MODEL?.trim() || 'qwen3:8b',
    whisperUrl: cleanUrl(env.WHISPER_URL, 'http://127.0.0.1:8000'),
    whisperModel: env.WHISPER_MODEL?.trim() || 'whisper-1',
    legacyApiUrl: cleanUrl(env.AIOS_LEGACY_API_URL, 'http://127.0.0.1:8765'),
    openaiUrl: cleanUrl(env.OPENAI_BASE_URL, 'https://api.openai.com/v1'),
    openaiApiKey: env.OPENAI_API_KEY?.trim() || '',
    openaiTextModel: env.OPENAI_TEXT_MODEL?.trim() || 'gpt-4.1-mini',
    openaiTranscriptionModel: env.OPENAI_TRANSCRIPTION_MODEL?.trim() || 'gpt-4o-mini-transcribe',
    maxAudioBytes: Number(env.AIOS_MAX_AUDIO_MB || 25) * 1024 * 1024,
  }
}
