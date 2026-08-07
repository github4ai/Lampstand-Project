import {
  LoaderCircle,
} from 'lucide-react'

interface ChatHeaderProps {
  assistantName: string
  description: string
  isLoading: boolean
}

function ChatHeader({
  assistantName,
  description,
  isLoading,
}: ChatHeaderProps) {
  return (
    <header className="chat-header">
      <div>
        <h2>{assistantName}</h2>
        <p>{description}</p>
      </div>

      {isLoading && (
        <span className="conversation-label">
          <LoaderCircle
            className="spinner"
            size={15}
          />
          Generating
        </span>
      )}
    </header>
  )
}

export default ChatHeader
