import { CheckSquare, Edit3, Eye, FileText, LoaderCircle, Plus, RefreshCw, RotateCcw, Search, ShieldCheck, Trash2, Upload, X } from 'lucide-react'
import { useAccessControl } from '../hooks/useAccessControl'
import { type FormEvent, type InputHTMLAttributes, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useKnowledge } from '../hooks/useKnowledge'
import { formatCount, formatFileSize, formatKnowledgeDate, getKnowledgeIndexStatus, getKnowledgePreviewUrl, getKnowledgeSources, getKnowledgeSubcollections, inspectKnowledgeHealth, startKnowledgeIndex, trashKnowledgeSource, updateKnowledgeSource, uploadKnowledgeDocument } from '../services/knowledge'
import { refreshHwmrLibrary } from '../api/hwmr'
import type { KnowledgeHealth, KnowledgeIndexStatus, KnowledgeSourceFile } from '../services/knowledge'

type DocumentStatus = 'all' | 'indexed' | 'pending'
type DocumentSort = 'updated' | 'name' | 'chunks'

const documentPreferencesKey = 'aios-document-preferences'
const supportedUploadPattern = /\.(?:html?|epub|docx|pptx|txt|md|markdown|pdb|pdf)$/i
const recommendedSubcollections: Record<string, string[]> = {
  Ministry: ['HWMR', 'Ministry Books', 'Life-Study', 'Recovery Bible', 'Hymnal'],
  School: ['Level C'],
}

function loadDocumentPreferences(): { query: string; category: string; status: DocumentStatus; sort: DocumentSort } {
  const defaults = { query: '', category: 'all', status: 'all' as DocumentStatus, sort: 'updated' as DocumentSort }
  try {
    const saved = JSON.parse(localStorage.getItem(documentPreferencesKey) ?? '{}') as Partial<typeof defaults>
    return {
      query: typeof saved.query === 'string' ? saved.query : defaults.query,
      category: typeof saved.category === 'string' ? saved.category : defaults.category,
      status: saved.status === 'indexed' || saved.status === 'pending' ? saved.status : defaults.status,
      sort: saved.sort === 'name' || saved.sort === 'chunks' ? saved.sort : defaults.sort,
    }
  } catch {
    return defaults
  }
}

function DocumentsPage() {
  const { can } = useAccessControl()
  const canImport = can('documents', 'import')
  const canEdit = can('documents', 'edit')
  const canDelete = can('documents', 'delete')
  const canManageLibrary = can('documents', 'manage')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data, loading, refreshing, error, refresh } = useKnowledge()
  const [preferences] = useState(loadDocumentPreferences)
  const [query, setQuery] = useState(preferences.query)
  const [category, setCategory] = useState(preferences.category)
  const [status, setStatus] = useState<DocumentStatus>(preferences.status)
  const [sort, setSort] = useState<DocumentSort>(preferences.sort)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadInputKey, setUploadInputKey] = useState(0)
  const allowedUploadCategories = useMemo(() => [
    ...(can('school') ? ['School'] : []),
    ...(can('ministry') ? ['Ministry'] : []),
    ...(can('chat') ? ['General'] : []),
  ], [can])
  const [uploadCategory, setUploadCategory] = useState(() => allowedUploadCategories[0] ?? 'General')
  const [uploadCollection, setUploadCollection] = useState('')
  const [subcollections, setSubcollections] = useState<string[]>([])
  const [addingSubcollection, setAddingSubcollection] = useState(false)
  const [subjects, setSubjects] = useState<string[]>([])
  const [uploadSubject, setUploadSubject] = useState('')
  const [addingSubject, setAddingSubject] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')
  const [indexStatus, setIndexStatus] = useState<KnowledgeIndexStatus | null>(null)
  const [sourceFiles, setSourceFiles] = useState<KnowledgeSourceFile[]>([])
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<KnowledgeSourceFile | null>(null)
  const [editing, setEditing] = useState<KnowledgeSourceFile | null>(null)
  const [editForm, setEditForm] = useState({ name: '', category: '', collection: '', title: '', description: '', tags: '' })
  const [health, setHealth] = useState<KnowledgeHealth | null>(null)
  const [checkingHealth, setCheckingHealth] = useState(false)
  const isHwmrUpload = uploadCategory === 'Ministry' && uploadCollection.trim().toUpperCase() === 'HWMR'

  useEffect(() => {
    const requestedCategory = searchParams.get('category')
    if (requestedCategory) {
      setCategory(requestedCategory)
      setUploadCategory(requestedCategory)
    }
    if (searchParams.get('add') === 'true') setShowUpload(true)
    if (requestedCategory || searchParams.has('add')) setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    localStorage.setItem(documentPreferencesKey, JSON.stringify({ query, category, status, sort }))
  }, [category, query, sort, status])

  useEffect(() => {
    let active = true
    let timer = 0
    async function check() {
      try {
        const next = await getKnowledgeIndexStatus()
        if (!active) return
        setIndexStatus(next)
        if (next.state === 'running') timer = window.setTimeout(() => void check(), 1500)
        else if (next.state === 'completed' || next.state === 'completed_with_errors') {
          await refresh()
          setSourceFiles(await getKnowledgeSources())
        }
      } catch { /* The legacy knowledge library remains available without job status. */ }
    }
    void check()
    return () => { active = false; window.clearTimeout(timer) }
  }, [indexStatus?.state, refresh])

  useEffect(() => {
    let active = true
    setUploadCollection(uploadCategory === 'School' ? 'Level C' : '')
    setAddingSubcollection(false)
    setUploadSubject('')
    setAddingSubject(false)
    void getKnowledgeSubcollections(uploadCategory).then((items) => {
      const availableItems = uploadCategory === 'School'
        ? items.filter((item) => !/^Level\s+[ABD]$/i.test(item.trim()))
        : items
      if (active) setSubcollections([...new Set([...(recommendedSubcollections[uploadCategory] ?? []), ...availableItems])])
    }).catch(() => {
      if (active) setSubcollections(recommendedSubcollections[uploadCategory] ?? [])
    })
    return () => { active = false }
  }, [uploadCategory])

  useEffect(() => {
    let active = true
    setUploadSubject('')
    setAddingSubject(false)
    if (!uploadCollection || addingSubcollection) {
      setSubjects([])
      return () => { active = false }
    }
    void getKnowledgeSubcollections(uploadCategory, uploadCollection).then((items) => {
      if (active) setSubjects(items)
    }).catch(() => {
      if (active) setSubjects([])
    })
    return () => { active = false }
  }, [addingSubcollection, uploadCategory, uploadCollection])

  useEffect(() => {
    let active = true
    void getKnowledgeSources().then((items) => { if (active) setSourceFiles(items) }).catch(() => {})
    return () => { active = false }
  }, [])

  const documents = useMemo(() => {
    const indexed = data?.categories.flatMap((item) => item.documents.map((document) => {
      const indexedSourceStem = document.stem.replace(/\.aios-index$/i, '')
      const matchingSources = sourceFiles.filter((file) => file.category === item.name &&
        file.name.replace(/\.(?:pdf|html?|epub|docx|txt|md|markdown|pdb)$/i, '') === indexedSourceStem)
      const source = matchingSources.find((file) => file.relativePath === document.relative_path) ??
        (matchingSources.length === 1 ? matchingSources[0] : undefined)
      return { id: document.id, name: source?.name ?? document.name, stem: document.stem, category: item.name,
        subcollection: source?.subcollection ?? null, relativePath: source?.relativePath ?? null, indexed: document.indexed, chunks: document.chunks,
        embeddings: document.embeddings, modified_at: document.modified_at, title: source?.title ?? '', description: source?.description ?? '', tags: source?.tags ?? [] }
    })) ?? []
    const indexedPaths = new Set(indexed.map((item) => item.relativePath?.toLowerCase()).filter(Boolean))
    const pending = sourceFiles.filter((file) => !indexedPaths.has(file.relativePath.toLowerCase())).map((file) => ({
      id: `source:${file.relativePath}`, name: file.name, stem: file.name.replace(/\.(?:pdf|html?|epub|docx|txt|md|markdown|pdb)$/i, ''), category: file.category,
      subcollection: file.subcollection, relativePath: file.relativePath, indexed: false, chunks: null, embeddings: null, modified_at: file.modifiedAt,
      title: file.title ?? '', description: file.description ?? '', tags: file.tags ?? [],
    }))
    return [...indexed, ...pending]
  }, [data, sourceFiles])

  useEffect(() => {
    if (data && category !== 'all' && !data.categories.some((item) => item.name === category)) {
      setCategory('all')
    }
  }, [category, data])

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return documents.filter((document) =>
      (category === 'all' || document.category === category) &&
      (status === 'all' || (status === 'indexed' ? document.indexed : !document.indexed)) &&
      (!term || document.name.toLowerCase().includes(term) || document.title.toLowerCase().includes(term) ||
        document.tags.some((tag) => tag.toLowerCase().includes(term)) || document.category.toLowerCase().includes(term)),
    ).sort((left, right) => sort === 'name'
      ? left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
      : sort === 'chunks' ? (right.chunks ?? 0) - (left.chunks ?? 0)
        : (right.modified_at ?? '').localeCompare(left.modified_at ?? ''))
  }, [category, documents, query, sort, status])
  const hasActiveView = Boolean(query.trim()) || category !== 'all' || status !== 'all' || sort !== 'updated'

  function selectUploadFiles(fileList: FileList | null) {
    const selected = Array.from(fileList ?? [])
    const supported = selected.filter((file) => supportedUploadPattern.test(file.name))
    const skipped = selected.length - supported.length

    setUploadFiles(supported)
    if (selected.length === 0) {
      setUploadMessage('')
    } else if (supported.length === 0) {
      setUploadMessage('No supported documents were selected. Choose HTML, HTM, EPUB, DOCX, PPTX, TXT, Markdown, PDB, or PDF files.')
    } else if (skipped > 0) {
      setUploadMessage(`${supported.length} supported document${supported.length === 1 ? '' : 's'} selected; ${skipped} unsupported file${skipped === 1 ? ' was' : 's were'} skipped.`)
    } else {
      setUploadMessage('')
    }
  }

  async function refreshDocuments() {
    setUploadMessage('')
    const [libraryResult, sourcesResult] = await Promise.allSettled([
      refresh(),
      getKnowledgeSources(),
    ])
    if (sourcesResult.status === 'fulfilled') setSourceFiles(sourcesResult.value)
    const libraryReady = libraryResult.status === 'fulfilled' && libraryResult.value
    if (!libraryReady || sourcesResult.status === 'rejected') {
      setUploadMessage('Some document information could not be refreshed. Check that the AIOS gateway is connected, then try again.')
    }
  }

  function resetView() {
    setQuery('')
    setCategory('all')
    setStatus('all')
    setSort('updated')
  }

  function openDocument(categoryName: string, stem: string) {
    navigate('/documents/' + encodeURIComponent(categoryName) + '/' + encodeURIComponent(stem))
  }

  async function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canImport) { setUploadMessage('Your profile cannot import documents.'); return }
    if (uploadFiles.length === 0 || !uploadCategory.trim()) return
    setUploading(true)
    setUploadMessage('')
    try {
      const baseDestination = [uploadCollection.trim(), uploadSubject.trim()].filter(Boolean)
      let uploaded = 0
      const failures: string[] = []
      for (const file of uploadFiles) {
        const relativeParts = file.webkitRelativePath.replace(/\\/g, '/').split('/').filter(Boolean)
        const nestedFolders = relativeParts.length > 2 ? relativeParts.slice(1, -1) : []
        const destination = [...baseDestination, ...nestedFolders].join('/')
        try {
          await uploadKnowledgeDocument(file, uploadCategory.trim(), destination)
          uploaded += 1
        } catch (error) {
          failures.push(`${file.name}: ${error instanceof Error ? error.message : 'Upload failed'}`)
        }
        setUploadMessage(`Uploading documents… ${uploaded + failures.length} of ${uploadFiles.length}`)
      }
      setUploadMessage(failures.length
        ? `${uploaded} uploaded; ${failures.length} failed. ${failures.slice(0, 2).join(' ')}`
        : `${uploaded} document${uploaded === 1 ? '' : 's'} added and waiting to be indexed.`)
      if (isHwmrUpload && uploaded > 0) {
        const audit = await refreshHwmrLibrary()
        setUploadMessage(`${uploaded} HWMR PDF${uploaded === 1 ? '' : 's'} added. Reader verified: ${audit.dailyPortions} daily portions and ${audit.morningVerses} Morning Nourishment verse blocks.`)
      }
      setUploadFiles([])
      setUploadInputKey((value) => value + 1)
      if (addingSubcollection) {
        setSubcollections((current) => [...new Set([...current, uploadCollection.trim()])].sort())
      }
      if (addingSubject) {
        setSubjects((current) => [...new Set([...current, uploadSubject.trim()])].sort())
      }
      setAddingSubcollection(false)
      setAddingSubject(false)
      setSourceFiles(await getKnowledgeSources())
      await refresh()
    } catch (uploadError) {
      setUploadMessage(uploadError instanceof Error ? uploadError.message : 'Unable to upload this document.')
    } finally {
      setUploading(false)
    }
  }

  async function runIndexing() {
    setUploadMessage('')
    try {
      setIndexStatus(await startKnowledgeIndex())
    } catch (indexError) {
      setUploadMessage(indexError instanceof Error ? indexError.message : 'Unable to start indexing.')
    }
  }

  async function removeDocument(relativePath: string, name: string) {
    if (!canDelete) { setUploadMessage('Your profile cannot remove documents.'); return }
    if (!window.confirm(`Remove ${name}? It will be moved to AIOS Knowledge Trash and can be recovered.`)) return
    setUploadMessage('')
    try {
      await trashKnowledgeSource(relativePath)
      setSourceFiles(await getKnowledgeSources())
      await refresh()
    } catch (removeError) {
      setUploadMessage(removeError instanceof Error ? removeError.message : 'Unable to remove this document.')
    }
  }

  function beginEdit(source: KnowledgeSourceFile) {
    if (!canEdit) { setUploadMessage('Your profile cannot edit document details.'); return }
    setEditing(source)
    setEditForm({ name: source.name, category: source.category, collection: source.subcollection?.replaceAll(' / ', '/') ?? '', title: source.title ?? '', description: source.description ?? '', tags: (source.tags ?? []).join(', ') })
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canEdit) { setUploadMessage('Your profile cannot edit document details.'); return }
    if (!editing) return
    setUploading(true); setUploadMessage('')
    try {
      await updateKnowledgeSource({ ...editForm, relativePath: editing.relativePath, tags: editForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean) })
      setEditing(null); setUploadMessage('Document details saved. If its name or location changed, run indexing to refresh retrieval artifacts.')
      setSourceFiles(await getKnowledgeSources()); await refresh()
    } catch (cause) { setUploadMessage(cause instanceof Error ? cause.message : 'Unable to save document details.') }
    finally { setUploading(false) }
  }

  async function removeSelected() {
    if (!canDelete) { setUploadMessage('Your profile cannot remove documents.'); return }
    const paths = [...selectedPaths]
    if (!paths.length || !window.confirm(`Remove ${paths.length} selected document${paths.length === 1 ? '' : 's'}? They will remain recoverable from AIOS Knowledge Trash.`)) return
    setUploading(true); const failures: string[] = []
    for (const path of paths) { try { await trashKnowledgeSource(path) } catch { failures.push(path) } }
    setSelectedPaths(new Set()); setSourceFiles(await getKnowledgeSources()); await refresh(); setUploading(false)
    setUploadMessage(failures.length ? `${paths.length - failures.length} removed; ${failures.length} could not be removed.` : `${paths.length} document${paths.length === 1 ? '' : 's'} moved to Knowledge Trash.`)
  }

  async function verifyLibrary() {
    setCheckingHealth(true); setUploadMessage('')
    try { setHealth(await inspectKnowledgeHealth()) }
    catch (cause) { setUploadMessage(cause instanceof Error ? cause.message : 'Unable to verify the library.') }
    finally { setCheckingHealth(false) }
  }

  return (
    <section className="documents-page">
      <header className="documents-header">
        <div className="documents-heading">
          <span><FileText size={24} /></span>
          <div><h1>Documents</h1><p>Browse the files available in your local Knowledge Library.</p></div>
        </div>
        <div className="documents-header-actions">
          {canImport && <button type="button" onClick={() => setShowUpload((value) => !value)}><Plus size={16} /> Add knowledge</button>}
          {canManageLibrary && <button type="button" onClick={() => void runIndexing()} disabled={indexStatus?.state === 'running'}>
            {indexStatus?.state === 'running' ? <LoaderCircle size={16} className="spin" /> : <RefreshCw size={16} />}
            {indexStatus?.state === 'running' ? 'Indexing...' : 'Index knowledge'}
          </button>}
          <button type="button" onClick={() => void refreshDocuments()} disabled={loading || refreshing}>
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} /> {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
          <button type="button" onClick={() => void verifyLibrary()} disabled={checkingHealth}><ShieldCheck size={16} /> {checkingHealth ? 'Checking…' : 'Verify library'}</button>
        </div>
      </header>

      {showUpload && canImport && <form className="knowledge-upload-panel" onSubmit={(event) => void submitUpload(event)}>
        <div className="knowledge-upload-source">
          <label>Document files<input key={`files-${uploadInputKey}`} type="file" multiple
            accept=".html,.htm,.epub,.docx,.pptx,.txt,.md,.markdown,.pdb,.pdf,application/pdf,text/html,text/plain,text/markdown,application/epub+zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.palm"
            onChange={(event) => selectUploadFiles(event.target.files)} /></label>
          <label className="knowledge-folder-picker">Or choose a folder<input key={`folder-${uploadInputKey}`} type="file"
            {...({ webkitdirectory: '', directory: '' } as InputHTMLAttributes<HTMLInputElement>)}
            onChange={(event) => selectUploadFiles(event.target.files)} /></label>
          <small>{uploadFiles.length > 0 ? `${uploadFiles.length} supported document${uploadFiles.length === 1 ? '' : 's'} selected` : 'HTML, HTM, EPUB, DOCX, PPTX, TXT, Markdown, PDB, or PDF'}</small>
        </div>
        <label>Category<select value={uploadCategory} onChange={(event) => setUploadCategory(event.target.value)}>
          {allowedUploadCategories.map((item) => <option key={item}>{item}</option>)}
        </select></label>
        {uploadCategory === 'School' ? <div className="knowledge-fixed-field"><span>Level</span><strong>Level C</strong></div> : <label>Subcollection<select value={addingSubcollection ? '__new__' : uploadCollection} onChange={(event) => {
          if (event.target.value === '__new__') { setAddingSubcollection(true); setUploadCollection('') }
          else { setAddingSubcollection(false); setUploadCollection(event.target.value) }
        }}>
          <option value="">No subcollection</option>
          {subcollections.map((item) => <option key={item} value={item}>{item}</option>)}
          <option value="__new__">＋ Add new subcollection…</option>
        </select></label>}
        {uploadCategory !== 'School' && addingSubcollection && <label>New subcollection name<input value={uploadCollection}
          onChange={(event) => setUploadCollection(event.target.value)} placeholder="Example: Sunday School" autoFocus /></label>}
        {!addingSubcollection && uploadCollection && !isHwmrUpload && <label>{uploadCategory === 'School' ? 'Subject' : 'Folder'}<select
          value={addingSubject ? '__new__' : uploadSubject} onChange={(event) => {
            if (event.target.value === '__new__') { setAddingSubject(true); setUploadSubject('') }
            else { setAddingSubject(false); setUploadSubject(event.target.value) }
          }}>
          <option value="">Choose subject</option>
          {subjects.map((item) => <option key={item} value={item}>{item}</option>)}
          <option value="__new__">＋ Add new subject…</option>
        </select></label>}
        {addingSubject && <label>New {uploadCategory === 'School' ? 'subject' : 'folder'} name<input value={uploadSubject}
          onChange={(event) => setUploadSubject(event.target.value)} placeholder={uploadCategory === 'School' ? 'Example: Social Studies' : 'Example: Recovery Version'} autoFocus /></label>}
        <button type="submit" disabled={uploadFiles.length === 0 || uploading || (addingSubcollection && !uploadCollection.trim()) ||
          (uploadCategory === 'School' && uploadCollection === 'Level C' && !uploadSubject.trim()) || (addingSubject && !uploadSubject.trim())}>
          <Upload size={15} /> {uploading ? 'Uploading...' : 'Upload document'}</button>
        {indexStatus && indexStatus.state !== 'idle' && <p className={'knowledge-index-status ' + indexStatus.state}>
          {indexStatus.state === 'running' ? `Indexing ${indexStatus.current || 'your knowledge library'} · ${indexStatus.processed || 0} of ${indexStatus.total || documents.length}` :
           indexStatus.state === 'completed' ? 'Knowledge indexing completed successfully.' :
           indexStatus.state === 'completed_with_errors' ? 'Indexing completed, but one or more documents need attention.' : 'Knowledge indexing failed. Check the indexing details.'}
        </p>}
      </form>}

      {uploadMessage && <div className="documents-notice" role="status">{uploadMessage}</div>}

      {indexStatus && indexStatus.state !== 'idle' && <section className={'documents-index-monitor ' + indexStatus.state} aria-live="polite"><div><RefreshCw size={18} className={indexStatus.state === 'running' ? 'spin' : ''} /><div><strong>{indexStatus.state === 'running' ? 'Indexing knowledge' : indexStatus.state === 'completed' ? 'Indexing complete' : indexStatus.state === 'completed_with_errors' ? 'Indexing completed with issues' : 'Indexing stopped'}</strong><span>{indexStatus.state === 'running' ? `${indexStatus.processed || 0} of ${indexStatus.total || documents.length} · ${indexStatus.current || 'Preparing library'}` : `${indexStatus.processed || 0} processed · ${indexStatus.errors || 0} issues`}</span></div></div>{indexStatus.total > 0 && <progress max={indexStatus.total} value={indexStatus.processed || 0} />}{indexStatus.output && <details><summary>Technical details</summary><pre>{indexStatus.output}</pre></details>}{(indexStatus.state === 'failed' || indexStatus.state === 'completed_with_errors') && <button type="button" onClick={() => void runIndexing()}>Retry indexing</button>}</section>}

      {health && <section className={'knowledge-health ' + (health.healthy ? 'healthy' : 'attention')}>
        <div><ShieldCheck size={20} /><div><strong>{health.healthy ? 'Library verified' : 'Library needs attention'}</strong><span>{health.sources} sources · {health.indexed} indexed · {formatFileSize(health.totalSizeBytes)}</span></div></div>
        <div className="knowledge-health-counts"><span>{health.pending.length} pending</span><span>{health.duplicates.length} duplicate group{health.duplicates.length === 1 ? '' : 's'}</span><button type="button" onClick={() => setHealth(null)} aria-label="Close verification"><X size={15} /></button></div>
        {(health.pending.length > 0 || health.duplicates.length > 0) && <details><summary>View verification details</summary>{health.pending.length > 0 && <p><strong>Pending:</strong> {health.pending.slice(0, 12).join(', ')}{health.pending.length > 12 ? ` and ${health.pending.length - 12} more` : ''}</p>}{health.duplicates.map((group) => <p key={group.join('|')}><strong>Identical files:</strong> {group.join(' · ')}</p>)}</details>}
      </section>}

      <div className="documents-stats">
        <span><strong>{formatCount(documents.length)}</strong> documents</span>
        <span><strong>{formatCount(documents.filter((item) => item.indexed).length)}</strong> indexed</span>
        <span><strong>{formatCount(data?.chunk_count ?? 0)}</strong> chunks</span>
        {hasActiveView && <span><strong>{formatCount(visible.length)}</strong> shown</span>}
      </div>

      <div className="documents-toolbar">
        <label><Search size={17} /><input type="search" value={query}
          onChange={(event) => setQuery(event.target.value)} placeholder="Search documents" /></label>
        <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category">
          <option value="all">All categories</option>
          {data?.categories.filter((item) => item.document_count > 0).map((item) =>
            <option key={item.name} value={item.name}>{item.name}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} aria-label="Filter by index status">
          <option value="all">All statuses</option><option value="indexed">Indexed</option><option value="pending">Pending</option>
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Sort documents">
          <option value="updated">Recently updated</option><option value="name">Name A–Z</option><option value="chunks">Most chunks</option>
        </select>
        {hasActiveView && <button type="button" className="documents-reset" onClick={resetView}><RotateCcw size={14} /> Reset</button>}
      </div>

      {selectedPaths.size > 0 && <div className="documents-bulk-bar"><CheckSquare size={16} /><strong>{selectedPaths.size} selected</strong><button type="button" onClick={() => setSelectedPaths(new Set())}>Clear</button><button type="button" className="danger" onClick={() => void removeSelected()} disabled={uploading}><Trash2 size={15} /> Remove selected</button></div>}

      {loading ? <div className="documents-state">Loading documents...</div> :
       error ? <div className="documents-state documents-error"><h2>Unable to load documents</h2><p>{error}</p><button type="button" className="documents-reset" onClick={() => void refreshDocuments()}><RefreshCw size={14} /> Try again</button></div> :
       visible.length === 0 ? <div className="documents-state"><h2>{documents.length ? 'No matching documents' : 'No documents available'}</h2><p>{documents.length ? 'Try another search or category.' : 'Add files to your Knowledge Library, then refresh this page.'}</p>
        {documents.length > 0 && hasActiveView && <button type="button" className="documents-reset" onClick={resetView}><RotateCcw size={14} /> Reset filters</button>}
       </div> :
       <div className="documents-table-wrap"><table className="documents-table">
        <thead><tr><th><input type="checkbox" aria-label="Select all shown documents" checked={visible.length > 0 && visible.every((item) => item.relativePath && selectedPaths.has(item.relativePath))} onChange={(event) => setSelectedPaths(event.target.checked ? new Set(visible.map((item) => item.relativePath).filter((path): path is string => Boolean(path))) : new Set())} /></th><th>Document</th><th>Status</th><th>Chunks</th><th>Embeddings</th><th>Updated</th><th aria-label="Actions"></th></tr></thead>
        <tbody>{visible.map((document) => <tr key={document.id} role={document.indexed ? 'link' : undefined} tabIndex={document.indexed ? 0 : -1}
          className={document.indexed ? '' : 'pending'} aria-label={document.indexed ? `Open ${document.name}` : `${document.name} is waiting to be indexed`}
          onClick={document.indexed ? () => openDocument(document.category, document.stem) : undefined}
          onKeyDown={(event) => {
            if (!document.indexed) return
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            openDocument(document.category, document.stem)
          }}>
          <td onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`Select ${document.name}`} checked={Boolean(document.relativePath && selectedPaths.has(document.relativePath))} disabled={!document.relativePath} onChange={(event) => { if (!document.relativePath) return; setSelectedPaths((current) => { const next = new Set(current); if (event.target.checked) next.add(document.relativePath as string); else next.delete(document.relativePath as string); return next }) }} /></td>
          <td><strong>{document.title || document.name}</strong>{document.title && <small>{document.name}</small>}<span>{document.category}{document.subcollection ? ` · ${document.subcollection}` : ''}{document.tags.length ? ` · ${document.tags.join(', ')}` : ''}</span></td>
          <td><span className={document.indexed ? 'document-status indexed' : 'document-status'}>{document.indexed ? 'Indexed' : 'Pending'}</span></td>
          <td>{formatCount(document.chunks ?? 0)}</td>
          <td>{formatCount(document.embeddings ?? 0)}</td>
          <td>{formatKnowledgeDate(document.modified_at)}</td>
          <td>{document.relativePath && <div className="document-row-actions"><button type="button" aria-label={`Preview ${document.name}`} onClick={(event) => { event.stopPropagation(); const source=sourceFiles.find((item) => item.relativePath === document.relativePath); if (source) setPreview(source) }}><Eye size={15} /></button><button type="button" aria-label={`Edit ${document.name}`} onClick={(event) => { event.stopPropagation(); const source=sourceFiles.find((item) => item.relativePath === document.relativePath); if (source) beginEdit(source) }}><Edit3 size={15} /></button><button type="button" className="document-remove" aria-label={`Remove ${document.name}`}
            onClick={(event) => { event.stopPropagation(); void removeDocument(document.relativePath as string, document.name) }}><Trash2 size={15} /></button></div>}</td>
        </tr>)}</tbody>
      </table></div>}

      {preview && <div className="document-dialog-backdrop" role="presentation" onMouseDown={() => setPreview(null)}><section className="document-dialog document-preview-dialog" role="dialog" aria-modal="true" aria-label={`Preview ${preview.name}`} onMouseDown={(event) => event.stopPropagation()}><header><div><strong>{preview.title || preview.name}</strong><span>{preview.relativePath}</span></div><button type="button" onClick={() => setPreview(null)} aria-label="Close preview"><X size={18} /></button></header><iframe title={`Preview ${preview.name}`} src={getKnowledgePreviewUrl(preview.relativePath)} /><footer><a href={getKnowledgePreviewUrl(preview.relativePath)} target="_blank" rel="noreferrer">Open full preview</a><span>Non-PDF documents are previewed from their indexed PDF copy.</span></footer></section></div>}

      {editing && <div className="document-dialog-backdrop" role="presentation" onMouseDown={() => setEditing(null)}><form className="document-dialog document-edit-dialog" role="dialog" aria-modal="true" aria-label={`Edit ${editing.name}`} onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => void saveEdit(event)}><header><div><strong>Edit document</strong><span>Rename, organize, and describe this source.</span></div><button type="button" onClick={() => setEditing(null)} aria-label="Close editor"><X size={18} /></button></header><div className="document-edit-grid"><label>File name<input value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} /></label><label>Category<input value={editForm.category} onChange={(event) => setEditForm((current) => ({ ...current, category: event.target.value }))} /></label><label className="wide">Collection / folders<input value={editForm.collection} onChange={(event) => setEditForm((current) => ({ ...current, collection: event.target.value }))} placeholder="Example: Bible/Recovery Version" /></label><label className="wide">Display title<input value={editForm.title} onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))} /></label><label className="wide">Description<textarea value={editForm.description} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} /></label><label className="wide">Tags<input value={editForm.tags} onChange={(event) => setEditForm((current) => ({ ...current, tags: event.target.value }))} placeholder="Comma-separated tags" /></label></div><footer><button type="button" onClick={() => setEditing(null)}>Cancel</button><button type="submit" disabled={uploading || !editForm.name.trim() || !editForm.category.trim()}>{uploading ? 'Saving…' : 'Save changes'}</button></footer></form></div>}
    </section>
  )
}
export default DocumentsPage
