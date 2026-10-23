import { ArrowLeft, BookOpen, Check, Clipboard, Clock3, Download, ExternalLink, FileUp, Heart, Languages, LayoutGrid, List, Maximize2, Minimize2, Music2, Pencil, Plus, Printer, Search, Tag, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import WorkspaceLayout from '../layouts/WorkspaceLayout'
import PianoSheet from '../components/Hymnal/PianoSheet'
import TunePlayer from '../components/Hymnal/TunePlayer'
import HymnEditor from '../components/Hymnal/HymnEditor'
import { HYMNS } from '../data/hymns'
import { CHROMATIC_KEYS, extractChords, semitonesBetween, stripChords, transposeChordLine } from '../utils/chords'
import { parseHymnImport } from '../utils/importHymn'
import type { Hymn } from '../types/hymnal'
import { getRelatedHymns } from '../utils/relatedHymns'
import { getHymnalLibrary, importHymnalMirror } from '../api/hymnal'
import { firstLyricLine, matchesCatalogSearch, matchesHymnCollection } from '../utils/hymnBrowse'

const FAVORITES_KEY = 'aios-studio-hymnal-favorites-v1'
const IMPORTED_KEY = 'aios-studio-imported-hymns-v1'
const RECENT_KEY = 'aios-studio-hymnal-recent-v1'
function loadImportedHymns(): Hymn[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(IMPORTED_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((item): item is Hymn =>
      typeof item === 'object' && item !== null && typeof item.title === 'string' &&
      typeof item.id === 'string' && Array.isArray(item.sections)) : []
  } catch { return [] }
}

function loadFavorites(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function loadRecent(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 20) : []
  } catch { return [] }
}

function HymnalPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const hwmrReturn = new URLSearchParams(location.search).get('from') === 'hwmr' ? new URLSearchParams(location.search).get('return') : null
  const sheetRef = useRef<HTMLElement | null>(null)
  const libraryHymnsRef = useRef<Hymn[]>([])
  const [view, setView] = useState<'lyrics' | 'chords' | 'piano' | 'guitar'>('chords')
  const [query, setQuery] = useState('')
  const [hymns, setHymns] = useState(() => loadImportedHymns().length ? loadImportedHymns() : HYMNS.slice(0, 1))
  const [importStatus, setImportStatus] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingHymn, setEditingHymn] = useState<Hymn | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [favorites, setFavorites] = useState(loadFavorites)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [recentOnly, setRecentOnly] = useState(false)
  const [recentIds, setRecentIds] = useState(loadRecent)
  const [collectionFilter, setCollectionFilter] = useState('all')
  const [catalogSort, setCatalogSort] = useState<'catalog' | 'title'>('catalog')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [catalogView, setCatalogView] = useState<'list' | 'cards'>('list')
  const [copiedArrangement, setCopiedArrangement] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [libraryCount, setLibraryCount] = useState(0)
  const [libraryBusy, setLibraryBusy] = useState(false)
  const [targetKey, setTargetKey] = useState(HYMNS[0].originalKey)
  const [capo, setCapo] = useState(0)
  const selected = hymns.find((hymn) => hymn.id === selectedId) ?? hymns[0]
  const showCatalog = selectedId === null || query.trim() !== '' || favoritesOnly || recentOnly || collectionFilter !== 'all' || categoryFilter !== 'all'
  const availableCategories = useMemo(() => [...new Set(hymns.map((hymn) => hymn.category).filter((value): value is string => Boolean(value)))]
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' })), [hymns])

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
  }, [favorites])

  useEffect(() => {
    if (new URLSearchParams(location.search).get('hymn')) window.scrollTo({ top: 0, left: 0 })
  }, [location.search])

  useEffect(() => {
    const controller = new AbortController()
    getHymnalLibrary(controller.signal).then((library) => {
      libraryHymnsRef.current = library.hymns
      setLibraryCount(library.hymns.length)
      setHymns([...loadImportedHymns(), ...library.hymns])
      const linkedId = new URLSearchParams(location.search).get('hymn')
      const linkedHymn = library.hymns.find((hymn) => hymn.id === linkedId)
      if (linkedHymn) {
        setSelectedId(linkedHymn.id)
        setTargetKey(linkedHymn.originalKey)
        setCapo(0)
      }
    }).catch(() => { /* Built-in hymns remain available when the local service is offline. */ })
    return () => controller.abort()
  }, [location.search])

  async function importLocalMirror() {
    const defaultPath = 'I:\\AI\\Libraries\\HymnalNet\\www.hymnal.net'
    const root = window.prompt('Hymnal.net folder location', defaultPath)
    if (!root) return
    setLibraryBusy(true)
    setImportStatus('Importing the local Hymnal archive. This may take a few minutes…')
    try {
      const result = await importHymnalMirror(root)
      const library = await getHymnalLibrary()
      libraryHymnsRef.current = library.hymns
      setLibraryCount(library.hymns.length)
      setHymns([...loadImportedHymns(), ...library.hymns])
      setSelectedId(null)
      setImportStatus(`${result.imported.toLocaleString()} hymns imported${result.failed ? `; ${result.failed} pages skipped` : ''}.`)
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : 'The Hymnal folder could not be imported.')
    } finally { setLibraryBusy(false) }
  }

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return hymns.filter((hymn) =>
      (!favoritesOnly || favorites.includes(hymn.id)) &&
      (!recentOnly || recentIds.includes(hymn.id)) &&
      matchesHymnCollection(hymn, collectionFilter) &&
      (categoryFilter === 'all' || hymn.category === categoryFilter) &&
      matchesCatalogSearch(hymn, term))
      .sort((left, right) => recentOnly
        ? recentIds.indexOf(left.id) - recentIds.indexOf(right.id)
        : catalogSort === 'title'
        ? left.title.localeCompare(right.title, undefined, { sensitivity: 'base' })
        : `${left.catalogPrefix ?? ''}${left.hymnNumber ?? ''}`.localeCompare(
          `${right.catalogPrefix ?? ''}${right.hymnNumber ?? ''}`, undefined, { numeric: true, sensitivity: 'base' }))
  }, [catalogSort, categoryFilter, collectionFilter, favorites, favoritesOnly, hymns, query, recentIds, recentOnly])

  const soundingShift = semitonesBetween(selected.originalKey, targetKey)
  const shapeShift = (soundingShift - capo + 12) % 12
  const shapeKey = CHROMATIC_KEYS[
    (CHROMATIC_KEYS.indexOf(selected.originalKey as typeof CHROMATIC_KEYS[number]) + shapeShift) % 12
  ]
  const chordPalette = extractChords(
    selected.sections.flatMap((section) => section.lines),
    shapeShift,
  )
  const related = getRelatedHymns(selected, hymns)

  function chooseHymn(id: string) {
    const hymn = hymns.find((item) => item.id === id)
    if (!hymn) return
    setSelectedId(id)
    setQuery('')
    setFavoritesOnly(false)
    setRecentOnly(false)
    setCollectionFilter('all')
    setCategoryFilter('all')
    const nextRecent = [id, ...recentIds.filter((item) => item !== id)].slice(0, 20)
    setRecentIds(nextRecent)
    localStorage.setItem(RECENT_KEY, JSON.stringify(nextRecent))
    setTargetKey(hymn.originalKey)
    setCapo(0)
  }

  async function importHymn(file: File) {
    const text = await file.text()
    if (file.name.toLowerCase().endsWith('.json')) {
      try {
        const value: unknown = JSON.parse(text)
        if (typeof value === 'object' && value !== null &&
          (value as { aiosHymnalBackup?: unknown }).aiosHymnalBackup === 1) {
          const backup = value as { hymns?: unknown; favorites?: unknown; recent?: unknown }
          const restored = Array.isArray(backup.hymns) ? backup.hymns.filter((item): item is Hymn => {
            if (typeof item !== 'object' || item === null) return false
            const hymn = item as Partial<Hymn>
            return typeof hymn.id === 'string' && typeof hymn.title === 'string' &&
              typeof hymn.author === 'string' && typeof hymn.originalKey === 'string' &&
              Array.isArray(hymn.themes) && hymn.themes.every((theme: unknown) => typeof theme === 'string') &&
              Array.isArray(hymn.sections) && hymn.sections.every((section: unknown) => {
                if (typeof section !== 'object' || section === null) return false
                const value = section as { label?: unknown; lines?: unknown }
                return typeof value.label === 'string' && Array.isArray(value.lines) &&
                  value.lines.every((line: unknown) => typeof line === 'string')
              })
          }) : []
          const merged = [...loadImportedHymns().filter((item) => !restored.some((entry) => entry.id === item.id)), ...restored]
          const restoredFavorites = Array.isArray(backup.favorites)
            ? backup.favorites.filter((item): item is string => typeof item === 'string') : []
          const restoredRecent = Array.isArray(backup.recent)
            ? backup.recent.filter((item): item is string => typeof item === 'string').slice(0, 20) : []
          localStorage.setItem(IMPORTED_KEY, JSON.stringify(merged))
          setHymns([...merged, ...libraryHymnsRef.current])
          setFavorites((current) => [...new Set([...current, ...restoredFavorites])])
          const nextRecent = [...new Set([...restoredRecent, ...recentIds])].slice(0, 20)
          setRecentIds(nextRecent)
          localStorage.setItem(RECENT_KEY, JSON.stringify(nextRecent))
          setSelectedId(null)
          setImportStatus(`Backup restored: ${restored.length} user hymn${restored.length === 1 ? '' : 's'}.`)
          return
        }
      } catch { /* Continue to ordinary hymn import for actionable validation below. */ }
    }
    const hymn = parseHymnImport(text, file.name)
    if (!hymn) {
      setImportStatus('Import failed. Choose a valid JSON or ChordPro hymn.')
      return
    }
    const imported = [...loadImportedHymns(), hymn]
    localStorage.setItem(IMPORTED_KEY, JSON.stringify(imported))
    setHymns([...imported, ...libraryHymnsRef.current])
    setSelectedId(hymn.id)
    setQuery('')
    setTargetKey(hymn.originalKey)
    setCapo(0)
    setImportStatus(hymn.title + ' imported.')
  }

  function saveCreatedHymn(hymn: Hymn) {
    const current = loadImportedHymns()
    const imported = current.some((item) => item.id === hymn.id)
      ? current.map((item) => item.id === hymn.id ? hymn : item)
      : [...current, hymn]
    localStorage.setItem(IMPORTED_KEY, JSON.stringify(imported))
    setHymns([...imported, ...libraryHymnsRef.current])
    setSelectedId(hymn.id)
    setQuery('')
    setTargetKey(hymn.originalKey)
    setCapo(0)
    setImportStatus(hymn.title + ' added.')
    setEditorOpen(false)
    setEditingHymn(null)
  }

  function deleteUserHymn(hymn: Hymn) {
    if (hymn.rightsStatus !== 'user-provided' ||
      !window.confirm('Delete ' + hymn.title + '? This cannot be undone.')) return
    const imported = loadImportedHymns().filter((item) => item.id !== hymn.id)
    localStorage.setItem(IMPORTED_KEY, JSON.stringify(imported))
    setHymns([...imported, ...libraryHymnsRef.current])
    setFavorites((current) => current.filter((id) => id !== hymn.id))
    setSelectedId(null)
    setImportStatus(hymn.title + ' deleted.')
  }

  function toggleFavorite(id: string) {
    setFavorites((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  function renderLine(line: string) {
    if (view === 'lyrics') return stripChords(line)
    const transposed = transposeChordLine(line, shapeShift)
    const chords: Array<{ position: number; value: string }> = []
    let lyric = ''
    let cursor = 0
    for (const match of transposed.matchAll(/\[([^\]]+)\]|\(([A-G](?:#|b)?(?:maj7|maj|min|m|sus[24]?|dim|aug|add\d+|\d+|[+°ø])*(?:\/[A-G](?:#|b)?)?)\)/g)) {
      lyric += transposed.slice(cursor, match.index)
      chords.push({ position: lyric.length, value: match[1] ?? match[2] })
      cursor = (match.index ?? 0) + match[0].length
    }
    lyric += transposed.slice(cursor)
    if (!chords.length) return <span className="hymnal-lyric-row hymnal-lyric-only">{lyric.trim()}</span>
    const chordLength = Math.max(lyric.length, ...chords.map((item) => item.position + item.value.length), 1)
    const chordCharacters = Array.from({ length: chordLength }, () => ' ')
    for (const chord of chords) chord.value.split('').forEach((character, index) => { chordCharacters[chord.position + index] = character })
    return <span className="hymnal-chord-line"><span className="hymnal-chord-row">{chordCharacters.join('').trimEnd()}</span><span className="hymnal-lyric-row">{lyric}</span></span>
  }

  useEffect(() => {
    const updateFullscreen = () => setFullscreen(document.fullscreenElement === sheetRef.current)
    document.addEventListener('fullscreenchange', updateFullscreen)
    return () => document.removeEventListener('fullscreenchange', updateFullscreen)
  }, [])

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (sheetRef.current) await sheetRef.current.requestFullscreen()
    } catch {
      setImportStatus('Fullscreen is not available in this browser.')
    }
  }

  function createSong() {
    const lyrics = selected.sections.map((section) =>
      `${section.label}\n${section.lines.map(stripChords).join('\n')}`).join('\n\n')
    navigate('/media', { state: { mediaDraft: {
      kind: 'audio', prompt: lyrics, audioMode: 'song', language: selected.language ?? 'en',
      genre: 'Hymn', audioStyle: 'Hymn',
    } } })
  }

  function translateLyrics() {
    const lyrics = selected.sections.map((section) =>
      `${section.label}\n${section.lines.map(stripChords).join('\n')}`).join('\n\n')
    navigate('/language-tools', { state: { languageDraft: {
      text: lyrics, sourceLanguage: selected.language ?? 'en',
    } } })
  }

  function exportHymn() {
    const file = new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    const name = `${selected.catalogPrefix ?? ''}${selected.hymnNumber ? `-${selected.hymnNumber}` : ''}-${selected.title}`
      .replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
    link.href = url
    link.download = `${name || 'hymn'}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  function backupHymnal() {
    const backup = {
      aiosHymnalBackup: 1,
      createdAt: new Date().toISOString(),
      hymns: loadImportedHymns(),
      favorites,
      recent: recentIds,
    }
    const file = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = `aios-hymnal-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function copyArrangement() {
    const includeChords = view === 'chords' || view === 'guitar'
    const content = selected.sections.map((section) => `${section.label}\n${section.lines.map((line) =>
      includeChords ? transposeChordLine(line, shapeShift) : stripChords(line)).join('\n')}`).join('\n\n')
    try {
      await navigator.clipboard.writeText(`${selected.title}\n\n${content}`)
      setCopiedArrangement(true)
      window.setTimeout(() => setCopiedArrangement(false), 1800)
    } catch {
      setImportStatus('The browser could not copy this hymn. Select and copy the text manually.')
    }
  }

  function clearRecent() {
    if (!window.confirm('Clear the recently viewed hymn list? Your hymns and Favorites will be kept.')) return
    setRecentIds([])
    localStorage.removeItem(RECENT_KEY)
  }

  return (
    <WorkspaceLayout
      title="Hymnal"
      subtitle="Public-domain hymns with searchable lyrics and guitar-ready chord sheets."
      icon={<BookOpen size={25} />}
      toolbar={<div className="hymnal-toolbar">
        <button type="button" onClick={() => { setSelectedId(null); setQuery(''); setFavoritesOnly(false); setRecentOnly(false); setCollectionFilter('all'); setCategoryFilter('all'); setCatalogSort('catalog') }}>
          <LayoutGrid size={15} /> Browse Hymns
        </button>
        <label className="hymnal-toolbar-collection"><BookOpen size={15} />
          <select value={collectionFilter} onChange={(event) => { setCollectionFilter(event.target.value); setSelectedId(null) }}
            aria-label="Filter hymns by collection">
            <option value="all">All collections</option><option value="H">Classic Hymns (H)</option>
            <option value="NS">New Songs (NS)</option><option value="NT">New Tunes (NT)</option>
            <option value="C">Children (C)</option><option value="LB">Life-study (LB)</option>
          </select>
        </label>
        <button className={favoritesOnly ? 'active' : ''} type="button"
          onClick={() => { setFavoritesOnly((current) => !current); setRecentOnly(false); setSelectedId(null) }}>
          <Heart size={15} fill={favoritesOnly ? 'currentColor' : 'none'} /> Favorites
        </button>
        <button className={recentOnly ? 'active' : ''} type="button"
          onClick={() => { setRecentOnly((current) => !current); setFavoritesOnly(false); setSelectedId(null) }}>
          <Clock3 size={15} /> Recent
        </button>
        <label className="hymnal-toolbar-sort">Sort
          <select value={catalogSort} onChange={(event) => setCatalogSort(event.target.value as typeof catalogSort)}
            aria-label="Sort hymn catalog">
            <option value="catalog">Hymn number</option><option value="title">Title A–Z</option>
          </select>
        </label>
        <label className="hymnal-toolbar-theme"><Tag size={15} />
          <select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setSelectedId(null) }}
            aria-label="Filter hymns by category">
            <option value="all">All categories</option>
            {availableCategories.map((category) => <option value={category} key={category}>{category}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => { setEditingHymn(null); setEditorOpen(true) }}>
          <Plus size={15} /> Add Hymn
        </button>
        <button type="button" onClick={backupHymnal}>
          <Download size={15} /> Backup
        </button>
        <button type="button" disabled={libraryBusy} onClick={() => void importLocalMirror()}>
          <FileUp size={15} /> {libraryBusy ? 'Importing…' : 'Import Hymnal Folder'}
        </button>
        <label className="hymnal-toolbar-search"><Search size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)}
            type="search" placeholder="Search number, category, language, scripture, or first line" aria-label="Search hymn catalog" />
        </label>
        <label className="hymnal-toolbar-import"><FileUp size={15} /> Import
          <input type="file" accept=".json,.cho,.chordpro,.pro,.crd,text/plain,application/json"
            onChange={(event) => { const file = event.target.files?.[0]; if (file) void importHymn(file); event.target.value = '' }} />
        </label>
      </div>}
      statusBar={<span>{hymns.length.toLocaleString()} hymns{libraryCount ? ` - ${libraryCount.toLocaleString()} from local Hymnal library` : ''} - Favorites are stored on this device</span>}
      className="hymnal-page"
    >
      {editorOpen && <HymnEditor hymn={editingHymn}
        onClose={() => { setEditorOpen(false); setEditingHymn(null) }} onSave={saveCreatedHymn} />}
      <div className="hymnal-grid">
        {showCatalog ? <section className="hymnal-catalog">
          <header><h2>{favoritesOnly ? 'Favorite Hymns' : recentOnly ? 'Recently Viewed' : query.trim() || collectionFilter !== 'all' || categoryFilter !== 'all' ? 'Filtered Hymns' : 'Hymn Catalog'}</h2>
            <p>{query.trim() || favoritesOnly || recentOnly || collectionFilter !== 'all' || categoryFilter !== 'all' ? visible.length + ' matching hymns' : 'Search by hymn number, category, language, scripture, or first line.'}</p>
            {recentOnly && recentIds.length > 0 && <button className="hymnal-clear-recent" type="button" onClick={clearRecent}>
              Clear recent
            </button>}
          </header>
          <div className="hymnal-catalog-controls">
            <div className="hymnal-view-toggle" aria-label="Catalog view">
              <button className={catalogView === 'list' ? 'active' : ''} type="button" onClick={() => setCatalogView('list')}><List size={14} /> List</button>
              <button className={catalogView === 'cards' ? 'active' : ''} type="button" onClick={() => setCatalogView('cards')}><LayoutGrid size={14} /> Cards</button>
            </div>
          </div>
          {importStatus && <p className="hymnal-import-status">{importStatus}</p>}
          <div className={catalogView === 'list' ? 'hymnal-catalog-list' : 'hymnal-catalog-cards'} role={catalogView === 'list' ? 'table' : undefined} aria-label="Hymn catalog index">
            {catalogView === 'list' && <div className="hymnal-catalog-head" role="row">
              <span role="columnheader">Hymn number</span>
              <span role="columnheader">Title</span>
              <span role="columnheader">Category</span>
              <span role="columnheader">Subcategory</span>
              <span role="columnheader">First line</span>
            </div>}
            {visible.map((hymn) => (
              <button type="button" role={catalogView === 'list' ? 'row' : undefined} onClick={() => chooseHymn(hymn.id)} key={hymn.id}>
                <strong role={catalogView === 'list' ? 'cell' : undefined}>{[hymn.catalogPrefix, hymn.hymnNumber].filter(Boolean).join(' ') || '—'}</strong>
                <span role={catalogView === 'list' ? 'cell' : undefined} className="hymnal-catalog-title"><strong>{hymn.title}</strong></span>
                <span role={catalogView === 'list' ? 'cell' : undefined} className="hymnal-card-meta" data-label="Category">{hymn.category || '—'}</span>
                <span role={catalogView === 'list' ? 'cell' : undefined} className="hymnal-card-meta" data-label="Subcategory">{hymn.subcategory || '—'}</span>
                <span role={catalogView === 'list' ? 'cell' : undefined} className="hymnal-first-line" data-label="First line">{firstLyricLine(hymn) || '—'}</span>
              </button>
            ))}
            {visible.length === 0 && <p className="hymnal-empty">No matching hymns.</p>}
          </div>
        </section> :
        <article className="hymnal-sheet" ref={sheetRef}>
          <header className="hymnal-sheet-header">
            <div>
              {hwmrReturn && <button type="button" className="hymnal-back-to-hwmr" onClick={() => navigate(`/ministry/hwmr?${hwmrReturn}`)}><ArrowLeft size={15} /> Back to HWMR</button>}
              <p className="hymnal-eyebrow"><Music2 size={14} /> {{ 'user-provided': 'User provided', 'local-library': 'Local library', 'public-domain': 'Public domain' }[selected.rightsStatus ?? 'public-domain']}</p>
              {(selected.catalogPrefix || selected.hymnNumber) && <span className="hymnal-catalog-number">
                {selected.catalogPrefix} {selected.hymnNumber}
              </span>}
              <h2>{selected.title}</h2>
              <p>{selected.author}{selected.year > 0 ? ' - ' + selected.year : ''} - {selected.tempo} BPM - {selected.timeSignature}</p>
            </div>
            <div className="hymnal-output-actions">
              <button type="button" onClick={() => void copyArrangement()} aria-label="Copy current hymn arrangement">
                {copiedArrangement ? <Check size={16} /> : <Clipboard size={16} />}
                {copiedArrangement ? 'Copied' : view === 'chords' || view === 'guitar' ? 'Copy chords' : 'Copy lyrics'}
              </button>
              <button type="button" onClick={exportHymn} aria-label="Export hymn as JSON">
                <Download size={16} /> Export
              </button>
              <button type="button" onClick={translateLyrics} aria-label="Translate hymn lyrics">
                <Languages size={16} /> Translate lyrics
              </button>
              <button type="button" onClick={createSong} aria-label="Create song from hymn lyrics">
                <Music2 size={16} /> Create song
              </button>
              <button type="button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? 'Exit fullscreen hymn' : 'Open fullscreen hymn'}>
                {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />} {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              </button>
              <button type="button" onClick={() => window.print()} aria-label="Print hymn">
                <Printer size={16} /> Print
              </button>
            </div>
            <button className={favorites.includes(selected.id) ? 'favorite active' : 'favorite'}
              type="button" onClick={() => toggleFavorite(selected.id)}
              aria-label={favorites.includes(selected.id) ? 'Remove favorite' : 'Add favorite'}>
              <Heart size={18} fill={favorites.includes(selected.id) ? 'currentColor' : 'none'} />
            </button>
            {selected.rightsStatus === 'user-provided' && <div className="hymnal-manage-actions">
              <button type="button" onClick={() => { setEditingHymn(selected); setEditorOpen(true) }}>
                <Pencil size={16} /> Edit
              </button>
              <button type="button" onClick={() => deleteUserHymn(selected)}>
                <Trash2 size={16} /> Delete
              </button>
            </div>}
          </header>

          <div className="hymnal-playback"><TunePlayer hymn={selected} /></div>

          <div className="hymnal-controls">
            <div className="hymnal-view-switcher" aria-label="Hymn view">
              {(['lyrics', 'chords', 'piano', 'guitar'] as const).map((option) => (
                <button className={view === option ? 'active' : ''} type="button"
                  onClick={() => setView(option)} key={option}>{option === 'lyrics' ? 'Text only' : option === 'chords' ? 'With chords' : option}</button>
              ))}
            </div>
            <label>Sounding key<select value={targetKey} onChange={(event) => setTargetKey(event.target.value)}>
              {CHROMATIC_KEYS.map((key) => <option key={key}>{key}</option>)}
            </select></label>
            <label>Capo<select value={capo} onChange={(event) => setCapo(Number(event.target.value))}>
              {Array.from({ length: 8 }, (_, value) => <option value={value} key={value}>{value}</option>)}
            </select></label>
            <div className="hymnal-shape-guide"><span>Play shapes</span><strong>{shapeKey}</strong></div>
          </div>

          <div className="hymnal-themes">{selected.themes.map((theme) => <span key={theme}>{theme}</span>)}</div>
          <div className="hymnal-info-grid">
            <section className="hymnal-info-card">
              <h3>Details</h3><dl>
                <div><dt>Hymn</dt><dd>{selected.catalogPrefix} {selected.hymnNumber || 'Not assigned'}</dd></div>
                <div><dt>Category</dt><dd>{selected.category || 'Uncategorized'}</dd></div>
                <div><dt>Subcategory</dt><dd>{selected.subcategory || 'Not specified'}</dd></div>
                <div><dt>Lyrics</dt><dd>{selected.lyricist || selected.author || 'Not specified'}</dd></div>
                <div><dt>Music</dt><dd>{selected.composer || 'Not specified'}</dd></div>
                <div><dt>Language</dt><dd>{{ en: 'English', zh: 'Chinese', ta: 'Tamil', hi: 'Hindi', mr: 'Marathi', te: 'Telugu', ml: 'Malayalam' }[selected.language ?? 'en'] ?? selected.language}</dd></div>
                <div><dt>Key</dt><dd>{targetKey} major</dd></div>
                <div><dt>Meter</dt><dd>{selected.timeSignature}</dd></div>
                <div><dt>Source</dt><dd>{{ 'user-provided': 'User provided', 'local-library': 'Local Hymnal archive', 'public-domain': 'Public domain' }[selected.rightsStatus ?? 'public-domain']}</dd></div>
                <div><dt>Scripture</dt><dd>{selected.scriptures?.join(', ') || 'Not specified'}</dd></div>
              </dl>
            </section>
            <section className="hymnal-info-card">
              <h3>Related Hymns</h3>
              {related.length > 0 ? <div className="hymnal-related-list">
                {related.map((hymn) => <button type="button" onClick={() => chooseHymn(hymn.id)} key={hymn.id}>
                  <strong>{hymn.title}</strong><span>{hymn.themes.slice(0, 2).join(' - ')}</span>
                </button>)}
              </div> : <p className="hymnal-related-empty">No related hymns in this collection yet.</p>}
            </section>
            {(selected.pianoSheetUrl || selected.guitarSheetUrl || selected.textSheetUrl || selected.midiUrl || selected.tuneMidiUrl || selected.sourceUrl) && <section className="hymnal-info-card">
              <h3>Music &amp; Sheets</h3>
              <div className="hymnal-resource-list">
                {selected.pianoSheetUrl && <a href={selected.pianoSheetUrl} target="_blank" rel="noreferrer">Piano sheet <ExternalLink size={12} /></a>}
                {selected.guitarSheetUrl && <a href={selected.guitarSheetUrl} target="_blank" rel="noreferrer">Guitar sheet <ExternalLink size={12} /></a>}
                {selected.textSheetUrl && <a href={selected.textSheetUrl} target="_blank" rel="noreferrer">Text lead sheet <ExternalLink size={12} /></a>}
                {selected.midiUrl && <a href={selected.midiUrl} target="_blank" rel="noreferrer">Song MIDI <Download size={12} /></a>}
                {selected.tuneMidiUrl && <a href={selected.tuneMidiUrl} target="_blank" rel="noreferrer">Tune MIDI <Download size={12} /></a>}
                {selected.sourceUrl && <a href={selected.sourceUrl} target="_blank" rel="noreferrer">Source page <ExternalLink size={12} /></a>}
              </div>
            </section>}
          </div>
          {view === 'guitar' && <div className="hymnal-chord-palette">
            <span>Chords in this arrangement</span>
            <div>{chordPalette.map((chord) => <strong key={chord}>{chord}</strong>)}</div>
          </div>}
          {view === 'piano' ? <PianoSheet hymn={selected} /> : <div className={`hymnal-sections ${view}`}>
            {selected.sections.map((section) => (
              <section key={section.label}>
                <h3>{section.label}</h3>
                {section.lines.map((line, index) => <p className={view !== 'lyrics' && !/\[[^\]]+\]|\(([A-G](?:#|b)?(?:maj7|maj|min|m|sus[24]?|dim|aug|add\d+|\d+|[+°ø])*(?:\/[A-G](?:#|b)?)?)\)/.test(line) ? 'no-chords' : undefined} key={index}>{renderLine(line)}</p>)}
              </section>
            ))}
          </div>}
        </article>}
      </div>
    </WorkspaceLayout>
  )
}

export default HymnalPage
