import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import PortionEditor from './PortionEditor'
import { customSlideHtml, DEFAULT_CUSTOM_STYLE, type CustomSlideStyle } from '../../utils/customSlide'
import type { NewQueueItem } from '../../utils/presentationQueue'
import './StudioPanels.css'

/**
 * A portion is written the way it will be read, so the words are formatted in the window itself and the
 * slide carries that formatting to the projector. The window shares its rules with the audience slide, so
 * what the operator sees is what the room sees.
 */
export default function CustomSourcePanel({ onAdd, onNotice }: { onAdd: (item: NewQueueItem) => void; onNotice: (message: string) => void }) {
  const [title, setTitle] = useState('Meeting portion')
  const [style, setStyle] = useState<CustomSlideStyle>(DEFAULT_CUSTOM_STYLE)
  const [hasText, setHasText] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)

  function add() {
    const editor = editorRef.current
    if (!editor?.textContent?.trim()) { onNotice('Write or paste the portion first.'); return }
    onAdd({ kind: 'custom', title: title.trim() || 'Meeting portion', subtitle: 'Custom presentation', html: customSlideHtml(editor.innerHTML, style), notes: '' })
    editor.innerHTML = ''
    setHasText(false)
  }

  return <div className="source-form custom-portion">
    <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
    <PortionEditor
      editorRef={editorRef}
      label="Custom portion text"
      placeholder="Type or paste the portion. Select words to make them bold, bigger, coloured, highlighted, a heading or a list."
      slideStyle={style}
      onSlideStyle={setStyle}
      onInput={() => setHasText(Boolean(editorRef.current?.textContent?.trim()))}
    />
    <button className="primary-action" disabled={!hasText} onClick={add}><Plus size={17}/> Add custom portion</button>
    <p className="studio-note">Every tool but the last shapes the words you select, and the alignment marks work on the line the caret stands on, so a verse can stay left while a response is centered. The size box multiplies the slide&apos;s own text, so those words grow with the audience text size too. Typeface lists the fonts installed on this computer, Colour lays any ink on the words while Slide colour hands them back to the projection theme, Highlight keeps the words legible on whatever colour it is laid on, and the last menu sets the room between the lines of the whole slide.</p>
  </div>
}
