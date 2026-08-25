export interface LinkedBibleReference {
  label: string
  bookSlug: string
  chapter: number
  verse: number
  verseEnd: number
}

export type BibleTextSegment = { type: 'text'; text: string } | ({ type: 'reference' } & LinkedBibleReference)

const BOOKS: Array<[string, string]> = [
  ['Genesis|Gen\\.?', 'genesis'], ['Exodus|Exo?d?\\.?', 'exodus'], ['Leviticus|Lev\\.?', 'leviticus'],
  ['Numbers|Num\\.?', 'numbers'], ['Deuteronomy|Deut\\.?', 'deuteronomy'], ['Joshua|Josh\\.?', 'joshua'],
  ['Judges|Judg\\.?', 'judges'], ['Ruth', 'ruth'], ['1\\s*Samuel|1\\s*Sam\\.?', '1-samuel'], ['2\\s*Samuel|2\\s*Sam\\.?', '2-samuel'],
  ['1\\s*Kings|1\\s*Kgs?\\.?', '1-kings'], ['2\\s*Kings|2\\s*Kgs?\\.?', '2-kings'], ['1\\s*Chronicles|1\\s*Chron\\.?', '1-chronicles'],
  ['2\\s*Chronicles|2\\s*Chron\\.?', '2-chronicles'], ['Ezra', 'ezra'], ['Nehemiah|Neh\\.?', 'nehemiah'],
  ['Esther|Esth\\.?', 'esther'], ['Job', 'job'], ['Psalms?|Psa?\\.?', 'psalms'], ['Proverbs|Prov\\.?', 'proverbs'],
  ['Ecclesiastes|Eccl\\.?', 'ecclesiastes'], ['Song of Songs|Song\\.?', 'song-of-songs'], ['Isaiah|Isa\\.?', 'isaiah'],
  ['Jeremiah|Jer\\.?', 'jeremiah'], ['Lamentations|Lam\\.?', 'lamentations'], ['Ezekiel|Ezek\\.?', 'ezekiel'],
  ['Daniel|Dan\\.?', 'daniel'], ['Hosea|Hos\\.?', 'hosea'], ['Joel', 'joel'], ['Amos', 'amos'], ['Obadiah|Obad\\.?', 'obadiah'],
  ['Jonah', 'jonah'], ['Micah|Mic\\.?', 'micah'], ['Nahum|Nah\\.?', 'nahum'], ['Habakkuk|Hab\\.?', 'habakkuk'],
  ['Zephaniah|Zeph\\.?', 'zephaniah'], ['Haggai|Hag\\.?', 'haggai'], ['Zechariah|Zech\\.?', 'zechariah'], ['Malachi|Mal\\.?', 'malachi'],
  ['Matthew|Matt\\.?', 'matthew'], ['Mark', 'mark'], ['Luke', 'luke'], ['John', 'john'], ['Acts', 'acts'],
  ['Romans|Rom\\.?', 'romans'], ['1\\s*Corinthians|1\\s*Cor\\.?', '1-corinthians'], ['2\\s*Corinthians|2\\s*Cor\\.?', '2-corinthians'],
  ['Galatians|Gal\\.?', 'galatians'], ['Ephesians|Eph\\.?', 'ephesians'], ['Philippians|Phil\\.?', 'philippians'],
  ['Colossians|Col\\.?', 'colossians'], ['1\\s*Thessalonians|1\\s*Thes?s?\\.?', '1-thessalonians'], ['2\\s*Thessalonians|2\\s*Thes?s?\\.?', '2-thessalonians'],
  ['1\\s*Timothy|1\\s*Tim\\.?', '1-timothy'], ['2\\s*Timothy|2\\s*Tim\\.?', '2-timothy'], ['Titus', 'titus'],
  ['Philemon|Philem\\.?', 'philemon'], ['Hebrews|Heb\\.?', 'hebrews'], ['James|Jas\\.?', 'james'],
  ['1\\s*Peter|1\\s*Pet\\.?', '1-peter'], ['2\\s*Peter|2\\s*Pet\\.?', '2-peter'], ['1\\s*John', '1-john'], ['2\\s*John', '2-john'], ['3\\s*John', '3-john'],
  ['Jude', 'jude'], ['Revelation|Rev\\.?', 'revelation'],
]

const SHORT_BOOK_NAMES: Record<string, string> = {
  Genesis: 'Gen.', Exodus: 'Exo.', Leviticus: 'Lev.', Numbers: 'Num.', Deuteronomy: 'Deut.', Joshua: 'Josh.', Judges: 'Judg.', Ruth: 'Ruth',
  '1 Samuel': '1 Sam.', '2 Samuel': '2 Sam.', '1 Kings': '1 Kings', '2 Kings': '2 Kings', '1 Chronicles': '1 Chron.', '2 Chronicles': '2 Chron.',
  Ezra: 'Ezra', Nehemiah: 'Neh.', Esther: 'Esth.', Job: 'Job', Psalms: 'Psa.', Proverbs: 'Prov.', Ecclesiastes: 'Eccl.', 'Song of Songs': 'S.S.',
  Isaiah: 'Isa.', Jeremiah: 'Jer.', Lamentations: 'Lam.', Ezekiel: 'Ezek.', Daniel: 'Dan.', Hosea: 'Hos.', Joel: 'Joel', Amos: 'Amos', Obadiah: 'Obad.',
  Jonah: 'Jonah', Micah: 'Mic.', Nahum: 'Nah.', Habakkuk: 'Hab.', Zephaniah: 'Zeph.', Haggai: 'Hag.', Zechariah: 'Zech.', Malachi: 'Mal.',
  Matthew: 'Matt.', Mark: 'Mark', Luke: 'Luke', John: 'John', Acts: 'Acts', Romans: 'Rom.', '1 Corinthians': '1 Cor.', '2 Corinthians': '2 Cor.',
  Galatians: 'Gal.', Ephesians: 'Eph.', Philippians: 'Phil.', Colossians: 'Col.', '1 Thessalonians': '1 Thes.', '2 Thessalonians': '2 Thes.',
  '1 Timothy': '1 Tim.', '2 Timothy': '2 Tim.', Titus: 'Titus', Philemon: 'Philem.', Hebrews: 'Heb.', James: 'James', '1 Peter': '1 Pet.',
  '2 Peter': '2 Pet.', '1 John': '1 John', '2 John': '2 John', '3 John': '3 John', Jude: 'Jude', Revelation: 'Rev.',
}

export function shortBibleBookName(name: string) {
  return SHORT_BOOK_NAMES[name] ?? name
}

const BOOK_PATTERN = BOOKS.map(([pattern]) => `(?:${pattern})`).join('|')
const VERSE_ITEM = `\\d+(?:\\s*[-–—]\\s*\\d+)?`
const VERSE_LIST = `${VERSE_ITEM}(?:\\s*,\\s*${VERSE_ITEM})*`
const REFERENCE_PATTERN = new RegExp(`\\b(?:(${BOOK_PATTERN})\\s+)?(\\d+)\\s*:\\s*(${VERSE_LIST}(?:\\s*;\\s*\\d+\\s*:\\s*${VERSE_LIST})*)`, 'gi')

function slugFor(label: string) {
  return BOOKS.find(([pattern]) => new RegExp(`^(?:${pattern})$`, 'i').test(label.trim()))?.[1] ?? ''
}

export function lastMentionedBibleBook(text: string, fallback = '') {
  let last = { index: -1, slug: '' }
  for (const [pattern, slug] of BOOKS) {
    for (const match of text.matchAll(new RegExp(`\\b(?:${pattern})\\b`, 'gi'))) {
      if ((match.index ?? -1) > last.index) last = { index: match.index ?? -1, slug }
    }
  }
  return last.slug || fallback
}

export function linkBibleReferences(text: string, defaultBookSlug = ''): BibleTextSegment[] {
  const segments: BibleTextSegment[] = []
  let position = 0
  let currentBookSlug = defaultBookSlug
  for (const match of text.matchAll(REFERENCE_PATTERN)) {
    const index = match.index ?? 0
    const explicitSlug = match[1] ? slugFor(match[1]) : ''
    if (explicitSlug) currentBookSlug = explicitSlug
    if (!currentBookSlug) currentBookSlug = lastMentionedBibleBook(text.slice(0, index))
    if (!currentBookSlug) continue
    if (index > position) segments.push({ type: 'text', text: text.slice(position, index) })
    let chapter = Number(match[2])
    let first = true
    const itemPattern = /(^|\s*[,;]\s*)(?:(\d+)\s*:\s*)?(\d+)(?:\s*[-–—]\s*(\d+))?/g
    for (const item of match[3].matchAll(itemPattern)) {
      if (item[1]) segments.push({ type: 'text', text: item[1] })
      if (item[2]) chapter = Number(item[2])
      const verse = Number(item[3]); const verseEnd = Number(item[4] || verse)
      const bookLabel = first && match[1] ? `${match[1]} ` : ''
      const chapterLabel = first || item[2] ? `${chapter}:` : ''
      segments.push({ type: 'reference', label: `${bookLabel}${chapterLabel}${item[3]}${item[4] ? `-${item[4]}` : ''}`, bookSlug: currentBookSlug, chapter, verse, verseEnd })
      first = false
    }
    position = index + match[0].length
  }
  if (position < text.length) segments.push({ type: 'text', text: text.slice(position) })
  return segments.length ? segments : [{ type: 'text', text }]
}
