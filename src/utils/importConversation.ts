import type { ChatConversation, ChatMessage, StreamSource } from '../types/chat'

type IdFactory = () => string
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
}
function parseSource(value: unknown): StreamSource | null {
  if (!isRecord(value)) return null
  const { id, citation, source, page, chunk, rerank_score: score } = value
  if (typeof id !== 'number' || !Number.isFinite(id) || typeof citation !== 'string' ||
      typeof source !== 'string' || !isNullableNumber(page) ||
      !isNullableNumber(chunk) || !isNullableNumber(score)) return null
  return { id, citation, source, page, chunk, rerank_score: score }
}
function parseMessage(value: unknown, createId: IdFactory): ChatMessage | null {
  if (!isRecord(value) || (value.role !== 'user' && value.role !== 'assistant') ||
      typeof value.content !== 'string') return null
  let sources: StreamSource[] | undefined
  if (value.sources !== undefined) {
    if (!Array.isArray(value.sources)) return null
    const parsed = value.sources.map(parseSource)
    if (parsed.some((source) => source === null)) return null
    sources = parsed as StreamSource[]
  }
  const message: ChatMessage = { id: createId(), role: value.role, content: value.content, sources }
  if (typeof value.assistantName === 'string') message.assistantName = value.assistantName
  if (typeof value.grounded === 'boolean') message.grounded = value.grounded
  if (typeof value.completed === 'boolean') message.completed = value.completed
  if (typeof value.model === 'string') message.model = value.model
  return message
}
export function parseImportedConversation(
  value: unknown,
  createId: IdFactory = () => crypto.randomUUID(),
  now = new Date().toISOString(),
): ChatConversation | null {
  if (!isRecord(value) || typeof value.title !== 'string' ||
      typeof value.agentId !== 'string' || !Array.isArray(value.messages)) return null
  const messages = value.messages.map((message) => parseMessage(message, createId))
  if (messages.some((message) => message === null)) return null
  return {
    id: createId(),
    title: value.title.trim() || 'Imported conversation',
    agentId: value.agentId,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : now,
    updatedAt: now,
    pinned: false,
    folder: typeof value.folder === 'string' ? value.folder.trim() : '',
    messages: messages as ChatMessage[],
  }
}

export function parseImportedConversations(
  value: unknown,
  createId: IdFactory = () => crypto.randomUUID(),
  now = new Date().toISOString(),
): ChatConversation[] | null {
  if (isRecord(value) && value.format === 'aios-conversation-backup' && Array.isArray(value.conversations)) {
    const conversations = value.conversations.map((item) => parseImportedConversation(item, createId, now))
    if (conversations.length === 0 || conversations.some((item) => item === null)) return null
    return conversations as ChatConversation[]
  }
  const conversation = parseImportedConversation(value, createId, now)
  return conversation ? [conversation] : null
}
