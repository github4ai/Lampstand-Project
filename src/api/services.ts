import { AIOS_API_BASE_URL } from '../config/api'

export interface AiServiceStatus {
  enabled: boolean
  allReady: boolean
  automaticResourceManagement: boolean
  providers: Array<{ id: string; label: string; available: boolean; configured?: boolean; startable?: boolean }>
  started?: string[]
  errors?: Array<{ id: string; message: string }>
  preferences?: ProviderPreferences
}

export interface ProviderPreferences {
  mode: 'local' | 'hybrid' | 'cloud'
  openaiConfigured: boolean
  openaiTextModel: string
  openaiTranscriptionModel: string
  geminiConfigured: boolean
  geminiTextModel: string
  anthropicConfigured: boolean
  anthropicTextModel: string
  webSearchConfigured: boolean
}

async function request(path: string, method = 'GET', signal?: AbortSignal): Promise<AiServiceStatus> {
  const response = await fetch(`${AIOS_API_BASE_URL}${path}`, { method, signal })
  if (!response.ok) throw new Error(await response.text() || 'Unable to manage AI services.')
  return response.json() as Promise<AiServiceStatus>
}

export const getAiServicesStatus = (signal?: AbortSignal) => request('/services/status', 'GET', signal)
export const startAiServices = () => request('/services/start', 'POST')
export async function startAiService(id: string): Promise<AiServiceStatus> {
  const response = await fetch(`${AIOS_API_BASE_URL}/services/start`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
  })
  if (!response.ok) throw new Error(await response.text() || 'Unable to start that AI service.')
  return response.json() as Promise<AiServiceStatus>
}
export const repairAiServices = () => request('/services/repair', 'POST')
export const unloadAiModels = () => request('/services/unload', 'POST')

export async function getProviderPreferences(signal?: AbortSignal): Promise<ProviderPreferences> {
  const response = await fetch(`${AIOS_API_BASE_URL}/services/preferences`, { signal })
  if (!response.ok) throw new Error(await response.text() || 'Unable to load provider preferences.')
  return response.json() as Promise<ProviderPreferences>
}

export async function saveProviderPreferences(input: { mode: ProviderPreferences['mode']; openaiApiKey?: string; geminiApiKey?: string; anthropicApiKey?: string; tavilyApiKey?: string; openaiTextModel?: string; geminiTextModel?: string; anthropicTextModel?: string }): Promise<ProviderPreferences> {
  const response = await fetch(`${AIOS_API_BASE_URL}/services/preferences`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(await response.text() || 'Unable to save provider preferences.')
  return response.json() as Promise<ProviderPreferences>
}
