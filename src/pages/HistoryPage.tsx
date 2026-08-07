import { Clock3, MessageSquare, Pin, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ChatConversation } from '../types/chat'

interface HistoryPageProps {
  conversations: ChatConversation[]
  isLoading: boolean
  onNewConversation: () => void
  onOpenConversation: (id: string) => void
  onDeleteConversation: (id: string) => boolean
}

function HistoryPage({ conversations, isLoading, onNewConversation, onOpenConversation, onDeleteConversation }: HistoryPageProps) {
  const [query, setQuery] = useState('')
  const [pinnedOnly, setPinnedOnly] = useState(false)
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return conversations.filter((item) =>
      (!pinnedOnly || item.pinned) &&
      (!term || item.title.toLowerCase().includes(term) ||
        item.messages.some((message) => message.content.toLowerCase().includes(term))),
    )
  }, [conversations, pinnedOnly, query])
  const pinnedCount = conversations.filter((item) => item.pinned).length

  return (
    <section className="history-page">
      <header className="history-page-header">
        <div className="history-page-heading">
          <span className="history-page-icon"><Clock3 size={24} /></span>
          <div><h1>Conversation History</h1><p>Search, revisit, and manage your saved AIOS conversations.</p></div>
        </div>
        <button className="history-new-button" type="button" onClick={onNewConversation} disabled={isLoading}>
          <Plus size={17} /> New conversation
        </button>
      </header>
      <div className="history-summary">
        <span><strong>{conversations.length}</strong> saved</span>
        <span><strong>{pinnedCount}</strong> pinned</span>
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
      </div>
      {visible.length === 0 ? (
        <div className="history-empty"><MessageSquare size={32} />
          <h2>{conversations.length ? 'No matching conversations' : 'No conversations yet'}</h2>
          <p>{conversations.length ? 'Try another search or filter.' : 'Start a conversation and it will appear here automatically.'}</p>
        </div>
      ) : (
        <div className="history-grid">{visible.map((item) => {
          const questions = item.messages.filter((message) => message.role === 'user').length
          return <article className="history-card" key={item.id}>
            <button type="button" className="history-card-open" onClick={() => onOpenConversation(item.id)} disabled={isLoading}>
              <strong>{item.pinned && <Pin size={14} />} {item.title}</strong>
              <span>{questions} {questions === 1 ? 'question' : 'questions'} · {new Date(item.updatedAt).toLocaleString()}</span>
            </button>
            <button type="button" className="history-card-delete" onClick={() => onDeleteConversation(item.id)}
              disabled={isLoading} aria-label={'Delete ' + item.title}><Trash2 size={16} /></button>
          </article>
        })}</div>
      )}
    </section>
  )
}
export default HistoryPage
