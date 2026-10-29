import {
  useMemo,
  useState,
} from 'react'

import type {
  KeyboardEvent,
  ReactNode,
} from 'react'

import {
  Bot,
  BookOpen,
  LibraryBig,
  Clock3,
  Copy,
  Database,
  FileJson,
  FileText,
  GraduationCap,
  Languages,
  LogOut,
  MessageSquare,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Presentation,
  Pencil,
  Pin,
  PinOff,
  Search,
  Settings,
  Trash2,
  WandSparkles,
} from 'lucide-react'

import {
  NavLink,
  useLocation,
  useNavigate,
} from 'react-router-dom'

import { AIOS_API_BASE_URL } from '../../config/api'
import { APP_NAME, APP_TAGLINE } from '../../config/brand'
import BrandMark from '../BrandMark'
import SystemResourcesPanel from './SystemResourcesPanel'
import type { BackendHealth } from '../../hooks/useBackendHealth'

import type {
  AgentSummary,
} from '../../services/api'

import {
  useAppStore,
} from '../../store/useAppStore'

import type {
  ChatConversation,
} from '../../types/chat'
import { ACCESS_CONTROL_STORAGE_KEY, canAccess, type AccessControlState, type LocalUserProfile, type WorkspaceId } from '../../utils/accessControl'
import { lockProfile, markProfileUnlocked, verifyPin } from '../../utils/pinSecurity'
import { clearCloudSession, loadCloudSession, signOutOwner } from '../../utils/remoteAccess'

import {
  exportConversationAsJson,
  exportConversationAsMarkdown,
} from '../../utils/exportConversation'

type WorkspaceLink = {
  to: string
  label: string
  icon: ReactNode
  /** Omitted for the two destinations every profile may open. */
  workspace?: WorkspaceId
  exact?: boolean
}

const workspaceGroups: Array<{ id: string; label: string; links: WorkspaceLink[] }> = [
  {
    id: 'meeting',
    label: 'Meeting',
    links: [
      { to: '/presentation', label: 'Presentation', icon: <Presentation size={17} />, workspace: 'presentation' },
      { to: '/church', label: 'Church', icon: <BrandMark size={17} monochrome />, workspace: 'church' },
      { to: '/ministry', label: 'Ministry', icon: <LibraryBig size={17} />, workspace: 'ministry' },
    ],
  },
  {
    id: 'study',
    label: 'Study',
    links: [
      { to: '/knowledge', label: 'Knowledge', icon: <Database size={17} />, workspace: 'knowledge' },
      { to: '/documents', label: 'Documents', icon: <FileText size={17} />, workspace: 'documents' },
      { to: '/school', label: 'School', icon: <GraduationCap size={17} />, workspace: 'school' },
      { to: '/language-tools', label: 'Language Tools', icon: <Languages size={17} />, workspace: 'language-tools' },
    ],
  },
  {
    id: 'assistant',
    label: 'Assistant',
    links: [
      { to: '/chat', label: 'Chat', icon: <MessagesSquare size={17} />, workspace: 'chat', exact: true },
      { to: '/agents', label: 'Agents', icon: <Bot size={17} />, workspace: 'agents' },
      { to: '/media', label: 'Media Studio', icon: <WandSparkles size={17} />, workspace: 'media' },
      { to: '/history', label: 'History', icon: <Clock3 size={17} />, workspace: 'history' },
    ],
  },
  {
    id: 'app',
    label: 'App',
    links: [
      { to: '/settings', label: 'Settings', icon: <Settings size={17} /> },
      { to: '/help', label: 'Help & Guides', icon: <BookOpen size={17} /> },
    ],
  },
]

interface SidebarProps {
  accessState: AccessControlState
  activeProfile: LocalUserProfile
  agents: AgentSummary[]
  conversations: ChatConversation[]
  activeConversationId:
    string | null
  selectedAgentId: string
  isLoading: boolean
  agentsLoading: boolean
  backendStatus: BackendHealth
  onCheckBackend: () => Promise<void>

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
  ) => boolean
}

function Sidebar({
  accessState,
  activeProfile,
  agents,
  conversations,
  activeConversationId,
  selectedAgentId,
  isLoading,
  agentsLoading,
  backendStatus,
  onCheckBackend,
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
  const location = useLocation()
  const onChatPage = location.pathname === '/' || location.pathname.startsWith('/chat')
  const [signingOut, setSigningOut] = useState(false)

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

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    window.localStorage.getItem('aios-sidebar-collapsed') === 'true')

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current
      window.localStorage.setItem('aios-sidebar-collapsed', String(next))
      return next
    })
  }

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

    navigate('/chat')
  }

  async function switchProfile(profileId: string) {
    const profile = accessState.profiles.find((item) => item.id === profileId)
    if (!profile || profile.suspended) return
    if (profile.pinHash) {
      const pin = window.prompt(`Enter the PIN for ${profile.name}.`)
      if (!pin || !await verifyPin(pin, profile.pinHash)) { addToast({ title: 'Profile remains locked', message: 'The PIN was incorrect.', variant: 'error' }); return }
      markProfileUnlocked(profile.id)
    }
    localStorage.setItem(ACCESS_CONTROL_STORAGE_KEY, JSON.stringify({ ...accessState, activeProfileId: profileId }))
    window.location.assign(canAccess(profile, 'chat') ? '/chat' : canAccess(profile, 'school') ? '/school' : canAccess(profile, 'ministry') ? '/ministry' : '/language-tools')
  }

  async function signOut() {
    const session = loadCloudSession()
    if (!session) return
    setSigningOut(true)
    try { await signOutOwner(session) } catch { /* Clear local access even when the server is unavailable. */ }
    clearCloudSession()
    window.location.reload()
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
  }

  return (
    <aside className={`sidebar ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="brand">
        <div className="brand-icon">
          <BrandMark size={28} />
        </div>

        <div className="brand-copy">
          <h1>{APP_NAME}</h1>

          <p>
            {APP_TAGLINE}
          </p>
        </div>

        <button type="button" className="sidebar-collapse-button" onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!sidebarCollapsed}>
          {sidebarCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
        </button>
      </div>

      <button
        type="button"
        className="new-chat-button"
        onClick={
          handleNewConversation
        }
        disabled={
          isLoading
        }
        title={
          isLoading
            ? 'Finish or stop the current response first'
            : selectedAgent
              ? `Start a new conversation with ${selectedAgent.name}`
              : 'Open Chat to choose an assistant'
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
          Search Lampstand
        </span>

        <kbd>
          Ctrl K
        </kbd>
      </button>

      <div className="sidebar-body">
      <nav
        className="workspace-navigation"
        aria-label="Lampstand workspace"
      >
        {workspaceGroups.map((group) => {
          const links = group.links.filter((link) => !link.workspace || canAccess(activeProfile, link.workspace))

          if (links.length === 0) {
            return null
          }

          return (
            <div className="workspace-navigation-group" key={group.id}>
              <h2 className="workspace-navigation-title">{group.label}</h2>

              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.exact}
                  className={({ isActive }) => `workspace-navigation-link ${isActive ? 'active' : ''}`}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      {onChatPage && (
        <>
      <div className="category-section">
        <label htmlFor="agent">
          Current assistant
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
        </>
      )}
      </div>

      <div className="sidebar-footer">
        <SystemResourcesPanel />

        <div className="sidebar-profile-switcher">
          <label htmlFor="lampstand-profile">Profile</label>
          <select id="lampstand-profile" value={activeProfile.id} onChange={(event) => void switchProfile(event.target.value)}>
            {accessState.profiles.filter((profile) => !profile.suspended).map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {profile.roleLabel || profile.role}</option>)}
          </select>
          <div className="sidebar-profile-actions">
            {activeProfile.pinHash && <button type="button" className="sidebar-lock-profile" onClick={() => { lockProfile(activeProfile.id); window.location.reload() }}>Lock profile</button>}
            {loadCloudSession() && <button type="button" className="sidebar-sign-out" disabled={signingOut} onClick={() => void signOut()}><LogOut size={14} /> {signingOut ? 'Signing out...' : 'Sign out'}</button>}
          </div>
        </div>

        <button className="status-card" type="button" onClick={() => void onCheckBackend()} title="Check backend connection">
        <span
          className={`status-dot ${
            backendStatus === 'connected'
              ? ''
              : backendStatus === 'checking'
                ? 'status-dot-checking'
                : 'status-dot-offline'
          }`}
        />

        <div>
          <strong>
            {backendStatus === 'connected'
              ? 'Backend connected'
              : backendStatus === 'checking'
                ? 'Checking backend'
                : 'Backend unavailable'}
          </strong>

          <p>
            {AIOS_API_BASE_URL.replace(/^https?:\/\//, '')}
          </p>
        </div>
      </button>
      </div>
    </aside>
  )
}

export default Sidebar
