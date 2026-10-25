import { ArrowLeft, BookOpenText, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, Highlighter, Info, Maximize2, Minimize2, Minus, Pause, Play, Plus, Search, Square, StickyNote, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getOfficialRecoveryBibleOutlineUrl, getRecoveryBibleBookMatter, getRecoveryBibleBooks, getRecoveryBibleChapter, getRecoveryBibleOutlineUrl, searchRecoveryBible } from '../api/recoveryBible'
import type { BibleBook, BibleBookMatter, BibleChapter, BibleStudyNote, BibleVerse, ConcordanceResult } from '../api/recoveryBible'
import { formatVerseReading } from '../utils/bibleReading'
import { bookMatchesSlug } from '../utils/bibleBooks'
import { BIBLE_VOICE_STORAGE_KEY } from '../utils/bibleVoices'
import { shortBibleBookName } from '../utils/bibleReferences'
import { useReaderAnnotations } from '../hooks/useReaderAnnotations'
import PresentOnDisplay from '../components/PresentOnDisplay'
import '../styles/recovery-bible.css'
import '../styles/reader-annotations.css'

function RecoveryBiblePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const sourcePage = new URLSearchParams(location.search).get('from')
  const fromLifeStudy = sourcePage === 'life-study'
  const fromHwmr = sourcePage === 'hwmr'
  const fromMinistryBooks = sourcePage === 'ministry-books'
  const [books, setBooks] = useState<BibleBook[]>([])
  const [bookId, setBookId] = useState('01')
  const [chapterNumber, setChapterNumber] = useState(1)
  const [chapter, setChapter] = useState<BibleChapter | null>(null)
  const [bookMatter, setBookMatter] = useState<BibleBookMatter | null>(null)
  const [activeSection, setActiveSection] = useState<'chapter' | 'content' | 'instructions' | 'introduction' | 'outline' | 'charts'>('chapter')
  const [selectedVerseNumbers, setSelectedVerseNumbers] = useState<number[]>([])
  const [selectedStudyNote, setSelectedStudyNote] = useState<{ verse: BibleVerse; note: BibleStudyNote } | null>(null)
  const [referenceHistory, setReferenceHistory] = useState<Array<{ bookId: string; chapter: number; verse: number; studyNote: { verse: BibleVerse; note: BibleStudyNote } | null }>>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [readingMode, setReadingMode] = useState(false)
  const [readingPanelVisible, setReadingPanelVisible] = useState(true)
  const [referenceQuery, setReferenceQuery] = useState('')
  const [referenceError, setReferenceError] = useState('')
  const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem('aios-bible-font-size') || 18))
  const [reading, setReading] = useState(false)
  const [paused, setPaused] = useState(false)
  const [copied, setCopied] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceUri, setVoiceUri] = useState(() => localStorage.getItem(BIBLE_VOICE_STORAGE_KEY) || '')
  const [footnotesEnabled, setFootnotesEnabled] = useState(() => localStorage.getItem('aios-bible-footnotes') !== 'false')
  const [presentationHighlights, setPresentationHighlights] = useState(() => localStorage.getItem('lampstand-presentation-highlights') !== 'false')
  const selectedBook = useMemo(() => books.find((book) => book.id === bookId), [books, bookId])
  const [concordanceQuery, setConcordanceQuery] = useState('')
  const [concordanceResults, setConcordanceResults] = useState<ConcordanceResult[]>([])
  const [concordanceTotal, setConcordanceTotal] = useState(0)
  const [concordanceBusy, setConcordanceBusy] = useState(false)
  const selectedVerseKey =
    selectedVerseNumbers.join(',')
  const annotations = useReaderAnnotations(`recovery-bible:${bookId}:${chapterNumber}`)

  useEffect(() => {
    document.body.classList.toggle('bible-full-page-active', readingMode)
    if (readingMode) setReadingPanelVisible(true)
    return () => document.body.classList.remove('bible-full-page-active')
  }, [readingMode])

  useEffect(() => {
    const controller = new AbortController()
    getRecoveryBibleBooks(controller.signal).then(({ books: loaded }) => {
      setBooks(loaded)
      if (loaded.length) {
        const params = new URLSearchParams(location.search)
        const linkedBook = loaded.find((book) => bookMatchesSlug(book, params.get('book')))
        if (linkedBook) {
          setBookId(linkedBook.id)
          setChapterNumber(Math.min(linkedBook.chapters, Math.max(1, Number(params.get('chapter')) || 1)))
          const verse = Number(params.get('verse') || 1)
          window.setTimeout(() => document.querySelector<HTMLElement>(`[data-verse="${verse}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400)
          return
        }
        const saved = localStorage.getItem('aios-bible-location')?.split(':')
        const savedBook = loaded.find((book) => book.id === saved?.[0])
        if (savedBook) {
          setBookId(savedBook.id)
          setChapterNumber(Math.min(savedBook.chapters, Math.max(1, Number(saved?.[1]) || 1)))
        } else {
          setBookId(
            (current) =>
              loaded.some(
                (book) =>
                  book.id === current,
              )
                ? current
                : loaded[0].id,
          )
        }
      }
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load Bible books.'))
    return () => controller.abort()
  }, [location.search])

  useEffect(() => {
    if (!books.length) return
    const controller = new AbortController()
    setLoading(true)
    setError('')
    getRecoveryBibleChapter(bookId, chapterNumber, controller.signal).then((loaded) => {
      setChapter(loaded)
      const params = new URLSearchParams(location.search)
      const linkedBook = books.find((book) => book.id === bookId)
      if (linkedBook && bookMatchesSlug(linkedBook, params.get('book')) && loaded.chapter === Number(params.get('chapter'))) {
        const start = Math.max(1, Number(params.get('verse')) || 1); const end = Math.max(start, Number(params.get('verseEnd')) || start)
        setSelectedVerseNumbers(loaded.verses.filter((verse) => verse.number >= start && verse.number <= end).map((verse) => verse.number))
      } else setSelectedVerseNumbers([])
      setSelectedStudyNote(null)
    }).catch((reason: unknown) => {
      if ((reason as Error).name !== 'AbortError') setError(reason instanceof Error ? reason.message : 'Unable to load this chapter.')
    }).finally(() => setLoading(false))
    return () => controller.abort()
  }, [bookId, chapterNumber, books, location.search])

  useEffect(() => {
    if (!books.length) return
    const controller = new AbortController()
    getRecoveryBibleBookMatter(bookId, controller.signal).then(setBookMatter).catch(() => setBookMatter(null))
    return () => controller.abort()
  }, [bookId, books])

  useEffect(() => {
    localStorage.setItem('aios-bible-location', `${bookId}:${chapterNumber}`)
  }, [bookId, chapterNumber])

  useEffect(() => {
    localStorage.setItem('aios-bible-font-size', String(fontSize))
  }, [fontSize])

  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices().sort((left, right) => {
        const indiaOrder = Number(/-IN$/i.test(right.lang)) - Number(/-IN$/i.test(left.lang))
        return indiaOrder || left.name.localeCompare(right.name)
      })
      setVoices(available)
      if (!voiceUri && available.length) {
        const preferred = available.find((voice) => voice.lang.toLowerCase() === 'en-in') || available.find((voice) => /-IN$/i.test(voice.lang)) || available.find((voice) => voice.lang.toLowerCase().startsWith('en')) || available[0]
        setVoiceUri(preferred.voiceURI)
      }
    }
    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [voiceUri])

  useEffect(() => {
    if (voiceUri) localStorage.setItem(BIBLE_VOICE_STORAGE_KEY, voiceUri)
  }, [voiceUri])

  useEffect(() => {
    localStorage.setItem('aios-bible-footnotes', String(footnotesEnabled))
  }, [footnotesEnabled])

  useEffect(() => {
    window.speechSynthesis?.cancel()
    setReading(false)
    setPaused(false)
  }, [selectedVerseKey])

  function changeBook(nextId: string) { setBookId(nextId); setChapterNumber(1) }
  function moveChapter(direction: -1 | 1) {
    const index = books.findIndex((book) => book.id === bookId)
    if (!selectedBook || index < 0) return
    const next = chapterNumber + direction
    if (next >= 1 && next <= selectedBook.chapters) return setChapterNumber(next)
    const adjacent = books[index + direction]
    if (!adjacent) return
    setBookId(adjacent.id)
    setChapterNumber(direction === 1 ? 1 : adjacent.chapters)
  }

  function openReference() {
    const match = referenceQuery.trim().match(/^(.+?)\s+(\d+)(?::(\d+))?$/)
    if (!match) return setReferenceError('Enter a reference such as John 3:16.')
    const normalized = match[1].replace(/\s+/g, ' ').toLowerCase()
    const book = books.find((item) => item.name.toLowerCase() === normalized || item.name.toLowerCase().startsWith(normalized))
    const nextChapter = Number(match[2])
    if (!book || nextChapter < 1 || nextChapter > book.chapters) return setReferenceError('That book or chapter was not found.')
    setReferenceError('')
    setBookId(book.id)
    setChapterNumber(nextChapter)
    const verse = Number(match[3] || 0)
    if (verse) window.setTimeout(() => document.querySelector<HTMLElement>(`[data-verse="${verse}"]`)?.click(), 250)
  }

  function adjustFont(amount: number) { setFontSize((current) => Math.min(26, Math.max(15, current + amount))) }

  async function runConcordance() {
    if (concordanceQuery.trim().length < 2) return
    setConcordanceBusy(true)
    try { const result = await searchRecoveryBible(concordanceQuery); setConcordanceResults(result.results); setConcordanceTotal(result.total) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to search the concordance.') }
    finally { setConcordanceBusy(false) }
  }

  function openConcordanceResult(result: ConcordanceResult) {
    setBookId(result.book.id); setChapterNumber(result.chapter)
    window.setTimeout(() => document.querySelector<HTMLElement>(`[data-verse="${result.verse}"]`)?.click(), 300)
  }

  function openCrossReference(link: BibleStudyNote['referenceLinks'][number]) {
    setReferenceHistory((current) => [...current, { bookId, chapter: chapterNumber, verse: selectedStudyNote?.verse.number ?? 1, studyNote: selectedStudyNote }])
    setBookId(link.bookId); setChapterNumber(link.chapter); setSelectedStudyNote(null)
    window.setTimeout(() => document.querySelector<HTMLElement>(`[data-verse="${link.verse}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350)
  }

  function returnFromCrossReference() {
    const previous = referenceHistory.at(-1); if (!previous) return
    setReferenceHistory((current) => current.slice(0, -1)); setBookId(previous.bookId); setChapterNumber(previous.chapter); setSelectedStudyNote(null)
    window.setTimeout(() => { setSelectedStudyNote(previous.studyNote); document.querySelector<HTMLElement>(`[data-verse="${previous.verse}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, 350)
  }

  function toggleVerse(verse: BibleVerse) {
    setSelectedVerseNumbers((current) => current.includes(verse.number)
      ? current.filter((number) => number !== verse.number)
      : [...current, verse.number].sort((left, right) => left - right))
  }

  function verseWithMarkers(verse: BibleVerse) {
    if (!footnotesEnabled || !verse.studyNotes.length) return <span>{annotations.highlight(verse.text)}</span>
    const notes = [...verse.studyNotes].sort((left, right) => verse.text.toLowerCase().indexOf(left.word.toLowerCase()) - verse.text.toLowerCase().indexOf(right.word.toLowerCase()))
    const parts: React.ReactNode[] = []; let position = 0
    notes.forEach((note, index) => {
      const wordStart = verse.text.toLowerCase().indexOf(note.word.toLowerCase(), position)
      if (wordStart < 0) return
      const wordEnd = wordStart + note.word.length
      parts.push(annotations.highlight(verse.text.slice(position, wordStart)))
      parts.push(<button type="button" className={`bible-note-marker ${selectedStudyNote?.verse.number === verse.number && selectedStudyNote.note.marker === note.marker ? 'active' : ''}`} key={`${note.marker}-${index}`} title={`Open note ${note.marker} for ${note.word}`} onClick={(event) => { event.stopPropagation(); setSelectedStudyNote({ verse, note }) }}><sup>{note.marker}</sup></button>)
      parts.push(annotations.highlight(verse.text.slice(wordStart, wordEnd)))
      position = wordEnd
    })
    parts.push(annotations.highlight(verse.text.slice(position)))
    return <span>{parts}</span>
  }

  function selectedVerses() {
    return chapter?.verses.filter((verse) => selectedVerseNumbers.includes(verse.number)) ?? []
  }

  function readingText() {
    const selected = selectedVerses()
    if (!selected.length || !chapter) return ''
    return formatVerseReading(chapter.book.name, chapter.chapter, selected)
  }

  function toggleReading() {
    if (!('speechSynthesis' in window)) return
    if (reading && paused) { window.speechSynthesis.resume(); setPaused(false); return }
    if (reading) { window.speechSynthesis.pause(); setPaused(true); return }
    const text = readingText()
    if (!text) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.9
    const selectedVoice = voices.find((voice) => voice.voiceURI === voiceUri)
    utterance.voice = selectedVoice || null
    utterance.lang = voiceUri.startsWith('profile:') ? voiceUri.slice('profile:'.length) : selectedVoice?.lang || 'en-IN'
    utterance.onend = () => { setReading(false); setPaused(false) }
    utterance.onerror = () => { setReading(false); setPaused(false) }
    window.speechSynthesis.speak(utterance)
    setReading(true)
    setPaused(false)
  }

  function stopReading() {
    window.speechSynthesis?.cancel()
    setReading(false)
    setPaused(false)
  }

  async function copyReading() {
    const selected = selectedVerses()
    const text = selected.length
      ? selected.map((verse) => `${verse.reference}. ${verse.text}`).join('\n')
      : chapter ? `${chapter.book.name} chapter ${chapter.chapter}.\n\n${chapter.verses.map((verse) => `${verse.number}. ${verse.text}`).join('\n')}` : ''
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const presentationVerses = selectedVerses().length ? selectedVerses() : chapter?.verses ?? []
  const presentationHtml = presentationVerses.map((verse) => `<p><strong>${chapter?.book.name ?? ''} ${chapter?.chapter ?? ''}:${verse.number}</strong>&nbsp;&nbsp;${presentationHighlights ? annotations.highlightHtml(verse.text) : verse.text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p>`).join('')

  return (
    <section className={`bible-page${readingMode ? ' reading-mode' : ''}${activeSection !== 'chapter' ? ' show-book-matter' : ''}`}>
      <header className="bible-page-header">
        <div className="bible-title-icon"><BookOpenText size={25} /></div>
        <div><h1>Recovery Bible</h1><p>Read the locally stored Recovery Version with available study notes.</p></div>
      </header>

      <div className={`bible-toolbar${readingMode && !readingPanelVisible ? ' full-page-hidden' : ''}`} aria-label="Bible navigation">
        <button type="button" className="bible-nav-button" onClick={() => moveChapter(-1)} disabled={bookId === books[0]?.id && chapterNumber === 1} aria-label="Previous chapter"><ChevronLeft size={18} /></button>
        <div className="bible-button-picker" aria-label="Choose Bible book and chapter">
          <div className="bible-book-buttons" role="group" aria-label="Bible book">{books.map((book) => <button type="button" key={book.id} className={book.id === bookId ? 'active' : ''} onClick={() => changeBook(book.id)} title={book.name} aria-label={book.name}>{shortBibleBookName(book.name)}</button>)}</div>
          <div className="bible-chapter-buttons" role="group" aria-label="Chapter">{Array.from({ length: selectedBook?.chapters || 0 }, (_, index) => index + 1).map((number) => <button type="button" key={number} className={number === chapterNumber ? 'active' : ''} onClick={() => setChapterNumber(number)}>{number}</button>)}</div>
        </div>
        <button type="button" className="bible-nav-button" onClick={() => moveChapter(1)} disabled={bookId === books.at(-1)?.id && chapterNumber === selectedBook?.chapters} aria-label="Next chapter"><ChevronRight size={18} /></button>
        <div className="bible-reference-search">
          <Search size={16} />
          <input value={referenceQuery} onChange={(event) => setReferenceQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') openReference() }} placeholder="Go to John 3:16" aria-label="Go to Bible reference" />
          <button type="button" onClick={openReference}>Go</button>
        </div>
        <div className="bible-font-controls" aria-label="Reading font size">
          <button type="button" onClick={() => adjustFont(-1)} aria-label="Decrease text size"><Minus size={15} /></button>
          <span>Aa</span>
          <button type="button" onClick={() => adjustFont(1)} aria-label="Increase text size"><Plus size={15} /></button>
        </div>
        <div className="bible-reading-actions" aria-label="Reading actions">
          <button type="button" onClick={toggleReading} disabled={!selectedVerseNumbers.length} title={selectedVerseNumbers.length ? `Read ${selectedVerseNumbers.length} selected verse${selectedVerseNumbers.length === 1 ? '' : 's'}` : 'Select one or more verses to read'}>{reading && !paused ? <Pause size={16} /> : <Play size={16} />}<span>{reading && !paused ? 'Pause' : paused ? 'Resume' : selectedVerseNumbers.length > 1 ? `Read ${selectedVerseNumbers.length} verses` : 'Read verse'}</span></button>
          {reading ? <button type="button" onClick={stopReading}><Square size={14} /><span>Stop</span></button> : null}
          <button type="button" onClick={() => void copyReading()}>{copied ? <Check size={16} /> : <Copy size={16} />}<span>{copied ? 'Copied' : selectedVerseNumbers.length ? `Copy ${selectedVerseNumbers.length} verse${selectedVerseNumbers.length === 1 ? '' : 's'}` : 'Copy chapter'}</span></button>
          <button type="button" aria-pressed={presentationHighlights} title="Show or hide saved highlights on the presentation screen" onClick={() => setPresentationHighlights((current) => { const next = !current; localStorage.setItem('lampstand-presentation-highlights', String(next)); return next })}><Highlighter size={16} /><span>Highlights {presentationHighlights ? 'On' : 'Off'}</span></button>
          <PresentOnDisplay disabled={!chapter} title={chapter ? `${chapter.book.name} — Chapter ${chapter.chapter}` : 'Recovery Bible'} subtitle={selectedVerseNumbers.length ? `${selectedVerseNumbers.length} selected verse${selectedVerseNumbers.length === 1 ? '' : 's'}` : 'Full chapter'} html={presentationHtml} />
        </div>
        <label className="bible-footnotes-toggle" title="Show or hide footnote and cross-reference markers in the Bible text">
          <span>Markers</span>
          <input type="checkbox" checked={footnotesEnabled} onChange={(event) => setFootnotesEnabled(event.target.checked)} />
          <span className="bible-toggle-track" aria-hidden="true"><span /></span>
          <strong>{footnotesEnabled ? 'Visible' : 'Hidden'}</strong>
        </label>
        <button type="button" className="bible-reading-mode-toggle" onClick={() => setReadingMode((current) => !current)} aria-label={readingMode ? 'Exit full-page reading' : 'Open full-page reading'} title={readingMode ? 'Exit full-page reading' : 'Full-page reading'}>{readingMode ? <Minimize2 size={17} /> : <Maximize2 size={17} />}<span>{readingMode ? 'Exit' : 'Full page'}</span></button>
        {readingMode ? <button type="button" className="bible-panel-visibility-button" onClick={() => setReadingPanelVisible(false)} aria-label="Hide Book and Chapter panel" title="Hide Book and Chapter panel"><ChevronUp size={17} /><span>Hide panel</span></button> : null}
      </div>

      {readingMode && !readingPanelVisible ? <button type="button" className="bible-panel-restore" onClick={() => setReadingPanelVisible(true)} aria-label="Show Book and Chapter panel" title="Show Book and Chapter panel"><ChevronDown size={18} /><span>Book &amp; Chapter</span></button> : null}

      <nav className="bible-section-tabs" aria-label="Recovery Bible sections">
        {([['chapter', 'Bible text'], ['content', 'Content'], ['instructions', 'Instructions'], ['introduction', 'Introduction'], ['outline', 'Outline'], ['charts', 'Charts']] as const).map(([value, label]) => <button type="button" key={value} className={activeSection === value ? 'active' : ''} onClick={() => setActiveSection(value)}>{label}</button>)}
      </nav>

      {activeSection !== 'chapter' ? <article className="bible-book-matter">
        <header><span>Recovery Version</span><h2>{selectedBook?.name}</h2></header>
        {!bookMatter ? <p className="bible-matter-empty">The Bible study sections are loading. If this remains visible, restart Lampstand Project to load the updated local Bible service.</p> : null}
        {activeSection === 'content' && bookMatter ? <><h3>Content</h3>{bookMatter.introduction.theme ? <section><h4>Subject</h4><p>{bookMatter.introduction.theme}</p></section> : null}<h4>Chapters</h4><div className="bible-contents-grid">{bookMatter.contents.map((item) => <button type="button" key={item.chapter} onClick={() => { setChapterNumber(item.chapter); setActiveSection('chapter') }}>Chapter {item.chapter}</button>)}</div></> : null}
        {activeSection === 'introduction' ? <><h3>Introduction</h3>{bookMatter?.introduction.details.length ? <dl>{bookMatter.introduction.details.map((item, index) => <div key={`${item.label}-${index}`}><dt>{item.label || 'About'}</dt><dd>{item.value}</dd></div>)}</dl> : <p className="bible-matter-empty">No authorized book introduction is available locally.</p>}{bookMatter?.introduction.theme ? <section><h4>Subject</h4><p>{bookMatter.introduction.theme}</p></section> : null}</> : null}
        {activeSection === 'instructions' && bookMatter ? <><h3>Instructions</h3>{bookMatter.instructions.preface.map((paragraph, index) => <p key={`preface-${index}`}>{paragraph}</p>)}{bookMatter.instructions.introduction.map((paragraph, index) => <p key={`intro-${index}`}>{paragraph}</p>)}</> : null}
        {activeSection === 'outline' && bookMatter ? <><h3>{selectedBook?.name} Outline</h3>{bookMatter.studyAids.outline.available ? <iframe className="bible-outline-frame" title={`${selectedBook?.name} outline`} src={getRecoveryBibleOutlineUrl(bookId)} /> : getOfficialRecoveryBibleOutlineUrl(selectedBook?.name) ? <section className="bible-study-aid-card"><strong>Official New Testament outline available</strong><p>This copyrighted outline remains on Living Stream Ministry's website and is not copied into Lampstand Project.</p><a className="button" href={getOfficialRecoveryBibleOutlineUrl(selectedBook?.name) ?? undefined} target="_blank" rel="noreferrer">Open official {selectedBook?.name} outline</a></section> : <section className="bible-study-aid-card"><strong>No authorized local outline is available for this book yet.</strong><p>When its outline PDF is added to the Recovery Bible Study Aids library, it will appear here automatically.</p></section>}</> : null}
        {activeSection === 'charts' && bookMatter ? <><h3>Charts</h3><section className="bible-study-aid-card"><p>{bookMatter.studyAids.charts.note}</p></section></> : null}
      </article> : null}

      {referenceError ? <p className="bible-reference-error" role="alert">{referenceError}</p> : null}

      <section className="bible-concordance">
        <div><Search size={19} /><div><h2>Concordance</h2><p>Search every verse in the locally stored Recovery Version.</p></div>{(concordanceQuery || concordanceResults.length > 0) ? <button type="button" className="bible-concordance-close" onClick={() => { setConcordanceQuery(''); setConcordanceResults([]); setConcordanceTotal(0) }}><X size={15} /> Close results</button> : null}</div>
        <form onSubmit={(event) => { event.preventDefault(); void runConcordance() }}><input value={concordanceQuery} onChange={(event) => setConcordanceQuery(event.target.value)} placeholder="Search words or a phrase" aria-label="Concordance search" /><button type="submit" disabled={concordanceBusy || concordanceQuery.trim().length < 2}>{concordanceBusy ? 'Searching…' : 'Search'}</button></form>
        {concordanceResults.length ? <div className="bible-concordance-results"><p>{concordanceTotal} verse{concordanceTotal === 1 ? '' : 's'} found{concordanceTotal > concordanceResults.length ? ` · showing first ${concordanceResults.length}` : ''}</p>{concordanceResults.map((result) => <button type="button" key={result.reference} onClick={() => openConcordanceResult(result)}><strong>{result.reference}</strong><span>{result.text}</span></button>)}</div> : concordanceQuery && !concordanceBusy && concordanceTotal === 0 ? <p className="bible-concordance-empty">No concordance results yet.</p> : null}
      </section>

      {error ? <div className="bible-error"><strong>Unable to open the Bible</strong><span>{error}</span></div> : null}
      <div className={`bible-reader-layout ${fromLifeStudy || fromHwmr || fromMinistryBooks || (footnotesEnabled && (selectedStudyNote || referenceHistory.length)) ? 'with-notes' : 'without-notes'}`}>
        <article className="bible-reading-panel" aria-busy={loading} onMouseUp={annotations.captureSelection} style={{ '--bible-font-size': `${fontSize}px` } as React.CSSProperties}>
          <div className="bible-chapter-heading"><span>Recovery Version</span><h2>{chapter?.book.name || selectedBook?.name} {chapterNumber}</h2></div>
          {loading ? <p className="bible-loading">Loading chapter…</p> : chapter?.verses.map((verse) => (
            <div key={verse.number} data-verse={verse.number} role="button" tabIndex={0} aria-pressed={selectedVerseNumbers.includes(verse.number)} className={`bible-verse ${selectedVerseNumbers.includes(verse.number) ? 'selected' : ''} ${verse.footnotes.length ? 'has-note' : ''}`} onClick={() => toggleVerse(verse)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleVerse(verse) } }}>
              <sup>{verse.number}</sup>{verseWithMarkers(verse)}
            </div>
          ))}
        </article>

        {fromLifeStudy || fromHwmr || fromMinistryBooks || (footnotesEnabled && (selectedStudyNote || referenceHistory.length)) ? <aside className="bible-notes-panel">
          {selectedStudyNote ? <><div className="bible-notes-heading"><StickyNote size={19} /><div><h2>{selectedStudyNote.verse.reference}<sup>{selectedStudyNote.note.marker}</sup></h2><p>{selectedStudyNote.note.word}</p></div></div>
            <section className="bible-selected-note">
              {selectedStudyNote.note.note ? <><strong>Footnote</strong><div className="bible-footnote-copy">{selectedStudyNote.note.noteParagraphs.map((paragraph, index) => <p className="bible-footnote" key={index}>{paragraph}</p>)}</div></> : null}
              {selectedStudyNote.note.references ? <><strong>Cross-references</strong>{selectedStudyNote.note.referenceLinks.length ? <div className="bible-cross-reference-links">{selectedStudyNote.note.referenceLinks.map((link, index) => <button type="button" key={`${link.bookId}-${link.chapter}-${link.verse}-${index}`} onClick={() => openCrossReference(link)}>{link.label}</button>)}</div> : <p className="bible-cross-reference">{selectedStudyNote.note.references}</p>}</> : null}
            </section>
            <div className="bible-coverage-notice"><Info size={16} /><span>Click another superscript marker in the Bible text to open its note.</span></div></> : <div className="bible-reference-destination"><h2>Cross-reference</h2><p>You are viewing a linked verse. Use Back to return to its footnote.</p></div>}
          {referenceHistory.length ? <button type="button" className="bible-reference-back" onClick={returnFromCrossReference}><ArrowLeft size={16} />Back to previous reference</button> : fromLifeStudy ? <button type="button" className="bible-reference-back" onClick={() => { const target = new URLSearchParams(location.search).get('return'); navigate(target ? `/life-study?${target}` : '/life-study') }}><ArrowLeft size={16} />Back to Life-Study</button> : fromHwmr ? <button type="button" className="bible-reference-back" onClick={() => { const target = new URLSearchParams(location.search).get('return'); navigate(target ? `/ministry/hwmr?${target}` : '/ministry/hwmr') }}><ArrowLeft size={16} />Back to HWMR reading</button> : new URLSearchParams(location.search).get('from') === 'ministry-books' ? <button type="button" className="bible-reference-back" onClick={() => { const target = new URLSearchParams(location.search).get('return'); navigate(target ? `/ministry-books?${target}` : '/ministry-books') }}><ArrowLeft size={16} />Back to Ministry Books</button> : null}
        </aside> : null}
      </div>
      {annotations.popup}
      <nav className="bible-bottom-navigation" aria-label="Chapter navigation at page bottom">
        <strong>{chapter?.book.name || selectedBook?.name} {chapterNumber}</strong>
        <div className="bible-bottom-buttons">
          <button type="button" onClick={() => moveChapter(-1)} disabled={bookId === books[0]?.id && chapterNumber === 1}><ChevronLeft size={18} /><span>Previous</span></button>
          <button type="button" onClick={() => moveChapter(1)} disabled={bookId === books.at(-1)?.id && chapterNumber === selectedBook?.chapters}><span>Next</span><ChevronRight size={18} /></button>
        </div>
      </nav>
    </section>
  )
}

export default RecoveryBiblePage
