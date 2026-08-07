import { AIOS_API_BASE_URL } from '../config/api'

import type {
  KnowledgeContextResponse,
  KnowledgeViewerResponse,
} from '../types/knowledgeViewer'

async function readErrorMessage(
  response: Response,
): Promise<string> {
  try {
    const payload =
      await response.json() as {
        detail?: unknown
      }

    if (
      typeof payload.detail ===
      'string'
    ) {
      return payload.detail
    }
  } catch {
    // Response may not contain JSON.
  }

  return (
    `Knowledge viewer request failed ` +
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
        Accept: 'application/json',
      },
      signal,
    },
  )

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(
        response,
      ),
    )
  }

  return response.json() as Promise<T>
}

export async function getKnowledgeViewer(
  category: string,
  document: string,
  chunkId: number,
  signal?: AbortSignal,
): Promise<KnowledgeViewerResponse> {
  const encodedCategory =
    encodeURIComponent(category)

  const encodedDocument =
    encodeURIComponent(document)

  return requestJson<KnowledgeViewerResponse>(
    (
      `/knowledge/${encodedCategory}` +
      `/${encodedDocument}` +
      `/viewer/${chunkId}`
    ),
    signal,
  )
}

export async function getChunkContext(
  category: string,
  document: string,
  chunkId: number,
  radius = 1,
  signal?: AbortSignal,
): Promise<KnowledgeContextResponse> {
  const encodedCategory =
    encodeURIComponent(category)

  const encodedDocument =
    encodeURIComponent(document)

  const parameters =
    new URLSearchParams({
      radius: String(radius),
    })

  return requestJson<KnowledgeContextResponse>(
    (
      `/knowledge/${encodedCategory}` +
      `/${encodedDocument}` +
      `/viewer/${chunkId}/context?` +
      parameters.toString()
    ),
    signal,
  )
}
