export interface KnowledgeViewerStatistics {
  pages: number | null
  chunks: number
  embeddings: number
  vectors: number
  words: number
}

export interface KnowledgeViewerChunk {
  id: number
  chunk: number
  vector_id: number | null
  page: number | null
  word_count: number
  character_count: number
  source: string
  category: string
  chunk_file: string
  text: string
  position: number
  previous_chunk_id: number | null
  next_chunk_id: number | null
}

export interface KnowledgeViewerResponse {
  category: string
  document: string
  statistics: KnowledgeViewerStatistics
  chunk: KnowledgeViewerChunk
}

export interface KnowledgeContextChunk {
  id: number
  chunk: number
  vector_id: number | null
  page: number | null
  word_count: number
  character_count: number
  source: string
  category: string
  chunk_file: string
  text: string
  is_current: boolean
}

export interface KnowledgeContextResponse {
  category: string
  document: string
  current_chunk_id: number
  radius: number
  total_chunks: number
  start_chunk_id: number | null
  end_chunk_id: number | null
  chunks: KnowledgeContextChunk[]
}
