import { Megaphone, Plus } from 'lucide-react'
import { useState } from 'react'
import { announcementSlideHtml } from '../../utils/announcementSlide'
import type { NewQueueItem } from '../../utils/presentationQueue'
import './StudioPanels.css'

/** Announcements are typed as one item per line because that is how they are read from the stage. */
export default function AnnouncementSourcePanel({ onAdd, onNotice }: { onAdd: (item: NewQueueItem) => void; onNotice: (message: string) => void }) {
  const [heading, setHeading] = useState('Announcements')
  const [lines, setLines] = useState('')
  const [footer, setFooter] = useState('')
  const [numbered, setNumbered] = useState(true)

  const items = lines.split('\n').map((line) => line.trim()).filter(Boolean)

  function add() {
    if (!items.length) { onNotice('Write at least one announcement line first.'); return }
    onAdd({ kind: 'announcement', title: heading.trim() || 'Announcements', subtitle: `${items.length} announcement${items.length === 1 ? '' : 's'}`, html: announcementSlideHtml({ heading, lines: items, footer, numbered }), notes: '' })
    setLines('')
  }

  return <div className="source-form announcement-lines">
    <div className="field-row">
      <label>Heading<input value={heading} onChange={(event) => setHeading(event.target.value)} placeholder="Announcements" /></label>
      <label>Closing line<input value={footer} onChange={(event) => setFooter(event.target.value)} placeholder="Brotherhood lunch after the meeting" /></label>
    </div>
    <label>One announcement per line<textarea rows={9} value={lines} onChange={(event) => setLines(event.target.value)} placeholder={'Baptism service next Sunday&#10;Book stand open after the meeting&#10;Prayer meeting Wednesday 8:00 pm'} /></label>
    <div className="studio-toggles">
      <label><input type="checkbox" checked={numbered} onChange={(event) => setNumbered(event.target.checked)} /> Number the items</label>
      <span className="studio-note" style={{ margin: 0 }}>{items.length ? `${items.length} on the slide` : 'Nothing typed yet'}</span>
    </div>
    <button className="primary-action" disabled={!items.length} onClick={add}><Plus size={17}/><Megaphone size={16}/> Add announcements slide</button>
    <p className="studio-note">Long lists scroll on the projector - the audience can wheel or use the arrow keys, and the slide keeps its heading.</p>
  </div>
}
