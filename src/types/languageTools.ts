export type SupportedLanguage = 'en' | 'zh' | 'ta' | 'hi' | 'mr' | 'te' | 'ml'
export type TranslationSourceLanguage = SupportedLanguage | 'auto'

export interface TranslationRequest {
  text: string
  sourceLanguage: TranslationSourceLanguage
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
