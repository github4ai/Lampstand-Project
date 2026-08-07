import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom'

import ChatHeader from './components/Chat/ChatHeader'
import CommandPalette from './components/CommandPalette/CommandPalette'
import ChatComposer from './components/Composer/ChatComposer'
import ChatMessage from './components/Message/ChatMessage'
import Sidebar from './components/Sidebar/Sidebar'
import ToastViewport from './components/Toast/ToastViewport'

import {
  useAgents,
} from './hooks/useAgents'

import {
  useChat,
} from './hooks/useChat'


import {
  useAppStore,
} from './store/useAppStore'

const AgentsPage = lazy(() => import('./pages/AgentsPage'))
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const KnowledgeCategoryPage = lazy(() => import('./pages/KnowledgeCategoryPage'))
const KnowledgePage = lazy(() => import('./pages/KnowledgePage'))
const KnowledgeSearchPage = lazy(() => import('./pages/knowledge/KnowledgeSearchPage'))
const KnowledgeViewerPage = lazy(() => import('./pages/knowledge/KnowledgeViewerPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

function App() {
  const navigate =
    useNavigate()

  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem('aios-studio-settings-v1') ?? '{}',
      ) as { compactUi?: boolean; reducedMotion?: boolean }

      document.documentElement.classList.toggle(
        'compact-ui',
        stored.compactUi === true,
      )
      document.documentElement.classList.toggle(
        'reduced-motion',
        stored.reducedMotion === true,
      )
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
  } = useAgents()

  const [
    selectedAgentId,
    setSelectedAgentId,
  ] = useState('ministry')

  const messagesEndRef =
    useRef<HTMLDivElement | null>(
      null,
    )

  const selectedAgent = useMemo(
    () =>
      agents.find(
        (agent) =>
          agent.id ===
          selectedAgentId,
      ) ?? null,
    [
      agents,
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
    setQuestion,
    handleSubmit,
    startNewChat,
    selectConversation,
    renameConversation,
    duplicateConversation,
    togglePinConversation,
    deleteConversation,
  } = useChat(
    selectedAgent,
  )

  useEffect(() => {
    if (agents.length === 0) {
      return
    }

    const selectedAgentExists =
      agents.some(
        (agent) =>
          agent.id ===
          selectedAgentId,
      )

    if (selectedAgentExists) {
      return
    }

    const preferredAgent =
      agents.find(
        (agent) =>
          agent.id ===
          'ministry',
      ) ?? agents[0]

    setSelectedAgentId(
      preferredAgent.id,
    )
  }, [
    agents,
    selectedAgentId,
  ])

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
    agentsError || chatError

  function handleNewConversation() {
    startNewChat()

    navigate('/')

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
    setSelectedAgentId(
      agentId,
    )

    const agent =
      agents.find(
        (item) =>
          item.id === agentId,
      )

    if (agent) {
      addToast({
        title:
          'Assistant changed',
        message:
          `${agent.name} is now active.`,
        variant: 'info',
        duration: 2800,
      })
    }
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

  function handleSelectConversation(
    conversationId: string,
  ) {
    selectConversation(
      conversationId,
    )

    navigate('/')
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
              />
            )
          },
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
      />
    </main>
  )

  return (
    <div className="app-shell">
      <Sidebar
        agents={agents}
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

      <Suspense fallback={<main className="workspace-panel"><section className="placeholder-page">Loading workspace...</section></main>}>
        <Routes>
        <Route
          path="/"
          element={chatPage}
        />

        <Route path="/settings" element={<main className="workspace-panel"><SettingsPage /></main>} />

        <Route path="/agents" element={<main className="workspace-panel"><AgentsPage agents={agents} selectedAgentId={selectedAgentId} loading={agentsLoading} error={agentsError} onSelectAgent={handleSelectAgent} onStartChat={() => navigate("/")} /></main>} />

        <Route path="/documents" element={<main className="workspace-panel"><DocumentsPage /></main>} />

        <Route
          path="/history"
          element={<main className="workspace-panel"><HistoryPage conversations={conversations} isLoading={isLoading} onNewConversation={handleNewConversation} onOpenConversation={handleSelectConversation} onDeleteConversation={handleDeleteConversation} /></main>}
        />

        <Route
          path="/knowledge"
          element={
            <main className="workspace-panel">
              <KnowledgePage />
            </main>
          }
        />

        <Route
          path="/knowledge/search"
          element={
            <main className="workspace-panel">
              <KnowledgeSearchPage />
            </main>
          }
        />

        <Route
          path="/knowledge/view/:categoryName/:documentName/:chunkId"
          element={
            <main className="workspace-panel">
              <KnowledgeViewerPage />
            </main>
          }
        />

        <Route
          path="/knowledge/:categoryName"
          element={
            <main className="workspace-panel">
              <KnowledgeCategoryPage />
            </main>
          }
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />
        </Routes>
      </Suspense>

      <CommandPalette
        open={
          commandPaletteOpen
        }
        agents={agents}
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
