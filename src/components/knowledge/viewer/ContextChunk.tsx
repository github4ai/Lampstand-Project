import type { ReactNode } from "react";

interface ContextChunkProps {
  title: string;
  chunk: number;
  page?: number | null;
  text: ReactNode;
  renderedText?: ReactNode;
  isCurrent?: boolean;
  onOpen?: () => void;
}

function ContextChunk({
  title,
  chunk,
  page,
  text,
  renderedText,
  isCurrent = false,
  onOpen,
}: ContextChunkProps) {
  return (
    <section
      className={
        isCurrent
          ? "viewer-context viewer-context-current"
          : "viewer-context"
      }
    >
      <header className="viewer-context-header">
        <div>
          <h3>{title}</h3>
          <p>
            Chunk {chunk}
            {page != null && ` • Page ${page}`}
          </p>
        </div>
        {!isCurrent && onOpen && (
          <button type="button" onClick={onOpen}>Open chunk</button>
        )}
      </header>

      <article className="viewer-context-body">{renderedText ?? text}</article>
    </section>
  );
}

export default ContextChunk;
