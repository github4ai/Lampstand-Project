import { ALargeSmall, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Ban, Blend, BookOpen, ChevronDown, Clock3, Copy, Download, Eye, EyeOff, FileText, Gauge, Image, Keyboard, Megaphone, MonitorOff, MonitorUp, Moon, Music2, Pause, Play, Plus, Radio, RotateCcw, SkipBack, SkipForward, Sun, Trash2, Upload, Video, X } from 'lucide-react'
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { AudienceScreenPicker, FADE_SPEEDS, mediaProjectionWarning, presentOnSavedDisplay, presentWebSource, readPresentationPrefs, writePresentationPrefs, type TransitionSpeed } from '../components/PresentOnDisplay'
import AnnouncementSourcePanel from '../components/studio/AnnouncementSourcePanel'
import AudioRoutingPanel from '../components/studio/AudioRoutingPanel'
import CustomSourcePanel from '../components/studio/CustomSourcePanel'
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
// The operator searched for these words, so the result shows them inside the text, not just a reference.
function markPhrase(text: string, phrase: string) {
  const needle = phrase.trim()
  const at = needle ? text.toLowerCase().indexOf(needle.toLowerCase()) : -1
  if (at < 0) return text
  return <>{text.slice(0, at)}<mark>{text.slice(at, at + needle.length)}</mark>{text.slice(at + needle.length)}</>
}
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

/**
 * The operator often works the run of show with the keyboard while watching the projector, so a row action has to
 * run from Enter or Space. The key must not reach the row it sits in as a click too - that row is a button itself.
 */
function QueueAction({ label, onAct, children }: { label: string; onAct: () => void; children: ReactNode }) {
  return <span role="button" tabIndex={0} aria-label={label}
    onClick={(event) => { event.stopPropagation(); onAct() }}
    onKeyDown={(event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault(); event.stopPropagation()
      const button = event.currentTarget
      onAct()
      // Reordering moves the row this button belongs to, and Chrome drops focus from a node it moves, so the
      // same action is handed back at the row's new place in the list.
      requestAnimationFrame(() => button.focus())
    }}>{children}</span>
}

/**
 * Enter on a row's action also makes the browser click the row itself, which would preview a slide the operator is
 * not standing on. A hand click reports the button press it came from (detail >= 1), and a key pressed while the
 * row is focused keeps the row as the target, so only this combination is the echo of the action's own key.
 */
const isActionKeyEcho = (event: ReactMouseEvent<HTMLButtonElement>) => event.detail === 0 && event.target !== document.activeElement

const SOURCE_TABS = ['bible', 'hymnal', 'hwmr', 'ministry', 'media', 'announcement', 'web', 'custom'] as const
const SOURCE_TAB_LABELS: Record<(typeof SOURCE_TABS)[number], string> = { bible: 'Recovery Bible', hymnal: 'Hymnal', hwmr: 'HWMR', ministry: 'Ministry Books', media: 'Media', announcement: 'Announcements', web: 'Web output', custom: 'Custom portion' }

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
    // A missing file is checked first so the console can say so instead of the wall simply going dark.
    const warning = item.url ? '' : await mediaProjectionWarning(item.media)
    // A web source is the page itself in the projector window; everything else is a built slide.
    const opened = item.url
      ? await presentWebSource({ url: item.url, title: item.title })
      : await presentOnSavedDisplay({ title: item.title, subtitle: item.subtitle, html: item.html, showTitle, fontScale, theme: projectionTheme, transition: liveTransition, transitionSpeed: fadeSpeed, audioSinkId: audioOutput })
    if (opened) { setLiveId(item.id); setInterlude(null); setMessage(warning || `Live: ${item.title}`) }
  }
  async function stepLive(direction: -1 | 1) {
    const base = liveIndex >= 0 ? liveIndex : current
    const next = Math.min(queue.length - 1, Math.max(0, base + direction))
    setCurrent(next); setNotes(queue[next]?.notes ?? '')
    await takeLive(next)
  }
  /** A PDF or a deck has no keys of its own, so the studio rebuilds the slide at the next page and re-projects it. */
  async function stepMediaPage(direction: -1 | 1) {
    const item = liveItem
    const source = item?.media
    if (!source || (source.kind !== 'document' && source.kind !== 'deck')) return
    const last = source.kind === 'deck' ? (source.pages?.length || 1) : Infinity
    const page = Math.min(last, Math.max(1, (Number(source.page) || 1) + direction))
    const nextSource = { ...source, page, name: source.kind === 'deck' ? (source.pages?.[page - 1] || source.name) : source.name }
    const html = mediaSlideHtml(nextSource)
    const subtitle = source.kind === 'deck' ? `PowerPoint · slide ${page} of ${source.pages?.length || 1}` : item.subtitle
    setQueue((items) => items.map((entry) => entry.id === item.id && entry.media ? { ...entry, html, subtitle, media: nextSource } : entry))
    const warning = await mediaProjectionWarning(nextSource)
    const opened = await presentOnSavedDisplay({ title: item.title, subtitle, html, showTitle, fontScale, theme: projectionTheme, transition: 'none', audioSinkId: audioOutput })
    if (opened) setMessage(warning || `${item.title} - ${source.kind === 'deck' ? `slide ${page}` : `page ${page}`} on the audience screen.`)
  }
  /** Enlarging a still frame re-projects the same slide with no fade, so the room sees the frame move rather than a new slide arrive. */
  async function setMediaZoom(zoom: number) {
    const item = liveItem
    const source = item?.media
    if (!item || !source) return
    const nextSource = { ...source, zoom }
    const html = mediaSlideHtml(nextSource)
    setQueue((items) => items.map((entry) => entry.id === item.id && entry.media ? { ...entry, html, media: nextSource } : entry))
    await presentOnSavedDisplay({ title: item.title, subtitle: item.subtitle, html, showTitle, fontScale, theme: projectionTheme, transition: 'none', audioSinkId: audioOutput })
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
      // The console shortcuts belong to the room, not to the window being written in: a formatted text box is a div, not an input.
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLElement && event.target.isContentEditable) return
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
        <div className="rack-label"><span>SOURCE RACK</span><small>INPUT</small></div><div className="section-heading"><div><h2>Load a source</h2><p>Add Bible verses, HWMR, Ministry Books, media or a PowerPoint deck, announcements, a map or a live stream.</p></div><span>{queue.length} cued</span></div>
        <div className="source-tabs" role="tablist">{SOURCE_TABS.map((kind) => <button key={kind} className={source === kind ? 'active' : ''} onClick={() => setSource(kind)}>{SOURCE_TAB_LABELS[kind]}</button>)}</div>
        {source === 'bible' && <div className="source-form"><div className="field-row"><label>Display heading<input value={bibleSlideTitle} onChange={(event) => setBibleSlideTitle(event.target.value)} placeholder="Scripture Reading" /></label><label>Find a phrase<input type="search" value={biblePhrase} onChange={(event) => setBiblePhrase(event.target.value)} placeholder="Search the words of the verses — e.g. born again" /></label></div>{biblePhraseQuery.length >= 3 && <div className="source-search-results" aria-label="Bible search results"><header><strong>Verses containing “{biblePhraseQuery}”</strong><span>{bibleSearching ? 'Searching…' : `${bibleMatches.length} shown`}</span></header>{bibleMatches.map((result) => <button type="button" key={`${result.book.id}-${result.chapter}-${result.verse}`} onClick={() => pickBibleMatch(result)} title="Put this verse in the verse basket"><strong>{shortBibleBookName(result.book.name)} {result.chapter}:{result.verse}</strong><span>{markPhrase(result.text, biblePhraseQuery)}</span></button>)}{!bibleSearching && !bibleMatches.length && <p>No verse uses that exact phrase. Try fewer words.</p>}</div>}<div className="testament-switch" role="group" aria-label="Testament"><button type="button" className={testament === 'old' ? 'active' : ''} onClick={() => setTestament('old')}>Old Testament</button><button type="button" className={testament === 'new' ? 'active' : ''} onClick={() => setTestament('new')}>New Testament</button></div><div className="bible-button-picker" aria-label="Choose Bible book and chapter"><div className="bible-book-buttons" role="group" aria-label="Bible book">{visibleBooks.map((book) => <button type="button" key={book.id} className={book.id === bookId ? 'active' : ''} onClick={() => { setBookId(book.id); setChapter(1) }} title={book.name} aria-label={book.name}>{shortBibleBookName(book.name)}</button>)}</div><div className="bible-chapter-buttons" role="group" aria-label="Chapter">{Array.from({ length: selectedBook?.chapters ?? 1 }, (_, index) => index + 1).map((number) => <button type="button" key={number} className={number === chapter ? 'active' : ''} onClick={() => setChapter(number)}>{number}</button>)}</div></div><p className="basket-help">Pick a search result to put that verse in the basket, or browse by Testament and book below. Selections remain in the basket when you change books or chapters.</p><div className="slide-display-options"><div className="slide-option" role="group" aria-label="Footnotes on the slide"><span>Footnotes</span><button type="button" className={bibleFootnotes === 'hidden' ? 'active' : ''} onClick={() => setBibleFootnotes('hidden')}>Hide</button><button type="button" className={bibleFootnotes === 'shown' ? 'active' : ''} onClick={() => setBibleFootnotes('shown')}>Show</button>{bibleFootnotes === 'shown' && selectedVerses.length > 0 && <small>{basketFootnotes === 0 ? 'None of these verses carries a footnote' : `${basketFootnotes} footnote${basketFootnotes === 1 ? '' : 's'} printed under the verses`}</small>}</div></div><div className="verse-picker">{verses.map((verse) => { const verseId = `${selectedBook?.id}-${chapter}-${verse.number}`; return <label key={verse.number}><input type="checkbox" checked={selectedVerses.some((item) => item.id === verseId)} onChange={() => toggleBibleVerse(verse)}/><strong>{verse.number}</strong><span>{verse.text}</span></label> })}</div>{selectedVerses.length > 0 && <div className="verse-basket"><div><strong>Verse basket</strong><button type="button" onClick={() => setSelectedVerses([])}>Clear all</button></div>{selectedVerses.map((verse) => <button type="button" key={verse.id} onClick={() => setSelectedVerses((items) => items.filter((item) => item.id !== verse.id))}>{verse.bookName} {verse.chapter}:{verse.number}<X size={13}/></button>)}</div>}<button className="primary-action" disabled={!selectedVerses.length} onClick={addBible}><Plus size={17}/> Add {selectedVerses.length} selected verse{selectedVerses.length === 1 ? '' : 's'} as one slide</button></div>}
        {source === 'hymnal' && <div className="source-form"><label>Find hymn<input type="search" value={hymnSearch} onChange={(e) => setHymnSearch(e.target.value)} placeholder="Search by hymn number or title"/></label><label>Hymn<select value={hymnId} onChange={(e) => setHymnId(e.target.value)}>{visibleHymns.map((hymn) => <option key={hymn.id} value={hymn.id}>{[hymn.catalogPrefix, hymn.hymnNumber].filter(Boolean).join(' ')} {hymn.title}</option>)}</select></label>{selectedHymn && <div className="slide-display-options"><div className="slide-option" role="group" aria-label="Audience lyrics display"><span>Lyrics</span><button type="button" className={hymnalMode === 'text' ? 'active' : ''} onClick={() => setHymnalMode('text')}>Text only</button><button type="button" className={hymnalMode === 'chords' ? 'active' : ''} onClick={() => setHymnalMode('chords')}>With chords</button></div><div className="slide-option" role="group" aria-label="Audience columns"><span>Columns</span>{([1, 2, 3] as HymnalColumns[]).map((count) => <button type="button" key={count} className={hymnalColumns === count ? 'active' : ''} onClick={() => setHymnalColumns(count)}>{count}</button>)}</div><div className="slide-option" role="group" aria-label="Chorus on the slide"><span>Chorus</span><button type="button" className={hymnalChorus === 'once' ? 'active' : ''} onClick={() => setHymnalChorus('once')}>Once</button><button type="button" className={hymnalChorus === 'each' ? 'active' : ''} onClick={() => setHymnalChorus('each')}>Each stanza</button></div>{selectedHymn && hymnalMode === 'chords' && <div className="slide-option" role="group" aria-label="Hymn key"><span>Key</span><button type="button" onClick={() => setHymnalTranspose((value) => value - 1)} aria-label="Lower the key one semitone">&minus;</button><strong>{hymnKeyFrom(selectedHymn.originalKey, hymnalTranspose)}</strong><button type="button" onClick={() => setHymnalTranspose((value) => value + 1)} aria-label="Raise the key one semitone">+</button>{hymnalTranspose !== 0 && <button type="button" onClick={() => setHymnalTranspose(0)}>Original key</button>}</div>}</div>}{selectedHymn && <div className="hymn-source-preview"><strong>{selectedHymn.title}</strong><span>{hymnalSections.length} sections · {hymnalColumns === 1 ? 'one centered column' : `${hymnalColumns} columns`} of complete {hymnalMode === 'chords' ? 'lyrics with chords' : 'lyrics'} · {hymnalFits ? 'fits one slide' : 'scrolls on the projector: use more columns'}</span></div>}<button className="primary-action" disabled={!selectedHymn} onClick={addHymn}><Music2 size={17}/> Add complete hymn</button></div>}
        {source === 'hwmr' && <div className="source-form"><label>HWMR book<select value={hwmrBookId} onChange={(e) => { setHwmrBookId(e.target.value); setHwmrWeek(1) }}>{hwmrBooks.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label><div className="field-row"><label>Week<select value={hwmrWeek} onChange={(e) => setHwmrWeek(Number(e.target.value))}>{selectedHwmr?.weeks.map((week) => <option key={week.number} value={week.number}>Week {week.number}: {week.title}</option>)}</select></label><label>Portion<select value={hwmrPortion} onChange={(e) => setHwmrPortion(e.target.value)}><option value="outline">Week outline</option>{selectedWeek?.days.map((day) => <option key={day.day} value={`day-${day.day}`}>Day {day.day}</option>)}{selectedWeek?.hymn && <option value="hymn">Weekly hymn</option>}</select></label></div><button className="primary-action" onClick={addHwmr}><Plus size={17}/> Add HWMR portion</button></div>}
        {source === 'ministry' && <div className="source-form"><label>Find a phrase<input type="search" value={ministryPhrase} onChange={(event) => setMinistryPhrase(event.target.value)} placeholder="Search inside the ministry books — e.g. the word of God" /></label>{ministryPhraseQuery.length >= 3 && <div className="source-search-results" aria-label="Ministry book search results"><header><strong>Sections containing “{ministryPhraseQuery}”</strong><span>{ministrySearching ? 'Searching…' : `${ministryMatches.length} shown`}</span></header>{ministryMatches.map((result) => <button type="button" key={`${result.book.id}-${result.chapter.number}-${result.block}`} onClick={() => pickMinistryMatch(result)} title="Open this section in the picker below"><strong>{result.book.title}</strong><span>{result.chapter.displayTitle || result.chapter.title || `Section ${result.chapter.number}`}</span><p>{markPhrase(result.excerpt, ministryPhraseQuery)}</p></button>)}{!ministrySearching && !ministryMatches.length && <p>No ministry book uses that exact phrase. Try fewer words.</p>}</div>}<label>Book<select value={ministryBookId} onChange={(e) => setMinistryBookId(e.target.value)}>{ministryBooks.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label><label>Section<select value={ministrySection} onChange={(e) => setMinistrySection(Number(e.target.value))}>{ministrySections.map((section) => <option key={section.number} value={section.number}>{section.displayTitle || section.title}</option>)}</select></label><button className="primary-action" onClick={() => void addMinistry()}><Plus size={17}/> Add ministry section</button></div>}
        {source === 'media' && <MediaSourcePanel onAdd={addItem} onNotice={setMessage} />}
        {source === 'announcement' && <AnnouncementSourcePanel onAdd={addItem} onNotice={setMessage} />}
        {source === 'web' && <WebSourcePanel onAdd={addItem} onNotice={setMessage} />}
        {source === 'custom' && <CustomSourcePanel onAdd={addItem} onNotice={setMessage} />}
      </section>

      <section className="presentation-console panel-card">
        <div className="rack-label program"><span>PROGRAM OUTPUT</span><small>LIVE</small><span className="shortcut-hint" title="Ctrl+Enter takes the preview live - B blanks the screen - left and right arrows cue the preview - click a verse reference in the preview or on the audience screen to project that verse" aria-label="Keyboard shortcuts: Ctrl+Enter takes the preview live, B blanks the screen, arrow keys cue the preview, and a verse reference clicked in the preview or on the audience screen projects that verse"><Keyboard size={14}/></span></div><div className="section-heading"><div><h2>Projector control</h2><p>Preview privately, then update the same audience window.</p></div><div className="meeting-timer"><Clock3 size={16}/><strong>{timerText}</strong><button className="icon-action" onClick={() => setTimerRunning((value) => !value)} title={timerRunning ? 'Pause the meeting timer' : 'Start the meeting timer'} aria-label={timerRunning ? 'Pause the meeting timer' : 'Start the meeting timer'}>{timerRunning ? <Pause size={14}/> : <Play size={14}/>}</button><button className="icon-action" aria-label="Reset the meeting timer" title="Reset the meeting timer to zero" onClick={() => { setElapsed(0); setTimerRunning(false) }}><RotateCcw size={14}/></button></div></div>
        {active ? <>
          <div className="program-status">
            <div className="status-channel preview-channel"><small>PREVIEW</small><strong>{active.title}</strong><span>{active.kind.replace('-', ' ')} · {current + 1} of {queue.length}</span></div>
            <div className={`status-channel live-channel ${liveItem ? 'on-air' : ''}`}><small>{liveItem ? 'LIVE' : 'AUDIENCE'}</small><strong>{interlude ? `Verse: ${interlude.label}` : liveItem?.title ?? 'Blank output'}</strong><span>{liveItem ? `${liveIndex + 1} of ${queue.length}` : 'Projector is blank'}</span></div>
          </div>
          {interlude && <div className="verse-interlude"><span><Radio size={13} /> A verse clicked on the audience screen is live now.</span><button type="button" onClick={() => void returnToSlide()}><ArrowLeft size={14} /> Return to {queue.find((item) => item.id === interlude.slideId)?.title ?? 'the previous slide'}</button></div>}
          <div className="console-bar"><div className="console-group"><small className="console-group-label">Preview</small><button className="icon-action" disabled={current === 0} onClick={() => { setCurrent((value) => value - 1); setNotes(queue[current - 1]?.notes ?? '') }} title="Cue the previous item in the private preview" aria-label="Previous preview"><ArrowLeft size={16}/></button><AudienceScreenPicker/><button className="icon-action" disabled={current === queue.length - 1} onClick={() => { setCurrent((value) => value + 1); setNotes(queue[current + 1]?.notes ?? '') }} title="Cue the next item in the private preview" aria-label="Next preview"><ArrowRight size={16}/></button></div><div className="console-group"><small className="console-group-label">Live</small><button className="icon-action" disabled={liveIndex <= 0} onClick={() => void stepLive(-1)} title="Project the item before the one the audience sees" aria-label="Previous live"><SkipBack size={16}/></button><button className="take-live" onClick={() => void takeLive()} aria-label="Put the previewed slide on the audience screen" title="Put the previewed slide on the audience screen"><Radio size={16}/> Take live</button><button className="icon-action" disabled={liveIndex < 0 || liveIndex >= queue.length - 1} onClick={() => void stepLive(1)} title="Project the item after the one the audience sees" aria-label="Next live"><SkipForward size={16}/></button><button className="icon-action" onClick={() => void blankOutput()} title="Blank the audience screen" aria-label="Blank the audience screen"><MonitorOff size={16}/></button></div><div className="console-group"><small className="console-group-label">Output</small><button type="button" className={`icon-toggle${showTitle ? ' active' : ''}`} onClick={() => setShowTitle(!showTitle)} aria-pressed={showTitle} title={showTitle ? 'The slide title shows on the audience screen - click to hide it' : 'The slide title is hidden from the audience - click to show it'}>{showTitle ? <Eye size={16}/> : <EyeOff size={16}/>}</button><span className="console-field"><ALargeSmall size={16} aria-hidden="true"/><select aria-label="Audience text size" title="How large the words read on the audience screen" value={fontScale} onChange={(event) => setFontScale(Number(event.target.value))}><option value={0.9}>Small</option><option value={1}>Normal</option><option value={1.15}>Large</option><option value={1.3}>Extra large</option><option value={1.45}>Very large</option><option value={1.6}>Huge</option><option value={1.8}>Extra huge</option><option value={2}>Maximum</option></select></span><span className="console-switch" role="group" aria-label="Projection theme"><button type="button" className={`icon-toggle${projectionTheme === 'light' ? ' active' : ''}`} onClick={() => setProjectionTheme('light')} aria-pressed={projectionTheme === 'light'} aria-label="Project dark words on a light background" title="Project dark words on a light background"><Sun size={15}/></button><button type="button" className={`icon-toggle${projectionTheme === 'dark' ? ' active' : ''}`} onClick={() => setProjectionTheme('dark')} aria-pressed={projectionTheme === 'dark'} aria-label="Project light words on a dark background" title="Project light words on a dark background"><Moon size={15}/></button></span><span className="console-switch" role="group" aria-label="Live transition"><button type="button" className={`icon-toggle${liveTransition === 'fade' ? ' active' : ''}`} onClick={() => setLiveTransition('fade')} aria-pressed={liveTransition === 'fade'} aria-label="Fade the new slide in when it goes live" title="Fade the new slide in when it goes live"><Blend size={15}/></button><button type="button" className={`icon-toggle${liveTransition === 'none' ? ' active' : ''}`} onClick={() => setLiveTransition('none')} aria-pressed={liveTransition === 'none'} aria-label="Change slides with no fade" title="Change slides with no fade"><Ban size={15}/></button></span><span className="console-field"><Gauge size={16} aria-hidden="true"/><select aria-label="Fade speed" title={`How long the fade takes - ${(Object.keys(FADE_SPEEDS) as TransitionSpeed[]).map((speed) => `${speed} ${FADE_SPEEDS[speed]}s`).join(', ')}`} disabled={liveTransition !== 'fade'} value={fadeSpeed} onChange={(event) => setFadeSpeed(event.target.value as TransitionSpeed)}>{(Object.keys(FADE_SPEEDS) as TransitionSpeed[]).map((speed) => <option key={speed} value={speed}>{speed[0].toUpperCase() + speed.slice(1)}</option>)}</select></span></div></div>
          {liveItem?.media && <MediaTransport media={liveItem.media} onPage={(delta) => void stepMediaPage(delta)} onZoom={(zoom) => void setMediaZoom(zoom)} />}
          <AudioRoutingPanel outputDeviceId={audioOutput} onOutputDevice={setAudioOutput} onNotice={setMessage} />
          <div className="presentation-preview" onClick={(event) => { const link = (event.target as HTMLElement).closest?.('a[data-book]'); if (!link) return; event.preventDefault(); const request = verseRequestFromLink(link as HTMLElement); if (request) void projectVerse(request) }}><div><header><h2>{active.title}</h2></header><article dangerouslySetInnerHTML={{ __html: active.media ? mediaSlideHtml({ ...active.media, autoplay: false }) : active.html || (active.url ? `<p style="font-size:.78em;color:#8ea6b9">Live web page - the projector window loads:<br/>${escapeHtml(active.url)}</p>` : "") }}/></div></div><div className="speaker-notes-panel"><button type="button" className="speaker-notes-toggle" aria-expanded={notesOpen} onClick={() => setNotesOpen((value) => !value)}><ChevronDown size={15} className={notesOpen ? 'open' : ''}/> Presenter notes <small>Private — never shown to the audience</small>{!notesOpen && (notes || active.notes) ? <em>· written for this slide</em> : null}</button>{notesOpen && <label className="speaker-notes"><textarea rows={4} value={notes || active.notes} onChange={(e) => updateActiveNotes(e.target.value)} placeholder="Talking points, timing, or reminders…"/></label>}</div>
        </> : <div className="empty-console"><MonitorUp size={42}/><h3>Your presentation is empty</h3><p>Add Recovery Bible verses, hymns, HWMR portions, ministry-book sections, media, announcements, a web page, or custom text.</p></div>}
      </section>
    </div>
    <section className="presentation-queue panel-card"><div className="section-heading"><div><h2>Run of show</h2><p>Arrange the complete meeting flow. Your program is saved automatically.</p></div><div className="queue-heading-actions"><input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(event) => { void importShow(event.target.files?.[0]); event.currentTarget.value = '' }}/><button onClick={() => importRef.current?.click()}><Upload size={16}/> Import show</button>{queue.length > 0 && <><button onClick={exportShow}><Download size={16}/> Export show</button><button className="danger-quiet" onClick={() => { if (confirm('Clear the complete presentation queue?')) { setQueue([]); setLiveId(null) } }}><Trash2 size={16}/> Clear all</button></>}</div></div><div className="queue-list">{queue.map((item, index) => <button key={item.id} className={`queue-item ${index === current ? 'active' : ''} ${item.id === liveId ? 'live' : ''}`} onClick={(event) => { if (isActionKeyEcho(event)) return; setCurrent(index); setNotes(item.notes) }}><span className="queue-number">{index + 1}</span><span className="queue-source">{item.kind === 'hymnal' ? <Music2/> : item.kind === 'bible' ? <BookOpen/> : item.kind === 'hwmr' || item.kind === 'custom' || item.kind === 'ministry' ? <FileText/> : item.kind === 'announcement' ? <Megaphone/> : item.kind === 'web' ? <MonitorUp/> : item.media?.kind === 'video' ? <Video/> : item.media?.kind === 'audio' ? <Music2/> : <Image/>}</span><span className="queue-copy"><strong>{item.title}</strong><small>{item.subtitle}</small></span>{item.id === liveId && <span className="live-pill">LIVE</span>}<span className="queue-actions"><QueueAction label="Move up" onAct={() => move(index, -1)}><ArrowUp/></QueueAction><QueueAction label="Move down" onAct={() => move(index, 1)}><ArrowDown/></QueueAction><QueueAction label="Duplicate" onAct={() => setQueue((items) => [...items.slice(0, index + 1), { ...item, id: makeId() }, ...items.slice(index + 1)])}><Copy/></QueueAction><QueueAction label="Delete" onAct={() => setQueue((items) => items.filter((_, itemIndex) => itemIndex !== index))}><Trash2/></QueueAction></span></button>)}</div></section>
  </section>
}
