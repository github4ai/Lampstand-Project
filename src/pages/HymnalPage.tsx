import { BookOpen, FileUp, Heart, LayoutGrid, Music2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import WorkspaceLayout from '../layouts/WorkspaceLayout'
import PianoSheet from '../components/Hymnal/PianoSheet'
import TunePlayer from '../components/Hymnal/TunePlayer'
import HymnEditor from '../components/Hymnal/HymnEditor'
import { HYMNS } from '../data/hymns'
import { CHROMATIC_KEYS, extractChords, semitonesBetween, stripChords, transposeChordLine } from '../utils/chords'
import { parseHymnImport } from '../utils/importHymn'
import type { Hymn } from '../types/hymnal'
import { getRelatedHymns } from '../utils/relatedHymns'

const FAVORITES_KEY = 'aios-studio-hymnal-favorites-v1'
const IMPORTED_KEY = 'aios-studio-imported-hymns-v1'

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

function HymnalPage() {
  const [view, setView] = useState<'lyrics' | 'chords' | 'piano' | 'guitar'>('chords')
  const [query, setQuery] = useState('')
  const [hymns, setHymns] = useState(() => [...HYMNS, ...loadImportedHymns()])
  const [importStatus, setImportStatus] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingHymn, setEditingHymn] = useState<Hymn | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [favorites, setFavorites] = useState(loadFavorites)
  const [targetKey, setTargetKey] = useState(HYMNS[0].originalKey)
  const [capo, setCapo] = useState(0)
  const selected = hymns.find((hymn) => hymn.id === selectedId) ?? hymns[0]
  const showCatalog = selectedId === null || query.trim() !== ''

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
  }, [favorites])

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return hymns
    return hymns.filter((hymn) =>
      [hymn.title, hymn.author, hymn.catalogPrefix ?? '', hymn.hymnNumber ?? '',
        (hymn.catalogPrefix ?? '') + (hymn.hymnNumber ?? ''), ...hymn.themes].some((value) =>
        value.toLowerCase().includes(term)))
  }, [hymns, query])

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
    setTargetKey(hymn.originalKey)
    setCapo(0)
  }

  async function importHymn(file: File) {
    const hymn = parseHymnImport(await file.text(), file.name)
    if (!hymn) {
      setImportStatus('Import failed. Choose a valid JSON or ChordPro hymn.')
      return
    }
    const imported = [...loadImportedHymns(), hymn]
    localStorage.setItem(IMPORTED_KEY, JSON.stringify(imported))
    setHymns([...HYMNS, ...imported])
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
    setHymns([...HYMNS, ...imported])
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
    setHymns([...HYMNS, ...imported])
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
    return transposeChordLine(line, shapeShift).split(/(\[[^\]]+\])/g).map((part, index) =>
      part.startsWith('[') && part.endsWith(']')
        ? <span className="hymnal-chord" key={index}>{part.slice(1, -1)}</span>
        : <span key={index}>{part}</span>)
  }

  return (
    <WorkspaceLayout
      title="Ministry Hymnal"
      subtitle="Public-domain hymns with searchable lyrics and guitar-ready chord sheets."
      icon={<BookOpen size={25} />}
      toolbar={<div className="hymnal-toolbar">
        <button type="button" onClick={() => { setSelectedId(null); setQuery('') }}>
          <LayoutGrid size={15} /> Browse Hymns
        </button>
        <button type="button" onClick={() => { setEditingHymn(null); setEditorOpen(true) }}>
          <Plus size={15} /> Add Hymn
        </button>
        <label className="hymnal-toolbar-search"><Search size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)}
            type="search" placeholder="Search title, number, or theme" />
        </label>
        <label className="hymnal-toolbar-import"><FileUp size={15} /> Import
          <input type="file" accept=".json,.cho,.chordpro,.pro,.crd,text/plain,application/json"
            onChange={(event) => { const file = event.target.files?.[0]; if (file) void importHymn(file); event.target.value = '' }} />
        </label>
      </div>}
      statusBar={<span>{hymns.length} hymns - Imports and favorites are stored on this device</span>}
      className="hymnal-page"
    >
      {editorOpen && <HymnEditor hymn={editingHymn}
        onClose={() => { setEditorOpen(false); setEditingHymn(null) }} onSave={saveCreatedHymn} />}
      <div className="hymnal-grid">
        {showCatalog ? <section className="hymnal-catalog">
          <header><h2>{query.trim() ? 'Search results' : 'Hymn Catalog'}</h2>
            <p>{query.trim() ? visible.length + ' matching hymns' : 'Choose a hymn to open its lyrics, chords, piano sheet, and tune.'}</p>
          </header>
          {importStatus && <p className="hymnal-import-status">{importStatus}</p>}
          <div className="hymnal-catalog-list">
            {visible.map((hymn) => (
              <button type="button" onClick={() => chooseHymn(hymn.id)} key={hymn.id}>
                <span><strong>{hymn.title}</strong><small>
                  {hymn.catalogPrefix}{hymn.hymnNumber ? ' ' + hymn.hymnNumber + ' - ' : ''}{hymn.author}
                </small></span>
                {favorites.includes(hymn.id) && <Heart size={14} fill="currentColor" />}
              </button>
            ))}
            {visible.length === 0 && <p className="hymnal-empty">No matching hymns.</p>}
          </div>
        </section> :
        <article className="hymnal-sheet">
          <header className="hymnal-sheet-header">
            <div>
              <p className="hymnal-eyebrow"><Music2 size={14} /> {selected.rightsStatus === 'user-provided' ? 'User provided' : 'Public domain'}</p>
              {(selected.catalogPrefix || selected.hymnNumber) && <span className="hymnal-catalog-number">
                {selected.catalogPrefix} {selected.hymnNumber}
              </span>}
              <h2>{selected.title}</h2>
              <p>{selected.author}{selected.year > 0 ? ' - ' + selected.year : ''} - {selected.tempo} BPM - {selected.timeSignature}</p>
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
                  onClick={() => setView(option)} key={option}>{option}</button>
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
                <div><dt>Key</dt><dd>{targetKey} major</dd></div>
                <div><dt>Meter</dt><dd>{selected.timeSignature}</dd></div>
                <div><dt>Rights</dt><dd>{selected.rightsStatus === 'user-provided' ? 'User provided' : 'Public domain'}</dd></div>
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
          </div>
          {view === 'guitar' && <div className="hymnal-chord-palette">
            <span>Chords in this arrangement</span>
            <div>{chordPalette.map((chord) => <strong key={chord}>{chord}</strong>)}</div>
          </div>}
          {view === 'piano' ? <PianoSheet hymn={selected} /> : <div className="hymnal-sections">
            {selected.sections.map((section) => (
              <section key={section.label}>
                <h3>{section.label}</h3>
                {section.lines.map((line, index) => <p key={index}>{renderLine(line)}</p>)}
              </section>
            ))}
          </div>}
        </article>}
      </div>
    </WorkspaceLayout>
  )
}

export default HymnalPage
