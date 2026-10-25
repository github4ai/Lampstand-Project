import { lastMentionedBibleBook, linkBibleReferences, type LinkedBibleReference } from './bibleReferences'

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!))

export type AudienceVerseRequest = { book: string; chapter: number; verse: number; verseEnd: number; label: string }

// The audience window carries no Bible data of its own; a reference link travels to the app as
// these attributes, which is the whole contract between a projected slide and a verse request.
export function verseLinkHtml(reference: LinkedBibleReference) {
  return `<a class="verse-link" href="#" data-book="${escapeHtml(reference.bookSlug)}" data-chapter="${reference.chapter}" data-verse="${reference.verse}" data-verse-end="${reference.verseEnd}">${escapeHtml(reference.label)}</a>`
}

export function linkedTextHtml(text: string, bookContext = '') {
  return linkBibleReferences(text, bookContext)
    .map((segment) => (segment.type === 'text' ? escapeHtml(segment.text) : verseLinkHtml(segment)))
    .join('')
}

/** Prose keeps the last book it named, so a bare "8:11" in the next paragraph still resolves. */
export function linkedParagraphsHtml(value: string) {
  let bookContext = ''
  return String(value || '')
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const html = linkedTextHtml(part, bookContext).replace(/\n/g, '<br>')
      bookContext = lastMentionedBibleBook(part, bookContext)
      return `<p>${html}</p>`
    })
    .join('')
}

export function verseRequestFromLink(link: HTMLElement): AudienceVerseRequest | null {
  const book = link.dataset.book
  if (!book) return null
  const chapter = Number(link.dataset.chapter)
  const verse = Number(link.dataset.verse)
  if (!Number.isInteger(chapter) || !Number.isInteger(verse)) return null
  return { book, chapter, verse, verseEnd: Number(link.dataset.verseEnd) || verse, label: link.textContent?.trim() ?? '' }
}
