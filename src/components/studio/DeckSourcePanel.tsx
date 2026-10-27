import { Clapperboard, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { convertPresentationDeck, getPresentationMediaLibrary, presentationMediaFileUrl, removePresentationMediaGroup, uploadPresentationMediaFile, type PresentationMediaItem } from '../../api/presentationMedia'
import { mediaSlideHtml, type MediaSlideSource } from '../../utils/mediaSlide'
import type { NewQueueItem } from '../../utils/presentationQueue'
import './StudioPanels.css'

/** Deck pages are named slide-01.png, so the number inside the name is the order - not the text sort. */
const slideNumber = (item: PresentationMediaItem) => Number(/(\d+)\.png$/i.exec(item.id)?.[1] || 0)
const deckName = (group: string) => group.split('/').pop() || 'Presentation'

/**
 * A PowerPoint deck is its own source: it joins the show as one entry and is stepped slide by slide
 * from the console, so forty converted pages never clutter Program Output.
 */
export default function DeckSourcePanel({ onAdd, onNotice }: { onAdd: (item: NewQueueItem) => void; onNotice: (message: string) => void }) {
  const [items, setItems] = useState<PresentationMediaItem[]>([])
  const [busyName, setBusyName] = useState('')
  const [uploadPercent, setUploadPercent] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    try { setItems((await getPresentationMediaLibrary()).items) } catch (error) { onNotice(error instanceof Error ? error.message : 'Unable to load the presentation library.') }
  }
  useEffect(() => { void load() }, [])

  const decks = useMemo(() => {
    const byGroup = new Map<string, PresentationMediaItem[]>()
    items.filter((item) => item.group.startsWith('decks/')).forEach((item) => {
      byGroup.set(item.group, [...(byGroup.get(item.group) || []), item])
    })
    return [...byGroup.entries()]
      .map(([group, pages]) => {
        const ordered = [...pages].sort((a, b) => slideNumber(a) - slideNumber(b))
        return { group, title: deckName(group), pages: ordered, first: ordered[0] }
      })
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [items])

  const waiting = items.filter((item) => /\.pptx?$/i.test(item.extension))

  async function upload(files?: FileList | null) {
    if (!files?.length) return
    try {
      for (const file of Array.from(files)) {
        const stored = await uploadPresentationMediaFile(file)
        onNotice(`Added ${stored.title}. Make slides to put it on the projector.`)
      }
      await load()
    } catch (error) { onNotice(error instanceof Error ? error.message : 'The deck could not be added.') } finally { setUploadPercent(null); if (fileRef.current) fileRef.current.value = '' }
  }

  async function convert(item: PresentationMediaItem) {
    setBusyName(item.id)
    try { await convertPresentationDeck(item.id); await load(); onNotice(`${item.title} is ready - send it to Program Output as one entry.`) }
    catch (error) { onNotice(error instanceof Error ? error.message : 'This deck could not be converted.') }
    finally { setBusyName('') }
  }

  function send(deck: { title: string; pages: PresentationMediaItem[]; first?: PresentationMediaItem }, startAt = 1) {
    const pages = deck.pages.map((page) => page.id)
    if (!pages.length) return
    const page = Math.min(pages.length, Math.max(1, startAt))
    const source: MediaSlideSource = { kind: 'deck', name: pages[page - 1], title: deck.title, pages, page }
    onAdd({ kind: 'deck', title: deck.title, subtitle: `PowerPoint · slide ${page} of ${pages.length}`, html: mediaSlideHtml(source), notes: '', media: source })
  }

  async function removeDeck(group: string, title: string) {
    if (!confirm(`Remove every slide converted from ${title}?`)) return
    try { await removePresentationMediaGroup(group); await load(); onNotice(`Removed ${title}.`) }
    catch (error) { onNotice(error instanceof Error ? error.message : 'The deck could not be removed.') }
  }

  return <div className="source-form">
    <div className="studio-actions-row">
      <input ref={fileRef} type="file" multiple hidden accept=".pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={(event) => void upload(event.target.files)} />
      <button className="primary-action" onClick={() => fileRef.current?.click()}><Upload size={16}/> Add a PowerPoint deck</button>
    </div>
    {uploadPercent !== null && <div className="studio-progress"><span>Storing the deck locally… {uploadPercent}%</span><div><span style={{ width: `${uploadPercent}%` }} /></div></div>}

    {waiting.length > 0 && <div className="deck-waiting">
      <strong>Waiting to be made into slides</strong>
      {waiting.map((item) => <div className="media-row" key={item.id}>
        <span className="media-glyph"><Clapperboard size={16}/></span>
        <span className="media-meta"><strong>{item.title}</strong><small>{item.extension.replace('.', '').toUpperCase()}</small></span>
        <span className="media-actions">
          <button type="button" disabled={Boolean(busyName)} onClick={() => void convert(item)} title="Open this deck in PowerPoint and export one image per slide">{busyName === item.id ? <Loader2 size={15} className="spin"/> : <Plus size={15}/>}{busyName === item.id ? 'Converting' : 'Make slides'}</button>
        </span>
      </div>)}
    </div>}

    {!decks.length && <p className="studio-note">No converted deck yet. Add a PowerPoint file above and choose Make slides - the deck is read by PowerPoint on this computer and stored here as one image per slide, so nothing goes to the internet.</p>}
    <div className="media-library">
      {decks.map((deck) => <div className="media-row deck-row" key={deck.group}>
        {deck.first && <img className="media-thumb" src={presentationMediaFileUrl(deck.first.id)} alt="" loading="lazy" />}
        <span className="media-meta"><strong>{deck.title}</strong><small>{deck.pages.length} slides · shown as one entry</small></span>
        <span className="media-actions">
          <button type="button" onClick={() => send(deck)} title="Put this deck on the presentation queue as one entry"><Plus size={15}/> Send to Program Output</button>
          <button type="button" onClick={() => void removeDeck(deck.group, deck.title)} title="Remove every slide of this deck"><Trash2 size={15}/></button>
        </span>
      </div>)}
    </div>
    <p className="studio-note">Once a deck is live, the console arrows move it slide by slide. Nothing else changes on the projector while it runs.</p>
  </div>
}
