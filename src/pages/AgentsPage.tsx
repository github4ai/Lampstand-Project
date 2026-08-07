import { Bot, Check, MessageSquare, RefreshCw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AgentSummary } from '../services/api'

interface AgentsPageProps {
  agents: AgentSummary[]
  selectedAgentId: string
  loading: boolean
  error: string
  onRetry: () => Promise<boolean>
  onSelectAgent: (id: string) => void
  onStartChat: () => void
}

function AgentsPage({ agents, selectedAgentId, loading, error, onRetry, onSelectAgent, onStartChat }: AgentsPageProps) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const categories = useMemo(() => [...new Set(agents.map((agent) => agent.category))].sort(), [agents])
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return agents.filter((agent) =>
      (category === 'all' || agent.category === category) &&
      (!term || agent.name.toLowerCase().includes(term) ||
        agent.description.toLowerCase().includes(term) ||
        agent.category.toLowerCase().includes(term)),
    )
  }, [agents, category, query])

  function selectAndChat(id: string) {
    onSelectAgent(id)
    onStartChat()
  }

  return (
    <section className="agents-page">
      <header className="agents-header">
        <div className="agents-heading"><span><Bot size={25} /></span>
          <div><h1>AI Agents</h1><p>Choose the specialist best suited to your current task.</p></div>
        </div>
        <div className="agents-count"><strong>{agents.length}</strong> available</div>
      </header>

      <div className="agents-toolbar">
        <label><Search size={17} /><input type="search" value={query}
          onChange={(event) => setQuery(event.target.value)} placeholder="Search agents" /></label>
        <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter agents by category">
          <option value="all">All categories</option>
          {categories.map((item) => <option value={item} key={item}>{item}</option>)}
        </select>
      </div>

      {loading ? <div className="agents-state">Loading agents...</div> :
       error ? <div className="agents-state agents-error"><h2>Unable to load agents</h2><p>{error}</p><button type="button" className="agents-retry-button" onClick={() => void onRetry()}><RefreshCw size={15} /> Retry</button></div> :
       visible.length === 0 ? <div className="agents-state"><h2>No matching agents</h2><p>Try another search or category.</p></div> :
       <div className="agents-grid">{visible.map((agent) => {
        const active = agent.id === selectedAgentId
        return <article className={active ? 'agent-workspace-card active' : 'agent-workspace-card'} key={agent.id}>
          <div className="agent-workspace-card-top"><span className="agent-workspace-avatar">{agent.icon || 'AI'}</span>
            {active && <span className="agent-active-label"><Check size={13} /> Active</span>}
          </div>
          <h2>{agent.name}</h2><p>{agent.description}</p><span className="agent-category">{agent.category}</span>
          <button type="button" onClick={() => selectAndChat(agent.id)}>
            <MessageSquare size={16} /> {active ? 'Continue chat' : 'Use this agent'}
          </button>
        </article>
      })}</div>}
    </section>
  )
}
export default AgentsPage
