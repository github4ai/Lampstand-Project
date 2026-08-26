import { getRecoveryBibleBooks, getRecoveryBibleChapter, searchRecoveryBible } from './recoveryBible'
import type { StreamSource } from '../types/chat'
import { searchLifeStudy } from './lifeStudy'
import { getHymnalLibrary } from './hymnal'
import { firstLyricLine } from '../utils/hymnBrowse'
import { stripChords } from '../utils/chords'
import { searchMinistryBooks } from './ministryBooks'
import { searchKnowledge } from './knowledgeSearch'
import { getKnowledgeSources } from '../services/knowledge'

export interface DirectMinistryAnswer {
  content: string
  sources: StreamSource[]
}

export async function resolveDirectLifeStudyQuestion(
  question: string,
  signal?: AbortSignal,
): Promise<DirectMinistryAnswer | null> {
  const search = await searchLifeStudy(question, signal)
  if (!search.results.length) return null
  const sections = search.results.map((result) =>
    `### ${result.book.name} — Message ${result.message.number}\n\n**${result.message.title}**\n\n${result.excerpt}`,
  )
  return {
    content: `${sections.join('\n\n---\n\n')}\n\n*Results from the locally installed Life-Study library.*`,
    sources: search.results.map((result, index) => ({
      id: index + 1,
      citation: `Life-Study of ${result.book.name}, Message ${result.message.number}: ${result.message.title}`,
      source: 'Life-Study',
      page: null,
      chunk: result.block,
      rerank_score: result.score,
      url: `/life-study?book=${encodeURIComponent(result.book.slug)}&message=${result.message.number}&block=${result.block}`,
    })),
  }
}

export async function resolveDirectHymnalQuestion(
  question: string,
  signal?: AbortSignal,
): Promise<DirectMinistryAnswer | null> {
  const { hymns } = await getHymnalLibrary(signal)
  const normalized = question.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const stopWords = new Set(['a', 'an', 'and', 'for', 'find', 'hymn', 'hymns', 'in', 'is', 'me', 'of', 'on', 'please', 'show', 'the', 'to', 'with'])
  const words = normalized.split(' ').filter((word) => word && !stopWords.has(word))
  if (!words.length) return null

  const matches = hymns.map((hymn) => {
    const catalog = `${hymn.catalogPrefix ?? ''}${hymn.hymnNumber ?? ''}`.toLowerCase()
    const firstLine = firstLyricLine(hymn)
    const lyricText = hymn.sections.flatMap((section) => section.lines).map(stripChords).join(' ')
    const metadata = [hymn.title, catalog, hymn.category, hymn.subcategory, hymn.language, ...(hymn.scriptures ?? []), ...hymn.themes, firstLine].filter(Boolean).join(' ').toLowerCase()
    const fullText = `${metadata} ${lyricText.toLowerCase()}`
    if (!words.every((word) => fullText.includes(word))) return null
    const score = words.reduce((total, word) => total + (hymn.title.toLowerCase().includes(word) ? 6 : 0) + (catalog.includes(word) ? 8 : 0) + (metadata.includes(word) ? 3 : 1), 0)
    return { hymn, score, firstLine }
  }).filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => right.score - left.score || left.hymn.title.localeCompare(right.hymn.title))
    .slice(0, 8)

  if (!matches.length) return null
  const content = matches.map(({ hymn, firstLine }) => {
    const number = `${hymn.catalogPrefix ?? ''} ${hymn.hymnNumber ?? ''}`.trim()
    const details = [number, hymn.category, hymn.subcategory].filter(Boolean).join(' · ')
    return `### ${hymn.title}\n\n${details ? `**${details}**\n\n` : ''}${firstLine ? `First line: *${firstLine}*` : ''}`
  }).join('\n\n---\n\n')

  return {
    content: `${content}\n\n*Results from the locally installed Hymnal.net library.*`,
    sources: matches.map(({ hymn, score }, index) => ({
      id: index + 1,
      citation: `${`${hymn.catalogPrefix ?? ''} ${hymn.hymnNumber ?? ''}`.trim()} — ${hymn.title}`.replace(/^ — /, ''),
      source: 'Hymnal.net local library',
      page: null,
      chunk: null,
      rerank_score: score,
      url: `/hymnal?hymn=${encodeURIComponent(hymn.id)}`,
    })),
  }
}

export async function resolveDirectMinistryBooksQuestion(
  question: string,
  signal?: AbortSignal,
): Promise<DirectMinistryAnswer | null> {
  const search = await searchMinistryBooks(question, signal)
  if (!search.results.length) return null
  return {
    content: `${search.results.map((result) => `### ${result.book.title}\n\n**Chapter ${result.chapter.number}: ${result.chapter.title}**\n\n${result.excerpt}`).join('\n\n---\n\n')}\n\n*Results from the locally installed Ministry Books library.*`,
    sources: search.results.map((result, index) => ({
      id: index + 1,
      citation: `${result.book.title} — Chapter ${result.chapter.number}: ${result.chapter.title}`,
      source: 'Ministry Books local library',
      page: null,
      chunk: result.block,
      rerank_score: result.score,
      url: `/ministry-books?book=${encodeURIComponent(result.book.id)}&chapter=${result.chapter.number}&block=${result.block}`,
    })),
  }
}

export async function resolveDirectHwmrQuestion(
  question: string,
  signal?: AbortSignal,
): Promise<DirectMinistryAnswer | null> {
  const [search, sources] = await Promise.all([
    searchKnowledge({ query: question, category: 'Ministry', topK: 50, includeText: true, signal }),
    getKnowledgeSources(signal),
  ])
  const hwmrStems = sources.filter((source) => source.category === 'Ministry' && /^HWMR(?:[\\/]|$)/i.test(source.subcollection ?? ''))
    .map((source) => source.name.replace(/\.(?:pdf|html?|epub|docx|txt|md|markdown|pdb)$/i, '').toLowerCase())
  const results = search.results.filter((result) => {
    const identity = `${result.document} ${result.source} ${result.chunk_file}`.toLowerCase()
    return /(?:^|[\\/])hwmr(?:[\\/]|$)/i.test(result.source) || hwmrStems.some((stem) => identity.includes(stem))
  }).slice(0, 6)
  if (!results.length) return null
  return {
    content: `${results.map((result) => `### ${result.document || result.source}\n\n**Chunk ${result.chunk}${result.page !== null ? ` · Page ${result.page}` : ''}**\n\n${result.text || result.preview}`).join('\n\n---\n\n')}\n\n*Results from your indexed HWMR documents.*`,
    sources: results.map((result, index) => ({
      id: index + 1,
      citation: result.citation || `${result.document || result.source} — Chunk ${result.chunk}`,
      source: 'HWMR',
      page: result.page,
      chunk: result.chunk,
      rerank_score: result.rerank_score ?? result.combined_score ?? result.score,
      url: `/knowledge/view/${encodeURIComponent(result.category)}/${encodeURIComponent(result.document || result.source)}/${result.chunk}?q=${encodeURIComponent(question)}`,
    })),
  }
}

function removeLocalLibraryFooter(content: string) {
  return content.replace(/\n\n\*Results from the locally installed [^*]+ library\.\*$/, '')
}

export async function resolveUnifiedMinistryQuestion(
  question: string,
  signal?: AbortSignal,
): Promise<DirectMinistryAnswer | null> {
  const questionWords = new Set(['a', 'about', 'an', 'and', 'can', 'could', 'define', 'do', 'does', 'explain', 'find', 'for', 'give', 'how', 'in', 'is', 'me', 'mean', 'of', 'on', 'please', 'show', 'tell', 'the', 'to', 'what', 'where', 'which', 'who', 'why', 'with', 'would'])
  const keywords = question.toLowerCase().replace(/[^a-z0-9'\s-]/g, ' ').split(/\s+/).filter((word) => word.length > 1 && !questionWords.has(word)).join(' ')
  const libraryQuery = keywords || question
  const settled = await Promise.allSettled([
    searchRecoveryBible(libraryQuery, signal),
    resolveDirectLifeStudyQuestion(libraryQuery, signal),
    resolveDirectMinistryBooksQuestion(libraryQuery, signal),
    resolveDirectHymnalQuestion(libraryQuery, signal),
    resolveDirectHwmrQuestion(libraryQuery, signal),
  ])
  const sections: string[] = []
  const sources: StreamSource[] = []
  const bible = settled[0].status === 'fulfilled' ? settled[0].value : null
  if (bible?.results.length) {
    const results = bible.results.slice(0, 4)
    const books = await getRecoveryBibleBooks()
    sections.push(`## Recovery Bible\n\n${results.map((result) => `**${result.reference}** — ${result.text}`).join('\n\n')}`)
    for (const result of results) {
      const book = books.books.find((item) => item.id === result.book.id)
      if (!book) continue
      sources.push({
        id: sources.length + 1,
        citation: `${result.reference} — Recovery Version`,
        source: 'Recovery Bible',
        page: null,
        chunk: result.verse,
        rerank_score: null,
        url: `/recovery-bible?book=${encodeURIComponent(book.slug)}&chapter=${result.chapter}&verse=${result.verse}&verseEnd=${result.verse}`,
      })
    }
  }
  const grouped: Array<[string, PromiseSettledResult<DirectMinistryAnswer | null>]> = [
    ['Life-Study', settled[1]],
    ['Ministry Books', settled[2]],
    ['Hymnal', settled[3]],
    ['HWMR', settled[4]],
  ]
  for (const [label, result] of grouped) {
    if (result.status !== 'fulfilled' || !result.value) continue
    sections.push(`## ${label}\n\n${removeLocalLibraryFooter(result.value.content)}`)
    for (const source of result.value.sources.slice(0, 4)) sources.push({ ...source, id: sources.length + 1 })
  }
  if (!sections.length) return null
  return {
    content: `${sections.join('\n\n---\n\n')}\n\n*Grounded results from your locally installed Ministry libraries.*`,
    sources,
  }
}

export async function resolveDirectBibleQuestion(
  question: string,
  signal?: AbortSignal,
): Promise<DirectMinistryAnswer | null> {
  const { books } = await getRecoveryBibleBooks(signal)
  const normalized = question.replace(/[–—]/g, '-').trim()
  const orderedBooks = [...books].sort((left, right) => right.name.length - left.name.length)

  for (const book of orderedBooks) {
    const escapedName = book.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = normalized.match(new RegExp(`\\b${escapedName}\\s+(\\d+)\\s*:\\s*(\\d+)(?:\\s*-\\s*(\\d+))?`, 'i'))
    if (!match) continue

    const chapterNumber = Number(match[1])
    const startVerse = Number(match[2])
    const endVerse = Number(match[3] || match[2])
    if (chapterNumber < 1 || chapterNumber > book.chapters || endVerse < startVerse) return null

    const chapter = await getRecoveryBibleChapter(book.id, chapterNumber, signal)
    const verses = chapter.verses.filter((verse) => verse.number >= startVerse && verse.number <= endVerse)
    if (!verses.length || verses[0].number !== startVerse) return null

    const reference = `${book.name} ${chapterNumber}:${startVerse}${endVerse > startVerse ? `-${endVerse}` : ''}`
    const verseText = verses.map((verse) => `**${verse.number}** ${verse.text}`).join('\n\n')
    const query = new URLSearchParams({
      book: book.slug,
      chapter: String(chapterNumber),
      verse: String(startVerse),
      verseEnd: String(endVerse),
    })

    return {
      content: `### ${reference}\n\n${verseText}\n\n*Recovery Version*`,
      sources: [{
        id: 1,
        citation: `${reference} — Recovery Version`,
        source: 'Recovery Bible',
        page: null,
        chunk: null,
        rerank_score: null,
        url: `/recovery-bible?${query.toString()}`,
      }],
    }
  }

  return null
}
