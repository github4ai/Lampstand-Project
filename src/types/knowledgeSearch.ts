export interface KnowledgeSearchResult {
  score: number | null
  retrieval_score: number | null
  fusion_score: number | null
  rerank_score: number | null
  combined_score: number | null

  category: string
  document: string
  source: string

  page: number | null
  chunk: number
  chunk_file: string

  citation: string | null

  matched_query: string | null
  matched_queries: string[]

  retrieval_method: string | null
  retrieval_methods: string[]

  preview: string
  text?: string
}

export interface KnowledgeSearchResponse {
  query: string
  category: string
  top_k: number
  total: number
  results: KnowledgeSearchResult[]
}

export interface KnowledgeSearchOptions {
  query: string
  category: string
  topK: number
  includeText?: boolean
  signal?: AbortSignal
}
