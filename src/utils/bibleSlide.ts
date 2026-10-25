export type BibleSlideFootnotes = 'hidden' | 'shown'
export type BibleSlideVerse = { reference: string; text: string; footnotes: string[] }

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character] ?? character))

// A footnote reaches us as the printed line, "[1a] born — Or, born from above."; the marker
// and the word it explains read as a label, and everything after the dash is the note.
const FOOTNOTE_RE = /^\[([^\]]+)\]\s+([^—]+?)\s+—\s+(.+)$/s

function footnoteHtml(line: string): string {
  const footnote = FOOTNOTE_RE.exec(line.trim())
  if (!footnote) return `<p class="footnote">${escapeHtml(line.trim())}</p>`
  return `<p class="footnote"><span class="footnote-tag">${escapeHtml(`${footnote[1]} ${footnote[2]} —`)}</span>${escapeHtml(footnote[3].trim())}</p>`
}

// The note sits at the foot of its own verse, kept visibly secondary to the text read out.
const rules = `.bible-slide p{margin:0 0 .6em}.bible-slide .footnote{margin:0 0 .55em;padding-left:.8em;border-left:.16em solid #9dd7ee;font:italic .68em/1.45 Georgia,'Times New Roman',serif;opacity:.92}.bible-slide .footnote-tag{font-weight:700;font-style:normal;color:#0c5474;margin-right:.35em}.audience-dark .bible-slide .footnote{border-left-color:#1d5f7c;opacity:.85}.audience-dark .bible-slide .footnote-tag{color:#83dcfa}`

export function bibleSlideHtml(verses: BibleSlideVerse[], footnotes: BibleSlideFootnotes = 'hidden'): string {
  const body = verses.map((verse) => {
    const text = `<p><strong>${escapeHtml(verse.reference)}</strong> ${escapeHtml(verse.text)}</p>`
    const notes = footnotes === 'shown' ? verse.footnotes.map((line) => footnoteHtml(line)).join('') : ''
    return `<section>${text}${notes}</section>`
  }).join('')
  return `<style>${rules}</style><div class="bible-slide">${body}</div>`
}
