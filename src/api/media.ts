import { AIOS_API_BASE_URL } from '../config/api'
import type { MediaGeneration, MediaGenerationRequest } from '../types/media'

function normalizeMediaUrl(generation: MediaGeneration): MediaGeneration {
  if (!generation.url?.startsWith('/')) return generation
  return { ...generation, url: `${AIOS_API_BASE_URL}${generation.url}` }
}

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
  return normalizeMediaUrl(await response.json() as MediaGeneration)
}

export async function getMediaGeneration(
  id: string,
  signal?: AbortSignal,
): Promise<MediaGeneration> {
  const response = await fetch(
    `${AIOS_API_BASE_URL}/media/generations/${encodeURIComponent(id)}`,
    { signal },
  )
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Unable to refresh media generation ${id}.`)
  }
  return normalizeMediaUrl(await response.json() as MediaGeneration)
}
