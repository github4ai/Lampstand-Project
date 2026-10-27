import { FileText, Loader2, Music2, Plus, Trash2, Upload, Video, Wand2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { convertPresentationDeck, getPresentationMediaLibrary, presentationMediaFileUrl, removePresentationMedia, removePresentationMediaGroup, uploadPresentationMediaFile, type PresentationMediaItem } from '../../api/presentationMedia'
import { mediaSlideHtml, type MediaSlideSource } from '../../utils/mediaSlide'
import type { NewQueueItem } from '../../utils/presentationQueue'
import './StudioPanels.css'

type Filter = 'all' | 'image' | 'video' | 'audio' | 'document'

const kindLabel: Record<Filter, string> = { all: 'Everything', image: 'Images', video: 'Video', audio: 'Audio', document: 'Docs' }
const mediaSubtitle: Record<MediaSlideSource['kind'], string> = { image: 'Image', video: 'Video', audio: 'Audio', document: 'Document page' }
const isDeck = (item: PresentationMediaItem) => item.media === 'document' && /\.pptx?$/.test(item.extension)
const bytes = (value: number) => (value >= 1048576 ? `${(value / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`)

export default function MediaSourcePanel({ onAdd, onNotice }: { onAdd: (item: NewQueueItem) => void; onNotice: (message: string) => void }) {
  const [items, setItems] = useState<PresentationMediaItem[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [uploadPercent, setUploadPercent] = useState<number | null>(null)
  const [busyName, setBusyName] = useState('')
  const [fillScreen, setFillScreen] = useState(false)
  const [autoStart, setAutoStart] = useState(true)
  const [repeat, setRepeat] = useState(false)
  const [silent, setSilent] = useState(false)
  const [startPage, setStartPage] = useState(1)
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    try { setItems((await getPresentationMediaLibrary()).items) } catch (error) { onNotice(error instanceof Error ? error.message : 'Unable to load the media library.') }
  }
  useEffect(() => { void load() }, [])

  const visible = items.filter((item) => filter === 'all' || item.media === filter)

  async function upload(files?: FileList | null) {
    if (!files?.length) return
    const list = Array.from(files)
    setUploadPercent(0)
    try {
      for (let index = 0; index < list.length; index += 1) {
        const stored = await uploadPresentationMediaFile(list[index], (percent) => setUploadPercent(Math.round(((index + percent / 100) / list.length) * 100)))
        onNotice(`Added ${stored.title} to the media library.`)
      }
      await load()
    } catch (error) { onNotice(error instanceof Error ? error.message : 'The file could not be added.') } finally { setUploadPercent(null); if (fileRef.current) fileRef.current.value = '' }
  }

  function queue(item: PresentationMediaItem, source: MediaSlideSource, title?: string) {
    onAdd({ kind: 'media', title: title || item.title, subtitle: mediaSubtitle[source.kind], html: mediaSlideHtml(source), notes: '', media: source })
  }

  function addFromLibrary(item: PresentationMediaItem) {
    queue(item, {
      kind: item.media,
      name: item.id,
      title: item.title,
      fit: fillScreen ? 'cover' : 'contain',
      autoplay: item.media === 'video' || item.media === 'audio' ? autoStart : undefined,
      loop: repeat,
      muted: silent,
      page: item.media === 'document' ? Math.max(1, startPage) : undefined,
    })
  }

  async function convertDeck(item: PresentationMediaItem) {
    setBusyName(item.id)
    try {
      const deck = await convertPresentationDeck(item.id)
      deck.pages.forEach((page) => onAdd({
        kind: 'media',
        title: page.title,
        subtitle: `${item.title} · slide ${page.number} of ${deck.total}`,
        html: mediaSlideHtml({ kind: 'image', name: page.id, title: page.title }),
        notes: '',
        media: { kind: 'image', name: page.id, title: page.title },
      }))
      onNotice(`${deck.total} slides from ${item.title} were added in order.`)
      await load()
    } catch (error) { onNotice(error instanceof Error ? error.message : 'This deck could not be converted.') } finally { setBusyName('') }
  }

  async function remove(item: PresentationMediaItem) {
    const deckGroup = item.group.startsWith('decks/') ? item.group : ''
    if (deckGroup) { if (!confirm(`Remove every slide converted from this deck?`)) return; await removePresentationMediaGroup(deckGroup) }
    else { if (!confirm(`Remove ${item.title} from the media library?`)) return; await removePresentationMedia(item.id) }
    await load()
    onNotice(deckGroup ? `Removed the deck ${deckGroup.split('/').pop()}.` : `Removed ${item.title}.`)
  }

  return <div className="source-form">
    <div className="studio-actions-row">
      <input ref={fileRef} type="file" multiple hidden accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/flac,application/pdf,.pdf,.pptx,.ppt" onChange={(event) => void upload(event.target.files)} />
      <button className="primary-action" onClick={() => fileRef.current?.click()}><Upload size={16}/> Add images, video, audio, PDF or PowerPoint</button>
    </div>
    {uploadPercent !== null && <div className="studio-progress"><span>Storing the file locally… {uploadPercent}%</span><div><span style={{ width: `${uploadPercent}%` }} /></div></div>}

    <div className="studio-filter-row" role="group" aria-label="Filter the media library">
      {(['all', 'image', 'video', 'audio', 'document'] as Filter[]).map((option) => <button type="button" key={option} className={filter === option ? 'active' : ''} onClick={() => setFilter(option)}>{kindLabel[option]}{option !== 'all' ? ` (${items.filter((item) => item.media === option).length})` : ` (${items.length})`}</button>)}
    </div>

    <div className="studio-toggles">
      <label><input type="checkbox" checked={fillScreen} onChange={(event) => setFillScreen(event.target.checked)} /> Fill the whole screen</label>
      <label><input type="checkbox" checked={autoStart} onChange={(event) => setAutoStart(event.target.checked)} /> Start playing on take-live</label>
      <label><input type="checkbox" checked={repeat} onChange={(event) => setRepeat(event.target.checked)} /> Repeat</label>
      <label><input type="checkbox" checked={silent} onChange={(event) => setSilent(event.target.checked)} /> Keep it silent</label>
      <label>First page<input type="number" min={1} value={startPage} onChange={(event) => setStartPage(Number(event.target.value) || 1)} style={{ width: 64, marginLeft: 6 }} /></label>
    </div>

    {visible.length === 0 && <p className="studio-note">The library is empty for this filter. Add a file above - it is stored on this computer and projected from there, so nothing goes to the internet.</p>}
    <div className="media-library">
      {visible.map((item) => <div className="media-row" key={item.id}>
        {item.media === 'image'
          ? <img className="media-thumb" src={presentationMediaFileUrl(item.id)} alt="" loading="lazy" />
          : <span className="media-glyph">{item.media === 'video' ? <Video size={16}/> : item.media === 'audio' ? <Music2 size={16}/> : <FileText size={16}/>}</span>}
        <span className="media-meta">
          <strong>{item.title}</strong>
          <small>{item.extension.replace('.', '').toUpperCase()} · {bytes(item.bytes)}{item.group ? ` · ${item.group}` : ''}</small>
        </span>
        <span className="media-actions">
          {isDeck(item)
            ? <button type="button" disabled={busyName === item.id} onClick={() => void convertDeck(item)} title="Turn this PowerPoint into one projected image per slide">{busyName === item.id ? <Loader2 size={15} className="spin"/> : <Wand2 size={15}/>}{busyName === item.id ? 'Converting' : 'Make slides'}</button>
            : <><button type="button" onClick={() => addFromLibrary(item)} title="Put this on the presentation queue"><Plus size={15}/> Project</button>{item.group.startsWith('decks/') && <button type="button" onClick={() => void remove(item)} title="Remove every slide of this converted deck"><Trash2 size={15}/></button>}</>}
          {!isDeck(item) && !item.group.startsWith('decks/') && <button type="button" onClick={() => void remove(item)} title="Remove from the library"><Trash2 size={15}/></button>}
        </span>
      </div>)}
    </div>
    <p className="studio-note"><strong>PowerPoint:</strong> “Make slides” opens the deck in PowerPoint on this computer and puts one image per slide in the queue. If PowerPoint is not installed, save the deck as a PDF and project the PDF page by page with the page arrows in Program Output.</p>
  </div>
}
