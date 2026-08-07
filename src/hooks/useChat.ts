import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import type {
  FormEvent,
} from 'react'

import {
  streamAIOS,
} from '../services/api'

import type {
  AgentSummary,
} from '../services/api'

import type {
  ChatConversation,
  ChatMessage,
  StreamMetadata,
} from '../types/chat'

const STORAGE_KEY =
  'aios-studio-conversations-v1'

function createWelcomeMessage(
  assistantName = 'AIOS',
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content:
      'Welcome to AIOS Studio. Select an assistant and ask a question.',
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
    messages: [
      createWelcomeMessage(
        assistantName,
      ),
    ],
  }
}

function normalizeConversation(
  conversation: ChatConversation,
): ChatConversation {
  return {
    ...conversation,
    pinned:
      conversation.pinned ?? false,
  }
}

function loadStoredConversations():
  ChatConversation[] {
  try {
    const storedValue =
      localStorage.getItem(
        STORAGE_KEY,
      )

    if (!storedValue) {
      return []
    }

    const parsedValue: unknown =
      JSON.parse(storedValue)

    if (!Array.isArray(parsedValue)) {
      return []
    }

    return (
      parsedValue as ChatConversation[]
    ).map(normalizeConversation)
  } catch (error) {
    console.error(
      'Unable to load stored conversations.',
      error,
    )

    return []
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
    } catch (storageError) {
      console.error(
        'Unable to save conversations.',
        storageError,
      )
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
  ) {
    event.preventDefault()

    const trimmedQuestion =
      question.trim()

    if (
      !trimmedQuestion ||
      isLoading ||
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

    try {
      await streamAIOS(
        trimmedQuestion,
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
            setError(message)
          },
        },
      )
    } catch (requestError) {
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
            'AIOS could not complete this response.',
          completed: false,
        }),
      )

      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  function startNewChat() {
    if (!selectedAgent) {
      return
    }

    const conversation =
      createConversation(
        selectedAgent.id,
        selectedAgent.name,
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

  function importConversation(
    value: unknown,
  ): boolean {
    if (isLoading || typeof value !== 'object' || value === null) return false
    const candidate = value as Partial<ChatConversation>
    if (typeof candidate.title !== 'string' || typeof candidate.agentId !== 'string' || !Array.isArray(candidate.messages)) return false
    const validMessages = candidate.messages.every((message) =>
      typeof message === 'object' && message !== null &&
      (message.role === 'user' || message.role === 'assistant') &&
      typeof message.content === 'string' &&
      (message.sources === undefined || Array.isArray(message.sources)),
    )
    if (!validMessages) return false
    const now = new Date().toISOString()
    const imported: ChatConversation = {
      id: crypto.randomUUID(),
      title: candidate.title.trim() || 'Imported conversation',
      agentId: candidate.agentId,
      createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : now,
      updatedAt: now,
      pinned: false,
      messages: candidate.messages.map(cloneMessage),
    }
    setConversations((current) => [imported, ...current])
    setActiveConversationId(imported.id)
    setQuestion('')
    setError('')
    return true
  }

  function deleteConversation(
    conversationId: string,
  ) {
    if (isLoading) {
      return
    }

    setConversations(
      (current) => {
        const remaining =
          current.filter(
            (conversation) =>
              conversation.id !==
              conversationId,
          )

        if (
          activeConversationId ===
          conversationId
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
    setQuestion,
    handleSubmit,
    startNewChat,
    selectConversation,
    renameConversation,
    duplicateConversation,
    togglePinConversation,
    importConversation,
    deleteConversation,
  }
}