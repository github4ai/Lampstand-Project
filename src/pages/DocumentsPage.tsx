import { FileText, RefreshCw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useKnowledge } from '../hooks/useKnowledge'
import { formatCount, formatKnowledgeDate } from '../services/knowledge'

function DocumentsPage() {
  const navigate = useNavigate()
  const { data, loading, refreshing, error, refresh } = useKnowledge()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')

  const documents = useMemo(
    () => data?.categories.flatMap((item) =>
      item.documents.map((document) => ({ ...document, category: item.name })),
    ) ?? [],
    [data],
  )

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return documents.filter((document) =>
      (category === 'all' || document.category === category) &&
      (!term || document.name.toLowerCase().includes(term) ||
        document.category.toLowerCase().includes(term)),
    )
  }, [category, documents, query])

  return (
    <section className="documents-page">
      <header className="documents-header">
        <div className="documents-heading">
          <span><FileText size={24} /></span>
          <div><h1>Documents</h1><p>Browse the files available in your local Knowledge Library.</p></div>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading || refreshing}>
          <RefreshCw size={16} className={refreshing ? 'spin' : ''} /> {refreshing ? 'Refreshing' : 'Refresh'}
        </button>
      </header>

      <div className="documents-stats">
        <span><strong>{formatCount(documents.length)}</strong> documents</span>
        <span><strong>{formatCount(documents.filter((item) => item.indexed).length)}</strong> indexed</span>
        <span><strong>{formatCount(data?.chunk_count ?? 0)}</strong> chunks</span>
      </div>

      <div className="documents-toolbar">
        <label><Search size={17} /><input type="search" value={query}
          onChange={(event) => setQuery(event.target.value)} placeholder="Search documents" /></label>
        <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category">
          <option value="all">All categories</option>
          {data?.categories.filter((item) => item.document_count > 0).map((item) =>
            <option key={item.name} value={item.name}>{item.name}</option>)}
        </select>
      </div>

      {loading ? <div className="documents-state">Loading documents...</div> :
       error ? <div className="documents-state documents-error"><h2>Unable to load documents</h2><p>{error}</p></div> :
       visible.length === 0 ? <div className="documents-state"><h2>No matching documents</h2><p>Try another search or category.</p></div> :
       <div className="documents-table-wrap"><table className="documents-table">
        <thead><tr><th>Document</th><th>Status</th><th>Chunks</th><th>Embeddings</th><th>Updated</th></tr></thead>
        <tbody>{visible.map((document) => <tr key={document.id}
          onClick={() => navigate('/documents/' + encodeURIComponent(document.category) + '/' + encodeURIComponent(document.stem))}>
          <td><strong>{document.name}</strong><span>{document.category}</span></td>
          <td><span className={document.indexed ? 'document-status indexed' : 'document-status'}>{document.indexed ? 'Indexed' : 'Pending'}</span></td>
          <td>{formatCount(document.chunks ?? 0)}</td>
          <td>{formatCount(document.embeddings ?? 0)}</td>
          <td>{formatKnowledgeDate(document.modified_at)}</td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  )
}
export default DocumentsPage
