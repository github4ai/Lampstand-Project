import {
  ChevronDown,
  FileText,
} from "lucide-react";
import { Link } from "react-router-dom";

import type {
  StreamSource,
} from "../../types/chat";

interface SourcesPanelProps {
  sources: StreamSource[];
}

function SourcesPanel({
  sources,
}: SourcesPanelProps) {
  return (
    <details className="sources-panel">
      <summary className="sources-title">
        <FileText size={16} />
        Sources
        <span>{sources.length}</span>
        <ChevronDown className="sources-chevron" size={16} />
      </summary>

      <ol>
        {sources.map((source) => (
          <li key={source.id}>
            {source.url ? (
              source.url.startsWith("/") ? (
                <Link to={source.url} className="source-link">
                  {source.citation}
                </Link>
              ) : (
                <a
                  href={source.url}
                  className="source-link"
                  target="_blank"
                  rel="noreferrer"
                >
                  {source.citation}
                </a>
              )
            ) : (
              <strong>{source.citation}</strong>
            )}

            {Number.isFinite(source.page) && (
              <span>
                Page {source.page}
              </span>
            )}

            {Number.isFinite(source.rerank_score) && (
              <small>
                Relevance:{" "}
                {Number(source.rerank_score).toFixed(
                  3,
                )}
              </small>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}

export default SourcesPanel;
