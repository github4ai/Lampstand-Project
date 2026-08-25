import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import { getAgent, listAgents } from './agents.mjs'
import { loadConfig } from './config.mjs'
import { generateTextWithProviders, transcribeWithProviders, translateWithProviders } from './providers.mjs'
import { cancelMediaGeneration, createMediaGeneration, getMediaGeneration, listMediaGenerations, listWanVideos, proxyAudioFile, proxyComfyFile, proxyWanFile } from './media.mjs'
import { getAiServicesStatus, repairAiServices, startAiServices, unloadAiModels } from './services.mjs'
import { getKnowledgeIndexStatus, inspectKnowledgeHealth, listKnowledgeSources, listKnowledgeSubcollections, readKnowledgeContext, readKnowledgeLibrary, readKnowledgeOutline, readKnowledgePreview, readKnowledgeViewer, saveKnowledgeUpload, startKnowledgeIndex, trashKnowledgeSource, updateKnowledgeSource } from './knowledge.mjs'
import { pipeWebStream } from './streaming.mjs'
import { importConfiguredHymnal, readHymnalLibrary } from './hymnal-library.mjs'
import { readHwmrLibrary, refreshHwmrLibrary } from './hwmr-library.mjs'
import { listRecoveryBibleBooks, readRecoveryBibleBookMatter, readRecoveryBibleBookOutline, readRecoveryBibleChapter, searchRecoveryBible } from './recovery-bible.mjs'
import { listLifeStudyBooks, listLifeStudyMessages, readLifeStudyMessage, searchLifeStudy } from './life-study.mjs'
import { listMinistryBookChapters, readMinistryBookChapter, readMinistryBooksLibrary, searchMinistryBooks } from './ministry-books.mjs'
import { importMinistryExports, readMinistryLibraryStatus } from './ministry-import.mjs'
import { createOnlinePronunciation, supportsOnlinePronunciation } from './pronunciation.mjs'
import { translateDocument } from './document-translation.mjs'
import { answerSchoolQuestion, searchLocalKnowledge } from './knowledge-search.mjs'
import { loadProviderPreferences, publicProviderPreferences, saveProviderPreferences } from './provider-preferences.mjs'

const supportedLanguages = new Set(['en', 'zh', 'ta', 'hi', 'mr', 'te', 'ml', 'kn', 'ru', 'ko'])
const languageAliases = new Map([
  ['automatic', 'auto'], ['detect automatically', 'auto'], ['english', 'en'], ['chinese', 'zh'],
  ['tamil', 'ta'], ['hindi', 'hi'], ['marathi', 'mr'], ['telugu', 'te'], ['telegu', 'te'],
  ['malayalam', 'ml'], ['kannada', 'kn'], ['kanada', 'kn'], ['russian', 'ru'], ['korean', 'ko'],
])
function normalizeLanguageCode(value, fallback = '') {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return fallback
  const base = raw.replace('_', '-').split('-')[0]
  return languageAliases.get(raw) || languageAliases.get(base) || base
}
const config = loadConfig()
loadProviderPreferences(config)

function send(response, status, body, origin = '') {
  const allowedOrigin = config.allowedOrigins.includes(origin) ? origin : config.allowedOrigins[0]
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    Vary: 'Origin',
  })
  response.end(JSON.stringify(body))
}

function sendAudio(response, status, audio, origin = '', headers = {}) {
  const allowedOrigin = config.allowedOrigins.includes(origin) ? origin : config.allowedOrigins[0]
  response.writeHead(status, {
    'Content-Type': 'audio/mpeg',
    'Content-Length': audio.length,
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Expose-Headers': 'X-AIOS-Voice, X-AIOS-Provider',
    Vary: 'Origin',
    ...headers,
  })
  response.end(audio)
}

function sendFile(response, result, origin='') {
  const allowedOrigin=config.allowedOrigins.includes(origin)?origin:config.allowedOrigins[0]
  response.writeHead(200,{'Content-Type':result.contentType,'Content-Length':result.buffer.length,'Content-Disposition':`attachment; filename="${result.filename.replaceAll('"','')}"`,'X-AIOS-Layout-Fidelity':result.fidelity,'X-AIOS-Segments':String(result.segments),'Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Expose-Headers':'Content-Disposition, X-AIOS-Layout-Fidelity, X-AIOS-Segments',Vary:'Origin'})
  response.end(result.buffer)
}

function sendPreview(response, result, origin='') {
  const allowedOrigin=config.allowedOrigins.includes(origin)?origin:config.allowedOrigins[0]
  response.writeHead(200,{'Content-Type':result.contentType,'Content-Length':result.buffer.length,'Content-Disposition':`inline; filename="${result.filename.replaceAll('"','')}"`,'Access-Control-Allow-Origin':allowedOrigin,Vary:'Origin'})
  response.end(result.buffer)
}

function sendNdjson(response, events, origin = '') {
  const allowedOrigin = config.allowedOrigins.includes(origin) ? origin : config.allowedOrigins[0]
  response.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Access-Control-Allow-Origin': allowedOrigin,
    Vary: 'Origin',
  })
  for (const event of events) response.write(`${JSON.stringify(event)}\n`)
  response.end()
}

async function proxyLegacyJson(path, input, response, origin = '') {
  const upstream = await fetch(`${config.legacyApiUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(300000),
  })
  const allowedOrigin = config.allowedOrigins.includes(origin) ? origin : config.allowedOrigins[0]
  response.writeHead(upstream.status, {
    'Content-Type': upstream.headers.get('content-type') || 'application/x-ndjson; charset=utf-8',
    'Access-Control-Allow-Origin': allowedOrigin,
    Vary: 'Origin',
  })
  if (!upstream.body) return response.end()
  await pipeWebStream(upstream.body, response)
}

async function readJson(request, limit = 1024 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > limit) throw new Error('Request body is too large.')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

async function readForm(request) {
  const url = `http://${request.headers.host || `${config.host}:${config.port}`}${request.url}`
  const webRequest = new Request(url, { method: request.method, headers: request.headers, body: request, duplex: 'half' })
  return webRequest.formData()
}

async function providerAvailable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) })
    return response.ok
  } catch {
    return false
  }
}

async function aceStepAvailable() {
  try {
    const response = await fetch(`${config.comfyUrl}/object_info/UNETLoader`, { signal: AbortSignal.timeout(2000) })
    if (!response.ok) return false
    const data = await response.json()
    return data?.UNETLoader?.input?.required?.unet_name?.[0]?.includes(config.aceStepModel) === true
  } catch { return false }
}

export async function proxyLegacy(request, response, origin, fetcher = fetch) {
  // Undici can forward an abort back into the Node request body after fetch has
  // already rejected. Keep that late stream error contained so it cannot bring
  // down the entire local gateway.
  let requestStreamError = null
  const containRequestError = (error) => { requestStreamError = error }
  request.on?.('error', containRequestError)
  const headers = new Headers()
  for (const [name, value] of Object.entries(request.headers)) {
    if (value !== undefined && name !== 'host' && name !== 'origin') headers.set(name, Array.isArray(value) ? value.join(', ') : value)
  }
  const options = { method: request.method, headers, signal: AbortSignal.timeout(300000) }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    options.body = request
    options.duplex = 'half'
  }
  let upstream
  try {
    upstream = await fetcher(`${config.legacyApiUrl}${request.url}`, options)
  } catch (error) {
    const failure = requestStreamError || error
    const detail = failure instanceof Error ? failure.message : String(failure)
    throw new Error(`Legacy AIOS API at ${config.legacyApiUrl} is unavailable: ${detail}`)
  }
  const allowedOrigin = config.allowedOrigins.includes(origin) ? origin : config.allowedOrigins[0]
  response.writeHead(upstream.status, {
    'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    Vary: 'Origin',
  })
  if (!upstream.body) return response.end()
  await pipeWebStream(upstream.body, response)
}

export function createAiosServer() {
  return createServer(async (request, response) => {
    const origin = request.headers.origin || ''
    if (request.method === 'OPTIONS') return send(response, 204, {}, origin)
    try {
      if (request.method === 'GET' && request.url === '/health') {
        return send(response, 200, {
          status: 'ok', mode: config.providerMode,
          providers: {
            ollama: { configured: true },
            whisper: { configured: true },
            gemini: { configured: Boolean(config.geminiApiKey) },
            openai: { configured: Boolean(config.openaiApiKey) },
            anthropic: { configured: Boolean(config.anthropicApiKey) },
          },
        }, origin)
      }

      if (request.method === 'GET' && request.url === '/agents') {
        return send(response, 200, listAgents(), origin)
      }

      const agentMatch = request.method === 'GET' && request.url.match(/^\/agents\/([^/?]+)$/)
      if (agentMatch) {
        const agent = getAgent(decodeURIComponent(agentMatch[1]))
        return agent ? send(response, 200, agent, origin) : send(response, 404, { detail: 'Assistant not found.' }, origin)
      }

      if (request.method === 'POST' && request.url === '/ask/stream') {
        const input = await readJson(request)
        if (input?.agent_id === 'general') {
          const question = String(input.question || '').trim()
          if (!question) return send(response, 400, { detail: 'A question is required.' }, origin)
          const result = await generateTextWithProviders(
            `You are the General Assistant in Lampstand Project. Give a clear, concise, helpful answer.\n\n${question}`,
            config,
          )
          return sendNdjson(response, [
            { type: 'metadata', agent_id: 'general', category: 'General', model: result.model, grounded: false, source_count: 0, sources: [] },
            { type: 'chunk', content: result.text },
            { type: 'done', grounded: false, completed: true },
          ], origin)
        }
        if (input?.agent_id === 'school') {
          const question = String(input.question || '').trim()
          if (!question) return send(response, 400, { detail: 'A question is required.' }, origin)
          const school = await answerSchoolQuestion(question, config)
          if (!school.grounded) return sendNdjson(response, [
            { type: 'metadata', agent_id: 'school', category: 'School', model: school.model, grounded: false, source_count: 0, sources: [] },
            { type: 'chunk', content: school.text },
            { type: 'done', grounded: false, completed: true },
          ], origin)
          let result
          try {
            result = await generateTextWithProviders(school.prompt, config)
          } catch {
            const excerpts = school.sources.slice(0, 3).map((source, index) => `[${index + 1}] ${source.citation}`).join('\n')
            result = { model: 'Local School Library', text: `I found relevant material in the indexed School library, but the local language model is not running. Open these sources for the exact lesson content:\n\n${excerpts}` }
          }
          return sendNdjson(response, [
            { type: 'metadata', agent_id: 'school', category: 'School', model: result.model, grounded: true, source_count: school.sources.length, sources: school.sources },
            { type: 'chunk', content: result.text },
            { type: 'done', grounded: true, completed: true },
          ], origin)
        }
        return await proxyLegacyJson('/ask/stream', input, response, origin)
      }

      if (request.method === 'GET' && request.url.startsWith('/knowledge/search?')) {
        const params = new URL(request.url, `http://${request.headers.host}`).searchParams
        return send(response, 200, await searchLocalKnowledge({
          query: params.get('q') || '', category: params.get('category') || '',
          topK: Number(params.get('top_k') || 10), includeText: params.get('include_text') === 'true',
        }, config), origin)
      }


      if (request.method === 'GET' && request.url === '/language/providers') {
        const [ollama, whisper] = await Promise.all([
          providerAvailable(`${config.ollamaUrl}/api/tags`),
          providerAvailable(`${config.whisperUrl}/health`),
        ])
        return send(response, 200, {
          mode: config.providerMode,
          providers: {
            ollama: { configured: true, available: ollama },
            whisper: { configured: true, available: whisper },
            gemini: { configured: Boolean(config.geminiApiKey), available: Boolean(config.geminiApiKey) },
            openai: { configured: Boolean(config.openaiApiKey), available: Boolean(config.openaiApiKey) },
            anthropic: { configured: Boolean(config.anthropicApiKey), available: Boolean(config.anthropicApiKey) },
            pronunciation: { configured: true, available: true, languages: ['mr', 'te', 'ml'] },
          },
        }, origin)
      }

      if (request.method === 'POST' && request.url === '/language/pronounce') {
        const input = await readJson(request)
        if (!supportsOnlinePronunciation(input.language)) return send(response, 400, { detail: 'No online pronunciation fallback is configured for this language.' }, origin)
        const result = await createOnlinePronunciation(input, config)
        return sendAudio(response, 200, result.audio, origin, { 'X-AIOS-Voice': result.voice, 'X-AIOS-Provider': result.provider })
      }

      if (request.method === 'GET' && request.url === '/media/providers') {
        const [comfy, aceStep, speech, wan] = await Promise.all([
          providerAvailable(`${config.comfyUrl}/system_stats`),
          aceStepAvailable(),
          providerAvailable(`${config.ttsUrl}/gradio_api/info`),
          providerAvailable(config.wanUrl),
        ])
        return send(response, 200, { providers: {
          comfy: { configured: true, available: comfy },
          aceStep: { configured: true, available: aceStep },
          speech: { configured: true, available: speech },
          wan: { configured: true, available: wan },
        } }, origin)
      }

      if (request.method === 'POST' && request.url === '/knowledge/upload') {
        const declaredSize = Number(request.headers['content-length'] || 0)
        if (declaredSize > config.maxKnowledgeBytes + 1024 * 1024) return send(response, 413, { detail: 'The selected knowledge file is too large.' }, origin)
        return send(response, 201, await saveKnowledgeUpload(await readForm(request), config), origin)
      }

      if (request.method === 'GET' && request.url.startsWith('/knowledge/subcollections?')) {
        const params = new URL(request.url, `http://${request.headers.host}`).searchParams
        const category = params.get('category') || ''
        const parent = params.get('parent') || ''
        return send(response, 200, { category, parent: parent || null, subcollections: await listKnowledgeSubcollections(category, parent, config) }, origin)
      }

      if (request.method === 'GET' && request.url === '/knowledge/sources') {
        return send(response, 200, { sources: await listKnowledgeSources(config) }, origin)
      }

      if (request.method === 'GET' && request.url === '/knowledge') {
        return send(response, 200, await readKnowledgeLibrary(config), origin)
      }

      const knowledgeUrl = new URL(request.url, `http://${request.headers.host}`)
      const outlineMatch = request.method === 'GET' && knowledgeUrl.pathname.match(/^\/knowledge\/([^/]+)\/([^/]+)\/outline$/)
      if (outlineMatch) {
        return send(response, 200, await readKnowledgeOutline(
          decodeURIComponent(outlineMatch[1]), decodeURIComponent(outlineMatch[2]), config,
        ), origin)
      }

      const contextMatch = request.method === 'GET' && knowledgeUrl.pathname.match(/^\/knowledge\/([^/]+)\/([^/]+)\/viewer\/(\d+)\/context$/)
      if (contextMatch) {
        return send(response, 200, await readKnowledgeContext(
          decodeURIComponent(contextMatch[1]), decodeURIComponent(contextMatch[2]), contextMatch[3],
          knowledgeUrl.searchParams.get('radius'), config,
        ), origin)
      }

      const viewerMatch = request.method === 'GET' && knowledgeUrl.pathname.match(/^\/knowledge\/([^/]+)\/([^/]+)\/viewer\/(\d+)$/)
      if (viewerMatch) {
        return send(response, 200, await readKnowledgeViewer(
          decodeURIComponent(viewerMatch[1]), decodeURIComponent(viewerMatch[2]), viewerMatch[3], config,
        ), origin)
      }

      if (request.method === 'GET' && request.url.startsWith('/knowledge/source/preview?')) {
        const params = new URL(request.url, `http://${request.headers.host}`).searchParams
        return sendPreview(response, await readKnowledgePreview(params.get('path'), config), origin)
      }

      if (request.method === 'PATCH' && request.url === '/knowledge/source') {
        return send(response, 200, await updateKnowledgeSource(await readJson(request), config), origin)
      }

      if (request.method === 'GET' && request.url === '/knowledge/health') {
        return send(response, 200, await inspectKnowledgeHealth(config), origin)
      }

      if (request.method === 'GET' && request.url === '/hymnal/library') {
        return send(response, 200, await readHymnalLibrary(config), origin)
      }

      if (request.method === 'GET' && request.url === '/hwmr/library') {
        return send(response, 200, await readHwmrLibrary(config), origin)
      }

      if (request.method === 'POST' && request.url === '/hwmr/refresh') {
        return send(response, 200, await refreshHwmrLibrary(config), origin)
      }

      if (request.method === 'GET' && request.url === '/recovery-bible/books') {
        return send(response, 200, { books: await listRecoveryBibleBooks(config) }, origin)
      }

      if (request.method === 'GET' && request.url.startsWith('/recovery-bible/chapter?')) {
        const params = new URL(request.url, `http://${request.headers.host}`).searchParams
        return send(response, 200, await readRecoveryBibleChapter(params.get('book'), params.get('chapter'), config), origin)
      }

      if (request.method === 'GET' && request.url.startsWith('/recovery-bible/book-matter?')) {
        const params = new URL(request.url, `http://${request.headers.host}`).searchParams
        return send(response, 200, await readRecoveryBibleBookMatter(params.get('book'), config), origin)
      }

      if (request.method === 'GET' && request.url.startsWith('/recovery-bible/book-outline?')) {
        const params = new URL(request.url, `http://${request.headers.host}`).searchParams
        return sendPreview(response, await readRecoveryBibleBookOutline(params.get('book'), config), origin)
      }

      if (request.method === 'GET' && request.url.startsWith('/recovery-bible/concordance?')) {
        const params = new URL(request.url, `http://${request.headers.host}`).searchParams
        return send(response, 200, await searchRecoveryBible(params.get('q'), params.get('limit'), config), origin)
      }

      if (request.method === 'GET' && request.url === '/life-study/books') {
        return send(response, 200, { books: await listLifeStudyBooks(config) }, origin)
      }

      if (request.method === 'GET' && request.url.startsWith('/life-study/messages?')) {
        const params = new URL(request.url, `http://${request.headers.host}`).searchParams
        return send(response, 200, { messages: await listLifeStudyMessages(params.get('book') || '', config) }, origin)
      }

      if (request.method === 'GET' && request.url.startsWith('/life-study/message?')) {
        const params = new URL(request.url, `http://${request.headers.host}`).searchParams
        return send(response, 200, await readLifeStudyMessage(params.get('book') || '', params.get('message'), config), origin)
      }

      if (request.method === 'GET' && request.url.startsWith('/life-study/search?')) {
        const params = new URL(request.url, `http://${request.headers.host}`).searchParams
        return send(response, 200, await searchLifeStudy(params.get('q'), params.get('limit'), config), origin)
      }

      if (request.method === 'GET' && request.url === '/ministry-books/library') {
        return send(response, 200, await readMinistryBooksLibrary(config), origin)
      }

      if (request.method === 'GET' && request.url.startsWith('/ministry-books/search?')) {
        const params = new URL(request.url, `http://${request.headers.host}`).searchParams
        return send(response, 200, await searchMinistryBooks(params.get('q'), params.get('limit'), config), origin)
      }

      if (request.method === 'GET' && request.url === '/ministry/library') {
        return send(response, 200, await readMinistryLibraryStatus(config), origin)
      }

      if (request.method === 'POST' && request.url === '/ministry/import') {
        const declaredSize = Number(request.headers['content-length'] || 0)
        if (declaredSize > config.maxKnowledgeBytes + 1024 * 1024) return send(response, 413, { detail: 'The selected export is too large.' }, origin)
        return send(response, 201, await importMinistryExports(await readForm(request), config), origin)
      }

      if (request.method === 'GET' && request.url.startsWith('/ministry-books/chapters?')) {
        const params = new URL(request.url, `http://${request.headers.host}`).searchParams
        return send(response, 200, await listMinistryBookChapters(params.get('book') || '', config), origin)
      }

      if (request.method === 'GET' && request.url.startsWith('/ministry-books/chapter?')) {
        const params = new URL(request.url, `http://${request.headers.host}`).searchParams
        return send(response, 200, await readMinistryBookChapter(params.get('book') || '', params.get('chapter'), config), origin)
      }

      if (request.method === 'POST' && request.url === '/hymnal/import-mirror') {
        return send(response, 201, await importConfiguredHymnal(await readJson(request), config), origin)
      }

      if (request.method === 'DELETE' && request.url === '/knowledge/source') {
        const body = await readJson(request)
        return send(response, 200, await trashKnowledgeSource(body?.relativePath, config), origin)
      }

      if (request.method === 'POST' && request.url === '/knowledge/index') {
        const status = await startKnowledgeIndex(config)
        return send(response, status.state === 'running' ? 202 : 200, status, origin)
      }

      if (request.method === 'GET' && request.url === '/knowledge/index/status') {
        return send(response, 200, getKnowledgeIndexStatus(), origin)
      }

      if (request.method === 'GET' && request.url === '/media/wan/videos') {
        return send(response, 200, { videos: listWanVideos(config) }, origin)
      }

      if (request.method === 'GET' && request.url.startsWith('/media/wan/files?')) {
        const allowedOrigin = config.allowedOrigins.includes(origin) ? origin : config.allowedOrigins[0]
        const name = new URL(request.url, `http://${request.headers.host}`).searchParams.get('name') || ''
        return await proxyWanFile(name, config, response, allowedOrigin)
      }

      if (request.method === 'GET' && request.url === '/services/status') {
        return send(response, 200, { ...(await getAiServicesStatus(config)), preferences: publicProviderPreferences(config) }, origin)
      }

      if (request.method === 'GET' && request.url === '/services/preferences') {
        return send(response, 200, publicProviderPreferences(config), origin)
      }

      if (request.method === 'PATCH' && request.url === '/services/preferences') {
        const body = await readJson(request)
        return send(response, 200, saveProviderPreferences(body, config), origin)
      }

      if (request.method === 'POST' && request.url === '/services/start') {
        return send(response, 202, await startAiServices(config), origin)
      }

      if (request.method === 'POST' && request.url === '/services/repair') {
        return send(response, 202, await repairAiServices(config), origin)
      }

      if (request.method === 'POST' && request.url === '/services/unload') {
        return send(response, 200, await unloadAiModels(config), origin)
      }

      if (request.method === 'POST' && request.url === '/language/translate') {
        const body = await readJson(request)
        if (!body?.text?.trim()) return send(response, 400, { detail: 'Text is required.' }, origin)
        const sourceLanguage = normalizeLanguageCode(body.sourceLanguage, 'auto')
        const targetLanguage = normalizeLanguageCode(body.targetLanguage)
        if (!(sourceLanguage === 'auto' || supportedLanguages.has(sourceLanguage)) || !supportedLanguages.has(targetLanguage)) {
          return send(response, 400, { detail: 'Unsupported source or target language.' }, origin)
        }
        const result = await translateWithProviders({
          text: body.text.trim(), sourceLanguage, targetLanguage,
        }, config)
        return send(response, 200, result, origin)
      }

      if (request.method === 'POST' && request.url === '/language/transliterate') {
        const body = await readJson(request)
        const language = normalizeLanguageCode(body?.language)
        if (!body?.text?.trim() || !supportedLanguages.has(language)) return send(response, 400, { detail: 'Text and a supported language are required.' }, origin)
        const result = await generateTextWithProviders(`Write the following ${language} text phonetically using English (Latin) letters so an English reader can pronounce it. Preserve paragraph and line breaks. Do not translate its meaning and return only the romanized pronunciation.\n\n${body.text.trim()}`, config)
        return send(response, 200, { transliteration: result.text, provider: result.provider, model: result.model }, origin)
      }

      if (request.method === 'POST' && request.url === '/language/transcribe') {
        const declaredSize = Number(request.headers['content-length'] || 0)
        if (declaredSize > config.maxAudioBytes) return send(response, 413, { detail: 'Audio file is too large.' }, origin)
        const form = await readForm(request)
        const file = form.get('file')
        const language = normalizeLanguageCode(form.get('language'))
        if (!file || typeof file === 'string') return send(response, 400, { detail: 'Audio file is required.' }, origin)
        if (!supportedLanguages.has(language)) return send(response, 400, { detail: 'Unsupported transcription language.' }, origin)
        if (file.size > config.maxAudioBytes) return send(response, 413, { detail: 'Audio file is too large.' }, origin)
        return send(response, 200, await transcribeWithProviders(file, language, config), origin)
      }

      if (request.method === 'POST' && request.url === '/language/translate-document') {
        const declaredSize=Number(request.headers['content-length']||0)
        if (declaredSize>config.maxDocumentBytes+1024*1024) return send(response,413,{detail:'Document is larger than the 50 MB limit.'},origin)
        const form=await readForm(request)
        const sourceLanguage=normalizeLanguageCode(form.get('sourceLanguage'),'auto'); const targetLanguage=normalizeLanguageCode(form.get('targetLanguage'))
        if (!(sourceLanguage==='auto'||supportedLanguages.has(sourceLanguage))||!supportedLanguages.has(targetLanguage)) return send(response,400,{detail:'Unsupported source or target language.'},origin)
        return sendFile(response,await translateDocument(form,config),origin)
      }

      if (request.method === 'POST' && request.url === '/media/generate') {
        return send(response, 202, await createMediaGeneration(await readJson(request), config), origin)
      }

      if (request.method === 'GET' && request.url === '/media/generations') {
        return send(response, 200, { generations: listMediaGenerations(config) }, origin)
      }

      const cancelMediaMatch = request.method === 'POST' && request.url.match(/^\/media\/generations\/([^?]+)\/cancel$/)
      if (cancelMediaMatch) {
        const job = cancelMediaGeneration(decodeURIComponent(cancelMediaMatch[1]), config)
        return job ? send(response, 200, job, origin) : send(response, 404, { detail: 'Media generation not found.' }, origin)
      }

      if (request.method === 'POST' && request.url === '/church/generate') {
        const body = await readJson(request)
        const prompt = body?.prompt?.trim()
        if (!prompt) return send(response, 400, { detail: 'A generation prompt is required.' }, origin)
        if (prompt.length > 30000) return send(response, 413, { detail: 'The Church generation request is too large.' }, origin)
        return send(response, 200, await generateTextWithProviders(prompt, config), origin)
      }

      const mediaMatch = request.method === 'GET' && request.url.match(/^\/media\/generations\/([^?]+)$/)
      if (mediaMatch) {
        const job = await getMediaGeneration(decodeURIComponent(mediaMatch[1]), config)
        return job ? send(response, 200, job, origin) : send(response, 404, { detail: 'Media generation not found.' }, origin)
      }

      if (request.method === 'GET' && request.url.startsWith('/media/files?')) {
        const allowedOrigin = config.allowedOrigins.includes(origin) ? origin : config.allowedOrigins[0]
        return await proxyComfyFile(request.url.slice(request.url.indexOf('?') + 1), config, response, origin, allowedOrigin)
      }

      const audioMatch = request.method === 'GET' && request.url.match(/^\/media\/audio\/([^?]+)$/)
      if (audioMatch) {
        const allowedOrigin = config.allowedOrigins.includes(origin) ? origin : config.allowedOrigins[0]
        return await proxyAudioFile(decodeURIComponent(audioMatch[1]), config, response, allowedOrigin)
      }

      return await proxyLegacy(request, response, origin)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected server error.'
      const providerFailure = message.includes('provider succeeded')
      const legacyFailure = message.includes(config.legacyApiUrl)
      return send(response, error?.status || (providerFailure ? 503 : legacyFailure ? 502 : 500), { detail: message }, origin)
    }
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createAiosServer().listen(config.port, config.host, () => {
    console.log(`AIOS API listening at http://${config.host}:${config.port} (${config.providerMode} mode)`)
  })
}
