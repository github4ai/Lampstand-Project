import { ArrowLeft, Database, SearchX } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

function NotFoundPage() {
  const location = useLocation()

  return (
    <main className="workspace-panel">
      <section className="not-found-page">
        <span className="not-found-icon"><SearchX size={30} /></span>
        <p className="not-found-code">404 · Page not found</p>
        <h1>This workspace does not exist</h1>
        <p className="not-found-message">
          Lampstand Project could not find <code>{location.pathname}</code>. The link may be outdated or incomplete.
        </p>
        <div className="not-found-actions">
          <Link to="/"><ArrowLeft size={16} /> Return to Chat</Link>
          <Link to="/knowledge" className="secondary"><Database size={16} /> Open Knowledge</Link>
        </div>
      </section>
    </main>
  )
}
export default NotFoundPage
