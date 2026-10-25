import type { BibleBook } from '../api/recoveryBible'

export function simpleBookSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function bookMatchesSlug(book: BibleBook, slug: string | null) {
  return Boolean(slug && (book.slug === slug || simpleBookSlug(book.name) === slug))
}

// The Recovery Version library numbers its books 1-66, so the testament is a position, not a label.
export function isNewTestamentBook(book: Pick<BibleBook, 'id'>) {
  return Number(book.id) > 39
}

export function findBookBySlug(books: BibleBook[], slug: string) {
  return books.find((book) => bookMatchesSlug(book, slug))
}
