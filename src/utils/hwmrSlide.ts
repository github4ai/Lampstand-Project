import { linkBibleReferences, lastMentionedBibleBook } from './bibleReferences'
import { linkedParagraphsHtml, verseLinkHtml } from './bibleLinks'
import { repairHwmrReadingText } from './hwmrText'

export type HwmrSlideDay = { morningVerses: Array<{ reference: string; text: string }>; morningNourishment: string; todaysReading: string }

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!))

// A printed verse line is "Gen. 1:1" followed by the verse itself, so the reference keeps its own
// line and the text sits under it in the reader's bold serif, exactly as the reading page does.
function morningVerseHtml(verse: { reference: string; text: string }) {
  const reference = linkBibleReferences(verse.reference)
    .map((segment) => (segment.type === 'text' ? escapeHtml(segment.text) : verseLinkHtml(segment)))
    .join('')
  return `<p class="verse-reference">${reference}</p><p class="verse-text">${escapeHtml(verse.text).replace(/\n/g, '<br>')}</p>`
}

const rules = `.hwmr-slide section{margin:0 0 1.1em}.hwmr-slide .slide-label{margin:0 0 .7em;padding-bottom:.25em;border-bottom:.08em solid #245fc7;color:#174f9e;font:italic 400 .74em/1.3 Georgia,'Times New Roman',serif;text-align:center}.hwmr-slide .verse-reference{margin:.75em 0 .1em;color:#174f9e;font:800 .62em/1.35 Inter,'Segoe UI',sans-serif}.hwmr-slide .verse-text{margin:0 0 .7em;padding-bottom:.7em;border-bottom:.06em solid #245fc722;font-weight:700;line-height:1.48}.hwmr-slide .verse-block:last-child .verse-text{border-bottom:0}.hwmr-slide .hwmr-commentary p{margin:0 0 .7em;font-size:.86em;line-height:1.55;text-align:justify;text-indent:1.2em}.hwmr-slide .verse-link{color:#165fbe;text-decoration:none;border-bottom:.06em solid currentColor;cursor:pointer}.hwmr-slide .verse-link:hover{color:#073d85;border-bottom-style:solid}.audience-dark .hwmr-slide .slide-label{color:#83dcfa;border-bottom-color:#83dcfa}.audience-dark .hwmr-slide .verse-reference{color:#83dcfa}.audience-dark .hwmr-slide .verse-text{border-bottom-color:#83dcfa33}.audience-dark .hwmr-slide .verse-link{color:#83dcfa}.audience-dark .hwmr-slide .verse-link:hover{color:#d9f3ff}`

export function hwmrDaySlideHtml(day: HwmrSlideDay) {
  const verses = (day.morningVerses ?? []).map((verse) => `<div class="verse-block">${morningVerseHtml(verse)}</div>`).join('')
  const commentary = linkedParagraphsHtml(repairHwmrReadingText(day.morningNourishment))
  const reading = linkedParagraphsHtml(repairHwmrReadingText(day.todaysReading))
  return `<style>${rules}</style><div class="hwmr-slide">`
    + `<section><h3 class="slide-label">Morning Nourishment</h3><div class="verse-blocks">${verses}</div><div class="hwmr-commentary">${commentary}</div></section>`
    + `<section><h3 class="slide-label">Today’s Reading</h3><div class="hwmr-commentary">${reading}</div></section>`
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
    return dayHeading ? `<h4 class="outline-day">${escapeHtml(line.trim())}</h4>` : `<p class="${level}">${html}</p>`
  }).join('')
  return `<style>${rules}.hwmr-slide .outline-day{margin:.8em 0 .3em;color:#174f9e;font:italic 400 .78em/1.3 Georgia,'Times New Roman',serif}.hwmr-slide p.major,.hwmr-slide p.level-a,.hwmr-slide p.level-1,.hwmr-slide p.level-a-lower{margin:.2em 0;font-size:.88em}.hwmr-slide p.major{font-weight:700;text-indent:-1.2em;padding-left:1.2em}.hwmr-slide p.level-a{text-indent:-1.2em;padding-left:2.6em}.hwmr-slide p.level-1{text-indent:-1.2em;padding-left:4.4em}.hwmr-slide p.level-a-lower{text-indent:-1.2em;padding-left:6em}</style><div class="hwmr-slide"><section>${lines}</section></div>`
}
