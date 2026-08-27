const languageNames = {
  auto: 'automatically detected language', en: 'English', zh: 'Chinese', ta: 'Tamil',
  hi: 'Hindi', mr: 'Marathi', te: 'Telugu', ml: 'Malayalam', kn: 'Kannada', kok: 'Konkani written only in Roman (English/Latin) letters', ru: 'Russian', ko: 'Korean',
}
const translationLanguageCodes = {
  en: 'en', zh: 'zh-CN', ta: 'ta-IN', hi: 'hi-IN', mr: 'mr-IN', te: 'te-IN', ml: 'ml-IN', kn: 'kn-IN', kok: 'kok-IN', ru: 'ru-RU', ko: 'ko-KR',
}

async function requireOk(response, provider) {
  if (response.ok) return response
  const detail = await response.text()
  throw new Error(`${provider} returned ${response.status}${detail ? `: ${detail}` : ''}`)
}

function translationPrompt({ text, sourceLanguage, targetLanguage }) {
  if (targetLanguage === 'kok') {
    return `Translate the complete source text into natural Konkani. Write Konkani ONLY in Roman English/Latin letters. Never use Devanagari, Kannada, or another Indic script. Translate every paragraph exactly once; never repeat a word, phrase, sentence, or paragraph merely to fill space. Preserve names, Scripture references, meaning, and paragraph breaks. Return only the translation.\n\nSOURCE (${languageNames[sourceLanguage]}):\n---\n${text}\n---\nEND SOURCE`
  }
  if (sourceLanguage !== 'auto') {
    return `You are a professional ${languageNames[sourceLanguage]} (${translationLanguageCodes[sourceLanguage]}) to ${languageNames[targetLanguage]} (${translationLanguageCodes[targetLanguage]}) translator. ` +
      `Your goal is to accurately convey the meaning and nuances of the original ${languageNames[sourceLanguage]} text while adhering to ${languageNames[targetLanguage]} grammar, vocabulary, and cultural sensitivities. ` +
      `Preserve paragraph breaks, names, scripture references, and ministry terminology. Translate every paragraph exactly once and do not repeat text. Produce only the ${languageNames[targetLanguage]} translation, without any additional explanations or commentary. ` +
      `Please translate the following ${languageNames[sourceLanguage]} text into ${languageNames[targetLanguage]}:\n\n${text}`
  }
  return `Translate the following text from ${languageNames[sourceLanguage]} to ${languageNames[targetLanguage]}. ` +
    `Preserve meaning, paragraph breaks, names, and ministry terminology. Translate every paragraph exactly once and never repeat text. Return only the translation.\n\n${text}`
}

function translationQualityError(text, request) {
  const words = String(text || '').toLowerCase().match(/[\p{L}\p{N}']+/gu) || []
  if (!words.length) return 'The model returned no translatable words.'
  let repeatedRun = 1
  for (let index = 1; index < words.length; index += 1) {
    repeatedRun = words[index] === words[index - 1] ? repeatedRun + 1 : 1
    if (repeatedRun >= 6) return 'The model produced a repeated-word loop.'
  }
  if (words.length >= 40 && new Set(words).size / words.length < 0.16) return 'The model produced excessively repetitive text.'
  const trigrams = new Map()
  for (let index = 0; index < words.length - 2; index += 1) {
    const key = words.slice(index, index + 3).join(' ')
    const count = (trigrams.get(key) || 0) + 1
    if (count >= 6) return 'The model repeated the same phrase too many times.'
    trigrams.set(key, count)
  }
  if (request.targetLanguage === 'kok' && /[\u0900-\u0d7f]/u.test(text)) return 'Konkani was not returned in Roman English letters.'
  return ''
}

export async function translateWithOllama(request, config, fetcher = fetch) {
  const configuredModels = [...new Set([config.ollamaTranslationModel, config.ollamaModel].filter(Boolean))]
  const normalizedModels = configuredModels.flatMap((m) => [
    m,
    m.replace(/^quen/i, 'qwen'),
    m.replace(/3:8b$/i, '3:8b'),
  ])
  const candidateModels = [...new Set(normalizedModels)]
  const errors = []

  const requestTimeout = request.targetLanguage === 'kok' ? 60000 : 120000
  for (const model of candidateModels) {
    try {
      const sourceWords = String(request.text || '').trim().split(/\s+/).filter(Boolean).length
      const response = await fetcher(`${config.ollamaUrl}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, stream: false, think: false, keep_alive: '10m', options: { temperature: 0.1, repeat_penalty: 1.22, num_ctx: 4096, num_predict: Math.min(1100, Math.max(160, Math.ceil(sourceWords * (request.targetLanguage === 'kok' ? 3 : 2.5)))) }, messages: [{ role: 'system', content: 'You are a careful professional translator. Never generate repetitive or looping text. Stop immediately after the complete translation.' }, { role: 'user', content: translationPrompt(request) }] }),
        signal: AbortSignal.timeout(requestTimeout),
      })
      await requireOk(response, `Ollama (${model})`)
      const body = await response.json()
      const translatedText = body?.message?.content?.trim()
      if (!translatedText) throw new Error(`Ollama (${model}) returned an empty translation.`)
      const qualityError = translationQualityError(translatedText, request)
      if (qualityError) throw new Error(`Ollama (${model}) translation rejected: ${qualityError}`)
      return { ...request, translatedText, provider: 'ollama', model }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }

  // Fallback: discover available models from Ollama /api/tags if candidate models failed
  if (config.ollamaUrl) {
    try {
      const tagsResponse = await fetcher(`${config.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(5000) })
      if (tagsResponse.ok) {
        const tagsData = await tagsResponse.json()
        const installedModels = (tagsData?.models || [])
          .map((m) => m?.name)
          .filter((name) => typeof name === 'string' && name && !/embed/i.test(name))

        for (const fallbackModel of installedModels.slice(0, request.targetLanguage === 'kok' ? 1 : 3)) {
          if (candidateModels.includes(fallbackModel)) continue
          try {
            const response = await fetcher(`${config.ollamaUrl}/api/chat`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: fallbackModel, stream: false, think: false, options: { temperature: 0 }, messages: [{ role: 'user', content: translationPrompt(request) }] }),
              signal: AbortSignal.timeout(requestTimeout),
            })
            if (response.ok) {
              const body = await response.json()
              const translatedText = body?.message?.content?.trim()
              if (translatedText && !translationQualityError(translatedText, request)) {
                return { ...request, translatedText, provider: 'ollama', model: fallbackModel }
              }
            }
          } catch (fallbackErr) {
            errors.push(fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr))
          }
        }
      }
    } catch { /* Tag discovery is optional fallback */ }
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
