import type {
  FormEvent,
} from 'react'

import {
  LoaderCircle,
  Send,
} from 'lucide-react'

interface ChatComposerProps {
  value: string
  placeholder: string
  isLoading: boolean
  disabled: boolean
  error?: string
  onChange: (value: string) => void
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void
}

function ChatComposer({
  value,
  placeholder,
  isLoading,
  disabled,
  error = '',
  onChange,
  onSubmit,
}: ChatComposerProps) {
  return (
    <div className="composer-area">
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <form
        className="composer"
        onSubmit={onSubmit}
      >
        <textarea
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
          placeholder={placeholder}
          rows={3}
          disabled={disabled}
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
            !value.trim() ||
            disabled
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

      <p className="composer-hint">
        Press Enter to send. Use Shift +
        Enter for a new line.
      </p>
    </div>
  )
}

export default ChatComposer