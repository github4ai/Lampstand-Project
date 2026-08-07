import {
  Bot,
  LoaderCircle,
  User,
} from 'lucide-react'

import type {
  ChatMessage as ChatMessageType,
} from '../../types/chat'

import MarkdownMessage from './MarkdownMessage'
import ResponseStatus from '../StatusBar/ResponseStatus'
import SourcesPanel from '../Sources/SourcesPanel'

interface ChatMessageProps {
  message: ChatMessageType
  showLoadingIndicator: boolean
}

function ChatMessage({
  message,
  showLoadingIndicator,
}: ChatMessageProps) {
  const isUser =
    message.role === 'user'

  return (
    <article
      className={`message ${message.role}`}
    >
      <div className="message-icon">
        {isUser ? (
          <User size={19} />
        ) : (
          <Bot size={19} />
        )}
      </div>

      <div className="message-content">
        <span>
          {isUser
            ? 'You'
            : message.assistantName ??
              'AIOS'}
        </span>

        <div className="message-text">
          <MarkdownMessage
            content={message.content}
          />

          {showLoadingIndicator && (
            <LoaderCircle
              className="spinner"
              size={18}
            />
          )}
        </div>

        {!isUser && (
          <>
            <ResponseStatus
              grounded={message.grounded}
              completed={
                message.completed
              }
              model={message.model}
            />

            <SourcesPanel
              sources={
                message.sources ?? []
              }
            />
          </>
        )}
      </div>
    </article>
  )
}

export default ChatMessage