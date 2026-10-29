import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readKnowledgeLessons } from './knowledge.mjs'
import { generateTextWithProviders } from './providers.mjs'

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

export async function searchLocalKnowledge({ query, category, topK = 10, includeText = false, documentFilter }, config) {
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
      const source = String(chunk.source || file.replace(/_chunks\.json$/i, ''))
      if (documentFilter && !documentFilter(source)) continue
      const score = scoreChunk(chunk, normalizedQuery, queryTerms)
      if (score <= 0) continue
      const text = String(chunk.text || '').trim()
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

const ministrySources = {
  bible: { label: 'Recovery Bible', match: (sourceName) => /recovery version/i.test(sourceName) },
  hwmr: { label: 'HWMR', match: (sourceName) => /hwmr|morning revival/i.test(sourceName) },
  'life-study': { label: 'Life-Study', match: (sourceName) => /life[-\s]?study/i.test(sourceName) },
  hymnal: { label: 'Hymnal', match: (sourceName) => /hymn/i.test(sourceName) },
  'ministry-books': { label: 'Ministry Books', match: (sourceName) => !/recovery version|hwmr|morning revival|life[-\s]?study|hymn/i.test(sourceName) },
}

export async function answerMinistryQuestion(question, config, ministrySource = 'all') {
  const scope = ministrySources[String(ministrySource || '').toLowerCase()] || null
  const knowledge = await searchLocalKnowledge({
    query: question, category: 'Ministry', topK: 8, includeText: true, documentFilter: scope ? scope.match : undefined,
  }, config)
  if (!knowledge.results.length) {
    return {
      text: scope
        ? `I could not find relevant ${scope.label} material in your indexed Ministry library. Try All Ministry, or add more ${scope.label} documents in Documents.`
        : 'I could not find relevant material in your indexed Ministry library. Try wording that matches the books you have added, or index more ministry documents in Documents.',
      model: 'Local Ministry Library', grounded: false, sources: [],
    }
  }
  const context = knowledge.results.map((result, index) => `[${index + 1}] ${result.citation}\n${result.text}`).join('\n\n')
  const scopeLine = scope ? ` Answer from ${scope.label} material only.` : ''
  const prompt = `You are the Ministry Assistant in Lampstand Project. Answer using only the indexed ministry excerpts below. Quote them accurately and never invent scripture references, hymn numbers, or book titles the excerpts do not contain. Keep different books and ministry publications separate: do not blend a passage from one with a passage from another as if they were the same text. Where an excerpt is a footnote, outline, or study title, say so. If the excerpts do not establish the answer, say so instead of guessing. Cite supporting excerpts as [1], [2], and so on.${scopeLine}\n\nQuestion: ${question}\n\nIndexed excerpts:\n${context}`
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

function lessonQuestionCount(value) {
  const requested = Math.round(Number(value))
  if (!Number.isFinite(requested)) return 8
  return Math.min(12, Math.max(4, requested))
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function answerIndexOf(rawAnswer, choices) {
  const numeric = typeof rawAnswer === 'number' || (typeof rawAnswer === 'string' && /^\d+$/.test(rawAnswer.trim()))
  if (numeric) {
    const index = Number(String(rawAnswer).trim())
    if (index >= 0 && index < choices.length) return index
  }
  const text = cleanText(rawAnswer)
  if (!text) return -1
  if (/^[A-Da-d]$/.test(text)) return text.toUpperCase().charCodeAt(0) - 65
  return choices.findIndex((choice) => choice.toLowerCase() === text.toLowerCase())
}

function normalizeLessonQuestion(item) {
  const question = cleanText(item?.question)
  const choices = Array.isArray(item?.choices) ? item.choices.map(cleanText).filter(Boolean) : []
  if (question.length < 8 || choices.length !== 4) return null
  if (new Set(choices.map((choice) => choice.toLowerCase())).size !== choices.length) return null
  const answer = answerIndexOf(item?.answer, choices)
  if (answer < 0) return null
  const explanation = cleanText(item?.explanation)
  return { question, choices, answer, explanation: explanation || `The lesson supports “${choices[answer]}”.` }
}

export function parseLessonQuestions(text, count) {
  const payload = extractJsonPayload(text)
  const items = Array.isArray(payload) ? payload : Array.isArray(payload?.questions) ? payload.questions : []
  const seen = new Set()
  const questions = []
  for (const item of items) {
    if (questions.length >= count) break
    const question = normalizeLessonQuestion(item)
    if (!question || seen.has(question.question.toLowerCase())) continue
    seen.add(question.question.toLowerCase())
    questions.push(question)
  }
  return questions
}

function parseJsonBody(body) {
  try { return { parsed: true, value: JSON.parse(body) } } catch { return { parsed: false, value: null } }
}

// Local models slip in a stray quote before a key name or leave a comma before a closing brace.
function repairJsonBody(body) {
  return body
    .replace(/([{,]\s*)"+\s*([A-Za-z_$][\w$]*)"\s*:/g, '$1"$2":')
    .replace(/,\s*([}\]])/g, '$1')
}

function balancedJsonBody(body) {
  const start = body.search(/[{[]/)
  if (start < 0) return ''
  const opener = body[start]
  const closer = opener === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < body.length; index += 1) {
    const character = body[index]
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') inString = true
    else if (character === opener) depth += 1
    else if (character === closer) {
      depth -= 1
      if (depth === 0) return body.slice(start, index + 1)
    }
  }
  return ''
}

function extractJsonPayload(text) {
  const raw = String(text || '').trim()
  if (!raw) return null
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = (fenced ? fenced[1] : raw).trim()
  // Models also add prose around the JSON, so look for the payload inside the reply.
  for (const candidate of [body, repairJsonBody(body)]) {
    for (const slice of [candidate, balancedJsonBody(candidate)]) {
      if (!slice) continue
      const parsed = parseJsonBody(slice)
      if (parsed.parsed) return parsed.value
    }
  }
  return null
}

export async function generateSchoolLessonQuestions({ category = 'School', document, sections = [], count }, config, fetcher = fetch) {
  const wanted = lessonQuestionCount(count)
  if (!document || !Array.isArray(sections) || sections.length === 0) {
    return { questions: [], reason: 'no-lesson-selected', count: wanted, lessonLabels: [] }
  }
  let lessons
  try {
    lessons = (await readKnowledgeLessons(category, document, sections, config)).lessons
  } catch {
    return { questions: [], reason: 'lesson-not-indexed', count: wanted, lessonLabels: [] }
  }
  const usable = lessons.filter((lesson) => cleanText(lesson.text).split(' ').length >= 40)
  if (usable.length === 0) {
    return { questions: [], reason: 'lesson-not-indexed', count: wanted, lessonLabels: lessons.map((lesson) => lesson.label) }
  }
  const context = usable.map((lesson) => `### ${lesson.label}\n${lesson.text}`).join('\n\n').slice(0, 24000)
  const prompt = `You are the School Assistant in Lampstand Project, writing practice questions for a Level C learner.\n\nWrite exactly ${wanted} multiple-choice questions from the lesson text below, and from nothing else. Every question, every one of its four choices, the correct answer and the explanation must be established by that text. Keep the wording age-appropriate and specific to this lesson, so a learner who skipped it cannot answer from general knowledge. Do not ask about the layout of the book, page numbers, or the lesson title. Do not repeat a question or reuse its wording.\n\nReturn strict JSON only, with no commentary and no code fences, shaped exactly like:\n{"questions":[{"question":"...","choices":["...","...","...","..."],"answer":0,"explanation":"..."}]}\n\nSet "answer" to the zero-based index of the correct choice. Give exactly four choices per question.\n\nLesson text:\n${context}`
  let result
  try {
    result = await generateTextWithProviders(prompt, config, fetcher)
  } catch {
    return { questions: [], reason: 'model-unavailable', count: wanted, lessonLabels: usable.map((lesson) => lesson.label) }
  }
  const questions = parseLessonQuestions(result.text, wanted)
  return {
    questions,
    model: result.model,
    count: wanted,
    lessonLabels: usable.map((lesson) => lesson.label),
    reason: questions.length === 0 ? 'model-output-unusable' : '',
  }
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
