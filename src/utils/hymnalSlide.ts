import { splitChordTokens, stripChords, transposeChord, transposeChordLine } from './chords'

export type HymnalSlideMode = 'text' | 'chords'
export type HymnalColumns = 1 | 2 | 3
export type HymnalChorus = 'once' | 'each'

export type HymnSection = { label: string; lines: string[] }
export type HymnalSlideLayout = { fontSize: number; lineHeight: number; columnGap: number; fits: boolean }
export type HymnalSlideOptions = { mode?: HymnalSlideMode; columns?: HymnalColumns; chorus?: HymnalChorus; semitones?: number }

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character] ?? character))

const CHORUS_LABEL = /^(?:chorus|refrain|cro)(?:\s*\d+)?$/i
const NUMBERED_SECTION = /^(?:verse|stanza|strophe)\s*(\d+[a-z]?)$/i
const TEXTURE = /^\s+$/

// The audience slide is a 16:9 box whose base font is sized in vw, so every
// budget below is measured in em of that font and holds on any projector.
const SLIDE_WIDTH_EM = 49 // between the left and right slide padding
const SLIDE_HEIGHT_EM = 21 // below the title bar, kept short of the box so a hymn never spills
const CHARS_PER_EM = 2.1 // measured Georgia lyric text
const CHORD_LINE_EXTRA = .15 // a raised chord also needs air inside the line
const CHORD_ROW_EM = .62 // the row each lyric line reserves for its chords
const SECTION_OVERHEAD = 1.9 // stanza label plus the gap under it
const MIN_FONT_SCALE = .55

// Projectors read "3" far faster than "Verse 3", and the chorus label stays.
export function hymnSectionLabel(label: string): string {
  return NUMBERED_SECTION.exec(label)?.[1] ?? label
}

// Printed hymnals repeat the refrain after every stanza, so the library stores
// one chorus per stanza. "Once" keeps a single copy, "each" reuses the first.
export function arrangeHymnChorus(sections: HymnSection[], chorus: HymnalChorus): HymnSection[] {
  const found = sections.filter((section) => CHORUS_LABEL.test(section.label))
  if (!found.length) return sections
  const refrain = found[0]
  const stanzas = sections.filter((section) => !CHORUS_LABEL.test(section.label))
  if (chorus === 'once') return sections.filter((section) => !CHORUS_LABEL.test(section.label) || section === refrain)
  return stanzas.length ? stanzas.flatMap((stanza) => [stanza, refrain]) : sections
}

const columnGapFor = (columns: HymnalColumns) => columns === 1 ? 0 : columns === 2 ? 2.4 : 1.8

// Sections cannot break across columns, so the tallest column decides the fit.
function tallestColumn(heights: number[], columns: number): number {
  if (columns === 1) return heights.reduce((total, height) => total + height, 0)
  const filled = Array.from({ length: columns }, () => 0)
  for (const height of heights) {
    const shortest = filled.reduce((best, value, index) => value < filled[best] ? index : best, 0)
    filled[shortest] += height
  }
  return Math.max(...filled)
}

// The tallest column of a hymn, counted as wrapped lyric lines plus labels.
function columnHeight(sections: HymnSection[], columns: HymnalColumns, charactersPerLine: number): number {
  const heights = sections.map((section) => section.lines.reduce((total, line) => total + Math.max(1, Math.ceil(stripChords(line).replace(/\s+/g, ' ').trim().length / charactersPerLine)), 0) + SECTION_OVERHEAD)
  return tallestColumn(heights, columns)
}

export function hymnLayoutFor(sections: HymnSection[], columns: HymnalColumns, mode: HymnalSlideMode = 'text'): HymnalSlideLayout {
  const columnGap = columnGapFor(columns)
  const charactersPerColumn = ((SLIDE_WIDTH_EM - (columns - 1) * columnGap) / columns) * CHARS_PER_EM
  const tallest = columnHeight(sections, columns, charactersPerColumn)
  const lineHeight = Number(((tallest <= 12 ? 1.35 : tallest <= 18 ? 1.25 : 1.12) + (mode === 'chords' ? CHORD_LINE_EXTRA : 0)).toFixed(2))
  const occupied = lineHeight + (mode === 'chords' ? CHORD_ROW_EM : 0)
  // A smaller face fits more characters per line, so the lyric re-wraps and the
  // hymn needs less room again. Re-solve at the proposed size until it settles.
  let fontSize = 1
  for (let pass = 0; pass < 4; pass += 1) {
    const needed = columnHeight(sections, columns, charactersPerColumn * fontSize)
    fontSize = Math.min(1, Math.max(MIN_FONT_SCALE, SLIDE_HEIGHT_EM / (needed * occupied)))
  }
  const fits = columnHeight(sections, columns, charactersPerColumn * fontSize) * occupied * fontSize <= SLIDE_HEIGHT_EM + .01
  return { fontSize: Number(fontSize.toFixed(2)), lineHeight, columnGap, fits }
}

// A chord hangs above the word it changes on. Positioning it clears the lyric
// line and keeps that word from wrapping in the middle.
const chordSlot = (word: string, chord?: string) => chord === undefined
  ? escapeHtml(word)
  : `<span class="hymn-chord-slot">${escapeHtml(word)}<span class="hymn-chord">${escapeHtml(chord)}</span></span>`

function chordedLineHtml(line: string): string {
  let html = ''
  const waiting: string[] = []
  for (const token of splitChordTokens(line)) {
    if (token.type === 'chord') { waiting.push(token.value); continue }
    for (const part of token.value.split(/(\s+)/)) {
      if (!part) continue
      if (TEXTURE.test(part)) html += escapeHtml(part)
      else html += chordSlot(part, waiting.shift())
    }
  }
  for (const chord of waiting) html += chordSlot('', chord)
  return html
}

const normalizeAccidentals = (value: string) => value.replace(/♯/g, '#').replace(/♭/g, 'b')
const transposeLine = (line: string, semitones: number) => transposeChordLine(normalizeAccidentals(line), semitones)

export function hymnLineToHtml(line: string, mode: HymnalSlideMode): string {
  return mode === 'text' ? `<p>${escapeHtml(stripChords(line))}</p>` : `<p>${chordedLineHtml(line)}</p>`
}

export function hymnKeyFrom(key: string, semitones: number): string {
  return transposeChord(normalizeAccidentals(key), semitones)
}

export function hymnSlideHtml(sections: HymnSection[], options: HymnalSlideOptions = {}): string {
  const { mode = 'text', columns = 1, chorus = 'once', semitones = 0 } = options
  const rendered = arrangeHymnChorus(sections, chorus)
    .map((section) => ({ ...section, lines: section.lines.map((line) => transposeLine(line, semitones)) }))
  const { fontSize, lineHeight, columnGap } = hymnLayoutFor(rendered, columns, mode)
  const body = rendered
    .map((section) => `<section><h3>${escapeHtml(hymnSectionLabel(section.label))}</h3>${section.lines.map((line) => hymnLineToHtml(line, mode)).join('')}</section>`)
    .join('')
  const rules = `.hymn-slide{padding-top:.5em}.hymn-slide p{margin:0;line-height:inherit}.hymn-slide.chord p{padding-top:${CHORD_ROW_EM}em}.hymn-slide>section{margin:0 0 .7em;break-inside:avoid;-webkit-column-break-inside:avoid}.hymn-slide h3{margin:0 0 .2em;font-size:.72em;letter-spacing:.06em;text-transform:uppercase;opacity:.7}.hymn-slide .hymn-chord-slot{position:relative;white-space:nowrap}.hymn-slide .hymn-chord{position:absolute;bottom:calc(100% - .1em);left:0;color:#e03131;font:700 .62em/1 Inter,Segoe UI,sans-serif;letter-spacing:.02em;white-space:nowrap}.audience-dark .hymn-slide .hymn-chord{color:#ff6b6b}`
  const gap = columns > 1 ? `column-gap:${columnGap}em;` : ''
  // A lone column reads better boxed in the middle than stretched edge to edge.
  const align = columns === 1 ? 'max-width:38em;margin:0 auto;text-align:left;' : 'max-width:none;text-align:left;'
  return `<style>${rules}</style><div class="hymn-slide${mode === 'chords' ? ' chord' : ''}" style="${align}column-count:${columns};${gap}font-size:${fontSize}em;line-height:${lineHeight}">${body}</div>`
}
