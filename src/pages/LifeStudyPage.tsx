import { BookMarked, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, Maximize2, Minimize2, Pause, Play, Search, Square } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getLifeStudyBooks, getLifeStudyMessage, getLifeStudyMessages } from '../api/lifeStudy'
import type { LifeStudyBlock, LifeStudyBook, LifeStudyMessage, LifeStudyMessageSummary } from '../api/lifeStudy'
import { useReaderAnnotations } from '../hooks/useReaderAnnotations'
import '../styles/life-study.css'
import '../styles/reader-annotations.css'

function LifeStudyPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const linkedLocation = new URLSearchParams(location.search)
  const savedLocation = localStorage.getItem('aios-life-study-location')?.split(':')
  const [books, setBooks] = useState<LifeStudyBook[]>([])
  const [bookSlug, setBookSlug] = useState(linkedLocation.get('book') || savedLocation?.[0] || 'genesis')
  const [messages, setMessages] = useState<LifeStudyMessageSummary[]>([])
  const [messageNumber, setMessageNumber] = useState(Number(linkedLocation.get('message')) || Number(savedLocation?.[1]) || 1)
  const [message, setMessage] = useState<LifeStudyMessage | null>(null)
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reading, setReading] = useState(false)
  const [paused, setPaused] = useState(false)
  const [copied, setCopied] = useState(false)
  const [fullPage, setFullPage] = useState(false)
  const [readingPanelVisible, setReadingPanelVisible] = useState(true)
  const filteredMessages = useMemo(() => messages.filter((item) => !query.trim() || `${item.number} ${item.title}`.toLowerCase().includes(query.trim().toLowerCase())), [messages, query])
  const selectedBlocks = useMemo(() => message?.blocks.filter((block) => selectedIds.includes(block.id)) ?? [], [message, selectedIds])
  const visibleBlocks = useMemo(() => {
    if (!message) return []
    const title = message.message.title.trim().toLowerCase()
    return message.blocks.filter((block, index) => {
      const text = block.text.trim().toLowerCase()
      if (index < 3 && /^message\s+\d+$/i.test(block.text.trim())) return false
      if (index < 4 && block.type === 'heading' && text === title) return false
      return true
    })
  }, [message])
  const annotations = useReaderAnnotations(`life-study:${bookSlug}:${messageNumber}`)

  useEffect(() => {
    const controller = new AbortController()
    getLifeStudyBooks(controller.signal).then(({ books }) => setBooks(books)).catch((reason: unknown) => { if (controller.signal.aborted) return; setError(reason instanceof Error ? reason.message : 'Unable to load Life-Study books.') })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setQuery('')
    getLifeStudyMessages(bookSlug, controller.signal).then(({ messages }) => {
      setMessages(messages)
      if (messages.length) {
        setMessageNumber(
          (current) =>
            messages.some(
              (item) =>
                item.number === current,
            )
              ? current
              : messages[0].number,
        )
      }
    }).catch((reason: unknown) => { if (controller.signal.aborted) return; setError(reason instanceof Error ? reason.message : 'Unable to load messages.') })
    return () => controller.abort()
  }, [bookSlug])

  useEffect(() => {
    if (!messages.length) return
    const controller = new AbortController()
    setLoading(true); setError(''); setSelectedIds([]); window.speechSynthesis?.cancel(); setReading(false); setPaused(false)
    getLifeStudyMessage(bookSlug, messageNumber, controller.signal).then(setMessage).catch((reason: unknown) => { if (controller.signal.aborted) return; setError(reason instanceof Error ? reason.message : 'Unable to load this message.') }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [bookSlug, messageNumber, messages.length])

  useEffect(() => () => window.speechSynthesis?.cancel(), [])
  useEffect(() => {
    document.body.classList.toggle('life-study-full-page-active', fullPage)
    if (fullPage) setReadingPanelVisible(true)
    return () => document.body.classList.remove('life-study-full-page-active')
  }, [fullPage])
  useEffect(() => { localStorage.setItem('aios-life-study-location', `${bookSlug}:${messageNumber}`) }, [bookSlug, messageNumber])
  useEffect(() => {
    if (!message) return
    const block = Number(new URLSearchParams(location.search).get('block'))
    if (!block) return
    setSelectedIds([block])
    window.setTimeout(() => document.querySelector<HTMLElement>(`[data-life-study-block="${block}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150)
  }, [message, location.search])

  function changeBook(slug: string) { setBookSlug(slug); setMessageNumber(1) }
  function moveMessage(direction: -1 | 1) {
    const index = messages.findIndex((item) => item.number === messageNumber)
    const next = messages[index + direction]
    if (next) setMessageNumber(next.number)
  }
  function toggleBlock(block: LifeStudyBlock) { setSelectedIds((current) => current.includes(block.id) ? current.filter((id) => id !== block.id) : [...current, block.id]) }
  function selectionText() { return selectedBlocks.map((block) => block.text).join('\n\n') }
  function toggleReading() {
    if (reading && paused) { window.speechSynthesis.resume(); setPaused(false); return }
    if (reading) { window.speechSynthesis.pause(); setPaused(true); return }
    const text = selectionText(); if (!text) return
    const utterance = new SpeechSynthesisUtterance(text); utterance.rate = .9
    utterance.onend = utterance.onerror = () => { setReading(false); setPaused(false) }
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance); setReading(true)
  }
  function stopReading() { window.speechSynthesis.cancel(); setReading(false); setPaused(false) }
  async function copySelection() { const text = selectionText() || message?.blocks.map((block) => block.text).join('\n\n') || ''; if (!text) return; await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1600) }
  function renderBlock(block: LifeStudyBlock) {
    return block.segments.map((segment, index) => segment.type === 'text' ? <span key={index}>{annotations.highlight(segment.text)}</span> : <button type="button" className="life-study-bible-link" key={index} onClick={(event) => {
      event.stopPropagation()
      const returnParams = new URLSearchParams({ book: bookSlug, message: String(messageNumber), block: String(block.id) })
      navigate(`/recovery-bible?book=${encodeURIComponent(segment.bookSlug)}&chapter=${segment.chapter}&verse=${segment.verse}&verseEnd=${segment.verseEnd || segment.verse}&from=life-study&return=${encodeURIComponent(returnParams.toString())}`)
    }}>{segment.text}</button>)
  }

  return <section className={`life-study-page${fullPage ? ' reader-full-page' : ''}`}>
    <header className="life-study-header"><span><BookMarked size={25} /></span><div><h1>Life-Study of the Bible</h1><p>Read the complete locally stored Life-Study messages.</p></div></header>
    <div className={`life-study-toolbar${fullPage && !readingPanelVisible ? ' full-page-hidden' : ''}`}>
      <label>Book<select value={bookSlug} onChange={(event) => changeBook(event.target.value)}>{books.map((book) => <option key={book.slug} value={book.slug}>{book.name} ({book.messages})</option>)}</select></label>
      <label>Message<select value={messageNumber} onChange={(event) => setMessageNumber(Number(event.target.value))}>{messages.map((item) => <option key={item.number} value={item.number}>{item.number}. {item.title}</option>)}</select></label>
      <div className="life-study-selection-actions">
        <button type="button" onClick={() => setFullPage((value) => !value)}>{fullPage ? <Minimize2 size={16} /> : <Maximize2 size={16} />}{fullPage ? 'Exit' : 'Full page'}</button>
        {fullPage ? <button type="button" onClick={() => setReadingPanelVisible(false)}><ChevronUp size={16} />Hide panel</button> : null}
        <button type="button" disabled={!selectedIds.length} onClick={toggleReading}>{reading && !paused ? <Pause size={16} /> : <Play size={16} />}{reading && !paused ? 'Pause' : paused ? 'Resume' : `Read${selectedIds.length ? ` ${selectedIds.length}` : ''}`}</button>
        {reading ? <button type="button" onClick={stopReading}><Square size={14} />Stop</button> : null}
        <button type="button" disabled={!message?.blocks.length} onClick={() => void copySelection()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copied' : selectedIds.length ? `Copy ${selectedIds.length}` : 'Copy message'}</button>
      </div>
    </div>
    {fullPage && !readingPanelVisible ? <button type="button" className="life-study-panel-restore" onClick={() => setReadingPanelVisible(true)}><ChevronDown size={17} /> Book &amp; Message</button> : null}
    <div className="life-study-message-finder"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search message titles or numbers" />{query ? <div>{filteredMessages.slice(0, 12).map((item) => <button key={item.number} type="button" onClick={() => { setMessageNumber(item.number); setQuery('') }}><strong>Message {item.number}</strong><span>{item.title}</span></button>)}</div> : null}</div>
    {error ? <div className="life-study-error">{error}</div> : null}
    <article className="life-study-reader" aria-busy={loading} onMouseUp={annotations.captureSelection}>
      <header><span>Life-Study of {message?.book.name}</span><small>Message {messageNumber}</small><h2>{message?.message.title}</h2><p>Select one or more paragraphs or headings to read or copy.</p></header>
      {loading ? <p className="life-study-loading">Loading message…</p> : visibleBlocks.map((block) => block.type === 'heading'
        ? <div key={block.id} data-life-study-block={block.id} role="button" tabIndex={0} aria-pressed={selectedIds.includes(block.id)} className={`life-study-block heading level-${block.level} ${selectedIds.includes(block.id) ? 'selected' : ''}`} onClick={() => toggleBlock(block)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') toggleBlock(block) }}>{renderBlock(block)}</div>
        : <div key={block.id} data-life-study-block={block.id} role="button" tabIndex={0} aria-pressed={selectedIds.includes(block.id)} className={`life-study-block paragraph ${selectedIds.includes(block.id) ? 'selected' : ''}`} onClick={() => toggleBlock(block)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') toggleBlock(block) }}>{renderBlock(block)}</div>)}
    </article>
    {annotations.popup}
    <nav className="life-study-bottom-nav"><strong>{message?.book.name} · Message {messageNumber}</strong><div><button type="button" onClick={() => moveMessage(-1)} disabled={messages[0]?.number === messageNumber}><ChevronLeft size={18} />Previous</button><button type="button" onClick={() => moveMessage(1)} disabled={messages.at(-1)?.number === messageNumber}>Next<ChevronRight size={18} /></button></div></nav>
  </section>
}

export default LifeStudyPage
