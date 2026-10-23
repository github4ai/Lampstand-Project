export const CHROMATIC_KEYS = [
  'C', 'C#', 'D', 'D#', 'E', 'F',
  'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const

const CHORD_ROOT = '[A-G](?:#|b)?(?:maj7|maj|min|m|sus[24]?|dim|aug|add\\d+|\\d+|[+°ø])*(?:\\/[A-G](?:#|b)?)?'

const PARENTHETICAL_CHORD = new RegExp(`\\((${CHORD_ROOT})\\)`, 'g')

const CHORD_TOKEN = new RegExp(`\\[([^\\]]+)\\]|\\((${CHORD_ROOT})\\)`, 'g')

const FLATS: Record<string, string> = {
  Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#',
}

function noteIndex(note: string): number {
  return CHROMATIC_KEYS.indexOf((FLATS[note] ?? note) as typeof CHROMATIC_KEYS[number])
}

function transposeNote(note: string, semitones: number): string {
  const index = noteIndex(note)
  if (index < 0) return note
  return CHROMATIC_KEYS[(index + semitones + 120) % 12]
}

export function semitonesBetween(from: string, to: string): number {
  const start = noteIndex(from)
  const end = noteIndex(to)
  return start < 0 || end < 0 ? 0 : (end - start + 12) % 12
}

export function transposeChord(chord: string, semitones: number): string {
  const match = chord.match(/^([A-G](?:#|b)?)(.*)$/)
  if (!match) return chord
  const [, root, suffix] = match
  return transposeNote(root, semitones) +
    suffix.replace(/\/([A-G](?:#|b)?)/g, (_, note: string) => '/' + transposeNote(note, semitones))
}

export function transposeChordLine(line: string, semitones: number): string {
  return line
    .replace(/\[([^\]]+)\]/g, (_, chord: string) => '[' + transposeChord(chord, semitones) + ']')
    .replace(PARENTHETICAL_CHORD, (_, chord: string) => '(' + transposeChord(chord, semitones) + ')')
}

export function stripChords(line: string): string {
  // Some imported hymn files use (C) rather than [C]. Only remove a
  // parenthetical marker when it begins with a valid chord root, so normal
  // lyric asides such as "(repeat)" remain visible.
  return line.replace(/\[[^\]]+\]/g, '').replace(PARENTHETICAL_CHORD, '')
}

export type ChordLineToken = { type: 'chord'; value: string } | { type: 'lyric'; value: string }

export function splitChordTokens(line: string): ChordLineToken[] {
  const tokens: ChordLineToken[] = []
  let cursor = 0
  for (const match of line.matchAll(CHORD_TOKEN)) {
    const index = match.index ?? 0
    if (index > cursor) tokens.push({ type: 'lyric', value: line.slice(cursor, index) })
    tokens.push({ type: 'chord', value: match[1] ?? match[2] })
    cursor = index + match[0].length
  }
  if (cursor < line.length) tokens.push({ type: 'lyric', value: line.slice(cursor) })
  return tokens
}

export function extractChords(lines: string[], semitones: number): string[] {
  const chords = lines
    .flatMap((line) => transposeChordLine(line, semitones))
    .flatMap((line) => splitChordTokens(line))
    .filter((token) => token.type === 'chord')
    .map((token) => token.value)
  return [...new Set(chords)]
}
