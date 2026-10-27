import { Clapperboard, FileText, LibraryBig, PlayCircle, Trash2, Upload } from 'lucide-react'
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getVideoTrainingLibrary, readVideoTrainingText, removeVideoTrainingFile, uploadVideoTrainingFile,
  videoTrainingFileUrl, type VideoTrainingItem,
} from '../api/videoTraining'
import '../styles/video-training.css'

const accepted = '.mp4,.m4v,.webm,.mov,.avi,.mkv,.wmv,.pdf,.txt,.md,.html,.htm'
const textDocument = (item: VideoTrainingItem) => item.extension === '.txt' || item.extension === '.md'

const byteLabel = (bytes: number) => bytes >= 1024 * 1024 * 1024 ? `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB` : bytes >= 1024 * 1024 ? `${Math.round(bytes / 1024 / 1024)} MB` : `${Math.round(bytes / 1024)} KB`

export default function VideoTrainingPage() {
  const [items, setItems] = useState<VideoTrainingItem[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [documentText, setDocumentText] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [libraryRoot, setLibraryRoot] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const refresh = useCallback(() => {
    getVideoTrainingLibrary()
      .then((library) => { setItems(library.items); setLibraryRoot(library.root); setSelectedId((current) => current && library.items.some((item) => item.id === current) ? current : library.items[0]?.id || '') })
      .catch(() => { setItems([]); setMessage('The local training folder could not be read.') })
  }, [])
  useEffect(refresh, [refresh])

  const selected = useMemo(() => items.find((item) => item.id === selectedId) || null, [items, selectedId])

  useEffect(() => {
    if (!selected || !textDocument(selected)) { setDocumentText(''); return }
    const controller = new AbortController()
    readVideoTrainingText(selected.id, controller.signal).then(setDocumentText).catch(() => setMessage('This training document could not be opened.'))
    return () => controller.abort()
  }, [selected])

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return
    setBusy(true); setMessage(''); setProgress(0)
    const added: string[] = []
    for (const file of files) {
      try {
        const item = await uploadVideoTrainingFile(file, setProgress)
        added.push(item.title)
        setSelectedId(item.id)
      } catch (reason) {
        setMessage(reason instanceof Error ? reason.message : 'The training file could not be added.')
      }
    }
    setBusy(false); setProgress(0)
    if (added.length) setMessage(`${added.length} training file${added.length === 1 ? '' : 's'} added to the local library.`)
    refresh()
  }

  async function remove() {
    if (!selected) return
    if (!window.confirm(`Remove “${selected.title}” from the video training library?`)) return
    try {
      await removeVideoTrainingFile(selected.id)
      setMessage('The training file was removed.')
      refresh()
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'The training file could not be removed.')
    }
  }

  return <section className="video-training-page">
    <header className="video-training-header">
      <span><Clapperboard size={26} /></span>
      <div><h1>Video Training</h1><p>Training messages and ministry videos stored on this computer.</p></div>
      <Link className="video-training-back" to="/ministry"><LibraryBig size={15} /> Ministry library</Link>
    </header>

    <div className="video-training-controls">
      <nav aria-label="Training files">
        {items.map((item) => <button type="button" key={item.id} className={item.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(item.id)}>
          {item.media === 'video' ? <PlayCircle size={14} /> : <FileText size={14} />}{item.title}
        </button>)}
        {!items.length && <span className="video-training-count">No training files yet</span>}
        {items.length > 0 && <span className="video-training-count">{items.length} stored</span>}
      </nav>
      <div className="video-training-upload">
        <button type="button" disabled={busy} onClick={() => fileInput.current?.click()}><Upload size={15} />{busy ? `Adding… ${progress}%` : 'Add videos or documents'}</button>
        <input ref={fileInput} type="file" multiple accept={accepted} hidden onChange={upload} />
      </div>
      {busy && <div className="video-training-progress"><span style={{ width: `${progress}%` }} /></div>}
      {message && <p role="status">{message}</p>}
    </div>

    {selected ? <article className="video-training-sheet">
      <span>{selected.media === 'video' ? 'Video' : 'Document'}</span>
      <h2>{selected.title}</h2>
      {selected.media === 'video'
        ? <video className="video-training-player" controls preload="metadata" src={videoTrainingFileUrl(selected.id)} />
        : selected.extension === '.pdf' || selected.extension === '.html' || selected.extension === '.htm'
          ? <iframe className="video-training-frame" title={selected.title} src={videoTrainingFileUrl(selected.id)} />
          : <div className="video-training-text"><pre>{documentText || 'Opening…'}</pre></div>}
      <footer>
        <small>{byteLabel(selected.bytes)} · added {new Date(`${selected.addedAt.slice(0, 10)}T12:00:00`).toLocaleDateString()}</small>
        <button type="button" className="video-training-remove" onClick={remove}><Trash2 size={14} /> Remove</button>
      </footer>
    </article> : <div className="video-training-empty">
      <Clapperboard size={30} />
      <h2>The training library is empty</h2>
      <p>Use <strong>Add videos or documents</strong> to store an MP4, WebM, MOV, AVI, MKV, WMV video or a PDF, text, Markdown, or HTML handout here.</p>
      <p className="video-training-folder">Files are kept in <code>{libraryRoot || 'the local Ministry training folder'}</code> and appear here as soon as they are added.</p>
    </div>}
  </section>
}
