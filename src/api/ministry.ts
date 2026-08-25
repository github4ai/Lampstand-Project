import { AIOS_API_BASE_URL } from '../config/api'

export type MinistrySection = 'recovery-bible' | 'life-study' | 'ministry-books'
export interface MinistryLibraryStatus { sections: Record<MinistrySection, { imports: number }>; supportedFormats: string[]; folder: string }

async function detail(response: Response) {
  const body = await response.json().catch(() => ({})) as { detail?: string }
  return body.detail || 'Unable to import the ministry library.'
}

export async function getMinistryLibrary(signal?: AbortSignal) {
  const response = await fetch(`${AIOS_API_BASE_URL}/ministry/library`, { signal })
  if (!response.ok) throw new Error(await detail(response))
  return response.json() as Promise<MinistryLibraryStatus>
}

export async function importMinistryFiles(section: MinistrySection, files: File[]) {
  const form = new FormData()
  form.set('section', section)
  files.forEach((file) => form.append('files', file))
  const response = await fetch(`${AIOS_API_BASE_URL}/ministry/import`, { method: 'POST', body: form })
  if (!response.ok) throw new Error(await detail(response))
  return response.json() as Promise<{ imported: number; section: MinistrySection }>
}
