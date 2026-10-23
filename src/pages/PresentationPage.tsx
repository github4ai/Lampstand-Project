import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, Clock3, Copy, Download, Eye, EyeOff, FileText, MonitorUp, Music2, Plus, Radio, RotateCcw, SkipBack, SkipForward, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import PresentOnDisplay, { presentOnSavedDisplay } from '../components/PresentOnDisplay'
import { getHwmrLibrary, type HwmrBook } from '../api/hwmr'
import { getMinistryBookChapter, getMinistryBookChapters, getMinistryBooksLibrary, type MinistryBookSummary, type MinistryChapterSummary } from '../api/ministryBooks'
import { getRecoveryBibleBooks, getRecoveryBibleChapter, type BibleBook, type BibleVerse } from '../api/recoveryBible'
import { getHymnalLibrary } from '../api/hymnal'
import type { Hymn } from '../types/hymnal'
import './PresentationPage.css'
import './PresentationPageEnhancements.css'
import './PresentationStudioRack.css'

type SourceKind = 'bible' | 'hymnal' | 'hwmr' | 'ministry' | 'custom'
type QueueItem = { id: string; kind: SourceKind; title: string; subtitle: string; html: string; notes: string }
type SelectedBibleVerse = { id: string; bookId: string; bookName: string; chapter: number; number: number; text: string }
const STORAGE_KEY = 'lampstand.presentation.workspace.v1'

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!))
const paragraphs = (value: string) => value.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean).map((part) => `<p>${escapeHtml(part).replace(/\n/g, '<br>')}</p>`).join('')
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

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
  const [hymns, setHymns] = useState<Hymn[]>([])
  const [hymnId, setHymnId] = useState('')
  const [hymnSearch, setHymnSearch] = useState('')
  const [hwmrBooks, setHwmrBooks] = useState<HwmrBook[]>([])
  const [hwmrBookId, setHwmrBookId] = useState('')
  const [hwmrWeek, setHwmrWeek] = useState(1)
  const [hwmrPortion, setHwmrPortion] = useState('day-1')
  const [ministryBooks, setMinistryBooks] = useState<MinistryBookSummary[]>([])
  const [ministryBookId, setMinistryBookId] = useState('')
  const [ministrySections, setMinistrySections] = useState<MinistryChapterSummary[]>([])
  const [ministrySection, setMinistrySection] = useState(1)
  const [customTitle, setCustomTitle] = useState('Meeting portion')
  const [customText, setCustomText] = useState('')
  const [notes, setNotes] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [message, setMessage] = useState('')
  const [liveId, setLiveId] = useState<string | null>(null)
  const [showTitle, setShowTitle] = useState(true)
  const [fontScale, setFontScale] = useState(1)
  const [projectionTheme, setProjectionTheme] = useState<'light' | 'dark'>('light')
  const [liveTransition, setLiveTransition] = useState<'none' | 'fade'>('fade')
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(queue)) }, [queue])
  useEffect(() => { if (current >= queue.length) setCurrent(Math.max(0, queue.length - 1)) }, [current, queue.length])
  useEffect(() => { void Promise.all([getRecoveryBibleBooks(), getHymnalLibrary(), getHwmrLibrary(), getMinistryBooksLibrary()]).then(([bible, hymnal, hwmr, ministry]) => { setBooks(bible.books); setBookId(bible.books[0]?.id ?? ''); setHymns(hymnal.hymns); setHymnId(hymnal.hymns[0]?.id ?? ''); setHwmrBooks(hwmr.books); setHwmrBookId(hwmr.books[0]?.id ?? ''); setMinistryBooks(ministry.books); setMinistryBookId(ministry.books[0]?.id ?? '') }).catch((error: Error) => setMessage(error.message)) }, [])
  useEffect(() => { if (!bookId) return; void getRecoveryBibleChapter(bookId, chapter).then((result) => setVerses(result.verses)).catch((error: Error) => setMessage(error.message)) }, [bookId, chapter])
  useEffect(() => { if (!ministryBookId) return; void getMinistryBookChapters(ministryBookId).then((result) => { setMinistrySections(result.chapters); setMinistrySection(result.chapters[0]?.number ?? 1) }).catch((error: Error) => setMessage(error.message)) }, [ministryBookId])
  useEffect(() => { if (!timerRunning) return; const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000); return () => window.clearInterval(timer) }, [timerRunning])

  const selectedBook = books.find((item) => item.id === bookId)
  const selectedHymn = hymns.find((item) => item.id === hymnId)
  const visibleHymns = hymns.filter((hymn) => `${hymn.catalogPrefix ?? ''} ${hymn.hymnNumber ?? ''} ${hymn.title}`.toLowerCase().includes(hymnSearch.trim().toLowerCase())).slice(0, 100)
  const selectedHwmr = hwmrBooks.find((item) => item.id === hwmrBookId)
  const selectedWeek = selectedHwmr?.weeks.find((item) => item.number === hwmrWeek) ?? selectedHwmr?.weeks[0]
  const active = queue[current]
  const liveIndex = queue.findIndex((item) => item.id === liveId)
  const liveItem = liveIndex >= 0 ? queue[liveIndex] : undefined
  const timerText = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`

  function addItem(item: Omit<QueueItem, 'id'>) { setQueue((items) => [...items, { ...item, id: makeId() }]); setCurrent(queue.length); setMessage('Added to the presentation queue.') }
  function move(index: number, direction: -1 | 1) { const next = index + direction; if (next < 0 || next >= queue.length) return; setQueue((items) => { const copy = [...items]; [copy[index], copy[next]] = [copy[next], copy[index]]; return copy }); setCurrent(next) }
  function updateActiveNotes(value: string) { setNotes(value); if (active) setQueue((items) => items.map((item, index) => index === current ? { ...item, notes: value } : item)) }

  async function takeLive(index = current) {
    const item = queue[index]
    if (!item) return
    const opened = await presentOnSavedDisplay({ title: item.title, subtitle: item.subtitle, html: item.html, showTitle, fontScale, theme: projectionTheme, transition: liveTransition })
    if (opened) { setLiveId(item.id); setMessage(`Live: ${item.title}`) }
  }
  async function stepLive(direction: -1 | 1) {
    const base = liveIndex >= 0 ? liveIndex : current
    const next = Math.min(queue.length - 1, Math.max(0, base + direction))
    setCurrent(next); setNotes(queue[next]?.notes ?? '')
    await takeLive(next)
  }
  async function blankOutput() {
    if (await presentOnSavedDisplay({ title: 'Lampstand Project', html: '', blank: true })) { setLiveId(null); setMessage('Audience screen blanked.') }
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

  function addBible() {
    if (!selectedVerses.length) return
    const references = selectedVerses.map((verse) => `${verse.bookName} ${verse.chapter}:${verse.number}`)
    addItem({ kind: 'bible', title: bibleSlideTitle.trim() || 'Scripture Reading', subtitle: references.join(' · '), html: selectedVerses.map((verse) => `<p><strong>${escapeHtml(`${verse.bookName} ${verse.chapter}:${verse.number}`)}</strong> ${escapeHtml(verse.text)}</p>`).join(''), notes: '' })
  }
  function toggleBibleVerse(verse: BibleVerse) {
    if (!selectedBook) return
    const id = `${selectedBook.id}-${chapter}-${verse.number}`
    setSelectedVerses((items) => items.some((item) => item.id === id)
      ? items.filter((item) => item.id !== id)
      : [...items, { id, bookId: selectedBook.id, bookName: selectedBook.name, chapter, number: verse.number, text: verse.text }])
  }
  function addHymn() {
    if (!selectedHymn) return
    const catalog = [selectedHymn.catalogPrefix, selectedHymn.hymnNumber].filter(Boolean).join(' ')
    const html = selectedHymn.sections.map((section) => `<section><h3>${escapeHtml(section.label)}</h3>${section.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}</section>`).join('')
    addItem({ kind: 'hymnal', title: selectedHymn.title, subtitle: [catalog, selectedHymn.author].filter(Boolean).join(' · '), html, notes: '' })
  }
  function addHwmr() {
    if (!selectedHwmr || !selectedWeek) return
    if (hwmrPortion === 'outline') addItem({ kind: 'hwmr', title: `Week ${selectedWeek.number} — ${selectedWeek.title}`, subtitle: selectedHwmr.title, html: paragraphs(selectedWeek.outline), notes: '' })
    else if (hwmrPortion === 'hymn' && selectedWeek.hymn) addItem({ kind: 'hwmr', title: `Week ${selectedWeek.number} hymn ${selectedWeek.hymn.number}`, subtitle: selectedWeek.title, html: paragraphs(selectedWeek.hymn.text), notes: '' })
    else { const dayNumber = Number(hwmrPortion.replace('day-', '')); const day = selectedWeek.days.find((item) => item.day === dayNumber); if (!day) return; addItem({ kind: 'hwmr', title: `Week ${selectedWeek.number} — Day ${day.day}`, subtitle: selectedWeek.title, html: `${day.morningVerses.map((verse) => `<p><strong>${escapeHtml(verse.reference)}</strong> ${escapeHtml(verse.text)}</p>`).join('')}${paragraphs(day.morningNourishment)}${paragraphs(day.todaysReading)}`, notes: '' }) }
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
        <div className="rack-label"><span>SOURCE RACK</span><small>INPUT</small></div><div className="section-heading"><div><h2>Load a source</h2><p>Add Bible verses, HWMR, Ministry Books, or any pasted text.</p></div><span>{queue.length} cued</span></div>
        <div className="source-tabs" role="tablist">{(['bible','hymnal','hwmr','ministry','custom'] as SourceKind[]).map((kind) => <button key={kind} className={source === kind ? 'active' : ''} onClick={() => setSource(kind)}>{kind === 'bible' ? 'Recovery Bible' : kind === 'hymnal' ? 'Hymnal' : kind === 'hwmr' ? 'HWMR' : kind === 'ministry' ? 'Ministry Books' : 'Custom portion'}</button>)}</div>
        {source === 'bible' && <div className="source-form"><label>Display heading<input value={bibleSlideTitle} onChange={(event) => setBibleSlideTitle(event.target.value)} placeholder="Scripture Reading" /></label><div className="field-row"><label>Book<select value={bookId} onChange={(e) => { setBookId(e.target.value); setChapter(1) }}>{books.map((book) => <option key={book.id} value={book.id}>{book.name}</option>)}</select></label><label>Chapter<select value={chapter} onChange={(e) => setChapter(Number(e.target.value))}>{Array.from({ length: selectedBook?.chapters ?? 1 }, (_, index) => <option key={index + 1}>{index + 1}</option>)}</select></label></div><p className="basket-help">Selections remain in the basket when you change books or chapters.</p><div className="verse-picker">{verses.map((verse) => { const verseId = `${selectedBook?.id}-${chapter}-${verse.number}`; return <label key={verse.number}><input type="checkbox" checked={selectedVerses.some((item) => item.id === verseId)} onChange={() => toggleBibleVerse(verse)}/><strong>{verse.number}</strong><span>{verse.text}</span></label> })}</div>{selectedVerses.length > 0 && <div className="verse-basket"><div><strong>Verse basket</strong><button type="button" onClick={() => setSelectedVerses([])}>Clear all</button></div>{selectedVerses.map((verse) => <button type="button" key={verse.id} onClick={() => setSelectedVerses((items) => items.filter((item) => item.id !== verse.id))}>{verse.bookName} {verse.chapter}:{verse.number}<X size={13}/></button>)}</div>}<button className="primary-action" disabled={!selectedVerses.length} onClick={addBible}><Plus size={17}/> Add {selectedVerses.length} selected verse{selectedVerses.length === 1 ? '' : 's'} as one slide</button></div>}
        {source === 'hymnal' && <div className="source-form"><label>Find hymn<input type="search" value={hymnSearch} onChange={(e) => setHymnSearch(e.target.value)} placeholder="Search by hymn number or title"/></label><label>Hymn<select value={hymnId} onChange={(e) => setHymnId(e.target.value)}>{visibleHymns.map((hymn) => <option key={hymn.id} value={hymn.id}>{[hymn.catalogPrefix, hymn.hymnNumber].filter(Boolean).join(' ')} {hymn.title}</option>)}</select></label>{selectedHymn && <div className="hymn-source-preview"><strong>{selectedHymn.title}</strong><span>{selectedHymn.sections.length} section{selectedHymn.sections.length === 1 ? '' : 's'} · complete lyrics will be added</span></div>}<button className="primary-action" disabled={!selectedHymn} onClick={addHymn}><Music2 size={17}/> Add complete hymn</button></div>}
        {source === 'hwmr' && <div className="source-form"><label>HWMR book<select value={hwmrBookId} onChange={(e) => { setHwmrBookId(e.target.value); setHwmrWeek(1) }}>{hwmrBooks.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label><div className="field-row"><label>Week<select value={hwmrWeek} onChange={(e) => setHwmrWeek(Number(e.target.value))}>{selectedHwmr?.weeks.map((week) => <option key={week.number} value={week.number}>Week {week.number}: {week.title}</option>)}</select></label><label>Portion<select value={hwmrPortion} onChange={(e) => setHwmrPortion(e.target.value)}><option value="outline">Week outline</option>{selectedWeek?.days.map((day) => <option key={day.day} value={`day-${day.day}`}>Day {day.day}</option>)}{selectedWeek?.hymn && <option value="hymn">Weekly hymn</option>}</select></label></div><button className="primary-action" onClick={addHwmr}><Plus size={17}/> Add HWMR portion</button></div>}
        {source === 'ministry' && <div className="source-form"><label>Book<select value={ministryBookId} onChange={(e) => setMinistryBookId(e.target.value)}>{ministryBooks.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label><label>Section<select value={ministrySection} onChange={(e) => setMinistrySection(Number(e.target.value))}>{ministrySections.map((section) => <option key={section.number} value={section.number}>{section.displayTitle || section.title}</option>)}</select></label><button className="primary-action" onClick={() => void addMinistry()}><Plus size={17}/> Add ministry section</button></div>}
        {source === 'custom' && <div className="source-form"><label>Title<input value={customTitle} onChange={(e) => setCustomTitle(e.target.value)}/></label><label>Text<textarea rows={10} value={customText} onChange={(e) => setCustomText(e.target.value)} placeholder="Paste an announcement, burden, outline, or meeting text…"/></label><button className="primary-action" disabled={!customText.trim()} onClick={() => { addItem({ kind: 'custom', title: customTitle || 'Meeting portion', subtitle: 'Custom presentation', html: paragraphs(customText), notes: '' }); setCustomText('') }}><Plus size={17}/> Add custom portion</button></div>}
      </section>

      <section className="presentation-console panel-card">
        <div className="rack-label program"><span>PROGRAM OUTPUT</span><small>LIVE</small></div><div className="section-heading"><div><h2>Projector control</h2><p>Preview privately, then update the same audience window.</p></div><div className="meeting-timer"><Clock3 size={16}/><strong>{timerText}</strong><button onClick={() => setTimerRunning((value) => !value)}>{timerRunning ? 'Pause' : 'Start'}</button><button aria-label="Reset timer" onClick={() => { setElapsed(0); setTimerRunning(false) }}><RotateCcw size={14}/></button></div></div>
        {active ? <>
          <div className="program-status">
            <div className="status-channel preview-channel"><small>PREVIEW</small><strong>{active.title}</strong><span>{current + 1} of {queue.length}</span></div>
            <div className={`status-channel live-channel ${liveItem ? 'on-air' : ''}`}><small>{liveItem ? 'LIVE' : 'AUDIENCE'}</small><strong>{liveItem?.title ?? 'Blank output'}</strong><span>{liveItem ? `${liveIndex + 1} of ${queue.length}` : 'Projector is blank'}</span></div>
          </div>
          <div className="current-item"><span>{current + 1} / {queue.length}</span><small>{active.kind.replace('-', ' ')}</small><h3>{active.title}</h3><p>{active.subtitle}</p></div>
          <div className="present-controls"><button disabled={current === 0} onClick={() => { setCurrent((value) => value - 1); setNotes(queue[current - 1]?.notes ?? '') }}><ArrowLeft size={16}/> Previous preview</button><PresentOnDisplay title={active.title} subtitle={active.subtitle} html={active.html} showTitle={showTitle} fontScale={fontScale} theme={projectionTheme} transition={liveTransition} onPresented={() => setLiveId(active.id)}/><button disabled={current === queue.length - 1} onClick={() => { setCurrent((value) => value + 1); setNotes(queue[current + 1]?.notes ?? '') }}>Next preview <ArrowRight size={16}/></button></div>
          <div className="live-controls"><button disabled={liveIndex <= 0} onClick={() => void stepLive(-1)}><SkipBack size={16}/> Previous live</button><button className="take-live" onClick={() => void takeLive()}><Radio size={16}/> Take preview live</button><button disabled={liveIndex < 0 || liveIndex >= queue.length - 1} onClick={() => void stepLive(1)}>Next live <SkipForward size={16}/></button><button onClick={() => void blankOutput()}><EyeOff size={16}/> Blank</button></div>
          <div className="output-options"><label><input type="checkbox" checked={showTitle} onChange={(event) => setShowTitle(event.target.checked)}/>{showTitle ? <Eye size={15}/> : <EyeOff size={15}/>} Show title on audience screen</label><label>Audience text size<select value={fontScale} onChange={(event) => setFontScale(Number(event.target.value))}><option value={0.9}>Small</option><option value={1}>Normal</option><option value={1.15}>Large</option><option value={1.3}>Extra large</option><option value={1.45}>Very large</option><option value={1.6}>Huge</option><option value={1.8}>Extra huge</option><option value={2}>Maximum</option></select></label><label>Projection theme<select value={projectionTheme} onChange={(event) => setProjectionTheme(event.target.value as 'light' | 'dark')}><option value="light">Light</option><option value="dark">Dark</option></select></label><label>Live transition<select value={liveTransition} onChange={(event) => setLiveTransition(event.target.value as 'none' | 'fade')}><option value="fade">Fade</option><option value="none">None</option></select></label><span className="shortcut-hint">Ctrl+Enter: take live · B: blank · ←/→: preview</span></div>
          <div className="presentation-preview"><div><header><span>{active.subtitle}</span><h2>{active.title}</h2></header><article dangerouslySetInnerHTML={{ __html: active.html }}/></div></div><label className="speaker-notes">Presenter notes <small>Private — never shown to the audience</small><textarea rows={4} value={notes || active.notes} onChange={(e) => updateActiveNotes(e.target.value)} placeholder="Talking points, timing, or reminders…"/></label>
        </> : <div className="empty-console"><MonitorUp size={42}/><h3>Your presentation is empty</h3><p>Add Recovery Bible verses, hymns, HWMR portions, ministry-book sections, or custom text.</p></div>}
      </section>
    </div>
    <section className="presentation-queue panel-card"><div className="section-heading"><div><h2>Run of show</h2><p>Arrange the complete meeting flow. Your program is saved automatically.</p></div><div className="queue-heading-actions"><input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(event) => { void importShow(event.target.files?.[0]); event.currentTarget.value = '' }}/><button onClick={() => importRef.current?.click()}><Upload size={16}/> Import show</button>{queue.length > 0 && <><button onClick={exportShow}><Download size={16}/> Export show</button><button className="danger-quiet" onClick={() => { if (confirm('Clear the complete presentation queue?')) { setQueue([]); setLiveId(null) } }}><Trash2 size={16}/> Clear all</button></>}</div></div><div className="queue-list">{queue.map((item, index) => <button key={item.id} className={`queue-item ${index === current ? 'active' : ''} ${item.id === liveId ? 'live' : ''}`} onClick={() => { setCurrent(index); setNotes(item.notes) }}><span className="queue-number">{index + 1}</span><span className="queue-source">{item.kind === 'hymnal' ? <Music2/> : item.kind === 'bible' ? <BookOpen/> : item.kind === 'hwmr' ? <FileText/> : item.kind === 'ministry' ? <BookOpen/> : <FileText/>}</span><span className="queue-copy"><strong>{item.title}</strong><small>{item.subtitle}</small></span>{item.id === liveId && <span className="live-pill">LIVE</span>}<span className="queue-actions"><span role="button" tabIndex={0} aria-label="Move up" onClick={(e) => { e.stopPropagation(); move(index, -1) }}><ArrowUp/></span><span role="button" tabIndex={0} aria-label="Move down" onClick={(e) => { e.stopPropagation(); move(index, 1) }}><ArrowDown/></span><span role="button" tabIndex={0} aria-label="Duplicate" onClick={(e) => { e.stopPropagation(); setQueue((items) => [...items.slice(0, index + 1), { ...item, id: makeId() }, ...items.slice(index + 1)]) }}><Copy/></span><span role="button" tabIndex={0} aria-label="Delete" onClick={(e) => { e.stopPropagation(); setQueue((items) => items.filter((_, itemIndex) => itemIndex !== index)) }}><Trash2/></span></span></button>)}</div></section>
  </section>
}
