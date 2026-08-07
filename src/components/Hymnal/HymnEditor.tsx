import { X } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Hymn } from '../../types/hymnal'
import { parseHymnImport } from '../../utils/importHymn'
import { CHROMATIC_KEYS } from '../../utils/chords'

interface HymnEditorProps {
  hymn?: Hymn | null
  onClose: () => void
  onSave: (hymn: Hymn) => void
}

function HymnEditor({ hymn, onClose, onSave }: HymnEditorProps) {
  const [title, setTitle] = useState(hymn?.title ?? '')
  const [author, setAuthor] = useState(hymn?.author ?? '')
  const [prefix, setPrefix] = useState(hymn?.catalogPrefix ?? '')
  const [number, setNumber] = useState(hymn?.hymnNumber ?? '')
  const [key, setKey] = useState(hymn?.originalKey ?? 'C')
  const [category, setCategory] = useState(hymn?.category ?? '')
  const [scripture, setScripture] = useState(hymn?.scriptures?.join(', ') ?? '')
  const [themes, setThemes] = useState(hymn?.themes.join(', ') ?? '')
  const [lyrics, setLyrics] = useState(hymn ? hymn.sections.map((section) =>
    '{comment: ' + section.label + '}\n' + section.lines.join('\n')).join('\n') :
    '{comment: Verse 1}\n[C]Enter lyrics here')
  const [error, setError] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const document = [
      `{title: ${title.trim()}}`, `{artist: ${author.trim()}}`,
      `{prefix: ${prefix.trim()}}`, `{number: ${number.trim()}}`, `{key: ${key}}`,
      `{category: ${category.trim()}}`, `{scripture: ${scripture.trim()}}`,
      `{theme: ${themes.trim()}}`, lyrics.trim(),
    ].join('\n')
    const parsed = parseHymnImport(document, 'new-hymn.chordpro')
    if (!parsed || !title.trim()) {
      setError('Add a title and at least one lyric line.')
      return
    }
    onSave({ ...parsed, id: hymn?.id ?? parsed.id })
  }

  return <div className="hymnal-editor-backdrop" role="presentation">
    <form className="hymnal-editor" onSubmit={submit}>
      <header><div><h2>{hymn ? 'Edit Hymn' : 'Add Hymn'}</h2><p>Use [C] chord markers and section directives in the lyrics.</p></div>
        <button type="button" onClick={onClose} aria-label="Close hymn editor"><X size={18} /></button></header>
      <div className="hymnal-editor-grid">
        <label>Title<input required value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>Author<input value={author} onChange={(event) => setAuthor(event.target.value)} /></label>
        <label>Prefix<input value={prefix} onChange={(event) => setPrefix(event.target.value.toUpperCase())} placeholder="NS" /></label>
        <label>Number<input value={number} onChange={(event) => setNumber(event.target.value)} placeholder="1156" /></label>
        <label>Key<select value={key} onChange={(event) => setKey(event.target.value)}>
          {CHROMATIC_KEYS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Category<input value={category} onChange={(event) => setCategory(event.target.value)} /></label>
        <label>Scripture<input value={scripture} onChange={(event) => setScripture(event.target.value)} placeholder="Ephesians 5:19" /></label>
        <label>Themes<input value={themes} onChange={(event) => setThemes(event.target.value)} placeholder="Praise, Church" /></label>
      </div>
      <label className="hymnal-editor-lyrics">Lyrics and chords<textarea required rows={12} value={lyrics}
        onChange={(event) => setLyrics(event.target.value)} /></label>
      {error && <p className="hymnal-editor-error">{error}</p>}
      <footer><button type="button" onClick={onClose}>Cancel</button><button type="submit">Save Hymn</button></footer>
    </form>
  </div>
}

export default HymnEditor
