import {
  useState,
} from 'react'

import type {
  FormEvent,
} from 'react'

import {
  Bot,
  LoaderCircle,
  Send,
  User,
} from 'lucide-react'

import {
  askAIOS,
} from '../services/api'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

function ChatPage() {
  const [messages, setMessages] =
    useState<ChatMessage[]>([
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          'Welcome to AIOS. Ask a question to begin.',
      },
    ])

  const [question, setQuestion] =
    useState('')

  const [
    conversationId,
    setConversationId,
  ] = useState<string | null>(null)

  const [category, setCategory] =
    useState('Ministry')

  const [isLoading, setIsLoading] =
    useState(false)

  const [error, setError] =
    useState('')

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    const normalizedQuestion =
      question.trim()

    if (
      !normalizedQuestion ||
      isLoading
    ) {
      return
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: normalizedQuestion,
    }

    setMessages((current) => [
      ...current,
      userMessage,
    ])

    setQuestion('')
    setError('')
    setIsLoading(true)

    try {
      const response = await askAIOS({
        question: normalizedQuestion,
        conversation_id:
          conversationId,
        category,
        top_k: 5,
      })

      setConversationId(
        response.conversation_id,
      )

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.answer,
      }

      setMessages((current) => [
        ...current,
        assistantMessage,
      ])
    } catch (requestError) {
      console.error(requestError)

      setError(
        'Unable to reach the AIOS backend.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  function startNewConversation() {
    setMessages([
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          'A new conversation has started.',
      },
    ])

    setConversationId(null)
    setQuestion('')
    setError('')
  }

  return (
    <div className="chat-page">
      <header className="chat-header">
        <div>
          <h2>{category} Assistant</h2>
          <p>
            Ask questions using your local
            AIOS knowledge base.
          </p>
        </div>

        <button
          type="button"
          onClick={startNewConversation}
          disabled={isLoading}
        >
          New conversation
        </button>
      </header>

      <div className="category-section">
        <label htmlFor="chat-category">
          Knowledge category
        </label>

        <select
          id="chat-category"
          value={category}
          onChange={(event) =>
            setCategory(
              event.target.value,
            )
          }
          disabled={isLoading}
        >
          <option value="Ministry">
            Ministry
          </option>

          <option value="General">
            General
          </option>

          <option value="Business">
            Business
          </option>

          <option value="Coding">
            Coding
          </option>

          <option value="Creative">
            Creative
          </option>

          <option value="Manuals">
            Manuals
          </option>

          <option value="Operations">
            Operations
          </option>

          <option value="Personal">
            Personal
          </option>

          <option value="Research">
            Research
          </option>

          <option value="School">
            School
          </option>
        </select>
      </div>

      <section className="messages">
        {messages.map((message) => (
          <article
            key={message.id}
            className={`message ${message.role}`}
          >
            <div className="message-icon">
              {message.role === 'user' ? (
                <User size={19} />
              ) : (
                <Bot size={19} />
              )}
            </div>

            <div className="message-content">
              <span>
                {message.role === 'user'
                  ? 'You'
                  : 'AIOS'}
              </span>

              <p>{message.content}</p>
            </div>
          </article>
        ))}

        {isLoading && (
          <article className="message assistant">
            <div className="message-icon">
              <Bot size={19} />
            </div>

            <div className="message-content">
              <span>AIOS</span>

              <p>
                <LoaderCircle
                  className="spinner"
                  size={18}
                />

                Generating an answer...
              </p>
            </div>
          </article>
        )}
      </section>

      <div className="composer-area">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form
          className="composer"
          onSubmit={handleSubmit}
        >
          <textarea
            value={question}
            onChange={(event) =>
              setQuestion(
                event.target.value,
              )
            }
            placeholder={`Ask the ${category} knowledge base...`}
            rows={3}
            disabled={isLoading}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey
              ) {
                event.preventDefault()

                event.currentTarget.form?.requestSubmit()
              }
            }}
          />

          <button
            type="submit"
            disabled={
              !question.trim() ||
              isLoading
            }
            aria-label="Send question"
          >
            {isLoading ? (
              <LoaderCircle
                className="spinner"
                size={20}
              />
            ) : (
              <Send size={20} />
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ChatPage