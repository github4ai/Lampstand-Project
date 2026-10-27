import { Bold, ChevronDown, Eraser, Heading, Highlighter, Italic, List, ListOrdered, SlidersHorizontal, Strikethrough, TextAlignCenter, TextAlignJustify, TextAlignStart, Type, Underline } from 'lucide-react'
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject } from 'react'
import { customSlideRules, DEFAULT_CUSTOM_STYLE, HIGHLIGHT_COLORS, legibleInk, localFontStack, ROOM_LINE_HEIGHTS, sanitizeRichText, TEXT_COLORS, WORD_FONTS, type CustomAlign, type CustomSlideStyle, type CustomSpacing } from '../../utils/customSlide'
import './StudioPanels.css'

/** Which button lights up: the same question the toolbar asks about the words under the caret. */
type Marks = { bold: boolean; italic: boolean; underline: boolean; strike: boolean; bullets: boolean; numbers: boolean }
const NO_MARKS: Marks = { bold: false, italic: false, underline: false, strike: false, bullets: false, numbers: false }

const SIZE_MIN = 0.5
const SIZE_MAX = 6
/** A long list is only useful while it is being typed through, so the picker caps what it renders. */
const FONT_ROWS = 120

/**
 * Nothing in the icon set gradates line spacing, and three bare lines read as the alignment marks beside
 * them, so these draw the gaps they set next to the arrow that names the property.
 */
function SpacingMark({ gap }: { gap: number }) {
  return <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {[8 - gap, 8, 8 + gap].map((y) => <path key={y} d={`M6 ${y}h9`} />)}
    <path d="M2.6 4.6v6.8" />
    <path d="M1.2 6l1.4-1.4L4 6M1.2 10l1.4 1.4L4 10" />
  </svg>
}

/**
 * The letter over the colour it lays on the words, which is the shape operators already know this control by.
 * A dashed bar means the words still wear the colour the projection theme gives them.
 */
function InkMark({ color }: { color: string }) {
  return <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 11.4L8 3.2l4 8.2" />
    <path d="M5.7 8.4h4.6" />
    {color === 'inherit'
      ? <path d="M3.2 14h9.6" strokeDasharray="2.4 1.8" />
      : <path d="M3.2 14h9.6" stroke={color} strokeWidth={2.6} />}
  </svg>
}

const SPACING_STEPS: CustomSpacing[] = ['normal', 'roomy', 'open']
const SPACING_GAPS: Record<CustomSpacing, number> = { normal: 4, roomy: 5.5, open: 6.5 }
const SPACING_NAMES: Record<CustomSpacing, string> = { normal: 'Normal', roomy: 'Roomy', open: 'Open' }
const ALIGN_COMMANDS: Record<CustomAlign, string> = { left: 'justifyLeft', center: 'justifyCenter', justify: 'justifyFull' }

/**
 * The window a portion is written in: words are formatted where they stand and the markup travels to the
 * projector with them. It serves the custom slide and the announcements alike, so one set of tools teaches
 * the operator once, and the window reads by the same rules the audience slide will use.
 */
export default function PortionEditor({ editorRef, label, placeholder, slideStyle = DEFAULT_CUSTOM_STYLE, onSlideStyle, slideTools, onInput }: {
  editorRef: RefObject<HTMLDivElement | null>
  label: string
  placeholder: string
  slideStyle?: CustomSlideStyle
  onSlideStyle?: (style: CustomSlideStyle) => void
  /** A host's own slide-level switches - whether announcements carry numbers, for example - ride at the end of the same toolbar, past the tools that shape words. */
  slideTools?: ReactNode
  onInput: () => void
}) {
  const [hasText, setHasText] = useState(false)
  const [marks, setMarks] = useState<Marks>(NO_MARKS)
  const [size, setSize] = useState('1.6')
  const [families, setFamilies] = useState<string[]>([])
  const [fontQuery, setFontQuery] = useState('')
  const [menu, setMenu] = useState<'font' | 'color' | 'ink' | 'spacing' | null>(null)
  const [highlight, setHighlight] = useState(HIGHLIGHT_COLORS[0]!.value)
  const [ink, setInk] = useState('inherit')
  const [lineAlign, setLineAlign] = useState<CustomAlign>(slideStyle.align)
  const caretRef = useRef<Range | null>(null)
  const fontRef = useRef<HTMLSpanElement>(null)
  const colorRef = useRef<HTMLSpanElement>(null)
  const inkRef = useRef<HTMLSpanElement>(null)
  const spacingRef = useRef<HTMLSpanElement>(null)

  // A button takes focus from the window, so the caret is kept here and handed back before any command runs.
  const selectionInEditor = () => {
    const node = document.getSelection()?.rangeCount ? document.getSelection()!.getRangeAt(0).commonAncestorContainer : null
    return Boolean(node && editorRef.current?.contains(node))
  }
  const remember = () => {
    const selection = document.getSelection()
    if (!selection?.rangeCount || !selectionInEditor()) return
    caretRef.current = selection.getRangeAt(0).cloneRange()
  }
  const restoreCaret = () => {
    const editor = editorRef.current
    if (!editor || selectionInEditor()) return
    const selection = document.getSelection()
    editor.focus()
    if (caretRef.current && selection) { selection.removeAllRanges(); selection.addRange(caretRef.current) }
  }

  /** The line the caret stands on answers for the alignment buttons; a window with nothing set follows the slide. */
  function alignOfCaret(): CustomAlign {
    const editor = editorRef.current
    const selection = document.getSelection()
    const start = selection?.rangeCount ? selection.getRangeAt(0).startContainer : null
    let node = start instanceof HTMLElement ? start : start?.parentElement ?? null
    if (!editor?.contains(node)) return slideStyle.align
    for (; node && node !== editor; node = node.parentElement) {
      const declared = node.style.textAlign
      if (declared === 'left' || declared === 'center' || declared === 'justify') return declared
    }
    return slideStyle.align
  }

  function sync() {
    const editor = editorRef.current
    if (!editor) return
    setHasText(Boolean(editor.textContent?.trim()))
    remember()
    setLineAlign(alignOfCaret())
    // queryCommandState answers for the document selection, so a toolbar click that moved focus reports nothing.
    setMarks(selectionInEditor()
      ? { bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic'), underline: document.queryCommandState('underline'), strike: document.queryCommandState('strikeThrough'), bullets: document.queryCommandState('insertUnorderedList'), numbers: document.queryCommandState('insertOrderedList') }
      : NO_MARKS)
    onInput()
  }

  function run(command: string, value?: string) {
    if (!editorRef.current) return
    restoreCaret()
    document.execCommand(command, false, value)
    sync()
  }

  /** Enter opens a new paragraph rather than a div, so the window and the projector break lines the same way. */
  useEffect(() => {
    document.execCommand('defaultParagraphSeparator', false, 'p')
    // Every command writes inline style, so a chosen typeface or size reaches the projector the same way a chosen weight does.
    document.execCommand('styleWithCSS', false, 'true')
  }, [])

  useEffect(() => {
    const onSelectionChange = () => { if (selectionInEditor()) sync() }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [])

  // A picker should close when the operator clicks past it, without waiting for a row to be pressed.
  useEffect(() => {
    if (!menu) return
    const wraps = { font: fontRef, color: colorRef, ink: inkRef, spacing: spacingRef }
    const wrap = wraps[menu].current
    const onDocMouseDown = (event: MouseEvent) => { if (!wrap?.contains(event.target as Node)) setMenu(null) }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [menu])

  function openFonts() {
    setMenu((current) => (current === 'font' ? null : 'font'))
    if (families.length || typeof window.queryLocalFonts !== 'function') return
    window.queryLocalFonts()
      .then((faces) => setFamilies([...new Set(faces.map((face) => face.family).filter(Boolean))].sort((a, b) => a.localeCompare(b))))
      // A refused read leaves the field usable: the name can still be typed.
      .catch(() => setFamilies([]))
  }

  const query = fontQuery.trim().toLowerCase()
  const slideFonts = WORD_FONTS.filter((font) => !query || font.label.toLowerCase().includes(query))
  const localFonts = (query ? families.filter((family) => family.toLowerCase().includes(query)) : families).slice(0, FONT_ROWS)
  const applyFont = (stack: string) => { setMenu(null); run('fontName', stack) }
  const applyTypedFont = () => { const name = fontQuery.trim(); if (name) applyFont(localFontStack(name)) }

  /** The commands know seven sizes only, so mark the words with the largest and rewrite it as a multiple of the slide's own text. */
  function applySize(raw: string) {
    const editor = editorRef.current
    const value = Number(raw)
    if (!editor || !Number.isFinite(value) || value <= 0) return
    const multiple = Math.min(SIZE_MAX, Math.max(SIZE_MIN, value))
    setSize(String(multiple))
    restoreCaret()
    document.execCommand('fontSize', false, '7')
    // Nothing else writes xxx-large, so the spans carrying it are exactly the words just touched.
    editor.querySelectorAll<HTMLElement>('span[style*="xxx-large"]').forEach((span) => { span.style.fontSize = `${multiple}em` })
    sync()
  }

  /** Any colour can be picked, so the ink is read back from the mark itself; taking the mark off takes the ink with it. */
  function applyHighlight(value: string, close = true) {
    restoreCaret()
    document.execCommand('hiliteColor', false, value)
    const editor = editorRef.current
    if (editor) for (const span of Array.from(editor.querySelectorAll<HTMLElement>('span[style]'))) {
      const mark = span.style.backgroundColor
      // A mark always takes the ink that reads on it, even over a colour chosen by hand - the room comes first.
      // A browser drops the background entirely rather than writing transparent, so the ink this set is marked to find it again.
      if (mark && mark !== 'transparent') { span.style.color = legibleInk(mark); span.dataset.markInk = '1'; continue }
      if (span.dataset.markInk) { span.style.color = ''; delete span.dataset.markInk }
    }
    setMenu(close ? null : menu)
    sync()
  }

  /** A chosen ink travels with the words; inherit hands them back to the colour the projection theme gives the slide. */
  function applyTextColor(value: string, close = true) {
    setInk(value)
    run('foreColor', value)
    if (close) setMenu(null)
  }

  /** The line under the caret is the one being aligned, so the button answers for it before the command redraws. */
  function applyTextAlign(value: CustomAlign) {
    setLineAlign(value)
    run(ALIGN_COMMANDS[value])
  }

  function applySpacing(value: CustomSpacing) {
    onSlideStyle?.({ ...slideStyle, spacing: value })
    setMenu(null)
  }

  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault()
    const html = event.clipboardData.getData('text/html')
    // A pasted document brings its own markup: keep its typography, drop anything else.
    if (html) document.execCommand('insertHTML', false, sanitizeRichText(html))
    else document.execCommand('insertText', false, event.clipboardData.getData('text/plain'))
    sync()
  }

  function onEditorKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!event.ctrlKey && !event.metaKey) return
    const command = { b: 'bold', i: 'italic', u: 'underline' }[event.key.toLowerCase()]
    if (!command) return
    event.preventDefault()
    document.execCommand(command, false)
    sync()
  }

  /** A toolbar press must not take the caret away from the words being formatted. */
  const keepCaret = (event: ReactMouseEvent) => { if ((event.target as Element).closest('button')) event.preventDefault() }

  const tool = (active: boolean) => `editor-tool${active ? ' active' : ''}`
  const step = (delta: number) => applySize(String((Math.round((Number(size) || 1) * 10) + delta * 10) / 10))

  return <div className="portion-editor">
    <style>{customSlideRules(slideStyle)}</style>
    <div className="editor-toolbar" onMouseDown={keepCaret}>
      <button type="button" className={tool(marks.bold)} onClick={() => run('bold')} title="Bold the selected words (Ctrl+B)" aria-label="Bold" aria-pressed={marks.bold}><Bold size={15}/></button>
      <button type="button" className={tool(marks.italic)} onClick={() => run('italic')} title="Italic (Ctrl+I)" aria-label="Italic" aria-pressed={marks.italic}><Italic size={15}/></button>
      <button type="button" className={tool(marks.underline)} onClick={() => run('underline')} title="Underline (Ctrl+U)" aria-label="Underline" aria-pressed={marks.underline}><Underline size={15}/></button>
      <button type="button" className={tool(marks.strike)} onClick={() => run('strikeThrough')} title="Strike through" aria-label="Strike through" aria-pressed={marks.strike}><Strikethrough size={15}/></button>
      <span className="editor-tool-sep" />
      {/* Both pickers are commands, not readouts: they return to their name after use, so a row of mixed faces never claims to be one of them. */}
      <span className="editor-combo" ref={fontRef}>
        <button type="button" className={menu === 'font' ? 'active' : ''} onClick={openFonts} title="Give the selected words a typeface" aria-label="Typeface" aria-haspopup="listbox" aria-expanded={menu === 'font'}><Type size={15}/><ChevronDown size={13}/></button>
        {menu === 'font' && <div className="font-picker" role="listbox" aria-label="Typefaces">
          <input autoFocus value={fontQuery} onChange={(event) => setFontQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyTypedFont() } if (event.key === 'Escape') setMenu(null) }} placeholder="Type a font name" aria-label="Filter typefaces" />
          {slideFonts.map((font) => <button type="button" key={font.label} role="option" aria-selected={false} onClick={() => applyFont(font.stack)} style={{ fontFamily: font.stack }}>{font.label}<small>slide</small></button>)}
          {localFonts.map((family) => <button type="button" key={family} role="option" aria-selected={false} onClick={() => applyFont(localFontStack(family))} style={{ fontFamily: family }}>{family}</button>)}
          {!localFonts.length && <p>{typeof window.queryLocalFonts === 'function' ? 'No typeface on this computer matches that name - press Enter to use it anyway.' : 'A browser tab cannot read this computer\'s fonts - type the name and press Enter.'}</p>}
        </div>}
      </span>
      <span className="editor-size-step" role="group" aria-label="Text size for the selected words">
        <button type="button" onClick={() => step(-0.1)} title="Make the selected words a tenth smaller" aria-label="Make the selected words smaller">&minus;</button>
        <input type="number" min={SIZE_MIN} max={SIZE_MAX} step={0.1} value={size} onChange={(event) => setSize(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applySize(event.currentTarget.value); event.currentTarget.blur() } }} onBlur={(event) => applySize(event.currentTarget.value)} aria-label="Text size as a multiple of the slide text" />
        <span className="size-unit">×</span>
        <button type="button" onClick={() => step(0.1)} title="Make the selected words a tenth bigger" aria-label="Make the selected words bigger">+</button>
      </span>
      <span className="editor-tool-sep" />
      <span className="editor-combo" ref={inkRef}>
        <button type="button" className={menu === 'ink' ? 'active' : ''} onClick={() => setMenu((current) => (current === 'ink' ? null : 'ink'))} title="Give the selected words a colour" aria-label="Text colour" aria-haspopup="menu" aria-expanded={menu === 'ink'}><InkMark color={ink}/><ChevronDown size={13}/></button>
        {menu === 'ink' && <div className="swatch-picker" role="menu" aria-label="Text colour of the selected words">
          <button type="button" role="menuitem" onClick={() => applyTextColor('inherit')}><span className="swatch none" aria-hidden="true"/>Slide colour</button>
          {TEXT_COLORS.map((colour) => <button type="button" role="menuitem" key={colour.value} onClick={() => applyTextColor(colour.value)}><span className="swatch" style={{ background: colour.value }} aria-hidden="true"/>{colour.label}</button>)}
          <label className="swatch-custom"><input type="color" value={ink === 'inherit' ? TEXT_COLORS[0]!.value : ink} onChange={(event) => applyTextColor(event.target.value, false)} aria-label="Any text colour"/><span>Any colour</span></label>
        </div>}
      </span>
      <span className="editor-combo" ref={colorRef}>
        <button type="button" className={menu === 'color' ? 'active' : ''} onClick={() => setMenu((current) => (current === 'color' ? null : 'color'))} title="Highlight behind the selected words" aria-label="Highlight colour" aria-haspopup="menu" aria-expanded={menu === 'color'}><Highlighter size={15}/><ChevronDown size={13}/></button>
        {menu === 'color' && <div className="swatch-picker" role="menu" aria-label="Highlight colour">
          {HIGHLIGHT_COLORS.map((colour) => <button type="button" role="menuitem" key={colour.value} onClick={() => { setHighlight(colour.value); applyHighlight(colour.value) }}><span className="swatch" style={{ background: colour.value }} aria-hidden="true"/>{colour.label}</button>)}
          <button type="button" role="menuitem" onClick={() => applyHighlight('transparent')}><span className="swatch none" aria-hidden="true"/>No colour</button>
          <label className="swatch-custom"><input type="color" value={highlight} onChange={(event) => { setHighlight(event.target.value); applyHighlight(event.target.value, false) }} aria-label="Any highlight colour"/><span>Any colour</span></label>
        </div>}
      </span>
      <span className="editor-tool-sep" />
      {/* The three marks shape the line the caret stands on, so a portion can mix a left verse with a centered response. */}
      <button type="button" className={tool(lineAlign === 'left')} onClick={() => applyTextAlign('left')} title="Align the line of the selected words left" aria-label="Align left" aria-pressed={lineAlign === 'left'}><TextAlignStart size={15}/></button>
      <button type="button" className={tool(lineAlign === 'center')} onClick={() => applyTextAlign('center')} title="Center the line of the selected words on the screen" aria-label="Center the line" aria-pressed={lineAlign === 'center'}><TextAlignCenter size={15}/></button>
      <button type="button" className={tool(lineAlign === 'justify')} onClick={() => applyTextAlign('justify')} title="Justify both edges of the line of the selected words" aria-label="Justify the line" aria-pressed={lineAlign === 'justify'}><TextAlignJustify size={15}/></button>
      <button type="button" onClick={() => run('formatBlock', '<h2>')} title="Make the line a heading" aria-label="Heading"><Heading size={15}/></button>
      <button type="button" className={tool(marks.bullets)} onClick={() => run('insertUnorderedList')} title="Bulleted list" aria-label="Bulleted list" aria-pressed={marks.bullets}><List size={15}/></button>
      <button type="button" className={tool(marks.numbers)} onClick={() => run('insertOrderedList')} title="Numbered list" aria-label="Numbered list" aria-pressed={marks.numbers}><ListOrdered size={15}/></button>
      <span className="editor-tool-sep" />
      <button type="button" onClick={() => run('removeFormat')} title="Take the formatting off the selected words" aria-label="Clear formatting"><Eraser size={15}/></button>
      {onSlideStyle && <>
        <span className="editor-tool-sep" />
        {/* Only the room between the lines still belongs to the whole slide rather than to the words, so it keeps a menu of its own. */}
        <span className="editor-combo" ref={spacingRef}>
          <button type="button" className={menu === 'spacing' ? 'active' : ''} onClick={() => setMenu((current) => (current === 'spacing' ? null : 'spacing'))} title="Line spacing of the whole slide" aria-label="Line spacing" aria-haspopup="menu" aria-expanded={menu === 'spacing'}><SlidersHorizontal size={15}/><ChevronDown size={13}/></button>
          {menu === 'spacing' && <div className="swatch-picker" role="menu" aria-label="Line spacing of the whole slide">
            {SPACING_STEPS.map((value) => <button type="button" role="menuitem" key={value} onClick={() => applySpacing(value)}>
              <SpacingMark gap={SPACING_GAPS[value]}/>{SPACING_NAMES[value]}<small>{ROOM_LINE_HEIGHTS[value]} line height</small>
            </button>)}
          </div>}
        </span>
      </>}
      {slideTools && <span className="editor-tool-cluster"><span className="editor-tool-sep" />{slideTools}</span>}
    </div>
    <div className="custom-editor-wrap">
      {!hasText && <span className="editor-placeholder">{placeholder}</span>}
      <div ref={editorRef} className="custom-slide custom-editor" contentEditable role="textbox" aria-multiline="true" aria-label={label} onInput={sync} onPaste={onPaste} onKeyDown={onEditorKeyDown} onMouseUp={sync} onKeyUp={sync} onBlur={remember} />
    </div>
  </div>
}
