import { ArrowLeft, BookOpen, Copy, ExternalLink, Maximize2, Minimize2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AIOS_API_BASE_URL } from '../config/api'
import '../styles/school-reader.css'

export default function SchoolLessonReaderPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [fullPage, setFullPage] = useState(false)
  const path = params.get('path') ?? ''
  const title = params.get('title') || 'School material'
  const section = params.get('section') || 'Selected lesson'
  const page = Math.max(1, Number(params.get('page') || 1))
  const previewUrl = useMemo(() => {
    const query = new URLSearchParams({ path })
    return `${AIOS_API_BASE_URL}/knowledge/source/preview?${query.toString()}#page=${page}&zoom=page-width`
  }, [page, path])

  useEffect(() => {
    document.documentElement.classList.toggle('school-reading-full-page', fullPage)
    return () => document.documentElement.classList.remove('school-reading-full-page')
  }, [fullPage])

  return <section className={`school-lesson-reader ${fullPage ? 'full-page' : ''}`}>
    <header>
      <button type="button" onClick={() => navigate('/school')}><ArrowLeft size={17} /> Back to School</button>
      <div><span><BookOpen size={18} /></span><div><strong>{title}</strong><small>{section} · PDF page {page}</small></div></div>
      <nav>
        <button type="button" onClick={() => void navigator.clipboard.writeText(`${title}\n${section}\n${previewUrl}`)}><Copy size={16} /> Copy reference</button>
        <a href={previewUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Open PDF</a>
        <button type="button" onClick={() => setFullPage((value) => !value)}>{fullPage ? <Minimize2 size={16} /> : <Maximize2 size={16} />}{fullPage ? 'Exit full page' : 'Full page'}</button>
      </nav>
    </header>
    {path ? <iframe title={`${title} — ${section}`} src={previewUrl} /> : <div className="school-reader-error"><strong>Unable to open this lesson</strong><p>The original School document could not be located.</p></div>}
  </section>
}
