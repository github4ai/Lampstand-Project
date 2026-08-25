import { ArrowLeft, Boxes, Check, Clipboard, Database, FileText, Hash, Highlighter, Layers3, Search, StickyNote } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { formatCount, formatFileSize, formatKnowledgeDate, getKnowledgeDocument } from '../services/knowledge'
import type { KnowledgeDocumentDetail } from '../services/knowledge'

function DocumentDetailPage() {
  const { categoryName = '', documentName = '' } = useParams()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState<KnowledgeDocumentDetail | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [hashCopyStatus, setHashCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [schoolNotes, setSchoolNotes] = useState<Array<{ id: string; document: string; excerpt: string; note: string; color: string; createdAt: string }>>(() => {
    try { return JSON.parse(localStorage.getItem('aios-school-notes-v1') ?? '[]') as Array<{ id: string; document: string; excerpt: string; note: string; color: string; createdAt: string }> } catch { return [] }
  })
  const [studyNote, setStudyNote] = useState({ excerpt: '', note: '', color: '#fde68a' })

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setError('')
      try {
        setData(await getKnowledgeDocument(categoryName, documentName, controller.signal))
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return
        setError(requestError instanceof Error ? requestError.message : 'Unable to load this document.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [categoryName, documentName])

  if (loading) return <section className="document-detail-state">Loading document...</section>
  if (error || !data) return <section className="document-detail-state document-detail-error"><h1>Unable to open document</h1><p>{error}</p><Link to="/documents">Return to Documents</Link></section>

  const searchLink = '/knowledge/search?' + new URLSearchParams({
    q: data.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
    category: data.category,
    results: '10',
  }).toString()
  const sourceHash = data.source_hash

  async function copySourceHash() {
    try {
      await navigator.clipboard.writeText(sourceHash)
      setHashCopyStatus('copied')
    } catch {
      setHashCopyStatus('failed')
    }
    window.setTimeout(() => setHashCopyStatus('idle'), 1800)
  }

  function saveStudyNote(event: React.FormEvent) {
    event.preventDefault()
    if (!studyNote.excerpt.trim() && !studyNote.note.trim()) return
    const next = [{ id: crypto.randomUUID(), document: data?.name ?? documentName, ...studyNote, createdAt: new Date().toISOString() }, ...schoolNotes]
    setSchoolNotes(next); localStorage.setItem('aios-school-notes-v1', JSON.stringify(next)); setStudyNote({ ...studyNote, excerpt: '', note: '' })
  }

  function removeStudyNote(id: string) {
    const next = schoolNotes.filter((item) => item.id !== id); setSchoolNotes(next); localStorage.setItem('aios-school-notes-v1', JSON.stringify(next))
  }

  const documentNotes = schoolNotes.filter((item) => item.document === data.name)
  const isSchoolDocument = data.category.toLowerCase() === 'school'

  return (
    <section className="document-detail-page">
      <Link className="document-detail-back" to={searchParams.get('from') === 'school' ? '/school' : '/documents'}><ArrowLeft size={15} /> Back to {searchParams.get('from') === 'school' ? 'School' : 'Documents'}</Link>
      <header className="document-detail-header">
        <span><FileText size={25} /></span>
        <div><h1>{data.name}</h1><p>{data.category} · Updated {formatKnowledgeDate(data.modified_at)}</p></div>
        <Link className="document-search-link" to={searchLink}><Search size={14} /> Search related</Link>
        {data.statistics.chunks > 0 && <Link className="document-open-chunk"
          to={'/knowledge/view/' + encodeURIComponent(data.category) + '/' + encodeURIComponent(data.stem) + '/1'}>
          Open first chunk
        </Link>}
        {data.statistics.chunks > 1 && <Link className="document-open-chunk"
          to={'/knowledge/view/' + encodeURIComponent(data.category) + '/' + encodeURIComponent(data.stem) + '/' + data.statistics.chunks}>
          Open last chunk
        </Link>}
      </header>

      <div className="document-detail-stats">
        <article><Layers3 size={18} /><strong>{formatCount(data.statistics.chunks)}</strong><span>Chunks</span></article>
        <article><Database size={18} /><strong>{formatCount(data.statistics.embeddings)}</strong><span>Embeddings</span></article>
        <article><Boxes size={18} /><strong>{formatCount(data.statistics.vectors)}</strong><span>Vectors</span></article>
        <article><FileText size={18} /><strong>{formatCount(data.statistics.words)}</strong><span>Words</span></article>
      </div>

      <div className="document-detail-grid">
        <section className="document-detail-panel"><h2>Index details</h2><dl>
          <div><dt>Status</dt><dd>{data.indexed ? 'Indexed' : 'Pending'}</dd></div>
          <div><dt>Embedding dimensions</dt><dd>{formatCount(data.embedding_dimensions)}</dd></div>
          <div><dt>Artifact size</dt><dd>{formatFileSize(data.artifact_size_bytes)}</dd></div>
          <div><dt>Source hash</dt><dd className="document-hash"><Hash size={13} /><span>{data.source_hash}</span>
            <button type="button" onClick={() => void copySourceHash()} aria-label="Copy source hash">
              {hashCopyStatus === 'copied' ? <Check size={13} /> : <Clipboard size={13} />}
              {hashCopyStatus === 'copied' ? 'Copied' : hashCopyStatus === 'failed' ? 'Copy failed' : 'Copy'}
            </button>
          </dd></div>
        </dl></section>
        <section className="document-detail-panel"><h2>Generated artifacts</h2>
          <div className="document-artifacts">{data.artifacts.map((artifact) => <article key={artifact.relative_path}>
            <FileText size={16} /><div><strong>{artifact.name}</strong><span>{formatFileSize(artifact.size_bytes)} · {artifact.extension}</span></div>
          </article>)}</div>
        </section>
      </div>
      {isSchoolDocument && <section className="school-document-journal"><header><div><h2><Highlighter size={18} /> Study notes and highlights</h2><p>Copy an important excerpt from the document, choose a highlight colour, and attach your own note.</p></div><span>{documentNotes.length} saved</span></header><div className="school-journal-grid"><form onSubmit={saveStudyNote}><label>Highlighted excerpt<textarea value={studyNote.excerpt} onChange={(event) => setStudyNote({ ...studyNote, excerpt: event.target.value })} placeholder="Paste or type the selected textbook passage…" /></label><label>Your note<textarea value={studyNote.note} onChange={(event) => setStudyNote({ ...studyNote, note: event.target.value })} placeholder="Explanation, question, or memory aid…" /></label><label>Highlight colour<input type="color" value={studyNote.color} onChange={(event) => setStudyNote({ ...studyNote, color: event.target.value })} /></label><button type="submit"><StickyNote size={15} /> Save study note</button></form><div className="school-saved-notes">{documentNotes.length ? documentNotes.map((item) => <article key={item.id} style={{ borderLeftColor: item.color }}><blockquote style={{ background: `${item.color}26` }}>{item.excerpt || 'Personal note'}</blockquote>{item.note && <p>{item.note}</p>}<footer><span>{new Date(item.createdAt).toLocaleString()}</span><button type="button" onClick={() => removeStudyNote(item.id)}>Remove</button></footer></article>) : <p>No study notes saved for this document yet.</p>}</div></div></section>}
    </section>
  )
}
export default DocumentDetailPage
