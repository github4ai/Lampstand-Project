import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import { loadConfig } from './config.mjs'
import { transcribeWithProviders, translateWithProviders } from './providers.mjs'

const supportedLanguages = new Set(['en', 'zh', 'ta', 'hi', 'mr', 'te', 'ml'])
const config = loadConfig()

function send(response, status, body, origin = '') {
  const allowedOrigin = config.allowedOrigins.includes(origin) ? origin : config.allowedOrigins[0]
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  })
  response.end(JSON.stringify(body))
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
            openai: { configured: Boolean(config.openaiApiKey) },
          },
        }, origin)
      }

      if (request.method === 'POST' && request.url === '/language/translate') {
        const body = await readJson(request)
        if (!body?.text?.trim()) return send(response, 400, { detail: 'Text is required.' }, origin)
        if (!(body.sourceLanguage === 'auto' || supportedLanguages.has(body.sourceLanguage)) || !supportedLanguages.has(body.targetLanguage)) {
          return send(response, 400, { detail: 'Unsupported source or target language.' }, origin)
        }
        const result = await translateWithProviders({
          text: body.text.trim(), sourceLanguage: body.sourceLanguage, targetLanguage: body.targetLanguage,
        }, config)
        return send(response, 200, result, origin)
      }

      if (request.method === 'POST' && request.url === '/language/transcribe') {
        const declaredSize = Number(request.headers['content-length'] || 0)
        if (declaredSize > config.maxAudioBytes) return send(response, 413, { detail: 'Audio file is too large.' }, origin)
        const form = await readForm(request)
        const file = form.get('file')
        const language = String(form.get('language') || '')
        if (!file || typeof file === 'string') return send(response, 400, { detail: 'Audio file is required.' }, origin)
        if (!supportedLanguages.has(language)) return send(response, 400, { detail: 'Unsupported transcription language.' }, origin)
        if (file.size > config.maxAudioBytes) return send(response, 413, { detail: 'Audio file is too large.' }, origin)
        return send(response, 200, await transcribeWithProviders(file, language, config), origin)
      }

      return send(response, 404, { detail: 'Endpoint not found.' }, origin)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected server error.'
      return send(response, message.includes('provider succeeded') ? 503 : 500, { detail: message }, origin)
    }
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createAiosServer().listen(config.port, config.host, () => {
    console.log(`AIOS API listening at http://${config.host}:${config.port} (${config.providerMode} mode)`)
  })
}
