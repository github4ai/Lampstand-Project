import { ArrowLeft, ArrowRight, BookOpenText, CalendarDays, Check, Clipboard, Download, ExternalLink, Highlighter, KeyRound, Maximize2, Minimize2, Music2, NotebookPen, Play, Plus, Printer, RotateCcw, Save, Sparkles, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getHwmrLibrary, refreshHwmrLibrary, type HwmrAudit, type HwmrBook } from '../api/hwmr'
import { getHymnalLibrary } from '../api/hymnal'
import { getMinistryBookChapters, getMinistryBooksLibrary, type MinistryBookSummary } from '../api/ministryBooks'
import type { Hymn } from '../types/hymnal'
import { lastMentionedBibleBook, linkBibleReferences } from '../utils/bibleReferences'
import { streamAIOS } from '../services/api'
import '../styles/hwmr.css'

type ReadingView = 'key-statements' | 'outline' | 'day' | 'hymn' | 'study-notes'
interface BookProgress { startedAt: string; startWeekIndex?: number; lastStartedAt?: string; completed: string[] }
type ProgressStore = Record<string, BookProgress>
const PROGRESS_KEY = 'aios-hwmr-reading-progress-v1'
const ANNOTATIONS_KEY = 'aios-hwmr-annotations-v1'
type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink'
interface HwmrAnnotation { id: string; bookId: string; week: number; day: number; quote: string; note: string; color: HighlightColor; createdAt: string }
type StudyArtifact = string
const DEFAULT_STUDY_ARTIFACTS: StudyArtifact[] = ['Main Burden', '5-Point Memory Outline', 'Summary of the Whole Week', 'Small Group Sharing (5–7 Minutes)', 'Discussion Questions', 'Key Points to Remember', 'One-Sentence Takeaway']
const STUDY_ARTIFACTS_KEY = 'aios-hwmr-study-artifacts-v1'
const SAVED_STUDIES_KEY = 'aios-hwmr-saved-studies-v1'
const READER_ZOOM_KEY = 'aios-hwmr-reader-zoom-v1'
interface SavedStudy { id: string; bookId: string; week: number; title: string; content: string; createdAt: string; updatedAt: string }
interface FurtherReadingLink { label: string; title: string; sectionLabel: string; section: number; sectionKind: 'chapter' | 'message'; book: MinistryBookSummary }

function repairHwmrReadingText(value = '') {
  return value
    .replace(/\b(vol\.)\s*\n+\s*(\d+)/gi, '$1 $2')
    .replace(/\b(chs?\.)\s*\n+\s*([\d—–-]+)/gi, '$1 $2')
    .replace(/([“"][^”"]{3,})\s*\n+\s*([^”"]{1,80}[”"])/g, '$1 $2')
    .replace(/(Further Reading:[^\n]*)\n+(?=(?:CWW[NL]|Life-study|The |Messages?\b))/gi, '$1 ')
}

function normalizedMinistryTitle(value: string) {
  return value.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']+/g, ' ').replace(/\bbook\s+0+(\d+)/g, 'book $1').replace(/^(?:a|an|the)\s+/, '').replace(/\s+the(?=\s+(?:msgs?|vol)|$)/, '').trim()
}

const chapterWords = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']

export function parseFurtherReadingReferences(text: string, books: MinistryBookSummary[]): FurtherReadingLink[] {
  const repaired = repairHwmrReadingText(text)
  const entries = [...repaired.matchAll(/Further Reading:\s*([^\n]+)/gi)].flatMap((match) => match[1].split(/\s*;\s*/)).map((entry) => entry.trim()).filter(Boolean)
  const results: FurtherReadingLink[] = []
  const findTitle = (title: string, message = 0) => {
    const wanted = normalizedMinistryTitle(title)
    const matches = books.filter((item) => { const available = normalizedMinistryTitle(item.title); return available === wanted || available.includes(wanted) || wanted.includes(available) })
    if (!message) return matches[0]
    return matches.find((item) => { const range = item.title.match(/msgs?\.\s*(\d+)\s*[-–—]\s*(\d+)/i); return range && message >= Number(range[1]) && message <= Number(range[2]) }) || matches[0]
  }
  for (const entry of entries) {
    const collectedWithTitle = entry.match(/^(CWWL|CWWN),.*?\bvol\.\s*(\d+),\s*[“"]([^”"]+)[”"].*?\b(chs?|msgs?)\.\s*([\d—–-]+)/i)
    const collectedWithoutTitle = entry.match(/^(CWWL|CWWN),.*?\bvol\.\s*(\d+).*?\b(chs?|msgs?)\.\s*([\d—–-]+)/i)
    const collected = collectedWithTitle
      ? { series: collectedWithTitle[1], volume: collectedWithTitle[2], title: collectedWithTitle[3], kind: collectedWithTitle[4], sections: collectedWithTitle[5] }
      : collectedWithoutTitle ? { series: collectedWithoutTitle[1], volume: collectedWithoutTitle[2], title: '', kind: collectedWithoutTitle[3], sections: collectedWithoutTitle[4] } : null
    if (collected) {
      const section = Number(collected.sections.match(/\d+/)?.[0] || 1)
      const author = collected.series.toUpperCase() === 'CWWL' ? 'witness lee' : 'watchman nee'
      const volumePattern = new RegExp(`\\bvol\\s+0*${collected.volume}\\b`)
      const book = (collected.title ? findTitle(collected.title, /msg/i.test(collected.kind) ? section : 0) : undefined)
        || books.find((item) => { const title = normalizedMinistryTitle(item.title); return title.includes(`collected works of ${author}`) && volumePattern.test(title) })
      if (book) results.push({ label: entry, title: collected.title || book.title, sectionLabel: collected.sections, section, sectionKind: /msg/i.test(collected.kind) ? 'message' : 'chapter', book })
      continue
    }
    const general = entry.match(/^(.+?),\s*(msgs?|chs?)\.\s*([\d—–-]+)/i)
    if (general) {
      const section = Number(general[3].match(/\d+/)?.[0] || 1)
      const sectionKind = /msg/i.test(general[2]) ? 'message' : 'chapter'
      const book = findTitle(general[1], sectionKind === 'message' ? section : 0)
      if (book) results.push({ label: entry, title: general[1], sectionLabel: general[3], section, sectionKind, book })
    }
  }
  return results
}

function loadProgress(): ProgressStore {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}') as ProgressStore } catch { return {} }
}

function loadAnnotations(): HwmrAnnotation[] {
  try { const value = JSON.parse(localStorage.getItem(ANNOTATIONS_KEY) ?? '[]'); return Array.isArray(value) ? value : [] } catch { return [] }
}

function loadStudyArtifacts(): StudyArtifact[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STUDY_ARTIFACTS_KEY) ?? '[]')
    return Array.isArray(saved) && saved.length ? saved.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : DEFAULT_STUDY_ARTIFACTS
  } catch { return DEFAULT_STUDY_ARTIFACTS }
}

function loadSavedStudies(): SavedStudy[] {
  try { const saved = JSON.parse(localStorage.getItem(SAVED_STUDIES_KEY) ?? '[]'); return Array.isArray(saved) ? saved : [] } catch { return [] }
}

function loadReaderZoom() {
  const value = Number(localStorage.getItem(READER_ZOOM_KEY) ?? 100)
  return Number.isFinite(value) ? Math.min(150, Math.max(80, value)) : 100
}

function currentWeekMonday() {
  const monday = new Date()
  const weekday = (monday.getDay() + 6) % 7
  monday.setDate(monday.getDate() - weekday)
  const year = monday.getFullYear(); const month = String(monday.getMonth() + 1).padStart(2, '0'); const day = String(monday.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function currentReadingDay() {
  const mondayBasedDay = (new Date().getDay() + 6) % 7
  return mondayBasedDay < 6 ? mondayBasedDay + 1 : null
}

function locateNormalizedQuote(text: string, quote: string) {
  const positions: number[] = []
  let normalized = ''
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (/\s/.test(character)) {
      if (normalized && !normalized.endsWith(' ')) { normalized += ' '; positions.push(index) }
    } else { normalized += character.toLowerCase(); positions.push(index) }
  }
  const needle = quote.replace(/\s+/g, ' ').trim().toLowerCase()
  const found = normalized.indexOf(needle)
  if (found < 0 || !needle) return null
  return { start: positions[found], end: positions[found + needle.length - 1] + 1 }
}

function scheduleFor(book: HwmrBook, progress?: BookProgress) {
  if (!progress || !book.weeks.length || book.structure === 'messages') return null
  const started = new Date(`${progress.startedAt}T12:00:00`)
  const monday = new Date(started); const weekday = (monday.getDay() + 6) % 7
  monday.setDate(monday.getDate() - weekday); monday.setHours(0, 0, 0, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const elapsed = Math.max(0, Math.floor((today.getTime() - monday.getTime()) / 86400000))
  const startingWeek = Math.max(0, Math.min(book.weeks.length - 1, progress.startWeekIndex ?? 0))
  const weekIndex = Math.min(book.weeks.length - 1, startingWeek + Math.floor(elapsed / 7))
  const dayOfWeek = elapsed % 7
  return { weekIndex, day: dayOfWeek < 6 ? dayOfWeek + 1 : null }
}

export default function HwmrPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const linkedLocation = new URLSearchParams(location.search)
  const [books, setBooks] = useState<HwmrBook[]>([])
  const [libraryAudit, setLibraryAudit] = useState<HwmrAudit | null>(null)
  const [refreshingLibrary, setRefreshingLibrary] = useState(false)
  const [libraryRefreshMessage, setLibraryRefreshMessage] = useState('')
  const [selectedId, setSelectedId] = useState(linkedLocation.get('book') || '')
  const [weekIndex, setWeekIndex] = useState(Math.max(0, Number(linkedLocation.get('week')) || 0))
  const [startWeekIndex, setStartWeekIndex] = useState(Math.max(0, Number(linkedLocation.get('week')) || 0))
  const [day, setDay] = useState(Math.max(1, Number(linkedLocation.get('day')) || 1))
  const [view, setView] = useState<ReadingView>((linkedLocation.get('view') as ReadingView) || 'day')
  const [progress, setProgress] = useState<ProgressStore>(loadProgress)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [annotations, setAnnotations] = useState<HwmrAnnotation[]>(loadAnnotations)
  const [selectedQuote, setSelectedQuote] = useState('')
  const [selectedAnnotationDay, setSelectedAnnotationDay] = useState(1)
  const [annotationPopup, setAnnotationPopup] = useState({ x: 24, y: 24 })
  const [openedAnnotation, setOpenedAnnotation] = useState<HwmrAnnotation | null>(null)
  const [annotationNote, setAnnotationNote] = useState('')
  const [highlightColor, setHighlightColor] = useState<HighlightColor>('yellow')
  const [generatingArtifact, setGeneratingArtifact] = useState<StudyArtifact | null>(null)
  const [studyOutput, setStudyOutput] = useState('')
  const [studyOutputType, setStudyOutputType] = useState('')
  const [studyError, setStudyError] = useState('')
  const [studyArtifacts, setStudyArtifacts] = useState<StudyArtifact[]>(loadStudyArtifacts)
  const [newStudyArtifact, setNewStudyArtifact] = useState('')
  const [savedStudies, setSavedStudies] = useState<SavedStudy[]>(loadSavedStudies)
  const [hymnalHymns, setHymnalHymns] = useState<Hymn[]>([])
  const [ministryBooks, setMinistryBooks] = useState<MinistryBookSummary[]>([])
  const [readerZoom, setReaderZoom] = useState(loadReaderZoom)
  const [fullPage, setFullPage] = useState(false)
  const book = books.find((item) => item.id === selectedId) ?? null
  const week = book?.weeks[weekIndex]
  const portion = week?.days.find((item) => item.day === day)
  const bookProgress = book ? progress[book.id] : undefined
  const schedule = useMemo(() => book ? scheduleFor(book, bookProgress) : null, [book, bookProgress])
  const catalogBooks = useMemo(() => [...books].sort((left, right) => {
    const leftStarted = progress[left.id]?.lastStartedAt ?? progress[left.id]?.startedAt
    const rightStarted = progress[right.id]?.lastStartedAt ?? progress[right.id]?.startedAt
    if (leftStarted && rightStarted) return rightStarted.localeCompare(leftStarted)
    if (leftStarted) return -1
    if (rightStarted) return 1
    return 0
  }), [books, progress])
  const weekAnnotations = useMemo(() => book && week ? annotations.filter((item) => item.bookId === book.id && item.week === week.number) : [], [annotations, book, week])
  const weekStudies = useMemo(() => book && week ? savedStudies.filter((item) => item.bookId === book.id && item.week === week.number).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)) : [], [book, savedStudies, week])
  const completedDays = useMemo(() => week && bookProgress ? week.days.filter((item) => bookProgress.completed.includes(`${week.number}:${item.day}`)).length : 0, [bookProgress, week])
  const linkedHymn = useMemo(() => {
    const number = week?.hymn?.number?.toString().trim()
    if (!number) return null
    const matches = hymnalHymns.filter((item) => item.hymnNumber?.toString().trim() === number)
    return matches.find((item) => item.catalogPrefix?.toUpperCase() === 'H') ?? matches[0] ?? null
  }, [hymnalHymns, week])
  const furtherReadingLinks = useMemo(() => {
    if (!portion) return []
    return parseFurtherReadingReferences(`${portion.morningNourishment}\n${portion.todaysReading}`, ministryBooks)
  }, [ministryBooks, portion])
  useEffect(() => { document.body.classList.toggle('reader-full-page-active', fullPage); return () => document.body.classList.remove('reader-full-page-active') }, [fullPage])
  const readerStyle = { '--hwmr-reader-zoom': readerZoom / 100 } as CSSProperties

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    setError('')
    getHwmrLibrary(controller.signal)
      .then(({ books, audit }) => {
        if (active) { setBooks(books); setLibraryAudit(audit ?? null) }
      })
      .catch((reason: unknown) => {
        if (!active || controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : 'Unable to load HWMR.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [])

  useEffect(() => {
    if (!selectedId || hymnalHymns.length) return
    const controller = new AbortController()
    getHymnalLibrary(controller.signal).then((library) => setHymnalHymns(library.hymns)).catch(() => undefined)
    return () => controller.abort()
  }, [hymnalHymns.length, selectedId])

  useEffect(() => {
    if (!selectedId || ministryBooks.length) return
    const controller = new AbortController()
    getMinistryBooksLibrary(controller.signal).then((result) => setMinistryBooks(result.books ?? [])).catch(() => undefined)
    return () => controller.abort()
  }, [ministryBooks.length, selectedId])

  useEffect(() => {
    localStorage.setItem(READER_ZOOM_KEY, String(readerZoom))
  }, [readerZoom])

  useEffect(() => {
    const params = new URLSearchParams()
    if (selectedId) {
      params.set('book', selectedId)
      params.set('week', String(weekIndex))
      params.set('day', String(day))
      params.set('view', view)
    }
    const nextSearch = params.toString() ? `?${params.toString()}` : ''
    if (location.search !== nextSearch) navigate({ pathname: location.pathname, search: nextSearch }, { replace: true })
  }, [day, location.pathname, location.search, navigate, selectedId, view, weekIndex])

  function saveProgress(next: ProgressStore) { setProgress(next); localStorage.setItem(PROGRESS_KEY, JSON.stringify(next)) }
  function saveAnnotations(next: HwmrAnnotation[]) { setAnnotations(next); localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(next)) }
  function saveStudyArtifacts(next: StudyArtifact[]) { setStudyArtifacts(next); localStorage.setItem(STUDY_ARTIFACTS_KEY, JSON.stringify(next)) }
  function saveStudies(next: SavedStudy[]) { setSavedStudies(next); localStorage.setItem(SAVED_STUDIES_KEY, JSON.stringify(next)) }
  function addStudyArtifact() {
    const artifact = newStudyArtifact.replace(/\s+/g, ' ').trim()
    if (!artifact || studyArtifacts.some((item) => item.toLowerCase() === artifact.toLowerCase())) return
    saveStudyArtifacts([...studyArtifacts, artifact]); setNewStudyArtifact('')
  }
  function removeStudyArtifact(artifact: StudyArtifact) { saveStudyArtifacts(studyArtifacts.filter((item) => item !== artifact)) }
  function saveGeneratedStudy() {
    if (!book || !week || !studyOutput.trim()) return
    const now = new Date().toISOString()
    saveStudies([{ id: crypto.randomUUID(), bookId: book.id, week: week.number, title: studyOutputType || 'Weekly Study', content: studyOutput.trim(), createdAt: now, updatedAt: now }, ...savedStudies])
  }
  function updateSavedStudy(id: string, changes: Partial<Pick<SavedStudy, 'title' | 'content'>>) {
    saveStudies(savedStudies.map((item) => item.id === id ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item))
  }
  function deleteSavedStudy(id: string) { saveStudies(savedStudies.filter((item) => item.id !== id)) }
  function openSavedStudy(study: SavedStudy) { setStudyOutputType(study.title); setStudyOutput(study.content); setStudyError('') }
  function downloadSavedStudy(study: SavedStudy) {
    const safeTitle = study.title.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'HWMR Weekly Study'
    const content = `${book?.generalSubject ?? 'HWMR'}\nWeek ${study.week}\n${study.title}\n\n${study.content}`
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${safeTitle}.txt`; anchor.click(); URL.revokeObjectURL(url)
  }
  function printSavedStudy(study: SavedStudy) {
    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character)
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.opener = null
    printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(study.title)}</title><style>body{max-width:760px;margin:40px auto;padding:0 28px;color:#171717;font:16px/1.65 Georgia,serif}header{padding-bottom:18px;border-bottom:1px solid #bbb}h1{font:700 26px/1.25 Arial,sans-serif}small{font:13px Arial,sans-serif;color:#666}main{white-space:pre-wrap}@media print{body{margin:0;max-width:none}}</style></head><body><header><small>${escapeHtml(book?.generalSubject ?? 'HWMR')} · Week ${study.week}</small><h1>${escapeHtml(study.title)}</h1></header><main>${escapeHtml(study.content)}</main></body></html>`)
    printWindow.document.close(); printWindow.focus(); window.setTimeout(() => printWindow.print(), 150)
  }
  function startBook() {
    if (!book || book.structure === 'messages') return
    const startedAt = currentWeekMonday()
    const selectedWeek = Math.max(0, Math.min(book.weeks.length - 1, startWeekIndex))
    const next = { ...progress, [book.id]: { startedAt, startWeekIndex: selectedWeek, lastStartedAt: new Date().toISOString(), completed: progress[book.id]?.completed ?? [] } }
    const readingDay = currentReadingDay()
    saveProgress(next); setWeekIndex(selectedWeek); setDay(readingDay ?? 1); setView(readingDay ? 'day' : 'hymn')
  }
  function openScheduled() {
    if (!schedule) return
    setWeekIndex(schedule.weekIndex)
    if (schedule.day) { setDay(schedule.day); setView('day') } else setView('hymn')
  }
  async function openFurtherReading(item: FurtherReadingLink) {
    let targetChapter = item.section
    try {
      const result = await getMinistryBookChapters(item.book.id)
      const word = chapterWords[item.section]
      const heading = item.sectionKind === 'message' ? '(?:message|msg)' : 'chapter'
      const matching = result.chapters.find((chapter) => new RegExp(`^${heading}\\s+(?:${item.section}${word ? `|${word}` : ''})\\b`, 'i').test(chapter.title.trim()))
      if (matching) targetChapter = matching.number
    } catch { /* Open the cited numeric section when chapter metadata is unavailable. */ }
    const returnLocation = new URLSearchParams({ book: book?.id || '', week: String(weekIndex), day: String(day), view: 'day' })
    navigate(`/ministry-books?book=${encodeURIComponent(item.book.id)}&chapter=${targetChapter}&from=hwmr&return=${encodeURIComponent(returnLocation.toString())}`)
  }
  function toggleComplete() {
    if (!book || !week || !portion || !bookProgress) return
    const key = `${week.number}:${portion.day}`
    const completed = bookProgress.completed.includes(key) ? bookProgress.completed.filter((item) => item !== key) : [...bookProgress.completed, key]
    saveProgress({ ...progress, [book.id]: { ...bookProgress, completed } })
  }
  function moveDailyPortion(direction: -1 | 1) {
    if (!book || !week) return
    const currentDayIndex = week.days.findIndex((item) => item.day === day)
    const nextDayIndex = currentDayIndex + direction
    if (nextDayIndex >= 0 && nextDayIndex < week.days.length) setDay(week.days[nextDayIndex].day)
    else {
      const nextWeekIndex = weekIndex + direction
      if (nextWeekIndex < 0 || nextWeekIndex >= book.weeks.length) return
      const nextWeek = book.weeks[nextWeekIndex]
      setWeekIndex(nextWeekIndex)
      setDay(direction > 0 ? nextWeek.days[0]?.day ?? 1 : nextWeek.days.at(-1)?.day ?? 6)
    }
    setView('day'); setSelectedQuote(''); window.setTimeout(() => document.querySelector('.hwmr-reader-controls')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }
  async function copyPortion() {
    if (!portion || !book || !week) return
    const morningVerses = (portion.morningVerses ?? []).map((verse) => `${verse.reference}\n${verse.text}`).join('\n\n')
    await navigator.clipboard.writeText(`${book.generalSubject}\nWeek ${week.number} - Day ${portion.day}\n\nMorning Nourishment\n${morningVerses}${morningVerses ? '\n\n' : ''}${portion.morningNourishment}\n\nToday's Reading\n${portion.todaysReading}`)
    setCopied(true); window.setTimeout(() => setCopied(false), 1500)
  }

  async function checkHwmrPdfs() {
    setRefreshingLibrary(true)
    setLibraryRefreshMessage('')
    try {
      await refreshHwmrLibrary()
      const refreshed = await getHwmrLibrary()
      setBooks(refreshed.books)
      setLibraryAudit(refreshed.audit ?? null)
      setLibraryRefreshMessage('All HWMR PDFs passed verification.')
    } catch (reason) {
      setLibraryRefreshMessage(reason instanceof Error ? reason.message : 'The HWMR PDFs could not be verified.')
    } finally {
      setRefreshingLibrary(false)
    }
  }

  function captureSelection(event: React.MouseEvent<HTMLElement>, annotationDay = day) {
    const selection = window.getSelection(); const quote = selection?.toString().replace(/\s+/g, ' ').trim() ?? ''
    if (!quote || !selection?.anchorNode || !event.currentTarget.contains(selection.anchorNode)) return
    const popupWidth = Math.min(430, window.innerWidth - 24)
    const x = Math.max(12, Math.min(event.clientX + 10, window.innerWidth - popupWidth - 12))
    const y = Math.max(12, Math.min(event.clientY + 12, window.innerHeight - 230))
    setSelectedQuote(quote); setSelectedAnnotationDay(annotationDay); setAnnotationPopup({ x, y })
  }

  function addAnnotation() {
    if (!book || !week || !selectedQuote.trim()) return
    const next = [...annotations, { id: crypto.randomUUID(), bookId: book.id, week: week.number, day: selectedAnnotationDay, quote: selectedQuote.trim(), note: annotationNote.trim(), color: highlightColor, createdAt: new Date().toISOString() }]
    saveAnnotations(next); setSelectedQuote(''); setAnnotationNote(''); setView('study-notes'); window.getSelection()?.removeAllRanges()
  }

  function inlineAnnotationEditor(label: string) {
    if (!selectedQuote) return null
    return <div className="hwmr-inline-annotation" role="dialog" aria-label="Highlight and annotate selection" style={{ left: annotationPopup.x, top: annotationPopup.y }}>
      <div><Highlighter size={16} /><strong>{label}</strong><span>“{selectedQuote}”</span></div>
      <div className="hwmr-highlight-colors" aria-label="Highlight color">{(['yellow', 'green', 'blue', 'pink'] as HighlightColor[]).map((color) => <button type="button" aria-label={`${color} highlight`} className={`${color} ${highlightColor === color ? 'active' : ''}`} key={color} onClick={() => setHighlightColor(color)} />)}</div>
      <input value={annotationNote} onChange={(event) => setAnnotationNote(event.target.value)} placeholder="Add an optional annotation…" />
      <button type="button" className="save" onClick={addAnnotation}>Save highlight</button>
      <button type="button" className="cancel" onClick={() => { setSelectedQuote(''); setAnnotationNote(''); window.getSelection()?.removeAllRanges() }}>Cancel</button>
    </div>
  }

  function openSavedAnnotation(annotation: HwmrAnnotation, event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) {
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    const pointerX = 'clientX' in event ? event.clientX : rect.right
    const pointerY = 'clientY' in event ? event.clientY : rect.bottom
    const popupWidth = Math.min(430, window.innerWidth - 24)
    const x = Math.max(12, Math.min(pointerX + 10, window.innerWidth - popupWidth - 12))
    const y = Math.max(12, Math.min(pointerY + 12, window.innerHeight - 260))
    setSelectedQuote(''); setOpenedAnnotation(annotation); setAnnotationPopup({ x, y })
  }

  function savedAnnotationPopup() {
    if (!openedAnnotation) return null
    return <div className="hwmr-inline-annotation hwmr-saved-annotation" role="dialog" aria-label="Saved annotation" style={{ left: annotationPopup.x, top: annotationPopup.y }}>
      <div><Highlighter size={16} /><strong>{openedAnnotation.day === 0 ? 'Outline highlight' : `Day ${openedAnnotation.day} highlight`}</strong></div>
      <blockquote>“{openedAnnotation.quote}”</blockquote>
      {openedAnnotation.note ? <p>{openedAnnotation.note}</p> : <p className="empty">This highlight has no annotation.</p>}
      <button type="button" className="cancel" onClick={() => setOpenedAnnotation(null)}>Close</button>
    </div>
  }

  function deleteAnnotation(id: string) { saveAnnotations(annotations.filter((item) => item.id !== id)) }

  function highlightedText(text: string, annotationDay = day) {
    const matches = weekAnnotations.filter((item) => item.day === annotationDay).map((annotation) => ({ annotation, range: locateNormalizedQuote(text, annotation.quote) })).filter((item): item is { annotation: HwmrAnnotation; range: { start: number; end: number } } => Boolean(item.range)).sort((left, right) => left.range.start - right.range.start)
    return highlightedTextRange(text, 0, matches)
  }

  function highlightedTextRange(text: string, baseOffset: number, matches: { annotation: HwmrAnnotation; range: { start: number; end: number } }[]) {
    if (!matches.length) return text
    const nodes: React.ReactNode[] = []; let position = 0
    for (const { annotation, range } of matches) {
      const start = Math.max(0, range.start - baseOffset)
      const end = Math.min(text.length, range.end - baseOffset)
      if (end <= 0 || start >= text.length || start < position) continue
      nodes.push(text.slice(position, start)); nodes.push(<mark className={`hwmr-highlight ${annotation.color}`} title={annotation.note || 'Highlighted passage'} tabIndex={0} role="button" key={`${annotation.id}-${baseOffset}`} onClick={(event) => openSavedAnnotation(annotation, event)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openSavedAnnotation(annotation, event) }}>{text.slice(start, end)}</mark>); position = end
    }
    nodes.push(text.slice(position)); return nodes
  }

  async function generateStudyArtifact(artifact: StudyArtifact) {
    if (!book || !week || generatingArtifact) return
    setGeneratingArtifact(artifact); setStudyOutputType(artifact); setStudyOutput(''); setStudyError('')
    const source = [`GENERAL SUBJECT: ${book.generalSubject}`, `WEEK ${week.number}: ${week.title}`, `OUTLINE:\n${week.outline}`, ...week.days.map((item) => `DAY ${item.day}\nMORNING VERSES:\n${(item.morningVerses ?? []).map((verse) => `${verse.reference} ${verse.text}`).join('\n')}\nMORNING NOURISHMENT:\n${item.morningNourishment}\nTODAY'S READING:\n${item.todaysReading}`)].join('\n\n').slice(0, 52000)
    const annotationContext = weekAnnotations.length ? weekAnnotations.map((item) => `${item.day === 0 ? 'Weekly outline' : `Day ${item.day}`} highlight: “${item.quote}”${item.note ? `\nAnnotation: ${item.note}` : ''}`).join('\n\n') : 'No personal annotations have been added.'
    const prompt = `Using only the supplied HWMR week, create: ${artifact}. Give special consideration and priority to the reader's highlights and annotations while remaining faithful to the source. Do not invent quotations or teachings.\n\nREADER HIGHLIGHTS AND ANNOTATIONS:\n${annotationContext}\n\nHWMR SOURCE:\n${source}`
    let output = ''
    try {
      await streamAIOS(prompt, 'ministry', { onChunk: (chunk) => { output += chunk; setStudyOutput(output) }, onError: setStudyError, onDone: () => undefined }, 'hwmr')
    } catch (reason) { setStudyError(reason instanceof Error ? reason.message : 'Unable to create this study preparation.') }
    finally { setGeneratingArtifact(null) }
  }

  function openBibleReference(reference: ReturnType<typeof linkBibleReferences>[number]) {
    if (reference.type !== 'reference' || !book) return
    const returnQuery = new URLSearchParams({ book: book.id, week: String(weekIndex), day: String(day), view })
    navigate(`/recovery-bible?book=${encodeURIComponent(reference.bookSlug)}&chapter=${reference.chapter}&verse=${reference.verse}&verseEnd=${reference.verseEnd}&from=hwmr&return=${encodeURIComponent(returnQuery.toString())}`)
  }

  function formattedText(text: string, className = '') {
    text = repairHwmrReadingText(text)
    let bookContext = ''
    return <div className={`hwmr-formatted-text ${className}`}>{text.split(/\n{2,}/).filter(Boolean).map((paragraph, paragraphIndex) => {
      const segments = linkBibleReferences(paragraph, bookContext)
      const matches = weekAnnotations.filter((item) => item.day === day).map((annotation) => ({ annotation, range: locateNormalizedQuote(paragraph, annotation.quote) })).filter((item): item is { annotation: HwmrAnnotation; range: { start: number; end: number } } => Boolean(item.range)).sort((left, right) => left.range.start - right.range.start)
      bookContext = lastMentionedBibleBook(paragraph, bookContext)
      let paragraphOffset = 0
      return <p key={paragraphIndex}>{segments.map((segment, segmentIndex) => {
        const segmentText = segment.type === 'text' ? segment.text : segment.label
        const segmentStart = paragraphOffset
        paragraphOffset += segmentText.length
        if (segment.type === 'text') return <span key={segmentIndex}>{highlightedTextRange(segment.text, segmentStart, matches)}</span>
        const matchingAnnotation = matches.find(({ range }) => range.start < paragraphOffset && range.end > segmentStart)?.annotation
        return <button type="button" className={`hwmr-bible-link${matchingAnnotation ? ` hwmr-highlight ${matchingAnnotation.color}` : ''}`} title={matchingAnnotation?.note} key={segmentIndex} onClick={() => openBibleReference(segment)}>{segment.label}</button>
      })}{/further\s+reading/i.test(paragraph) && furtherReadingLinks.length ? <span className="hwmr-further-reading-links">{furtherReadingLinks.map((item) => <button type="button" key={`${item.book.id}-${item.sectionKind}-${item.section}`} onClick={() => void openFurtherReading(item)}><BookOpenText size={15} /> {item.label}</button>)}</span> : null}</p>
    })}</div>
  }

  function outlineText(text: string) {
    let bookContext = ''
    return <div className="hwmr-outline-content">{text.split('\n').filter(Boolean).map((line, index) => {
      const dayHeading = /^Day\s+\d+$/i.test(line)
      const major = /^[IVX]+\s*\./.test(line)
      const level = major ? 'major' : /^[A-Z]\s*\./.test(line) ? 'level-a' : /^\d+\s*\./.test(line) ? 'level-1' : /^[a-z]\s*\./.test(line) ? 'level-a-lower' : ''
      const segments = linkBibleReferences(line, bookContext)
      bookContext = lastMentionedBibleBook(line, bookContext)
      return dayHeading ? <h3 key={index}>{line}</h3> : <p className={level} key={index}>{segments.map((segment, segmentIndex) => segment.type === 'text' ? <span key={segmentIndex}>{highlightedText(segment.text, 0)}</span> : <button type="button" className="hwmr-bible-link" key={segmentIndex} onClick={() => openBibleReference(segment)}>{segment.label}</button>)}</p>
    })}</div>
  }

  function hymnText(text: string) {
    return <div className="hwmr-hymn-stanzas">{text.split(/\n{2,}/).filter(Boolean).map((stanza, index) => {
      const [first = '', ...rest] = stanza.split('\n'); const [number, opening = ''] = first.split('\t')
      return <div className="hwmr-hymn-stanza" key={index}><span>{number}</span><p>{[opening, ...rest].join('\n')}</p></div>
    })}</div>
  }

  const libraryVerification = libraryAudit ? <section className="hwmr-library-audit" aria-label="HWMR library verification"><Check size={17} /><div><strong>Library verified</strong><span>{libraryAudit.books} PDFs · {libraryAudit.dailyPortions} daily portions · {libraryAudit.morningVerses} Morning Nourishment verse blocks</span>{libraryRefreshMessage && <em>{libraryRefreshMessage}</em>}</div><time dateTime={libraryAudit.checkedAt}>Checked {new Date(libraryAudit.checkedAt).toLocaleString()}</time><button type="button" disabled={refreshingLibrary} onClick={() => void checkHwmrPdfs()}><RotateCcw size={14} /> {refreshingLibrary ? 'Checking…' : 'Check PDFs now'}</button></section> : null

  if (loading) return <section className="hwmr-state">Loading the structured HWMR library…</section>
  if (error) return <section className="hwmr-state error">{error}</section>
  if (!book) return <section className="hwmr-page"><header className="hwmr-header"><span><BookOpenText size={26} /></span><div><h1>Holy Word for Morning Revival</h1><p>Choose a book to begin or continue its Monday-based reading schedule.</p></div></header>{libraryVerification}<div className="hwmr-book-grid">{catalogBooks.map((item) => { const saved = progress[item.id]; const scheduled = scheduleFor(item, saved); const previewDay = currentReadingDay(); const initialWeek = scheduled?.weekIndex ?? saved?.startWeekIndex ?? 0; const totalDays = item.weeks.reduce((total, itemWeek) => total + itemWeek.days.length, 0); const completedCount = saved ? new Set(saved.completed).size : 0; const completionPercent = totalDays ? Math.min(100, (completedCount / totalDays) * 100) : 0; return <button type="button" key={item.id} onClick={() => { setSelectedId(item.id); setWeekIndex(initialWeek); setStartWeekIndex(initialWeek); setDay(scheduled?.day ?? previewDay ?? 1); setView(item.structure === 'messages' ? 'outline' : scheduled?.day || (!scheduled && previewDay) ? 'day' : 'hymn') }}><span>{item.structure === 'messages' ? 'CONFERENCE' : 'HWMR'}</span><h2>{item.generalSubject}</h2>{libraryAudit?.status === 'passed' && <span className="hwmr-card-verified"><Check size={13} /> PDF verified</span>}<dl><div><dt>Event</dt><dd>{item.event}</dd></div>{item.volume && <div><dt>Volume</dt><dd>{item.volume}</dd></div>}<div><dt>Author</dt><dd>{item.author}</dd></div><div><dt>Reading plan</dt><dd>{item.structure === 'messages' ? `${item.weeks.length} messages` : `${item.weeks.length} weeks · 6 days per week`}</dd></div></dl>{saved && item.structure !== 'messages' ? <div className="hwmr-card-progress"><div><span style={{ width: `${completionPercent}%` }} /></div><p><strong>{scheduled ? `Week ${item.weeks[scheduled.weekIndex]?.number}${scheduled.day ? ` · Day ${scheduled.day}` : ' · Hymn'}` : `Week ${item.weeks[initialWeek]?.number}`}</strong><small>{completedCount} of {totalDays} portions completed</small></p></div> : null}{saved ? <small><Check size={14} /> Started {new Date(`${saved.startedAt}T12:00:00`).toLocaleDateString()}</small> : <small>{item.structure === 'messages' ? 'Outline collection' : 'Not started'}</small>}</button> })}</div></section>

  const completionKey = week && portion ? `${week.number}:${portion.day}` : ''
  const completed = Boolean(completionKey && bookProgress?.completed.includes(completionKey))
  return <section className={`hwmr-page${fullPage ? ' reader-full-page' : ''}`} style={readerStyle}>
    <button type="button" className="hwmr-back" onClick={() => setSelectedId('')}><ArrowLeft size={16} /> All HWMR books</button>
    <div className="hwmr-page-zoom" aria-label="HWMR page controls"><button type="button" className="full-page" onClick={() => setFullPage((value) => !value)}>{fullPage ? <Minimize2 size={15} /> : <Maximize2 size={15} />} {fullPage ? 'Exit' : 'Full page'}</button><span>Page zoom</span><button type="button" aria-label="Zoom out" disabled={readerZoom <= 80} onClick={() => setReaderZoom((value) => Math.max(80, value - 10))}><ZoomOut size={15} /></button><output>{readerZoom}%</output><button type="button" aria-label="Zoom in" disabled={readerZoom >= 150} onClick={() => setReaderZoom((value) => Math.min(150, value + 10))}><ZoomIn size={15} /></button><button type="button" className="reset" disabled={readerZoom === 100} onClick={() => setReaderZoom(100)}>Reset</button></div>
    <header className="hwmr-book-header"><span>Holy Word for Morning Revival</span><h1>{book.generalSubject}</h1><div><small>{book.event}</small>{book.volume && <small>Volume {book.volume}</small>}<small>{book.author}</small><small>{book.pageCount} source pages</small></div></header>
    {book.structure === 'messages' ? <section className="hwmr-progress-card"><div><CalendarDays size={20} /><p>This conference volume is arranged by messages. Choose the message you want to read.</p></div></section> : <section className="hwmr-progress-card"><div><CalendarDays size={20} /><p>{bookProgress ? <>Reading plan started Monday, <strong>{new Date(`${bookProgress.startedAt}T12:00:00`).toLocaleDateString()}</strong>, at <strong>Week {book.weeks[bookProgress.startWeekIndex ?? 0]?.number}</strong>.</> : <>Choose the correct starting week. It will begin from this week’s Monday.</>}</p></div><div className="hwmr-start-week"><select aria-label="Starting week" value={startWeekIndex} onChange={(event) => setStartWeekIndex(Number(event.target.value))}>{book.weeks.map((item, index) => <option key={item.number} value={index}>Week {item.number}</option>)}</select></div>{bookProgress ? <><button type="button" onClick={openScheduled}><Play size={15} /> Today’s portion</button><button type="button" className="secondary" onClick={startBook}><RotateCcw size={14} /> Restart here</button></> : <button type="button" onClick={startBook}><Play size={15} /> Start this HWMR</button>}</section>}
    <div className="hwmr-reader-controls"><label>{book.structure === 'messages' ? 'Message' : 'Week'}<select value={weekIndex} onChange={(event) => { setWeekIndex(Number(event.target.value)); setView('outline') }}>{book.weeks.map((item, index) => <option key={item.number} value={index}>{book.structure === 'messages' ? 'Message' : 'Week'} {item.number} - {item.title}</option>)}</select></label><nav><button className={view === 'key-statements' ? 'active' : ''} type="button" onClick={() => setView('key-statements')}><KeyRound size={14} /> Key Statements</button><button className={view === 'outline' ? 'active' : ''} type="button" onClick={() => setView('outline')}>Outline</button>{book.structure !== 'messages' && week?.days.map((item) => { const dayComplete = Boolean(bookProgress?.completed.includes(`${week.number}:${item.day}`)); return <button className={`${view === 'day' && day === item.day ? 'active' : ''}${dayComplete ? ' completed' : ''}`} type="button" key={item.day} onClick={() => { setDay(item.day); setView('day') }}>{dayComplete && <Check size={13} />} Day {item.day}</button> })}{book.structure !== 'messages' && <button className={view === 'hymn' ? 'active' : ''} type="button" onClick={() => setView('hymn')}><Music2 size={14} /> Hymn</button>}<button className={view === 'study-notes' ? 'active' : ''} type="button" onClick={() => setView('study-notes')}><NotebookPen size={14} /> Annotations & Study</button></nav>{book.structure !== 'messages' && week && <div className={`hwmr-week-progress${completedDays === week.days.length && week.days.length ? ' complete' : ''}`}><div><span style={{ width: `${week.days.length ? (completedDays / week.days.length) * 100 : 0}%` }} /></div><small>{completedDays === week.days.length && week.days.length ? <><Check size={13} /> Week complete</> : `${completedDays} of ${week.days.length} daily portions completed`}</small></div>}</div>
    {view === 'key-statements' && <article className="hwmr-key-statements"><span>{book.event}</span><h2>{book.generalSubject}</h2><h3>Key Statements</h3>{book.keyStatements.length ? book.keyStatements.map((statement, index) => <p key={index}>{statement}</p>) : <p>No separate key-statements page is included in this volume.</p>}</article>}
    {view === 'outline' && week && <article className="hwmr-outline" onMouseUp={(event) => captureSelection(event, 0)}><span>{book.structure === 'messages' ? 'Message' : 'Week'} {week.number} - Outline</span><h2>{week.title}</h2>{outlineText(week.outline)}{selectedQuote && selectedAnnotationDay === 0 ? inlineAnnotationEditor('Outline selection') : null}</article>}
    {view === 'day' && week && portion && <article className="hwmr-daily" onMouseUp={captureSelection}><header><span>Week {week.number} - Day {portion.day}</span><h2>{week.title}</h2><small>Source pages {portion.pages[0]}-{portion.pages[1]}</small></header><section className="hwmr-nourishment"><h3>Morning Nourishment</h3><div className="hwmr-morning-verses">{(portion.morningVerses ?? []).map((verse, index) => <div key={index}><strong>{linkBibleReferences(verse.reference).map((segment, segmentIndex) => segment.type === 'text' ? <span key={segmentIndex}>{segment.text}</span> : <button type="button" className="hwmr-bible-link" key={segmentIndex} onClick={() => openBibleReference(segment)}>{segment.label}</button>)}</strong><p>{highlightedText(verse.text)}</p></div>)}</div>{formattedText(portion.morningNourishment, 'morning-commentary')}</section><section className="hwmr-todays-reading"><h3>Today’s Reading</h3>{formattedText(portion.todaysReading)}</section>{selectedQuote && selectedAnnotationDay === day ? inlineAnnotationEditor(`Day ${day} selection`) : null}<footer><div className="hwmr-day-navigation"><button type="button" disabled={weekIndex === 0 && day === week.days[0]?.day} onClick={() => moveDailyPortion(-1)}><ArrowLeft size={15} /> Previous portion</button><button type="button" disabled={weekIndex === book.weeks.length - 1 && day === week.days.at(-1)?.day} onClick={() => moveDailyPortion(1)}>Next portion <ArrowRight size={15} /></button></div><div className="hwmr-day-actions"><button type="button" onClick={() => void copyPortion()}><Clipboard size={15} /> {copied ? 'Copied' : 'Copy portion'}</button>{bookProgress && <button type="button" className={completed ? 'complete' : ''} onClick={toggleComplete}><Check size={15} /> {completed ? 'Completed' : 'Mark completed'}</button>}</div></footer></article>}
    {view === 'hymn' && week && <article className="hwmr-hymn"><span>Week {week.number} - Hymn</span><h2>{week.hymn?.number ? `Hymns, #${week.hymn.number}` : 'Weekly Hymn'}</h2>{linkedHymn && <button type="button" className="hwmr-open-hymnal" onClick={() => { const returnQuery = new URLSearchParams({ book: book.id, week: String(weekIndex), day: String(day), view: 'hymn' }); navigate(`/hymnal?hymn=${encodeURIComponent(linkedHymn.id)}&from=hwmr&return=${encodeURIComponent(returnQuery.toString())}`) }}><Music2 size={15} /> Open {linkedHymn.catalogPrefix} {linkedHymn.hymnNumber} in Hymnal <ExternalLink size={14} /></button>}{hymnText(week.hymn?.text || 'No hymn text was found for this week.')}</article>}
    {view === 'study-notes' && week && <article className="hwmr-study-workspace">
      <header><span>Week {week.number}</span><h2>Annotations & Weekly Study</h2><p>Highlights and annotations are included whenever AIOS prepares a study artifact for this week.</p></header>
      <section className="hwmr-annotation-editor"><h3><Highlighter size={18} /> Add highlight or annotation</h3>{selectedQuote ? <><small>{selectedAnnotationDay === 0 ? 'Weekly outline' : `Day ${selectedAnnotationDay}`}</small><blockquote>{selectedQuote}</blockquote></> : <p className="empty">Select text in the Outline or any Day tab, then return here to highlight and annotate it.</p>}<div className="hwmr-highlight-colors" aria-label="Highlight color">{(['yellow', 'green', 'blue', 'pink'] as HighlightColor[]).map((color) => <button type="button" aria-label={`${color} highlight`} className={`${color} ${highlightColor === color ? 'active' : ''}`} key={color} onClick={() => setHighlightColor(color)} />)}</div><textarea value={annotationNote} onChange={(event) => setAnnotationNote(event.target.value)} placeholder="Add your observation, burden, application, or question…" rows={4} /><button type="button" className="primary" disabled={!selectedQuote.trim()} onClick={addAnnotation}><Highlighter size={15} /> Save highlight & annotation</button></section>
      <section className="hwmr-week-annotations"><h3>Saved for Week {week.number} <span>{weekAnnotations.length}</span></h3>{weekAnnotations.length ? <div>{weekAnnotations.map((annotation) => <article key={annotation.id} className={`note ${annotation.color}`}><small>{annotation.day === 0 ? 'Outline' : `Day ${annotation.day}`}</small><blockquote>{annotation.quote}</blockquote>{annotation.note ? <p>{annotation.note}</p> : null}<button type="button" aria-label="Delete annotation" onClick={() => deleteAnnotation(annotation.id)}><Trash2 size={15} /></button></article>)}</div> : <p className="empty">No highlights or annotations saved for this week yet.</p>}</section>
      <section className="hwmr-study-generator"><h3><Sparkles size={18} /> Create from this week</h3><p>The whole week and your {weekAnnotations.length} saved annotation{weekAnnotations.length === 1 ? '' : 's'} will be considered.</p><div className="hwmr-artifact-buttons">{studyArtifacts.map((artifact) => <span className="hwmr-artifact-button" key={artifact}><button type="button" disabled={Boolean(generatingArtifact)} onClick={() => void generateStudyArtifact(artifact)}>{generatingArtifact === artifact ? 'Creating…' : artifact}</button><button type="button" className="remove" aria-label={`Remove ${artifact}`} disabled={Boolean(generatingArtifact)} onClick={() => removeStudyArtifact(artifact)}><X size={13} /></button></span>)}</div><div className="hwmr-add-artifact"><input value={newStudyArtifact} onChange={(event) => setNewStudyArtifact(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addStudyArtifact() }} placeholder="Add a preparation type…" /><button type="button" disabled={!newStudyArtifact.trim()} onClick={addStudyArtifact}><Plus size={15} /> Add preparation type</button></div>{studyError ? <p className="error">{studyError}</p> : null}{studyOutput ? <div className="hwmr-study-output"><div><strong>{studyOutputType || 'Generated study'}</strong><span><button type="button" onClick={saveGeneratedStudy}><Save size={14} /> Save to My Weekly Study</button><button type="button" onClick={() => void navigator.clipboard.writeText(studyOutput)}><Clipboard size={14} /> Copy</button></span></div><pre>{studyOutput}</pre></div> : null}</section>
      <section className="hwmr-saved-studies"><h3><NotebookPen size={18} /> My Weekly Study <span>{weekStudies.length}</span></h3>{weekStudies.length ? <div>{weekStudies.map((study) => <article key={study.id}><input value={study.title} aria-label="Study title" onChange={(event) => updateSavedStudy(study.id, { title: event.target.value })} /><textarea value={study.content} aria-label={`${study.title} content`} onChange={(event) => updateSavedStudy(study.id, { content: event.target.value })} rows={10} /><footer><small>Updated {new Date(study.updatedAt).toLocaleString()}</small><button type="button" onClick={() => openSavedStudy(study)}><BookOpenText size={14} /> Reopen</button><button type="button" onClick={() => void generateStudyArtifact(study.title)}><RotateCcw size={14} /> Regenerate</button><button type="button" onClick={() => void navigator.clipboard.writeText(study.content)}><Clipboard size={14} /> Copy</button><button type="button" onClick={() => downloadSavedStudy(study)}><Download size={14} /> Download</button><button type="button" onClick={() => printSavedStudy(study)}><Printer size={14} /> Print / PDF</button><button type="button" className="delete" onClick={() => deleteSavedStudy(study.id)}><Trash2 size={14} /> Delete</button></footer></article>)}</div> : <p className="empty">Generated materials saved for this week will appear here.</p>}</section>
    </article>}
    {savedAnnotationPopup()}
  </section>
}
