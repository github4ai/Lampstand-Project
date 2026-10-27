import { AIOS_API_BASE_URL } from '../config/api'

export interface PresentationMediaItem { id: string; title: string; media: 'image' | 'video' | 'audio' | 'document'; extension: string; group: string; bytes: number; addedAt: string }
export interface PresentationMediaLibrary { root: string; total: number; items: PresentationMediaItem[] }
export interface PresentationDeckPage { id: string; number: number; title: string; bytes: number }
export interface PresentationDeckResult { group: string; source: string; total: number; pages: PresentationDeckPage[] }

export async function getPresentationMediaLibrary(signal?: AbortSignal) {
  const response = await fetch(`${AIOS_API_BASE_URL}/presentation-media/library`, { signal })
  if (!response.ok) throw new Error('Unable to load the presentation media library.')
  return response.json() as Promise<PresentationMediaLibrary>
}

/** The audience window is a separate document, so every media source has to be an absolute gateway URL. */
export const presentationMediaFileUrl = (name: string) => `${AIOS_API_BASE_URL}/presentation-media/file?name=${encodeURIComponent(name)}`

/**
 * A cued file can leave the library afterwards, so the console asks the gateway before the room sees a black
 * screen. Only a 404 counts as missing - a stopped gateway is a different problem and must not be reported as one.
 */
export async function presentationMediaFileIsMissing(name: string) {
  try { return (await fetch(presentationMediaFileUrl(name), { method: 'HEAD' })).status === 404 } catch { return false }
}

/** The body is the file itself, so a large video is streamed by the browser instead of buffered in memory here. */
export function uploadPresentationMediaFile(file: File, onProgress?: (percent: number) => void) {
  return new Promise<PresentationMediaItem>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', `${AIOS_API_BASE_URL}/presentation-media/upload?name=${encodeURIComponent(file.name)}`)
    request.upload.addEventListener('progress', (event) => { if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100)) })
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        try { resolve(JSON.parse(request.response) as PresentationMediaItem) } catch { reject(new Error('The file was stored, but the library could not be confirmed.')) }
        return
      }
      let detail = ''
      try { detail = (JSON.parse(request.response) as { detail?: string }).detail || '' } catch { detail = '' }
      reject(new Error(detail || `The file could not be added (${request.status}).`))
    })
    request.addEventListener('error', () => reject(new Error('The connection to the local library stopped this upload.')))
    request.send(file)
  })
}

/** PowerPoint decks are turned into one image per slide by the converter on this computer. */
export async function convertPresentationDeck(name: string) {
  const response = await fetch(`${AIOS_API_BASE_URL}/presentation-media/deck?name=${encodeURIComponent(name)}`, { method: 'POST' })
  const body = await response.json().catch(() => ({})) as Partial<PresentationDeckResult> & { detail?: string }
  if (!response.ok) throw new Error(body.detail || 'This deck could not be converted on this computer.')
  return body as PresentationDeckResult
}

export async function removePresentationMedia(name: string) {
  return removeAt('/presentation-media/file', name)
}

export async function removePresentationMediaGroup(name: string) {
  return removeAt('/presentation-media/group', name)
}

async function removeAt(path: string, name: string) {
  const response = await fetch(`${AIOS_API_BASE_URL}${path}?name=${encodeURIComponent(name)}`, { method: 'DELETE' })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { detail?: string }
    throw new Error(body.detail || 'The file could not be removed.')
  }
  return response.json() as Promise<{ removed: boolean }>
}
