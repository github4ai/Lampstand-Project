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