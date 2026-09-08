import { ChevronRight, Home } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const LABELS: Record<string, string> = {
  agents: 'Agents', church: 'Church', documents: 'Documents', help: 'Help & Guides',
  history: 'History', hymnal: 'Hymnal', knowledge: 'Knowledge', 'language-tools': 'Language Tools',
  'life-study': 'Life-Study', media: 'Media Studio', ministry: 'Ministry',
  'ministry-books': 'Books', 'prayer-points': 'Prayer Points',
  'posting-history': 'Posting History', 'recovery-bible': 'Recovery Bible', presentation: 'Presentation',
  school: 'School', settings: 'Settings', updates: 'App Updates', view: 'Viewer', search: 'Search', hwmr: 'HWMR',
}

export default function Breadcrumbs() {
  const { pathname } = useLocation()
  const parts = pathname.split('/').filter(Boolean)
  if (!parts.length) return null
  return <nav className="workspace-breadcrumbs" aria-label="Breadcrumb">
    <Link to="/"><Home size={13} /> Home</Link>
    {parts.map((part, index) => {
      const path = `/${parts.slice(0, index + 1).join('/')}`
      const label = LABELS[part] ?? decodeURIComponent(part).replace(/[-_]/g, ' ')
      const last = index === parts.length - 1
      return <span key={path}><ChevronRight size={13} />{last ? <strong>{label}</strong> : <Link to={path}>{label}</Link>}</span>
    })}
  </nav>
}
