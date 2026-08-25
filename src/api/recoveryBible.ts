import { AIOS_API_BASE_URL } from '../config/api'

export interface BibleBook { id: string; name: string; chapters: number; slug: string }
export interface BibleReferenceLink { bookId: string; book: string; chapter: number; verse: number; label: string }
export interface BibleStudyNote { marker: string; word: string; note: string; noteParagraphs: string[]; references: string; referenceLinks: BibleReferenceLink[] }
export interface BibleVerse { number: number; reference: string; text: string; footnotes: string[]; crossReferences: string[]; studyNotes: BibleStudyNote[] }
export interface BibleChapter { book: BibleBook; chapter: number; verses: BibleVerse[]; footnoteCoverage: 'sample' | 'complete' }
export interface ConcordanceResult { book: { id: string; name: string }; chapter: number; verse: number; reference: string; text: string; testament?: 'Old Testament' | 'New Testament' }
export interface ConcordanceResponse { query: string; total: number; oldTestamentTotal?: number; newTestamentTotal?: number; results: ConcordanceResult[] }
export interface BibleBookMatter {
  book: { id: string; name: string; chapters: number }
  contents: Array<{ chapter: number; label: string }>
  introduction: { details: Array<{ label: string; value: string }>; theme: string }
  instructions: { introduction: string[]; preface: string[] }
  studyAids: { outline: { available: boolean; overview: string[] }; charts: { available: boolean; note: string } }
}

async function readJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${AIOS_API_BASE_URL}${path}`, { signal })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { detail?: string }
    throw new Error(body.detail || 'Unable to load the Recovery Bible.')
  }
  return response.json() as Promise<T>
}

export async function getRecoveryBibleBooks(signal?: AbortSignal) {
  return readJson<{ books: BibleBook[] }>('/recovery-bible/books', signal)
}

export async function getRecoveryBibleChapter(book: string, chapter: number, signal?: AbortSignal) {
  const chapterData = await readJson<BibleChapter>(`/recovery-bible/chapter?book=${encodeURIComponent(book)}&chapter=${chapter}`, signal)
  return {
    ...chapterData,
    verses: chapterData.verses.map((verse) => ({ ...verse, footnotes: verse.footnotes ?? [], crossReferences: verse.crossReferences ?? [], studyNotes: (verse.studyNotes ?? []).map((note) => ({ ...note, noteParagraphs: note.noteParagraphs ?? (note.note ? [note.note] : []), referenceLinks: note.referenceLinks ?? [] })) })),
  }
}

export async function getRecoveryBibleBookMatter(book: string, signal?: AbortSignal) {
  return readJson<BibleBookMatter>(`/recovery-bible/book-matter?book=${encodeURIComponent(book)}`, signal)
}

export function getRecoveryBibleOutlineUrl(book: string) {
  return `${AIOS_API_BASE_URL}/recovery-bible/book-outline?book=${encodeURIComponent(book)}`
}

const OFFICIAL_NT_OUTLINE_FILES: Record<string, string> = {
  Matthew: '40_Matthew_o.htm',
  Mark: '41_Mark_o.htm',
  Luke: '42_Luke_o.htm',
  John: '43_John_o.htm',
  Acts: '44_Acts_o.htm',
  Romans: '45_Romans_o.htm',
  '1 Corinthians': '46_1Corinthians_o.htm',
  '2 Corinthians': '47_2Corinthians_o.htm',
  Galatians: '48_Galatians_o.htm',
  Ephesians: '49_Ephesians_o.htm',
  Philippians: '50_Philippians_o.htm',
  Colossians: '51_Colossians_o.htm',
  '1 Thessalonians': '52_1Thessalonians_o.htm',
  '2 Thessalonians': '53_2Thessalonians_o.htm',
  '1 Timothy': '54_1Timothy_o.htm',
  '2 Timothy': '55_2Timothy_o.htm',
  Titus: '56_Titus_o.htm',
  Philemon: '57_Philemon_o.htm',
  Hebrews: '58_Hebrews_o.htm',
  James: '59_James_o.htm',
  '1 Peter': '60_1Peter_o.htm',
  '2 Peter': '61_2Peter_o.htm',
  '1 John': '62_1John_o.htm',
  '2 John': '63_2John_o.htm',
  '3 John': '64_3John_o.htm',
  Jude: '65_Jude_o.htm',
  Revelation: '66_Revelation_o.htm',
}

export function getOfficialRecoveryBibleOutlineUrl(bookName?: string) {
  if (!bookName) return null
  const filename = OFFICIAL_NT_OUTLINE_FILES[bookName]
  return filename ? `https://text.recoveryversion.bible/${filename}` : null
}

export async function searchRecoveryBible(query: string, signal?: AbortSignal) {
  return readJson<ConcordanceResponse>(`/recovery-bible/concordance?q=${encodeURIComponent(query)}&limit=100`, signal)
}
