import {
  FileText,
} from "lucide-react";

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
    <div className="sources-panel">
      <div className="sources-title">
        <FileText size={16} />
        Sources
      </div>

      <ol>
        {sources.map((source) => (
          <li key={source.id}>
            <strong>
              {source.citation}
            </strong>

            {source.page !== null && (
              <span>
                Page {source.page}
              </span>
            )}

            {source.rerank_score !== null && (
              <small>
                Relevance:{" "}
                {source.rerank_score.toFixed(
                  3,
                )}
              </small>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default SourcesPanel;