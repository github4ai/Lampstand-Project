import {
  Database,
  FileText,
  Folder,
  LoaderCircle,
  RefreshCw,
  Search,
} from 'lucide-react'

import {
  useMemo,
  useState,
} from 'react'

import {
  Link,
} from 'react-router-dom'

import WorkspaceLayout from '../layouts/WorkspaceLayout'

import {
  useKnowledge,
} from '../hooks/useKnowledge'

import {
  formatCount,
  formatKnowledgeDate,
} from '../services/knowledge'

import {
  useAppStore,
} from '../store/useAppStore'

function KnowledgePage() {
  const {
    data,
    loading,
    refreshing,
    error,
    refresh,
  } = useKnowledge()

  const addToast =
    useAppStore(
      (state) =>
        state.addToast,
    )

  const [
    searchQuery,
    setSearchQuery,
  ] = useState('')

  const filteredCategories =
    useMemo(() => {
      if (!data) {
        return []
      }

      const normalizedQuery =
        searchQuery
          .trim()
          .toLowerCase()

      if (!normalizedQuery) {
        return data.categories
      }

      return data.categories.filter(
        (category) => {
          const categoryMatches =
            category.name
              .toLowerCase()
              .includes(
                normalizedQuery,
              )

          const documentMatches =
            category.documents.some(
              (document) =>
                document.name
                  .toLowerCase()
                  .includes(
                    normalizedQuery,
                  ),
            )

          return (
            categoryMatches ||
            documentMatches
          )
        },
      )
    }, [
      data,
      searchQuery,
    ])

  async function handleRefresh() {
    const refreshed =
      await refresh()

    if (refreshed) {
      addToast({
        title:
          'Knowledge Library refreshed',
        message:
          'The latest index information has been loaded.',
        variant: 'success',
        duration: 3200,
      })

      return
    }

    addToast({
      title:
        'Refresh failed',
      message:
        'AIOS could not reload the Knowledge Library.',
      variant: 'error',
      duration: 4500,
    })
  }

  const toolbar = (
    <>
      <label className="knowledge-search">
        <Search size={16} />

        <input
          type="search"
          value={searchQuery}
          onChange={(event) =>
            setSearchQuery(
              event.target.value,
            )
          }
          placeholder="Search categories or documents"
          aria-label="Search Knowledge Library"
        />
      </label>

      <button
        type="button"
        className="knowledge-refresh-button"
        onClick={() => {
          void handleRefresh()
        }}
        disabled={refreshing}
      >
        <RefreshCw
          className={
            refreshing
              ? 'spinner'
              : undefined
          }
          size={16}
        />

        {refreshing
          ? 'Refreshing'
          : 'Refresh'}
      </button>
    </>
  )

  const statusBar =
    data ? (
      <span>
        {formatCount(
          data.category_count,
        )}{' '}
        categories
        {' · '}
        {formatCount(
          data.document_count,
        )}{' '}
        documents
        {' · '}
        {formatCount(
          data.chunk_count,
        )}{' '}
        chunks
        {' · '}
        {formatCount(
          data.embedding_count,
        )}{' '}
        embeddings
      </span>
    ) : (
      <span>
        Knowledge Library
      </span>
    )

  if (loading) {
    return (
      <WorkspaceLayout
        title="Knowledge Library"
        subtitle="Browse indexed documents, embeddings and FAISS collections."
        icon={
          <Database size={25} />
        }
        statusBar={
          <span>
            Loading knowledge data
          </span>
        }
      >
        <div className="knowledge-state-page">
          <LoaderCircle
            className="spinner"
            size={30}
          />

          <h2>
            Loading Knowledge Library...
          </h2>
        </div>
      </WorkspaceLayout>
    )
  }

  if (error && !data) {
    return (
      <WorkspaceLayout
        title="Knowledge Library"
        subtitle="Browse indexed documents, embeddings and FAISS collections."
        icon={
          <Database size={25} />
        }
        toolbar={
          <button
            type="button"
            className="knowledge-refresh-button"
            onClick={() => {
              void handleRefresh()
            }}
            disabled={refreshing}
          >
            <RefreshCw
              className={
                refreshing
                  ? 'spinner'
                  : undefined
              }
              size={16}
            />

            Try again
          </button>
        }
        statusBar={
          <span>
            Backend unavailable
          </span>
        }
      >
        <div className="knowledge-state-page">
          <Database size={34} />

          <h2>
            Unable to load Knowledge Library
          </h2>

          <p>{error}</p>
        </div>
      </WorkspaceLayout>
    )
  }

  if (!data) {
    return (
      <WorkspaceLayout
        title="Knowledge Library"
        subtitle="Browse indexed documents, embeddings and FAISS collections."
        icon={
          <Database size={25} />
        }
        statusBar={
          <span>
            No knowledge data
          </span>
        }
      >
        <div className="knowledge-state-page">
          <Database size={34} />

          <h2>
            Knowledge Library is unavailable
          </h2>
        </div>
      </WorkspaceLayout>
    )
  }

  return (
    <WorkspaceLayout
      title="Knowledge Library"
      subtitle="Browse indexed documents, embeddings, metadata and FAISS collections."
      icon={
        <Database size={25} />
      }
      toolbar={toolbar}
      statusBar={statusBar}
      className="knowledge-workspace"
    >
      {error && (
        <div className="knowledge-error">
          {error}
        </div>
      )}

      <section className="knowledge-statistics">
        <article className="knowledge-stat-card">
          <span>Categories</span>

          <strong>
            {formatCount(
              data.category_count,
            )}
          </strong>
        </article>

        <article className="knowledge-stat-card">
          <span>Documents</span>

          <strong>
            {formatCount(
              data.document_count,
            )}
          </strong>
        </article>

        <article className="knowledge-stat-card">
          <span>Chunks</span>

          <strong>
            {formatCount(
              data.chunk_count,
            )}
          </strong>
        </article>

        <article className="knowledge-stat-card">
          <span>Embeddings</span>

          <strong>
            {formatCount(
              data.embedding_count,
            )}
          </strong>
        </article>

        <article className="knowledge-stat-card">
          <span>FAISS indexes</span>

          <strong>
            {formatCount(
              data.faiss_index_count,
            )}
          </strong>
        </article>
      </section>

      <div className="knowledge-result-summary">
        <span>
          Showing{' '}
          {formatCount(
            filteredCategories.length,
          )}{' '}
          of{' '}
          {formatCount(
            data.categories.length,
          )}{' '}
          categories
        </span>
      </div>

      {filteredCategories.length ===
      0 ? (
        <div className="knowledge-empty-state">
          <Search size={28} />

          <h2>
            No matching categories
          </h2>

          <p>
            Try searching with another
            category or document name.
          </p>
        </div>
      ) : (
        <section className="knowledge-grid">
          {filteredCategories.map(
            (category) => (
              <Link
                key={category.name}
                className="knowledge-card"
                to={
                  `/knowledge/${encodeURIComponent(
                    category.name,
                  )}`
                }
              >
                <div className="knowledge-card-header">
                  <div className="knowledge-card-title">
                    <div className="knowledge-card-icon">
                      <Folder size={18} />
                    </div>

                    <div>
                      <h2>
                        {category.name}
                      </h2>

                      <p>
                        Updated{' '}
                        {formatKnowledgeDate(
                          category.modified_at,
                        )}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`knowledge-status-badge ${
                      category.indexed_document_count >
                      0
                        ? 'ready'
                        : 'empty'
                    }`}
                  >
                    {category.indexed_document_count >
                    0
                      ? 'Ready'
                      : 'Empty'}
                  </span>
                </div>

                <dl className="knowledge-card-metrics">
                  <div>
                    <dt>Documents</dt>

                    <dd>
                      {formatCount(
                        category.document_count,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Chunks</dt>

                    <dd>
                      {formatCount(
                        category.chunk_count,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Embeddings</dt>

                    <dd>
                      {formatCount(
                        category.embedding_count,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Indexes</dt>

                    <dd>
                      {formatCount(
                        category.faiss_index_count,
                      )}
                    </dd>
                  </div>
                </dl>

                <div className="knowledge-card-preview">
                  {category.documents.length ===
                  0 ? (
                    <p className="knowledge-empty-documents">
                      No indexed documents.
                    </p>
                  ) : (
                    category.documents
                      .slice(0, 3)
                      .map(
                        (document) => (
                          <div
                            key={document.id}
                            className="knowledge-document-preview"
                          >
                            <FileText
                              size={14}
                            />

                            <span>
                              {document.name}
                            </span>
                          </div>
                        ),
                      )
                  )}

                  {category.documents.length >
                    3 && (
                    <span className="knowledge-more-documents">
                      +
                      {formatCount(
                        category.documents
                          .length - 3,
                      )}{' '}
                      more
                    </span>
                  )}
                </div>

                <span className="knowledge-card-open">
                  Open category →
                </span>
              </Link>
            ),
          )}
        </section>
      )}
    </WorkspaceLayout>
  )
}

export default KnowledgePage