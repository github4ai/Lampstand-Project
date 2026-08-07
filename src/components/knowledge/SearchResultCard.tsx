import {
  ArrowRight,
  FileText,
} from 'lucide-react'
import {
  useNavigate,
} from 'react-router-dom'

import type {
  KnowledgeSearchResult,
} from '../../types/knowledgeSearch'

interface SearchResultCardProps {
  result: KnowledgeSearchResult
  rank: number
}

function formatScore(
  value: number | null,
): string {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return 'N/A'
  }

  return value.toFixed(4)
}

function SearchResultCard({
  result,
  rank,
}: SearchResultCardProps) {
  const navigate =
    useNavigate()

  function openChunk() {
    const document =
      result.document ||
      result.source

    const query =
      result.matched_query
        ? (
          `?q=${encodeURIComponent(
            result.matched_query,
          )}`
        )
        : ''

    navigate(
      (
        `/knowledge/view/` +
        `${encodeURIComponent(
          result.category,
        )}/` +
        `${encodeURIComponent(
          document,
        )}/` +
        `${result.chunk}` +
        query
      ),
    )
  }

  return (
    <article className="knowledge-search-result">
      <div className="knowledge-search-result-rank">
        {rank}
      </div>

      <div className="knowledge-search-result-main">
        <header className="knowledge-search-result-header">
          <div className="knowledge-search-result-document">
            <span className="knowledge-search-result-icon">
              <FileText
                size={17}
                aria-hidden="true"
              />
            </span>

            <div>
              <h2>
                {result.document}
              </h2>

              <p>
                {result.category}
                {' · '}
                Chunk {result.chunk}

                {result.page !== null && (
                  <>
                    {' · '}
                    Page {result.page}
                  </>
                )}
              </p>
            </div>
          </div>

          <span className="knowledge-search-score">
            {formatScore(
              result.combined_score ??
              result.score,
            )}
          </span>
        </header>

        <p className="knowledge-search-result-preview">
          {result.preview ||
            'No preview is available.'}
        </p>

        <div className="knowledge-search-result-meta">
          {result.retrieval_methods.map(
            (method) => (
              <span
                key={method}
                className="knowledge-search-method"
              >
                {method}
              </span>
            ),
          )}

          {result.citation && (
            <span className="knowledge-search-citation">
              {result.citation}
            </span>
          )}
        </div>

        <details className="knowledge-search-diagnostics">
          <summary>
            Search diagnostics
          </summary>

          <dl>
            <div>
              <dt>Retrieval</dt>
              <dd>
                {formatScore(
                  result.retrieval_score,
                )}
              </dd>
            </div>

            <div>
              <dt>Fusion</dt>
              <dd>
                {formatScore(
                  result.fusion_score,
                )}
              </dd>
            </div>

            <div>
              <dt>Rerank</dt>
              <dd>
                {formatScore(
                  result.rerank_score,
                )}
              </dd>
            </div>

            <div>
              <dt>Combined</dt>
              <dd>
                {formatScore(
                  result.combined_score,
                )}
              </dd>
            </div>
          </dl>

          {result.matched_queries.length > 0 && (
            <div className="knowledge-search-matched">
              <strong>
                Matched queries
              </strong>

              <p>
                {result.matched_queries.join(
                  ' · ',
                )}
              </p>
            </div>
          )}
        </details>

        <footer className="knowledge-search-result-footer">
          <button
            type="button"
            onClick={openChunk}
          >
            Open chunk

            <ArrowRight
              size={15}
              aria-hidden="true"
            />
          </button>
        </footer>
      </div>
    </article>
  )
}

export default SearchResultCard
