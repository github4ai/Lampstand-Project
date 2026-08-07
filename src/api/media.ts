import { AIOS_API_BASE_URL } from '../config/api'
import type { MediaGeneration, MediaGenerationRequest } from '../types/media'

export async function generateMedia(
  request: MediaGenerationRequest,
  signal?: AbortSignal,
): Promise<MediaGeneration> {
  const response = await fetch(`${AIOS_API_BASE_URL}/media/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Media generation failed with status ${response.status}.`)
  }
  return response.json() as Promise<MediaGeneration>
}
