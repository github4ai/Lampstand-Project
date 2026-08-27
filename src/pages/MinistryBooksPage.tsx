import { BookCopy, ChevronLeft, ChevronRight, Copy, FolderOpen, Maximize2, Minimize2, Pause, Play, Search, Square } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getMinistryBookChapter, getMinistryBookChapters, getMinistryBooksLibrary, searchMinistryBooks, type MinistryBookChapter, type MinistryBookSearchResult, type MinistryBookSummary, type MinistryBooksLibrary, type MinistryChapterSummary } from '../api/ministryBooks'
import { linkBibleReferences } from '../utils/bibleReferences'
import { useReaderAnnotations } from '../hooks/useReaderAnnotations'
import '../styles/ministry-books.css'
import '../styles/reader-annotations.css'

function isAbort(reason: unknown) { return reason instanceof DOMException && reason.name === 'AbortError' }

function MinistryBooksPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const linkedLocation = new URLSearchParams(location.search)
  const [library, setLibrary] = useState<MinistryBooksLibrary | null>(null)
  const [selectedBook, setSelectedBook] = useState<MinistryBookSummary | null>(null)
  const [chapters, setChapters] = useState<MinistryChapterSummary[]>([])
  const [chapterNumber, setChapterNumber] = useState(0)
  const [chapter, setChapter] = useState<MinistryBookChapter | null>(null)
  const [selectedBlocks, setSelectedBlocks] = useState<number[]>([])
  const [query, setQuery] = useState('')
  const [alphabet, setAlphabet] = useState('ALL')
  const [writer, setWriter] = useState('ALL')
  const [searchResults, setSearchResults] = useState<MinistryBookSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const [fullPage, setFullPage] = useState(false)
  const annotations = useReaderAnnotations(`ministry-books:${selectedBook?.id || 'library'}:${chapterNumber}`)

  useEffect(() => { document.body.classList.toggle('reader-full-page-active', fullPage); return () => document.body.classList.remove('reader-full-page-active') }, [fullPage])

  useEffect(() => {
    const controller = new AbortController()
    getMinistryBooksLibrary(controller.signal).then((loaded) => {
      setLibrary(loaded)
      const linkedBook = loaded.books.find((book) => book.id === linkedLocation.get('book'))
      if (linkedBook) setSelectedBook(linkedBook)
    }).catch((reason: unknown) => { if (!isAbort(reason)) setError(reason instanceof Error ? reason.message : 'Unable to inspect the Ministry Books library.') })
    return () => controller.abort()
  }, [location.search])

  useEffect(() => {
    if (!selectedBook) return
    const controller = new AbortController()
    setError(''); setChapter(null); setSelectedBlocks([])
    getMinistryBookChapters(selectedBook.id, controller.signal).then(({ chapters: next }) => {
      setChapters(next)
      const linkedChapter = Number(new URLSearchParams(location.search).get('chapter'))
      setChapterNumber(next.some((chapter) => chapter.number === linkedChapter) ? linkedChapter : next[0]?.number ?? 0)
    }).catch((reason: unknown) => { if (!isAbort(reason)) setError(reason instanceof Error ? reason.message : 'Unable to load chapters.') })
    return () => controller.abort()
  }, [selectedBook, location.search])

  useEffect(() => {
    if (!selectedBook || !chapterNumber) return
    localStorage.setItem('aios-ministry-books-location', `${selectedBook.id}:${chapterNumber}`)
    const controller = new AbortController()
    setChapter(null); setSelectedBlocks([]); window.speechSynthesis.cancel(); setSpeaking(false)
    getMinistryBookChapter(selectedBook.id, chapterNumber, controller.signal).then(setChapter).catch((reason: unknown) => { if (!isAbort(reason)) setError(reason instanceof Error ? reason.message : 'Unable to load this chapter.') })
    return () => controller.abort()
  }, [selectedBook, chapterNumber])

  useEffect(() => {
    if (!chapter) return
    const block = Number(new URLSearchParams(location.search).get('block'))
    if (!block) return
    setSelectedBlocks([block])
    window.setTimeout(() => document.querySelector<HTMLElement>(`[data-ministry-book-block="${block}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150)
  }, [chapter, location.search])

  useEffect(() => {
    const normalized = query.trim()
    if (normalized.length < 3) { setSearchResults([]); setSearching(false); return }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setSearching(true)
      searchMinistryBooks(normalized, controller.signal).then(({ results }) => setSearchResults(results)).catch((reason: unknown) => { if (!isAbort(reason)) setError(reason instanceof Error ? reason.message : 'Unable to search Ministry Books.') }).finally(() => setSearching(false))
    }, 350)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query])

  const filteredBooks = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return (library?.books ?? []).filter((book) => {
      const first = book.title.trim().replace(/^(?:a|an|the)\s+/i, '').charAt(0).toUpperCase()
      const alphabetMatches = alphabet === 'ALL' || (alphabet === '#' ? !/[A-Z]/.test(first) : first === alphabet)
      const writerMatches = writer === 'ALL' || book.author === writer
      return alphabetMatches && writerMatches && (!normalized || book.title.toLowerCase().includes(normalized))
    }).sort((left, right) => left.title.localeCompare(right.title))
  }, [alphabet, library, query, writer])
  const writers = useMemo(() => [...new Set((library?.books ?? []).map((book) => book.author).filter(Boolean))].sort((left, right) => left.localeCompare(right)), [library])
  const selectedText = (chapter?.blocks ?? []).filter((block) => selectedBlocks.includes(block.id)).map((block) => block.text).join('\n\n')
  const chapterIndex = chapters.findIndex((item) => item.number === chapterNumber)
  const sectionName = (item: MinistryChapterSummary) => item.displayTitle || (item.title === 'Front Matter' || item.title === 'Content' ? 'Content' : item.title)
  const isContentSection = chapter ? sectionName(chapter.chapter) === 'Content' : false
  const chapterTitleBlock = chapter?.blocks.find((block) => block.type === 'heading' && !/^(contents?|chapter(?:\s+\w+)?|message(?:\s+\w+)?)$/i.test(block.text.trim()))
  const readerTitle = isContentSection ? 'Content' : chapterTitleBlock?.text || (chapter ? sectionName(chapter.chapter) : '')
  const readerEyebrow = chapter && !isContentSection && readerTitle !== sectionName(chapter.chapter) ? sectionName(chapter.chapter) : ''
  const visibleBlocks = (chapter?.blocks ?? []).filter((block) => {
    if (isContentSection && /^(contents?)$/i.test(block.text.trim())) return false
    if (chapterTitleBlock && block.id === chapterTitleBlock.id) return false
    return !(!isContentSection && block.type === 'heading' && block.text.trim().toLowerCase() === chapter?.chapter.title.trim().toLowerCase())
  })

  function toggleBlock(id: number) { setSelectedBlocks((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) }
  function readSelection() {
    if (speaking) { window.speechSynthesis.pause(); setSpeaking(false); return }
    if (window.speechSynthesis.paused) { window.speechSynthesis.resume(); setSpeaking(true); return }
    if (!selectedText) return
    const utterance = new SpeechSynthesisUtterance(selectedText); utterance.onend = () => setSpeaking(false); window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance); setSpeaking(true)
  }
  async function copySelection() { const text = selectedText || visibleBlocks.map((block) => block.text).join('\n\n'); if (text) await navigator.clipboard.writeText(text) }
  function openReading(book: MinistryBookSummary, chapter = book.firstChapter, block?: number) {
    const params = new URLSearchParams({ book: book.id, chapter: String(chapter) })
    if (block) params.set('block', String(block))
    navigate(`/ministry-books?${params}`)
  }
  function renderBlock(text: string, blockId: number) {
    const contentsMatch = chapter && sectionName(chapter.chapter) === 'Content' ? text.match(/^(\d+)\.\s+(.+)$/) : null
    if (contentsMatch) {
      const numberedSections = chapters.filter((item) => !/^(content|front matter|preface|foreword|introduction)$/i.test(item.title.trim()))
      const target = numberedSections[Number(contentsMatch[1]) - 1]
      if (target) return <button type="button" className="ministry-book-section-link" onClick={(event) => { event.stopPropagation(); openReading(selectedBook!, target.number) }}><strong>{contentsMatch[1]}.</strong> {contentsMatch[2]}</button>
    }
    return linkBibleReferences(text).map((segment, index) => segment.type === 'text' ? <span key={index}>{annotations.highlight(segment.text)}</span> : <button type="button" className="ministry-book-bible-link" key={index} onClick={(event) => {
      event.stopPropagation()
      const returnParams = new URLSearchParams({ book: selectedBook?.id || '', chapter: String(chapterNumber), block: String(blockId) })
      navigate(`/recovery-bible?book=${encodeURIComponent(segment.bookSlug)}&chapter=${segment.chapter}&verse=${segment.verse}&verseEnd=${segment.verseEnd}&from=ministry-books&return=${encodeURIComponent(returnParams.toString())}`)
    }}>{segment.label}</button>)
  }

  return <section className={`ministry-books-page${fullPage ? ' reader-full-page' : ''}`}>
    <header className="ministry-books-header"><span><BookCopy size={25} /></span><div><h1>Ministry Books</h1><p>Read locally stored ministry books by Watchman Nee and Witness Lee.</p></div></header>
    {error ? <div className="ministry-books-error">{error}</div> : null}
    {!library && !error ? <div className="ministry-books-loading">Inspecting the local library…</div> : null}
    {library && !library.ready ? <section className="ministry-books-empty"><span><FolderOpen size={34} /></span><h2>Ministry Books HTML is not available yet</h2><p>{library.message}</p><div><strong>Library folder</strong><code>{library.folder}</code></div></section> : null}
    {library?.ready && !selectedBook ? <>
      <div className="ministry-books-summary"><strong>{library.books.length}</strong> ministry books · <strong>{library.files}</strong> reading sections{library.missingTitles ? <> · <span>{library.missingTitles} source-index titles reported as unavailable</span></> : null}</div>
      <section className="ministry-books-discovery" aria-label="Find Ministry Books">
        <label className="ministry-books-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by book title or words in a book" /></label>
        <label>Writer<select value={writer} onChange={(event) => setWriter(event.target.value)}><option value="ALL">All writers</option>{writers.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        <div className="ministry-books-alphabet" aria-label="Browse titles by alphabet">{['ALL', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'].map((letter) => <button type="button" className={alphabet === letter ? 'active' : ''} key={letter} onClick={() => setAlphabet(letter)}>{letter === 'ALL' ? 'All' : letter}</button>)}</div>
      </section>
      {query.trim().length >= 3 && <section className="ministry-books-text-results"><header><strong>Full-text results</strong><span>{searching ? 'Searching…' : `${searchResults.length} shown`}</span></header>{!searching && !searchResults.length ? <p>No matching passages found.</p> : searchResults.map((result) => <button type="button" key={`${result.book.id}-${result.chapter.number}-${result.block}`} onClick={() => openReading(result.book, result.chapter.number, result.block)}><strong>{result.book.title}</strong><span>{sectionName(result.chapter)}</span><p>{result.excerpt}</p></button>)}</section>}
      <div className="ministry-books-list">{filteredBooks.map((book) => <button type="button" key={book.id} onClick={() => openReading(book)}><div><h2>{book.title}</h2><p>{book.author || 'Author not identified'}</p></div><span>{book.chapters} sections</span></button>)}</div>{!filteredBooks.length ? <p className="ministry-books-no-results">No book titles match these filters.</p> : null}
    </> : null}
    {selectedBook ? <div onMouseUp={annotations.captureSelection}>
      {linkedLocation.get('from') === 'hwmr' && linkedLocation.get('return') ? <button className="ministry-book-return-link" type="button" onClick={() => navigate(`/ministry/hwmr?${linkedLocation.get('return')}`)}><ChevronLeft size={17} /> Back to the HWMR portion</button> : null}
      <div className="ministry-book-toolbar"><button type="button" onClick={() => navigate('/ministry-books')}><ChevronLeft size={17} /> Library</button><label>Section<select value={chapterNumber} onChange={(event) => openReading(selectedBook, Number(event.target.value))}>{chapters.map((item) => <option key={item.number} value={item.number}>{sectionName(item)}</option>)}</select></label><div><button type="button" onClick={() => setFullPage((value) => !value)}>{fullPage ? <Minimize2 size={16} /> : <Maximize2 size={16} />}{fullPage ? 'Exit' : 'Full page'}</button><button type="button" disabled={!selectedText} onClick={readSelection}>{speaking ? <Pause size={16} /> : <Play size={16} />} Read</button><button type="button" disabled={!selectedText} onClick={() => { window.speechSynthesis.cancel(); setSpeaking(false) }}><Square size={14} /> Stop</button><button type="button" disabled={!selectedText} onClick={copySelection}><Copy size={16} /> Copy</button></div></div>
      {!chapter ? <div className="ministry-books-loading">Loading section…</div> : <article className="ministry-book-reader"><header><span>{chapter.book.author}</span>{readerEyebrow ? <small>{readerEyebrow}</small> : null}<h2>{readerTitle}</h2></header>{visibleBlocks.map((block) => <div role="button" tabIndex={0} aria-pressed={selectedBlocks.includes(block.id)} key={block.id} data-ministry-book-block={block.id} className={`ministry-book-block ${block.type} ${block.level ? `level-${block.level}` : ''} ${selectedBlocks.includes(block.id) ? 'selected' : ''}`} onClick={() => toggleBlock(block.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleBlock(block.id) } }}>{renderBlock(block.text, block.id)}</div>)}</article>}
      <nav className="ministry-book-bottom-nav"><strong>{selectedBook.title} · {chapter ? sectionName(chapter.chapter) : 'Reading section'}</strong><div><button type="button" disabled={chapterIndex <= 0} onClick={() => openReading(selectedBook, chapters[chapterIndex - 1].number)}><ChevronLeft size={16} /> Previous</button><button type="button" disabled={chapterIndex < 0 || chapterIndex >= chapters.length - 1} onClick={() => openReading(selectedBook, chapters[chapterIndex + 1].number)}>Next <ChevronRight size={16} /></button></div></nav>
      {annotations.popup}
    </div> : null}
  </section>
}

export default MinistryBooksPage
