export interface StreamSource {
  id: number
  citation: string
  source: string
  page: number | null
  chunk: number | null
  rerank_score: number | null
  url?: string
}

export type MinistrySource =
  | 'all'
  | 'bible'
  | 'hwmr'
  | 'life-study'
  | 'ministry-books'
  | 'hymnal'

export type SchoolSource =
  | 'all'
  | 'English'
  | 'Science'
  | 'Mathematics'
  | 'Computer Skills'
  | 'Social Science'
  | 'Tailoring'

export interface StreamMetadata {
  agent_id: string
  category: string
  model: string
  grounded: boolean
  source_count: number
  sources: StreamSource[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  assistantName?: string
  grounded?: boolean
  completed?: boolean
  model?: string
  sources?: StreamSource[]
}

export interface ChatConversation {
  id: string
  title: string
  agentId: string
  createdAt: string
  updatedAt: string
  pinned: boolean
  folder?: string
  messages: ChatMessage[]
}
