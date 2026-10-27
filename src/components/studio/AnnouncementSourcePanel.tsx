import { ListOrdered, Megaphone, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import PortionEditor from './PortionEditor'
import { announcementSlideHtml } from '../../utils/announcementSlide'
import { DEFAULT_CUSTOM_STYLE, richItems, type CustomSlideStyle } from '../../utils/customSlide'
import type { NewQueueItem } from '../../utils/presentationQueue'
import './StudioPanels.css'

/** The text of a formatted window read back as the lines a slide lays its own markers under. */
const linesOf = (editor: HTMLDivElement | null) => richItems(editor?.innerHTML ?? '')

/**
 * Announcements are one item per line because that is how they are read from the stage, so the window keeps
 * that shape while letting each item be shaped: a date made bold, a place made big, an invitation coloured.
 */
export default function AnnouncementSourcePanel({ onAdd, onNotice }: { onAdd: (item: NewQueueItem) => void; onNotice: (message: string) => void }) {
  const [heading, setHeading] = useState('Announcements')
  const [footer, setFooter] = useState('')
  const [numbered, setNumbered] = useState(true)
  const [style, setStyle] = useState<CustomSlideStyle>(DEFAULT_CUSTOM_STYLE)
  const [count, setCount] = useState(0)
  const editorRef = useRef<HTMLDivElement>(null)

  function add() {
    const editor = editorRef.current
    const source = editor?.innerHTML ?? ''
    if (!editor || !richItems(source).length) { onNotice('Write at least one announcement line first.'); return }
    onAdd({ kind: 'announcement', title: heading.trim() || 'Announcements', subtitle: `${count} announcement${count === 1 ? '' : 's'}`, html: announcementSlideHtml({ heading, source, footer, numbered, spacing: style.spacing }), notes: '' })
    editor.innerHTML = ''
    setCount(0)
  }

  return <div className="source-form announcement-lines">
    <div className="field-row">
      <label>Heading<input value={heading} onChange={(event) => setHeading(event.target.value)} placeholder="Announcements" /></label>
      <label>Closing line<input value={footer} onChange={(event) => setFooter(event.target.value)} placeholder="Brotherhood lunch after the meeting" /></label>
    </div>
    <PortionEditor
      editorRef={editorRef}
      label="Announcement text"
      placeholder={'One announcement to a line - press Enter for the next. Select words to make them bold, coloured or bigger, the way they will read from the stage.'}
      slideStyle={style}
      onSlideStyle={setStyle}
      slideTools={<button type="button" className={`editor-tool editor-slide-tool${numbered ? ' active' : ''}`} aria-pressed={numbered} onClick={() => setNumbered((value) => !value)} title="Whether the slide marks its announcements 1, 2, 3 or with bullets. This is the whole slide, not the words under the caret."><ListOrdered size={15}/> Number the items</button>}
      onInput={() => setCount(linesOf(editorRef.current).length)}
    />
    <div className="studio-toggles">
      <span className="studio-note" style={{ margin: 0 }}>{count ? `${count} on the slide` : 'Nothing typed yet'}</span>
    </div>
    <button className="primary-action" disabled={!count} onClick={add}><Plus size={17}/><Megaphone size={16}/> Add announcements slide</button>
    <p className="studio-note">Press Enter to start the next announcement. The toolbar shapes only the words you select, so a date can be bold while the rest of the line stays plain, and the slide keeps its numbering whatever the shape. Long lists scroll on the projector - the audience can wheel or use the arrow keys, and the slide keeps its heading.</p>
  </div>
}
