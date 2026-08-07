import {
  useEffect,
  useState,
} from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  FileText,
  Hash,
  Layers3,
} from 'lucide-react'
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'

import {
  getChunkContext,
  getKnowledgeViewer,
} from '../../api/knowledgeViewer'

import ContextChunk from '../../components/knowledge/viewer/ContextChunk'

import type {
  KnowledgeContextResponse,
  KnowledgeViewerResponse,
} from '../../types/knowledgeViewer'

function KnowledgeViewerPage() {
  const navigate =
    useNavigate()

  const {
    categoryName = '',
    documentName = '',
    chunkId = '',
  } = useParams()

  const [
    searchParams,
  ] = useSearchParams()

  const searchQuery =
    searchParams.get('q') ?? ''

  const [
    data,
    setData,
  ] =
    useState<KnowledgeViewerResponse | null>(
      null,
    )

  const [
    context,
    setContext,
  ] =
    useState<KnowledgeContextResponse | null>(
      null,
    )

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    )

  const numericChunkId =
    Number(chunkId)

  useEffect(() => {
    const controller =
      new AbortController()

    async function loadViewer() {
      if (
        !categoryName ||
        !documentName ||
        !Number.isInteger(
          numericChunkId,
        )
      ) {
        setError(
          'Invalid Knowledge Viewer URL.',
        )
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const [
          response,
          contextResponse,
        ] = await Promise.all([
          getKnowledgeViewer(
            categoryName,
            documentName,
            numericChunkId,
            controller.signal,
          ),
          getChunkContext(
            categoryName,
            documentName,
            numericChunkId,
            1,
            controller.signal,
          ),
        ])

        setData(response)
        setContext(contextResponse)
      } catch (loadError) {
        if (
          loadError instanceof
            DOMException &&
          loadError.name ===
            'AbortError'
        ) {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : (
                'Unable to load this ' +
                'Knowledge chunk.'
              ),
        )
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setLoading(false)
        }
      }
    }

    void loadViewer()

    return () => {
      controller.abort()
    }
  }, [
    categoryName,
    documentName,
    numericChunkId,
  ])

  function openChunk(
    targetChunkId: number | null,
  ) {
    if (
      targetChunkId === null
    ) {
      return
    }

    const query =
      searchQuery
        ? (
            `?q=${encodeURIComponent(
              searchQuery,
            )}`
          )
        : ''

    navigate(
      (
        `/knowledge/view/` +
        `${encodeURIComponent(categoryName)}/` +
        `${encodeURIComponent(documentName)}/` +
        `${targetChunkId}` +
        query
      ),
    )
  }

  if (loading) {
    return (
      <section className="knowledge-viewer-page">
        <div className="knowledge-viewer-state">
          Loading chunk...
        </div>
      </section>
    )
  }

  if (
    error ||
    !data ||
    !context
  ) {
    return (
      <section className="knowledge-viewer-page">
        <div className="knowledge-viewer-state knowledge-viewer-error">
          <h1>
            Unable to open chunk
          </h1>

          <p>
            {error ??
              'The chunk is unavailable.'}
          </p>

          <Link to="/knowledge/search">
            Return to Search
          </Link>
        </div>
      </section>
    )
  }

  const chunk =
    data.chunk

  return (
    <section className="knowledge-viewer-page">
      <header className="knowledge-viewer-header">
        <div>
          <Link
            to="/knowledge/search"
            className="knowledge-viewer-back"
          >
            <ArrowLeft
              size={15}
              aria-hidden="true"
            />

            Back to Search
          </Link>

          <div className="knowledge-viewer-heading">
            <span className="knowledge-viewer-file-icon">
              <FileText
                size={21}
                aria-hidden="true"
              />
            </span>

            <div>
              <h1>
                {chunk.source}
              </h1>

              <p>
                {data.category}
                {' · '}
                Chunk {chunk.chunk}
                {' · '}
                Position {chunk.position}
                {' of '}
                {data.statistics.chunks}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="knowledge-viewer-grid">
        <main className="knowledge-viewer-document">
          <div className="knowledge-viewer-document-toolbar">
            <div>
              <span>
                Chunk {chunk.chunk}
              </span>

              {chunk.page !== null && (
                <span>
                  Page {chunk.page}
                </span>
              )}
            </div>

            <span>
              {chunk.word_count} words
            </span>
          </div>

          <div className="knowledge-viewer-text">
            {context.chunks.map((contextChunk) => (
              <ContextChunk
                key={contextChunk.id}
                title={
                  contextChunk.is_current
                    ? 'Current Chunk'
                    : contextChunk.chunk < chunk.chunk
                      ? 'Previous Chunk'
                      : 'Next Chunk'
                }
                chunk={contextChunk.chunk}
                page={contextChunk.page}
                text={contextChunk.text}
                isCurrent={contextChunk.is_current}
              />
            ))}
          </div>

          <nav className="knowledge-viewer-navigation">
            <button
              type="button"
              disabled={
                chunk.previous_chunk_id ===
                null
              }
              onClick={() => {
                openChunk(
                  chunk.previous_chunk_id,
                )
              }}
            >
              <ChevronLeft
                size={17}
                aria-hidden="true"
              />

              Previous

              {chunk.previous_chunk_id !==
                null && (
                <span>
                  Chunk {
                    chunk.previous_chunk_id
                  }
                </span>
              )}
            </button>

            <button
              type="button"
              disabled={
                chunk.next_chunk_id ===
                null
              }
              onClick={() => {
                openChunk(
                  chunk.next_chunk_id,
                )
              }}
            >
              Next

              {chunk.next_chunk_id !==
                null && (
                <span>
                  Chunk {
                    chunk.next_chunk_id
                  }
                </span>
              )}

              <ArrowRight
                size={17}
                aria-hidden="true"
              />
            </button>
          </nav>
        </main>

        <aside className="knowledge-viewer-sidebar">
          <section className="knowledge-viewer-panel">
            <h2>
              Metadata
            </h2>

            <dl>
              <div>
                <dt>
                  Category
                </dt>
                <dd>
                  {chunk.category}
                </dd>
              </div>

              <div>
                <dt>
                  Document
                </dt>
                <dd>
                  {chunk.source}
                </dd>
              </div>

              <div>
                <dt>
                  Chunk
                </dt>
                <dd>
                  {chunk.chunk}
                </dd>
              </div>

              <div>
                <dt>
                  Vector ID
                </dt>
                <dd>
                  {chunk.vector_id ??
                    'N/A'}
                </dd>
              </div>

              <div>
                <dt>
                  Words
                </dt>
                <dd>
                  {chunk.word_count}
                </dd>
              </div>

              <div>
                <dt>
                  Characters
                </dt>
                <dd>
                  {chunk.character_count}
                </dd>
              </div>
            </dl>
          </section>

          <section className="knowledge-viewer-panel">
            <h2>
              Document Index
            </h2>

            <div className="knowledge-viewer-index-stat">
              <Layers3
                size={16}
                aria-hidden="true"
              />

              <div>
                <strong>
                  {data.statistics.chunks}
                </strong>

                <span>
                  Chunks
                </span>
              </div>
            </div>

            <div className="knowledge-viewer-index-stat">
              <Hash
                size={16}
                aria-hidden="true"
              />

              <div>
                <strong>
                  {data.statistics.vectors}
                </strong>

                <span>
                  Vectors
                </span>
              </div>
            </div>
          </section>

          {searchQuery && (
            <section className="knowledge-viewer-panel">
              <h2>
                Search Context
              </h2>

              <p className="knowledge-viewer-query">
                {searchQuery}
              </p>
            </section>
          )}
        </aside>
      </div>
    </section>
  )
}

export default KnowledgeViewerPage
