import { AIOS_API_BASE_URL } from '../config/api'

export interface KnowledgeFile {
  name: string
  stem: string
  extension: string
  relative_path: string
  size_bytes: number
  modified_at: string
}

export interface KnowledgeDocument {
  id: string
  name: string
  stem: string
  category: string

  chunks: number | null
  embeddings: number | null

  chunk_file: KnowledgeFile | null
  embedding_file: KnowledgeFile | null
  faiss_files: KnowledgeFile[]

  indexed: boolean
  modified_at: string | null
}

export interface KnowledgeDocumentDetail extends KnowledgeDocument {
  source_hash: string
  statistics: { pages: number | null; chunks: number; embeddings: number; vectors: number; words: number }
  embedding_dimensions: number
  pages: number[]
  artifact_size_bytes: number
  artifacts: KnowledgeFile[]
  metadata_files: KnowledgeFile[]
}

export interface KnowledgeCategory {
  name: string

  document_count: number
  indexed_document_count: number

  chunk_count: number
  embedding_count: number

  faiss_index_count: number
  metadata_file_count: number

  modified_at: string | null

  documents: KnowledgeDocument[]
  faiss_files: KnowledgeFile[]
  metadata_files: KnowledgeFile[]
}

export interface KnowledgeLibrary {
  index_root: string
  exists: boolean

  category_count: number
  document_count: number
  indexed_document_count: number

  chunk_count: number
  embedding_count: number
  faiss_index_count: number

  categories: KnowledgeCategory[]
}

export class KnowledgeApiError extends Error {
  status: number

  constructor(
    message: string,
    status: number,
  ) {
    super(message)

    this.name =
      'KnowledgeApiError'

    this.status = status
  }
}

async function parseErrorMessage(
  response: Response,
): Promise<string> {
  try {
    const payload: unknown =
      await response.json()

    if (
      typeof payload ===
        'object' &&
      payload !== null &&
      'detail' in payload
    ) {
      const detail = (
        payload as {
          detail?: unknown
        }
      ).detail

      if (
        typeof detail ===
        'string'
      ) {
        return detail
      }
    }
  } catch {
    // The response did not contain JSON.
  }

  return (
    `Knowledge API request failed ` +
    `with status ${response.status}.`
  )
}

async function requestJson<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(
    `${AIOS_API_BASE_URL}${path}`,
    {
      method: 'GET',
      headers: {
        Accept:
          'application/json',
      },
      signal,
    },
  )

  if (!response.ok) {
    const message =
      await parseErrorMessage(
        response,
      )

    throw new KnowledgeApiError(
      message,
      response.status,
    )
  }

  return response.json() as Promise<T>
}

export async function getKnowledgeLibrary(
  signal?: AbortSignal,
): Promise<KnowledgeLibrary> {
  return requestJson<KnowledgeLibrary>(
    '/knowledge',
    signal,
  )
}

export async function getKnowledgeDocument(
  categoryName: string, documentName: string, signal?: AbortSignal,
): Promise<KnowledgeDocumentDetail> {
  return requestJson<KnowledgeDocumentDetail>(
    '/knowledge/' + encodeURIComponent(categoryName) + '/' + encodeURIComponent(documentName), signal,
  )
}

export async function getKnowledgeCategory(
  categoryName: string,
  signal?: AbortSignal,
): Promise<KnowledgeCategory> {
  const encodedCategory =
    encodeURIComponent(
      categoryName,
    )

  return requestJson<KnowledgeCategory>(
    `/knowledge/${encodedCategory}`,
    signal,
  )
}

export async function uploadKnowledgeDocument(file: File, category: string, collection: string) {
  const form = new FormData()
  form.set('file', file)
  form.set('category', category)
  form.set('collection', collection)
  const response = await fetch(`${AIOS_API_BASE_URL}/knowledge/upload`, { method: 'POST', body: form })
  if (!response.ok) throw new KnowledgeApiError(await parseErrorMessage(response), response.status)
  return response.json() as Promise<{ name: string; category: string; collection: string | null; status: 'pending_index' }>
}

export async function getKnowledgeSubcollections(category: string, parent = '') {
  const query = new URLSearchParams({ category })
  if (parent) query.set('parent', parent)
  const response = await fetch(`${AIOS_API_BASE_URL}/knowledge/subcollections?${query}`)
  if (!response.ok) throw new KnowledgeApiError(await parseErrorMessage(response), response.status)
  const result = await response.json() as { subcollections?: unknown }
  return Array.isArray(result.subcollections) ? result.subcollections.filter((item): item is string => typeof item === 'string') : []
}

export interface KnowledgeSourceFile {
  name: string
  category: string
  subcollection: string | null
  relativePath: string
  sizeBytes: number
  modifiedAt: string
  title: string
  description: string
  tags: string[]
}

export async function getKnowledgeSources() {
  const response = await fetch(`${AIOS_API_BASE_URL}/knowledge/sources`)
  if (!response.ok) throw new KnowledgeApiError(await parseErrorMessage(response), response.status)
  const result = await response.json() as { sources?: KnowledgeSourceFile[] }
  return Array.isArray(result.sources) ? result.sources : []
}

export async function trashKnowledgeSource(relativePath: string) {
  const response = await fetch(`${AIOS_API_BASE_URL}/knowledge/source`, {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ relativePath }),
  })
  if (!response.ok) throw new KnowledgeApiError(await parseErrorMessage(response), response.status)
  return response.json() as Promise<{ removed: string; recoverableFrom: string }>
}

export function getKnowledgePreviewUrl(relativePath: string) {
  return `${AIOS_API_BASE_URL}/knowledge/source/preview?${new URLSearchParams({ path: relativePath })}`
}

export async function updateKnowledgeSource(input: { relativePath: string; name: string; category: string; collection: string; title: string; description: string; tags: string[] }) {
  const response = await fetch(`${AIOS_API_BASE_URL}/knowledge/source`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })
  if (!response.ok) throw new KnowledgeApiError(await parseErrorMessage(response), response.status)
  return response.json() as Promise<{ relativePath: string; status: 'saved' }>
}

export interface KnowledgeHealth {
  checkedAt: string
  sources: number
  totalSizeBytes: number
  indexed: number
  pending: string[]
  duplicates: string[][]
  healthy: boolean
}

export function inspectKnowledgeHealth(signal?: AbortSignal) {
  return requestJson<KnowledgeHealth>('/knowledge/health', signal)
}

export interface KnowledgeIndexStatus {
  state: 'idle' | 'running' | 'completed' | 'completed_with_errors' | 'failed'
  startedAt: string | null
  finishedAt: string | null
  output: string
  exitCode: number | null
  processed: number
  total: number
  current: string
  errors: number
}

async function knowledgeIndexRequest(path: string, method = 'GET') {
  const response = await fetch(`${AIOS_API_BASE_URL}${path}`, { method })
  if (!response.ok) throw new KnowledgeApiError(await parseErrorMessage(response), response.status)
  return response.json() as Promise<KnowledgeIndexStatus>
}

export function getKnowledgeIndexStatus() {
  return knowledgeIndexRequest('/knowledge/index/status')
}

export function startKnowledgeIndex() {
  return knowledgeIndexRequest('/knowledge/index', 'POST')
}

export function formatFileSize(
  sizeBytes: number,
): string {
  if (
    !Number.isFinite(sizeBytes) ||
    sizeBytes <= 0
  ) {
    return '0 B'
  }

  const units = [
    'B',
    'KB',
    'MB',
    'GB',
    'TB',
  ]

  const unitIndex = Math.min(
    Math.floor(
      Math.log(sizeBytes) /
        Math.log(1024),
    ),
    units.length - 1,
  )

  const value =
    sizeBytes /
    1024 ** unitIndex

  const precision =
    value >= 100 ||
    unitIndex === 0
      ? 0
      : value >= 10
        ? 1
        : 2

  return (
    `${value.toFixed(precision)} ` +
    units[unitIndex]
  )
}

export function formatCount(
  value: number,
): string {
  return new Intl.NumberFormat(
    undefined,
  ).format(value)
}

export function formatKnowledgeDate(
  value: string | null,
): string {
  if (!value) {
    return 'Not available'
  }

  const date = new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Not available'
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(date)
}
