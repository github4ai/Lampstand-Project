import { access, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const bookFilePattern = /^(\d{2}) (.+) - Recovery Version\.txt$/
const referencePattern = /^(.+?) (\d+):(\d+)(?:-(\d+))?$/
const versePattern = /^.+?\s+(\d+):(\d+)\s+(.+)$/
let libraryCache
let concordanceCache
let bookMatterCache

const specialSlugs = {
  Matthew: 'the-gospel-according-to-matthew', Mark: 'the-gospel-according-to-mark', Luke: 'the-gospel-according-to-luke', John: 'the-gospel-according-to-john',
  Acts: 'the-acts-of-the-apostles', Romans: 'the-epistle-of-paul-to-the-romans', Galatians: 'the-epistle-of-paul-to-the-galatians', Ephesians: 'the-epistle-of-paul-to-the-ephesians',
  Philippians: 'the-epistle-of-paul-to-the-philippians', Colossians: 'the-epistle-of-paul-to-the-colossians', Titus: 'the-epistle-of-paul-to-titus', Philemon: 'the-epistle-of-paul-to-philemon',
  Hebrews: 'the-epistle-to-the-hebrews', James: 'the-epistle-of-james', Jude: 'the-epistle-of-jude', Revelation: 'revelation',
  '1 Corinthians': 'the-first-epistle-of-paul-to-the-corinthians', '2 Corinthians': 'the-second-epistle-of-paul-to-the-corinthians',
  '1 Thessalonians': 'the-first-epistle-of-paul-to-the-thessalonians', '2 Thessalonians': 'the-second-epistle-of-paul-to-the-thessalonians',
  '1 Timothy': 'the-first-epistle-of-paul-to-timothy', '2 Timothy': 'the-second-epistle-of-paul-to-timothy',
  '1 Peter': 'the-first-epistle-of-peter', '2 Peter': 'the-second-epistle-of-peter',
  '1 John': 'the-first-epistle-of-john', '2 John': 'the-second-epistle-of-john', '3 John': 'the-third-epistle-of-john',
  '1 Samuel': 'first-samuel', '2 Samuel': 'second-samuel', '1 Kings': 'first-kings', '2 Kings': 'second-kings',
  '1 Chronicles': 'first-chronicles', '2 Chronicles': 'second-chronicles',
}

function cleanHtml(value = '') {
  return value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&mdash;/gi, '—').replace(/&ndash;/gi, '–').replace(/\s+/g, ' ').trim()
}

function bookSlug(name) { return specialSlugs[name] || name.toLowerCase().replace(/\s+/g, '-') }

async function firstReadable(paths, encoding = 'utf8') {
  for (const path of paths) {
    try { return await readFile(path, encoding) } catch { /* try the next authorized local source */ }
  }
  return encoding ? '' : null
}

function localDataRoots(config) {
  return [
    join(config.recoveryBibleDir, 'Study Aids'),
    join(process.cwd(), 'data', 'ministry', 'recovery-bible', 'Study Aids'),
  ]
}

function footnoteIndexes(config) {
  return [
    join(config.recoveryFootnotesDir, 'index.html'),
    join(process.cwd(), 'data', 'ministry', 'recovery-footnotes', 'index.html'),
  ]
}

function parseResetArray(html) {
  const marker = 'App.Collections.books.reset('
  const start = html.indexOf(marker)
  if (start < 0) return []
  const arrayStart = html.indexOf('[', start + marker.length)
  if (arrayStart < 0) return []
  let depth = 0; let quoted = false; let escaped = false
  for (let index = arrayStart; index < html.length; index += 1) {
    const character = html[index]
    if (quoted) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') quoted = false
      continue
    }
    if (character === '"') { quoted = true; continue }
    if (character === '[') depth += 1
    if (character === ']' && --depth === 0) {
      try { return JSON.parse(html.slice(arrayStart, index + 1)) } catch { return [] }
    }
  }
  return []
}

function cleanRichText(value = '') {
  return value.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/p>/gi, '\n\n')
    .split(/\n+/).map((part) => cleanHtml(part)).filter(Boolean).join('\n')
}

function studyText(value = '') {
  return value.replace(/^\uFEFF/, '').split(/\r?\n\s*\r?\n/).map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

async function bookMetadata(config) {
  if (bookMatterCache) return bookMatterCache
  const html = await firstReadable(footnoteIndexes(config))
  bookMatterCache = parseResetArray(html).filter((item) => item?.bookType === 'BibleBook' && !item?.isLifestudy)
  return bookMatterCache
}

export async function readRecoveryBibleBookMatter(bookId, config) {
  const books = await library(config)
  const book = books.find((item) => item.id === String(bookId).padStart(2, '0'))
  if (!book) { const error = new Error('Recovery Bible book was not found.'); error.status = 404; throw error }
  const metadata = (await bookMetadata(config)).find((item) => Number(item.number) === Number(book.id) || item.title === book.name)
  const roots = localDataRoots(config)
  const [introduction, preface, outlineOverview] = await Promise.all([
    firstReadable(roots.map((root) => join(root, 'Recovery Version - Introduction.txt'))),
    firstReadable(roots.map((root) => join(root, 'Recovery Version - Preface Excerpt.txt'))),
    firstReadable(roots.map((root) => join(root, 'Recovery Version - Outlines Overview.txt'))),
  ])
  const outlinePaths = roots.map((root) => join(root, `Recovery Version - ${book.name} Outline.pdf`))
  let outlineAvailable = false
  for (const path of outlinePaths) { try { await access(path); outlineAvailable = true; break } catch { /* unavailable */ } }
  const details = cleanRichText(metadata?.description || '').split('\n').filter(Boolean).map((line) => {
    const separator = line.indexOf(':')
    return separator > 0 ? { label: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim() } : { label: '', value: line }
  })
  return {
    book: { id: book.id, name: book.name, chapters: book.chapters },
    contents: Array.from({ length: book.chapters }, (_, index) => ({ chapter: index + 1, label: `${book.name} ${index + 1}` })),
    introduction: { details, theme: cleanRichText(metadata?.theme || '') },
    instructions: { introduction: studyText(introduction), preface: studyText(preface) },
    studyAids: {
      outline: { available: outlineAvailable, overview: studyText(outlineOverview) },
      charts: { available: false, note: 'No authorized local chart is available for this book yet.' },
    },
  }
}

export async function readRecoveryBibleBookOutline(bookId, config) {
  const books = await library(config)
  const book = books.find((item) => item.id === String(bookId).padStart(2, '0'))
  if (!book) { const error = new Error('Recovery Bible book was not found.'); error.status = 404; throw error }
  const filename = `Recovery Version - ${book.name} Outline.pdf`
  for (const root of localDataRoots(config)) {
    try {
      const buffer = await readFile(join(root, filename))
      return { buffer, filename, contentType: 'application/pdf' }
    } catch { /* try the next authorized local source */ }
  }
  const error = new Error(`No authorized local outline is available for ${book.name}.`)
  error.status = 404
  throw error
}

async function chapterStudyAids(book, chapter, books, config) {
  let html = ''
  try { html = await readFile(join(config.recoveryFootnotesDir, bookSlug(book.name), String(chapter), 'index.html'), 'utf8') } catch { return new Map() }
  const result = new Map()
  for (const match of html.matchAll(/<li class="jNote" data-anchor="(\d+)_(\d+)_([^"]+)">([\s\S]*?)<\/li>/gi)) {
    if (Number(match[1]) !== chapter) continue
    const verse = Number(match[2]); const marker = match[3]; const block = match[4]
    const word = cleanHtml(block.match(/<div class="link">([\s\S]*?)<\/div>/i)?.[1] || '').replace(/^\d+:\d+\s*/, '').replace(new RegExp(`^${marker}\\s*`), '')
    const noteHtml = block.match(/<div class="text">([\s\S]*?)<\/div>/i)?.[1] || ''
    const noteParagraphs = [...noteHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((paragraph) => cleanHtml(paragraph[1])).filter(Boolean)
    const note = noteParagraphs.join('\n\n') || cleanHtml(noteHtml)
    const referenceHtml = block.match(/<div class="reference">([\s\S]*?)<\/div>/i)?.[1] || ''
    const references = cleanHtml(referenceHtml)
    const referenceLinks = [...referenceHtml.matchAll(/<a[^>]+href="[^"]*\/bible\/([^/]+)\/(\d+)\/#(\d+)"[^>]*>([\s\S]*?)<\/a>/gi)].map((link) => {
      const targetBook = books.find((item) => bookSlug(item.name) === link[1])
      return targetBook ? { bookId: targetBook.id, book: targetBook.name, chapter: Number(link[2]), verse: Number(link[3]), label: cleanHtml(link[4]) } : null
    }).filter(Boolean)
    const current = result.get(verse) || { footnotes: [], crossReferences: [], studyNotes: [] }
    if (note) current.footnotes.push(`[${marker}]${word ? ` ${word} —` : ''} ${note}`)
    if (references) current.crossReferences.push(`[${marker}]${word ? ` ${word} —` : ''} ${references}`)
    current.studyNotes.push({ marker, word, note, noteParagraphs: noteParagraphs.length ? noteParagraphs : note ? [note] : [], references, referenceLinks })
    result.set(verse, current)
  }
  return result
}

async function buildLibrary(config) {
  const entries = await readdir(config.recoveryBibleDir, { withFileTypes: true })
  const books = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const match = entry.name.match(bookFilePattern)
    if (!match) continue
    const text = await readFile(join(config.recoveryBibleDir, entry.name), 'utf8')
    const chapters = [...text.matchAll(/^.+ (\d+)$/gm)].map((item) => Number(item[1]))
    books.push({ id: match[1], name: match[2], chapters: Math.max(...chapters), file: entry.name })
  }
  books.sort((left, right) => left.id.localeCompare(right.id))
  return books
}

async function library(config) {
  if (!libraryCache) libraryCache = await buildLibrary(config)
  return libraryCache
}

async function sampleFootnotes(config) {
  const file = join(config.recoveryBibleDir, 'Study Aids', 'Recovery Version - Footnote Samples.txt')
  let text = ''
  try { text = await readFile(file, 'utf8') } catch { return new Map() }
  const paragraphs = text.split(/\r?\n\s*\r?\n/).map((value) => value.trim()).filter(Boolean)
  const notes = new Map()
  for (let index = 0; index < paragraphs.length; index += 1) {
    const match = paragraphs[index].match(referencePattern)
    if (!match || index + 2 >= paragraphs.length) continue
    const note = paragraphs[index + 2]
    if (!/^\d+\[\d+\]/.test(note)) continue
    const start = Number(match[3])
    const end = Number(match[4] || match[3])
    for (let verse = start; verse <= end; verse += 1) {
      const key = `${match[1]} ${match[2]}:${verse}`.toLowerCase()
      const existing = notes.get(key) || []
      existing.push(note.replace(/^\d+\[(\d+)\]\s*/, '[$1] '))
      notes.set(key, existing)
    }
  }
  return notes
}

export async function listRecoveryBibleBooks(config) {
  return (await library(config)).map(({ file: _file, ...book }) => ({ ...book, slug: bookSlug(book.name) }))
}

export async function readRecoveryBibleChapter(bookId, chapterNumber, config) {
  const books = await library(config)
  const book = books.find((item) => item.id === String(bookId).padStart(2, '0'))
  const chapter = Number(chapterNumber)
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) {
    const error = new Error('Recovery Bible book or chapter was not found.')
    error.status = 404
    throw error
  }
  const text = await readFile(join(config.recoveryBibleDir, book.file), 'utf8')
  const samples = await sampleFootnotes(config)
  const studyAids = await chapterStudyAids(book, chapter, books, config)
  const verses = []
  let activeChapter = 0
  for (const line of text.split(/\r?\n/)) {
    if (line === `${book.name} ${chapter}`) { activeChapter = chapter; continue }
    if (activeChapter && line.match(new RegExp(`^${book.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\d+$`))) break
    if (activeChapter !== chapter) continue
    const match = line.match(versePattern)
    if (!match || Number(match[1]) !== chapter) continue
    const number = Number(match[2])
    const reference = `${book.name} ${chapter}:${number}`
    const aids = studyAids.get(number)
    verses.push({ number, reference, text: match[3], footnotes: aids?.footnotes || samples.get(reference.toLowerCase()) || [], crossReferences: aids?.crossReferences || [], studyNotes: aids?.studyNotes || [] })
  }
  return { book: { id: book.id, name: book.name, chapters: book.chapters }, chapter, verses, footnoteCoverage: studyAids.size ? 'complete' : 'sample' }
}

async function concordance(config) {
  if (concordanceCache) return concordanceCache
  const books = await library(config); const rows = []
  for (const book of books) {
    const text = await readFile(join(config.recoveryBibleDir, book.file), 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(versePattern)
      if (match) rows.push({ book: { id: book.id, name: book.name }, chapter: Number(match[1]), verse: Number(match[2]), reference: `${book.name} ${match[1]}:${match[2]}`, text: match[3] })
    }
  }
  concordanceCache = rows
  return rows
}

export async function searchRecoveryBible(query, limitValue, config, mode) {
  const term = String(query || '').trim().toLowerCase()
  if (term.length < 2) return { query: term, results: [], total: 0, oldTestamentTotal: 0, newTestamentTotal: 0 }
  // A phrase has to read in order; a word list only has to appear somewhere in the verse.
  const words = term.split(/\s+/).filter(Boolean)
  const matches = (await concordance(config)).filter((row) => (mode === 'phrase' ? row.text.toLowerCase().includes(term) : words.every((word) => row.text.toLowerCase().includes(word))))
  const limit = Math.min(200, Math.max(1, Number(limitValue) || 50))
  const isNewTestament = (row) => Number.parseInt(String(row.book?.id || ''), 10) >= 40
  const oldTestament = matches.filter((row) => !isNewTestament(row))
  const newTestament = matches.filter(isNewTestament)
  const balanceBooks = (items, maximum) => {
    const byBook = new Map()
    items.forEach((row) => {
      const rows = byBook.get(row.book.id) || []
      rows.push(row); byBook.set(row.book.id, rows)
    })
    const balanced = []
    let offset = 0; let added = true
    while (balanced.length < maximum && added) {
      added = false
      for (const rows of byBook.values()) {
        if (rows[offset]) { balanced.push(rows[offset]); added = true }
        if (balanced.length >= maximum) break
      }
      offset += 1
    }
    return balanced
  }
  const oldLimit = newTestament.length ? Math.floor(limit / 2) : limit
  const newLimit = oldTestament.length ? limit - oldLimit : limit
  const oldResults = balanceBooks(oldTestament, oldLimit).map((row) => ({ ...row, testament: 'Old Testament' }))
  const newResults = balanceBooks(newTestament, newLimit).map((row) => ({ ...row, testament: 'New Testament' }))
  return { query: term, total: matches.length, oldTestamentTotal: oldTestament.length, newTestamentTotal: newTestament.length, results: [...oldResults, ...newResults] }
}
