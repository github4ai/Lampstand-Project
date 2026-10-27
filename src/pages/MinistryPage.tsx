import { BookCopy, BookMarked, BookOpenText, Clapperboard, Download, Highlighter, History, LibraryBig, Music2, Search, Upload, type LucideIcon, NotebookText } from 'lucide-react'
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getMinistryLibrary, importMinistryFiles, type MinistryLibraryStatus, type MinistrySection } from '../api/ministry'
import '../styles/ministry-layout.css'

type MinistryCard = { id: string; title: string; description: string; path: string; Icon: LucideIcon; importSection?: MinistrySection }

const sections: MinistryCard[] = [
  { id: 'hwmr', title: 'HWMR', description: 'Read uploaded Holy Word for Morning Revival documents.', path: '/ministry/hwmr', Icon: NotebookText },
  { id: 'hymnal', title: 'Hymns', description: 'Browse the complete local hymn collection, lyrics, chords, piano sheets, and tunes.', path: '/hymnal', Icon: Music2 },
  { id: 'video-training', title: 'Video Training', description: 'Watch and add training videos and ministry documents stored on this computer.', path: '/ministry/video-training', Icon: Clapperboard },
  { id: 'recovery-bible', title: 'Recovery Bible', description: 'Bible text, outlines, authorized footnotes, and cross-references.', path: '/recovery-bible', Icon: BookOpenText, importSection: 'recovery-bible' },
  { id: 'life-study', title: 'Life-Study', description: 'Read locally stored Life-Study messages by Bible book.', path: '/life-study', Icon: BookMarked, importSection: 'life-study' },
  { id: 'ministry-books', title: 'Books', description: 'Browse all existing local ministry books by Watchman Nee and Witness Lee.', path: '/ministry-books', Icon: BookCopy, importSection: 'ministry-books' },
]

const importableSections = sections.flatMap((item) => item.importSection ? [{ id: item.id, title: item.title, section: item.importSection }] : [])

const ministryProgressKeys = [
  'aios-hwmr-reading-progress-v1', 'aios-hwmr-annotations-v1', 'aios-hwmr-study-artifacts-v1',
  'aios-hwmr-saved-studies-v1', 'aios-hwmr-reader-zoom-v1', 'aios-studio-hymnal-favorites-v1',
  'aios-studio-hymnal-recent-v1', 'aios-bible-location', 'aios-bible-font-size', 'aios-bible-footnotes',
  'aios-life-study-location',
  'aios-ministry-books-location',
]

function readJson<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback } catch { return fallback }
}

export default function MinistryPage() {
  const navigate = useNavigate()
  const [section, setSection] = useState<MinistrySection>('recovery-bible')
  const [files, setFiles] = useState<File[]>([])
  const [status, setStatus] = useState<MinistryLibraryStatus | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [dashboardKey, setDashboardKey] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const restoreInput = useRef<HTMLInputElement>(null)
  const refresh = useCallback(() => { void getMinistryLibrary().then(setStatus).catch(() => setStatus(null)) }, [])
  useEffect(refresh, [refresh])

  const dashboard = useMemo(() => {
    void dashboardKey
    const progress = readJson<Record<string, { startedAt?: string; lastStartedAt?: string; startWeekIndex?: number; completed?: string[] }>>('aios-hwmr-reading-progress-v1', {})
    const activeHwmr = Object.entries(progress).sort(([, left], [, right]) => String(right.lastStartedAt || right.startedAt || '').localeCompare(String(left.lastStartedAt || left.startedAt || '')))[0]
    const annotations = readJson<unknown[]>('aios-hwmr-annotations-v1', [])
    const studies = readJson<unknown[]>('aios-hwmr-saved-studies-v1', [])
    const favoriteHymns = readJson<string[]>('aios-studio-hymnal-favorites-v1', [])
    const recentHymns = readJson<string[]>('aios-studio-hymnal-recent-v1', [])
    const bible = (localStorage.getItem('aios-bible-location') || '').split(':')
    const lifeStudy = (localStorage.getItem('aios-life-study-location') || '').split(':')
    const ministryBook = (localStorage.getItem('aios-ministry-books-location') || '').split(':')
    return { activeHwmr, annotations: annotations.length, studies: studies.length, favoriteHymns, recentHymns,
      bibleBook: bible[0] || '', bibleChapter: Number(bible[1]) || 1,
      lifeStudyBook: lifeStudy[0] || '', lifeStudyMessage: Number(lifeStudy[1]) || 1,
      ministryBook: ministryBook[0] || '', ministryBookSection: Number(ministryBook[1]) || 1 }
  }, [dashboardKey])

  function downloadProgressBackup() {
    const data: Record<string, string | null> = {}
    ministryProgressKeys.forEach((key) => { data[key] = localStorage.getItem(key) })
    const blob = new Blob([JSON.stringify({ format: 'aios-ministry-progress', version: 1, exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a')
    anchor.href = url; anchor.download = `aios-ministry-progress-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url)
    setMessage('Ministry progress, favorites, annotations, and reading locations backed up.')
  }

  async function restoreProgressBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
    try {
      const backup = JSON.parse(await file.text()) as { format?: string; data?: Record<string, unknown> }
      if (backup.format !== 'aios-ministry-progress' || !backup.data) throw new Error('Invalid backup')
      ministryProgressKeys.forEach((key) => {
        const value = backup.data?.[key]
        if (typeof value === 'string') localStorage.setItem(key, value)
      })
      setDashboardKey((value) => value + 1); setMessage('Ministry progress restored. Open a reader to continue from its saved location.')
    } catch { setMessage('This is not a valid AIOS Ministry progress backup.') }
  }

  async function upload() {
    if (!files.length) return setMessage('Choose one or more authorized export files.')
    setBusy(true); setMessage('Importing authorized files…')
    try {
      const result = await importMinistryFiles(section, files)
      setMessage(`${result.imported} file${result.imported === 1 ? '' : 's'} imported successfully.`); setFiles([]); refresh()
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Import failed.') }
    finally { setBusy(false) }
  }

  return <div className="ministry-page">
    <header className="ministry-header"><span><LibraryBig size={26} /></span><div><h1>Ministry</h1><p>HWMR, Hymns, Video Training, Recovery Bible, Life-Study, and Ministry Books in one local library.</p></div></header>
    <form className="ministry-unified-search" onSubmit={(event) => { event.preventDefault(); if (searchQuery.trim()) navigate(`/knowledge/search?q=${encodeURIComponent(searchQuery.trim())}&category=Ministry&results=10&mode=semantic`) }}>
      <Search size={18} /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search across indexed Ministry resources…" aria-label="Search Ministry knowledge" /><button type="submit" disabled={!searchQuery.trim()}>Search Ministry</button>
    </form>
    <section className="ministry-progress-dashboard">
      <header><div><History size={19} /><h2>Continue reading</h2></div><div><button type="button" onClick={downloadProgressBackup}><Download size={15} /> Backup progress</button><button type="button" onClick={() => restoreInput.current?.click()}><Upload size={15} /> Restore</button><input ref={restoreInput} type="file" accept="application/json,.json" hidden onChange={restoreProgressBackup} /></div></header>
      <div className="ministry-continue-grid">
        {dashboard.activeHwmr ? <Link to={`/ministry/hwmr?book=${encodeURIComponent(dashboard.activeHwmr[0])}&week=${dashboard.activeHwmr[1].startWeekIndex ?? 0}&view=day`}><NotebookText size={20} /><span><strong>Continue HWMR</strong><small>{dashboard.activeHwmr[1].completed?.length ?? 0} portions completed</small></span></Link> : <Link to="/ministry/hwmr"><NotebookText size={20} /><span><strong>Start HWMR</strong><small>Choose a reading plan</small></span></Link>}
        {dashboard.bibleBook ? <Link to="/recovery-bible"><BookOpenText size={20} /><span><strong>Continue Recovery Bible</strong><small>Book {dashboard.bibleBook} · Chapter {dashboard.bibleChapter}</small></span></Link> : <Link to="/recovery-bible"><BookOpenText size={20} /><span><strong>Open Recovery Bible</strong><small>Start reading</small></span></Link>}
        {dashboard.lifeStudyBook ? <Link to={`/life-study?book=${encodeURIComponent(dashboard.lifeStudyBook)}&message=${dashboard.lifeStudyMessage}`}><BookMarked size={20} /><span><strong>Continue Life-Study</strong><small>{dashboard.lifeStudyBook.replaceAll('-', ' ')} · Message {dashboard.lifeStudyMessage}</small></span></Link> : <Link to="/life-study"><BookMarked size={20} /><span><strong>Open Life-Study</strong><small>Choose a message</small></span></Link>}
        {dashboard.ministryBook ? <Link to={`/ministry-books?book=${encodeURIComponent(dashboard.ministryBook)}&chapter=${dashboard.ministryBookSection}`}><BookCopy size={20} /><span><strong>Continue Books</strong><small>Reading section {dashboard.ministryBookSection}</small></span></Link> : <Link to="/ministry-books"><BookCopy size={20} /><span><strong>Open Books</strong><small>Browse all local books</small></span></Link>}
        {dashboard.recentHymns[0] ? <Link to={`/hymnal?hymn=${encodeURIComponent(dashboard.recentHymns[0])}`}><Music2 size={20} /><span><strong>Recent hymn</strong><small>{dashboard.recentHymns.length} recently viewed · {dashboard.favoriteHymns.length} favorites</small></span></Link> : <Link to="/hymnal"><Music2 size={20} /><span><strong>Open Hymns</strong><small>Browse the complete local hymn collection</small></span></Link>}
      </div>
      <div className="ministry-progress-summary"><span><Highlighter size={15} /><strong>{dashboard.annotations}</strong> HWMR highlights and annotations</span><span><BookMarked size={15} /><strong>{dashboard.studies}</strong> saved weekly studies</span><span><Music2 size={15} /><strong>{dashboard.favoriteHymns.length}</strong> favorite hymns</span></div>
    </section>
    <section className="ministry-sections" aria-label="Ministry library sections">
      {[sections.slice(0, 3), sections.slice(3)].map((row, rowIndex) => <div className="ministry-section-row" key={rowIndex}>{row.map(({ id, title, description, path, Icon, importSection }) => <Link to={path} className="ministry-section-card" key={id}>
          <span><Icon size={24} /></span><div><h2>{title}</h2><p>{description}</p>{importSection && <small>{status?.sections[importSection].imports ?? 0} authorized imports</small>}</div>
        </Link>)}</div>)}
    </section>
    <section className="ministry-importer">
      <div><h2>Import authorized library export</h2><p>Add HTML, HTM, JSON, or XML files that you are permitted to store locally.</p></div>
      <div className="ministry-import-controls">
        <label>Library section<select value={section} onChange={(event) => setSection(event.target.value as MinistrySection)}>{importableSections.map((item) => <option key={item.id} value={item.section}>{item.title}</option>)}</select></label>
        <label className="ministry-file-picker"><span>Export files</span><input type="file" multiple accept=".html,.htm,.json,.xml,text/html,application/json,application/xml,text/xml" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /><small>{files.length ? `${files.length} selected` : 'Choose one or more files'}</small></label>
        <button type="button" onClick={() => void upload()} disabled={busy || !files.length}><Upload size={17} />{busy ? 'Importing…' : 'Import files'}</button>
      </div>
      {message && <p className="ministry-import-message" role="status">{message}</p>}
    </section>
  </div>
}
