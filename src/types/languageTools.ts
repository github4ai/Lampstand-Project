export type SupportedLanguage = 'en' | 'zh' | 'ta' | 'hi' | 'mr' | 'te' | 'ml'

export interface TranslationRequest {
  text: string
  sourceLanguage: SupportedLanguage
  targetLanguage: SupportedLanguage
}

export interface TranslationResult extends TranslationRequest {
  translatedText: string
}

export interface TranscriptionResult {
  text: string
  language: SupportedLanguage
  durationSeconds?: number
}
