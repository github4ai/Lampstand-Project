import type {
  KnowledgeSearchOptions,
  KnowledgeSearchResponse,
} from '../types/knowledgeSearch'

const AIOS_API_BASE_URL =
  'http://127.0.0.1:8765'

interface ApiErrorPayload {
  detail?: unknown
}

async function readErrorMessage(
  response: Response,
): Promise<string> {
  try {
    const payload =
      await response.json() as ApiErrorPayload

    if (
      typeof payload.detail ===
      'string'
    ) {
      return payload.detail
    }
  } catch {
    // The response may not contain JSON.
  }

  return (
    `Knowledge search failed with ` +
    `status ${response.status}.`
  )
}

export async function searchKnowledge({
  query,
  category,
  topK,
  includeText = false,
  signal,
}: KnowledgeSearchOptions):
Promise<KnowledgeSearchResponse> {
  const parameters =
    new URLSearchParams({
      q: query.trim(),
      category: category.trim(),
      top_k: String(topK),
      include_text: String(
        includeText,
      ),
    })

  const response = await fetch(
    (
      `${AIOS_API_BASE_URL}` +
      `/knowledge/search?` +
      parameters.toString()
    ),
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
    throw new Error(
      await readErrorMessage(
        response,
      ),
    )
  }

  return (
    await response.json()
  ) as KnowledgeSearchResponse
}
