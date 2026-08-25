export type SupportedLanguage = 'en' | 'zh' | 'ta' | 'hi' | 'mr' | 'te' | 'ml' | 'kn' | 'ru' | 'ko'
export type TranslationSourceLanguage = SupportedLanguage | 'auto'

export interface TranslationRequest {
  text: string
  sourceLanguage: TranslationSourceLanguage
  targetLanguage: SupportedLanguage
}

export interface TranslationResult extends TranslationRequest {
  translatedText: string
  provider?: string
  model?: string
}

export interface TranscriptionResult {
  text: string
  language: SupportedLanguage
  durationSeconds?: number
  provider?: string
  model?: string
}

export interface LanguageHistoryItem {
  id: string
  tool: 'translation' | 'transcription'
  input: string
  result: string
  sourceLanguage?: TranslationSourceLanguage
  targetLanguage?: SupportedLanguage
  audioLanguage?: SupportedLanguage
  favorite?: boolean
  provider?: string
  model?: string
  durationSeconds?: number
  createdAt: string
}

export interface LanguageProviderStatus {
  mode: string
  providers: {
    ollama: { configured: boolean; available: boolean }
    whisper: { configured: boolean; available: boolean }
    openai: { configured: boolean; available: boolean }
  }
}
