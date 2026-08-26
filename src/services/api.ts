import axios from 'axios'

import { AIOS_API_BASE_URL } from '../config/api'

const api = axios.create({
  baseURL: AIOS_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 300000,
})

export interface AskRequest {
  question: string
  conversation_id?: string | null
  agent_id?: string | null
  category?: string
  top_k?: number
}

export interface AskResponse {
  conversation_id: string
  question: string
  answer: string
  sources?: Record<string, unknown>[]
}

export interface AgentSummary {
  id: string
  name: string
  description: string
  category: string
  icon: string
  capabilities?: string[]
  recommended_tasks?: string[]
}

export interface StreamSource {
  id: number
  citation: string
  source: string
  page: number | null
  chunk: number | null
  rerank_score: number | null
}

export interface StreamMetadata {
  agent_id: string
  category: string
  model: string
  grounded: boolean
  source_count: number
  sources: StreamSource[]
}

interface MetadataEvent extends StreamMetadata {
  type: 'metadata'
}

interface ChunkEvent {
  type: 'chunk'
  content: string
}

interface DoneEvent {
  type: 'done'
  grounded: boolean
  completed?: boolean
}

interface ErrorEvent {
  type: 'error'
  message: string
}

type StreamEvent =
  | MetadataEvent
  | ChunkEvent
  | DoneEvent
  | ErrorEvent

function isStreamEvent(value: unknown): value is StreamEvent {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false
  const event = value as { type?: unknown; content?: unknown; message?: unknown; grounded?: unknown }
  if (event.type === 'chunk') return typeof event.content === 'string'
  if (event.type === 'error') return typeof event.message === 'string'
  if (event.type === 'done') return typeof event.grounded === 'boolean'
  if (event.type === 'metadata') {
    const metadata = value as Partial<MetadataEvent>
    return typeof metadata.agent_id === 'string' && typeof metadata.category === 'string' &&
      typeof metadata.model === 'string' && typeof metadata.grounded === 'boolean' &&
      typeof metadata.source_count === 'number' && Array.isArray(metadata.sources)
  }
  return false
}

export interface StreamCallbacks {
  onMetadata?: (metadata: StreamMetadata) => void
  onChunk: (chunk: string) => void
  onDone?: (event: DoneEvent) => void
  onError?: (message: string) => void
}

export async function getAgents(): Promise<AgentSummary[]> {
  const response = await api.get<AgentSummary[]>('/agents')
  return response.data
}

export async function askAIOS(
  payload: AskRequest,
): Promise<AskResponse> {
  const response = await api.post<AskResponse>(
    '/ask',
    payload,
  )

  return response.data
}

function processStreamEvent(
  event: StreamEvent,
  callbacks: StreamCallbacks,
): void {
  switch (event.type) {
    case 'metadata':
      callbacks.onMetadata?.({
        agent_id: event.agent_id,
        category: event.category,
        model: event.model,
        grounded: event.grounded,
        source_count: event.source_count,
        sources: event.sources,
      })
      break

    case 'chunk':
      callbacks.onChunk(event.content)
      break

    case 'done':
      callbacks.onDone?.(event)
      break

    case 'error':
      callbacks.onError?.(event.message)
      throw new Error(event.message)

    default: {
      const unexpectedEvent: never = event
      throw new Error(
        `Unsupported stream event: ${String(unexpectedEvent)}`,
      )
    }
  }
}

export async function streamAIOS(
  question: string,
  agentId: string,
  callbacks: StreamCallbacks,
  ministrySource = 'all',
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(
    `${AIOS_API_BASE_URL}/ask/stream`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/x-ndjson',
      },
      body: JSON.stringify({
        question,
        agent_id: agentId,
        ministry_source: ministrySource,
      }),
      signal,
    },
  )

  if (!response.ok) {
    const errorText = await response.text()

    throw new Error(
      errorText ||
        `Streaming request failed with status ${response.status}.`,
    )
  }

  if (!response.body) {
    throw new Error(
      'The streaming response did not contain a response body.',
    )
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    buffer += decoder.decode(value, {
      stream: true,
    })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const normalizedLine = line.trim()

      if (!normalizedLine) {
        continue
      }

      let event: StreamEvent

      try {
        const parsed: unknown = JSON.parse(normalizedLine)
        if (!isStreamEvent(parsed)) throw new Error('invalid event shape')
        event = parsed
      } catch {
        throw new Error(
          `AIOS returned an invalid streaming event: ${normalizedLine}`,
        )
      }

      processStreamEvent(
        event,
        callbacks,
      )
    }
  }

  buffer += decoder.decode()

  const finalLine = buffer.trim()

  if (finalLine) {
    let finalEvent: StreamEvent

    try {
      const parsed: unknown = JSON.parse(finalLine)
      if (!isStreamEvent(parsed)) throw new Error('invalid event shape')
      finalEvent = parsed
    } catch {
      throw new Error(
        `AIOS returned an invalid final streaming event: ${finalLine}`,
      )
    }

    processStreamEvent(
      finalEvent,
      callbacks,
    )
  }
}
