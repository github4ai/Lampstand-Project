import type { ChatMessage } from '../types/chat'

const MAX_CONTEXT_LENGTH = 7000

function dependsOnPreviousExchange(
  question: string,
): boolean {
  const normalized = question
    .toLowerCase()
    .trim()
    .replace(/[?!.,;:]+$/g, '')
    .replace(/\s+/g, ' ')

  const exactFollowUps = new Set([
    'continue',
    'go on',
    'why',
    'how',
    'explain more',
    'tell me more',
    'explain that',
    'explain it',
    'summarize it',
    'summarize that',
    'make it shorter',
    'make that shorter',
  ])

  if (exactFollowUps.has(normalized)) return true

  if (/^(?:lesson|chapter|unit|week)\s*(?:number\s*)?\d+[a-z]?$/i.test(normalized)) return true

  const words = new Set(
    normalized.split(/\s+/),
  )

  if (
    ['it', 'that', 'this', 'them', 'those', 'these']
      .some((word) => words.has(word))
  ) {
    return true
  }

  return [
    'the above',
    'previous answer',
    'previous explanation',
    'the answer',
    'the outline',
    'the summary',
    'the document',
    'the pdf',
  ].some((phrase) =>
    normalized.includes(phrase),
  )
}

export function buildContextualQuestion(
  question: string,
  messages: ChatMessage[],
): string {
  if (!dependsOnPreviousExchange(question)) {
    return question
  }

  const previousMessages = messages
    .filter((message) => message.content.trim())
    .filter((message) => !(
      message.role === 'assistant' &&
      (message.content.startsWith('Welcome to AIOS Studio.') ||
        message.content.startsWith('Welcome to Lampstand Project.'))
    ))
    .slice(-4)

  if (previousMessages.length === 0) return question

  const history = previousMessages
    .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content.trim()}`)
    .join('\n\n')
    .slice(-MAX_CONTEXT_LENGTH)

  return [
    'Use the previous exchange to resolve references in the current request.',
    'Search the knowledge base for material needed by the current request.',
    'Answer only the current request; do not repeat these instructions.',
    '',
    'PREVIOUS EXCHANGE',
    history,
    '',
    'CURRENT REQUEST',
    question,
  ].join('\n')
}
