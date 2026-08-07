const languageNames = {
  auto: 'automatically detected language', en: 'English', zh: 'Chinese', ta: 'Tamil',
  hi: 'Hindi', mr: 'Marathi', te: 'Telugu', ml: 'Malayalam',
}

async function requireOk(response, provider) {
  if (response.ok) return response
  const detail = await response.text()
  throw new Error(`${provider} returned ${response.status}${detail ? `: ${detail}` : ''}`)
}

function translationPrompt({ text, sourceLanguage, targetLanguage }) {
  return `Translate the following text from ${languageNames[sourceLanguage]} to ${languageNames[targetLanguage]}. ` +
    `Preserve meaning, paragraph breaks, names, and ministry terminology. Return only the translation.\n\n${text}`
}

export async function translateWithOllama(request, config, fetcher = fetch) {
  const response = await fetcher(`${config.ollamaUrl}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.ollamaModel, stream: false, think: false, messages: [{ role: 'user', content: translationPrompt(request) }] }),
    signal: AbortSignal.timeout(120000),
  })
  await requireOk(response, 'Ollama')
  const body = await response.json()
  const translatedText = body?.message?.content?.trim()
  if (!translatedText) throw new Error('Ollama returned an empty translation.')
  return { ...request, translatedText, provider: 'ollama' }
}

export async function translateWithOpenAI(request, config, fetcher = fetch) {
  if (!config.openaiApiKey) throw new Error('OPENAI_API_KEY is not configured.')
  const response = await fetcher(`${config.openaiUrl}/responses`, {
    method: 'POST', headers: { Authorization: `Bearer ${config.openaiApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.openaiTextModel, input: translationPrompt(request) }),
    signal: AbortSignal.timeout(120000),
  })
  await requireOk(response, 'OpenAI')
  const body = await response.json()
  const translatedText = body?.output_text?.trim() || body?.output?.flatMap((item) => item.content || [])
    .find((item) => item.type === 'output_text')?.text?.trim()
  if (!translatedText) throw new Error('OpenAI returned an empty translation.')
  return { ...request, translatedText, provider: 'openai' }
}

function providerOrder(config) {
  if (config.providerMode === 'local') return ['local']
  if (config.providerMode === 'openai') return ['openai']
  return ['local', 'openai']
}

export async function translateWithProviders(request, config, fetcher = fetch) {
  const errors = []
  for (const provider of providerOrder(config)) {
    try {
      return provider === 'local'
        ? await translateWithOllama(request, config, fetcher)
        : await translateWithOpenAI(request, config, fetcher)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }
  throw new Error(`No translation provider succeeded. ${errors.join(' ')}`)
}

async function transcribeAt(url, file, language, model, headers, provider, fetcher) {
  const body = new FormData()
  body.append('file', file, file.name || 'audio')
  body.append('model', model)
  body.append('language', language)
  const response = await fetcher(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(300000) })
  await requireOk(response, provider)
  const result = await response.json()
  if (!result?.text?.trim()) throw new Error(`${provider} returned an empty transcription.`)
  return { text: result.text.trim(), language, durationSeconds: result.duration, provider: provider.toLowerCase() }
}

export async function transcribeWithProviders(file, language, config, fetcher = fetch) {
  const errors = []
  for (const provider of providerOrder(config)) {
    try {
      if (provider === 'local') {
        return await transcribeAt(`${config.whisperUrl}/v1/audio/transcriptions`, file, language,
          config.whisperModel, {}, 'Local Whisper', fetcher)
      }
      if (!config.openaiApiKey) throw new Error('OPENAI_API_KEY is not configured.')
      return await transcribeAt(`${config.openaiUrl}/audio/transcriptions`, file, language,
        config.openaiTranscriptionModel, { Authorization: `Bearer ${config.openaiApiKey}` }, 'OpenAI', fetcher)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }
  throw new Error(`No transcription provider succeeded. ${errors.join(' ')}`)
}
