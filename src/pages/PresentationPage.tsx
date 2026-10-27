import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, ChevronDown, Clock3, Copy, Download, Eye, EyeOff, FileText, Image, Megaphone, MonitorUp, Music2, Plus, Radio, RotateCcw, SkipBack, SkipForward, Trash2, Upload, Video, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import PresentOnDisplay, { FADE_SPEEDS, presentOnSavedDisplay, presentWebSource, readPresentationPrefs, writePresentationPrefs, type TransitionSpeed } from '../components/PresentOnDisplay'
import AnnouncementSourcePanel from '../components/studio/AnnouncementSourcePanel'
import AudioRoutingPanel from '../components/studio/AudioRoutingPanel'
import MediaSourcePanel from '../components/studio/MediaSourcePanel'
import MediaTransport from '../components/studio/MediaTransport'
import WebSourcePanel from '../components/studio/WebSourcePanel'
import { shortBibleBookName } from '../utils/bibleReferences'
import { bibleSlideHtml, type BibleSlideFootnotes } from '../utils/bibleSlide'
import { findBookBySlug, isNewTestamentBook } from '../utils/bibleBooks'
import { verseRequestFromLink, type AudienceVerseRequest } from '../utils/bibleLinks'
import { hwmrDaySlideHtml, hwmrHymnSlideHtml, hwmrOutlineSlideHtml } from '../utils/hwmrSlide'
import { arrangeHymnChorus, hymnKeyFrom, hymnLayoutFor, hymnSlideHtml, type HymnalChorus, type HymnalColumns, type HymnalSlideMode } from '../utils/hymnalSlide'
import { mediaSlideHtml } from '../utils/mediaSlide'
import type { NewQueueItem, StudioQueueItem, StudioSourceKind } from '../utils/presentationQueue'
import { getHwmrLibrary, type HwmrBook } from '../api/hwmr'
import { getMinistryBookChapter, getMinistryBookChapters, getMinistryBooksLibrary, searchMinistryBooks, type MinistryBookSummary, type MinistryBookSearchResult, type MinistryChapterSummary } from '../api/ministryBooks'
import { getRecoveryBibleBooks, getRecoveryBibleChapter, searchRecoveryBible, type BibleBook, type BibleVerse, type ConcordanceResult } from '../api/recoveryBible'
import { getHymnalLibrary } from '../api/hymnal'
import type { Hymn } from '../types/hymnal'
import './PresentationPage.css'
import './PresentationPageEnhancements.css'
import './PresentationStudioRack.css'
import '../styles/recovery-bible.css'

type SourceKind = StudioSourceKind
type QueueItem = StudioQueueItem
type SelectedBibleVerse = { id: string; bookId: string; bookName: string; chapter: number; number: number; text: string; footnotes: string[] }
const STORAGE_KEY = 'lampstand.presentation.workspace.v1'

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!))
const paragraphs = (value: string) => value.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean).map((part) => `<p>${escapeHtml(part).replace(/\n/g, '<br>')}</p>`).join('')
// The operator searched for these words, so the result shows them inside the text, not just a reference.
function markPhrase(text: string, phrase: string) {
  const needle = phrase.trim()
  const at = needle ? text.toLowerCase().indexOf(needle.toLowerCase()) : -1
  if (at < 0) return text
  return <>{text.slice(0, at)}<mark>{text.slice(at, at + needle.length)}</mark>{text.slice(at + needle.length)}</>
}
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

const SOURCE_TABS: SourceKind[] = ['bible', 'hymnal', 'hwmr', 'ministry', 'media', 'announcement', 'web', 'custom']
const SOURCE_TAB_LABELS: Record<SourceKind, string> = { bible: 'Recovery Bible', hymnal: 'Hymnal', hwmr: 'HWMR', ministry: 'Ministry Books', media: 'Media', announcement: 'Announcements', web: 'Web output', custom: 'Custom portion' }

export default function PresentationPage() {
  const [source, setSource] = useState<SourceKind>('bible')
  const [queue, setQueue] = useState<QueueItem[]>(() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as QueueItem[] } catch { return [] } })
  const [current, setCurrent] = useState(0)
  const [books, setBooks] = useState<BibleBook[]>([])
  const [bookId, setBookId] = useState('')
  const [chapter, setChapter] = useState(1)
  const [verses, setVerses] = useState<BibleVerse[]>([])
  const [selectedVerses, setSelectedVerses] = useState<SelectedBibleVerse[]>([])
  const [bibleSlideTitle, setBibleSlideTitle] = useState('Scripture Reading')
  const [bibleFootnotes, setBibleFootnotes] = useState<BibleSlideFootnotes>('hidden')
  const [testament, setTestament] = useState<'old' | 'new'>('old')
  const [biblePhrase, setBiblePhrase] = useState('')
  const [bibleMatches, setBibleMatches] = useState<ConcordanceResult[]>([])
  const [bibleSearching, setBibleSearching] = useState(false)
  const [hymns, setHymns] = useState<Hymn[]>([])
  const [hymnId, setHymnId] = useState('')
  const [hymnSearch, setHymnSearch] = useState('')
  const [hymnalMode, setHymnalMode] = useState<HymnalSlideMode>('text')
  const [hymnalColumns, setHymnalColumns] = useState<HymnalColumns>(1)
  const [hymnalChorus, setHymnalChorus] = useState<HymnalChorus>('once')
  const [hymnalTranspose, setHymnalTranspose] = useState(0)
  const [hwmrBooks, setHwmrBooks] = useState<HwmrBook[]>([])
  const [hwmrBookId, setHwmrBookId] = useState('')
  const [hwmrWeek, setHwmrWeek] = useState(1)
  const [hwmrPortion, setHwmrPortion] = useState('day-1')
  const [ministryBooks, setMinistryBooks] = useState<MinistryBookSummary[]>([])
  const [ministryBookId, setMinistryBookId] = useState('')
  const [ministryPhrase, setMinistryPhrase] = useState('')
  const [ministryMatches, setMinistryMatches] = useState<MinistryBookSearchResult[]>([])
  const [ministrySearching, setMinistrySearching] = useState(false)
  const [ministrySections, setMinistrySections] = useState<MinistryChapterSummary[]>([])
  const [ministrySection, setMinistrySection] = useState(1)
  const [customTitle, setCustomTitle] = useState('Meeting portion')
  const [customText, setCustomText] = useState('')
  const [notes, setNotes] = useState('')
  const [notesOpen, setNotesOpen] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [message, setMessage] = useState('')
  const [liveId, setLiveId] = useState<string | null>(null)
  const [interlude, setInterlude] = useState<{ label: string; slideId: string | null } | null>(null)
  const [savedPresentationPrefs] = useState(readPresentationPrefs)
  const [showTitle, setShowTitle] = useState(savedPresentationPrefs.showTitle)
  const [fontScale, setFontScale] = useState(savedPresentationPrefs.fontScale)
  const [projectionTheme, setProjectionTheme] = useState(savedPresentationPrefs.theme)
  const [liveTransition, setLiveTransition] = useState(savedPresentationPrefs.transition)
  const [fadeSpeed, setFadeSpeed] = useState(savedPresentationPrefs.transitionSpeed)
  const [audioOutput, setAudioOutput] = useState(savedPresentationPrefs.audioOutput)
  const importRef = useRef<HTMLInputElement>(null)
  const queueLength = useRef(queue.length)
  // A search result can name a verse or section whose chapter is still loading, so the pick
  // waits in a ref and the load effect finishes it without re-triggering itself.
  const pendingVerse = useRef<{ bookId: string; chapter: number; verse: number } | null>(null)
  const pendingMinistrySection = useRef<number | null>(null)

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(queue)) }, [queue])
  useEffect(() => { queueLength.current = queue.length }, [queue.length])
  useEffect(() => { writePresentationPrefs({ showTitle, fontScale, theme: projectionTheme, transition: liveTransition, transitionSpeed: fadeSpeed, audioOutput }) }, [showTitle, fontScale, projectionTheme, liveTransition, fadeSpeed, audioOutput])
  useEffect(() => { if (current >= queue.length) setCurrent(Math.max(0, queue.length - 1)) }, [current, queue.length])
  useEffect(() => { void Promise.all([getRecoveryBibleBooks(), getHymnalLibrary(), getHwmrLibrary(), getMinistryBooksLibrary()]).then(([bible, hymnal, hwmr, ministry]) => { setBooks(bible.books); setBookId(bible.books[0]?.id ?? ''); setHymns(hymnal.hymns); setHymnId(hymnal.hymns[0]?.id ?? ''); setHwmrBooks(hwmr.books); setHwmrBookId(hwmr.books[0]?.id ?? ''); setMinistryBooks(ministry.books); setMinistryBookId(ministry.books[0]?.id ?? '') }).catch((error: Error) => setMessage(error.message)) }, [])
  useEffect(() => { if (!bookId) return; void getRecoveryBibleChapter(bookId, chapter).then((result) => setVerses(result.verses)).catch((error: Error) => setMessage(error.message)) }, [bookId, chapter])
  useEffect(() => { if (!ministryBookId) return; void getMinistryBookChapters(ministryBookId).then((result) => { setMinistrySections(result.chapters); setMinistrySection(pendingMinistrySection.current ?? result.chapters[0]?.number ?? 1); pendingMinistrySection.current = null }).catch((error: Error) => setMessage(error.message)) }, [ministryBookId])
  useEffect(() => {
    const phrase = biblePhrase.trim()
    if (phrase.length < 3) { setBibleMatches([]); return }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setBibleSearching(true)
      searchRecoveryBible(phrase, controller.signal, 'phrase').then(({ results }) => setBibleMatches(results)).catch((error: Error) => { if (error.name !== 'AbortError') setMessage(error.message) }).finally(() => setBibleSearching(false))
    }, 350)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [biblePhrase])
  useEffect(() => {
    const phrase = ministryPhrase.trim()
    if (phrase.length < 3) { setMinistryMatches([]); return }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setMinistrySearching(true)
      searchMinistryBooks(phrase, controller.signal, 'phrase', 8).then(({ results }) => setMinistryMatches(results)).catch((error: Error) => { if (error.name !== 'AbortError') setMessage(error.message) }).finally(() => setMinistrySearching(false))
    }, 350)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [ministryPhrase])
  useEffect(() => {
    const wanted = pendingVerse.current
    if (!wanted || wanted.bookId !== bookId || wanted.chapter !== chapter) return
    pendingVerse.current = null
    const verse = verses.find((item) => item.number === wanted.verse)
    if (verse) selectBibleVerse(verse)
  }, [verses, bookId, chapter])
  useEffect(() => { if (!timerRunning) return; const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000); return () => window.clearInterval(timer) }, [timerRunning])

  const selectedBook = books.find((item) => item.id === bookId)
  const visibleBooks = books.filter((book) => isNewTestamentBook(book) === (testament === 'new'))
  const biblePhraseQuery = biblePhrase.trim()
  const ministryPhraseQuery = ministryPhrase.trim()
  const basketFootnotes = selectedVerses.reduce((total, verse) => total + verse.footnotes.length, 0)
  const selectedHymn = hymns.find((item) => item.id === hymnId)
  const hymnalSections = selectedHymn ? arrangeHymnChorus(selectedHymn.sections, hymnalChorus) : []
  const hymnalFits = hymnLayoutFor(hymnalSections, hymnalColumns, hymnalMode).fits
  const visibleHymns = hymns.filter((hymn) => `${hymn.catalogPrefix ?? ''} ${hymn.hymnNumber ?? ''} ${hymn.title}`.toLowerCase().includes(hymnSearch.trim().toLowerCase())).slice(0, 100)
  const selectedHwmr = hwmrBooks.find((item) => item.id === hwmrBookId)
  const selectedWeek = selectedHwmr?.weeks.find((item) => item.number === hwmrWeek) ?? selectedHwmr?.weeks[0]
  const active = queue[current]
  const liveIndex = queue.findIndex((item) => item.id === liveId)
  const liveItem = liveIndex >= 0 ? queue[liveIndex] : undefined
  const timerText = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`

  function addItem(item: NewQueueItem) {
    const index = queueLength.current
    setQueue((items) => [...items, { ...item, id: makeId() }])
    queueLength.current = index + 1
    setCurrent(index)
    setMessage('Added to the presentation queue.')
  }
  function move(index: number, direction: -1 | 1) { const next = index + direction; if (next < 0 || next >= queue.length) return; setQueue((items) => { const copy = [...items]; [copy[index], copy[next]] = [copy[next], copy[index]]; return copy }); setCurrent(next) }
  function updateActiveNotes(value: string) { setNotes(value); if (active) setQueue((items) => items.map((item, index) => index === current ? { ...item, notes: value } : item)) }

  async function takeLive(index = current) {
    const item = queue[index]
    if (!item) return
    // A web source is the page itself in the projector window; everything else is a built slide.
    const opened = item.url
      ? await presentWebSource({ url: item.url, title: item.title })
      : await presentOnSavedDisplay({ title: item.title, subtitle: item.subtitle, html: item.html, showTitle, fontScale, theme: projectionTheme, transition: liveTransition, transitionSpeed: fadeSpeed, audioSinkId: audioOutput })
    if (opened) { setLiveId(item.id); setInterlude(null); setMessage(`Live: ${item.title}`) }
  }
  async function stepLive(direction: -1 | 1) {
    const base = liveIndex >= 0 ? liveIndex : current
    const next = Math.min(queue.length - 1, Math.max(0, base + direction))
    setCurrent(next); setNotes(queue[next]?.notes ?? '')
    await takeLive(next)
  }
  /** A PDF has no page keys of its own, so the studio rebuilds the slide at the next page and re-projects it. */
  async function stepDocumentPage(direction: -1 | 1) {
    const item = liveItem
    if (!item?.media || item.media.kind !== 'document') return
    const page = Math.max(1, (Number(item.media.page) || 1) + direction)
    const html = mediaSlideHtml({ ...item.media, page })
    setQueue((items) => items.map((entry) => entry.id === item.id && entry.media ? { ...entry, html, media: { ...entry.media, page } } : entry))
    const opened = await presentOnSavedDisplay({ title: item.title, subtitle: item.subtitle, html, showTitle, fontScale, theme: projectionTheme, transition: 'none', audioSinkId: audioOutput })
    if (opened) setMessage(`${item.title} - page ${page} on the audience screen.`)
  }
  async function blankOutput() {
    if (await presentOnSavedDisplay({ title: 'Lampstand Project', html: '', blank: true })) { setLiveId(null); setInterlude(null); setMessage('Audience screen blanked.') }
  }
  // A projected reference carries only its coordinates, so the verse text is read from the
  // local Bible and sent to the same window; the slide that was on air is kept for the return.
  async function projectVerse(request: AudienceVerseRequest) {
    const book = findBookBySlug(books, request.book)
    if (!book) { setMessage(`The local Recovery Bible library has no book matching ${request.label}.`); return }
    try {
      const loaded = await getRecoveryBibleChapter(book.id, request.chapter)
      const picked = loaded.verses.filter((verse) => verse.number >= request.verse && verse.number <= request.verseEnd)
      if (!picked.length) { setMessage(`The local Recovery Bible library has no verse at ${request.label}.`); return }
      const html = bibleSlideHtml(picked.map((verse) => ({ reference: `${book.name} ${request.chapter}:${verse.number}`, text: verse.text, footnotes: [] })))
      const opened = await presentOnSavedDisplay({ title: request.label || `${book.name} ${request.chapter}:${request.verse}`, subtitle: book.name, html, showTitle, fontScale, theme: projectionTheme, transition: liveTransition, transitionSpeed: fadeSpeed, audioSinkId: audioOutput })
      if (opened) { setInterlude({ label: request.label || `${book.name} ${request.chapter}:${request.verse}`, slideId: liveId }); setMessage(`Verse on the audience screen: ${request.label}`) }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to project that verse.') }
  }
  async function returnToSlide() {
    const index = queue.findIndex((item) => item.id === interlude?.slideId)
    if (index < 0) { setInterlude(null); return }
    setCurrent(index); setNotes(queue[index].notes)
    await takeLive(index)
  }
  function exportShow() {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), queue }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `lampstand-show-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url)
  }
  async function importShow(file?: File) {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as { queue?: QueueItem[] } | QueueItem[]
      const imported = Array.isArray(parsed) ? parsed : parsed.queue
      if (!Array.isArray(imported) || imported.some((item) => !item?.title || typeof item.html !== 'string')) throw new Error('This is not a valid Lampstand show file.')
      setQueue(imported.map((item) => ({ ...item, id: item.id || makeId(), notes: item.notes || '' }))); setCurrent(0); setLiveId(null); setMessage(`Imported ${imported.length} presentation item${imported.length === 1 ? '' : 's'}.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to import this show.') }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return
      if (event.ctrlKey && event.key === 'Enter') { event.preventDefault(); void takeLive() }
      else if (event.key === 'ArrowLeft' && current > 0) { setCurrent(current - 1); setNotes(queue[current - 1]?.notes ?? '') }
      else if (event.key === 'ArrowRight' && current < queue.length - 1) { setCurrent(current + 1); setNotes(queue[current + 1]?.notes ?? '') }
      else if (event.key.toLowerCase() === 'b') void blankOutput()
    }
    window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown)
  })

  useEffect(() => {
    const unsubscribe = window.lampstandDesktop?.presentation.subscribeVerseRequest((request) => void projectVerse(request as AudienceVerseRequest))
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; request?: AudienceVerseRequest }
      if (data?.type === 'lampstand:audience-verse' && data.request) void projectVerse(data.request)
    }
    window.addEventListener('message', onMessage)
    return () => { unsubscribe?.(); window.removeEventListener('message', onMessage) }
  })

  function addBible() {
    if (!selectedVerses.length) return
    const references = selectedVerses.map((verse) => `${verse.bookName} ${verse.chapter}:${verse.number}`)
    addItem({ kind: 'bible', title: bibleSlideTitle.trim() || 'Scripture Reading', subtitle: references.join(' · '), html: bibleSlideHtml(selectedVerses.map((verse) => ({ reference: `${verse.bookName} ${verse.chapter}:${verse.number}`, text: verse.text, footnotes: verse.footnotes })), bibleFootnotes), notes: '' })
  }
  function selectBibleVerse(verse: BibleVerse) {
    if (!selectedBook) return
    const id = `${selectedBook.id}-${chapter}-${verse.number}`
    setSelectedVerses((items) => items.some((item) => item.id === id) ? items : [...items, { id, bookId: selectedBook.id, bookName: selectedBook.name, chapter, number: verse.number, text: verse.text, footnotes: verse.footnotes }])
  }
  function toggleBibleVerse(verse: BibleVerse) {
    if (!selectedBook) return
    const id = `${selectedBook.id}-${chapter}-${verse.number}`
    if (selectedVerses.some((item) => item.id === id)) setSelectedVerses((items) => items.filter((item) => item.id !== id))
    else selectBibleVerse(verse)
  }
  // The search hit names a verse in a chapter that may still be loading, so the pick is either
  // made from the verses already on screen or left for the load effect to complete.
  function pickBibleMatch(result: ConcordanceResult) {
    if (result.book.id === bookId && result.chapter === chapter) {
      const verse = verses.find((item) => item.number === result.verse)
      if (verse) selectBibleVerse(verse)
      return
    }
    pendingVerse.current = { bookId: result.book.id, chapter: result.chapter, verse: result.verse }
    setBookId(result.book.id)
    setChapter(result.chapter)
  }
  function pickMinistryMatch(result: MinistryBookSearchResult) {
    if (result.book.id === ministryBookId) { setMinistrySection(result.chapter.number); return }
    pendingMinistrySection.current = result.chapter.number
    setMinistryBookId(result.book.id)
  }
  function addHymn() {
    if (!selectedHymn) return
    const catalog = [selectedHymn.catalogPrefix, selectedHymn.hymnNumber].filter(Boolean).join(' ')
    const html = hymnSlideHtml(selectedHymn.sections, { mode: hymnalMode, columns: hymnalColumns, chorus: hymnalChorus, semitones: hymnalTranspose })
    // The number leads the title because it is how the congregation finds the hymn.
    addItem({ kind: 'hymnal', title: catalog ? `${catalog} — ${selectedHymn.title}` : selectedHymn.title, subtitle: selectedHymn.author, html, notes: '' })
  }
  function addHwmr() {
    if (!selectedHwmr || !selectedWeek) return
    if (hwmrPortion === 'outline') addItem({ kind: 'hwmr', title: `Week ${selectedWeek.number} — ${selectedWeek.title}`, subtitle: selectedHwmr.title, html: hwmrOutlineSlideHtml(selectedWeek.outline), notes: '' })
    else if (hwmrPortion === 'hymn' && selectedWeek.hymn) addItem({ kind: 'hwmr', title: `Week ${selectedWeek.number} hymn ${selectedWeek.hymn.number}`, subtitle: selectedWeek.title, html: hwmrHymnSlideHtml({ number: selectedWeek.hymn.number, text: selectedWeek.hymn.text }), notes: '' })
    else { const dayNumber = Number(hwmrPortion.replace('day-', '')); const day = selectedWeek.days.find((item) => item.day === dayNumber); if (!day) return; addItem({ kind: 'hwmr', title: `Week ${selectedWeek.number} — Day ${day.day}`, subtitle: selectedWeek.title, html: hwmrDaySlideHtml(day), notes: '' }) }
  }
  async function addMinistry() {
    const book = ministryBooks.find((item) => item.id === ministryBookId); if (!book) return
    try { const result = await getMinistryBookChapter(ministryBookId, ministrySection); addItem({ kind: 'ministry', title: `${book.title} — ${result.chapter.displayTitle || result.chapter.title}`, subtitle: book.author, html: result.blocks.map((block) => block.type === 'heading' ? `<h${Math.min(4, Math.max(2, block.level ?? 2))}>${escapeHtml(block.text)}</h${Math.min(4, Math.max(2, block.level ?? 2))}>` : `<p>${escapeHtml(block.text)}</p>`).join(''), notes: '' }) } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to add the section.') }
  }

  return <section className="presentation-workspace">
    <header className="presentation-header"><span className="presentation-icon"><MonitorUp /></span><div><span className="presentation-kicker">LIVE PRODUCTION WORKSPACE</span><h1>Presentation Studio</h1><p>Build a running order and push any prepared portion to one persistent projector window.</p></div><div className="studio-ready"><Radio size={18}/><span><strong>Studio ready</strong><small>Output updates in place</small></span></div></header>
    {message && <p className="presentation-message">{message}</p>}
    <div className="presentation-layout">
      <section className="presentation-builder panel-card">
        <div className="rack-label"><span>SOURCE RACK</span><small>INPUT</small></div><div className="section-heading"><div><h2>Load a source</h2><p>Add Bible verses, HWMR, Ministry Books, media, announcements, a map or a live stream.</p></div><span>{queue.length} cued</span></div>
        <div className="source-tabs" role="tablist">{SOURCE_TABS.map((kind) => <button key={kind} className={source === kind ? 'active' : ''} onClick={() => setSource(kind)}>{SOURCE_TAB_LABELS[kind]}</button>)}</div>
        {source === 'bible' && <div className="source-form"><div className="field-row"><label>Display heading<input value={bibleSlideTitle} onChange={(event) => setBibleSlideTitle(event.target.value)} placeholder="Scripture Reading" /></label><label>Find a phrase<input type="search" value={biblePhrase} onChange={(event) => setBiblePhrase(event.target.value)} placeholder="Search the words of the verses — e.g. born again" /></label></div>{biblePhraseQuery.length >= 3 && <div className="source-search-results" aria-label="Bible search results"><header><strong>Verses containing “{biblePhraseQuery}”</strong><span>{bibleSearching ? 'Searching…' : `${bibleMatches.length} shown`}</span></header>{bibleMatches.map((result) => <button type="button" key={`${result.book.id}-${result.chapter}-${result.verse}`} onClick={() => pickBibleMatch(result)} title="Put this verse in the verse basket"><strong>{shortBibleBookName(result.book.name)} {result.chapter}:{result.verse}</strong><span>{markPhrase(result.text, biblePhraseQuery)}</span></button>)}{!bibleSearching && !bibleMatches.length && <p>No verse uses that exact phrase. Try fewer words.</p>}</div>}<div className="testament-switch" role="group" aria-label="Testament"><button type="button" className={testament === 'old' ? 'active' : ''} onClick={() => setTestament('old')}>Old Testament</button><button type="button" className={testament === 'new' ? 'active' : ''} onClick={() => setTestament('new')}>New Testament</button></div><div className="bible-button-picker" aria-label="Choose Bible book and chapter"><div className="bible-book-buttons" role="group" aria-label="Bible book">{visibleBooks.map((book) => <button type="button" key={book.id} className={book.id === bookId ? 'active' : ''} onClick={() => { setBookId(book.id); setChapter(1) }} title={book.name} aria-label={book.name}>{shortBibleBookName(book.name)}</button>)}</div><div className="bible-chapter-buttons" role="group" aria-label="Chapter">{Array.from({ length: selectedBook?.chapters ?? 1 }, (_, index) => index + 1).map((number) => <button type="button" key={number} className={number === chapter ? 'active' : ''} onClick={() => setChapter(number)}>{number}</button>)}</div></div><p className="basket-help">Pick a search result to put that verse in the basket, or browse by Testament and book below. Selections remain in the basket when you change books or chapters.</p><div className="slide-display-options"><div className="slide-option" role="group" aria-label="Footnotes on the slide"><span>Footnotes</span><button type="button" className={bibleFootnotes === 'hidden' ? 'active' : ''} onClick={() => setBibleFootnotes('hidden')}>Hide</button><button type="button" className={bibleFootnotes === 'shown' ? 'active' : ''} onClick={() => setBibleFootnotes('shown')}>Show</button>{bibleFootnotes === 'shown' && selectedVerses.length > 0 && <small>{basketFootnotes === 0 ? 'None of these verses carries a footnote' : `${basketFootnotes} footnote${basketFootnotes === 1 ? '' : 's'} printed under the verses`}</small>}</div></div><div className="verse-picker">{verses.map((verse) => { const verseId = `${selectedBook?.id}-${chapter}-${verse.number}`; return <label key={verse.number}><input type="checkbox" checked={selectedVerses.some((item) => item.id === verseId)} onChange={() => toggleBibleVerse(verse)}/><strong>{verse.number}</strong><span>{verse.text}</span></label> })}</div>{selectedVerses.length > 0 && <div className="verse-basket"><div><strong>Verse basket</strong><button type="button" onClick={() => setSelectedVerses([])}>Clear all</button></div>{selectedVerses.map((verse) => <button type="button" key={verse.id} onClick={() => setSelectedVerses((items) => items.filter((item) => item.id !== verse.id))}>{verse.bookName} {verse.chapter}:{verse.number}<X size={13}/></button>)}</div>}<button className="primary-action" disabled={!selectedVerses.length} onClick={addBible}><Plus size={17}/> Add {selectedVerses.length} selected verse{selectedVerses.length === 1 ? '' : 's'} as one slide</button></div>}
        {source === 'hymnal' && <div className="source-form"><label>Find hymn<input type="search" value={hymnSearch} onChange={(e) => setHymnSearch(e.target.value)} placeholder="Search by hymn number or title"/></label><label>Hymn<select value={hymnId} onChange={(e) => setHymnId(e.target.value)}>{visibleHymns.map((hymn) => <option key={hymn.id} value={hymn.id}>{[hymn.catalogPrefix, hymn.hymnNumber].filter(Boolean).join(' ')} {hymn.title}</option>)}</select></label>{selectedHymn && <div className="slide-display-options"><div className="slide-option" role="group" aria-label="Audience lyrics display"><span>Lyrics</span><button type="button" className={hymnalMode === 'text' ? 'active' : ''} onClick={() => setHymnalMode('text')}>Text only</button><button type="button" className={hymnalMode === 'chords' ? 'active' : ''} onClick={() => setHymnalMode('chords')}>With chords</button></div><div className="slide-option" role="group" aria-label="Audience columns"><span>Columns</span>{([1, 2, 3] as HymnalColumns[]).map((count) => <button type="button" key={count} className={hymnalColumns === count ? 'active' : ''} onClick={() => setHymnalColumns(count)}>{count}</button>)}</div><div className="slide-option" role="group" aria-label="Chorus on the slide"><span>Chorus</span><button type="button" className={hymnalChorus === 'once' ? 'active' : ''} onClick={() => setHymnalChorus('once')}>Once</button><button type="button" className={hymnalChorus === 'each' ? 'active' : ''} onClick={() => setHymnalChorus('each')}>Each stanza</button></div>{selectedHymn && hymnalMode === 'chords' && <div className="slide-option" role="group" aria-label="Hymn key"><span>Key</span><button type="button" onClick={() => setHymnalTranspose((value) => value - 1)} aria-label="Lower the key one semitone">&minus;</button><strong>{hymnKeyFrom(selectedHymn.originalKey, hymnalTranspose)}</strong><button type="button" onClick={() => setHymnalTranspose((value) => value + 1)} aria-label="Raise the key one semitone">+</button>{hymnalTranspose !== 0 && <button type="button" onClick={() => setHymnalTranspose(0)}>Original key</button>}</div>}</div>}{selectedHymn && <div className="hymn-source-preview"><strong>{selectedHymn.title}</strong><span>{hymnalSections.length} sections · {hymnalColumns === 1 ? 'one centered column' : `${hymnalColumns} columns`} of complete {hymnalMode === 'chords' ? 'lyrics with chords' : 'lyrics'} · {hymnalFits ? 'fits one slide' : 'scrolls on the projector: use more columns'}</span></div>}<button className="primary-action" disabled={!selectedHymn} onClick={addHymn}><Music2 size={17}/> Add complete hymn</button></div>}
        {source === 'hwmr' && <div className="source-form"><label>HWMR book<select value={hwmrBookId} onChange={(e) => { setHwmrBookId(e.target.value); setHwmrWeek(1) }}>{hwmrBooks.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label><div className="field-row"><label>Week<select value={hwmrWeek} onChange={(e) => setHwmrWeek(Number(e.target.value))}>{selectedHwmr?.weeks.map((week) => <option key={week.number} value={week.number}>Week {week.number}: {week.title}</option>)}</select></label><label>Portion<select value={hwmrPortion} onChange={(e) => setHwmrPortion(e.target.value)}><option value="outline">Week outline</option>{selectedWeek?.days.map((day) => <option key={day.day} value={`day-${day.day}`}>Day {day.day}</option>)}{selectedWeek?.hymn && <option value="hymn">Weekly hymn</option>}</select></label></div><button className="primary-action" onClick={addHwmr}><Plus size={17}/> Add HWMR portion</button></div>}
        {source === 'ministry' && <div className="source-form"><label>Find a phrase<input type="search" value={ministryPhrase} onChange={(event) => setMinistryPhrase(event.target.value)} placeholder="Search inside the ministry books — e.g. the word of God" /></label>{ministryPhraseQuery.length >= 3 && <div className="source-search-results" aria-label="Ministry book search results"><header><strong>Sections containing “{ministryPhraseQuery}”</strong><span>{ministrySearching ? 'Searching…' : `${ministryMatches.length} shown`}</span></header>{ministryMatches.map((result) => <button type="button" key={`${result.book.id}-${result.chapter.number}-${result.block}`} onClick={() => pickMinistryMatch(result)} title="Open this section in the picker below"><strong>{result.book.title}</strong><span>{result.chapter.displayTitle || result.chapter.title || `Section ${result.chapter.number}`}</span><p>{markPhrase(result.excerpt, ministryPhraseQuery)}</p></button>)}{!ministrySearching && !ministryMatches.length && <p>No ministry book uses that exact phrase. Try fewer words.</p>}</div>}<label>Book<select value={ministryBookId} onChange={(e) => setMinistryBookId(e.target.value)}>{ministryBooks.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label><label>Section<select value={ministrySection} onChange={(e) => setMinistrySection(Number(e.target.value))}>{ministrySections.map((section) => <option key={section.number} value={section.number}>{section.displayTitle || section.title}</option>)}</select></label><button className="primary-action" onClick={() => void addMinistry()}><Plus size={17}/> Add ministry section</button></div>}
        {source === 'media' && <MediaSourcePanel onAdd={addItem} onNotice={setMessage} />}
        {source === 'announcement' && <AnnouncementSourcePanel onAdd={addItem} onNotice={setMessage} />}
        {source === 'web' && <WebSourcePanel onAdd={addItem} onNotice={setMessage} />}
        {source === 'custom' && <div className="source-form"><label>Title<input value={customTitle} onChange={(e) => setCustomTitle(e.target.value)}/></label><label>Text<textarea rows={10} value={customText} onChange={(e) => setCustomText(e.target.value)} placeholder="Paste an announcement, burden, outline, or meeting text…"/></label><button className="primary-action" disabled={!customText.trim()} onClick={() => { addItem({ kind: 'custom', title: customTitle || 'Meeting portion', subtitle: 'Custom presentation', html: paragraphs(customText), notes: '' }); setCustomText('') }}><Plus size={17}/> Add custom portion</button></div>}
      </section>

      <section className="presentation-console panel-card">
        <div className="rack-label program"><span>PROGRAM OUTPUT</span><small>LIVE</small></div><div className="section-heading"><div><h2>Projector control</h2><p>Preview privately, then update the same audience window.</p></div><div className="meeting-timer"><Clock3 size={16}/><strong>{timerText}</strong><button onClick={() => setTimerRunning((value) => !value)}>{timerRunning ? 'Pause' : 'Start'}</button><button aria-label="Reset timer" onClick={() => { setElapsed(0); setTimerRunning(false) }}><RotateCcw size={14}/></button></div></div>
        {active ? <>
          <div className="program-status">
            <div className="status-channel preview-channel"><small>PREVIEW</small><strong>{active.title}</strong><span>{active.kind.replace('-', ' ')} · {current + 1} of {queue.length}</span></div>
            <div className={`status-channel live-channel ${liveItem ? 'on-air' : ''}`}><small>{liveItem ? 'LIVE' : 'AUDIENCE'}</small><strong>{interlude ? `Verse: ${interlude.label}` : liveItem?.title ?? 'Blank output'}</strong><span>{liveItem ? `${liveIndex + 1} of ${queue.length}` : 'Projector is blank'}</span></div>
          </div>
          {interlude && <div className="verse-interlude"><span><Radio size={13} /> A verse clicked on the audience screen is live now.</span><button type="button" onClick={() => void returnToSlide()}><ArrowLeft size={14} /> Return to {queue.find((item) => item.id === interlude.slideId)?.title ?? 'the previous slide'}</button></div>}
          <div className="present-controls"><button disabled={current === 0} onClick={() => { setCurrent((value) => value - 1); setNotes(queue[current - 1]?.notes ?? '') }}><ArrowLeft size={16}/> Previous preview</button><PresentOnDisplay title={active.title} subtitle={active.subtitle} html={active.html} showTitle={showTitle} fontScale={fontScale} theme={projectionTheme} transition={liveTransition} transitionSpeed={fadeSpeed} onPresented={() => { setLiveId(active.id); setInterlude(null) }}/><button disabled={current === queue.length - 1} onClick={() => { setCurrent((value) => value + 1); setNotes(queue[current + 1]?.notes ?? '') }}>Next preview <ArrowRight size={16}/></button></div>
          <div className="live-controls"><button disabled={liveIndex <= 0} onClick={() => void stepLive(-1)}><SkipBack size={16}/> Previous live</button><button className="take-live" onClick={() => void takeLive()}><Radio size={16}/> Take preview live</button><button disabled={liveIndex < 0 || liveIndex >= queue.length - 1} onClick={() => void stepLive(1)}>Next live <SkipForward size={16}/></button><button onClick={() => void blankOutput()}><EyeOff size={16}/> Blank</button></div>
          {liveItem?.media && <MediaTransport media={liveItem.media} onPage={(delta) => void stepDocumentPage(delta)} />}
          <div className="output-options"><label><input type="checkbox" checked={showTitle} onChange={(event) => setShowTitle(event.target.checked)}/>{showTitle ? <Eye size={15}/> : <EyeOff size={15}/>} Show title on audience screen</label><label>Audience text size<select value={fontScale} onChange={(event) => setFontScale(Number(event.target.value))}><option value={0.9}>Small</option><option value={1}>Normal</option><option value={1.15}>Large</option><option value={1.3}>Extra large</option><option value={1.45}>Very large</option><option value={1.6}>Huge</option><option value={1.8}>Extra huge</option><option value={2}>Maximum</option></select></label><label>Projection theme<select value={projectionTheme} onChange={(event) => setProjectionTheme(event.target.value as 'light' | 'dark')}><option value="light">Light</option><option value="dark">Dark</option></select></label><label>Live transition<select value={liveTransition} onChange={(event) => setLiveTransition(event.target.value as 'none' | 'fade')}><option value="fade">Fade</option><option value="none">None</option></select></label><label>Fade speed<select value={fadeSpeed} disabled={liveTransition !== 'fade'} onChange={(event) => setFadeSpeed(event.target.value as TransitionSpeed)}>{(Object.keys(FADE_SPEEDS) as TransitionSpeed[]).map((speed) => <option key={speed} value={speed}>{speed[0].toUpperCase() + speed.slice(1)} ({FADE_SPEEDS[speed]}s)</option>)}</select></label><span className="shortcut-hint">Ctrl+Enter: take live · B: blank · ←/→: preview · click a verse reference in the preview or on the audience screen to project that verse</span></div>
          <AudioRoutingPanel outputDeviceId={audioOutput} onOutputDevice={setAudioOutput} onNotice={setMessage} />
          <div className="presentation-preview" onClick={(event) => { const link = (event.target as HTMLElement).closest?.('a[data-book]'); if (!link) return; event.preventDefault(); const request = verseRequestFromLink(link as HTMLElement); if (request) void projectVerse(request) }}><div><header><h2>{active.title}</h2></header><article dangerouslySetInnerHTML={{ __html: active.html || (active.url ? `<p style="font-size:.78em;color:#8ea6b9">Live web page - the projector window loads:<br/>${escapeHtml(active.url)}</p>` : "") }}/></div></div><div className="speaker-notes-panel"><button type="button" className="speaker-notes-toggle" aria-expanded={notesOpen} onClick={() => setNotesOpen((value) => !value)}><ChevronDown size={15} className={notesOpen ? 'open' : ''}/> Presenter notes <small>Private — never shown to the audience</small>{!notesOpen && (notes || active.notes) ? <em>· written for this slide</em> : null}</button>{notesOpen && <label className="speaker-notes"><textarea rows={4} value={notes || active.notes} onChange={(e) => updateActiveNotes(e.target.value)} placeholder="Talking points, timing, or reminders…"/></label>}</div>
        </> : <div className="empty-console"><MonitorUp size={42}/><h3>Your presentation is empty</h3><p>Add Recovery Bible verses, hymns, HWMR portions, ministry-book sections, media, announcements, a web page, or custom text.</p></div>}
      </section>
    </div>
    <section className="presentation-queue panel-card"><div className="section-heading"><div><h2>Run of show</h2><p>Arrange the complete meeting flow. Your program is saved automatically.</p></div><div className="queue-heading-actions"><input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(event) => { void importShow(event.target.files?.[0]); event.currentTarget.value = '' }}/><button onClick={() => importRef.current?.click()}><Upload size={16}/> Import show</button>{queue.length > 0 && <><button onClick={exportShow}><Download size={16}/> Export show</button><button className="danger-quiet" onClick={() => { if (confirm('Clear the complete presentation queue?')) { setQueue([]); setLiveId(null) } }}><Trash2 size={16}/> Clear all</button></>}</div></div><div className="queue-list">{queue.map((item, index) => <button key={item.id} className={`queue-item ${index === current ? 'active' : ''} ${item.id === liveId ? 'live' : ''}`} onClick={() => { setCurrent(index); setNotes(item.notes) }}><span className="queue-number">{index + 1}</span><span className="queue-source">{item.kind === 'hymnal' ? <Music2/> : item.kind === 'bible' ? <BookOpen/> : item.kind === 'hwmr' || item.kind === 'custom' || item.kind === 'ministry' ? <FileText/> : item.kind === 'announcement' ? <Megaphone/> : item.kind === 'web' ? <MonitorUp/> : item.media?.kind === 'video' ? <Video/> : item.media?.kind === 'audio' ? <Music2/> : <Image/>}</span><span className="queue-copy"><strong>{item.title}</strong><small>{item.subtitle}</small></span>{item.id === liveId && <span className="live-pill">LIVE</span>}<span className="queue-actions"><span role="button" tabIndex={0} aria-label="Move up" onClick={(e) => { e.stopPropagation(); move(index, -1) }}><ArrowUp/></span><span role="button" tabIndex={0} aria-label="Move down" onClick={(e) => { e.stopPropagation(); move(index, 1) }}><ArrowDown/></span><span role="button" tabIndex={0} aria-label="Duplicate" onClick={(e) => { e.stopPropagation(); setQueue((items) => [...items.slice(0, index + 1), { ...item, id: makeId() }, ...items.slice(index + 1)]) }}><Copy/></span><span role="button" tabIndex={0} aria-label="Delete" onClick={(e) => { e.stopPropagation(); setQueue((items) => items.filter((_, itemIndex) => itemIndex !== index)) }}><Trash2/></span></span></button>)}</div></section>
  </section>
}
