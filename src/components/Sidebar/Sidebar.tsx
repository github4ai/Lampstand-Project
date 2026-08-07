import {
  useMemo,
  useState,
} from 'react'

import type {
  KeyboardEvent,
} from 'react'

import {
  Bot,
  Clock3,
  Command,
  Copy,
  Database,
  FileJson,
  FileText,
  MessageSquare,
  MessagesSquare,
  Pencil,
  Pin,
  PinOff,
  Search,
  Trash2,
} from 'lucide-react'

import {
  NavLink,
  useNavigate,
} from 'react-router-dom'

import type {
  AgentSummary,
} from '../../services/api'

import {
  useAppStore,
} from '../../store/useAppStore'

import type {
  ChatConversation,
} from '../../types/chat'

import {
  exportConversationAsJson,
  exportConversationAsMarkdown,
} from '../../utils/exportConversation'

interface SidebarProps {
  agents: AgentSummary[]
  conversations: ChatConversation[]
  activeConversationId:
    string | null
  selectedAgentId: string
  isLoading: boolean
  agentsLoading: boolean

  onSelectAgent: (
    agentId: string,
  ) => void

  onNewConversation:
    () => void

  onSelectConversation: (
    conversationId: string,
  ) => void

  onRenameConversation: (
    conversationId: string,
    title: string,
  ) => void

  onDuplicateConversation: (
    conversationId: string,
  ) => void

  onTogglePinConversation: (
    conversationId: string,
  ) => void

  onDeleteConversation: (
    conversationId: string,
  ) => void
}

function Sidebar({
  agents,
  conversations,
  activeConversationId,
  selectedAgentId,
  isLoading,
  agentsLoading,
  onSelectAgent,
  onNewConversation,
  onSelectConversation,
  onRenameConversation,
  onDuplicateConversation,
  onTogglePinConversation,
  onDeleteConversation,
}: SidebarProps) {
  const navigate =
    useNavigate()

  const openCommandPalette =
    useAppStore(
      (state) =>
        state.openCommandPalette,
    )

  const addToast =
    useAppStore(
      (state) =>
        state.addToast,
    )

  const [
    searchQuery,
    setSearchQuery,
  ] = useState('')

  const [
    editingConversationId,
    setEditingConversationId,
  ] = useState<string | null>(
    null,
  )

  const [
    draftTitle,
    setDraftTitle,
  ] = useState('')

  const [
    exportConversationId,
    setExportConversationId,
  ] = useState<string | null>(
    null,
  )

  const selectedAgent =
    agents.find(
      (agent) =>
        agent.id ===
        selectedAgentId,
    ) ?? null

  const backendConnected =
    agents.length > 0

  const filteredConversations =
    useMemo(() => {
      const normalizedQuery =
        searchQuery
          .trim()
          .toLowerCase()

      if (!normalizedQuery) {
        return conversations
      }

      return conversations.filter(
        (conversation) =>
          conversation.title
            .toLowerCase()
            .includes(
              normalizedQuery,
            ),
      )
    }, [
      conversations,
      searchQuery,
    ])

  function beginRename(
    conversation: ChatConversation,
  ) {
    if (isLoading) {
      return
    }

    setExportConversationId(
      null,
    )

    setEditingConversationId(
      conversation.id,
    )

    setDraftTitle(
      conversation.title,
    )
  }

  function cancelRename() {
    setEditingConversationId(
      null,
    )

    setDraftTitle('')
  }

  function saveRename(
    conversationId: string,
  ) {
    const normalizedTitle =
      draftTitle.trim()

    if (normalizedTitle) {
      onRenameConversation(
        conversationId,
        normalizedTitle,
      )

      addToast({
        title:
          'Conversation renamed',
        message:
          normalizedTitle,
        variant: 'success',
        duration: 2600,
      })
    }

    cancelRename()
  }

  function handleRenameKeyDown(
    event:
      KeyboardEvent<HTMLInputElement>,
    conversationId: string,
  ) {
    if (event.key === 'Enter') {
      event.preventDefault()

      saveRename(
        conversationId,
      )

      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()

      cancelRename()
    }
  }

  function toggleExportMenu(
    conversationId: string,
  ) {
    setExportConversationId(
      (currentId) =>
        currentId ===
        conversationId
          ? null
          : conversationId,
    )
  }

  function exportMarkdown(
    conversation: ChatConversation,
  ) {
    exportConversationAsMarkdown(
      conversation,
    )

    setExportConversationId(
      null,
    )

    addToast({
      title:
        'Markdown exported',
      message:
        conversation.title,
      variant: 'success',
      duration: 3000,
    })
  }

  function exportJson(
    conversation: ChatConversation,
  ) {
    exportConversationAsJson(
      conversation,
    )

    setExportConversationId(
      null,
    )

    addToast({
      title:
        'JSON exported',
      message:
        conversation.title,
      variant: 'success',
      duration: 3000,
    })
  }

  function handleNewConversation() {
    onNewConversation()

    navigate('/')
  }

  function handleOpenConversation(
    conversationId: string,
  ) {
    setExportConversationId(
      null,
    )

    onSelectConversation(
      conversationId,
    )

    navigate('/')
  }

  function handleDuplicate(
    conversation: ChatConversation,
  ) {
    onDuplicateConversation(
      conversation.id,
    )

    addToast({
      title:
        'Conversation duplicated',
      message:
        conversation.title,
      variant: 'success',
      duration: 2800,
    })
  }

  function handleTogglePin(
    conversation: ChatConversation,
  ) {
    onTogglePinConversation(
      conversation.id,
    )

    addToast({
      title:
        conversation.pinned
          ? 'Conversation unpinned'
          : 'Conversation pinned',
      message:
        conversation.title,
      variant: 'info',
      duration: 2400,
    })
  }

  function handleDelete(
    conversation: ChatConversation,
  ) {
    onDeleteConversation(
      conversation.id,
    )

    addToast({
      title:
        'Conversation deleted',
      message:
        conversation.title,
      variant: 'warning',
      duration: 3200,
    })
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">
          <Bot size={26} />
        </div>

        <div className="brand-copy">
          <h1>AIOS Studio</h1>

          <p>
            Local AI workspace
          </p>
        </div>
      </div>

      <button
        type="button"
        className="new-chat-button"
        onClick={
          handleNewConversation
        }
        disabled={
          isLoading ||
          !selectedAgent
        }
      >
        New conversation
      </button>

      <button
        type="button"
        className="command-palette-trigger"
        onClick={
          openCommandPalette
        }
      >
        <Search size={16} />

        <span>
          Search AIOS
        </span>

        <kbd>
          Ctrl K
        </kbd>
      </button>

      <nav
        className="workspace-navigation"
        aria-label="AIOS workspace"
      >
        <NavLink
          to="/"
          end
          className={({
            isActive,
          }) =>
            `workspace-navigation-link ${
              isActive
                ? 'active'
                : ''
            }`
          }
        >
          <MessagesSquare
            size={17}
          />

          <span>Chat</span>
        </NavLink>

        <NavLink
          to="/knowledge"
          className={({
            isActive,
          }) =>
            `workspace-navigation-link ${
              isActive
                ? 'active'
                : ''
            }`
          }
        >
          <Database
            size={17}
          />

          <span>
            Knowledge
          </span>
        </NavLink>

        <NavLink to="/agents" className={({ isActive }) => "workspace-navigation-link " + (isActive ? "active" : "")}>
          <Bot size={17} /><span>Agents</span>
        </NavLink>

        <NavLink to="/documents" className={({ isActive }) => "workspace-navigation-link " + (isActive ? "active" : "")}>
          <FileText size={17} /><span>Documents</span>
        </NavLink>

        <NavLink to="/history" className={({ isActive }) => "workspace-navigation-link " + (isActive ? "active" : "")}>
          <Clock3 size={17} /><span>History</span>
        </NavLink>

        <button
          type="button"
          className="workspace-navigation-link workspace-command-link"
          onClick={
            openCommandPalette
          }
        >
          <Command size={17} />

          <span>
            Commands
          </span>
        </button>
      </nav>

      <div className="category-section">
        <label htmlFor="agent">
          Assistant
        </label>

        <select
          id="agent"
          value={selectedAgentId}
          onChange={(event) =>
            onSelectAgent(
              event.target.value,
            )
          }
          disabled={
            isLoading ||
            agentsLoading ||
            agents.length === 0
          }
        >
          {agentsLoading && (
            <option value="">
              Loading assistants...
            </option>
          )}

          {!agentsLoading &&
            agents.length ===
              0 && (
              <option value="">
                No assistants available
              </option>
            )}

          {agents.map(
            (agent) => (
              <option
                key={agent.id}
                value={agent.id}
              >
                {agent.name}
              </option>
            ),
          )}
        </select>

        {selectedAgent && (
          <p className="agent-description">
            {
              selectedAgent.description
            }
          </p>
        )}
      </div>

      <div className="conversation-section">
        <div className="conversation-section-title">
          Conversations
        </div>

        <label className="conversation-search">
          <Search size={15} />

          <input
            type="search"
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(
                event.target.value,
              )
            }
            placeholder="Search conversations"
            aria-label="Search conversations"
          />
        </label>

        <div className="conversation-list">
          {filteredConversations.length ===
            0 && (
            <p className="empty-conversations">
              {conversations.length ===
              0
                ? (
                    'No saved conversations.'
                  )
                : (
                    'No matching conversations.'
                  )}
            </p>
          )}

          {filteredConversations.map(
            (conversation) => {
              const isEditing =
                editingConversationId ===
                conversation.id

              const showExportMenu =
                exportConversationId ===
                conversation.id

              const isActive =
                conversation.id ===
                activeConversationId

              return (
                <div
                  key={
                    conversation.id
                  }
                  className={`conversation-item ${
                    isActive
                      ? 'active'
                      : ''
                  } ${
                    conversation.pinned
                      ? 'pinned'
                      : ''
                  }`}
                >
                  {isEditing ? (
                    <input
                      className="conversation-title-input"
                      value={
                        draftTitle
                      }
                      onChange={(
                        event,
                      ) =>
                        setDraftTitle(
                          event.target
                            .value,
                        )
                      }
                      onBlur={() =>
                        saveRename(
                          conversation.id,
                        )
                      }
                      onKeyDown={(
                        event,
                      ) =>
                        handleRenameKeyDown(
                          event,
                          conversation.id,
                        )
                      }
                      autoFocus
                      maxLength={120}
                      aria-label="Conversation title"
                    />
                  ) : (
                    <button
                      type="button"
                      className="conversation-open-button"
                      onClick={() =>
                        handleOpenConversation(
                          conversation.id,
                        )
                      }
                      onDoubleClick={() =>
                        beginRename(
                          conversation,
                        )
                      }
                      disabled={
                        isLoading
                      }
                    >
                      {conversation.pinned ? (
                        <Pin
                          size={15}
                          className="conversation-pin-icon"
                        />
                      ) : (
                        <MessageSquare
                          size={15}
                        />
                      )}

                      <div className="conversation-title-wrapper">
                        <span className="conversation-title">
                          {
                            conversation.title
                          }
                        </span>
                      </div>
                    </button>
                  )}

                  {!isEditing && (
                    <div className="conversation-actions">
                      <button
                        type="button"
                        className="conversation-action-button"
                        onClick={() =>
                          handleTogglePin(
                            conversation,
                          )
                        }
                        disabled={
                          isLoading
                        }
                        aria-label={
                          conversation.pinned
                            ? (
                                `Unpin ${conversation.title}`
                              )
                            : (
                                `Pin ${conversation.title}`
                              )
                        }
                        title={
                          conversation.pinned
                            ? 'Unpin'
                            : 'Pin'
                        }
                      >
                        {conversation.pinned ? (
                          <PinOff
                            size={13}
                          />
                        ) : (
                          <Pin
                            size={13}
                          />
                        )}
                      </button>

                      <button
                        type="button"
                        className="conversation-action-button"
                        onClick={() =>
                          beginRename(
                            conversation,
                          )
                        }
                        disabled={
                          isLoading
                        }
                        aria-label={
                          `Rename ${conversation.title}`
                        }
                        title="Rename"
                      >
                        <Pencil
                          size={13}
                        />
                      </button>

                      <button
                        type="button"
                        className="conversation-action-button"
                        onClick={() =>
                          handleDuplicate(
                            conversation,
                          )
                        }
                        disabled={
                          isLoading
                        }
                        aria-label={
                          `Duplicate ${conversation.title}`
                        }
                        title="Duplicate"
                      >
                        <Copy
                          size={13}
                        />
                      </button>

                      <div className="conversation-export">
                        <button
                          type="button"
                          className="conversation-action-button"
                          onClick={() =>
                            toggleExportMenu(
                              conversation.id,
                            )
                          }
                          disabled={
                            isLoading
                          }
                          aria-label={
                            `Export ${conversation.title}`
                          }
                          aria-expanded={
                            showExportMenu
                          }
                          title="Export"
                        >
                          <FileText
                            size={13}
                          />
                        </button>

                        {showExportMenu && (
                          <div className="conversation-export-menu">
                            <button
                              type="button"
                              onClick={() =>
                                exportMarkdown(
                                  conversation,
                                )
                              }
                            >
                              <FileText
                                size={14}
                              />

                              <span>
                                Export Markdown
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                exportJson(
                                  conversation,
                                )
                              }
                            >
                              <FileJson
                                size={14}
                              />

                              <span>
                                Export JSON
                              </span>
                            </button>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        className="conversation-action-button conversation-delete-button"
                        onClick={() =>
                          handleDelete(
                            conversation,
                          )
                        }
                        disabled={
                          isLoading
                        }
                        aria-label={
                          `Delete ${conversation.title}`
                        }
                        title="Delete"
                      >
                        <Trash2
                          size={14}
                        />
                      </button>
                    </div>
                  )}
                </div>
              )
            },
          )}
        </div>
      </div>

      <div className="status-card">
        <span
          className={`status-dot ${
            backendConnected
              ? ''
              : 'status-dot-offline'
          }`}
        />

        <div>
          <strong>
            {backendConnected
              ? (
                  'Backend connected'
                )
              : (
                  'Backend unavailable'
                )}
          </strong>

          <p>
            127.0.0.1:8765
          </p>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar