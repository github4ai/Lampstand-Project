import {
  Bot,
  BookOpen,
  BookOpenText,
  Church,
  Clock3,
  Database,
  Download,
  FileText,
  HeartHandshake,
  History,
  Megaphone,
  Languages,
  MessageSquare,
  MessagesSquare,
  Plus,
  Search,
  Settings,
  Sparkles,
  UsersRound,
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

const commandKindLabels: Record<
  CommandItemKind,
  string
> = {
  command: 'Commands',
  conversation: 'Conversations',
  agent: 'Assistants',
}

const commandKindBadges: Record<
  CommandItemKind,
  string
> = {
  command: 'Command',
  conversation: 'Conversation',
  agent: 'Assistant',
}

const recentCommandsStorageKey =
  'aios-recent-commands'

function loadRecentCommandIds() {
  try {
    const storedValue =
      window.localStorage.getItem(
        recentCommandsStorageKey,
      )

    if (!storedValue) {
      return []
    }

    const parsedValue: unknown =
      JSON.parse(storedValue)

    return Array.isArray(parsedValue)
      ? parsedValue.filter(
          (value): value is string =>
            typeof value === 'string',
        )
      : []
  } catch {
    return []
  }
}

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

function getSearchScore(
  item: CommandPaletteItem,
  terms: string[],
) {
  const title =
    item.title.toLowerCase()
  const description =
    item.description.toLowerCase()
  const keywords =
    item.keywords.toLowerCase()

  let score = 0

  for (const term of terms) {
    if (title === term) {
      score += 100
    } else if (
      title.startsWith(term)
    ) {
      score += 40
    } else if (
      title.includes(term)
    ) {
      score += 24
    } else if (
      keywords.includes(term)
    ) {
      score += 12
    } else if (
      description.includes(term)
    ) {
      score += 6
    } else {
      return -1
    }
  }

  return score
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

  const [
    recentCommandIds,
    setRecentCommandIds,
  ] = useState<string[]>(
    loadRecentCommandIds,
  )

  const inputRef =
    useRef<HTMLInputElement | null>(
      null,
    )

  const resultsRef =
    useRef<HTMLDivElement | null>(
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
          { id: 'command-open-settings', title: 'Open Settings', description: 'Manage preferences and API status', keywords: 'settings preferences api connection', kind: 'command', icon: Settings, action: () => { onNavigate('/settings'); onClose() } },
          { id: 'command-open-updates', title: 'Open App Updates', description: 'Update Lampstand Project and its libraries in Settings', keywords: 'settings updates upgrade download app library reinstall', kind: 'command', icon: Download, action: () => { onNavigate('/settings#app-updates'); onClose() } },
          { id: 'command-open-agents', title: 'Open AI Agents', description: 'Browse available specialist assistants', keywords: 'agents assistants specialists', kind: 'command', icon: Bot, action: () => { onNavigate('/agents'); onClose() } },
          { id: 'command-manage-ministry-knowledge', title: 'Manage Ministry knowledge', description: 'Add or index documents for Ministry Assistant', keywords: 'assistant knowledge ministry upload documents index', kind: 'command', icon: Database, action: () => { onNavigate('/documents?category=Ministry&add=true'); onClose() } },
          { id: 'command-manage-school-knowledge', title: 'Manage School knowledge', description: 'Add or index documents for School Assistant', keywords: 'assistant knowledge school upload subjects documents index', kind: 'command', icon: Database, action: () => { onNavigate('/documents?category=School&add=true'); onClose() } },
          { id: 'command-manage-general-knowledge', title: 'Manage General knowledge', description: 'Add or index documents for General Assistant', keywords: 'assistant knowledge general upload documents index', kind: 'command', icon: Database, action: () => { onNavigate('/documents?category=General&add=true'); onClose() } },
          { id: 'command-open-ministry', title: 'Open Ministry', description: 'Open the Ministry reading and study workspace', keywords: 'ministry bible hwmr hymnal life study', kind: 'command', icon: BookOpen, action: () => { onNavigate('/ministry'); onClose() } },
          { id: 'command-open-hwmr', title: 'Open HWMR', description: 'Continue the current Holy Word for Morning Revival reading', keywords: 'ministry hwmr morning revival daily reading week', kind: 'command', icon: BookOpenText, action: () => { onNavigate('/ministry/hwmr'); onClose() } },
          { id: 'command-open-hymnal', title: 'Open Hymnal', description: 'Browse hymns, lyrics, chords, and tunes', keywords: 'ministry hymnal hymn lyrics chords guitar piano tune', kind: 'command', icon: BookOpenText, action: () => { onNavigate('/hymnal'); onClose() } },
          { id: 'command-open-recovery-bible', title: 'Open Recovery Bible', description: 'Read the Recovery Version with footnotes and references', keywords: 'ministry recovery bible verses footnotes concordance', kind: 'command', icon: BookOpen, action: () => { onNavigate('/recovery-bible'); onClose() } },
          { id: 'command-open-life-study', title: 'Open Life-Study', description: 'Read locally available Life-study messages', keywords: 'ministry life study messages witness lee', kind: 'command', icon: BookOpenText, action: () => { onNavigate('/life-study'); onClose() } },
          { id: 'command-open-media', title: 'Open Media Studio', description: 'Create images, audio, music, speech, and video', keywords: 'media studio image audio music speech song video generation', kind: 'command', icon: Sparkles, action: () => { onNavigate('/media'); onClose() } },
          { id: 'command-open-language-tools', title: 'Open Language Tools', description: 'Translate text, transcribe audio, and hear pronunciation', keywords: 'language translation transcription pronunciation speech tamil hindi marathi telugu malayalam', kind: 'command', icon: Languages, action: () => { onNavigate('/language-tools'); onClose() } },
          { id: 'command-open-documents', title: 'Open Documents', description: 'Browse indexed Knowledge documents', keywords: 'documents files library indexed', kind: 'command', icon: FileText, action: () => { onNavigate('/documents'); onClose() } },
          { id: 'command-open-history', title: 'Open Conversation History', description: 'Search and manage saved conversations', keywords: 'history saved conversations pinned', kind: 'command', icon: Clock3, action: () => { onNavigate('/history'); onClose() } },
          { id: 'command-open-church', title: 'Open Church', description: 'Prayer, announcements, and church service tools', keywords: 'church prayer points announcements posting', kind: 'command', icon: Church, action: () => { onNavigate('/church'); onClose() } },
          { id: 'command-open-prayer-points', title: 'Open Prayer Points', description: 'Prepare and share Tuesday prayer points', keywords: 'church prayer points whatsapp tuesday', kind: 'command', icon: HeartHandshake, action: () => { onNavigate('/church/prayer-points'); onClose() } },
          { id: 'command-open-announcements', title: 'Open Church Announcements', description: 'Prepare and share church announcements', keywords: 'church announcement whatsapp post', kind: 'command', icon: Megaphone, action: () => { onNavigate('/church/announcements'); onClose() } },
          { id: 'command-open-posting-history', title: 'Open Church Posting History', description: 'Review saved and posted church messages', keywords: 'church prayer points announcements archive posted history', kind: 'command', icon: History, action: () => { onNavigate('/church/posting-history'); onClose() } },
          { id: 'command-open-church-groups', title: 'Open Church WhatsApp Groups', description: 'Manage reusable group names for Church posts', keywords: 'church whatsapp groups prayer announcements', kind: 'command', icon: UsersRound, action: () => { onNavigate('/church/groups'); onClose() } },
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

  const orderedItems =
    useMemo(() => {
      const recentOrder =
        new Map(
          recentCommandIds.map(
            (id, index) => [
              id,
              index,
            ],
          ),
        )

      const recentCommands =
        items
          .filter(
            (item) =>
              item.kind ===
                'command' &&
              recentOrder.has(
                item.id,
              ),
          )
          .sort(
            (left, right) =>
              (recentOrder.get(
                left.id,
              ) ?? 0) -
              (recentOrder.get(
                right.id,
              ) ?? 0),
          )

      const recentIds =
        new Set(
          recentCommands.map(
            (item) => item.id,
          ),
        )

      return [
        ...recentCommands,
        ...items.filter(
          (item) =>
            !recentIds.has(
              item.id,
            ),
        ),
      ]
    }, [
      items,
      recentCommandIds,
    ])

  const filteredItems =
    useMemo(() => {
      const normalizedQuery =
        query
          .trim()
          .toLowerCase()

      if (!normalizedQuery) {
        return orderedItems
      }

      const terms =
        normalizedQuery
          .split(/\s+/)
          .filter(Boolean)

      return orderedItems
        .map((item, index) => ({
          item,
          index,
          score: getSearchScore(
            item,
            terms,
          ),
        }))
        .filter(
          (result) =>
            result.score >= 0,
        )
        .sort(
          (left, right) =>
            right.score -
              left.score ||
            left.index -
              right.index,
        )
        .map(
          (result) =>
            result.item,
        )
    }, [
      orderedItems,
      query,
    ])

  const recentCommandIdSet =
    useMemo(
      () =>
        new Set(
          recentCommandIds,
        ),
      [recentCommandIds],
    )

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

  useEffect(() => {
    const selectedItem =
      resultsRef.current?.querySelector<HTMLElement>(
        `[data-command-index="${selectedIndex}"]`,
      )

    selectedItem?.scrollIntoView({
      block: 'nearest',
    })
  }, [
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

    if (selectedItem) {
      runItem(selectedItem)
    }
  }

  function runItem(
    item: CommandPaletteItem,
  ) {
    if (item.kind === 'command') {
      setRecentCommandIds(
        (current) => {
          const next = [
            item.id,
            ...current.filter(
              (id) =>
                id !== item.id,
            ),
          ].slice(0, 5)

          window.localStorage.setItem(
            recentCommandsStorageKey,
            JSON.stringify(next),
          )

          return next
        },
      )
    }

    item.action()
  }

  function clearRecentCommands() {
    setRecentCommandIds([])

    window.localStorage.removeItem(
      recentCommandsStorageKey,
    )

    setSelectedIndex(0)
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
                      Math.max(
                        filteredItems.length -
                          1,
                        0,
                      ),
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
                'Home'
              ) {
                event.preventDefault()
                setSelectedIndex(0)
              }

              if (
                event.key ===
                'End'
              ) {
                event.preventDefault()

                setSelectedIndex(
                  Math.max(
                    filteredItems.length -
                      1,
                    0,
                  ),
                )
              }

              if (
                event.key ===
                'PageDown'
              ) {
                event.preventDefault()

                setSelectedIndex(
                  (current) =>
                    Math.min(
                      current + 6,
                      Math.max(
                        filteredItems.length -
                          1,
                        0,
                      ),
                    ),
                )
              }

              if (
                event.key ===
                'PageUp'
              ) {
                event.preventDefault()

                setSelectedIndex(
                  (current) =>
                    Math.max(
                      current - 6,
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
            placeholder="Search Lampstand or run a command"
            aria-label="Search Lampstand"
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
            Home/End Jump
          </span>

          <span>
            Esc Close
          </span>
        </div>

        <div
          ref={resultsRef}
          className="command-palette-results"
        >
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

                const showGroupHeading =
                  query.trim()
                    ? index === 0
                    : index === 0 ||
                      recentCommandIdSet.has(
                        item.id,
                      ) !==
                        recentCommandIdSet.has(
                          filteredItems[
                            index - 1
                          ]?.id ?? '',
                        ) ||
                      filteredItems[
                        index - 1
                      ]?.kind !==
                        item.kind

                return (
                  <div
                    key={item.id}
                    className="command-palette-result-entry"
                  >
                    {showGroupHeading ? (
                      <div className="command-palette-group-heading">
                        <span>
                          {
                            query.trim()
                              ? 'Search results'
                              : recentCommandIdSet.has(
                                    item.id,
                                  )
                                ? 'Recently used'
                              : commandKindLabels[
                                  item.kind
                                ]
                          }
                        </span>

                        {!query.trim() &&
                        recentCommandIdSet.has(
                          item.id,
                        ) ? (
                          <button
                            type="button"
                            className="command-palette-clear-recent"
                            onClick={
                              clearRecentCommands
                            }
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      data-command-index={
                        index
                      }
                      aria-current={
                        index ===
                        selectedIndex
                          ? 'true'
                          : undefined
                      }
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
                      onClick={() =>
                        runItem(item)
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
                        {
                          commandKindBadges[
                            item.kind
                          ]
                        }
                      </span>
                    </button>
                  </div>
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
