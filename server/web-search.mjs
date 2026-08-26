export async function searchWeb(query, config, fetcher = fetch) {
  const value = String(query || '').trim()
  if (!value) throw new Error('Enter a question to search the web.')
  if (!config.tavilyApiKey) throw new Error('Web search is not configured. Add a Tavily API key in Settings → AI Services.')
  const response = await fetcher(`${config.tavilyUrl}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: config.tavilyApiKey, query: value, search_depth: 'advanced', max_results: 8, include_answer: false }),
    signal: AbortSignal.timeout(45000),
  })
  if (!response.ok) throw new Error(`Web search returned ${response.status}: ${await response.text()}`)
  const body = await response.json()
  return (Array.isArray(body?.results) ? body.results : []).flatMap((item, index) => {
    const url = typeof item?.url === 'string' ? item.url : ''
    const title = typeof item?.title === 'string' ? item.title.trim() : ''
    const content = typeof item?.content === 'string' ? item.content.trim() : ''
    if (!url || !content) return []
    return [{ id: index + 1, citation: title || url, source: title || new URL(url).hostname, url, page: null, chunk: null, rerank_score: typeof item?.score === 'number' ? item.score : null, content }]
  })
}

export function webSearchPrompt(question, results) {
  const evidence = results.map((item) => `[${item.id}] ${item.citation}\nURL: ${item.url}\n${item.content}`).join('\n\n')
  return `Answer the question using the current web results below. Cite factual claims with [number] references. If the results do not support a claim, say so. Include a short Sources list with the source titles and URLs.\n\nQuestion:\n${question}\n\nWeb results:\n${evidence}`
}
