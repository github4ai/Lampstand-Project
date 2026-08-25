import { access, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const excludedFolders = new Set(['book-the-complete-book-of-Enoch-Dr-Jay-Winter-read-online'])
const libraryCache = new Map()
let searchIndexCache
const databaseCache = new Map()

async function databaseFor(config) {
  if (!config.ministryBooksDatabase) return null
  try { await access(config.ministryBooksDatabase) } catch { return null }
  if (!databaseCache.has(config.ministryBooksDatabase)) databaseCache.set(config.ministryBooksDatabase, new DatabaseSync(config.ministryBooksDatabase, { readOnly: true }))
  return databaseCache.get(config.ministryBooksDatabase)
}

function databaseBook(row) {
  return { id: row.id, title: row.title, author: row.author, chapters: row.chapters, firstChapter: row.first_chapter, lastChapter: row.last_chapter, sourceUrl: row.source_url || '' }
}

function prettySectionTitle(value = '') {
  const title = value.trim()
  if (/^(?:content|contents|front matter|table of contents)$/i.test(title)) return 'Content'
  return title.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function displayTitleFor(chapter, blocks = []) {
  if (chapter.title.includes(' — ')) return chapter.title
  const base = prettySectionTitle(chapter.title)
  if (base === 'Content') return base
  const headingIndex = blocks.findIndex((block) => block.type === 'heading' && block.text.trim() && block.text.trim().toLowerCase() !== chapter.title.trim().toLowerCase() && !/^(?:contents?|front matter|table of contents)$/i.test(block.text.trim()))
  const subtitle = headingIndex < 0 ? '' : blocks.slice(headingIndex).reduce((parts, block) => {
    if (parts.stopped || block.type !== 'heading') return { ...parts, stopped: true }
    return { labels: [...parts.labels, block.text.trim()], stopped: false }
  }, { labels: [], stopped: false }).labels.join(' ')
  return subtitle ? `${base} — ${subtitle}` : base
}

function looksLikeContentsContinuation(blocks = []) {
  const paragraphs = blocks.filter((block) => block.type === 'paragraph').map((block) => block.text.trim())
  const numbered = paragraphs.filter((text) => /^\d+\.(?:\s|$)/.test(text))
  return paragraphs.length > 0 && numbered.length >= Math.max(1, Math.ceil(paragraphs.length / 2))
}

function normalizeDatabaseChapters(database, bookId, rawChapters) {
  const blockQuery = database.prepare('SELECT block_number AS id, type, level, text FROM blocks WHERE book_id = ? AND chapter_number = ? ORDER BY block_number')
  const entries = rawChapters.map((chapter) => ({ ...chapter, blocks: blockQuery.all(bookId, chapter.number) }))
  const hiddenContentNumbers = []
  if (entries.length && prettySectionTitle(entries[0].title) === 'Content') {
    for (let index = 1; index < entries.length && looksLikeContentsContinuation(entries[index].blocks); index += 1) hiddenContentNumbers.push(entries[index].number)
  }
  return {
    chapters: entries.filter((entry) => !hiddenContentNumbers.includes(entry.number)).map(({ blocks, ...chapter }) => ({ ...chapter, displayTitle: displayTitleFor(chapter, blocks) })),
    hiddenContentNumbers,
    blockQuery,
  }
}

function excerptFor(text, words) {
  const lower = text.toLowerCase()
  const positions = words.map((word) => lower.indexOf(word)).filter((position) => position >= 0)
  const start = Math.max(0, (positions.length ? Math.min(...positions) : 0) - 120)
  return `${start ? '…' : ''}${text.slice(start, start + 520).trim()}${text.length > start + 520 ? '…' : ''}`
}

function cleanText(value = '') {
  return value.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&mdash;/gi, '—').replace(/&ndash;/gi, '–').replace(/\s+/g, ' ').trim()
}

function metadata(html, folder) {
  const rawTitle = cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || folder)
  const match = rawTitle.match(/^Book\s+(.+?)\s+author\s+(.+?)\s+read online$/i)
  return { title: match?.[1]?.trim() || rawTitle, author: match?.[2]?.trim() || '' }
}

async function numberedDirectories(directory) {
  return (await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name)).map((entry) => Number(entry.name)).sort((left, right) => left - right)
}

async function buildLibrary(config) {
  try { await access(config.ministryBooksDir) } catch {
    return { ready: false, folder: config.ministryBooksDir, files: 0, books: [], message: 'Add the complete Ministry Books HTML folder to begin.' }
  }
  const books = []
  for (const entry of await readdir(config.ministryBooksDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('book-') || excludedFolders.has(entry.name)) continue
    const directory = join(config.ministryBooksDir, entry.name)
    const chapters = await numberedDirectories(directory)
    if (!chapters.length) continue
    const html = await readFile(join(directory, 'index.html'), 'utf8')
    books.push({ id: entry.name, ...metadata(html, entry.name), chapters: chapters.length, firstChapter: chapters[0], lastChapter: chapters.at(-1) })
  }
  books.sort((left, right) => left.title.localeCompare(right.title))
  return { ready: books.length > 0, folder: config.ministryBooksDir, files: books.reduce((sum, book) => sum + book.chapters, 0), books, message: books.length ? '' : 'No supported ministry-book chapters were found.' }
}

export async function readMinistryBooksLibrary(config) {
  const database = await databaseFor(config)
  if (database) {
    const books = database.prepare('SELECT id, title, author, chapters, first_chapter, last_chapter, source_url FROM books ORDER BY title COLLATE NOCASE').all().map(databaseBook)
    const missingTitles = Number(database.prepare("SELECT value FROM metadata WHERE key='missing_titles'").get()?.value || 0)
    const files = Number(database.prepare("SELECT value FROM metadata WHERE key='chapters'").get()?.value || 0)
    return { ready: books.length > 0, folder: config.ministryBooksDatabase, files, books, missingTitles, format: 'Lampstand SQLite', message: '' }
  }
  if (!libraryCache.has(config.ministryBooksDir)) libraryCache.set(config.ministryBooksDir, await buildLibrary(config))
  return libraryCache.get(config.ministryBooksDir)
}

export async function listMinistryBookChapters(bookId, config) {
  const database = await databaseFor(config)
  if (database) {
    const row = database.prepare('SELECT id, title, author, chapters, first_chapter, last_chapter, source_url FROM books WHERE id = ?').get(bookId)
    if (!row) { const error = new Error('Ministry book was not found.'); error.status = 404; throw error }
    const rawChapters = database.prepare('SELECT number, title FROM chapters WHERE book_id = ? ORDER BY number').all(bookId)
    const { chapters } = normalizeDatabaseChapters(database, bookId, rawChapters)
    return { book: databaseBook(row), chapters }
  }
  const library = await readMinistryBooksLibrary(config)
  const book = library.books.find((item) => item.id === bookId)
  if (!book) { const error = new Error('Ministry book was not found.'); error.status = 404; throw error }
  const chapters = []
  for (const number of await numberedDirectories(join(config.ministryBooksDir, book.id))) {
    const html = await readFile(join(config.ministryBooksDir, book.id, String(number), 'index.html'), 'utf8')
    const title = cleanText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || `Chapter ${number}`)
    chapters.push({ number, title, displayTitle: prettySectionTitle(title) })
  }
  return { book, chapters }
}

export async function readMinistryBookChapter(bookId, chapterValue, config) {
  const database = await databaseFor(config)
  if (database) {
    const { book, chapters } = await listMinistryBookChapters(bookId, config)
    const chapter = chapters.find((item) => item.number === Number(chapterValue))
    if (!chapter) { const error = new Error('Ministry-book chapter was not found.'); error.status = 404; throw error }
    const rawChapters = database.prepare('SELECT number, title FROM chapters WHERE book_id = ? ORDER BY number').all(bookId)
    const { hiddenContentNumbers, blockQuery } = normalizeDatabaseChapters(database, bookId, rawChapters)
    const sectionNumbers = prettySectionTitle(chapter.title) === 'Content' ? [chapter.number, ...hiddenContentNumbers] : [chapter.number]
    const blocks = sectionNumbers.flatMap((number) => blockQuery.all(bookId, number))
      .map((block, index) => ({ ...block, id: index + 1 }))
    return { book, chapter, chapters, blocks }
  }
  const { book, chapters } = await listMinistryBookChapters(bookId, config)
  const chapter = chapters.find((item) => item.number === Number(chapterValue))
  if (!chapter) { const error = new Error('Ministry-book chapter was not found.'); error.status = 404; throw error }
  const html = await readFile(join(config.ministryBooksDir, book.id, String(chapter.number), 'index.html'), 'utf8')
  const regionStart = html.search(/<div class="body jMainRegion region_chapter region_lifestudy">/i)
  const contentStart = html.indexOf('<div>', regionStart)
  const footerStart = html.search(/<div class="footer jMainRegionFooter/i)
  const content = html.slice(contentStart >= 0 ? contentStart : regionStart, footerStart > contentStart ? footerStart : undefined)
  const blocks = [...content.matchAll(/<(h[1-4]|p)[^>]*>([\s\S]*?)<\/\1>/gi)].map((match, index) => ({
    id: index + 1,
    type: match[1].toLowerCase().startsWith('h') ? 'heading' : 'paragraph',
    level: match[1].toLowerCase().startsWith('h') ? Number(match[1][1]) : null,
    text: cleanText(match[2]),
  })).filter((block) => block.text && block.text !== chapter.title)
  return { book, chapter, chapters, blocks }
}

async function buildSearchIndex(config) {
  const rows = []
  const library = await readMinistryBooksLibrary(config)
  for (const book of library.books) {
    const { chapters } = await listMinistryBookChapters(book.id, config)
    for (const summary of chapters) {
      const chapter = await readMinistryBookChapter(book.id, summary.number, config)
      rows.push({
        book,
        chapter: summary,
        blocks: chapter.blocks,
        searchable: `${book.title} ${book.author} ${summary.title} ${chapter.blocks.map((block) => block.text).join(' ')}`.toLowerCase(),
      })
    }
  }
  return rows
}

export async function searchMinistryBooks(queryValue, limitValue, config) {
  const query = String(queryValue || '').trim()
  const stopWords = new Set(['a', 'an', 'and', 'for', 'in', 'is', 'of', 'on', 'the', 'to', 'what', 'who', 'with'])
  const words = query.toLowerCase().split(/\s+/).map((word) => word.replace(/[^a-z0-9'-]/g, '')).filter((word) => word.length > 1 && !stopWords.has(word))
  if (!words.length) return { query, total: 0, results: [] }
  const database = await databaseFor(config)
  if (database) {
    const match = words.map((word) => `"${word.replaceAll('"', '""')}"`).join(' AND ')
    const limit = Math.min(20, Math.max(1, Number(limitValue) || 5))
    const rows = database.prepare(`
      SELECT b.id, b.title, b.author, b.chapters, b.first_chapter, b.last_chapter, b.source_url,
             c.number AS chapter_number, c.title AS chapter_title,
             bl.block_number, bl.text, bm25(block_search) AS rank
      FROM block_search
      JOIN blocks bl ON bl.row_id = block_search.rowid
      JOIN books b ON b.id = bl.book_id
      JOIN chapters c ON c.book_id = bl.book_id AND c.number = bl.chapter_number
      WHERE block_search MATCH ? ORDER BY rank LIMIT ?
    `).all(match, limit)
    const results = rows.map((row) => ({
      book: databaseBook(row), chapter: { number: row.chapter_number, title: row.chapter_title },
      block: row.block_number, excerpt: excerptFor(row.text, words), score: Math.abs(Number(row.rank || 0)),
    }))
    return { query, total: results.length, results }
  }
  if (!searchIndexCache) searchIndexCache = await buildSearchIndex(config)
  const results = []
  for (const row of searchIndexCache) {
    if (!words.every((word) => row.searchable.includes(word))) continue
    const block = row.blocks.find((item) => words.every((word) => item.text.toLowerCase().includes(word)))
      || row.blocks.find((item) => words.some((word) => item.text.toLowerCase().includes(word)))
    if (!block) continue
    const lower = block.text.toLowerCase()
    const positions = words.map((word) => lower.indexOf(word)).filter((position) => position >= 0)
    const start = Math.max(0, Math.min(...positions) - 120)
    const excerpt = `${start ? '…' : ''}${block.text.slice(start, start + 520).trim()}${block.text.length > start + 520 ? '…' : ''}`
    const titleText = `${row.book.title} ${row.chapter.title}`.toLowerCase()
    const score = words.filter((word) => titleText.includes(word)).length * 4 + words.filter((word) => lower.includes(word)).length
    results.push({ book: row.book, chapter: row.chapter, block: block.id, excerpt, score })
  }
  results.sort((left, right) => right.score - left.score || left.book.title.localeCompare(right.book.title) || left.chapter.number - right.chapter.number)
  const limit = Math.min(20, Math.max(1, Number(limitValue) || 5))
  return { query, total: results.length, results: results.slice(0, limit) }
}
