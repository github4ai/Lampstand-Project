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
  }
}

export function saveProviderPreferences(input, config) {
  const mode = String(input?.mode || '')
  if (!MODES.has(mode)) throw new Error('Choose a valid provider mode.')
  config.providerMode = mode === 'openai' ? 'cloud' : mode
  if (typeof input.openaiApiKey === 'string') config.openaiApiKey = input.openaiApiKey.trim()
  if (typeof input.geminiApiKey === 'string') config.geminiApiKey = input.geminiApiKey.trim()
  if (typeof input.anthropicApiKey === 'string') config.anthropicApiKey = input.anthropicApiKey.trim()
  mkdirSync(dirname(config.providerPreferencesFile), { recursive: true })
  writeFileSync(config.providerPreferencesFile, JSON.stringify({
    mode: config.providerMode,
    openaiApiKey: config.openaiApiKey,
    geminiApiKey: config.geminiApiKey,
    anthropicApiKey: config.anthropicApiKey,
  }, null, 2), { encoding: 'utf8', mode: 0o600 })
  return publicProviderPreferences(config)
}
