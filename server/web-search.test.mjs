import { describe, expect, it, vi } from 'vitest'
import { searchWeb, webSearchPrompt } from './web-search.mjs'

describe('web search', () => {
  it('normalizes Tavily results into cited Lampstand sources', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [
      { title: 'Current source', url: 'https://example.com/current', content: 'Supported current information.', score: 0.91 },
    ] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const results = await searchWeb('current information', { tavilyApiKey: 'test-key', tavilyUrl: 'https://api.tavily.test' }, fetcher)
    expect(results).toMatchObject([{ id: 1, citation: 'Current source', url: 'https://example.com/current', rerank_score: 0.91 }])
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('requires explicit search configuration and produces a cited prompt', async () => {
    await expect(searchWeb('question', { tavilyApiKey: '', tavilyUrl: 'https://api.tavily.test' })).rejects.toThrow('Web search is not configured')
    expect(webSearchPrompt('What changed?', [{ id: 1, citation: 'Source', url: 'https://example.com', content: 'Evidence' }])).toContain('[1] Source')
  })
})
