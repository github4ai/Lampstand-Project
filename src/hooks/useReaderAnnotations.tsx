import { Highlighter, Trash2, X } from 'lucide-react'
import { useMemo, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'

interface ReaderAnnotation { id: string; scope: string; quote: string; note: string; color: string; createdAt: string }
const KEY = 'lampstand-reader-annotations-v1'
const COLORS = ['#ffe889', '#bdecc8', '#b9ddf8', '#f5c4dc', '#ffd2a8', '#d8c4f5', '#b8eee7', '#d7ef9b']

function load(): ReaderAnnotation[] { try { return JSON.parse(localStorage.getItem(KEY) || '[]') as ReaderAnnotation[] } catch { return [] } }
function escapeHtml(text: string) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')
}

export function useReaderAnnotations(scope: string) {
  const [all, setAll] = useState<ReaderAnnotation[]>(load)
  const [quote, setQuote] = useState('')
  const [note, setNote] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [opened, setOpened] = useState<ReaderAnnotation | null>(null)
  const [position, setPosition] = useState({ x: 24, y: 24 })
  const annotations = useMemo(() => all.filter((item) => item.scope === scope), [all, scope])

  function popupAt(event: { clientX: number; clientY: number }) {
    setPosition({ x: Math.max(12, Math.min(event.clientX, window.innerWidth - 430)), y: Math.max(12, Math.min(event.clientY + 12, window.innerHeight - 260)) })
  }
  function captureSelection(event: ReactMouseEvent<HTMLElement>) {
    const selection = window.getSelection()?.toString().trim() || ''
    if (selection.length < 2) return
    setOpened(null); setQuote(selection); setNote(''); popupAt(event)
  }
  function persist(next: ReaderAnnotation[]) { setAll(next); localStorage.setItem(KEY, JSON.stringify(next)) }
  function save() {
    if (!quote) return
    persist([...all, { id: crypto.randomUUID(), scope, quote, note: note.trim(), color, createdAt: new Date().toISOString() }])
    setQuote(''); setNote('')
  }
  function remove(id: string) { persist(all.filter((item) => item.id !== id)); setOpened(null) }
  function highlight(text: string): ReactNode {
    const matches = annotations.map((annotation) => ({ annotation, start: text.toLocaleLowerCase().indexOf(annotation.quote.toLocaleLowerCase()) })).filter((item) => item.start >= 0).sort((a, b) => a.start - b.start)
    if (!matches.length) return text
    const nodes: ReactNode[] = []; let cursor = 0
    for (const item of matches) {
      if (item.start < cursor) continue
      nodes.push(text.slice(cursor, item.start))
      const end = item.start + item.annotation.quote.length
      nodes.push(<mark key={item.annotation.id} className="reader-highlight" style={{ backgroundColor: item.annotation.color }} title={item.annotation.note || 'Highlighted passage'} tabIndex={0} role="button" onClick={(event) => { event.stopPropagation(); setQuote(''); setOpened(item.annotation); popupAt(event) }}>{text.slice(item.start, end)}</mark>)
      cursor = end
    }
    nodes.push(text.slice(cursor)); return nodes
  }
  function highlightHtml(text: string) {
    const matches = annotations.map((annotation) => ({ annotation, start: text.toLocaleLowerCase().indexOf(annotation.quote.toLocaleLowerCase()) })).filter((item) => item.start >= 0).sort((a, b) => a.start - b.start)
    if (!matches.length) return escapeHtml(text)
    let html = ''; let cursor = 0
    for (const item of matches) {
      if (item.start < cursor) continue
      html += escapeHtml(text.slice(cursor, item.start))
      const end = item.start + item.annotation.quote.length
      const safeColor = /^#[0-9a-f]{6}$/i.test(item.annotation.color) ? item.annotation.color : COLORS[0]
      html += `<mark style="background-color:${safeColor}">${escapeHtml(text.slice(item.start, end))}</mark>`
      cursor = end
    }
    return html + escapeHtml(text.slice(cursor))
  }
  const popup = quote || opened ? <div className="reader-annotation-popup" role="dialog" style={{ left: position.x, top: position.y }}>
    <header><Highlighter size={16} /><strong>{opened ? 'Saved annotation' : 'Highlight selection'}</strong><button type="button" onClick={() => { setQuote(''); setOpened(null) }}><X size={15} /></button></header>
    <blockquote>{opened?.quote || quote}</blockquote>
    {opened ? <>{opened.note ? <p>{opened.note}</p> : <p className="empty">No annotation was added.</p>}<button className="delete" type="button" onClick={() => remove(opened.id)}><Trash2 size={14} /> Delete</button></> : <>
      <div className="reader-annotation-colors">{COLORS.map((item) => <button type="button" aria-label={`Use ${item}`} className={color === item ? 'active' : ''} style={{ backgroundColor: item }} key={item} onClick={() => setColor(item)} />)}<label title="Custom highlight color"><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /><span>Custom</span></label></div>
      <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add an optional annotation…" rows={3} /><button className="save" type="button" onClick={save}>Save highlight</button>
    </>}
  </div> : null
  return { captureSelection, highlight, highlightHtml, popup, count: annotations.length }
}
