import { AIOS_API_BASE_URL } from '../config/api'

export interface LifeStudyBook { slug: string; name: string; messages: number; firstMessage: number; lastMessage: number }
export interface LifeStudyMessageSummary { number: number; title: string }
export type LifeStudySegment = { type: 'text'; text: string } | { type: 'bible-reference'; text: string; bookSlug: string; chapter: number; verse: number; verseEnd: number }
export interface LifeStudyBlock { id: number; type: 'heading' | 'paragraph'; level: number | null; text: string; segments: LifeStudySegment[] }
export interface LifeStudyMessage { book: { slug: string; name: string }; message: LifeStudyMessageSummary; messages: LifeStudyMessageSummary[]; blocks: LifeStudyBlock[] }
export interface LifeStudySearchResult { book: { slug: string; name: string }; message: LifeStudyMessageSummary; block: number; excerpt: string; score: number }

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${AIOS_API_BASE_URL}${path}`, { signal })
  if (!response.ok) { const body = await response.json().catch(() => ({})) as { detail?: string }; throw new Error(body.detail || 'Unable to load Life-Study.') }
  return response.json() as Promise<T>
}

export const getLifeStudyBooks = (signal?: AbortSignal) => getJson<{ books: LifeStudyBook[] }>('/life-study/books', signal)
export const getLifeStudyMessages = (book: string, signal?: AbortSignal) => getJson<{ messages: LifeStudyMessageSummary[] }>(`/life-study/messages?book=${encodeURIComponent(book)}`, signal)
export async function getLifeStudyMessage(book: string, message: number, signal?: AbortSignal) {
  const result = await getJson<LifeStudyMessage>(`/life-study/message?book=${encodeURIComponent(book)}&message=${message}`, signal)
  return { ...result, blocks: result.blocks.map((block) => ({ ...block, segments: block.segments ?? [{ type: 'text' as const, text: block.text }] })) }
}
export const searchLifeStudy = (query: string, signal?: AbortSignal) => getJson<{ query: string; total: number; results: LifeStudySearchResult[] }>(`/life-study/search?q=${encodeURIComponent(query)}&limit=5`, signal)
