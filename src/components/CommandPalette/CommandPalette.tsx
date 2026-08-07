import {
  Bot,
  Clock3,
  Database,
  FileText,
  MessageSquare,
  MessagesSquare,
  Plus,
  Search,
  X,
} from 'lucide-react'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import type {
  AgentSummary,
} from '../../services/api'

import type {
  ChatConversation,
} from '../../types/chat'

type CommandItemKind =
  | 'command'
  | 'conversation'
  | 'agent'

interface CommandPaletteItem {
  id: string
  title: string
  description: string
  keywords: string
  kind: CommandItemKind
  icon: typeof Search
  action: () => void
}

interface CommandPaletteProps {
  open: boolean
  agents: AgentSummary[]
  conversations: ChatConversation[]
  onClose: () => void
  onNavigate: (
    path: string,
  ) => void
  onNewConversation: () => void
  onSelectConversation: (
    conversationId: string,
  ) => void
  onSelectAgent: (
    agentId: string,
  ) => void
}

function CommandPalette({
  open,
  agents,
  conversations,
  onClose,
  onNavigate,
  onNewConversation,
  onSelectConversation,
  onSelectAgent,
}: CommandPaletteProps) {
  const [
    query,
    setQuery,
  ] = useState('')

  const [
    selectedIndex,
    setSelectedIndex,
  ] = useState(0)

  const inputRef =
    useRef<HTMLInputElement | null>(
      null,
    )

  const items =
    useMemo<CommandPaletteItem[]>(
      () => {
        const commandItems:
          CommandPaletteItem[] = [
          {
            id: 'command-new-chat',
            title: 'New conversation',
            description:
              'Start a new AIOS conversation',
            keywords:
              'new conversation chat create',
            kind: 'command',
            icon: Plus,
            action: () => {
              onNewConversation()
              onNavigate('/')
              onClose()
            },
          },
          {
            id: 'command-open-chat',
            title: 'Open Chat',
            description:
              'Return to the AIOS chat workspace',
            keywords:
              'chat conversation assistant',
            kind: 'command',
            icon: MessagesSquare,
            action: () => {
              onNavigate('/')
              onClose()
            },
          },
          {
            id: 'command-open-knowledge',
            title: 'Open Knowledge Library',
            description:
              'Browse categories, documents and indexes',
            keywords:
              'knowledge library documents faiss chunks embeddings',
            kind: 'command',
            icon: Database,
            action: () => {
              onNavigate(
                '/knowledge',
              )

              onClose()
            },
          },
          { id: 'command-open-agents', title: 'Open AI Agents', description: 'Browse available specialist assistants', keywords: 'agents assistants specialists', kind: 'command', icon: Bot, action: () => { onNavigate('/agents'); onClose() } },
          { id: 'command-open-documents', title: 'Open Documents', description: 'Browse indexed Knowledge documents', keywords: 'documents files library indexed', kind: 'command', icon: FileText, action: () => { onNavigate('/documents'); onClose() } },
          { id: 'command-open-history', title: 'Open Conversation History', description: 'Search and manage saved conversations', keywords: 'history saved conversations pinned', kind: 'command', icon: Clock3, action: () => { onNavigate('/history'); onClose() } },
        ]

        const conversationItems =
          conversations.map(
            (
              conversation,
            ): CommandPaletteItem => ({
              id:
                `conversation-${conversation.id}`,
              title:
                conversation.title,
              description:
                conversation.pinned
                  ? 'Pinned conversation'
                  : 'Saved conversation',
              keywords:
                `${conversation.title} conversation chat`,
              kind: 'conversation',
              icon:
                MessageSquare,
              action: () => {
                onSelectConversation(
                  conversation.id,
                )

                onNavigate('/')
                onClose()
              },
            }),
          )

        const agentItems =
          agents.map(
            (
              agent,
            ): CommandPaletteItem => ({
              id:
                `agent-${agent.id}`,
              title:
                agent.name,
              description:
                agent.description,
              keywords:
                `${agent.name} ${agent.description} assistant agent`,
              kind: 'agent',
              icon: Bot,
              action: () => {
                onSelectAgent(
                  agent.id,
                )

                onNavigate('/')
                onClose()
              },
            }),
          )

        return [
          ...commandItems,
          ...conversationItems,
          ...agentItems,
        ]
      },
      [
        agents,
        conversations,
        onClose,
        onNavigate,
        onNewConversation,
        onSelectAgent,
        onSelectConversation,
      ],
    )

  const filteredItems =
    useMemo(() => {
      const normalizedQuery =
        query
          .trim()
          .toLowerCase()

      if (!normalizedQuery) {
        return items
      }

      return items.filter(
        (item) =>
          item.title
            .toLowerCase()
            .includes(
              normalizedQuery,
            ) ||
          item.description
            .toLowerCase()
            .includes(
              normalizedQuery,
            ) ||
          item.keywords
            .toLowerCase()
            .includes(
              normalizedQuery,
            ),
      )
    }, [
      items,
      query,
    ])

  useEffect(() => {
    if (!open) {
      return
    }

    setQuery('')
    setSelectedIndex(0)

    window.setTimeout(
      () => {
        inputRef.current?.focus()
      },
      0,
    )
  }, [open])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (
      selectedIndex <
      filteredItems.length
    ) {
      return
    }

    setSelectedIndex(
      Math.max(
        filteredItems.length -
          1,
        0,
      ),
    )
  }, [
    filteredItems.length,
    selectedIndex,
  ])

  if (!open) {
    return null
  }

  function runSelectedItem() {
    const selectedItem =
      filteredItems[
        selectedIndex
      ]

    selectedItem?.action()
  }

  return (
    <div
      className="command-palette-backdrop"
      role="presentation"
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose()
        }
      }}
    >
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="AIOS command palette"
      >
        <div className="command-palette-search">
          <Search size={18} />

          <input
            ref={inputRef}
            value={query}
            onChange={(
              event,
            ) =>
              setQuery(
                event.target.value,
              )
            }
            onKeyDown={(
              event,
            ) => {
              if (
                event.key ===
                'ArrowDown'
              ) {
                event.preventDefault()

                setSelectedIndex(
                  (current) =>
                    Math.min(
                      current + 1,
                      filteredItems.length -
                        1,
                    ),
                )
              }

              if (
                event.key ===
                'ArrowUp'
              ) {
                event.preventDefault()

                setSelectedIndex(
                  (current) =>
                    Math.max(
                      current - 1,
                      0,
                    ),
                )
              }

              if (
                event.key ===
                'Enter'
              ) {
                event.preventDefault()
                runSelectedItem()
              }

              if (
                event.key ===
                'Escape'
              ) {
                event.preventDefault()
                onClose()
              }
            }}
            placeholder="Search AIOS or run a command"
            aria-label="Search AIOS"
          />

          <button
            type="button"
            className="command-palette-close"
            onClick={onClose}
            aria-label="Close command palette"
            title="Close"
          >
            <X size={17} />
          </button>
        </div>

        <div className="command-palette-hint">
          <span>
            ↑↓ Navigate
          </span>

          <span>
            Enter Open
          </span>

          <span>
            Esc Close
          </span>
        </div>

        <div className="command-palette-results">
          {filteredItems.length ===
          0 ? (
            <div className="command-palette-empty">
              <Search
                size={24}
              />

              <strong>
                No matching results
              </strong>

              <span>
                Try another command,
                conversation or
                assistant name.
              </span>
            </div>
          ) : (
            filteredItems.map(
              (
                item,
                index,
              ) => {
                const Icon =
                  item.icon

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`command-palette-item ${
                      index ===
                      selectedIndex
                        ? 'selected'
                        : ''
                    }`}
                    onMouseEnter={() =>
                      setSelectedIndex(
                        index,
                      )
                    }
                    onClick={
                      item.action
                    }
                  >
                    <span className="command-palette-item-icon">
                      <Icon
                        size={17}
                      />
                    </span>

                    <span className="command-palette-item-copy">
                      <strong>
                        {item.title}
                      </strong>

                      <small>
                        {
                          item.description
                        }
                      </small>
                    </span>

                    <span className="command-palette-item-kind">
                      {item.kind}
                    </span>
                  </button>
                )
              },
            )
          )}
        </div>
      </section>
    </div>
  )
}

export default CommandPalette