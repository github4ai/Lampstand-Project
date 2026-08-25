import { BookOpen, Bot, Check, CircleCheck, GraduationCap, Library, Lightbulb, MessageSquare, RefreshCw, RotateCcw, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useKnowledge } from '../hooks/useKnowledge'
import type { AgentSummary } from '../services/api'

interface AgentsPageProps {
  agents: AgentSummary[]
  selectedAgentId: string
  loading: boolean
  error: string
  onRetry: () => Promise<boolean>
  onStartChat: (id: string) => void
}

type AgentSort = 'active' | 'name' | 'category'
const agentPreferencesKey = 'aios-agent-preferences'

function AgentIcon({ icon }: { icon: string }) {
  if (icon === 'book-open') return <BookOpen size={22} />
  if (icon === 'graduation-cap') return <GraduationCap size={22} />
  return <Bot size={22} />
}

function loadAgentPreferences(): { query: string; category: string; sort: AgentSort } {
  const defaults = { query: '', category: 'all', sort: 'active' as AgentSort }
  try {
    const saved = JSON.parse(localStorage.getItem(agentPreferencesKey) ?? '{}') as Partial<typeof defaults>
    return {
      query: typeof saved.query === 'string' ? saved.query : defaults.query,
      category: typeof saved.category === 'string' ? saved.category : defaults.category,
      sort: saved.sort === 'name' || saved.sort === 'category' ? saved.sort : defaults.sort,
    }
  } catch {
    return defaults
  }
}

function AgentsPage({ agents, selectedAgentId, loading, error, onRetry, onStartChat }: AgentsPageProps) {
  const navigate = useNavigate()
  const { data: knowledge, loading: knowledgeLoading, error: knowledgeError } = useKnowledge()
  const [preferences] = useState(loadAgentPreferences)
  const [query, setQuery] = useState(preferences.query)
  const [category, setCategory] = useState(preferences.category)
  const [sort, setSort] = useState<AgentSort>(preferences.sort)
  const categories = useMemo(() => [...new Set(agents.map((agent) => agent.category))].sort(), [agents])

  useEffect(() => {
    localStorage.setItem(agentPreferencesKey, JSON.stringify({ query, category, sort }))
  }, [category, query, sort])

  useEffect(() => {
    if (!loading && category !== 'all' && !categories.includes(category)) setCategory('all')
  }, [categories, category, loading])
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return agents.filter((agent) =>
      (category === 'all' || agent.category === category) &&
      (!term || agent.name.toLowerCase().includes(term) ||
        agent.description.toLowerCase().includes(term) ||
        agent.category.toLowerCase().includes(term)),
    ).sort((left, right) => sort === 'active'
      ? Number(right.id === selectedAgentId) - Number(left.id === selectedAgentId) || left.name.localeCompare(right.name)
      : sort === 'category' ? left.category.localeCompare(right.category) || left.name.localeCompare(right.name)
        : left.name.localeCompare(right.name))
  }, [agents, category, query, selectedAgentId, sort])

  function selectAndChat(id: string) {
    onStartChat(id)
  }

  function manageKnowledge(agent: AgentSummary) {
    const params = new URLSearchParams({ category: agent.category, add: 'true' })
    navigate(`/documents?${params.toString()}`)
  }

  function resetView() {
    setQuery('')
    setCategory('all')
    setSort('active')
  }
  const hasActiveView = Boolean(query.trim()) || category !== 'all' || sort !== 'active'

  return (
    <section className="agents-page">
      <header className="agents-header">
        <div className="agents-heading"><span><Bot size={25} /></span>
          <div><h1>Agents &amp; Assistants</h1><p>Choose a specialist assistant, review what it can do, and manage its knowledge.</p></div>
        </div>
        <div className="agents-header-actions">
          <div className="agents-count"><strong>{visible.length}</strong> of {agents.length} available</div>
          <button type="button" className="agents-refresh-button" onClick={() => void onRetry()} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : undefined} /> {loading ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && agents.length > 0 && <div className="agents-warning" role="status">
        <span>{error} Showing the last available agent list.</span>
        <button type="button" onClick={() => void onRetry()} disabled={loading}>Try again</button>
      </div>}

      <div className="agents-toolbar">
        <label><Search size={17} /><input type="search" value={query}
          onChange={(event) => setQuery(event.target.value)} placeholder="Search agents" /></label>
        <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter agents by category">
          <option value="all">All categories</option>
          {categories.map((item) => <option value={item} key={item}>{item}</option>)}
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Sort agents">
          <option value="active">Active first</option><option value="name">Name A–Z</option><option value="category">Category</option>
        </select>
        {hasActiveView && <button type="button" className="agents-toolbar-reset" onClick={resetView}><RotateCcw size={14} /> Reset</button>}
      </div>

      {loading && agents.length === 0 ? <div className="agents-state">Loading agents...</div> :
       error && agents.length === 0 ? <div className="agents-state agents-error"><h2>Unable to load agents</h2><p>{error}</p><button type="button" className="agents-retry-button" onClick={() => void onRetry()}><RefreshCw size={15} /> Retry</button></div> :
       visible.length === 0 ? <div className="agents-state"><h2>No matching agents</h2><p>Try another search or category.</p>
         <button type="button" className="agents-retry-button" onClick={resetView}>
           Clear filters
         </button></div> :
       <div className="agents-grid">{visible.map((agent) => {
        const active = agent.id === selectedAgentId
        const knowledgeCategory = knowledge?.categories.find((item) => item.name.toLowerCase() === agent.category.toLowerCase())
        return <article className={active ? 'agent-workspace-card active' : 'agent-workspace-card'} key={agent.id}>
          <div className="agent-workspace-card-top"><span className="agent-workspace-avatar"><AgentIcon icon={agent.icon} /></span>
            {active && <span className="agent-active-label"><Check size={13} /> Active</span>}
          </div>
          <h2>{agent.name}</h2><p>{agent.description}</p><span className="agent-category">{agent.category}</span>
          <div className="agent-capabilities" aria-label={`${agent.name} capabilities`}>
            <strong><CircleCheck size={14} /> Capabilities</strong>
            <ul>{(agent.capabilities ?? []).map((capability) => <li key={capability}>{capability}</li>)}</ul>
          </div>
          <div className="agent-recommended-tasks">
            <strong><Lightbulb size={14} /> Good tasks to try</strong>
            <ul>{(agent.recommended_tasks ?? []).map((task) => <li key={task}>{task}</li>)}</ul>
          </div>
          <div className={`agent-knowledge-status${knowledgeCategory?.indexed_document_count ? ' ready' : ''}`}><Library size={15} /><span><strong>{knowledgeLoading ? 'Checking knowledge…' : knowledgeError ? 'Knowledge status unavailable' : knowledgeCategory ? `${knowledgeCategory.indexed_document_count} of ${knowledgeCategory.document_count} documents indexed` : 'No knowledge added yet'}</strong><small>{knowledgeCategory ? `${knowledgeCategory.chunk_count.toLocaleString()} searchable passages` : 'Add documents to prepare this assistant'}</small></span></div>
          <div className="agent-card-actions"><button type="button" onClick={() => selectAndChat(agent.id)}>
            <MessageSquare size={16} /> {active ? 'Continue chat' : 'Use this agent'}
          </button><button type="button" className="secondary" onClick={() => manageKnowledge(agent)}>
            <Library size={16} /> Manage knowledge
          </button></div>
        </article>
      })}</div>}
    </section>
  )
}
export default AgentsPage
