import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import type {
  FormEvent,
} from 'react'

import {
  streamAIOS,
} from '../services/api'
import { resolveDirectBibleQuestion, resolveDirectHwmrQuestion, resolveDirectHymnalQuestion, resolveDirectLifeStudyQuestion, resolveDirectMinistryBooksQuestion, resolveUnifiedMinistryQuestion } from '../api/ministryAssistant'

import type {
  AgentSummary,
} from '../services/api'

import type {
  ChatConversation,
  ChatMessage,
  StreamMetadata,
  MinistrySource,
  SchoolSource,
} from '../types/chat'

import {
  parseImportedConversations,
} from '../utils/importConversation'
import { buildContextualQuestion } from '../utils/contextualQuestion'

const STORAGE_KEY =
  'aios-studio-conversations-v1'
const RECOVERY_STORAGE_KEY =
  'aios-studio-conversations-recovery-v1'
const ministrySourceStorageKey = 'aios-ministry-source'
const ministrySources: MinistrySource[] = ['all', 'bible', 'hwmr', 'life-study', 'ministry-books', 'hymnal']
const schoolSourceStorageKey = 'lampstand-school-source'
const schoolSources: SchoolSource[] = ['all', 'English', 'Science', 'Mathematics', 'Computer Skills', 'Social Science', 'Tailoring']

function createWelcomeMessage(
  assistantName = 'AIOS',
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content:
      'Welcome to Lampstand Project. Select an assistant and ask a question.',
    assistantName,
    completed: true,
  }
}

function createConversation(
  agentId: string,
  assistantName: string,
): ChatConversation {
  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    title: 'New conversation',
    agentId,
    createdAt: now,
    updatedAt: now,
    pinned: false,
    folder: '',
    messages: [
      createWelcomeMessage(
        assistantName,
      ),
    ],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeConversation(value: unknown): ChatConversation | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string' ||
    typeof value.agentId !== 'string' || typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string' || !Array.isArray(value.messages)) return null

  const messages = value.messages.flatMap((message): ChatMessage[] => {
    if (!isRecord(message) || typeof message.id !== 'string' ||
      (message.role !== 'user' && message.role !== 'assistant') || typeof message.content !== 'string') return []

    const sources = Array.isArray(message.sources)
      ? message.sources.flatMap((source) => {
          if (!isRecord(source) || typeof source.id !== 'number' || typeof source.citation !== 'string') return []
          return [{
            id: source.id,
            citation: source.citation,
            source: typeof source.source === 'string' ? source.source : '',
            page: typeof source.page === 'number' ? source.page : null,
            chunk: typeof source.chunk === 'number' ? source.chunk : null,
            rerank_score: typeof source.rerank_score === 'number' ? source.rerank_score : null,
            url: typeof source.url === 'string' ? source.url : undefined,
          }]
        })
      : undefined

    return [{
      id: message.id,
      role: message.role,
      content: message.content,
      assistantName: typeof message.assistantName === 'string' ? message.assistantName : undefined,
      grounded: typeof message.grounded === 'boolean' ? message.grounded : undefined,
      completed: typeof message.completed === 'boolean' ? message.completed : undefined,
      model: typeof message.model === 'string' ? message.model : undefined,
      sources,
    }]
  })

  return {
    id: value.id,
    title: value.title,
    agentId: value.agentId,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    pinned: value.pinned === true,
    folder: typeof value.folder === 'string' ? value.folder : '',
    messages,
  }
}

function loadStoredConversations():
  ChatConversation[] {
  let storedValue: string | null = null
  try {
    storedValue = localStorage.getItem(STORAGE_KEY)

    if (!storedValue) {
      return []
    }

    const parsedValue: unknown =
      JSON.parse(storedValue)

    if (!Array.isArray(parsedValue)) {
      return []
    }

    const normalized = parsedValue.map(normalizeConversation).filter((value): value is ChatConversation => value !== null)
    if (normalized.length !== parsedValue.length) localStorage.setItem(RECOVERY_STORAGE_KEY, storedValue)
    return normalized
  } catch (error) {
    console.error(
      'Unable to load stored conversations.',
      error,
    )

    try {
      if (storedValue) localStorage.setItem(RECOVERY_STORAGE_KEY, storedValue)
    } catch {
      // The in-memory app remains usable when recovery storage is unavailable.
    }
    return []
  }
}

function loadMinistrySource(): MinistrySource {
  try {
    const value = localStorage.getItem(ministrySourceStorageKey) as MinistrySource | null
    return value && ministrySources.includes(value) ? value : 'all'
  } catch {
    return 'all'
  }
}

function loadSchoolSource(): SchoolSource {
  try {
    const value = localStorage.getItem(schoolSourceStorageKey) as SchoolSource | null
    return value && schoolSources.includes(value) ? value : 'all'
  } catch {
    return 'all'
  }
}

function createConversationTitle(
  question: string,
): string {
  const normalized =
    question.trim()

  if (normalized.length <= 42) {
    return normalized
  }

  return `${normalized
    .slice(0, 42)
    .trim()}…`
}

function cloneMessage(
  message: ChatMessage,
): ChatMessage {
  return {
    ...message,
    id: crypto.randomUUID(),
    sources: message.sources
      ? message.sources.map(
          (source) => ({
            ...source,
          }),
        )
      : undefined,
  }
}

function sortConversations(
  conversations: ChatConversation[],
): ChatConversation[] {
  return [...conversations].sort(
    (first, second) => {
      if (
        first.pinned !==
        second.pinned
      ) {
        return first.pinned
          ? -1
          : 1
      }
      return (
        new Date(
          second.updatedAt,
        ).getTime() -
        new Date(
          first.updatedAt,
        ).getTime()
      )
    },
  )
}

export function useChat(
  selectedAgent: AgentSummary | null,
) {
  const storedConversations =
    useMemo(
      () =>
        loadStoredConversations(),
      [],
    )

  const [
    conversations,
    setConversations,
  ] = useState<ChatConversation[]>(
    () =>
      sortConversations(
        storedConversations,
      ),
  )

  const [
    activeConversationId,
    setActiveConversationId,
  ] = useState<string | null>(
    () =>
      storedConversations[0]?.id ??
      null,
  )

  const [question, setQuestion] =
    useState('')

  const [isLoading, setIsLoading] =
    useState(false)

  const [error, setError] =
    useState('')
  const [persistenceError, setPersistenceError] = useState('')

  const requestControllerRef = useRef<AbortController | null>(null)

  const [ministrySource, setMinistrySourceState] = useState<MinistrySource>(
    loadMinistrySource,
  )
  const [schoolSource, setSchoolSourceState] = useState<SchoolSource>(loadSchoolSource)

  function setMinistrySource(source: MinistrySource) {
    setMinistrySourceState(source)
    try {
      localStorage.setItem(ministrySourceStorageKey, source)
    } catch {
      setPersistenceError('The Ministry source preference could not be saved in this browser.')
    }
  }

  function setSchoolSource(source: SchoolSource) {
    setSchoolSourceState(source)
    try {
      localStorage.setItem(schoolSourceStorageKey, source)
    } catch {
      setPersistenceError('The School source preference could not be saved in this browser.')
    }
  }

  const sortedConversations =
    useMemo(
      () =>
        sortConversations(
          conversations,
        ),
      [conversations],
    )

  const activeConversation =
    useMemo(
      () =>
        conversations.find(
          (conversation) =>
            conversation.id ===
            activeConversationId,
        ) ?? null,
      [
        activeConversationId,
        conversations,
      ],
    )

  const messages =
    activeConversation?.messages ?? []

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          conversations,
        ),
      )
      setPersistenceError('')
    } catch (storageError) {
      console.error(
        'Unable to save conversations.',
        storageError,
      )
      setPersistenceError('Conversations could not be saved in this browser. Export important chats before closing Lampstand Project.')
    }
  }, [conversations])

  useEffect(() => {
    if (
      activeConversationId ||
      !selectedAgent
    ) {
      return
    }

    const conversation =
      createConversation(
        selectedAgent.id,
        selectedAgent.name,
      )

    setConversations([
      conversation,
    ])

    setActiveConversationId(
      conversation.id,
    )
  }, [
    activeConversationId,
    selectedAgent,
  ])

  function updateConversation(
    conversationId: string,
    updater: (
      conversation: ChatConversation,
    ) => ChatConversation,
  ) {
    setConversations(
      (currentConversations) =>
        currentConversations.map(
          (conversation) =>
            conversation.id ===
            conversationId
              ? updater(conversation)
              : conversation,
        ),
    )
  }

  function updateAssistantMessage(
    conversationId: string,
    messageId: string,
    updater: (
      message: ChatMessage,
    ) => ChatMessage,
  ) {
    updateConversation(
      conversationId,
      (conversation) => ({
        ...conversation,
        updatedAt:
          new Date().toISOString(),
        messages:
          conversation.messages.map(
            (message) =>
              message.id ===
              messageId
                ? updater(message)
                : message,
          ),
      }),
    )
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
    questionOverride?: string,
  ) {
    event.preventDefault()

    const trimmedQuestion =
      (questionOverride ?? question).trim()

    if (
      !trimmedQuestion ||
      isLoading ||
      requestControllerRef.current ||
      !selectedAgent
    ) {
      return
    }

    let conversation =
      activeConversation

    if (!conversation) {
      conversation =
        createConversation(
          selectedAgent.id,
          selectedAgent.name,
        )

      setConversations(
        (current) => [
          conversation as ChatConversation,
          ...current,
        ],
      )

      setActiveConversationId(
        conversation.id,
      )
    }

    const conversationId =
      conversation.id

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmedQuestion,
    }

    const assistantMessageId =
      crypto.randomUUID()

    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      assistantName:
        selectedAgent.name,
      grounded: undefined,
      completed: false,
      model: undefined,
      sources: [],
    }

    updateConversation(
      conversationId,
      (currentConversation) => {
        const hasUserMessage =
          currentConversation.messages.some(
            (message) =>
              message.role === 'user',
          )

        return {
          ...currentConversation,
          title: hasUserMessage
            ? currentConversation.title
            : createConversationTitle(
                trimmedQuestion,
              ),
          agentId:
            selectedAgent.id,
          updatedAt:
            new Date().toISOString(),
          messages: [
            ...currentConversation.messages,
            userMessage,
            assistantMessage,
          ],
        }
      },
    )

    setQuestion('')
    setError('')
    setIsLoading(true)
    const requestController = new AbortController()
    requestControllerRef.current = requestController

    const markResponseStopped = () => {
      updateAssistantMessage(conversationId, assistantMessageId, (message) => ({
        ...message,
        content: message.content || 'Response stopped.',
        completed: false,
      }))
    }

    try {
      if (
        selectedAgent.id === 'ministry' &&
        (ministrySource === 'all' || ministrySource === 'bible')
      ) {
        const directAnswer = await resolveDirectBibleQuestion(trimmedQuestion, requestController.signal)
        if (requestController.signal.aborted) {
          markResponseStopped()
          return
        }
        if (directAnswer) {
          updateAssistantMessage(conversationId, assistantMessageId, (message) => ({
            ...message,
            content: directAnswer.content,
            grounded: true,
            completed: true,
            model: 'Recovery Bible',
            sources: directAnswer.sources,
          }))
          return
        }
      }

      if (selectedAgent.id === 'ministry' && ministrySource === 'all') {
        const directAnswer = await resolveUnifiedMinistryQuestion(trimmedQuestion, requestController.signal)
        if (requestController.signal.aborted) {
          markResponseStopped()
          return
        }
        if (directAnswer) {
          updateAssistantMessage(conversationId, assistantMessageId, (message) => ({
            ...message,
            content: directAnswer.content,
            grounded: true,
            completed: true,
            model: 'Unified Local Ministry',
            sources: directAnswer.sources,
          }))
          return
        }
      }

      if (selectedAgent.id === 'ministry' && ministrySource === 'life-study') {
        const directAnswer = await resolveDirectLifeStudyQuestion(trimmedQuestion, requestController.signal)
        if (requestController.signal.aborted) {
          markResponseStopped()
          return
        }
        if (directAnswer) {
          updateAssistantMessage(conversationId, assistantMessageId, (message) => ({
            ...message,
            content: directAnswer.content,
            grounded: true,
            completed: true,
            model: 'Local Life-Study',
            sources: directAnswer.sources,
          }))
          return
        }
      }

      if (selectedAgent.id === 'ministry' && ministrySource === 'hwmr') {
        const directAnswer = await resolveDirectHwmrQuestion(trimmedQuestion, requestController.signal)
        if (requestController.signal.aborted) {
          markResponseStopped()
          return
        }
        if (directAnswer) {
          updateAssistantMessage(conversationId, assistantMessageId, (message) => ({
            ...message,
            content: directAnswer.content,
            grounded: true,
            completed: true,
            model: 'Indexed HWMR',
            sources: directAnswer.sources,
          }))
          return
        }
      }

      if (selectedAgent.id === 'ministry' && ministrySource === 'hymnal') {
        const directAnswer = await resolveDirectHymnalQuestion(trimmedQuestion, requestController.signal)
        if (requestController.signal.aborted) {
          markResponseStopped()
          return
        }
        if (directAnswer) {
          updateAssistantMessage(conversationId, assistantMessageId, (message) => ({
            ...message,
            content: directAnswer.content,
            grounded: true,
            completed: true,
            model: 'Local Hymnal',
            sources: directAnswer.sources,
          }))
          return
        }
      }

      if (selectedAgent.id === 'ministry' && ministrySource === 'ministry-books') {
        const directAnswer = await resolveDirectMinistryBooksQuestion(trimmedQuestion, requestController.signal)
        if (requestController.signal.aborted) {
          markResponseStopped()
          return
        }
        if (directAnswer) {
          updateAssistantMessage(conversationId, assistantMessageId, (message) => ({
            ...message,
            content: directAnswer.content,
            grounded: true,
            completed: true,
            model: 'Local Ministry Books',
            sources: directAnswer.sources,
          }))
          return
        }
      }

      const scopedQuestion = selectedAgent.id === 'school' && schoolSource !== 'all'
        ? `[School source: ${schoolSource}. Use only indexed ${schoolSource} Level C materials. Do not mix other subjects.]\n\n${trimmedQuestion}`
        : trimmedQuestion

      await streamAIOS(
        buildContextualQuestion(
          scopedQuestion,
          conversation.messages,
        ),
        selectedAgent.id,
        {
          onMetadata: (
            metadata: StreamMetadata,
          ) => {
            updateAssistantMessage(
              conversationId,
              assistantMessageId,
              (message) => ({
                ...message,
                grounded:
                  metadata.grounded,
                model:
                  metadata.model,
                sources:
                  metadata.sources,
              }),
            )
          },

          onChunk: (chunk) => {
            updateAssistantMessage(
              conversationId,
              assistantMessageId,
              (message) => ({
                ...message,
                content:
                  message.content +
                  chunk,
              }),
            )
          },

          onDone: (
            doneEvent,
          ) => {
            updateAssistantMessage(
              conversationId,
              assistantMessageId,
              (message) => ({
                ...message,
                grounded:
                  doneEvent.grounded,
                completed:
                  doneEvent.completed ??
                  true,
              }),
            )
          },

          onError: (
            message,
          ) => {
            updateAssistantMessage(conversationId, assistantMessageId, (current) => ({
              ...current,
              content: current.content || 'Lampstand could not complete this response.',
              completed: false,
            }))
            setQuestion(
              (current) =>
                current.trim()
                  ? current
                  : trimmedQuestion,
            )
            setError(message)
          },
        },
        ministrySource,
        requestController.signal,
      )

      updateAssistantMessage(conversationId, assistantMessageId, (message) => ({
        ...message,
        content: message.content || 'AIOS returned no response.',
        completed: message.completed ?? false,
      }))
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') {
        markResponseStopped()
        setError('Response stopped. Your conversation has been kept.')
        return
      }
      console.error(
        requestError,
      )

      const errorMessage =
        requestError instanceof Error
          ? requestError.message
          : 'An unknown streaming error occurred.'

      updateAssistantMessage(
        conversationId,
        assistantMessageId,
        (message) => ({
          ...message,
          content:
            message.content ||
            'Lampstand could not complete this response.',
          completed: false,
        }),
      )

      setQuestion(
        (current) =>
          current.trim()
            ? current
            : trimmedQuestion,
      )
      setError(errorMessage)
    } finally {
      if (requestControllerRef.current === requestController) {
        requestControllerRef.current = null
        setIsLoading(false)
      }
    }
  }

  function cancelResponse() {
    requestControllerRef.current?.abort()
  }

  function startNewChat(agentOverride?: AgentSummary) {
    if (isLoading) {
      requestControllerRef.current?.abort()
    }
    const agent = agentOverride ?? selectedAgent
    if (!agent) {
      return
    }

    const conversation =
      createConversation(
        agent.id,
        agent.name,
      )

    setConversations(
      (current) => [
        conversation,
        ...current,
      ],
    )

    setActiveConversationId(
      conversation.id,
    )

    setQuestion('')
    setError('')
    setIsLoading(false)
  }

  function selectConversation(
    conversationId: string,
  ) {
    if (isLoading) {
      return
    }

    const conversation =
      conversations.find(
        (item) =>
          item.id ===
          conversationId,
      )

    if (!conversation) {
      return
    }

    setActiveConversationId(
      conversationId,
    )

    setQuestion('')
    setError('')
  }

  function renameConversation(
    conversationId: string,
    title: string,
  ) {
    if (isLoading) {
      return
    }

    const normalizedTitle =
      title.trim()

    if (!normalizedTitle) {
      return
    }

    updateConversation(
      conversationId,
      (conversation) => ({
        ...conversation,
        title: normalizedTitle,
        updatedAt:
          new Date().toISOString(),
      }),
    )
  }

  function duplicateConversation(
    conversationId: string,
  ) {
    if (isLoading) {
      return
    }

    const originalConversation =
      conversations.find(
        (conversation) =>
          conversation.id ===
          conversationId,
      )

    if (!originalConversation) {
      return
    }

    const now =
      new Date().toISOString()

    const duplicatedConversation:
      ChatConversation = {
      ...originalConversation,
      id: crypto.randomUUID(),
      title:
        `${originalConversation.title} (copy)`,
      pinned: false,
      createdAt: now,
      updatedAt: now,
      messages:
        originalConversation.messages.map(
          cloneMessage,
        ),
    }

    setConversations(
      (current) => [
        duplicatedConversation,
        ...current,
      ],
    )

    setActiveConversationId(
      duplicatedConversation.id,
    )

    setQuestion('')
    setError('')
  }

  function togglePinConversation(
    conversationId: string,
  ) {
    if (isLoading) {
      return
    }

    updateConversation(
      conversationId,
      (conversation) => ({
        ...conversation,
        pinned:
          !conversation.pinned,
        updatedAt:
          new Date().toISOString(),
      }),
    )
  }

  function moveConversationToFolder(conversationId: string, folder: string) {
    if (isLoading) return
    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      folder: folder.trim(),
      updatedAt: new Date().toISOString(),
    }))
  }

  function prepareMessageDraft(messageId: string, resubmit = false) {
    if (isLoading || !activeConversation) return
    const messageIndex = activeConversation.messages.findIndex((message) => message.id === messageId)
    if (messageIndex < 0) return
    const target = activeConversation.messages[messageIndex]
    const userIndex = target.role === 'user'
      ? messageIndex
      : activeConversation.messages.slice(0, messageIndex).findLastIndex((message) => message.role === 'user')
    if (userIndex < 0) return
    const userMessage = activeConversation.messages[userIndex]
    updateConversation(activeConversation.id, (conversation) => ({
      ...conversation,
      updatedAt: new Date().toISOString(),
      messages: conversation.messages.slice(0, userIndex),
    }))
    setQuestion(userMessage.content)
    setError(resubmit ? '' : 'The question is ready to edit and send again.')
    if (resubmit) {
      void handleSubmit({ preventDefault() {} } as FormEvent<HTMLFormElement>, userMessage.content)
    }
  }

  function retryMessage(messageId: string) {
    prepareMessageDraft(messageId, true)
  }

  function importConversation(
    value: unknown,
  ): boolean {
    if (isLoading) return false
    const imported =
      parseImportedConversations(
        value,
      )
    if (!imported) return false

    setConversations((current) => [...imported, ...current])
    setActiveConversationId(imported[0].id)
    setQuestion('')
    setError('')
    return true
  }

  function deleteConversation(
    conversationId: string,
  ) {
    deleteConversations([conversationId])
  }

  function deleteConversations(
    conversationIds: string[],
  ) {
    if (isLoading) {
      return
    }

    const deletedIds = new Set(conversationIds)

    setConversations(
      (current) => {
        const remaining =
          current.filter(
            (conversation) =>
              !deletedIds.has(conversation.id),
          )

        if (
          activeConversationId &&
          deletedIds.has(activeConversationId)
        ) {
          setActiveConversationId(
            sortConversations(
              remaining,
            )[0]?.id ?? null,
          )
        }

        return remaining
      },
    )
  }

  return {
    conversations:
      sortedConversations,
    activeConversationId,
    messages,
    question,
    isLoading,
    error,
    persistenceError,
    ministrySource,
    schoolSource,
    setQuestion,
    setMinistrySource,
    setSchoolSource,
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
  }
}
