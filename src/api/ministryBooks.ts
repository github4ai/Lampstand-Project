import { AIOS_API_BASE_URL } from '../config/api'

export interface MinistryBookSummary { id: string; title: string; author: string; chapters: number; firstChapter: number; lastChapter: number; sourceUrl?: string }
export interface MinistryChapterSummary { number: number; title: string; displayTitle?: string }
export interface MinistryBookBlock { id: number; type: 'heading' | 'paragraph'; level: number | null; text: string }
export interface MinistryBooksLibrary { ready: boolean; folder: string; files: number; books: MinistryBookSummary[]; message: string; missingTitles?: number; format?: string }
export interface MinistryBookChapter { book: MinistryBookSummary; chapter: MinistryChapterSummary; chapters: MinistryChapterSummary[]; blocks: MinistryBookBlock[] }
export interface MinistryBookSearchResult { book: MinistryBookSummary; chapter: MinistryChapterSummary; block: number; excerpt: string; score: number }

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${AIOS_API_BASE_URL}${path}`, { signal })
  if (!response.ok) { const body = await response.json().catch(() => ({})) as { detail?: string }; throw new Error(body.detail || 'Unable to load Ministry Books.') }
  return response.json() as Promise<T>
}

export const getMinistryBooksLibrary = (signal?: AbortSignal) => getJson<MinistryBooksLibrary>('/ministry-books/library', signal)
export const getMinistryBookChapters = (book: string, signal?: AbortSignal) => getJson<{ book: MinistryBookSummary; chapters: MinistryChapterSummary[] }>(`/ministry-books/chapters?book=${encodeURIComponent(book)}`, signal)
export const getMinistryBookChapter = (book: string, chapter: number, signal?: AbortSignal) => getJson<MinistryBookChapter>(`/ministry-books/chapter?book=${encodeURIComponent(book)}&chapter=${chapter}`, signal)
export const searchMinistryBooks = (query: string, signal?: AbortSignal, mode: 'words' | 'phrase' = 'words', limit = 5) => getJson<{ query: string; total: number; results: MinistryBookSearchResult[] }>(`/ministry-books/search?q=${encodeURIComponent(query)}&limit=${limit}${mode === 'phrase' ? '&match=phrase' : ''}`, signal)
