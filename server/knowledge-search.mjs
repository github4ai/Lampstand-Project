import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const stopWords = new Set(['a', 'an', 'and', 'are', 'be', 'do', 'does', 'for', 'from', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'the', 'to', 'what', 'which', 'who'])

function terms(value) {
  return [...new Set(String(value || '').toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter((term) => term.length > 1 && !stopWords.has(term)) || [])]
}

function schoolSubjectFromQuery(value) {
  const query = String(value || '').toLowerCase()
  if (/\bsocial\s+science\b/.test(query)) return 'social-science'
  if (/\b(?:english|language arts?)\b/.test(query)) return 'english'
  if (/\b(?:math|maths|mathematics)\b/.test(query)) return 'math'
  if (/\bscience\b/.test(query)) return 'science'
  if (/\b(?:computer|computing|ict)\b/.test(query)) return 'computer'
  if (/\b(?:tailor|tailoring|sewing|garment)\b/.test(query)) return 'tailoring'
  return ''
}

function sourceMatchesSchoolSubject(sourceValue, subject) {
  if (!subject) return true
  const source = String(sourceValue || '').toLowerCase().replace(/[_-]+/g, ' ')
  if (subject === 'social-science') return /social\s+science/.test(source)
  if (subject === 'english') return /english/.test(source)
  if (subject === 'math') return /math/.test(source)
  if (subject === 'science') return /science/.test(source) && !/social\s+science/.test(source)
  if (subject === 'computer') return /computer/.test(source)
  if (subject === 'tailoring') return /tailor|sewing|garment|chapter|project|book cover/.test(source)
  return true
}

function scoreChunk(chunk, query, queryTerms) {
  const text = String(chunk.text || '').toLowerCase()
  const source = String(chunk.source || '').toLowerCase().replace(/[_-]+/g, ' ')
  const searchable = `${source} ${text}`
  let score = text.includes(query.toLowerCase()) ? 30 : 0
  for (const term of queryTerms) {
    const matches = text.match(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'))?.length || 0
    score += Math.min(matches, 5) * 4
    if (source.includes(term)) score += 10
  }
  if (queryTerms.length && queryTerms.every((term) => searchable.includes(term))) score += 15
  if (/contents?|first lesson|lesson name/.test(text) && /first|lesson/.test(query.toLowerCase())) score += 12
  return score
}

export async function searchLocalKnowledge({ query, category, topK = 10, includeText = false }, config) {
  const normalizedQuery = String(query || '').trim()
  const normalizedCategory = String(category || '').trim()
  if (!normalizedQuery || !normalizedCategory) return { query: normalizedQuery, category: normalizedCategory, top_k: topK, total: 0, results: [] }
  const folder = join(config.knowledgeIndexDir, normalizedCategory, 'Chunks')
  let files = []
  try { files = (await readdir(folder)).filter((file) => file.toLowerCase().endsWith('_chunks.json')) } catch { /* An empty library is a valid state. */ }
  const queryTerms = terms(normalizedQuery)
  const schoolSubject = normalizedCategory.toLowerCase() === 'school' ? schoolSubjectFromQuery(normalizedQuery) : ''
  const results = []
  for (const file of files) {
    let chunks
    try { chunks = JSON.parse(await readFile(join(folder, file), 'utf8')) } catch { continue }
    if (!Array.isArray(chunks)) continue
    for (const chunk of chunks) {
      if (!sourceMatchesSchoolSubject(chunk.source || file, schoolSubject)) continue
      const score = scoreChunk(chunk, normalizedQuery, queryTerms)
      if (score <= 0) continue
      const text = String(chunk.text || '').trim()
      const source = String(chunk.source || file.replace(/_chunks\.json$/i, ''))
      results.push({
        score, retrieval_score: score, fusion_score: score, rerank_score: null, combined_score: score,
        category: normalizedCategory, document: source, source, page: Number.isFinite(chunk.page) ? chunk.page : null,
        chunk: Number(chunk.chunk || chunk.id || 0), chunk_file: file, citation: `${source} · Chunk ${chunk.chunk || chunk.id || 0}`,
        matched_query: normalizedQuery, matched_queries: [normalizedQuery], retrieval_method: 'local-keyword', retrieval_methods: ['local-keyword'],
        preview: text.slice(0, 320), ...(includeText ? { text } : {}),
      })
    }
  }
  results.sort((left, right) => right.score - left.score)
  const selected = results.slice(0, Math.max(1, Math.min(Number(topK) || 10, 50)))
  return { query: normalizedQuery, category: normalizedCategory, top_k: selected.length, total: results.length, results: selected }
}

export async function answerSchoolQuestion(question, config) {
  const normalized = String(question || '').toLowerCase()
  const requestedTool = /\b(?:flashcards?|revision sheet|practice quiz|quiz)\b/.test(normalized)
  const hasSpecificLesson = /\b(?:lesson|chapter)\s*(?:number\s*)?\d+\b/.test(normalized)
  if (requestedTool && !hasSpecificLesson) {
    return {
      text: 'Which exact lesson or chapter should I use? You can reply with something like “English, Lesson 1” or “Science, Chapter 3.”',
      model: 'Local School Library', grounded: false, sources: [],
    }
  }
  const knowledge = await searchLocalKnowledge({ query: question, category: 'School', topK: 8, includeText: true }, config)
  if (!knowledge.results.length) return { text: 'I could not find relevant information in the indexed School materials.', model: 'Local School Library', grounded: false, sources: [] }
  const context = knowledge.results.map((result, index) => `[${index + 1}] ${result.citation}\n${result.text}`).join('\n\n')
  const prompt = `You are the School Assistant in Lampstand Project. Answer the learner using only the indexed school excerpts below. Be clear and age-appropriate. Keep subjects and books strictly separate: never combine similarly numbered lessons or chapters from different books. Treat a contents-page lesson number as a lesson, not as a page or a different chapter. If the excerpts do not establish the answer, say so instead of guessing. Cite supporting excerpts as [1], [2], and so on.\n\nQuestion: ${question}\n\nIndexed excerpts:\n${context}`
  const sources = knowledge.results.map((result, index) => ({
    id: index + 1,
    title: result.document,
    document: result.document,
    source: result.source,
    page: result.page ?? null,
    chunk: Number.isFinite(result.chunk) ? result.chunk : null,
    citation: result.citation,
    score: result.score,
    rerank_score: Number.isFinite(result.rerank_score) ? result.rerank_score : result.score,
  }))
  return { prompt, grounded: true, sources }
}
