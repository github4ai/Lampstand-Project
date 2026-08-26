import { Clock3, Copy, Download, FileText, Folder, MessageSquare, Pencil, Pin, Plus, RotateCcw, Search, Trash2, Upload } from 'lucide-react'
import { useAccessControl } from '../hooks/useAccessControl'
import { useEffect, useMemo, useState } from 'react'
import type { ChatConversation } from '../types/chat'
import type { AgentSummary } from '../services/api'
import { exportConversationAsJson, exportConversationAsMarkdown, exportConversationRecovery, exportConversationsBackup } from '../utils/exportConversation'

interface HistoryPageProps {
  conversations: ChatConversation[]
  agents: AgentSummary[]
  isLoading: boolean
  onNewConversation: () => void
  onOpenConversation: (id: string) => void
  onTogglePinConversation: (id: string) => void
  onRenameConversation: (id: string, title: string) => void
  onMoveConversationToFolder: (id: string, folder: string) => void
  onDuplicateConversation: (id: string) => void
  onDeleteConversation: (id: string) => boolean
  onDeleteConversations: (ids: string[]) => boolean
  onImportConversation: (value: unknown) => boolean
}

type HistorySort = 'newest' | 'oldest' | 'title'
type HistoryRange = 'all' | 'today' | '7days' | '30days'

const historyPreferencesKey = 'aios-history-preferences'
const recoveryStorageKey = 'aios-studio-conversations-recovery-v1'
const deletedRecoveryStorageKey = 'aios-studio-deleted-conversations-recovery-v1'

function loadRecoveryCopy(): string {
  try {
    return localStorage.getItem(recoveryStorageKey) || ''
  } catch {
    return ''
  }
}

function loadDeletedRecoveryCopy(): string {
  try {
    return localStorage.getItem(deletedRecoveryStorageKey) || ''
  } catch {
    return ''
  }
}

function loadHistoryPreferences(): { query: string; pinnedOnly: boolean; sort: HistorySort; agentId: string; range: HistoryRange } {
  const defaults = { query: '', pinnedOnly: false, sort: 'newest' as HistorySort, agentId: 'all', range: 'all' as HistoryRange }
  try {
    const saved = JSON.parse(localStorage.getItem(historyPreferencesKey) ?? '{}') as Partial<typeof defaults>
    return {
      query: typeof saved.query === 'string' ? saved.query : defaults.query,
      pinnedOnly: typeof saved.pinnedOnly === 'boolean' ? saved.pinnedOnly : defaults.pinnedOnly,
      sort: saved.sort === 'oldest' || saved.sort === 'title' ? saved.sort : defaults.sort,
      agentId: typeof saved.agentId === 'string' ? saved.agentId : defaults.agentId,
      range: saved.range === 'today' || saved.range === '7days' || saved.range === '30days' ? saved.range : defaults.range,
    }
  } catch {
    return defaults
  }
}

function HistoryPage({ conversations, agents, isLoading, onNewConversation, onOpenConversation, onTogglePinConversation, onRenameConversation, onMoveConversationToFolder, onDuplicateConversation, onDeleteConversation, onDeleteConversations, onImportConversation }: HistoryPageProps) {
  const { can } = useAccessControl()
  const canCreate = can('history', 'create')
  const canEdit = can('history', 'edit')
  const canDelete = can('history', 'delete')
  const canImport = can('history', 'import')
  const canExport = can('history', 'export')
  const [preferences] = useState(loadHistoryPreferences)
  const [query, setQuery] = useState(preferences.query)
  const [pinnedOnly, setPinnedOnly] = useState(preferences.pinnedOnly)
  const [sort, setSort] = useState<HistorySort>(preferences.sort)
  const [agentId, setAgentId] = useState(preferences.agentId)
  const [range, setRange] = useState<HistoryRange>(preferences.range)
  const [folder, setFolder] = useState('all')
  const [importError, setImportError] = useState('')
  const [recoveryCopy, setRecoveryCopy] = useState(loadRecoveryCopy)
  const [deletedRecoveryCopy, setDeletedRecoveryCopy] = useState(loadDeletedRecoveryCopy)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    localStorage.setItem(historyPreferencesKey, JSON.stringify({ query, pinnedOnly, sort, agentId, range }))
  }, [agentId, pinnedOnly, query, range, sort])

  useEffect(() => {
    if (agentId !== 'all' && !agents.some((agent) => agent.id === agentId)) setAgentId('all')
  }, [agentId, agents])

  useEffect(() => {
    const availableIds = new Set(conversations.map((item) => item.id))
    setSelectedIds((current) => new Set([...current].filter((id) => availableIds.has(id))))
  }, [conversations])

  async function importFile(file: File | undefined) {
    if (!canImport) { setImportError('Your profile cannot import conversations.'); return }
    if (!file) return
    setImportError('')
    try {
      const imported = onImportConversation(JSON.parse(await file.text()))
      if (!imported) setImportError('This file is not a valid AIOS conversation export.')
    } catch {
      setImportError('The selected file does not contain valid JSON.')
    }
  }
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const cutoff = range === 'today' ? startOfToday : range === '7days' ? now.getTime() - 7 * 86400000 : range === '30days' ? now.getTime() - 30 * 86400000 : 0
    return conversations.filter((item) =>
      (agentId === 'all' || item.agentId === agentId) &&
      (folder === 'all' || (folder === 'unfiled' ? !item.folder : item.folder === folder)) &&
      (!cutoff || new Date(item.updatedAt).getTime() >= cutoff) &&
      (!pinnedOnly || item.pinned) &&
      (!term || item.title.toLowerCase().includes(term) ||
        item.messages.some((message) => message.content.toLowerCase().includes(term))),
    ).sort((left, right) => sort === 'title'
      ? left.title.localeCompare(right.title, undefined, { sensitivity: 'base' })
      : sort === 'oldest' ? left.updatedAt.localeCompare(right.updatedAt)
        : right.updatedAt.localeCompare(left.updatedAt))
  }, [agentId, conversations, folder, pinnedOnly, query, range, sort])
  const folders = [...new Set(conversations.map((item) => item.folder?.trim()).filter((value): value is string => Boolean(value)))].sort()
  const pinnedCount = conversations.filter((item) => item.pinned).length
  const hasActiveView = Boolean(query.trim()) || pinnedOnly || sort !== 'newest' || agentId !== 'all' || range !== 'all' || folder !== 'all'
  const selected = conversations.filter((item) => selectedIds.has(item.id))
  const allVisibleSelected = visible.length > 0 && visible.every((item) => selectedIds.has(item.id))

  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleVisibleSelection() {
    setSelectedIds((current) => {
      const next = new Set(current)
      visible.forEach((item) => allVisibleSelected ? next.delete(item.id) : next.add(item.id))
      return next
    })
  }

  function deleteSelected() {
    if (!canDelete) { setImportError('Your profile cannot delete conversations.'); return }
    if (onDeleteConversations([...selectedIds])) setSelectedIds(new Set())
  }

  function resetView() {
    setQuery('')
    setPinnedOnly(false)
    setSort('newest')
    setAgentId('all')
    setRange('all')
    setFolder('all')
  }

  function removeRecoveryCopy() {
    if (!canDelete) { setImportError('Your profile cannot remove recovery data.'); return }
    if (!window.confirm('Remove the preserved recovery copy? Download it first if you may need it later.')) return
    try {
      localStorage.removeItem(recoveryStorageKey)
      setRecoveryCopy('')
    } catch {
      setImportError('The recovery copy could not be removed from browser storage.')
    }
  }

  function removeDeletedRecoveryCopy() {
    if (!canDelete) { setImportError('Your profile cannot remove recovery data.'); return }
    if (!window.confirm('Remove the deleted-conversation recovery copy? Download it first if you may need it later.')) return
    try {
      localStorage.removeItem(deletedRecoveryStorageKey)
      setDeletedRecoveryCopy('')
    } catch {
      setImportError('The deleted-conversation recovery copy could not be removed from browser storage.')
    }
  }

  function renameConversation(item: ChatConversation) {
    if (!canEdit) { setImportError('Your profile cannot rename conversations.'); return }
    const title = window.prompt('Rename conversation', item.title)
    if (title === null || !title.trim() || title.trim() === item.title) return
    onRenameConversation(item.id, title)
  }

  function moveConversation(item: ChatConversation) {
    if (!canEdit) { setImportError('Your profile cannot organize conversations.'); return }
    const nextFolder = window.prompt('Folder name (leave blank for Unfiled)', item.folder || '')
    if (nextFolder === null || nextFolder.trim() === (item.folder || '')) return
    onMoveConversationToFolder(item.id, nextFolder)
  }

  return (
    <section className="history-page">
      <header className="history-page-header">
        <div className="history-page-heading">
          <span className="history-page-icon"><Clock3 size={24} /></span>
          <div><h1>Conversation History</h1><p>Search, revisit, and manage your saved AIOS conversations.</p></div>
        </div>
        <div className="history-header-actions">
          {canExport && <button className="history-import-button" type="button" onClick={() => exportConversationsBackup(conversations)} disabled={conversations.length === 0}>
            <Download size={16} /> Backup all
          </button>}
          {canImport && <label className="history-import-button"><Upload size={16} /> Import JSON<input type="file" accept="application/json,.json" onChange={(event) => { void importFile(event.target.files?.[0]); event.target.value = '' }} /></label>}
          {canCreate && <button className="history-new-button" type="button" onClick={onNewConversation} disabled={isLoading}><Plus size={17} /> New conversation</button>}
        </div>
      </header>
      {importError && <p className="history-import-error">{importError}</p>}
      {recoveryCopy && <div className="history-recovery" role="status">
        <div><strong>Conversation recovery copy available</strong><span>AIOS preserved the original browser data after finding damaged conversation records. Download it before removing it.</span></div>
        {canExport && <button type="button" onClick={() => exportConversationRecovery(recoveryCopy)}><Download size={15} /> Download recovery</button>}
        {canDelete && <button type="button" className="danger" onClick={removeRecoveryCopy}><Trash2 size={15} /> Remove copy</button>}
      </div>}
      {deletedRecoveryCopy && <div className="history-recovery" role="status">
        <div><strong>Deleted conversation recovery copy available</strong><span>The most recently deleted conversations are preserved here until you remove this copy.</span></div>
        {canExport && <button type="button" onClick={() => exportConversationRecovery(deletedRecoveryCopy)}><Download size={15} /> Download recovery</button>}
        {canDelete && <button type="button" className="danger" onClick={removeDeletedRecoveryCopy}><Trash2 size={15} /> Remove copy</button>}
      </div>}
      <div className="history-summary">
        <span><strong>{conversations.length}</strong> saved</span>
        <span><strong>{pinnedCount}</strong> pinned</span>
        {selected.length > 0 && <span><strong>{selected.length}</strong> selected</span>}
      </div>
      <div className="history-toolbar">
        <label className="history-search"><Search size={17} />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="Search titles and messages" aria-label="Search conversation history" />
        </label>
        <button type="button" className={pinnedOnly ? 'history-filter active' : 'history-filter'}
          onClick={() => setPinnedOnly((value) => !value)} aria-pressed={pinnedOnly}>
          <Pin size={14} /> Pinned
        </button>
        <select className="history-filter" value={agentId} onChange={(event) => setAgentId(event.target.value)} aria-label="Filter history by assistant">
          <option value="all">All assistants</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
        </select>
        <select className="history-filter" value={folder} onChange={(event) => setFolder(event.target.value)} aria-label="Filter history by folder">
          <option value="all">All folders</option><option value="unfiled">Unfiled</option>{folders.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className="history-filter" value={range} onChange={(event) => setRange(event.target.value as HistoryRange)} aria-label="Filter history by date">
          <option value="all">All time</option><option value="today">Today</option><option value="7days">Last 7 days</option><option value="30days">Last 30 days</option>
        </select>
        <select className="history-filter" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}
          aria-label="Sort conversation history">
          <option value="newest">Newest</option><option value="oldest">Oldest</option><option value="title">Title A–Z</option>
        </select>
        {hasActiveView && <button type="button" className="history-filter" onClick={resetView}>
          <RotateCcw size={14} /> Reset
        </button>}
        {visible.length > 0 && <button type="button" className="history-filter" onClick={toggleVisibleSelection}>{allVisibleSelected ? 'Clear visible selection' : 'Select visible'}</button>}
        {selected.length > 0 && <button type="button" className="history-filter" onClick={() => exportConversationsBackup(selected)}><Download size={14} /> Backup selected</button>}
        {selected.length > 0 && <button type="button" className="history-filter history-bulk-delete" onClick={deleteSelected} disabled={isLoading}><Trash2 size={14} /> Delete selected</button>}
      </div>
      {visible.length === 0 ? (
        <div className="history-empty"><MessageSquare size={32} />
          <h2>{conversations.length ? 'No matching conversations' : 'No conversations yet'}</h2>
          <p>{conversations.length ? 'Try another search or filter.' : 'Start a conversation and it will appear here automatically.'}</p>
          {conversations.length > 0 && hasActiveView && <button type="button" className="history-filter" onClick={resetView}>
            <RotateCcw size={14} /> Reset filters
          </button>}
        </div>
      ) : (
        <div className="history-grid">{visible.map((item) => {
          const questions = item.messages.filter((message) => message.role === 'user').length
          const agent = agents.find((candidate) => candidate.id === item.agentId)
          const latestMessage = item.messages.at(-1)?.content.trim() || 'No messages saved in this conversation.'
          return <article className="history-card" key={item.id}>
            <label className="history-card-select" title={'Select ' + item.title}><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelection(item.id)} /><span className="sr-only">Select {item.title}</span></label>
            <button type="button" className="history-card-open" onClick={() => onOpenConversation(item.id)} disabled={isLoading}>
              <strong>{item.pinned && <Pin size={14} />} {item.title}</strong>
              <small className="history-card-agent">{agent?.name || 'Unknown assistant'}{item.folder ? ` · ${item.folder}` : ''}</small>
              <p className="history-card-preview">{latestMessage}</p>
              <span>{questions} {questions === 1 ? 'question' : 'questions'} · {new Date(item.updatedAt).toLocaleString()}</span>
            </button>
            <div className="history-card-actions">
              <button type="button" className="history-card-markdown" onClick={() => exportConversationAsMarkdown(item)}
                aria-label={'Download ' + item.title + ' as Markdown'} title="Download readable Markdown"><FileText size={15} /></button>
              <button type="button" className="history-card-download" onClick={() => exportConversationAsJson(item)}
                aria-label={'Download ' + item.title + ' as JSON'} title="Download JSON backup"><Download size={16} /></button>
              <button type="button" className="history-card-edit" onClick={() => renameConversation(item)} disabled={isLoading}
                aria-label={'Rename ' + item.title}><Pencil size={15} /></button>
              <button type="button" className="history-card-folder" onClick={() => moveConversation(item)} disabled={isLoading}
                aria-label={'Move ' + item.title + ' to folder'} title={item.folder ? `Folder: ${item.folder}` : 'Move to folder'}><Folder size={15} /></button>
              <button type="button" className="history-card-copy" onClick={() => onDuplicateConversation(item.id)} disabled={isLoading}
                aria-label={'Duplicate ' + item.title}><Copy size={15} /></button>
              <button type="button" className={item.pinned ? 'history-card-pin active' : 'history-card-pin'}
                onClick={() => onTogglePinConversation(item.id)} disabled={isLoading}
                aria-label={(item.pinned ? 'Unpin ' : 'Pin ') + item.title} aria-pressed={item.pinned}><Pin size={16} /></button>
              <button type="button" className="history-card-delete" onClick={() => onDeleteConversation(item.id)}
                disabled={isLoading} aria-label={'Delete ' + item.title}><Trash2 size={16} /></button>
            </div>
          </article>
        })}</div>
      )}
    </section>
  )
}
export default HistoryPage
