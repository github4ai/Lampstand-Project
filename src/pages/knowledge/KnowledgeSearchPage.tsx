import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  ArrowLeft,
  Database,
  LoaderCircle,
  Search,
} from 'lucide-react'
import {
  Link,
} from 'react-router-dom'

import SearchResultCard from '../../components/knowledge/SearchResultCard'
import {
  searchKnowledge,
} from '../../api/knowledgeSearch'
import type {
  KnowledgeSearchResponse,
} from '../../types/knowledgeSearch'

const CATEGORY_OPTIONS = [
  'Ministry',
  'Business',
  'Coding',
  'Creative',
  'Manuals',
  'Operations',
  'Personal',
  'Research',
  'School',
]

function KnowledgeSearchPage() {
  const [
    query,
    setQuery,
  ] = useState('')

  const [
    category,
    setCategory,
  ] = useState('Ministry')

  const [
    topK,
    setTopK,
  ] = useState(10)

  const [
    response,
    setResponse,
  ] =
    useState<KnowledgeSearchResponse | null>(
      null,
    )

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    )

  const abortControllerRef =
    useRef<AbortController | null>(
      null,
    )

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  async function handleSearch(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    const normalizedQuery =
      query.trim()

    if (!normalizedQuery) {
      setError(
        'Enter a question or search phrase.',
      )

      return
    }

    abortControllerRef.current?.abort()

    const controller =
      new AbortController()

    abortControllerRef.current =
      controller

    setLoading(true)
    setError(null)

    try {
      const data =
        await searchKnowledge({
          query: normalizedQuery,
          category,
          topK,
          signal:
            controller.signal,
        })

      setResponse(data)
    } catch (searchError) {
      if (
        searchError instanceof
          DOMException &&
        searchError.name ===
          'AbortError'
      ) {
        return
      }

      setError(
        searchError instanceof Error
          ? searchError.message
          : (
              'Unable to search the ' +
              'Knowledge Library.'
            ),
      )
    } finally {
      if (
        abortControllerRef.current ===
        controller
      ) {
        setLoading(false)
      }
    }
  }

  return (
    <section className="knowledge-search-page">
      <header className="knowledge-search-page-header">
        <div>
          <Link
            to="/knowledge"
            className="knowledge-search-back"
          >
            <ArrowLeft
              size={15}
              aria-hidden="true"
            />

            Knowledge Library
          </Link>

          <div className="knowledge-search-title-row">
            <span className="knowledge-search-title-icon">
              <Database
                size={22}
                aria-hidden="true"
              />
            </span>

            <div>
              <h1>
                Search Knowledge
              </h1>

              <p>
                Search indexed chunks using
                semantic retrieval, BM25,
                fusion and cross-encoder
                reranking.
              </p>
            </div>
          </div>
        </div>
      </header>

      <form
        className="knowledge-search-form"
        onSubmit={handleSearch}
      >
        <label className="knowledge-search-query">
          <span>
            Search query
          </span>

          <div>
            <Search
              size={18}
              aria-hidden="true"
            />

            <input
              value={query}
              onChange={(event) => {
                setQuery(
                  event.target.value,
                )
              }}
              placeholder="Search for tree of life, divine dispensing..."
              autoFocus
            />
          </div>
        </label>

        <label>
          <span>
            Category
          </span>

          <select
            value={category}
            onChange={(event) => {
              setCategory(
                event.target.value,
              )
            }}
          >
            {CATEGORY_OPTIONS.map(
              (option) => (
                <option
                  key={option}
                  value={option}
                >
                  {option}
                </option>
              ),
            )}
          </select>
        </label>

        <label>
          <span>
            Results
          </span>

          <select
            value={topK}
            onChange={(event) => {
              setTopK(
                Number(
                  event.target.value,
                ),
              )
            }}
          >
            {[3, 5, 10, 20].map(
              (value) => (
                <option
                  key={value}
                  value={value}
                >
                  {value}
                </option>
              ),
            )}
          </select>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="knowledge-search-submit"
        >
          {loading ? (
            <LoaderCircle
              size={17}
              className="knowledge-search-spinner"
              aria-hidden="true"
            />
          ) : (
            <Search
              size={17}
              aria-hidden="true"
            />
          )}

          {loading
            ? 'Searching...'
            : 'Search'}
        </button>
      </form>

      {error && (
        <div
          className="knowledge-search-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {!response && !loading && !error && (
        <div className="knowledge-search-empty">
          <Search
            size={30}
            aria-hidden="true"
          />

          <h2>
            Search the Knowledge Library
          </h2>

          <p>
            Enter a phrase above to retrieve
            the most relevant indexed chunks.
          </p>
        </div>
      )}

      {response && (
        <section className="knowledge-search-results">
          <header className="knowledge-search-results-header">
            <div>
              <h2>
                Search results
              </h2>

              <p>
                {response.total}{' '}
                {response.total === 1
                  ? 'result'
                  : 'results'}{' '}
                for “{response.query}”
              </p>
            </div>

            <span>
              {response.category}
            </span>
          </header>

          {response.results.length === 0 ? (
            <div className="knowledge-search-empty">
              <Search
                size={30}
                aria-hidden="true"
              />

              <h2>
                No results found
              </h2>

              <p>
                Try a broader search phrase
                or another category.
              </p>
            </div>
          ) : (
            <div className="knowledge-search-result-list">
              {response.results.map(
                (
                  result,
                  index,
                ) => (
                  <SearchResultCard
                    key={
                      (
                        `${result.category}-` +
                        `${result.chunk}-` +
                        `${index}`
                      )
                    }
                    result={result}
                    rank={index + 1}
                  />
                ),
              )}
            </div>
          )}
        </section>
      )}
    </section>
  )
}

export default KnowledgeSearchPage
