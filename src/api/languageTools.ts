import { AIOS_API_BASE_URL } from '../config/api'
import type { SupportedLanguage, TranscriptionResult, TranslationRequest, TranslationResult } from '../types/languageTools'

async function requireSuccess(response: Response): Promise<void> {
  if (response.ok) return
  const message = await response.text()
  throw new Error(message || `Language request failed with status ${response.status}.`)
}

export async function translateText(request: TranslationRequest, signal?: AbortSignal): Promise<TranslationResult> {
  const response = await fetch(`${AIOS_API_BASE_URL}/language/translate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request), signal,
  })
  await requireSuccess(response)
  return response.json() as Promise<TranslationResult>
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
