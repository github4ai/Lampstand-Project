import { ArrowLeft, Boxes, Database, FileText, Hash, Layers3 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatCount, formatFileSize, formatKnowledgeDate, getKnowledgeDocument } from '../services/knowledge'
import type { KnowledgeDocumentDetail } from '../services/knowledge'

function DocumentDetailPage() {
  const { categoryName = '', documentName = '' } = useParams()
  const [data, setData] = useState<KnowledgeDocumentDetail | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

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

  return (
    <section className="document-detail-page">
      <Link className="document-detail-back" to="/documents"><ArrowLeft size={15} /> Back to Documents</Link>
      <header className="document-detail-header">
        <span><FileText size={25} /></span>
        <div><h1>{data.name}</h1><p>{data.category} · Updated {formatKnowledgeDate(data.modified_at)}</p></div>
        {data.statistics.chunks > 0 && <Link className="document-open-chunk"
          to={'/knowledge/view/' + encodeURIComponent(data.category) + '/' + encodeURIComponent(data.stem) + '/1'}>
          Open first chunk
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
          <div><dt>Source hash</dt><dd className="document-hash"><Hash size={13} /> {data.source_hash}</dd></div>
        </dl></section>
        <section className="document-detail-panel"><h2>Generated artifacts</h2>
          <div className="document-artifacts">{data.artifacts.map((artifact) => <article key={artifact.relative_path}>
            <FileText size={16} /><div><strong>{artifact.name}</strong><span>{formatFileSize(artifact.size_bytes)} · {artifact.extension}</span></div>
          </article>)}</div>
        </section>
      </div>
    </section>
  )
}
export default DocumentDetailPage
