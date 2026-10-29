import {
  useEffect,
  useState,
} from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  Clipboard,
  Download,
  FileText,
  Hash,
  Layers3,
  Bookmark,
  MessageSquareText,
  Maximize2,
  Minimize2,
  Search,
  StickyNote,
} from 'lucide-react'
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'

import {
  getChunkContext,
  getKnowledgeViewer,
} from '../../api/knowledgeViewer'

import ContextChunk from '../../components/knowledge/viewer/ContextChunk'
import { useReaderAnnotations } from '../../hooks/useReaderAnnotations'
import '../../styles/reader-annotations.css'

import type {
  KnowledgeContextResponse,
  KnowledgeViewerResponse,
} from '../../types/knowledgeViewer'

const CONTEXT_RADIUS_KEY = 'aios-studio-knowledge-context-radius-v1'
const READER_SIZE_KEY = 'aios-studio-knowledge-reader-size-v1'
const VIEWER_BOOKMARKS_KEY = 'aios-studio-knowledge-bookmarks-v1'
const VIEWER_NOTES_KEY = 'aios-studio-knowledge-notes-v1'
const CHAT_HANDOFF_KEY = 'aios-studio-chat-handoff-v1'

function loadContextRadius() {
  const value = Number(localStorage.getItem(CONTEXT_RADIUS_KEY) ?? '1')
  return Number.isInteger(value) && value >= 0 && value <= 3 ? value : 1
}

function loadReaderSize(): 'compact' | 'comfortable' | 'large' {
  const value = localStorage.getItem(READER_SIZE_KEY)
  return value === 'compact' || value === 'large' ? value : 'comfortable'
}

function KnowledgeViewerPage() {
  const navigate =
    useNavigate()

  const {
    categoryName = '',
    documentName = '',
    chunkId = '',
  } = useParams()

  const [
    searchParams,
  ] = useSearchParams()

  const searchQuery =
    searchParams.get('q') ?? ''

  const annotations = useReaderAnnotations(`knowledge:${categoryName}:${documentName}:${chunkId}`)

  const returnSearchPath = searchParams.size > 0
    ? `/knowledge/search?${searchParams.toString()}`
    : '/knowledge/search'

  const [
    data,
    setData,
  ] =
    useState<KnowledgeViewerResponse | null>(
      null,
    )

  const [
    context,
    setContext,
  ] =
    useState<KnowledgeContextResponse | null>(
      null,
    )

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    )

  const [
    jumpChunk,
    setJumpChunk,
  ] = useState(chunkId)

  const [
    copyStatus,
    setCopyStatus,
  ] = useState<'idle' | 'copied' | 'copied-context' | 'failed'>('idle')

  const [
    contextRadius,
    setContextRadius,
  ] = useState(loadContextRadius)

  const [
    readerSize,
    setReaderSize,
  ] = useState(loadReaderSize)

  const [retryKey, setRetryKey] = useState(0)
  const [findText, setFindText] = useState('')
  const [note, setNote] = useState('')
  const [bookmarked, setBookmarked] = useState(false)
  const [fullPage, setFullPage] = useState(false)

  useEffect(() => { document.body.classList.toggle('reader-full-page-active', fullPage); return () => document.body.classList.remove('reader-full-page-active') }, [fullPage])

  useEffect(() => {
    localStorage.setItem(CONTEXT_RADIUS_KEY, String(contextRadius))
  }, [contextRadius])

  useEffect(() => {
    localStorage.setItem(READER_SIZE_KEY, readerSize)
  }, [readerSize])

  const numericChunkId =
    Number(chunkId)

  useEffect(() => {
    setJumpChunk(chunkId)
    setCopyStatus('idle')
    const key = `${categoryName}/${documentName}/${chunkId}`
    try {
      const bookmarks = JSON.parse(localStorage.getItem(VIEWER_BOOKMARKS_KEY) ?? '[]') as string[]
      const notes = JSON.parse(localStorage.getItem(VIEWER_NOTES_KEY) ?? '{}') as Record<string, string>
      setBookmarked(bookmarks.includes(key)); setNote(notes[key] ?? '')
    } catch { setBookmarked(false); setNote('') }
  }, [categoryName, documentName, chunkId])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select, button, a, [contenteditable="true"]')) return
      if (event.key === 'ArrowLeft' && data && data.chunk.previous_chunk_id !== null) {
        event.preventDefault()
        openChunk(data.chunk.previous_chunk_id)
      }
      if (event.key === 'ArrowRight' && data && data.chunk.next_chunk_id !== null) {
        event.preventDefault()
        openChunk(data.chunk.next_chunk_id)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  useEffect(() => {
    const controller =
      new AbortController()

    async function loadViewer() {
      if (
        !categoryName ||
        !documentName ||
        !Number.isInteger(
          numericChunkId,
        )
      ) {
        setError(
          'Invalid Knowledge Viewer URL.',
        )
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const [
          response,
          contextResponse,
        ] = await Promise.all([
          getKnowledgeViewer(
            categoryName,
            documentName,
            numericChunkId,
            controller.signal,
          ),
          getChunkContext(
            categoryName,
            documentName,
            numericChunkId,
            contextRadius,
            controller.signal,
          ),
        ])

        setData(response)
        setContext(contextResponse)
      } catch (loadError) {
        if (
          loadError instanceof
            DOMException &&
          loadError.name ===
            'AbortError'
        ) {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : (
                'Unable to load this ' +
                'Knowledge chunk.'
              ),
        )
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setLoading(false)
        }
      }
    }

    void loadViewer()

    return () => {
      controller.abort()
    }
  }, [
    categoryName,
    documentName,
    numericChunkId,
    contextRadius,
    retryKey,
  ])

  function openChunk(
    targetChunkId: number | null,
  ) {
    if (
      targetChunkId === null
    ) {
      return
    }

    const parameters = searchParams.toString()
    const query = parameters ? `?${parameters}` : ''

    navigate(
      (
        `/knowledge/view/` +
        `${encodeURIComponent(categoryName)}/` +
        `${encodeURIComponent(documentName)}/` +
        `${targetChunkId}` +
        query
      ),
    )
  }

  async function copyChunk() {
    if (!data) return
    try {
      await navigator.clipboard.writeText(data.chunk.text)
      setCopyStatus('copied')
      window.setTimeout(() => setCopyStatus('idle'), 1800)
    } catch {
      setCopyStatus('failed')
    }
  }

  async function copyContext() {
    if (!context) return
    const text = context.chunks.map((item) =>
      [`Chunk ${item.chunk}${item.page !== null ? ` · Page ${item.page}` : ''}`, item.text].join('\n'))
      .join('\n\n---\n\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus('copied-context')
      window.setTimeout(() => setCopyStatus('idle'), 1800)
    } catch {
      setCopyStatus('failed')
    }
  }

  function downloadContext() {
    if (!data || !context) return
    const text = context.chunks.map((item) =>
      [`Chunk ${item.chunk}${item.page !== null ? ` · Page ${item.page}` : ''}`, item.text].join('\n'))
      .join('\n\n---\n\n')
    const first = context.chunks[0]?.chunk ?? data.chunk.chunk
    const last = context.chunks.at(-1)?.chunk ?? data.chunk.chunk
    const header = `${data.chunk.source}\nCategory: ${data.category}\nChunks: ${first}–${last}\n\n`
    const file = new Blob([header + text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    const source = data.chunk.source.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
    link.href = url
    link.download = `${source || 'knowledge'}-chunks-${first}-${last}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  function downloadChunk() {
    if (!data) return
    const current = data.chunk
    const header = [current.source, `Category: ${current.category}`, `Chunk: ${current.chunk}`,
      current.page !== null ? `Page: ${current.page}` : null].filter(Boolean).join('\n')
    const file = new Blob([`${header}\n\n${current.text}`], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    const name = `${current.source}-chunk-${current.chunk}`.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
    link.href = url
    link.download = `${name || `chunk-${current.chunk}`}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  function toggleBookmark() {
    const key = `${categoryName}/${documentName}/${chunkId}`
    let bookmarks: string[] = []
    try { bookmarks = JSON.parse(localStorage.getItem(VIEWER_BOOKMARKS_KEY) ?? '[]') as string[] } catch { /* start clean */ }
    const next = bookmarks.includes(key) ? bookmarks.filter((item) => item !== key) : [key, ...bookmarks]
    localStorage.setItem(VIEWER_BOOKMARKS_KEY, JSON.stringify(next)); setBookmarked(next.includes(key))
  }

  function saveNote(value: string) {
    setNote(value)
    const key = `${categoryName}/${documentName}/${chunkId}`
    let notes: Record<string, string> = {}
    try { notes = JSON.parse(localStorage.getItem(VIEWER_NOTES_KEY) ?? '{}') as Record<string, string> } catch { /* start clean */ }
    if (value.trim()) notes[key] = value
    else delete notes[key]
    localStorage.setItem(VIEWER_NOTES_KEY, JSON.stringify(notes))
  }

  function askAboutPassage() {
    if (!data) return
    localStorage.setItem(CHAT_HANDOFF_KEY, JSON.stringify({
      question: `Using this passage from ${data.chunk.source} (chunk ${data.chunk.chunk}${data.chunk.page !== null ? `, page ${data.chunk.page}` : ''}), help me understand:\n\n${data.chunk.text}`,
      agentId: data.category.toLocaleLowerCase() === 'ministry' ? 'ministry' : 'general',
    }))
    navigate('/chat')
  }

  function renderChunkText(text: string) {
    const term = findText.trim()
    if (!term) return annotations.highlight(text)
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
    return parts.map((part, index) => part.toLocaleLowerCase() === term.toLocaleLowerCase()
      ? <mark key={`${index}-${part}`}>{part}</mark> : <span key={`${index}-${part}`}>{annotations.highlight(part)}</span>)
  }

  if (loading) {
    return (
      <section className="knowledge-viewer-page">
        <div className="knowledge-viewer-state">
          Loading chunk...
        </div>
      </section>
    )
  }

  if (
    error ||
    !data ||
    !context
  ) {
    return (
      <section className="knowledge-viewer-page">
        <div className="knowledge-viewer-state knowledge-viewer-error">
          <h1>
            Unable to open chunk
          </h1>

          <p>
            {error ??
              'The chunk is unavailable.'}
          </p>

          <button type="button" onClick={() => setRetryKey((value) => value + 1)}>
            Try again
          </button>

          <Link to={returnSearchPath}>
            Return to Search
          </Link>
        </div>
      </section>
    )
  }

  const chunk =
    data.chunk

  return (
    <section className={`knowledge-viewer-page${fullPage ? ' reader-full-page' : ''}`}>
      <header className="knowledge-viewer-header">
        <div>
          <Link
            to={returnSearchPath}
            className="knowledge-viewer-back"
          >
            <ArrowLeft
              size={15}
              aria-hidden="true"
            />

            Back to Search
          </Link>

          <div className="knowledge-viewer-heading">
            <span className="knowledge-viewer-file-icon">
              <FileText
                size={21}
                aria-hidden="true"
              />
            </span>

            <div>
              <h1>
                {chunk.source}
              </h1>

              <p>
                {data.category}
                {' · '}
                Chunk {chunk.chunk}
                {' · '}
                Position {chunk.position}
                {' of '}
                {data.statistics.chunks}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="knowledge-viewer-grid">
        <main className="knowledge-viewer-document">
          <div className="knowledge-viewer-document-toolbar">
            <div>
              <span>
                Chunk {chunk.chunk}
              </span>

              {chunk.page !== null && (
                <span>
                  Page {chunk.page}
                </span>
              )}
            </div>

            <div className="knowledge-viewer-toolbar-actions">
              <button type="button" onClick={() => setFullPage((value) => !value)} title={fullPage ? 'Exit full-page reading' : 'Open full-page reading'}>
                {fullPage ? <Minimize2 size={14} /> : <Maximize2 size={14} />} {fullPage ? 'Exit' : 'Full page'}
              </button>
              <label>Text size
                <select value={readerSize} onChange={(event) => setReaderSize(event.target.value as typeof readerSize)}
                  aria-label="Knowledge reader text size">
                  <option value="compact">Compact</option><option value="comfortable">Comfortable</option>
                  <option value="large">Large</option>
                </select>
              </label>
              <label>Context
                <select value={contextRadius} onChange={(event) => setContextRadius(Number(event.target.value))}
                  aria-label="Surrounding context chunks on each side">
                  <option value={0}>Current only</option><option value={1}>1 each side</option>
                  <option value={2}>2 each side</option><option value={3}>3 each side</option>
                </select>
              </label>
              <label className="knowledge-viewer-find"><Search size={13} />
                <input value={findText} onChange={(event) => setFindText(event.target.value)} placeholder="Find in context" aria-label="Find text in displayed context" />
              </label>
              <span>{chunk.word_count} words</span>
              <button type="button" onClick={() => void copyChunk()} title="Copy current chunk text">
                {copyStatus === 'copied' ? <Check size={14} /> : <Clipboard size={14} />}
                {copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy failed' : 'Copy chunk'}
              </button>
              {context.chunks.length > 1 && <button type="button" onClick={() => void copyContext()}
                title="Copy current and surrounding chunks">
                {copyStatus === 'copied-context' ? <Check size={14} /> : <Clipboard size={14} />}
                {copyStatus === 'copied-context' ? 'Context copied' : copyStatus === 'failed' ? 'Copy failed' : 'Copy context'}
              </button>}
              {context.chunks.length > 1 && <button type="button" onClick={downloadContext}
                title="Download current and surrounding chunks">
                <Download size={14} /> Download context
              </button>}
              <button type="button" onClick={downloadChunk} title="Download current chunk as text">
                <Download size={14} /> Download
              </button>
            </div>
          </div>

          <div className={`knowledge-viewer-text reader-${readerSize}`} onMouseUp={annotations.captureSelection}>
            {context.chunks.map((contextChunk) => (
              <ContextChunk
                key={contextChunk.id}
                title={
                  contextChunk.is_current
                    ? 'Current Chunk'
                    : contextChunk.chunk < chunk.chunk
                      ? 'Previous Chunk'
                      : 'Next Chunk'
                }
                chunk={contextChunk.chunk}
                page={contextChunk.page}
                text={contextChunk.text}
                renderedText={renderChunkText(contextChunk.text)}
                isCurrent={contextChunk.is_current}
                onOpen={contextChunk.is_current ? undefined : () => openChunk(contextChunk.chunk)}
              />
            ))}
          </div>
          {annotations.popup}

          <nav className="knowledge-viewer-navigation">
            <button
              type="button"
              aria-keyshortcuts="ArrowLeft"
              title="Previous chunk (Left arrow)"
              disabled={
                chunk.previous_chunk_id ===
                null
              }
              onClick={() => {
                openChunk(
                  chunk.previous_chunk_id,
                )
              }}
            >
              <ChevronLeft
                size={17}
                aria-hidden="true"
              />

              Previous

              {chunk.previous_chunk_id !==
                null && (
                <span>
                  Chunk {
                    chunk.previous_chunk_id
                  }
                </span>
              )}
            </button>

            <form onSubmit={(event) => {
              event.preventDefault()
              const target = Number(jumpChunk)
              if (Number.isInteger(target) && target >= 1 && target <= data.statistics.chunks) openChunk(target)
            }}>
              <label htmlFor="knowledge-jump-chunk">Jump to</label>
              <input id="knowledge-jump-chunk" type="number" min={1} max={data.statistics.chunks}
                value={jumpChunk} onChange={(event) => setJumpChunk(event.target.value)}
                aria-label={`Chunk number from 1 to ${data.statistics.chunks}`} />
              <button type="submit">Go</button>
            </form>

            <button
              type="button"
              aria-keyshortcuts="ArrowRight"
              title="Next chunk (Right arrow)"
              disabled={
                chunk.next_chunk_id ===
                null
              }
              onClick={() => {
                openChunk(
                  chunk.next_chunk_id,
                )
              }}
            >
              Next

              {chunk.next_chunk_id !==
                null && (
                <span>
                  Chunk {
                    chunk.next_chunk_id
                  }
                </span>
              )}

              <ArrowRight
                size={17}
                aria-hidden="true"
              />
            </button>
          </nav>
        </main>

        <aside className="knowledge-viewer-sidebar">
          <section className="knowledge-viewer-panel">
            <h2>
              Metadata
            </h2>

            <dl>
              <div>
                <dt>
                  Category
                </dt>
                <dd>
                  {chunk.category}
                </dd>
              </div>

              <div>
                <dt>
                  Document
                </dt>
                <dd>
                  {chunk.source}
                </dd>
              </div>

              <div>
                <dt>
                  Chunk
                </dt>
                <dd>
                  {chunk.chunk}
                </dd>
              </div>

              <div>
                <dt>
                  Vector ID
                </dt>
                <dd>
                  {chunk.vector_id ??
                    'N/A'}
                </dd>
              </div>

              <div>
                <dt>
                  Words
                </dt>
                <dd>
                  {chunk.word_count}
                </dd>
              </div>

              <div>
                <dt>
                  Characters
                </dt>
                <dd>
                  {chunk.character_count}
                </dd>
              </div>
            </dl>
          </section>

          <section className="knowledge-viewer-panel">
            <h2>
              Document Index
            </h2>

            <div className="knowledge-viewer-index-stat">
              <Layers3
                size={16}
                aria-hidden="true"
              />

              <div>
                <strong>
                  {data.statistics.chunks}
                </strong>

                <span>
                  Chunks
                </span>
              </div>
            </div>

            <div className="knowledge-viewer-index-stat">
              <Hash
                size={16}
                aria-hidden="true"
              />

              <div>
                <strong>
                  {data.statistics.vectors}
                </strong>

                <span>
                  Vectors
                </span>
              </div>
            </div>
          </section>

          {searchQuery && (
            <section className="knowledge-viewer-panel">
              <h2>
                Search Context
              </h2>

              <p className="knowledge-viewer-query">
                {searchQuery}
              </p>
            </section>
          )}

          <section className="knowledge-viewer-panel knowledge-viewer-actions-panel">
            <h2>Passage actions</h2>
            <button type="button" onClick={toggleBookmark}><Bookmark size={15} fill={bookmarked ? 'currentColor' : 'none'} /> {bookmarked ? 'Bookmarked' : 'Bookmark passage'}</button>
            <button type="button" onClick={askAboutPassage}><MessageSquareText size={15} /> Ask about this passage</button>
          </section>

          <section className="knowledge-viewer-panel">
            <h2><StickyNote size={14} /> My note</h2>
            <textarea value={note} onChange={(event) => saveNote(event.target.value)} placeholder="Add a private note for this passage…" aria-label="Private note for this passage" />
            <small>Saved locally as you type.</small>
          </section>
          <section className="knowledge-viewer-panel">
            <h2>Highlights & annotations</h2>
            <p>{annotations.count} saved for this passage.</p>
            <small>Select text in the lesson to highlight it and add an optional annotation. Click a saved highlight to view or delete it.</small>
          </section>
        </aside>
      </div>
    </section>
  )
}

export default KnowledgeViewerPage
