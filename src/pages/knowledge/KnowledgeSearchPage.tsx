import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  ArrowLeft,
  Check,
  Clock3,
  Clipboard,
  Database,
  Download,
  LoaderCircle,
  Link2,
  Bookmark,
  Star,
  Search,
} from 'lucide-react'
import {
  Link,
  useSearchParams,
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
const RECENT_SEARCHES_KEY = 'aios-studio-knowledge-recent-searches-v1'
const SAVED_SEARCHES_KEY = 'aios-studio-knowledge-saved-searches-v1'

interface RecentKnowledgeSearch { query: string; category: string }

function loadRecentSearches(): RecentKnowledgeSearch[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.map((item): RecentKnowledgeSearch | null => {
      if (typeof item === 'string') return { query: item, category: 'Ministry' }
      if (typeof item === 'object' && item !== null && typeof item.query === 'string' && typeof item.category === 'string') {
        return { query: item.query, category: item.category }
      }
      return null
    }).filter((item): item is RecentKnowledgeSearch => item !== null).slice(0, 8)
  } catch { return [] }
}

function KnowledgeSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [
    query,
    setQuery,
  ] = useState(() => searchParams.get('q') ?? '')

  const [
    category,
    setCategory,
  ] = useState(() => {
    const value = searchParams.get('category')
    return value && CATEGORY_OPTIONS.includes(value) ? value : 'Ministry'
  })

  const [
    topK,
    setTopK,
  ] = useState(() => {
    const value = Number(searchParams.get('results'))
    return [3, 5, 10, 20].includes(value) ? value : 10
  })

  const [
    recentSearches,
    setRecentSearches,
  ] = useState(loadRecentSearches)

  const [
    copyStatus,
    setCopyStatus,
  ] = useState<'idle' | 'copied' | 'failed'>('idle')

  const [linkCopyStatus, setLinkCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [searchMode, setSearchMode] = useState<'semantic' | 'exact'>(() => searchParams.get('mode') === 'exact' ? 'exact' : 'semantic')
  const [savedSearches, setSavedSearches] = useState<RecentKnowledgeSearch[]>(() => {
    try { return JSON.parse(localStorage.getItem(SAVED_SEARCHES_KEY) ?? '[]') as RecentKnowledgeSearch[] } catch { return [] }
  })

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

  const searchFormRef = useRef<HTMLFormElement | null>(null)
  const restoredSearchStartedRef = useRef(false)

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (restoredSearchStartedRef.current || !searchParams.get('q')) return
    const timer = window.setTimeout(() => {
      if (!searchFormRef.current || restoredSearchStartedRef.current) return
      restoredSearchStartedRef.current = true
      searchFormRef.current.requestSubmit()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [searchParams])

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
    setResponse(null)
    setCopyStatus('idle')
    setLinkCopyStatus('idle')

    try {
      const requestedCategories = category === 'All categories' ? CATEGORY_OPTIONS : [category]
      const responses = await Promise.all(requestedCategories.map((requestedCategory) => searchKnowledge({
        query: normalizedQuery, category: requestedCategory, topK,
        includeText: searchMode === 'exact', signal: controller.signal,
      })))
      const mergedResults = responses.flatMap((item) => item.results)
        .filter((item) => searchMode === 'semantic' || (item.text ?? item.preview).toLocaleLowerCase().includes(normalizedQuery.toLocaleLowerCase()))
        .sort((left, right) => (right.combined_score ?? right.score ?? 0) - (left.combined_score ?? left.score ?? 0))
        .slice(0, topK)
      const data: KnowledgeSearchResponse = {
        query: normalizedQuery, category, top_k: topK, total: mergedResults.length, results: mergedResults,
      }

      setResponse(data)
      setSearchParams({ q: normalizedQuery, category, results: String(topK), mode: searchMode }, { replace: true })
      const next = [{ query: normalizedQuery, category }, ...recentSearches.filter((item) =>
        item.query.toLowerCase() !== normalizedQuery.toLowerCase() || item.category !== category)].slice(0, 8)
      setRecentSearches(next)
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next))
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

  function toggleSavedSearch() {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) return
    const exists = savedSearches.some((item) => item.query === normalizedQuery && item.category === category)
    const next = exists ? savedSearches.filter((item) => item.query !== normalizedQuery || item.category !== category)
      : [{ query: normalizedQuery, category }, ...savedSearches].slice(0, 20)
    setSavedSearches(next)
    localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(next))
  }

  function formatResultsReport() {
    if (!response) return
    const entries = response.results.map((result, index) => {
      const score = result.combined_score ?? result.score
      const location = [`${index + 1}. ${result.document}`, result.category, `Chunk ${result.chunk}`,
        result.page !== null ? `Page ${result.page}` : null, score !== null ? `Score ${score.toFixed(4)}` : null]
        .filter(Boolean).join(' · ')
      return `${location}\n${result.preview || result.text || 'No preview available.'}`
    }).join('\n\n---\n\n')
    return `Knowledge Search\nQuery: ${response.query}\nCategory: ${response.category}\nResults: ${response.total}\n\n${entries}`
  }

  function exportResults() {
    if (!response) return
    const report = formatResultsReport()
    if (!report) return
    const file = new Blob([report], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    const name = response.query.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
    link.href = url
    link.download = `knowledge-search-${name || 'results'}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function copyResults() {
    const report = formatResultsReport()
    if (!report) return
    try {
      await navigator.clipboard.writeText(report)
      setCopyStatus('copied')
      window.setTimeout(() => setCopyStatus('idle'), 1800)
    } catch {
      setCopyStatus('failed')
    }
  }

  async function copySearchLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setLinkCopyStatus('copied')
      window.setTimeout(() => setLinkCopyStatus('idle'), 1800)
    } catch {
      setLinkCopyStatus('failed')
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
        ref={searchFormRef}
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
            {['All categories', ...CATEGORY_OPTIONS].map(
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
          <span>Match</span>
          <select value={searchMode} onChange={(event) => setSearchMode(event.target.value as typeof searchMode)}>
            <option value="semantic">Meaning</option>
            <option value="exact">Exact phrase</option>
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

      {query.trim() && <div className="knowledge-search-save-row">
        <button type="button" onClick={toggleSavedSearch}>
          {savedSearches.some((item) => item.query === query.trim() && item.category === category) ? <Star size={14} fill="currentColor" /> : <Bookmark size={14} />}
          {savedSearches.some((item) => item.query === query.trim() && item.category === category) ? 'Saved search' : 'Save search'}
        </button>
      </div>}

      {savedSearches.length > 0 && <div className="knowledge-recent-searches knowledge-saved-searches">
        <span><Star size={13} /> Saved</span>
        {savedSearches.map((item) => <button type="button" key={`${item.category}-${item.query}`} onClick={() => {
          setQuery(item.query); setCategory(item.category); window.setTimeout(() => searchFormRef.current?.requestSubmit(), 0)
        }}>{item.query}<small>{item.category}</small></button>)}
      </div>}

      {recentSearches.length > 0 && <div className="knowledge-recent-searches">
        <span><Clock3 size={13} /> Recent</span>
        {recentSearches.map((item) => <button type="button" key={`${item.category}-${item.query}`}
          title={`Search in ${item.category}`} onClick={() => {
            setQuery(item.query)
            setCategory(item.category)
            window.setTimeout(() => searchFormRef.current?.requestSubmit(), 0)
          }}>
          {item.query}<small>{item.category}</small>
        </button>)}
        <button className="clear" type="button" onClick={() => {
          setRecentSearches([])
          localStorage.removeItem(RECENT_SEARCHES_KEY)
        }}>Clear</button>
      </div>}

      {error && (
        <div
          className="knowledge-search-error"
          role="alert"
        >
          <span>{error}</span>
          <button type="button" onClick={() => searchFormRef.current?.requestSubmit()}>Try again</button>
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

            <div className="knowledge-search-results-actions">
              <span>{response.category}</span>
              <button type="button" onClick={() => void copySearchLink()}>
                {linkCopyStatus === 'copied' ? <Check size={14} /> : <Link2 size={14} />}
                {linkCopyStatus === 'copied' ? 'Link copied' : linkCopyStatus === 'failed' ? 'Copy failed' : 'Copy link'}
              </button>
              {response.results.length > 0 && <button type="button" onClick={() => void copyResults()}>
                {copyStatus === 'copied' ? <Check size={14} /> : <Clipboard size={14} />}
                {copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy failed' : 'Copy results'}
              </button>}
              {response.results.length > 0 && <button type="button" onClick={exportResults}>
                <Download size={14} /> Export results
              </button>}
            </div>
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
                    query={response.query}
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
