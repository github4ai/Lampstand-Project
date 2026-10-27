import { Clapperboard, FileText, Loader2, Music2, Plus, Trash2, Upload, Video } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { convertPresentationDeck, getPresentationMediaLibrary, presentationMediaFileUrl, removePresentationMedia, removePresentationMediaGroup, uploadPresentationMediaFile, type PresentationMediaItem } from '../../api/presentationMedia'
import { mediaSlideHtml, type MediaSlideSource } from '../../utils/mediaSlide'
import type { NewQueueItem } from '../../utils/presentationQueue'
import './StudioPanels.css'

type Filter = 'all' | 'image' | 'video' | 'audio' | 'document' | 'deck'

const kindLabel: Record<Filter, string> = { all: 'Everything', image: 'Images', video: 'Video', audio: 'Audio', document: 'Docs', deck: 'PowerPoint' }
const mediaSubtitle: Record<MediaSlideSource['kind'], string> = { image: 'Image', video: 'Video', audio: 'Audio', document: 'Document page', deck: 'PowerPoint' }
const bytes = (value: number) => (value >= 1048576 ? `${(value / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`)
/** Deck pages are named slide-01.png, so the number inside the name is the order - not the text sort. */
const slideNumber = (item: PresentationMediaItem) => Number(/(\d+)\.png$/i.exec(item.id)?.[1] || 0)
const deckName = (group: string) => group.split('/').pop() || 'Presentation'
const isDeckFile = (item: PresentationMediaItem) => /\.pptx?$/i.test(item.extension)
const isDeckPage = (item: PresentationMediaItem) => item.group.startsWith('decks/')

export default function MediaSourcePanel({ onAdd, onNotice }: { onAdd: (item: NewQueueItem) => void; onNotice: (message: string) => void }) {
  const [items, setItems] = useState<PresentationMediaItem[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [uploadPercent, setUploadPercent] = useState<number | null>(null)
  const [converting, setConverting] = useState('')
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

  const library = items.filter((item) => !isDeckFile(item) && !isDeckPage(item))
  const pendingDecks = items.filter(isDeckFile)
  const decks = useMemo(() => {
    const byGroup = new Map<string, PresentationMediaItem[]>()
    items.filter(isDeckPage).forEach((item) => {
      byGroup.set(item.group, [...(byGroup.get(item.group) || []), item])
    })
    return [...byGroup.entries()]
      .map(([group, pages]) => {
        const ordered = [...pages].sort((a, b) => slideNumber(a) - slideNumber(b))
        return { group, title: deckName(group), pages: ordered, first: ordered[0] }
      })
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [items])

  const visible = library.filter((item) => filter === 'all' || item.media === filter)
  const showDecks = filter === 'all' || filter === 'deck'
  const countFor = (option: Filter) => option === 'all' ? library.length + pendingDecks.length + decks.length
    : option === 'deck' ? pendingDecks.length + decks.length
    : library.filter((item) => item.media === option).length
  const nothingToShow = !visible.length && (!showDecks || (!pendingDecks.length && !decks.length))

  async function upload(files?: FileList | null) {
    if (!files?.length) return
    const list = Array.from(files)
    setUploadPercent(0)
    try {
      for (let index = 0; index < list.length; index += 1) {
        const stored = await uploadPresentationMediaFile(list[index], (percent) => setUploadPercent(Math.round(((index + percent / 100) / list.length) * 100)))
        onNotice(isDeckFile(stored) ? `Added ${stored.title}. Press Make slides to put it on the projector.` : `Added ${stored.title} to the media library.`)
      }
      await load()
    } catch (error) { onNotice(error instanceof Error ? error.message : 'The file could not be added.') } finally { setUploadPercent(null); if (fileRef.current) fileRef.current.value = '' }
  }

  function addFromLibrary(item: PresentationMediaItem) {
    const source: MediaSlideSource = {
      kind: item.media,
      name: item.id,
      title: item.title,
      fit: fillScreen ? 'cover' : 'contain',
      autoplay: item.media === 'video' || item.media === 'audio' ? autoStart : undefined,
      loop: repeat,
      muted: silent,
      page: item.media === 'document' ? Math.max(1, startPage) : undefined,
    }
    onAdd({ kind: 'media', title: item.title, subtitle: mediaSubtitle[source.kind], html: mediaSlideHtml(source), notes: '', media: source })
  }

  /** A deck joins the show as one entry and is stepped slide by slide, so forty pages never clutter Program Output. */
  function sendDeck(deck: { title: string; pages: PresentationMediaItem[] }) {
    const pages = deck.pages.map((page) => page.id)
    if (!pages.length) return
    const source: MediaSlideSource = { kind: 'deck', name: pages[0], title: deck.title, pages, page: 1 }
    onAdd({ kind: 'deck', title: deck.title, subtitle: `PowerPoint · slide 1 of ${pages.length}`, html: mediaSlideHtml(source), notes: '', media: source })
  }

  async function convert(item: PresentationMediaItem) {
    setConverting(item.id)
    try { await convertPresentationDeck(item.id); await load(); onNotice(`${item.title} is ready - send it to Program Output as one entry.`) }
    catch (error) { onNotice(error instanceof Error ? error.message : 'This deck could not be converted.') }
    finally { setConverting('') }
  }

  async function remove(item: PresentationMediaItem) {
    if (!confirm(`Remove ${item.title} from the media library?`)) return
    try { await removePresentationMedia(item.id); await load(); onNotice(`Removed ${item.title}.`) }
    catch (error) { onNotice(error instanceof Error ? error.message : 'The file could not be removed.') }
  }

  async function removeDeck(group: string, title: string) {
    if (!confirm(`Remove every slide converted from ${title}?`)) return
    try { await removePresentationMediaGroup(group); await load(); onNotice(`Removed ${title}.`) }
    catch (error) { onNotice(error instanceof Error ? error.message : 'The deck could not be removed.') }
  }

  return <div className="source-form">
    <div className="studio-actions-row">
      <input ref={fileRef} type="file" multiple hidden accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/flac,application/pdf,.pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx,.ppt" onChange={(event) => void upload(event.target.files)} />
      <button className="primary-action" onClick={() => fileRef.current?.click()}><Upload size={16}/> Add images, video, audio, PDF or PowerPoint</button>
    </div>
    {uploadPercent !== null && <div className="studio-progress"><span>Storing the file locally… {uploadPercent}%</span><div><span style={{ width: `${uploadPercent}%` }} /></div></div>}

    <div className="studio-filter-row" role="group" aria-label="Filter the media library">
      {(['all', 'image', 'video', 'audio', 'document', 'deck'] as Filter[]).map((option) => <button type="button" key={option} className={filter === option ? 'active' : ''} onClick={() => setFilter(option)}>{kindLabel[option]} ({countFor(option)})</button>)}
    </div>

    <div className="studio-toggles">
      <label><input type="checkbox" checked={fillScreen} onChange={(event) => setFillScreen(event.target.checked)} /> Fill the whole screen</label>
      <label><input type="checkbox" checked={autoStart} onChange={(event) => setAutoStart(event.target.checked)} /> Start playing on take-live</label>
      <label><input type="checkbox" checked={repeat} onChange={(event) => setRepeat(event.target.checked)} /> Repeat</label>
      <label><input type="checkbox" checked={silent} onChange={(event) => setSilent(event.target.checked)} /> Keep it silent</label>
      <label>First page<input type="number" min={1} value={startPage} onChange={(event) => setStartPage(Number(event.target.value) || 1)} style={{ width: 64, marginLeft: 6 }} /></label>
    </div>

    {nothingToShow && <p className="studio-note">{filter === 'deck'
      ? 'No PowerPoint here yet. Add a .pptx above and press Make slides - the deck is read by PowerPoint on this computer and stored here as one image per slide, so nothing goes to the internet.'
      : 'The library is empty for this filter. Add a file above - it is stored on this computer and projected from there, so nothing goes to the internet.'}</p>}
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
          <button type="button" onClick={() => addFromLibrary(item)} title="Put this on the presentation queue"><Plus size={15}/> Project</button>
          <button type="button" onClick={() => void remove(item)} title="Remove from the library"><Trash2 size={15}/></button>
        </span>
      </div>)}
      {showDecks && pendingDecks.map((item) => <div className="media-row" key={item.id}>
        <span className="media-glyph"><Clapperboard size={16}/></span>
        <span className="media-meta"><strong>{item.title}</strong><small>{item.extension.replace('.', '').toUpperCase()} · waiting to be made into slides</small></span>
        <span className="media-actions">
          <button type="button" disabled={Boolean(converting)} onClick={() => void convert(item)} title="Open this deck in PowerPoint and export one image per slide">{converting === item.id ? <Loader2 size={15} className="spin"/> : <Plus size={15}/>}{converting === item.id ? 'Converting' : 'Make slides'}</button>
          <button type="button" onClick={() => void remove(item)} title="Remove from the library"><Trash2 size={15}/></button>
        </span>
      </div>)}
      {showDecks && decks.map((deck) => <div className="media-row deck-row" key={deck.group}>
        {deck.first && <img className="media-thumb" src={presentationMediaFileUrl(deck.first.id)} alt="" loading="lazy" />}
        <span className="media-meta"><strong>{deck.title}</strong><small>{deck.pages.length} slides · shown as one entry</small></span>
        <span className="media-actions">
          <button type="button" onClick={() => sendDeck(deck)} title="Put this deck on the presentation queue as one entry"><Plus size={15}/> Send to Program Output</button>
          <button type="button" onClick={() => void removeDeck(deck.group, deck.title)} title="Remove every slide of this deck"><Trash2 size={15}/></button>
        </span>
      </div>)}
    </div>
    {showDecks && decks.length > 0 && <p className="studio-note">Once a deck is live, the console arrows move it slide by slide. Nothing else changes on the projector while it runs.</p>}
  </div>
}
