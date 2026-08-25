import { AIOS_API_BASE_URL } from '../config/api'
import type { Hymn } from '../types/hymnal'

interface HymnalLibraryResponse {
  importedAt: string | null
  root: string | null
  hymns: Hymn[]
  failures: Array<{ file: string; detail: string }>
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : 'The Hymnal library request failed.')
  return body as T
}

export async function getHymnalLibrary(signal?: AbortSignal) {
  return responseJson<HymnalLibraryResponse>(await fetch(`${AIOS_API_BASE_URL}/hymnal/library`, { signal }))
}

export async function importHymnalMirror(root?: string) {
  return responseJson<{ imported: number; failed: number; outputFile: string }>(await fetch(`${AIOS_API_BASE_URL}/hymnal/import-mirror`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(root ? { root } : {}),
  }))
}
