import {
  ArrowLeft,
  Boxes,
  Database,
  FileCode2,
  FileJson,
  FileText,
  Folder,
  HardDrive,
  LoaderCircle,
  RefreshCw,
  Search,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Link,
  useParams,
} from 'react-router-dom'

import {
  formatCount,
  formatFileSize,
  formatKnowledgeDate,
  getKnowledgeCategory,
} from '../services/knowledge'

import type {
  KnowledgeCategory,
  KnowledgeDocument,
  KnowledgeFile,
} from '../services/knowledge'

function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof DOMException &&
    error.name === 'AbortError'
  ) {
    return ''
  }

  if (error instanceof Error) {
    return error.message
  }

  return (
    'An unexpected error occurred while ' +
    'loading this knowledge category.'
  )
}

function ArtifactFile({
  file,
  icon,
}: {
  file: KnowledgeFile
  icon:
    | 'embedding'
    | 'faiss'
    | 'metadata'
}) {
  const FileIcon =
    icon === 'embedding'
      ? Boxes
      : icon === 'faiss'
        ? Database
        : FileJson

  return (
    <article className="knowledge-artifact-file">
      <div className="knowledge-artifact-file-icon">
        <FileIcon size={17} />
      </div>

      <div className="knowledge-artifact-file-copy">
        <strong>{file.name}</strong>

        <span>
          {formatFileSize(
            file.size_bytes,
          )}
          {' · '}
          {formatKnowledgeDate(
            file.modified_at,
          )}
        </span>

        <small>
          {file.relative_path}
        </small>
      </div>
    </article>
  )
}

function DocumentRow({
  document,
}: {
  document: KnowledgeDocument
}) {
  const totalArtifactSize =
    (document.chunk_file
      ?.size_bytes ?? 0) +
    (document.embedding_file
      ?.size_bytes ?? 0) +
    document.faiss_files.reduce(
      (total, file) =>
        total + file.size_bytes,
      0,
    )

  return (
    <article className="knowledge-document-row">
      <div className="knowledge-document-row-main">
        <div className="knowledge-document-row-icon">
          <FileText size={18} />
        </div>

        <div className="knowledge-document-row-copy">
          <strong>
            {document.name}
          </strong>

          <span>
            Modified{' '}
            {formatKnowledgeDate(
              document.modified_at,
            )}
          </span>
        </div>
      </div>

      <div className="knowledge-document-row-metrics">
        <div>
          <span>Chunks</span>

          <strong>
            {formatCount(
              document.chunks ?? 0,
            )}
          </strong>
        </div>

        <div>
          <span>Embeddings</span>

          <strong>
            {formatCount(
              document.embeddings ??
                0,
            )}
          </strong>
        </div>

        <div>
          <span>Indexes</span>

          <strong>
            {formatCount(
              document.faiss_files
                .length,
            )}
          </strong>
        </div>

        <div>
          <span>Artifacts</span>

          <strong>
            {formatFileSize(
              totalArtifactSize,
            )}
          </strong>
        </div>
      </div>

      <span
        className={`knowledge-document-status ${
          document.indexed
            ? 'ready'
            : 'incomplete'
        }`}
      >
        {document.indexed
          ? 'Indexed'
          : 'Incomplete'}
      </span>

      <details className="knowledge-document-details">
        <summary>
          View generated artifacts
        </summary>

        <div className="knowledge-document-artifacts">
          {document.chunk_file && (
            <ArtifactFile
              file={
                document.chunk_file
              }
              icon="metadata"
            />
          )}

          {document.embedding_file && (
            <ArtifactFile
              file={
                document.embedding_file
              }
              icon="embedding"
            />
          )}

          {document.faiss_files.map(
            (file) => (
              <ArtifactFile
                key={
                  file.relative_path
                }
                file={file}
                icon="faiss"
              />
            ),
          )}

          {!document.chunk_file &&
            !document.embedding_file &&
            document.faiss_files
              .length === 0 && (
              <p className="knowledge-empty-documents">
                No generated artifacts
                were found.
              </p>
            )}
        </div>
      </details>
    </article>
  )
}

function KnowledgeCategoryPage() {
  const {
    categoryName = '',
  } = useParams<{
    categoryName: string
  }>()

  const decodedCategoryName =
    useMemo(
      () =>
        decodeURIComponent(
          categoryName,
        ),
      [categoryName],
    )

  const [
    category,
    setCategory,
  ] =
    useState<KnowledgeCategory | null>(
      null,
    )

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    refreshing,
    setRefreshing,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState('')

  const [
    searchQuery,
    setSearchQuery,
  ] = useState('')

  const loadCategory =
    useCallback(
      async (
        controller?: AbortController,
        isRefresh = false,
      ) => {
        if (!decodedCategoryName) {
          setError(
            'No knowledge category was selected.',
          )

          setLoading(false)

          return
        }

        if (isRefresh) {
          setRefreshing(true)
        } else {
          setLoading(true)
        }

        setError('')

        try {
          const result =
            await getKnowledgeCategory(
              decodedCategoryName,
              controller?.signal,
            )

          setCategory(result)
        } catch (
          requestError
        ) {
          const message =
            getErrorMessage(
              requestError,
            )

          if (message) {
            setError(message)
          }
        } finally {
          if (isRefresh) {
            setRefreshing(false)
          } else {
            setLoading(false)
          }
        }
      },
      [decodedCategoryName],
    )

  useEffect(() => {
    const controller =
      new AbortController()

    void loadCategory(
      controller,
      false,
    )

    return () => {
      controller.abort()
    }
  }, [loadCategory])

  const filteredDocuments =
    useMemo(() => {
      if (!category) {
        return []
      }

      const normalizedQuery =
        searchQuery
          .trim()
          .toLowerCase()

      if (!normalizedQuery) {
        return category.documents
      }

      return category.documents.filter(
        (document) =>
          document.name
            .toLowerCase()
            .includes(
              normalizedQuery,
            ),
      )
    }, [
      category,
      searchQuery,
    ])

  if (loading) {
    return (
      <section className="knowledge-page knowledge-state-page">
        <LoaderCircle
          className="spinner"
          size={30}
        />

        <h2>
          Loading category...
        </h2>
      </section>
    )
  }

  if (error && !category) {
    return (
      <section className="knowledge-page knowledge-state-page">
        <Folder size={34} />

        <h2>
          Unable to load category
        </h2>

        <p>{error}</p>

        <Link
          className="knowledge-back-link"
          to="/knowledge"
        >
          <ArrowLeft size={16} />
          Back to Knowledge Library
        </Link>
      </section>
    )
  }

  if (!category) {
    return (
      <section className="knowledge-page knowledge-state-page">
        <Folder size={34} />

        <h2>
          Category is unavailable
        </h2>
      </section>
    )
  }

  return (
    <section className="knowledge-page">
      <div className="knowledge-breadcrumb">
        <Link
          to="/knowledge"
          className="knowledge-back-link"
        >
          <ArrowLeft size={16} />
          Knowledge Library
        </Link>

        <span>/</span>

        <strong>
          {category.name}
        </strong>
      </div>

      <header className="knowledge-header">
        <div className="knowledge-header-copy">
          <div className="knowledge-header-icon">
            <Folder size={28} />
          </div>

          <div>
            <h1>{category.name}</h1>

            <p>
              Inspect documents and
              generated indexing artifacts.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="knowledge-refresh-button"
          onClick={() => {
            void loadCategory(
              undefined,
              true,
            )
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
      </header>

      {error && (
        <div className="knowledge-error">
          {error}
        </div>
      )}

      <section className="knowledge-statistics">
        <article className="knowledge-stat-card">
          <span>Documents</span>

          <strong>
            {formatCount(
              category.document_count,
            )}
          </strong>
        </article>

        <article className="knowledge-stat-card">
          <span>Indexed</span>

          <strong>
            {formatCount(
              category.indexed_document_count,
            )}
          </strong>
        </article>

        <article className="knowledge-stat-card">
          <span>Chunks</span>

          <strong>
            {formatCount(
              category.chunk_count,
            )}
          </strong>
        </article>

        <article className="knowledge-stat-card">
          <span>Embeddings</span>

          <strong>
            {formatCount(
              category.embedding_count,
            )}
          </strong>
        </article>

        <article className="knowledge-stat-card">
          <span>FAISS indexes</span>

          <strong>
            {formatCount(
              category.faiss_index_count,
            )}
          </strong>
        </article>
      </section>

      <div className="knowledge-toolbar">
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
            placeholder="Search documents"
            aria-label="Search documents"
          />
        </label>

        <span className="knowledge-result-count">
          {formatCount(
            filteredDocuments.length,
          )}{' '}
          documents
        </span>
      </div>

      <section className="knowledge-category-layout">
        <div className="knowledge-category-main">
          <div className="knowledge-section-heading">
            <div>
              <h2>Documents</h2>

              <p>
                Indexed content detected
                in this category.
              </p>
            </div>
          </div>

          {filteredDocuments.length ===
          0 ? (
            <div className="knowledge-empty-state">
              <FileText size={28} />

              <h2>
                No matching documents
              </h2>

              <p>
                This category may be empty,
                or your search returned no
                results.
              </p>
            </div>
          ) : (
            <div className="knowledge-document-list">
              {filteredDocuments.map(
                (document) => (
                  <DocumentRow
                    key={document.id}
                    document={document}
                  />
                ),
              )}
            </div>
          )}
        </div>

        <aside className="knowledge-category-sidebar">
          <section className="knowledge-artifact-panel">
            <div className="knowledge-artifact-panel-heading">
              <Database size={17} />

              <h2>FAISS indexes</h2>
            </div>

            {category.faiss_files.length ===
            0 ? (
              <p className="knowledge-empty-documents">
                No FAISS index files.
              </p>
            ) : (
              <div className="knowledge-artifact-list">
                {category.faiss_files.map(
                  (file) => (
                    <ArtifactFile
                      key={
                        file.relative_path
                      }
                      file={file}
                      icon="faiss"
                    />
                  ),
                )}
              </div>
            )}
          </section>

          <section className="knowledge-artifact-panel">
            <div className="knowledge-artifact-panel-heading">
              <FileCode2
                size={17}
              />

              <h2>Metadata</h2>
            </div>

            {category.metadata_files
              .length === 0 ? (
              <p className="knowledge-empty-documents">
                No metadata files.
              </p>
            ) : (
              <div className="knowledge-artifact-list">
                {category.metadata_files.map(
                  (file) => (
                    <ArtifactFile
                      key={
                        file.relative_path
                      }
                      file={file}
                      icon="metadata"
                    />
                  ),
                )}
              </div>
            )}
          </section>

          <section className="knowledge-artifact-panel">
            <div className="knowledge-artifact-panel-heading">
              <HardDrive size={17} />

              <h2>Category status</h2>
            </div>

            <dl className="knowledge-category-status">
              <div>
                <dt>Last modified</dt>

                <dd>
                  {formatKnowledgeDate(
                    category.modified_at,
                  )}
                </dd>
              </div>

              <div>
                <dt>Metadata files</dt>

                <dd>
                  {formatCount(
                    category.metadata_file_count,
                  )}
                </dd>
              </div>

              <div>
                <dt>Index health</dt>

                <dd>
                  {category.indexed_document_count ===
                  category.document_count &&
                  category.document_count >
                    0
                    ? 'Ready'
                    : category.document_count ===
                        0
                      ? 'Empty'
                      : 'Incomplete'}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </section>
    </section>
  )
}

export default KnowledgeCategoryPage