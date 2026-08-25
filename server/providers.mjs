const languageNames = {
  auto: 'automatically detected language', en: 'English', zh: 'Chinese', ta: 'Tamil',
  hi: 'Hindi', mr: 'Marathi', te: 'Telugu', ml: 'Malayalam', kn: 'Kannada', ru: 'Russian', ko: 'Korean',
}
const translationLanguageCodes = {
  en: 'en', zh: 'zh-CN', ta: 'ta-IN', hi: 'hi-IN', mr: 'mr-IN', te: 'te-IN', ml: 'ml-IN', kn: 'kn-IN', ru: 'ru-RU', ko: 'ko-KR',
}

async function requireOk(response, provider) {
  if (response.ok) return response
  const detail = await response.text()
  throw new Error(`${provider} returned ${response.status}${detail ? `: ${detail}` : ''}`)
}

function translationPrompt({ text, sourceLanguage, targetLanguage }) {
  if (sourceLanguage !== 'auto') {
    return `You are a professional ${languageNames[sourceLanguage]} (${translationLanguageCodes[sourceLanguage]}) to ${languageNames[targetLanguage]} (${translationLanguageCodes[targetLanguage]}) translator. ` +
      `Your goal is to accurately convey the meaning and nuances of the original ${languageNames[sourceLanguage]} text while adhering to ${languageNames[targetLanguage]} grammar, vocabulary, and cultural sensitivities. ` +
      `Preserve paragraph breaks, names, scripture references, and ministry terminology. Produce only the ${languageNames[targetLanguage]} translation, without any additional explanations or commentary. ` +
      `Please translate the following ${languageNames[sourceLanguage]} text into ${languageNames[targetLanguage]}:\n\n${text}`
  }
  return `Translate the following text from ${languageNames[sourceLanguage]} to ${languageNames[targetLanguage]}. ` +
    `Preserve meaning, paragraph breaks, names, and ministry terminology. Return only the translation.\n\n${text}`
}

export async function translateWithOllama(request, config, fetcher = fetch) {
  const models = [...new Set([config.ollamaTranslationModel, config.ollamaModel].filter(Boolean))]
  const errors = []
  for (const model of models) {
    try {
      const response = await fetcher(`${config.ollamaUrl}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, stream: false, think: false, options: { temperature: 0 }, messages: [{ role: 'user', content: translationPrompt(request) }] }),
        signal: AbortSignal.timeout(120000),
      })
      await requireOk(response, `Ollama (${model})`)
      const body = await response.json()
      const translatedText = body?.message?.content?.trim()
      if (!translatedText) throw new Error(`Ollama (${model}) returned an empty translation.`)
      return { ...request, translatedText, provider: 'ollama', model }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }
  throw new Error(errors.join(' '))
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

function cloudProviderOrder(config) {
  return [
    config.geminiApiKey && 'gemini',
    config.openaiApiKey && 'openai',
    config.anthropicApiKey && 'anthropic',
  ].filter(Boolean)
}

function providerOrder(config) {
  if (config.providerMode === 'local') return ['local']
  const cloud = cloudProviderOrder(config)
  if (config.providerMode === 'cloud' || config.providerMode === 'openai') return cloud
  return ['local', ...cloud]
}

async function generateWithGemini(prompt, config, fetcher) {
  if (!config.geminiApiKey) throw new Error('Gemini API key is not configured.')
  const url = `${config.geminiUrl}/models/${encodeURIComponent(config.geminiTextModel)}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`
  const response = await fetcher(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
    signal: AbortSignal.timeout(180000),
  })
  await requireOk(response, 'Gemini')
  const body = await response.json()
  const text = body?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim()
  if (!text) throw new Error('Gemini returned an empty response.')
  return { text, provider: 'gemini', model: config.geminiTextModel }
}

async function generateWithOpenAI(prompt, config, fetcher) {
  if (!config.openaiApiKey) throw new Error('OpenAI API key is not configured.')
  const response = await fetcher(`${config.openaiUrl}/responses`, {
    method: 'POST', headers: { Authorization: `Bearer ${config.openaiApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.openaiTextModel, input: prompt }), signal: AbortSignal.timeout(180000),
  })
  await requireOk(response, 'OpenAI')
  const body = await response.json()
  const text = body?.output_text?.trim() || body?.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text?.trim()
  if (!text) throw new Error('OpenAI returned an empty response.')
  return { text, provider: 'openai', model: config.openaiTextModel }
}

async function generateWithAnthropic(prompt, config, fetcher) {
  if (!config.anthropicApiKey) throw new Error('Anthropic API key is not configured.')
  const response = await fetcher(`${config.anthropicUrl}/messages`, {
    method: 'POST',
    headers: { 'x-api-key': config.anthropicApiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.anthropicTextModel, max_tokens: 4096, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(180000),
  })
  await requireOk(response, 'Anthropic')
  const body = await response.json()
  const text = body?.content?.filter((item) => item.type === 'text').map((item) => item.text || '').join('').trim()
  if (!text) throw new Error('Anthropic returned an empty response.')
  return { text, provider: 'anthropic', model: config.anthropicTextModel }
}

export async function translateWithProviders(request, config, fetcher = fetch) {
  const errors = []
  for (const provider of providerOrder(config)) {
    try {
      if (provider === 'local') return await translateWithOllama(request, config, fetcher)
      if (provider === 'openai') return await translateWithOpenAI(request, config, fetcher)
      const result = provider === 'gemini'
        ? await generateWithGemini(translationPrompt(request), config, fetcher)
        : await generateWithAnthropic(translationPrompt(request), config, fetcher)
      return { ...request, translatedText: result.text, provider: result.provider, model: result.model }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }
  throw new Error(`No translation provider succeeded. ${errors.join(' ')}`)
}

export async function generateTextWithProviders(prompt, config, fetcher = fetch) {
  const errors = []
  for (const provider of providerOrder(config)) {
    try {
      if (provider === 'local') {
        const response = await fetcher(`${config.ollamaUrl}/api/chat`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: config.ollamaModel, stream: false, think: false, messages: [{ role: 'user', content: prompt }] }),
          signal: AbortSignal.timeout(180000),
        })
        await requireOk(response, 'Ollama')
        const body = await response.json()
        const text = body?.message?.content?.trim()
        if (!text) throw new Error('Ollama returned an empty response.')
        return { text, provider: 'ollama', model: config.ollamaModel }
      }
      if (provider === 'gemini') return await generateWithGemini(prompt, config, fetcher)
      if (provider === 'anthropic') return await generateWithAnthropic(prompt, config, fetcher)
      return await generateWithOpenAI(prompt, config, fetcher)
    } catch (error) { errors.push(error instanceof Error ? error.message : String(error)) }
  }
  throw new Error(`No text provider succeeded. ${errors.join(' ')}`)
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
  const providers = config.providerMode === 'local' ? ['local']
    : config.providerMode === 'cloud' || config.providerMode === 'openai' ? (config.openaiApiKey ? ['openai'] : [])
      : ['local', ...(config.openaiApiKey ? ['openai'] : [])]
  for (const provider of providers) {
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
