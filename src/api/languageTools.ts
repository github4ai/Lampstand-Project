import { AIOS_API_BASE_URL } from '../config/api'
import type { LanguageProviderStatus, SupportedLanguage, TranscriptionResult, TranslationRequest, TranslationResult, TranslationSourceLanguage } from '../types/languageTools'

export async function getLanguageProviderStatus(signal?: AbortSignal): Promise<LanguageProviderStatus> {
  const response = await fetch(`${AIOS_API_BASE_URL}/language/providers`, { signal })
  await requireSuccess(response)
  return response.json() as Promise<LanguageProviderStatus>
}

async function requireSuccess(response: Response): Promise<void> {
  if (response.ok) return
  const message = await response.text()
  try {
    const body = JSON.parse(message) as { detail?: string; error?: string }
    throw new Error(body.detail || body.error || `Language request failed with status ${response.status}.`)
  } catch (cause) {
    if (cause instanceof Error && cause.message !== 'Unexpected end of JSON input' && !(cause instanceof SyntaxError)) throw cause
    throw new Error(message || `Language request failed with status ${response.status}.`)
  }
}

export async function translateText(request: TranslationRequest, signal?: AbortSignal): Promise<TranslationResult> {
  const response = await fetch(`${AIOS_API_BASE_URL}/language/translate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request), signal,
  })
  await requireSuccess(response)
  return response.json() as Promise<TranslationResult>
}

export async function transliterateText(text: string, language: SupportedLanguage, signal?: AbortSignal): Promise<string> {
  const response = await fetch(`${AIOS_API_BASE_URL}/language/transliterate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, language }), signal,
  })
  await requireSuccess(response)
  return ((await response.json()) as { transliteration: string }).transliteration
}

export async function transcribeAudio(
  file: File,
  language: SupportedLanguage,
  signal?: AbortSignal,
): Promise<TranscriptionResult> {
  const body = new FormData()
  body.append('file', file)
  body.append('language', language)
  const response = await fetch(`${AIOS_API_BASE_URL}/language/transcribe`, {
    method: 'POST', body, signal,
  })
  await requireSuccess(response)
  return response.json() as Promise<TranscriptionResult>
}

export async function translateDocument(file: File, sourceLanguage: TranslationSourceLanguage, targetLanguage: SupportedLanguage, signal?: AbortSignal) {
  const body = new FormData()
  body.append('file', file); body.append('sourceLanguage', sourceLanguage); body.append('targetLanguage', targetLanguage)
  const response = await fetch(`${AIOS_API_BASE_URL}/language/translate-document`, { method: 'POST', body, signal })
  await requireSuccess(response)
  const disposition = response.headers.get('Content-Disposition') || ''
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || `translated-${file.name}`
  return { blob: await response.blob(), filename, fidelity: response.headers.get('X-AIOS-Layout-Fidelity') || 'best-effort', segments: Number(response.headers.get('X-AIOS-Segments') || 0) }
}

export async function createPronunciation(text: string, language: SupportedLanguage, rate: number, voice?: string, signal?: AbortSignal) {
  const response = await fetch(`${AIOS_API_BASE_URL}/language/pronounce`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language, rate, voice }), signal,
  })
  await requireSuccess(response)
  return {
    audio: await response.blob(),
    voice: response.headers.get('X-AIOS-Voice') || 'Microsoft neural voice',
    provider: response.headers.get('X-AIOS-Provider') || 'Online fallback',
  }
}
