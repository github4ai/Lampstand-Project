import { linkBibleReferences, lastMentionedBibleBook } from './bibleReferences'
import { linkedParagraphsHtml, verseLinkHtml } from './bibleLinks'
import { repairHwmrReadingText } from './hwmrText'

export type HwmrSlideDay = { morningVerses: Array<{ reference: string; text: string }>; morningNourishment: string; todaysReading: string }
export type HwmrSlideHymn = { number?: string; text: string }

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!))

// The reader prints the reference on its own line above the verse; the slide mirrors that order
// and the same classes, so the projected page and the reading page are one design, not two.
function morningVerseHtml(verse: { reference: string; text: string }) {
  const reference = linkBibleReferences(verse.reference)
    .map((segment) => (segment.type === 'text' ? escapeHtml(segment.text) : verseLinkHtml(segment)))
    .join('')
  return `<div class="verse-block"><strong class="verse-reference">${reference}</strong><p class="verse-text">${escapeHtml(verse.text).replace(/\n/g, '<br>')}</p></div>`
}

const rules = `.hwmr-slide section{margin:0 0 1.1em}.hwmr-slide h3{margin:0 0 .8em;color:#245fc7;font:italic 400 1.17em/1.3 Georgia,'Times New Roman',serif;text-align:center}.hwmr-slide .hwmr-nourishment{padding:1.2em 1.4em;border-radius:.35em;background:#19191914}.hwmr-slide .hwmr-morning-verses{margin:0 0 1em;padding-bottom:1em;border-bottom:.06em solid #1919192e}.hwmr-slide .hwmr-morning-verses .verse-block{margin:0 0 1em}.hwmr-slide .hwmr-morning-verses .verse-block:last-child{margin-bottom:0}.hwmr-slide .verse-reference{display:block;margin:0 0 .4em;color:#174f9e;font:800 .94em/1.35 Inter,'Segoe UI',sans-serif}.hwmr-slide .verse-text{margin:0;font-weight:800;line-height:1.48;letter-spacing:.005em;text-align:left}.hwmr-slide .hwmr-formatted-text p{margin:0 0 1.1em;line-height:1.55;text-align:justify;text-indent:1.4em}.hwmr-slide .hwmr-formatted-text p:last-child{margin-bottom:0}.hwmr-slide .hwmr-outline-content h3{margin:.8em 0 .3em;padding:.14em .65em;border:.06em solid #b9c2cc;border-radius:.25em;background:#19191914;color:#245fc7;font:italic 400 1em/1.35 Georgia,'Times New Roman',serif;text-align:center}.hwmr-slide .hwmr-outline-content p{margin:.2em 0;line-height:1.5;text-align:left}.hwmr-slide .hwmr-outline-content p.major{padding-left:1.4em;text-indent:-1.4em;font-weight:700}.hwmr-slide .hwmr-outline-content p.level-a{padding-left:3.3em;text-indent:-1.45em}.hwmr-slide .hwmr-outline-content p.level-1{padding-left:5.1em;text-indent:-1.45em}.hwmr-slide .hwmr-outline-content p.level-a-lower{padding-left:6.8em;text-indent:-1.45em}.hwmr-slide .hwmr-hymn{max-width:30em;margin:0 auto}.hwmr-slide .hymn-heading{margin:0 0 1em;color:#245fc7;font-size:1.17em;text-align:center}.hwmr-slide .hwmr-hymn-stanza{display:grid;grid-template-columns:1.7em minmax(0,1fr);gap:.5em;margin:0 0 1.1em;align-items:start}.hwmr-slide .hwmr-hymn-stanza>span{padding-top:.05em;color:#4a5a6a;font-weight:700;text-align:right}.hwmr-slide .hwmr-hymn-stanza p{margin:0;white-space:pre-line;line-height:1.45;text-align:left}.hwmr-slide .verse-link{color:#165fbe;text-decoration:none;border-bottom:.06em dotted currentColor;cursor:pointer}.hwmr-slide .verse-link:hover{color:#073d85;border-bottom-style:solid}.audience-dark .hwmr-slide h3,.audience-dark .hwmr-slide .verse-reference,.audience-dark .hwmr-slide .hymn-heading,.audience-dark .hwmr-slide .hwmr-outline-content h3{color:#83dcfa}.audience-dark .hwmr-slide .hwmr-nourishment,.audience-dark .hwmr-slide .hwmr-outline-content h3{border-color:#3a516c;background:#ffffff0f}.audience-dark .hwmr-slide .hwmr-morning-verses{border-bottom-color:#ffffff2b}.audience-dark .hwmr-slide .hwmr-hymn-stanza>span{color:#9fb6cc}.audience-dark .hwmr-slide .verse-link{color:#83dcfa}.audience-dark .hwmr-slide .verse-link:hover{color:#d9f3ff}`

const versesHtml = (verses: HwmrSlideDay['morningVerses']) => verses.map(morningVerseHtml).join('')

export function hwmrDaySlideHtml(day: HwmrSlideDay) {
  const commentary = linkedParagraphsHtml(repairHwmrReadingText(day.morningNourishment))
  const reading = linkedParagraphsHtml(repairHwmrReadingText(day.todaysReading))
  return `<style>${rules}</style><div class="hwmr-slide">`
    + `<section class="hwmr-nourishment"><h3>Morning Nourishment</h3><div class="hwmr-morning-verses">${versesHtml(day.morningVerses ?? [])}</div><div class="hwmr-formatted-text morning-commentary">${commentary}</div></section>`
    + `<section class="hwmr-todays-reading"><h3>Today’s Reading</h3><div class="hwmr-formatted-text">${reading}</div></section>`
    + `</div>`
}

/** The weekly outline is one line per entry, with the printed indentation the outline page uses. */
export function hwmrOutlineSlideHtml(outline: string) {
  let bookContext = ''
  const lines = String(outline || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const dayHeading = /^Day\s+\d+$/i.test(line)
    const level = /^[IVX]+\s*\./.test(line) ? 'major' : /^[A-Z]\s*\./.test(line) ? 'level-a' : /^\d+\s*\./.test(line) ? 'level-1' : /^[a-z]\s*\./.test(line) ? 'level-a-lower' : ''
    const html = linkBibleReferences(line, bookContext)
      .map((segment) => (segment.type === 'text' ? escapeHtml(segment.text) : verseLinkHtml(segment)))
      .join('')
    bookContext = lastMentionedBibleBook(line, bookContext)
    return dayHeading ? `<h3>${escapeHtml(line.trim())}</h3>` : `<p class="${level}">${html}</p>`
  }).join('')
  return `<style>${rules}</style><div class="hwmr-slide"><section class="hwmr-outline"><div class="hwmr-outline-content">${lines}</div></section></div>`
}

/** Stanza numbers keep their own column, the way the hymn page prints them. */
export function hwmrHymnSlideHtml(hymn: HwmrSlideHymn) {
  const stanzas = String(hymn.text || '').split(/\n{2,}/).filter(Boolean).map((stanza) => {
    const [first = '', ...rest] = stanza.split('\n')
    const [number, opening = ''] = first.split('\t')
    return `<div class="hwmr-hymn-stanza"><span>${escapeHtml(number)}</span><p>${escapeHtml([opening, ...rest].join('\n'))}</p></div>`
  }).join('')
  const heading = hymn.number ? `<h2 class="hymn-heading">Hymns, #${escapeHtml(String(hymn.number))}</h2>` : ''
  return `<style>${rules}</style><div class="hwmr-slide"><section class="hwmr-hymn">${heading}<div class="hwmr-hymn-stanzas">${stanzas}</div></section></div>`
}
