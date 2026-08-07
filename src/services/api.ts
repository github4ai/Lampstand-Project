import axios from 'axios'

const API_BASE_URL = 'http://127.0.0.1:8765'

const api = axios.create({
  baseURL: API_BASE_URL,
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
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/ask/stream`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/x-ndjson',
      },
      body: JSON.stringify({
        question,
        agent_id: agentId,
      }),
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
        event = JSON.parse(
          normalizedLine,
        ) as StreamEvent
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
      finalEvent = JSON.parse(
        finalLine,
      ) as StreamEvent
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