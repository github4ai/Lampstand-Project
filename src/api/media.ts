import { AIOS_API_BASE_URL } from '../config/api'
import type { MediaGeneration, MediaGenerationRequest, MediaProviderStatus } from '../types/media'

export async function getMediaProviderStatus(signal?: AbortSignal): Promise<MediaProviderStatus> {
  const response = await fetch(`${AIOS_API_BASE_URL}/media/providers`, { signal })
  if (!response.ok) throw new Error('Unable to check media providers.')
  return response.json() as Promise<MediaProviderStatus>
}

export async function getWanVideos(signal?: AbortSignal): Promise<MediaGeneration[]> {
  const response = await fetch(`${AIOS_API_BASE_URL}/media/wan/videos`, { signal })
  if (!response.ok) throw new Error('Unable to import LTX videos.')
  const body = await response.json() as { videos: MediaGeneration[] }
  return body.videos.map(normalizeMediaUrl)
}

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

export async function getMediaGenerations(signal?: AbortSignal): Promise<MediaGeneration[]> {
  const response = await fetch(`${AIOS_API_BASE_URL}/media/generations`, { signal })
  if (!response.ok) throw new Error('Unable to recover the media queue.')
  const body = await response.json() as { generations: MediaGeneration[] }
  return body.generations.map(normalizeMediaUrl)
}

export async function cancelMediaGeneration(id: string): Promise<MediaGeneration> {
  const response = await fetch(`${AIOS_API_BASE_URL}/media/generations/${encodeURIComponent(id)}/cancel`, { method: 'POST' })
  if (!response.ok) throw new Error('Unable to cancel this generation.')
  return normalizeMediaUrl(await response.json() as MediaGeneration)
}
