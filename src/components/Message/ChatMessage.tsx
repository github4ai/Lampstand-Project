import { lazy, Suspense, useRef } from 'react'

import {
  Bot,
  Copy,
  Download,
  LoaderCircle,
  Pencil,
  RefreshCw,
  User,
} from 'lucide-react'

import type {
  ChatMessage as ChatMessageType,
} from '../../types/chat'

const MarkdownMessage = lazy(() => import('./MarkdownMessage'))
import ResponseStatus from '../StatusBar/ResponseStatus'
import SourcesPanel from '../Sources/SourcesPanel'

interface ChatMessageProps {
  message: ChatMessageType
  showLoadingIndicator: boolean
  onEdit?: (id: string) => void
  onRetry?: (id: string) => void
}

function ChatMessage({
  message,
  showLoadingIndicator,
  onEdit,
  onRetry,
}: ChatMessageProps) {
  const printableContent = useRef<HTMLDivElement>(null)
  const isUser =
    message.role === 'user'

  function saveAsPdf() {
    if (!printableContent.current) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.opener = null

    const title = message.assistantName ?? 'AIOS Assistant'
    printWindow.document.write(`<!doctype html><html><head><title>${title.replace(/[<>&"']/g, '')}</title><style>
      body{font-family:Arial,sans-serif;max-width:850px;margin:40px auto;padding:0 28px;color:#172033;line-height:1.65}
      h1,h2,h3,h4{color:#162958;page-break-after:avoid} blockquote{margin:14px 0;padding:10px 16px;border-left:4px solid #356df3;background:#edf3ff;color:#174ea6}
      table{width:100%;border-collapse:collapse} th,td{border:1px solid #ccd3df;padding:8px;text-align:left} a{color:#174ea6} pre{white-space:pre-wrap}
      @page{size:A4;margin:18mm} @media print{body{margin:0;padding:0} h1,h2,h3,h4{break-after:avoid} blockquote,table{break-inside:avoid}}
    </style></head><body><h1>${title.replace(/[<>&"']/g, '')}</h1>${printableContent.current.innerHTML}</body></html>`)
    printWindow.document.close()
    printWindow.focus()
    window.setTimeout(() => printWindow.print(), 250)
  }

  async function copyMessage() {
    await navigator.clipboard.writeText(message.content)
  }

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

        <div className="message-text" ref={printableContent}>
          <Suspense fallback={<div>{message.content}</div>}>
            <MarkdownMessage
              content={message.content}
            />
          </Suspense>

          {showLoadingIndicator && (
            <LoaderCircle
              className="spinner"
              size={18}
            />
          )}
        </div>

        {message.content && !showLoadingIndicator && <div className="message-actions" aria-label="Message actions">
          <button type="button" onClick={() => void copyMessage()} title="Copy message"><Copy size={14} /> Copy</button>
          {isUser && onEdit && <button type="button" onClick={() => onEdit(message.id)} title="Edit and resend this question"><Pencil size={14} /> Edit</button>}
          {!isUser && onRetry && <button type="button" onClick={() => onRetry(message.id)} title="Regenerate this response"><RefreshCw size={14} /> {message.completed ? 'Regenerate' : 'Retry'}</button>}
        </div>}

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

            {message.completed && message.content && (
              <button type="button" className="message-pdf-action" onClick={saveAsPdf}
                title="Open the browser print window and choose Save as PDF">
                <Download size={14} /> Save answer as PDF
              </button>
            )}
          </>
        )}
      </div>
    </article>
  )
}

export default ChatMessage
