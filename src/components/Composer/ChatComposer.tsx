import type {
  FormEvent,
} from 'react'

import {
  Send,
  Square,
} from 'lucide-react'
import type { MinistrySource, SchoolSource } from '../../types/chat'

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
  onCancel?: () => void
  ministrySource?: MinistrySource
  onMinistrySourceChange?: (source: MinistrySource) => void
  schoolSource?: SchoolSource
  onSchoolSourceChange?: (source: SchoolSource) => void
}

const ministrySources: Array<{ value: MinistrySource; label: string }> = [
  { value: 'all', label: 'All Ministry' },
  { value: 'bible', label: 'Recovery Bible' },
  { value: 'hwmr', label: 'HWMR' },
  { value: 'life-study', label: 'Life-Study' },
  { value: 'ministry-books', label: 'Ministry Books' },
  { value: 'hymnal', label: 'Hymnal' },
]

const schoolSources: Array<{ value: SchoolSource; label: string }> = [
  { value: 'all', label: 'All School' },
  { value: 'English', label: 'English' },
  { value: 'Science', label: 'Science' },
  { value: 'Mathematics', label: 'Mathematics' },
  { value: 'Computer Skills', label: 'Computer' },
  { value: 'Social Science', label: 'Social Science' },
  { value: 'Tailoring', label: 'Tailoring' },
]

function ChatComposer({
  value,
  placeholder,
  isLoading,
  disabled,
  error = '',
  onChange,
  onSubmit,
  onCancel,
  ministrySource,
  onMinistrySourceChange,
  schoolSource,
  onSchoolSourceChange,
}: ChatComposerProps) {
  return (
    <div className="composer-area">
      {error && (
        <div
          className="error-message"
          role="alert"
        >
          <strong>{error}</strong>
          {value.trim() && !isLoading ? (
            <span>
              Your question was restored.
              Select Send to try again.
            </span>
          ) : null}
        </div>
      )}

      {ministrySource && onMinistrySourceChange && (
        <div className="ministry-source-picker" aria-label="Ministry sources">
          <span>Search in</span>
          {ministrySources.map((source) => (
            <button
              key={source.value}
              type="button"
              className={ministrySource === source.value ? 'active' : ''}
              onClick={() => onMinistrySourceChange(source.value)}
              disabled={isLoading}
            >
              {source.label}
            </button>
          ))}
        </div>
      )}

      {schoolSource && onSchoolSourceChange && (
        <div className="ministry-source-picker" aria-label="School sources">
          <span>Search in</span>
          {schoolSources.map((source) => (
            <button
              key={source.value}
              type="button"
              className={schoolSource === source.value ? 'active' : ''}
              onClick={() => onSchoolSourceChange(source.value)}
              disabled={isLoading}
            >
              {source.label}
            </button>
          ))}
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
          type={isLoading ? 'button' : 'submit'}
          onClick={isLoading ? onCancel : undefined}
          disabled={
            isLoading ? !onCancel : (!value.trim() || disabled)
          }
          aria-label={isLoading ? 'Stop response' : 'Send question'}
        >
          {isLoading ? (
            <Square size={18} />
          ) : (
            <Send size={20} />
          )}
        </button>
      </form>

      <p className="composer-hint">
        {isLoading ? 'Select Stop to end this response.' : 'Press Enter to send. Use Shift + Enter for a new line.'}
      </p>
    </div>
  )
}

export default ChatComposer
