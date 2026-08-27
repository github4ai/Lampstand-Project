import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const MODES = new Set(['local', 'hybrid', 'cloud', 'openai'])

export function loadProviderPreferences(config) {
  try {
    const saved = JSON.parse(readFileSync(config.providerPreferencesFile, 'utf8'))
    if (MODES.has(saved.mode)) config.providerMode = saved.mode
    if (typeof saved.openaiApiKey === 'string') config.openaiApiKey = saved.openaiApiKey.trim()
    if (typeof saved.geminiApiKey === 'string') config.geminiApiKey = saved.geminiApiKey.trim()
    if (typeof saved.anthropicApiKey === 'string') config.anthropicApiKey = saved.anthropicApiKey.trim()
    if (typeof saved.tavilyApiKey === 'string') config.tavilyApiKey = saved.tavilyApiKey.trim()
    if (typeof saved.openaiTextModel === 'string' && saved.openaiTextModel.trim()) config.openaiTextModel = saved.openaiTextModel.trim()
    if (typeof saved.geminiTextModel === 'string' && saved.geminiTextModel.trim()) {
      const savedGeminiModel = saved.geminiTextModel.trim()
      config.geminiTextModel = savedGeminiModel === 'gemini-2.5-flash' ? 'gemini-3.6-flash' : savedGeminiModel
    }
    if (typeof saved.anthropicTextModel === 'string' && saved.anthropicTextModel.trim()) config.anthropicTextModel = saved.anthropicTextModel.trim()
  } catch { /* First run or an unreadable optional preferences file. */ }
  return publicProviderPreferences(config)
}

export function publicProviderPreferences(config) {
  return {
    mode: config.providerMode === 'openai' ? 'cloud' : (MODES.has(config.providerMode) ? config.providerMode : 'hybrid'),
    openaiConfigured: Boolean(config.openaiApiKey),
    openaiTextModel: config.openaiTextModel,
    openaiTranscriptionModel: config.openaiTranscriptionModel,
    geminiConfigured: Boolean(config.geminiApiKey),
    geminiTextModel: config.geminiTextModel,
    anthropicConfigured: Boolean(config.anthropicApiKey),
    anthropicTextModel: config.anthropicTextModel,
    webSearchConfigured: Boolean(config.tavilyApiKey),
  }
}

export function saveProviderPreferences(input, config) {
  const mode = String(input?.mode || '')
  if (!MODES.has(mode)) throw new Error('Choose a valid provider mode.')
  config.providerMode = mode === 'openai' ? 'cloud' : mode
  if (typeof input.openaiApiKey === 'string') config.openaiApiKey = input.openaiApiKey.trim()
  if (typeof input.geminiApiKey === 'string') config.geminiApiKey = input.geminiApiKey.trim()
  if (typeof input.anthropicApiKey === 'string') config.anthropicApiKey = input.anthropicApiKey.trim()
  if (typeof input.tavilyApiKey === 'string') config.tavilyApiKey = input.tavilyApiKey.trim()
  if (typeof input.openaiTextModel === 'string' && input.openaiTextModel.trim()) config.openaiTextModel = input.openaiTextModel.trim()
  if (typeof input.geminiTextModel === 'string' && input.geminiTextModel.trim()) config.geminiTextModel = input.geminiTextModel.trim()
  if (typeof input.anthropicTextModel === 'string' && input.anthropicTextModel.trim()) config.anthropicTextModel = input.anthropicTextModel.trim()
  mkdirSync(dirname(config.providerPreferencesFile), { recursive: true })
  writeFileSync(config.providerPreferencesFile, JSON.stringify({
    mode: config.providerMode,
    openaiApiKey: config.openaiApiKey,
    geminiApiKey: config.geminiApiKey,
    anthropicApiKey: config.anthropicApiKey,
    tavilyApiKey: config.tavilyApiKey,
    openaiTextModel: config.openaiTextModel,
    geminiTextModel: config.geminiTextModel,
    anthropicTextModel: config.anthropicTextModel,
  }, null, 2), { encoding: 'utf8', mode: 0o600 })
  return publicProviderPreferences(config)
}
