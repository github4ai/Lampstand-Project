import type {
  ChatConversation,
  ChatMessage,
} from '../types/chat'

function sanitizeFilename(
  value: string,
): string {
  const sanitized = Array.from(
    value.trim(),
  )
    .filter((character) =>
      character.charCodeAt(0) >= 32,
    )
    .join('')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
    .trim()

  return sanitized || 'AIOS conversation'
}

function formatDate(
  value: string,
): string {
  const date = new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value
  }

  return date.toLocaleString()
}

function downloadTextFile(
  filename: string,
  content: string,
  mimeType: string,
) {
  const blob = new Blob(
    [content],
    {
      type: `${mimeType};charset=utf-8`,
    },
  )

  const downloadUrl =
    URL.createObjectURL(blob)

  const anchor =
    document.createElement('a')

  anchor.href = downloadUrl
  anchor.download = filename
  anchor.style.display = 'none'

  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => {
    URL.revokeObjectURL(
      downloadUrl,
    )
  }, 0)
}

function messageHeading(
  message: ChatMessage,
): string {
  if (message.role === 'user') {
    return 'User'
  }

  return (
    message.assistantName ??
    'AIOS Assistant'
  )
}

function messageMetadata(
  message: ChatMessage,
): string[] {
  if (
    message.role !== 'assistant'
  ) {
    return []
  }

  const metadata: string[] = []

  if (message.model) {
    metadata.push(
      `Model: ${message.model}`,
    )
  }

  if (
    message.grounded !== undefined
  ) {
    metadata.push(
      `Grounded: ${
        message.grounded
          ? 'Yes'
          : 'No'
      }`,
    )
  }

  if (
    message.completed !== undefined
  ) {
    metadata.push(
      `Completed: ${
        message.completed
          ? 'Yes'
          : 'No'
      }`,
    )
  }

  return metadata
}

function messageSources(
  message: ChatMessage,
): string[] {
  if (
    !message.sources ||
    message.sources.length === 0
  ) {
    return []
  }

  const lines: string[] = [
    '',
    '#### Sources',
    '',
  ]

  for (
    const source
    of message.sources
  ) {
    lines.push(
      `- **${source.citation}**`,
    )

    if (source.source) {
      lines.push(
        `  - File: ${source.source}`,
      )
    }

    if (Number.isFinite(source.page)) {
      lines.push(
        `  - Page: ${source.page}`,
      )
    }

    if (source.chunk !== null) {
      lines.push(
        `  - Chunk: ${source.chunk}`,
      )
    }

    if (
      Number.isFinite(source.rerank_score)
    ) {
      lines.push(
        `  - Relevance: ${Number(source.rerank_score).toFixed(
          3,
        )}`,
      )
    }
  }

  return lines
}

function conversationToMarkdown(
  conversation: ChatConversation,
): string {
  const lines: string[] = [
    `# ${conversation.title}`,
    '',
    `- Assistant ID: ${conversation.agentId}`,
    `- Created: ${formatDate(
      conversation.createdAt,
    )}`,
    `- Updated: ${formatDate(
      conversation.updatedAt,
    )}`,
    `- Pinned: ${
      conversation.pinned
        ? 'Yes'
        : 'No'
    }`,
    `- Folder: ${conversation.folder || 'Unfiled'}`,
    '',
    '---',
    '',
  ]

  for (
    const message
    of conversation.messages
  ) {
    lines.push(
      `## ${messageHeading(
        message,
      )}`,
      '',
    )

    const metadata =
      messageMetadata(message)

    if (metadata.length > 0) {
      lines.push(
        `_${metadata.join(' · ')}_`,
        '',
      )
    }

    lines.push(
      message.content ||
        '_No content_',
    )

    lines.push(
      ...messageSources(
        message,
      ),
    )

    lines.push(
      '',
      '---',
      '',
    )
  }

  return lines.join('\n')
}

export function exportConversationAsMarkdown(
  conversation: ChatConversation,
) {
  const filename =
    `${sanitizeFilename(
      conversation.title,
    )}.md`

  downloadTextFile(
    filename,
    conversationToMarkdown(
      conversation,
    ),
    'text/markdown',
  )
}

export function exportConversationAsJson(
  conversation: ChatConversation,
) {
  const filename =
    `${sanitizeFilename(
      conversation.title,
    )}.json`

  const content =
    JSON.stringify(
      conversation,
      null,
      2,
    )

  downloadTextFile(
    filename,
    content,
    'application/json',
  )
}

export function exportConversationsBackup(
  conversations: ChatConversation[],
) {
  const date = new Date().toISOString().slice(0, 10)
  const content = JSON.stringify({
    format: 'aios-conversation-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    conversations,
  }, null, 2)
  downloadTextFile(
    `AIOS conversation backup ${date}.json`,
    content,
    'application/json',
  )
}

export function exportConversationRecovery(
  rawContent: string,
) {
  const date = new Date().toISOString().slice(0, 10)
  downloadTextFile(
    `AIOS conversation recovery ${date}.txt`,
    rawContent,
    'text/plain',
  )
}
