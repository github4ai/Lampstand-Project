import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const canonicalBooks = ['genesis','exodus','leviticus','numbers','deuteronomy','joshua','judges','ruth','1-samuel','2-samuel','1-kings','2-kings','1-chronicles','2-chronicles','ezra','nehemiah','esther','job','psalms','proverbs','ecclesiastes','song-of-songs','isaiah','jeremiah','lamentations','ezekiel','daniel','hosea','joel','amos','obadiah','jonah','micah','nahum','habakkuk','zephaniah','haggai','zechariah','malachi','matthew','mark','luke','john','acts','romans','1-corinthians','2-corinthians','galatians','ephesians','philippians','colossians','1-thessalonians','2-thessalonians','1-timothy','2-timothy','titus','philemon','hebrews','james','1-peter','2-peter','1-john','2-john','3-john','jude','revelation']
const messageCache = new Map()
let searchIndexCache

function decode(value) {
  return value.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&mdash;/gi, '—').replace(/&ndash;/gi, '–').replace(/\s+/g, ' ').trim()
}

function displayName(slug) {
  if (slug === '1-samuel') return '1 & 2 Samuel'
  if (slug === '1-kings') return '1 & 2 Kings'
  return slug.split('-').map((part) => /^\d$/.test(part) ? part : part[0].toUpperCase() + part.slice(1)).join(' ')
}

function linkSegments(html) {
  const segments = []; let position = 0
  for (const match of html.matchAll(/<a[^>]+href="[^"]*\/bible\/([^/]+)\/(\d+)\/(?:index\.html)?(?:#(\d+))?"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const start = match.index ?? 0; const before = decode(html.slice(position, start))
    if (before) segments.push({ type: 'text', text: before })
    const label = decode(match[4]); const startVerse = Number(match[3] || 1)
    const range = label.match(/:(\d+)\s*[–—-]\s*(\d+)/) || label.match(/(?:vv?\.?\s*)?(\d+)\s*[–—-]\s*(\d+)$/i)
    segments.push({ type: 'bible-reference', text: label, bookSlug: match[1], chapter: Number(match[2]), verse: startVerse, verseEnd: range && Number(range[1]) === startVerse ? Number(range[2]) : startVerse })
    position = start + match[0].length
  }
  const after = decode(html.slice(position)); if (after) segments.push({ type: 'text', text: after })
  return segments.length ? segments : [{ type: 'text', text: decode(html) }]
}

async function messageDirectories(bookDir) {
  const entries = await readdir(bookDir, { withFileTypes: true })
  return entries.filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name)).map((entry) => Number(entry.name)).sort((a, b) => a - b)
}

export async function listLifeStudyBooks(config) {
  const entries = await readdir(config.lifeStudyDir, { withFileTypes: true })
  const books = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('life-study-of-')) continue
    const slug = entry.name.slice('life-study-of-'.length)
    const numbers = await messageDirectories(join(config.lifeStudyDir, entry.name))
    if (!numbers.length) continue
    books.push({ slug, name: displayName(slug), messages: numbers.length, firstMessage: numbers[0], lastMessage: numbers.at(-1) })
  }
  books.sort((left, right) => canonicalBooks.indexOf(left.slug) - canonicalBooks.indexOf(right.slug))
  return books
}

export async function listLifeStudyMessages(slug, config) {
  if (messageCache.has(slug)) return messageCache.get(slug)
  const bookDir = join(config.lifeStudyDir, `life-study-of-${slug}`)
  const numbers = await messageDirectories(bookDir)
  const messages = []
  for (const number of numbers) {
    const html = await readFile(join(bookDir, String(number), 'index.html'), 'utf8')
    const title = decode(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || `Message ${number}`)
    messages.push({ number, title })
  }
  messageCache.set(slug, messages)
  return messages
}

export async function readLifeStudyMessage(slug, numberValue, config) {
  const number = Number(numberValue)
  const messages = await listLifeStudyMessages(slug, config)
  const message = messages.find((item) => item.number === number)
  if (!message) { const error = new Error('Life-Study message was not found.'); error.status = 404; throw error }
  const html = await readFile(join(config.lifeStudyDir, `life-study-of-${slug}`, String(number), 'index.html'), 'utf8')
  const regionStart = html.search(/<div class="body jMainRegion region_chapter region_lifestudy">/i)
  const contentStart = html.indexOf('<div>', regionStart)
  const contentEnd = html.indexOf('<div class="page-preloader', contentStart)
  const content = html.slice(contentStart, contentEnd)
  const blocks = [...content.matchAll(/<(h[1-4]|p)[^>]*>([\s\S]*?)<\/\1>/gi)].map((match, index) => ({
    id: index + 1,
    type: match[1].toLowerCase().startsWith('h') ? 'heading' : 'paragraph',
    level: match[1].toLowerCase().startsWith('h') ? Number(match[1][1]) : null,
    text: decode(match[2]),
    segments: linkSegments(match[2]),
  })).filter((block) => block.text)
  return { book: { slug, name: displayName(slug) }, message, messages, blocks }
}

async function buildSearchIndex(config) {
  const rows = []
  for (const book of await listLifeStudyBooks(config)) {
    for (const summary of await listLifeStudyMessages(book.slug, config)) {
      const message = await readLifeStudyMessage(book.slug, summary.number, config)
      rows.push({
        book: { slug: book.slug, name: book.name },
        message: summary,
        blocks: message.blocks,
        searchable: `${summary.title} ${message.blocks.map((block) => block.text).join(' ')}`.toLowerCase(),
      })
    }
  }
  return rows
}

export async function searchLifeStudy(queryValue, limitValue, config) {
  const query = String(queryValue || '').trim()
  const words = query.toLowerCase().split(/\s+/).filter((word) => word.length > 2)
  if (!words.length) return { query, total: 0, results: [] }
  if (!searchIndexCache) searchIndexCache = await buildSearchIndex(config)
  const matches = []
  for (const row of searchIndexCache) {
    if (!words.every((word) => row.searchable.includes(word))) continue
    const matchingBlock = row.blocks.find((block) => words.every((word) => block.text.toLowerCase().includes(word)))
      || row.blocks.find((block) => words.some((word) => block.text.toLowerCase().includes(word)))
    if (!matchingBlock) continue
    const lower = matchingBlock.text.toLowerCase()
    const firstPosition = Math.min(...words.map((word) => lower.indexOf(word)).filter((position) => position >= 0))
    const start = Math.max(0, firstPosition - 120)
    const excerpt = `${start ? '…' : ''}${matchingBlock.text.slice(start, start + 520).trim()}${matchingBlock.text.length > start + 520 ? '…' : ''}`
    const titleScore = words.filter((word) => row.message.title.toLowerCase().includes(word)).length * 4
    const blockScore = words.filter((word) => lower.includes(word)).length
    matches.push({ book: row.book, message: row.message, block: matchingBlock.id, excerpt, score: titleScore + blockScore })
  }
  matches.sort((left, right) => right.score - left.score || left.book.name.localeCompare(right.book.name) || left.message.number - right.message.number)
  const limit = Math.min(20, Math.max(1, Number(limitValue) || 5))
  return { query, total: matches.length, results: matches.slice(0, limit) }
}
