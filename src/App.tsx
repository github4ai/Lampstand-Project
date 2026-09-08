import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'

import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'

import ChatHeader from './components/Chat/ChatHeader'
import CommandPalette from './components/CommandPalette/CommandPalette'
import ChatComposer from './components/Composer/ChatComposer'
import ChatMessage from './components/Message/ChatMessage'
import Sidebar from './components/Sidebar/Sidebar'
import ProtectedWorkspace from './components/Access/ProtectedWorkspace'
import ProfileLockScreen from './components/Access/ProfileLockScreen'
import FirstRunWizard, { FIRST_RUN_KEY } from './components/Onboarding/FirstRunWizard'
import './styles/first-run.css'
import ToastViewport from './components/Toast/ToastViewport'
import Breadcrumbs from './components/Breadcrumbs/Breadcrumbs'

import {
  useAgents,
} from './hooks/useAgents'

import {
  useChat,
} from './hooks/useChat'

import {
  useBackendHealth,
} from './hooks/useBackendHealth'


import {
  useAppStore,
} from './store/useAppStore'

import { canAccess, createInitialAccessState, loadOrCreateAccessState, type WorkspaceId } from './utils/accessControl'
import { isProfileUnlocked } from './utils/pinSecurity'

const AgentsPage = lazy(() => import('./pages/AgentsPage'))
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'))
const DocumentDetailPage = lazy(() => import('./pages/DocumentDetailPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const HymnalPage = lazy(() => import('./pages/HymnalPage'))
const RecoveryBiblePage = lazy(() => import('./pages/RecoveryBiblePage'))
const LifeStudyPage = lazy(() => import('./pages/LifeStudyPage'))
const MinistryBooksPage = lazy(() => import('./pages/MinistryBooksPage'))
const MinistryPage = lazy(() => import('./pages/MinistryPage'))
const PresentationPage = lazy(() => import('./pages/PresentationPage'))
const SchoolPage = lazy(() => import('./pages/SchoolPage'))
const SchoolLessonReaderPage = lazy(() => import('./pages/SchoolLessonReaderPage'))
const HwmrPage = lazy(() => import('./pages/HwmrPage'))
const ChurchPage = lazy(() => import('./pages/ChurchPage'))
const PrayerBurdenPage = lazy(() => import('./pages/PrayerBurdenPage'))
const ChurchAnnouncementsPage = lazy(() => import('./pages/ChurchAnnouncementsPage'))
const ChurchPostingHistoryPage = lazy(() => import('./pages/ChurchPostingHistoryPage'))
const ChurchGroupsPage = lazy(() => import('./pages/ChurchGroupsPage'))
const MediaStudioPage = lazy(() => import('./pages/MediaStudioPage'))
const LanguageToolsPage = lazy(() => import('./pages/LanguageToolsPage'))
const KnowledgeCategoryPage = lazy(() => import('./pages/KnowledgeCategoryPage'))
const KnowledgePage = lazy(() => import('./pages/KnowledgePage'))
const KnowledgeSearchPage = lazy(() => import('./pages/knowledge/KnowledgeSearchPage'))
const KnowledgeViewerPage = lazy(() => import('./pages/knowledge/KnowledgeViewerPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const AppUpdatesPage = lazy(() => import('./pages/AppUpdatesPage'))
const HelpPage = lazy(() => import('./pages/HelpPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

const selectedAgentStorageKey = 'aios-studio-selected-agent-v1'

function loadSelectedAgentId() {
  try {
    return localStorage.getItem(selectedAgentStorageKey) || 'ministry'
  } catch {
    return 'ministry'
  }
}

function App() {
  const navigate =
    useNavigate()
  const location = useLocation()
  const [accessState] = useState(() => {
    try { return loadOrCreateAccessState(localStorage) }
    catch { return createInitialAccessState() }
  })
  const [firstRunComplete, setFirstRunComplete] = useState(() => {
    const isDesktop = navigator.userAgent.includes('Electron') || new URLSearchParams(window.location.search).has('onboarding')
    return !isDesktop || Boolean(localStorage.getItem(FIRST_RUN_KEY))
  })
  const activeProfile = accessState.profiles.find((profile) => profile.id === accessState.activeProfileId) ?? accessState.profiles[0]
  const protect = (workspace: WorkspaceId, content: ReactNode) => <ProtectedWorkspace profile={activeProfile} workspace={workspace}>{content}</ProtectedWorkspace>

  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem('aios-studio-settings-v1') ?? '{}',
      ) as { compactUi?: boolean; reducedMotion?: boolean; highContrast?: boolean; theme?: string; accent?: string }

      document.documentElement.classList.toggle(
        'compact-ui',
        stored.compactUi === true,
      )
      document.documentElement.classList.toggle(
        'reduced-motion',
        stored.reducedMotion === true,
      )
      document.documentElement.classList.toggle('high-contrast', stored.highContrast === true)
      document.documentElement.dataset.theme = stored.theme ?? 'system'
      document.documentElement.dataset.accent = stored.accent ?? 'cyan'
    } catch {
      localStorage.removeItem('aios-studio-settings-v1')
    }
  }, [])

  const commandPaletteOpen =
    useAppStore(
      (state) =>
        state.commandPaletteOpen,
    )

  const closeCommandPalette =
    useAppStore(
      (state) =>
        state.closeCommandPalette,
    )

  const toggleCommandPalette =
    useAppStore(
      (state) =>
        state.toggleCommandPalette,
    )

  const addToast =
    useAppStore(
      (state) =>
        state.addToast,
    )

  const {
    agents,
    loading: agentsLoading,
    error: agentsError,
    refresh: refreshAgents,
  } = useAgents()

  const availableAgents = useMemo(
    () => agents.filter((agent) => {
      const category = agent.category.trim().toLowerCase()
      if (category === 'ministry') return canAccess(activeProfile, 'ministry')
      if (category === 'school') return canAccess(activeProfile, 'school')
      return canAccess(activeProfile, 'chat')
    }),
    [activeProfile, agents],
  )

  const {
    status: backendStatus,
    check: checkBackend,
  } = useBackendHealth()

  const previousBackendStatus = useRef(backendStatus)

  useEffect(() => {
    if (previousBackendStatus.current === 'unavailable' && backendStatus === 'connected') {
      void refreshAgents()
    }
    previousBackendStatus.current = backendStatus
  }, [backendStatus, refreshAgents])

  const [
    selectedAgentId,
    setSelectedAgentId,
  ] = useState(loadSelectedAgentId)

  useEffect(() => {
    try {
      localStorage.setItem(selectedAgentStorageKey, selectedAgentId)
    } catch {
      // The app remains usable when browser storage is unavailable.
    }
  }, [selectedAgentId])

  const messagesEndRef =
    useRef<HTMLDivElement | null>(
      null,
    )

  const selectedAgent = useMemo(
    () =>
      availableAgents.find(
        (agent) =>
          agent.id ===
          selectedAgentId,
      ) ?? null,
    [
      availableAgents,
      selectedAgentId,
    ],
  )

  const {
    conversations,
    activeConversationId,
    messages,
    question,
    isLoading,
    error: chatError,
    persistenceError,
    ministrySource,
    schoolSource,
    webSearch,
    setQuestion,
    setMinistrySource,
    setSchoolSource,
    setWebSearch,
    handleSubmit,
    cancelResponse,
    startNewChat,
    selectConversation,
    renameConversation,
    duplicateConversation,
    togglePinConversation,
    moveConversationToFolder,
    prepareMessageDraft,
    retryMessage,
    importConversation,
    deleteConversation,
    deleteConversations,
  } = useChat(
    selectedAgent,
  )

  useEffect(() => {
    if (location.pathname !== '/') return
    try {
      const handoff = JSON.parse(localStorage.getItem('aios-studio-chat-handoff-v1') ?? 'null') as { question?: string; agentId?: string } | null
      if (!handoff?.question) return
      if (handoff.agentId && availableAgents.some((agent) => agent.id === handoff.agentId)) setSelectedAgentId(handoff.agentId)
      setQuestion(handoff.question)
      localStorage.removeItem('aios-studio-chat-handoff-v1')
    } catch { localStorage.removeItem('aios-studio-chat-handoff-v1') }
  }, [location.pathname, availableAgents, setQuestion])

  useEffect(() => {
    if (availableAgents.length === 0) {
      return
    }

    const selectedAgentExists =
      availableAgents.some(
        (agent) =>
          agent.id ===
          selectedAgentId,
      )

    if (selectedAgentExists) {
      return
    }

    const preferredAgent =
      availableAgents.find(
        (agent) =>
          agent.id ===
          'ministry',
      ) ?? availableAgents[0]

    setSelectedAgentId(
      preferredAgent.id,
    )
  }, [
    availableAgents,
    selectedAgentId,
  ])

  useEffect(() => {
    if (location.pathname !== '/' || !selectedAgent || isLoading || !activeConversationId) return
    const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId)
    if (!activeConversation || activeConversation.agentId === selectedAgent.id) return
    startNewChat(selectedAgent)
  }, [activeConversationId, conversations, isLoading, location.pathname, selectedAgent])

  useEffect(() => {
    function handleGlobalKeyDown(
      event: KeyboardEvent,
    ) {
      const pressedKey =
        event.key.toLowerCase()

      if (
        pressedKey === 'k' &&
        (
          event.ctrlKey ||
          event.metaKey
        )
      ) {
        event.preventDefault()

        toggleCommandPalette()

        return
      }

      if (
        event.key === 'Escape'
      ) {
        closeCommandPalette()
      }
    }

    window.addEventListener(
      'keydown',
      handleGlobalKeyDown,
    )

    return () => {
      window.removeEventListener(
        'keydown',
        handleGlobalKeyDown,
      )
    }
  }, [
    closeCommandPalette,
    toggleCommandPalette,
  ])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView(
      {
        behavior: isLoading
          ? 'auto'
          : 'smooth',
        block: 'end',
      },
    )
  }, [
    messages,
    isLoading,
  ])

  const displayedError =
    agentsError || chatError || persistenceError

  function handleNewConversation() {
    startNewChat()

    navigate('/chat')

    addToast({
      title:
        'New conversation started',
      message:
        selectedAgent
          ? `Using ${selectedAgent.name}.`
          : 'Ready for your next question.',
      variant: 'success',
      duration: 3000,
    })
  }

  function handleSelectAgent(
    agentId: string,
  ) {
    if (isLoading) return

    const agent =
      availableAgents.find(
        (item) =>
          item.id === agentId,
      )

    if (!agent) return

    const assistantChanged = agentId !== selectedAgentId
    setSelectedAgentId(
      agentId,
    )

    if (assistantChanged) startNewChat(agent)

    addToast({
      title: assistantChanged ? 'Assistant changed' : 'Assistant ready',
      message: assistantChanged ? `Started a new conversation with ${agent.name}.` : `${agent.name} is already active.`,
      variant: 'info',
      duration: 2800,
    })
  }

  function handleStartAgentChat(agentId: string) {
    const agent = availableAgents.find((item) => item.id === agentId)
    if (!agent || isLoading) return
    handleSelectAgent(agentId)
    navigate('/chat')
  }

  function handleImportConversation(value: unknown): boolean {
    const imported = importConversation(value)
    addToast({
      title: imported ? 'Conversation imported' : 'Import failed',
      message: imported ? 'The conversation is ready in History.' : 'Choose a valid AIOS conversation JSON file.',
      variant: imported ? 'success' : 'error',
      duration: 3500,
    })
    return imported
  }

  function handleDeleteConversation(
    conversationId: string,
  ): boolean {
    if (isLoading) return false
    const conversation = conversations.find((item) => item.id === conversationId)
    if (!conversation) return false
    const confirmed = window.confirm(
      'Delete ' + conversation.title + '? This cannot be undone.',
    )
    if (!confirmed) return false
    deleteConversation(conversationId)
    addToast({ title: 'Conversation deleted', message: conversation.title, variant: 'warning', duration: 3200 })
    return true
  }

  function handleDeleteConversations(conversationIds: string[]): boolean {
    if (isLoading) return false
    const selected = conversations.filter((item) => conversationIds.includes(item.id))
    if (selected.length === 0) return false
    const confirmed = window.confirm(`Delete ${selected.length} selected conversation${selected.length === 1 ? '' : 's'}? This cannot be undone.`)
    if (!confirmed) return false
    deleteConversations(selected.map((item) => item.id))
    addToast({ title: 'Conversations deleted', message: `${selected.length} selected conversation${selected.length === 1 ? '' : 's'} removed.`, variant: 'warning', duration: 3200 })
    return true
  }

  function handleSelectConversation(
    conversationId: string,
  ) {
    const conversation = conversations.find((item) => item.id === conversationId)
    if (!conversation) return

    selectConversation(
      conversationId,
    )

    if (availableAgents.some((agent) => agent.id === conversation.agentId)) {
      setSelectedAgentId(conversation.agentId)
    }

    navigate('/chat')
  }

  const chatPage = (
    <main className="chat-panel">
      <ChatHeader
        assistantName={
          selectedAgent?.name ??
          'AIOS Assistant'
        }
        description={
          selectedAgent
            ? selectedAgent.description
            : (
              'Select an assistant to begin.'
            )
        }
        isLoading={isLoading}
      />

      <section className="messages">
        {messages.map(
          (
            message,
            index,
          ) => {
            const showLoadingIndicator =
              message.role ===
              'assistant' &&
              isLoading &&
              index ===
              messages.length - 1 &&
              !message.content

            return (
              <ChatMessage
                key={message.id}
                message={message}
                showLoadingIndicator={
                  showLoadingIndicator
                }
                onEdit={prepareMessageDraft}
                onRetry={messages.slice(0, index).some((candidate) => candidate.role === 'user') ? retryMessage : undefined}
              />
            )
          },
        )}

        {messages.filter((message) => message.role === 'user').length === 0 && selectedAgent && (
          <div className="chat-starters" aria-label={`${selectedAgent.name} starter prompts`}>
            <strong>Try asking</strong>
            {(selectedAgent.recommended_tasks ?? []).map((prompt) => <button type="button" key={prompt} onClick={() => setQuestion(prompt)}>{prompt}</button>)}
          </div>
        )}

        <div
          ref={messagesEndRef}
          className="messages-end"
          aria-hidden="true"
        />
      </section>

      <ChatComposer
        value={question}
        placeholder={
          selectedAgent
            ? (
              `Ask ${selectedAgent.name}...`
            )
            : (
              'Select an assistant first...'
            )
        }
        isLoading={isLoading}
        disabled={
          isLoading ||
          agentsLoading ||
          !selectedAgent
        }
        error={displayedError}
        onChange={setQuestion}
        onSubmit={handleSubmit}
        onCancel={cancelResponse}
        ministrySource={selectedAgent?.id === 'ministry' ? ministrySource : undefined}
        onMinistrySourceChange={selectedAgent?.id === 'ministry' ? setMinistrySource : undefined}
        schoolSource={selectedAgent?.id === 'school' ? schoolSource : undefined}
        onSchoolSourceChange={selectedAgent?.id === 'school' ? setSchoolSource : undefined}
        webSearch={webSearch}
        onWebSearchChange={setWebSearch}
      />
    </main>
  )

  if (!firstRunComplete) return <FirstRunWizard onComplete={() => setFirstRunComplete(true)} />
  if (activeProfile.pinHash && !isProfileUnlocked(activeProfile.id)) return <ProfileLockScreen profile={activeProfile} />

  return (
    <div className="app-shell">
      <Sidebar
        accessState={accessState}
        activeProfile={activeProfile}
        agents={availableAgents}
        conversations={
          conversations
        }
        activeConversationId={
          activeConversationId
        }
        selectedAgentId={
          selectedAgentId
        }
        isLoading={isLoading}
        agentsLoading={
          agentsLoading
        }
        backendStatus={backendStatus}
        onCheckBackend={checkBackend}
        onSelectAgent={
          handleSelectAgent
        }
        onNewConversation={
          handleNewConversation
        }
        onSelectConversation={
          handleSelectConversation
        }
        onRenameConversation={
          renameConversation
        }
        onDuplicateConversation={
          duplicateConversation
        }
        onTogglePinConversation={
          togglePinConversation
        }
        onDeleteConversation={
          handleDeleteConversation
        }
      />

      <div className="app-content">
      <Breadcrumbs />
      <Suspense fallback={<main className="workspace-panel"><section className="placeholder-page">Loading workspace...</section></main>}>
        <Routes>
        <Route
          path="/"
          element={canAccess(activeProfile, 'ministry') ? <Navigate to="/ministry" replace /> : protect('chat', chatPage)}
        />
        <Route path="/chat" element={protect('chat', chatPage)} />

        <Route path="/settings" element={<main className="workspace-panel"><SettingsPage /></main>} />
        <Route path="/updates" element={<main className="workspace-panel"><AppUpdatesPage /></main>} />
        <Route path="/help" element={<main className="workspace-panel"><HelpPage /></main>} />

        <Route path="/agents" element={protect('agents', <main className="workspace-panel"><AgentsPage agents={availableAgents} selectedAgentId={selectedAgentId} loading={agentsLoading} error={agentsError} onRetry={refreshAgents} onStartChat={handleStartAgentChat} /></main>)} />

        <Route path="/documents/:categoryName/:documentName" element={protect('documents', <DocumentDetailPage />)} />

        <Route path="/documents" element={protect('documents', <main className="workspace-panel"><DocumentsPage /></main>)} />

        <Route path="/hymnal" element={protect('ministry', <main className="workspace-panel"><HymnalPage /></main>)} />

        <Route path="/recovery-bible" element={protect('ministry', <main className="workspace-panel"><RecoveryBiblePage /></main>)} />

        <Route path="/life-study" element={protect('ministry', <main className="workspace-panel"><LifeStudyPage /></main>)} />

        <Route path="/ministry-books" element={protect('ministry', <main className="workspace-panel"><MinistryBooksPage /></main>)} />
        <Route path="/ministry" element={protect('ministry', <main className="workspace-panel"><MinistryPage /></main>)} />
        <Route path="/presentation" element={protect('presentation', <main className="workspace-panel"><PresentationPage /></main>)} />
        <Route path="/school" element={protect('school', <main className="workspace-panel"><SchoolPage /></main>)} />
        <Route path="/school/read" element={protect('school', <main className="workspace-panel"><SchoolLessonReaderPage /></main>)} />
        <Route path="/ministry/hwmr" element={protect('ministry', <main className="workspace-panel"><HwmrPage /></main>)} />
        <Route path="/church" element={protect('church', <main className="workspace-panel"><ChurchPage /></main>)} />
        <Route path="/church/prayer-points" element={protect('church', <main className="workspace-panel"><PrayerBurdenPage /></main>)} />
        <Route path="/church/prayer-burden" element={<Navigate to="/church/prayer-points" replace />} />
        <Route path="/church/announcements" element={protect('church', <main className="workspace-panel"><ChurchAnnouncementsPage /></main>)} />
        <Route path="/church/posting-history" element={protect('church', <main className="workspace-panel"><ChurchPostingHistoryPage /></main>)} />
        <Route path="/church/groups" element={protect('church', <main className="workspace-panel"><ChurchGroupsPage /></main>)} />

        <Route path="/media" element={protect('media', <main className="workspace-panel"><MediaStudioPage /></main>)} />
        <Route path="/language-tools" element={protect('language-tools', <main className="workspace-panel"><LanguageToolsPage /></main>)} />

        <Route
          path="/history"
          element={protect('history', <main className="workspace-panel"><HistoryPage conversations={conversations} agents={availableAgents} isLoading={isLoading} onNewConversation={handleNewConversation} onOpenConversation={handleSelectConversation} onTogglePinConversation={togglePinConversation} onRenameConversation={renameConversation} onMoveConversationToFolder={moveConversationToFolder} onDuplicateConversation={duplicateConversation} onDeleteConversation={handleDeleteConversation} onDeleteConversations={handleDeleteConversations} onImportConversation={handleImportConversation} /></main>)}
        />

        <Route
          path="/knowledge"
          element={
            protect('knowledge', <main className="workspace-panel">
              <KnowledgePage />
            </main>)
          }
        />

        <Route
          path="/knowledge/search"
          element={
            protect('knowledge', <main className="workspace-panel">
              <KnowledgeSearchPage />
            </main>)
          }
        />

        <Route
          path="/knowledge/view/:categoryName/:documentName/:chunkId"
          element={
            protect('knowledge', <main className="workspace-panel">
              <KnowledgeViewerPage />
            </main>)
          }
        />

        <Route
          path="/knowledge/:categoryName"
          element={
            protect('knowledge', <main className="workspace-panel">
              <KnowledgeCategoryPage />
            </main>)
          }
        />

        <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      </div>

      <CommandPalette
        open={
          commandPaletteOpen
        }
        agents={availableAgents}
        conversations={
          conversations
        }
        onClose={
          closeCommandPalette
        }
        onNavigate={navigate}
        onNewConversation={
          handleNewConversation
        }
        onSelectConversation={
          handleSelectConversation
        }
        onSelectAgent={
          handleSelectAgent
        }
      />

      <ToastViewport />
    </div>
  )
}

export default App
