import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'

const decode = (value = '') => value
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&ndash;/gi, '–')
  .replace(/&mdash;/gi, '—')
  .replace(/&([a-z]+);/gi, '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/<[^>]+>/g, '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

const first = (html, pattern) => decode(html.match(pattern)?.[1] || '')
const hrefByText = (html, text) => html.match(new RegExp(`<a[^>]+href=["']([^"']+)["'][^>]*>\\s*${text}\\s*</a>`, 'i'))?.[1]

function detail(html, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return first(html, new RegExp(`<label[^>]*>\\s*${escaped}:?\\s*</label>[\\s\\S]*?<div[^>]*>([\\s\\S]*?)</div>`, 'i'))
}

function chordLines(fragment) {
  const container = fragment.match(/<div class="(?:chorus )?chord-container hidden">([\s\S]*)/i)?.[1]
  if (!container) return []
  const flattened = container.replace(/<div class="chord-text">([\s\S]*?)<\/div>/gi, '$1')
  return [...flattened.matchAll(/<div class="line">([\s\S]*?)<\/div>/gi)].map((match) => decode(match[1]
    .replace(/<span class="chord">([\s\S]*?)<\/span>/gi, (_, chord) => `[${decode(chord)}]`)))
    .filter(Boolean)
}

export function parseHymnalPage(html, sourcePath = '') {
  const catalog = first(html, /<span class="label label-success"[^>]*>([\s\S]*?)<\/span>/i)
  const pathCatalog = sourcePath.replace(/\\/g, '/').match(/\/hymn\/([a-z]+)\/(\d+)\.html$/i)
  const catalogMatch = catalog.match(/^([A-Za-z]+)\s*(\d+)$/) || pathCatalog
  const title = first(html, /<h1 id="song-title"[^>]*>([\s\S]*?)<\/h1>/i)
  if (!title || !catalogMatch) throw new Error(`Not a canonical hymn page: ${sourcePath || 'HTML input'}`)

  const article = html.match(/<article[^>]*class="js-stanzas"[^>]*>([\s\S]*?)<\/article>/i)?.[1] || ''
  const stanzaMatches = [...article.matchAll(/<div data-type="(verse|chorus)" class="verse[^>]*>([\s\S]*?)(?=<div data-type="(?:verse|chorus)" class="verse|$)/gi)]
  let verse = 0
  let chorus = 0
  const sections = stanzaMatches.map((match) => {
    const kind = match[1].toLowerCase()
    const plain = match[2].match(/<div class="(?:chorus )?text-container">([\s\S]*?)<\/div>/i)?.[1] || ''
    const plainLines = decode(plain).split('\n').filter(Boolean)
    const chords = chordLines(match[2])
    // The source lyric container is authoritative for stanza layout. Use chord
    // markup only when it maps one-to-one, otherwise preserve the lyric lines.
    const lines = chords.length === plainLines.length ? chords : plainLines
    const label = kind === 'chorus' ? `Chorus${++chorus > 1 ? ` ${chorus}` : ''}` : `Verse ${++verse}`
    return { label, lines }
  }).filter((section) => section.lines.length)

  const prefix = catalogMatch[1].toUpperCase()
  const number = catalogMatch[2]
  const sourceUrl = `https://www.hymnal.net/en/hymn/${prefix.toLowerCase()}/${number}/`
  const relatedBlock = html.match(/<div class="row common-panel hymn-related-songs">([\s\S]*?)<div class="row sidebar-title">/i)?.[1] || ''
  const relatedCatalogs = [...relatedBlock.matchAll(/href="(?:\.\.\/([a-z]+)\/)?(\d+)\.html"/gi)]
    .map((match) => `${(match[1] || prefix).toUpperCase()}${match[2]}`)

  const key = detail(html, 'Key') || first(html, /<span id="keysig">([\s\S]*?)<\/span>/i) || 'C Major'
  return {
    id: `hymnal-net-${prefix.toLowerCase()}-${number}`,
    title, catalogPrefix: prefix, hymnNumber: number,
    author: detail(html, 'Lyrics') || 'Unknown', lyricist: detail(html, 'Lyrics') || undefined,
    composer: detail(html, 'Music') || undefined, language: 'en', year: 0,
    themes: [detail(html, 'Category'), detail(html, 'Subcategory')].filter(Boolean),
    category: detail(html, 'Category') || undefined,
    subcategory: detail(html, 'Subcategory') || undefined,
    scriptures: detail(html, 'Scriptures') ? detail(html, 'Scriptures').split(/\s*;\s*/) : [],
    originalKey: key.replace(/\s+(Major|Minor)$/i, ''), tempo: 96,
    timeSignature: detail(html, 'Time') || '4/4', hymnCode: detail(html, 'Hymn Code') || undefined,
    rightsStatus: 'local-library',
    audioUrl: hrefByText(html, 'mp3'), singingAudioUrl: hrefByText(html, 'Singing'),
    fullAudioUrl: html.match(/<source src="([^"]+_full\.mp3)"/i)?.[1],
    pianoSheetUrl: hrefByText(html, 'Piano'), guitarSheetUrl: hrefByText(html, 'Guitar'),
    textSheetUrl: hrefByText(html, 'Text'), midiUrl: hrefByText(html, 'MIDI \\(song\\)'),
    tuneMidiUrl: hrefByText(html, 'MIDI \\(tune\\)'), sourceUrl, sourcePath,
    relatedCatalogs: [...new Set(relatedCatalogs)], sections,
  }
}

export async function importHymnalMirror(root, outputFile, collections = []) {
  const hymnRoot = resolve(root, 'en', 'hymn')
  const available = (await readdir(hymnRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory())
  const allowed = new Set(collections.map((value) => value.toLowerCase()))
  const folders = available.filter((entry) => !allowed.size || allowed.has(entry.name.toLowerCase()))
  const hymns = []
  const failures = []
  const duplicates = []
  const hymnIds = new Set()
  for (const folder of folders) {
    const path = join(hymnRoot, folder.name)
    const files = (await readdir(path)).filter((name) => /^\d+\.html$/i.test(name))
    for (const name of files) {
      const file = join(path, name)
      try {
        const hymn = parseHymnalPage(await readFile(file, 'utf8'), relative(root, file))
        if (hymnIds.has(hymn.id)) duplicates.push({ id: hymn.id, file: relative(root, file) })
        else { hymnIds.add(hymn.id); hymns.push(hymn) }
      }
      catch (error) { failures.push({ file: relative(root, file), detail: error instanceof Error ? error.message : String(error) }) }
    }
  }
  hymns.sort((a, b) => a.catalogPrefix.localeCompare(b.catalogPrefix) || Number(a.hymnNumber) - Number(b.hymnNumber))
  await mkdir(dirname(outputFile), { recursive: true })
  await writeFile(outputFile, JSON.stringify({ version: 1, importedAt: new Date().toISOString(), root, hymns, failures, duplicates }))
  return { imported: hymns.length, failed: failures.length, duplicates: duplicates.length, outputFile: resolve(outputFile) }
}

if (process.argv[1] && basename(process.argv[1]) === 'hymnal-import.mjs') {
  const [root, output = join(process.cwd(), 'data', 'hymnal-library.json'), collectionList = 'h,ns,nt,c,lb'] = process.argv.slice(2)
  if (!root) throw new Error('Usage: node server/hymnal-import.mjs <mirror-root> [output-file] [collections]')
  console.log(await importHymnalMirror(root, output, collectionList.split(',').filter(Boolean)))
}
