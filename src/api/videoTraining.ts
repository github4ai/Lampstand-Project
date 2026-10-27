import { AIOS_API_BASE_URL } from '../config/api'

export interface VideoTrainingItem { id: string; title: string; media: 'video' | 'document'; extension: string; bytes: number; addedAt: string }
export interface VideoTrainingLibrary { root: string; total: number; items: VideoTrainingItem[] }

export async function getVideoTrainingLibrary(signal?: AbortSignal) {
  const response = await fetch(`${AIOS_API_BASE_URL}/video-training/library`, { signal })
  if (!response.ok) throw new Error('Unable to load the video training library.')
  return response.json() as Promise<VideoTrainingLibrary>
}

/** Training files stream from the gateway by byte range, so the player seeks without downloading whole videos. */
export const videoTrainingFileUrl = (name: string) => `${AIOS_API_BASE_URL}/video-training/file?name=${encodeURIComponent(name)}`

export async function readVideoTrainingText(name: string, signal?: AbortSignal) {
  const response = await fetch(videoTrainingFileUrl(name), { signal })
  if (!response.ok) throw new Error('Unable to open this training document.')
  return response.text()
}

/** The body is the file itself, so a large video is streamed by the browser instead of buffered in memory here. */
export function uploadVideoTrainingFile(file: File, onProgress?: (percent: number) => void) {
  return new Promise<VideoTrainingItem>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', `${AIOS_API_BASE_URL}/video-training/upload?name=${encodeURIComponent(file.name)}`)
    request.upload.addEventListener('progress', (event) => { if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100)) })
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        try { resolve(JSON.parse(request.response) as VideoTrainingItem) } catch { reject(new Error('The training file was stored, but the library could not be confirmed.')) }
        return
      }
      let detail = ''
      try { detail = (JSON.parse(request.response) as { detail?: string }).detail || '' } catch { detail = '' }
      reject(new Error(detail || `The training file could not be added (${request.status}).`))
    })
    request.addEventListener('error', () => reject(new Error('The connection to the local library stopped this upload.')))
    request.send(file)
  })
}

export async function removeVideoTrainingFile(name: string) {
  const response = await fetch(videoTrainingFileUrl(name), { method: 'DELETE' })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { detail?: string }
    throw new Error(body.detail || 'The training file could not be removed.')
  }
  return response.json() as Promise<{ removed: boolean }>
}
