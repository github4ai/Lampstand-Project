import type { ReactNode } from "react";

interface ContextChunkProps {
  title: string;
  chunk: number;
  page?: number | null;
  text: ReactNode;
  isCurrent?: boolean;
}

function ContextChunk({
  title,
  chunk,
  page,
  text,
  isCurrent = false,
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
      </header>

      <article className="viewer-context-body">{text}</article>
    </section>
  );
}

export default ContextChunk;
