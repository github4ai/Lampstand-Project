import { ArrowLeftRight, Copy, Download, ExternalLink, FileAudio, FileText, History, Languages, LoaderCircle, Mic, RefreshCw, Search, Square, Star, Trash2, Upload, Volume2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import WorkspaceLayout from '../layouts/WorkspaceLayout'
import { createPronunciation, getLanguageProviderStatus, transcribeAudio, translateDocument, translateText, transliterateText } from '../api/languageTools'
import { uploadKnowledgeDocument } from '../services/knowledge'
import type { LanguageHistoryItem, LanguageProviderStatus, SupportedLanguage, TranslationSourceLanguage } from '../types/languageTools'
import '../styles/language-pronunciation.css'
import '../styles/language-document.css'

const LANGUAGE_HISTORY_KEY = 'aios-studio-language-history-v1'
const LANGUAGE_VOICE_PREFERENCES_KEY = 'aios-studio-language-voice-preferences-v1'
const LANGUAGE_VOICE_RATE_KEY = 'aios-studio-language-voice-rate-v1'
const LANGUAGE_AUTO_PRONOUNCE_KEY = 'aios-studio-language-auto-pronounce-v1'
const LANGUAGE_ONLINE_PRONUNCIATION_KEY = 'aios-studio-online-pronunciation-v1'
const LANGUAGE_DRAFT_KEY = 'aios-studio-language-draft-v1'
const MAX_AUDIO_BYTES = 25 * 1024 * 1024
const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024
const DOCUMENT_EXTENSIONS = new Set(['docx', 'pptx', 'ppt', 'pdf', 'txt', 'md', 'html', 'htm'])
type DirectoryHandle = FileSystemDirectoryHandle
type BatchIssue = { path: string; reason: string; kind: 'failed' | 'skipped' }

async function collectDocuments(directory: DirectoryHandle, path = ''): Promise<{ documents: Array<{ file: File; relativeDirectory: string }>; directories: string[] }> {
  const documents: Array<{ file: File; relativeDirectory: string }> = []; const directories: string[] = []
  for await (const [name, handle] of directory.entries()) {
    if (handle.kind === 'directory') {
      const childPath = path ? `${path}/${name}` : name; directories.push(childPath)
      const child = await collectDocuments(handle, childPath); documents.push(...child.documents); directories.push(...child.directories)
    }
    else if (DOCUMENT_EXTENSIONS.has(name.split('.').pop()?.toLowerCase() || '')) documents.push({ file: await handle.getFile(), relativeDirectory: path })
  }
  return { documents, directories }
}

async function destinationDirectory(root: DirectoryHandle, relativePath: string) {
  let current = root
  for (const name of relativePath.split('/').filter(Boolean)) current = await current.getDirectoryHandle(name, { create: true })
  return current
}

function translatedDocumentName(filename: string, language: SupportedLanguage) {
  const dot = filename.lastIndexOf('.')
  return dot > 0 ? `${filename.slice(0, dot)}-${language}${filename.slice(dot)}` : `${filename}-${language}`
}
const onlineFallbackLanguages = new Set<SupportedLanguage>(['en', 'zh', 'ta', 'hi', 'mr', 'te', 'ml', 'kn', 'kok', 'ru', 'ko'])
const onlineFallbackVoices: Partial<Record<SupportedLanguage, Array<{ name: string; label: string }>>> = {
  en: [{ name: 'en-IN-NeerjaNeural', label: 'Neerja (Female)' }, { name: 'en-IN-PrabhatNeural', label: 'Prabhat (Male)' }],
  zh: [{ name: 'zh-CN-XiaoxiaoNeural', label: 'Xiaoxiao (Female)' }, { name: 'zh-CN-YunxiNeural', label: 'Yunxi (Male)' }],
  hi: [{ name: 'hi-IN-SwaraNeural', label: 'Swara (Female)' }, { name: 'hi-IN-MadhurNeural', label: 'Madhur (Male)' }],
  kn: [{ name: 'kn-IN-SapnaNeural', label: 'Sapna (Female)' }, { name: 'kn-IN-GaganNeural', label: 'Gagan (Male)' }],
  kok: [{ name: 'en-IN-NeerjaNeural', label: 'Neerja—Roman Konkani (Female)' }, { name: 'en-IN-PrabhatNeural', label: 'Prabhat—Roman Konkani (Male)' }],
  ko: [{ name: 'ko-KR-SunHiNeural', label: 'SunHi (Female)' }, { name: 'ko-KR-InJoonNeural', label: 'InJoon (Male)' }],
  ml: [{ name: 'ml-IN-SobhanaNeural', label: 'Sobhana (Female)' }, { name: 'ml-IN-MidhunNeural', label: 'Midhun (Male)' }],
  mr: [{ name: 'mr-IN-AarohiNeural', label: 'Aarohi (Female)' }, { name: 'mr-IN-ManoharNeural', label: 'Manohar (Male)' }],
  ru: [{ name: 'ru-RU-SvetlanaNeural', label: 'Svetlana (Female)' }, { name: 'ru-RU-DmitryNeural', label: 'Dmitry (Male)' }],
  ta: [{ name: 'ta-IN-PallaviNeural', label: 'Pallavi (Female)' }, { name: 'ta-IN-ValluvarNeural', label: 'Valluvar (Male)' }],
  te: [{ name: 'te-IN-ShrutiNeural', label: 'Shruti (Female)' }, { name: 'te-IN-MohanNeural', label: 'Mohan (Male)' }],
}

function loadHistory(): LanguageHistoryItem[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(LANGUAGE_HISTORY_KEY) ?? '[]')
    return Array.isArray(value) ? value.slice(0, 100) as LanguageHistoryItem[] : []
  } catch {
    return []
  }
}

const languages: Array<{ code: SupportedLanguage; label: string }> = [
  { code: 'zh', label: 'Chinese' }, { code: 'en', label: 'English' }, { code: 'hi', label: 'Hindi' },
  { code: 'kn', label: 'Kannada' }, { code: 'kok', label: 'Konkani' }, { code: 'ko', label: 'Korean' },
  { code: 'ml', label: 'Malayalam' }, { code: 'mr', label: 'Marathi' }, { code: 'ru', label: 'Russian' },
  { code: 'ta', label: 'Tamil' }, { code: 'te', label: 'Telugu' },
]

function languageLabel(code?: TranslationSourceLanguage) {
  if (!code) return 'Language not recorded'
  if (code === 'auto') return 'Auto-detected'
  return languages.find((language) => language.code === code)?.label || code
}

const speechLocales: Record<SupportedLanguage, string> = {
  en: 'en-IN', zh: 'zh-CN', ta: 'ta-IN', hi: 'hi-IN', mr: 'mr-IN',
  te: 'te-IN', ml: 'ml-IN', kn: 'kn-IN', kok: 'en-IN', ru: 'ru-RU', ko: 'ko-KR',
}

const voiceTestPhrases: Record<SupportedLanguage, string> = {
  en: 'Hello. The pronunciation voice is ready.', zh: '你好。语音已准备好。', ta: 'வணக்கம். உச்சரிப்பு குரல் தயாராக உள்ளது.',
  hi: 'नमस्ते। उच्चारण की आवाज़ तैयार है।', mr: 'नमस्कार. उच्चाराचा आवाज तयार आहे.', te: 'నమస్కారం. ఉచ్చారణ స్వరం సిద్ధంగా ఉంది.',
  ml: 'നമസ്കാരം. ഉച്ചാരണ ശബ്ദം തയ്യാറാണ്.', ru: 'Здравствуйте. Голос для произношения готов.', ko: '안녕하세요. 발음 음성이 준비되었습니다.',
  kn: 'ನಮಸ್ಕಾರ. ಉಚ್ಚಾರಣೆಯ ಧ್ವನಿ ಸಿದ್ಧವಾಗಿದೆ.',
  kok: 'Namaskar. Ucharacho avaz toyar asa.',
}

function matchingSpeechVoices(voices: SpeechSynthesisVoice[], language: SupportedLanguage) {
  const locale = speechLocales[language].toLowerCase()
  const exact = voices.filter((voice) => voice.lang.toLowerCase() === locale)
  if (exact.length) return exact
  if (language === 'kok') return voices.filter((voice) => voice.lang.toLowerCase().startsWith('en-'))
  return voices.filter((voice) => voice.lang.toLowerCase().startsWith(`${language.toLowerCase()}-`))
}

function findSpeechVoice(voices: SpeechSynthesisVoice[], language: SupportedLanguage, preferredName = '') {
  const matches = matchingSpeechVoices(voices, language)
  return matches.find((voice) => voice.name === preferredName) || matches[0]
}

function loadVoicePreferences(): Partial<Record<SupportedLanguage, string>> {
  try { return JSON.parse(localStorage.getItem(LANGUAGE_VOICE_PREFERENCES_KEY) || '{}') } catch { return {} }
}

function LanguageSelect({ value, onChange, label, allowAuto = false }: {
  value: TranslationSourceLanguage; onChange: (value: SupportedLanguage) => void; label: string; allowAuto?: boolean
}) {
  return <label>{label}<select value={value}
    onChange={(event) => onChange(event.target.value as SupportedLanguage)}>
    {allowAuto && <option value="auto">Detect automatically</option>}
    {languages.map((language) => <option value={language.code} key={language.code}>{language.label}</option>)}
  </select></label>
}

function LanguageToolsPage() {
  const savedDraft = (() => { try { return JSON.parse(localStorage.getItem(LANGUAGE_DRAFT_KEY) || '{}') as Record<string, string> } catch { return {} } })()
  const location = useLocation()
  const navigate = useNavigate()
  const [tool, setTool] = useState<'translation' | 'transcription' | 'document'>('translation')
  const [sourceLanguage, setSourceLanguage] = useState<TranslationSourceLanguage>((savedDraft.sourceLanguage as TranslationSourceLanguage) || 'auto')
  const [targetLanguage, setTargetLanguage] = useState<SupportedLanguage>((savedDraft.targetLanguage as SupportedLanguage) || 'ml')
  const [text, setText] = useState(savedDraft.text || '')
  const [audioLanguage, setAudioLanguage] = useState<SupportedLanguage>('en')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [documentResult, setDocumentResult] = useState<{ url: string; filename: string; fidelity: string; segments: number; blob: Blob } | null>(null)
  const [knowledgeSaveStatus, setKnowledgeSaveStatus] = useState('')
  const [documentMode, setDocumentMode] = useState<'file' | 'folder'>('file')
  const [sourceFolder, setSourceFolder] = useState<DirectoryHandle | null>(null)
  const [destinationFolder, setDestinationFolder] = useState<DirectoryHandle | null>(null)
  const [folderDocuments, setFolderDocuments] = useState<Array<{ file: File; relativeDirectory: string }>>([])
  const [sourceSubfolders, setSourceSubfolders] = useState<string[]>([])
  const [documentNaming, setDocumentNaming] = useState<'suffix' | 'original'>('suffix')
  const [documentConflict, setDocumentConflict] = useState<'overwrite' | 'skip'>('overwrite')
  const [batchProgress, setBatchProgress] = useState<{ completed: number; total: number; current: string; issues: BatchIssue[] }>({ completed: 0, total: 0, current: '', issues: [] })
  const [batchPaused, setBatchPaused] = useState(false)
  const [result, setResult] = useState(savedDraft.result || '')
  const [transliteration, setTransliteration] = useState(savedDraft.transliteration || '')
  const [resultProvider, setResultProvider] = useState('')
  const [resultModel, setResultModel] = useState('')
  const [resultDuration, setResultDuration] = useState<number | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<LanguageHistoryItem[]>(loadHistory)
  const [historyQuery, setHistoryQuery] = useState('')
  const [historyTool, setHistoryTool] = useState<'all' | 'favorites' | 'translation' | 'transcription'>('all')
  const [providerStatus, setProviderStatus] = useState<LanguageProviderStatus | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [audioPreviewUrl, setAudioPreviewUrl] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const [pronunciationVoice, setPronunciationVoice] = useState('')
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceRefreshNotice, setVoiceRefreshNotice] = useState('')
  const [voicePreferences, setVoicePreferences] = useState(loadVoicePreferences)
  const [speechRate, setSpeechRate] = useState(() => Number(localStorage.getItem(LANGUAGE_VOICE_RATE_KEY)) || 0.9)
  const [autoPronounce, setAutoPronounce] = useState(() => localStorage.getItem(LANGUAGE_AUTO_PRONOUNCE_KEY) === 'true')
  const [onlinePronunciation, setOnlinePronunciation] = useState(() => localStorage.getItem(LANGUAGE_ONLINE_PRONUNCIATION_KEY) !== 'false')
  const [selectedResultText, setSelectedResultText] = useState('')
  const [downloadingPronunciation, setDownloadingPronunciation] = useState(false)
  const [downloadingHistoryId, setDownloadingHistoryId] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const requestControllerRef = useRef<AbortController | null>(null)
  const historyImportRef = useRef<HTMLInputElement | null>(null)
  const recordingChunksRef = useRef<Blob[]>([])
  const fallbackAudioRef = useRef<HTMLAudioElement | null>(null)
  const fallbackAudioUrlRef = useRef('')
  const pauseBatchRef = useRef(false)

  useEffect(() => {
    localStorage.setItem(LANGUAGE_DRAFT_KEY, JSON.stringify({ text, result, transliteration, sourceLanguage, targetLanguage }))
  }, [text, result, transliteration, sourceLanguage, targetLanguage])

  useEffect(() => {
    const controller = new AbortController()
    void getLanguageProviderStatus(controller.signal).then(setProviderStatus).catch(() => setProviderStatus(null))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const state = location.state as { languageDraft?: { text?: string; sourceLanguage?: string } } | null
    const draft = state?.languageDraft
    if (!draft?.text) return
    setTool('translation')
    setText(draft.text)
    const supported = languages.some((language) => language.code === draft.sourceLanguage)
    setSourceLanguage(supported ? draft.sourceLanguage as SupportedLanguage : 'auto')
    setResult('')
    setError('')
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  useEffect(() => () => {
    requestControllerRef.current?.abort()
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop())
    window.speechSynthesis?.cancel()
    fallbackAudioRef.current?.pause()
    if (fallbackAudioUrlRef.current) URL.revokeObjectURL(fallbackAudioUrlRef.current)
  }, [])

  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const refreshVoices = () => setSpeechVoices(window.speechSynthesis.getVoices())
    refreshVoices()
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', refreshVoices)
  }, [])

  useEffect(() => {
    if (!recording) return
    const timer = window.setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000)
    return () => window.clearInterval(timer)
  }, [recording])

  useEffect(() => {
    if (!audioFile) { setAudioPreviewUrl(''); return }
    const url = URL.createObjectURL(audioFile)
    setAudioPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [audioFile])

  function formatRecordingTime(seconds: number) {
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  }

  async function startRecording() {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Microphone recording is not supported by this browser.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const preferredType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined)
      recordingChunksRef.current = []
      recorder.ondataavailable = (event) => { if (event.data.size) recordingChunksRef.current.push(event.data) }
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm'
        const extension = mimeType.includes('ogg') ? 'ogg' : 'webm'
        const blob = new Blob(recordingChunksRef.current, { type: mimeType })
        setAudioFile(new File([blob], `recording-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`, { type: mimeType }))
        recorder.stream.getTracks().forEach((track) => track.stop())
        setRecording(false)
      }
      recorderRef.current = recorder
      recorder.start()
      setRecordingSeconds(0)
      setRecording(true)
    } catch {
      setError('Microphone access was not granted.')
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  function saveHistory(item: Omit<LanguageHistoryItem, 'id' | 'createdAt'>) {
    const newItem = { ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
    const favorites = history.filter((entry) => entry.favorite)
    const recent = history.filter((entry) => !entry.favorite).slice(0, 19)
    const next = [newItem, ...favorites, ...recent]
    setHistory(next)
    localStorage.setItem(LANGUAGE_HISTORY_KEY, JSON.stringify(next))
  }

  function toggleHistoryFavorite(id: string) {
    const next = history.map((item) => item.id === id ? { ...item, favorite: !item.favorite } : item)
    setHistory(next)
    localStorage.setItem(LANGUAGE_HISTORY_KEY, JSON.stringify(next))
  }

  function removeHistory(id: string) {
    const next = history.filter((item) => item.id !== id)
    setHistory(next)
    localStorage.setItem(LANGUAGE_HISTORY_KEY, JSON.stringify(next))
  }

  function clearHistory() {
    if (!window.confirm('Clear all saved translation and transcription results?')) return
    setHistory([])
    localStorage.removeItem(LANGUAGE_HISTORY_KEY)
  }

  async function copyHistoryResult(item: LanguageHistoryItem) {
    try {
      await navigator.clipboard.writeText(item.result)
      setVoiceRefreshNotice('Saved result copied to the clipboard.')
    } catch {
      setError('Unable to copy this saved result.')
    }
  }

  function downloadHistoryText(item: LanguageHistoryItem) {
    const blob = new Blob([item.result], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = item.tool === 'translation' ? 'saved-translation.txt' : 'saved-transcription.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  function restoreHistory(item: LanguageHistoryItem) {
    setTool(item.tool)
    setResult(item.result)
    setError('')
    setResultProvider(item.provider || '')
    setResultModel(item.model || '')
    setResultDuration(item.durationSeconds)
    if (item.tool === 'translation') {
      setText(item.input)
      if (item.sourceLanguage) setSourceLanguage(item.sourceLanguage)
      if (item.targetLanguage) setTargetLanguage(item.targetLanguage)
    } else if (item.audioLanguage) {
      setAudioLanguage(item.audioLanguage)
    }
  }

  function exportHistory() {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), items: history }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `aios-language-history-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function importHistory(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as { items?: LanguageHistoryItem[] } | LanguageHistoryItem[]
      const items = Array.isArray(parsed) ? parsed : parsed.items
      if (!Array.isArray(items)) throw new Error('This is not an AIOS Language Tools history backup.')
      const valid = items.filter((item) => item && typeof item.id === 'string' && typeof item.result === 'string' && (item.tool === 'translation' || item.tool === 'transcription'))
      const merged = [...valid, ...history.filter((current) => !valid.some((incoming) => incoming.id === current.id))].slice(0, 100)
      setHistory(merged)
      localStorage.setItem(LANGUAGE_HISTORY_KEY, JSON.stringify(merged))
      setVoiceRefreshNotice(`${valid.length} saved language result${valid.length === 1 ? '' : 's'} restored.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to restore Language Tools history.')
    } finally {
      if (historyImportRef.current) historyImportRef.current.value = ''
    }
  }

  function chooseAudioFile(file: File | null) {
    setError('')
    if (!file) { setAudioFile(null); return }
    if (file.size > MAX_AUDIO_BYTES) { setAudioFile(null); setError('Audio files must be 25 MB or smaller.'); return }
    if (file.type && !file.type.startsWith('audio/')) { setAudioFile(null); setError('Choose a supported audio file.'); return }
    setAudioFile(file)
  }

  function swapLanguages() {
    if (sourceLanguage === 'auto') return
    setSourceLanguage(targetLanguage)
    setTargetLanguage(sourceLanguage)
    setText(result || text)
    setResult('')
  }

  function downloadResult() {
    const blob = new Blob([result], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = tool === 'translation' ? 'translation.txt' : 'transcription.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function downloadPronunciation() {
    if (!result.trim() || downloadingPronunciation) return
    const language = tool === 'translation' ? targetLanguage : audioLanguage
    if (!onlinePronunciation || !onlineFallbackLanguages.has(language)) return
    setDownloadingPronunciation(true); setError('')
    try {
      const response = await createPronunciation(result, language, speechRate, voicePreferences[language])
      const url = URL.createObjectURL(response.audio)
      const link = document.createElement('a')
      link.href = url
      link.download = `${languages.find((item) => item.code === language)?.label.toLowerCase() || language}-pronunciation.mp3`
      link.click()
      URL.revokeObjectURL(url)
      setPronunciationVoice(`${response.voice} · ${response.provider}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to download pronunciation audio.')
    } finally {
      setDownloadingPronunciation(false)
    }
  }

  function historyLanguage(item: LanguageHistoryItem): SupportedLanguage | null {
    return item.tool === 'translation' ? item.targetLanguage || null : item.audioLanguage || null
  }

  async function downloadHistoryPronunciation(item: LanguageHistoryItem) {
    const language = historyLanguage(item)
    if (!language || !item.result.trim() || downloadingHistoryId) return
    setDownloadingHistoryId(item.id); setError('')
    try {
      const response = await createPronunciation(item.result, language, speechRate, voicePreferences[language])
      const url = URL.createObjectURL(response.audio)
      const link = document.createElement('a')
      link.href = url
      link.download = `${languages.find((entry) => entry.code === language)?.label.toLowerCase() || language}-pronunciation.mp3`
      link.click()
      URL.revokeObjectURL(url)
      setPronunciationVoice(`${response.voice} · ${response.provider}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to download pronunciation audio.')
    } finally {
      setDownloadingHistoryId('')
    }
  }

  function translateTranscription() {
    if (!result.trim()) return
    setText(result)
    setSourceLanguage(audioLanguage)
    setTool('translation')
    setResult('')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function createSpeechAudio() {
    if (!result.trim()) return
    navigate('/media', { state: { mediaDraft: {
      kind: 'audio', prompt: result, audioMode: 'speech',
      language: tool === 'translation' ? targetLanguage : audioLanguage,
    } } })
  }

  function stopPronunciation() {
    window.speechSynthesis?.cancel()
    fallbackAudioRef.current?.pause()
    fallbackAudioRef.current = null
    if (fallbackAudioUrlRef.current) URL.revokeObjectURL(fallbackAudioUrlRef.current)
    fallbackAudioUrlRef.current = ''
    setSpeaking(false)
  }

  async function playOnlineFallback(value: string, language: SupportedLanguage) {
    setError(''); setSpeaking(true)
    try {
      const response = await createPronunciation(value, language, speechRate, voicePreferences[language])
      const url = URL.createObjectURL(response.audio)
      fallbackAudioUrlRef.current = url
      const audio = new Audio(url)
      fallbackAudioRef.current = audio
      setPronunciationVoice(`${response.voice} · ${response.provider}`)
      audio.onended = stopPronunciation
      audio.onerror = () => { stopPronunciation(); setError('The online pronunciation audio could not be played.') }
      await audio.play()
    } catch (cause) {
      stopPronunciation()
      setError(cause instanceof Error ? cause.message : 'Online pronunciation is unavailable.')
    }
  }

  async function pronounceResult() {
    if (!result.trim() || !('speechSynthesis' in window)) {
      setError('Pronunciation is not supported by this browser.')
      return
    }
    if (speaking) {
      stopPronunciation(); return
    }
    const language = tool === 'translation' ? targetLanguage : audioLanguage
    const preferredOnline = (onlineFallbackVoices[language] ?? []).some((item) => item.name === voicePreferences[language])
    if (preferredOnline && onlinePronunciation) {
      await playOnlineFallback(result, language)
      return
    }
    const locale = speechLocales[language]
    const utterance = new SpeechSynthesisUtterance(result)
    utterance.lang = locale
    const matchingVoice = findSpeechVoice(window.speechSynthesis.getVoices(), language, voicePreferences[language])
    if (!matchingVoice) {
      const languageName = languages.find((item) => item.code === language)?.label || language
      if (onlinePronunciation && onlineFallbackLanguages.has(language)) {
        await playOnlineFallback(result, language)
        return
      }
      setPronunciationVoice(`No ${languageName} voice installed`)
      setError(onlineFallbackLanguages.has(language) ? `Online pronunciation is off and no local ${languageName} voice is installed.` : `Install the Windows ${languageName} speech voice to use pronunciation.`)
      return
    }
    utterance.voice = matchingVoice
    setPronunciationVoice(matchingVoice.name)
    utterance.rate = speechRate
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => { setSpeaking(false); setError(`A ${languages.find((item) => item.code === language)?.label} pronunciation voice is not installed in Windows.`) }
    setError(''); setSpeaking(true); window.speechSynthesis.speak(utterance)
  }

  async function pronounceText(value: string, language: SupportedLanguage) {
    if (!value.trim()) return
    const preferredOnline = (onlineFallbackVoices[language] ?? []).some((item) => item.name === voicePreferences[language])
    if (preferredOnline && onlinePronunciation) { await playOnlineFallback(value, language); return }
    const voice = findSpeechVoice(window.speechSynthesis.getVoices(), language, voicePreferences[language])
    if (!voice) {
      if (onlinePronunciation && onlineFallbackLanguages.has(language)) await playOnlineFallback(value, language)
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(value)
    utterance.lang = speechLocales[language]
    utterance.voice = voice
    utterance.rate = speechRate
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    setPronunciationVoice(voice.name)
    setSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  function refreshSpeechVoices() {
    if (!('speechSynthesis' in window)) { setVoiceRefreshNotice('Speech voices are not supported by this browser.'); return }
    const voices = window.speechSynthesis.getVoices()
    setSpeechVoices(voices)
    const supported = languages.filter((language) => findSpeechVoice(voices, language.code) || (onlinePronunciation && onlineFallbackLanguages.has(language.code))).length
    setVoiceRefreshNotice(`${supported} of ${languages.length} pronunciation languages are ready.`)
  }

  function testSpeechVoice(language: SupportedLanguage, voice: SpeechSynthesisVoice) {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(voiceTestPhrases[language])
    utterance.lang = speechLocales[language]
    utterance.voice = voice
    utterance.rate = speechRate
    setPronunciationVoice(voice.name)
    setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => { setSpeaking(false); setError('Windows could not play this pronunciation voice.') }
    setError('')
    window.speechSynthesis.speak(utterance)
  }

  function testFallbackVoice(language: SupportedLanguage) {
    void playOnlineFallback(voiceTestPhrases[language], language)
  }

  function choosePreferredVoice(language: SupportedLanguage, voiceName: string) {
    const next = { ...voicePreferences, [language]: voiceName }
    setVoicePreferences(next)
    localStorage.setItem(LANGUAGE_VOICE_PREFERENCES_KEY, JSON.stringify(next))
    setVoiceRefreshNotice(`${languages.find((item) => item.code === language)?.label} will use ${voiceName}.`)
  }

  function chooseSpeechRate(value: number) {
    setSpeechRate(value)
    localStorage.setItem(LANGUAGE_VOICE_RATE_KEY, String(value))
    setVoiceRefreshNotice(`Pronunciation speed set to ${value === 0.75 ? 'Slow' : value === 1.1 ? 'Fast' : 'Normal'}.`)
  }

  function toggleAutoPronounce(enabled: boolean) {
    setAutoPronounce(enabled)
    localStorage.setItem(LANGUAGE_AUTO_PRONOUNCE_KEY, String(enabled))
    setVoiceRefreshNotice(enabled ? 'Completed translations will be pronounced automatically.' : 'Automatic pronunciation is off.')
  }

  function toggleOnlinePronunciation(enabled: boolean) {
    setOnlinePronunciation(enabled)
    localStorage.setItem(LANGUAGE_ONLINE_PRONUNCIATION_KEY, String(enabled))
    if (!enabled) stopPronunciation()
    setVoiceRefreshNotice(enabled ? 'Online neural fallback is available when a local voice is missing.' : 'Online pronunciation is off. Only local Windows voices will be used.')
  }

  function captureResultSelection() {
    const selected = window.getSelection()?.toString().trim() || ''
    setSelectedResultText(selected)
  }

  async function run() {
    if (loading) return
    const controller = new AbortController()
    requestControllerRef.current = controller
    setLoading(true); setError(''); setResult(''); setResultProvider(''); setResultModel(''); setResultDuration(undefined); setSelectedResultText('')
    try {
      if (tool === 'translation') {
        if (!text.trim()) throw new Error('Enter text to translate.')
        if (sourceLanguage !== 'auto' && sourceLanguage === targetLanguage) throw new Error('Choose two different languages for translation.')
        const response = await translateText({ text: text.trim(), sourceLanguage, targetLanguage }, controller.signal)
        setResult(response.translatedText)
        setTransliteration('')
        setResultProvider(response.provider || '')
        setResultModel(response.model || '')
        saveHistory({ tool, input: text.trim(), result: response.translatedText, sourceLanguage, targetLanguage, provider: response.provider, model: response.model })
        if (autoPronounce) pronounceText(response.translatedText, targetLanguage)
      } else if (tool === 'transcription') {
        if (!audioFile) throw new Error('Choose an audio file to transcribe.')
        const response = await transcribeAudio(audioFile, audioLanguage, controller.signal)
        setResult(response.text)
        setResultProvider(response.provider || '')
        setResultDuration(response.durationSeconds)
        saveHistory({ tool, input: audioFile.name, result: response.text, audioLanguage, provider: response.provider, durationSeconds: response.durationSeconds })
      } else {
        if (sourceLanguage !== 'auto' && sourceLanguage === targetLanguage) throw new Error('Choose two different languages for translation.')
        if (documentMode === 'file') {
          if (!documentFile) throw new Error('Choose a document to translate.')
          const response = await translateDocument(documentFile, sourceLanguage, targetLanguage, controller.signal)
          if (documentResult) URL.revokeObjectURL(documentResult.url)
          setDocumentResult({ ...response, url: URL.createObjectURL(response.blob) })
        } else {
          if (!sourceFolder || !destinationFolder) throw new Error('Choose both source and destination folders.')
          if (!folderDocuments.length) throw new Error('The source folder has no supported documents.')
          if (documentNaming === 'original' && await sourceFolder.isSameEntry(destinationFolder)) throw new Error('Source and destination cannot be the same when keeping original filenames.')
          const resuming = batchPaused && batchProgress.completed > 0 && batchProgress.completed < folderDocuments.length
          pauseBatchRef.current = false; setBatchPaused(false)
          for (const path of sourceSubfolders) await destinationDirectory(destinationFolder, path)
          const startIndex = resuming ? batchProgress.completed : 0
          let completed = startIndex
          const issues: BatchIssue[] = resuming ? [...batchProgress.issues] : []
          setBatchProgress({ completed, total: folderDocuments.length, current: folderDocuments[startIndex]?.file.name || '', issues: [...issues] })
          for (const item of folderDocuments.slice(startIndex)) {
            if (pauseBatchRef.current) { setBatchPaused(true); break }
            const relativePath = item.relativeDirectory ? `${item.relativeDirectory}/${item.file.name}` : item.file.name
            setBatchProgress({ completed, total: folderDocuments.length, current: relativePath, issues: [...issues] })
            try {
              if (item.file.size > MAX_DOCUMENT_BYTES) throw new Error('Larger than the 50 MB per-file limit')
              const folder = await destinationDirectory(destinationFolder, item.relativeDirectory)
              const outputName = documentNaming === 'original' ? item.file.name : translatedDocumentName(item.file.name, targetLanguage)
              if (documentConflict === 'skip') {
                try { await folder.getFileHandle(outputName); throw new Error('Skipped because the destination file already exists') }
                catch (cause) { if (cause instanceof DOMException && cause.name === 'NotFoundError') { /* Safe to create. */ } else throw cause }
              }
              const response = await translateDocument(item.file, sourceLanguage, targetLanguage, controller.signal)
              const output = await folder.getFileHandle(outputName, { create: true })
              const writer = await output.createWritable(); await writer.write(response.blob); await writer.close()
            } catch (cause) {
              if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
              const reason=cause instanceof Error ? cause.message : 'Translation failed'
              issues.push({ path: relativePath, reason, kind: reason.startsWith('Skipped because') ? 'skipped' : 'failed' })
            }
            completed += 1
            setBatchProgress({ completed, total: folderDocuments.length, current: relativePath, issues: [...issues] })
            if (pauseBatchRef.current && completed < folderDocuments.length) { setBatchPaused(true); break }
          }
        }
      }
    } catch (cause) { if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : 'Language request failed.') }
    finally { if (requestControllerRef.current === controller) requestControllerRef.current = null; setLoading(false) }
  }

  async function addTranslatedDocumentToKnowledge() {
    if (!documentResult) return
    setKnowledgeSaveStatus('Adding to Knowledge Library…')
    try {
      const file = new File([documentResult.blob], documentResult.filename, { type: documentResult.blob.type })
      await uploadKnowledgeDocument(file, 'Ministry', 'Translated Documents')
      setKnowledgeSaveStatus('Added to Ministry / Translated Documents. Open Documents and run indexing when ready.')
    } catch (cause) { setKnowledgeSaveStatus(cause instanceof Error ? cause.message : 'Unable to add this translated document.') }
  }

  async function chooseSourceFolder() {
    try {
      const picker = (window as Window & { showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<DirectoryHandle> }).showDirectoryPicker
      if (!picker) throw new Error('Folder translation requires Chrome or Edge on localhost.')
      const folder = await picker({ mode: 'read' }); const scan = await collectDocuments(folder)
      setSourceFolder(folder); setFolderDocuments(scan.documents); setSourceSubfolders(scan.directories); setBatchProgress({ completed: 0, total: scan.documents.length, current: '', issues: [] }); setBatchPaused(false); pauseBatchRef.current = false; setError('')
    } catch (cause) { if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : 'Could not open source folder.') }
  }

  async function chooseDestinationFolder() {
    try {
      const picker = (window as Window & { showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<DirectoryHandle> }).showDirectoryPicker
      if (!picker) throw new Error('Folder translation requires Chrome or Edge on localhost.')
      const folder=await picker({ mode: 'readwrite' })
      if (sourceFolder && documentNaming === 'original' && await sourceFolder.isSameEntry(folder)) throw new Error('Choose a different destination folder when keeping original filenames, to protect source documents.')
      setDestinationFolder(folder); setError('')
    } catch (cause) { if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : 'Could not open destination folder.') }
  }

  function cancelRequest() {
    requestControllerRef.current?.abort()
    requestControllerRef.current = null
    setLoading(false)
    setError('Request cancelled.')
  }

  function pauseFolderTranslation() {
    pauseBatchRef.current = true
  }

  function downloadBatchReport() {
    const skipped=batchProgress.issues.filter((issue)=>issue.kind==='skipped').length
    const failed=batchProgress.issues.length-skipped
    const report={createdAt:new Date().toISOString(),sourceFolder:sourceFolder?.name,destinationFolder:destinationFolder?.name,sourceLanguage,targetLanguage,total:batchProgress.total,processed:batchProgress.completed,translated:batchProgress.completed-batchProgress.issues.length,skipped,failed,issues:batchProgress.issues}
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})); const link=document.createElement('a'); link.href=url; link.download=`document-translation-report-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url)
  }

  const normalizedHistoryQuery = historyQuery.trim().toLowerCase()
  const visibleHistory = history.filter((item) => {
    if (historyTool === 'favorites' && !item.favorite) return false
    if (historyTool !== 'all' && historyTool !== 'favorites' && item.tool !== historyTool) return false
    if (!normalizedHistoryQuery) return true
    const route = item.tool === 'translation'
      ? `${languageLabel(item.sourceLanguage)} ${languageLabel(item.targetLanguage)}`
      : languageLabel(item.audioLanguage)
    return `${item.input} ${item.result} ${route}`.toLowerCase().includes(normalizedHistoryQuery)
  }).sort((left, right) => Number(Boolean(right.favorite)) - Number(Boolean(left.favorite)) || right.createdAt.localeCompare(left.createdAt))
  const readyVoiceCount = languages.filter((language) => findSpeechVoice(speechVoices, language.code, voicePreferences[language.code]) || (onlinePronunciation && onlineFallbackLanguages.has(language.code))).length
  const batchSkipped = batchProgress.issues.filter((issue) => issue.kind === 'skipped').length
  const batchFailed = batchProgress.issues.length - batchSkipped
  const batchTranslated = batchProgress.completed - batchProgress.issues.length

  return <WorkspaceLayout title="Language Tools"
    subtitle="Translate text and formatted documents, or transcribe spoken audio."
    icon={<Languages size={25} />} statusBar={<span>Translation and transcription are processed by your configured AIOS providers.</span>}
    className="language-tools-page">
    <div className="language-provider-status" aria-label="Language provider status">
      {(['ollama', 'whisper', 'openai'] as const).map((provider) => {
        const status = providerStatus?.providers[provider]
        return <span className={status?.available ? 'available' : 'unavailable'} key={provider}>
          <i />{provider === 'ollama' ? 'Ollama Translation' : provider === 'whisper' ? 'Local Whisper' : 'OpenAI'}
          <small>{provider === 'openai' && !status?.configured ? 'Optional cloud provider' : !providerStatus ? 'Status unavailable' : status?.available ? 'Ready' : status?.configured ? 'Offline' : 'Not configured'}</small>
        </span>
      })}
    </div>
    <div className="language-tools-tabs">
      <button className={tool === 'translation' ? 'active' : ''} type="button"
        onClick={() => { setTool('translation'); setError('') }}><Languages size={17} /> Text Translation</button>
      <button className={tool === 'transcription' ? 'active' : ''} type="button"
        onClick={() => { setTool('transcription'); setResult(''); setResultProvider(''); setResultDuration(undefined); setError('') }}><FileAudio size={17} /> Audio Transcription</button>
      <button className={tool === 'document' ? 'active' : ''} type="button"
        onClick={() => { setTool('document'); setResult(''); setDocumentResult(null); setError('') }}><FileText size={17} /> Document Translation</button>
    </div>
    {tool !== 'document' && <section className="language-voice-support" aria-label="Pronunciation voice support">
      <header><div><Volume2 size={18} /><span><strong>Pronunciation</strong><small>{readyVoiceCount} of {languages.length} languages ready</small></span></div>
        <div className="language-voice-actions"><button type="button" onClick={refreshSpeechVoices}><RefreshCw size={13} /> Refresh voices</button><a href="ms-settings:regionlanguage" title="Open Windows language settings">Manage Windows voices <ExternalLink size={13} /></a></div>
      </header>
      <div className="language-pronunciation-controls"><div>
        {(() => {
          const activeLanguage = tool === 'translation' ? targetLanguage : audioLanguage
          const available = matchingSpeechVoices(speechVoices, activeLanguage)
          const fallbackVoices = onlinePronunciation ? onlineFallbackVoices[activeLanguage] ?? [] : []
          if (available.length < 2 && fallbackVoices.length < 2) return <span className="language-active-voice">Using the available {languages.find((item) => item.code === activeLanguage)?.label} voice</span>
          const choices = [...available.map((voice) => ({ name: voice.name, label: `${voice.name} · Local` })), ...fallbackVoices.map((voice) => ({ name: voice.name, label: `${voice.label} · Online` }))].sort((left, right) => left.label.localeCompare(right.label))
          const preferred = voicePreferences[activeLanguage]
          const value = choices.some((item) => item.name === preferred) ? preferred! : choices[0]?.name || ''
          return <label className="language-preferred-voice">Preferred {languages.find((item) => item.code === activeLanguage)?.label} voice<select value={value} onChange={(event) => choosePreferredVoice(activeLanguage, event.target.value)}>{choices.map((voice) => <option key={voice.name} value={voice.name}>{voice.label}</option>)}</select></label>
        })()}
        <label className="language-speech-rate">Speed<select value={speechRate} onChange={(event) => chooseSpeechRate(Number(event.target.value))}><option value={0.75}>Slow</option><option value={0.9}>Normal</option><option value={1.1}>Fast</option></select></label>
      </div><div className="language-pronunciation-options">
        <label className="language-auto-pronounce"><input type="checkbox" checked={onlinePronunciation} onChange={(event) => toggleOnlinePronunciation(event.target.checked)} /> Online fallback for missing voices</label>
        <label className="language-auto-pronounce"><input type="checkbox" checked={autoPronounce} onChange={(event) => toggleAutoPronounce(event.target.checked)} /> Speak translations automatically</label>
      </div></div>
      {voiceRefreshNotice && <p role="status">{voiceRefreshNotice}</p>}
      <details className="language-voice-details"><summary>View and test all pronunciation voices</summary><div className="language-voice-list">{languages.map((language) => {
          const voice = findSpeechVoice(speechVoices, language.code, voicePreferences[language.code])
          const fallback = !voice && onlinePronunciation && onlineFallbackLanguages.has(language.code)
          return <span className={voice || fallback ? 'ready' : 'missing'} key={language.code} title={voice ? voice.name : fallback ? 'Microsoft online neural fallback' : `Install the Windows ${language.label} speech voice`}><i /><b>{language.label}</b><small>{voice ? 'Local voice' : fallback ? 'Online fallback' : 'Voice needed'}</small>{voice ? <button type="button" onClick={() => testSpeechVoice(language.code, voice)} aria-label={`Test ${language.label} voice`}>Test</button> : fallback ? <button type="button" onClick={() => testFallbackVoice(language.code)} aria-label={`Test ${language.label} online voice`}>Test</button> : null}</span>
        })}</div></details>
      <p className="language-privacy-note">Local Windows voices are preferred. Online fallback receives text only when you choose pronunciation.</p>
    </section>}
    <div className="language-tools-grid">
      <section className="language-input-panel">
        {tool === 'translation' ? <>
          <div className="language-selects"><LanguageSelect label="From" value={sourceLanguage} onChange={setSourceLanguage} allowAuto />
            <button className="language-swap" type="button" disabled={sourceLanguage === 'auto'} onClick={swapLanguages}
              aria-label="Swap translation languages" title={sourceLanguage === 'auto' ? 'Choose a source language to swap' : 'Swap languages'}>
              <ArrowLeftRight size={17} />
            </button>
            <LanguageSelect label="To" value={targetLanguage} onChange={setTargetLanguage} /></div>
          <label className="language-text-input"><span>Text to translate <small>{text.length.toLocaleString()} characters</small></span><textarea rows={11} value={text}
            onChange={(event) => setText(event.target.value)} placeholder="Enter text..." /></label>
          <button className="language-source-pronounce" type="button" disabled={!text.trim() || sourceLanguage === 'auto'} onClick={() => { if (sourceLanguage !== 'auto') pronounceText(text, sourceLanguage) }} title={sourceLanguage === 'auto' ? 'Choose the source language to pronounce the original text' : 'Pronounce original text'}><Volume2 size={15} /> Pronounce original text</button>
        </> : tool === 'transcription' ? <>
          <LanguageSelect label="Spoken language" value={audioLanguage} onChange={setAudioLanguage} />
          <label className="language-file-input" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); chooseAudioFile(event.dataTransfer.files[0] ?? null) }}><FileAudio size={25} /><strong>{audioFile?.name ?? 'Choose or drop an audio file'}</strong>
            <span>{audioFile ? `${(audioFile.size / 1024 / 1024).toFixed(1)} MB` : 'MP3, WAV, M4A, WebM, or another audio format · maximum 25 MB'}</span>
            <input type="file" accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.flac,.aac" onChange={(event) => chooseAudioFile(event.target.files?.[0] ?? null)} /></label>
          <button className={recording ? 'language-record recording' : 'language-record'} type="button"
            onClick={recording ? stopRecording : () => void startRecording()}>
            {recording ? <Square size={16} /> : <Mic size={16} />}
            {recording ? `Stop Recording · ${formatRecordingTime(recordingSeconds)}` : 'Record with Microphone'}
          </button>
          {audioPreviewUrl && <div className="language-audio-preview"><span>Preview recording</span>
            <audio controls preload="metadata" src={audioPreviewUrl}>Audio preview is not supported by this browser.</audio></div>}
        </> : <>
          <div className="language-selects"><LanguageSelect label="From" value={sourceLanguage} onChange={setSourceLanguage} allowAuto />
            <button className="language-swap" type="button" disabled={sourceLanguage === 'auto'} onClick={swapLanguages} aria-label="Swap document languages"><ArrowLeftRight size={17} /></button>
            <LanguageSelect label="To" value={targetLanguage} onChange={setTargetLanguage} /></div>
          <div className="language-document-mode"><button className={documentMode === 'file' ? 'active' : ''} type="button" onClick={() => setDocumentMode('file')}>Single document</button><button className={documentMode === 'folder' ? 'active' : ''} type="button" onClick={() => setDocumentMode('folder')}>Folder and subfolders</button></div>
          {documentMode === 'file' ? <label className="language-file-input language-document-input"><FileText size={28} /><strong>{documentFile?.name ?? 'Choose or drop a document'}</strong><span>{documentFile ? `${(documentFile.size / 1024 / 1024).toFixed(1)} MB` : 'DOCX, PPTX, PDF, TXT, Markdown, HTML, or HTM · maximum 50 MB'}</span><input type="file" accept=".docx,.pptx,.ppt,.pdf,.txt,.md,.html,.htm" onChange={(event) => { const file=event.target.files?.[0] ?? null; if (file?.name.toLowerCase().endsWith('.ppt')) { setError('Legacy PPT files must first be saved as PPTX.'); setDocumentFile(null) } else if (file && file.size > MAX_DOCUMENT_BYTES) { setError('Document is larger than the 50 MB limit.'); setDocumentFile(null) } else { setError(''); setDocumentFile(file) } }} /></label> : <div className="language-folder-picker">
            <button type="button" onClick={() => void chooseSourceFolder()}><Upload size={18} /><span><strong>Source folder</strong><small>{sourceFolder ? `${sourceFolder.name} · ${folderDocuments.length} supported documents` : 'Choose the folder containing documents'}</small></span></button>
            <button type="button" onClick={() => void chooseDestinationFolder()}><Download size={18} /><span><strong>Destination folder</strong><small>{destinationFolder?.name || 'Choose where translated documents will be saved'}</small></span></button>
            <div className="language-folder-options"><label>Output filenames<select value={documentNaming} onChange={(event) => setDocumentNaming(event.target.value as typeof documentNaming)}><option value="suffix">Add language suffix</option><option value="original">Keep original filenames</option></select></label><label>If a file already exists<select value={documentConflict} onChange={(event) => setDocumentConflict(event.target.value as typeof documentConflict)}><option value="overwrite">Replace it</option><option value="skip">Skip it</option></select></label></div>
            <p>The complete subfolder structure is recreated in the destination. Unsupported files are skipped.</p>
          </div>}
          <div className="language-layout-note"><strong>Layout preservation</strong><span>DOCX retains styles, tables, headers, footers, images, and page settings. PPTX retains slides, themes, text boxes, tables, images, and positioning. Text-based PDF retains page size and reading order where possible; scanned PDFs need OCR.{documentMode === 'folder' ? ` All ${sourceSubfolders.length} subfolders, including empty ones, will be recreated.` : ''}</span></div>
        </>}
        {error && <p className="language-error">{error}</p>}
        <button className="language-run" type="button" disabled={loading || (tool === 'translation' ? !text.trim() : tool === 'transcription' ? !audioFile : documentMode === 'file' ? !documentFile : !sourceFolder || !destinationFolder || !folderDocuments.length)} onClick={() => void run()}>
          {loading && <LoaderCircle className="spin" size={16} />}{loading ? (tool === 'document' ? 'Translating document content…' : 'Processing...') : tool === 'translation' ? 'Translate Text' : tool === 'transcription' ? 'Transcribe Audio' : batchPaused ? `Resume at document ${batchProgress.completed + 1}` : 'Translate Document'}
        </button>
        {loading && tool === 'document' && documentMode === 'folder' && <button className="language-pause" type="button" disabled={pauseBatchRef.current} onClick={pauseFolderTranslation}>Pause after current document</button>}
        {loading && <button className="language-cancel" type="button" onClick={cancelRequest}><X size={15} /> Cancel request</button>}
      </section>
      <section className="language-result-panel"><header><h2>{tool === 'document' ? 'Translated document' : 'Result'}</h2>
        {result && <div className="language-result-actions">
          <button type="button" onClick={() => void navigator.clipboard.writeText(result)}><Copy size={14} /> Copy</button>
          <button type="button" onClick={downloadResult}><Download size={14} /> Download</button>
          <button type="button" className={speaking ? 'pronouncing' : ''} onClick={pronounceResult} aria-pressed={speaking}><Volume2 size={14} /> {speaking ? 'Stop' : 'Pronounce'}</button>
          {selectedResultText && <button type="button" onClick={() => pronounceText(selectedResultText, tool === 'translation' ? targetLanguage : audioLanguage)}><Volume2 size={14} /> Pronounce selection</button>}
          {tool === 'translation' && targetLanguage !== 'en' && <button type="button" onClick={() => { const controller = new AbortController(); void transliterateText(result, targetLanguage, controller.signal).then(setTransliteration).catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to create English-letter pronunciation.')) }}><Languages size={14} /> English-letter pronunciation</button>}
          {onlinePronunciation && onlineFallbackLanguages.has(tool === 'translation' ? targetLanguage : audioLanguage) && <button type="button" disabled={downloadingPronunciation} onClick={() => void downloadPronunciation()}>{downloadingPronunciation ? <LoaderCircle className="spin" size={14} /> : <Download size={14} />} {downloadingPronunciation ? 'Preparing MP3…' : 'Download speech MP3'}</button>}
          <button type="button" onClick={createSpeechAudio}><Volume2 size={14} /> Create speech</button>
          {tool === 'transcription' && <button type="button" onClick={translateTranscription}>
            <Languages size={14} /> Translate
          </button>}
        </div>}</header>
        {result && <div className="language-result-meta">{resultProvider && <span>Processed by {resultProvider}{resultModel ? ` · ${resultModel}` : ''}</span>}{typeof resultDuration === 'number' && <span>Audio duration {formatRecordingTime(Math.round(resultDuration))}</span>}<span>{result.length.toLocaleString()} characters</span></div>}
        {result && pronunciationVoice && <p className="language-pronunciation-status"><Volume2 size={13} /> Pronunciation voice: {pronunciationVoice}</p>}
        {tool === 'document' ? documentMode === 'folder' ? <div className={batchProgress.total ? 'language-document-result language-batch-result' : 'language-result-content empty'}>{batchProgress.total ? <><FileText size={38} /><strong>{batchProgress.completed === batchProgress.total ? 'Folder translation complete' : batchPaused ? 'Folder translation paused' : batchProgress.current}</strong><span>{batchProgress.completed} of {batchProgress.total} documents processed</span><progress max={batchProgress.total} value={batchProgress.completed} /><span>{batchProgress.completed === batchProgress.total ? `${batchTranslated} translated · ${batchSkipped} skipped · ${batchFailed} failed · saved in ${destinationFolder?.name}` : batchPaused ? `Resume will continue with document ${batchProgress.completed + 1}.` : 'Keep AIOS Studio open until processing finishes.'}</span>{batchProgress.issues.length > 0 && <details><summary>{batchProgress.issues.length} skipped or failed documents</summary><ul>{batchProgress.issues.map((issue) => <li key={issue.path}><strong>{issue.path}</strong><span>{issue.kind === 'skipped' ? 'Skipped' : 'Failed'} · {issue.reason}</span></li>)}</ul></details>}{batchProgress.completed > 0 && <button className="language-report-download" type="button" onClick={downloadBatchReport}><Download size={15} /> Download processing report</button>}</> : 'Choose source and destination folders to begin.'}</div> : <div className={documentResult ? 'language-document-result' : 'language-result-content empty'}>{documentResult ? <><FileText size={38} /><strong>{documentResult.filename}</strong><span>{documentResult.segments} formatted text sections translated</span><span>{documentResult.fidelity === 'native' ? 'Native document structure retained' : 'Best-effort page layout retained'}</span><div className="language-document-result-actions"><a href={documentResult.url} download={documentResult.filename}><Download size={16} /> Download</a><button type="button" onClick={() => void addTranslatedDocumentToKnowledge()}><Upload size={16} /> Add to Knowledge</button></div>{knowledgeSaveStatus && <small>{knowledgeSaveStatus}</small>}</> : 'Your translated document will be available here.'}</div> : <div className={result ? 'language-result-content' : 'language-result-content empty'} onMouseUp={captureResultSelection} onKeyUp={captureResultSelection}>{result || 'Your translated or transcribed text will appear here.'}</div>}
        {transliteration && <div className="language-transliteration"><strong>Pronunciation in English letters</strong><p>{transliteration}</p></div>}
        {result && <p className="language-selection-help">Select any part of the result to pronounce only that text.</p>}
      </section>
    </div>
    <section className="language-history-panel">
      <header><div><History size={18} /><h2>Recent Results</h2></div><div className="language-history-heading-actions"><span>Latest 20 · favorites retained</span>{history.length > 0 && <button type="button" onClick={exportHistory}><Download size={13} /> Backup</button>}<button type="button" onClick={() => historyImportRef.current?.click()}><Upload size={13} /> Restore</button>{history.length > 0 && <button type="button" onClick={clearHistory}><Trash2 size={13} /> Clear all</button>}<input ref={historyImportRef} className="language-history-import" type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importHistory(file) }} /></div></header>
      {history.length > 0 && <div className="language-history-filters">
        <label><Search size={14} /><input type="search" value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Search saved results" aria-label="Search saved results" /></label>
        <select value={historyTool} onChange={(event) => setHistoryTool(event.target.value as typeof historyTool)} aria-label="Filter saved results by type"><option value="all">All results</option><option value="favorites">Favorites</option><option value="translation">Translations</option><option value="transcription">Transcriptions</option></select>
      </div>}
      {history.length === 0 ? <p className="language-history-empty">Completed translations and transcriptions will appear here.</p> :
        visibleHistory.length === 0 ? <p className="language-history-empty">No saved results match your search.</p> : <div className="language-history-list">{visibleHistory.map((item) => {
          const itemLanguage = historyLanguage(item)
          const canDownloadSpeech = Boolean(itemLanguage && onlinePronunciation && onlineFallbackLanguages.has(itemLanguage))
          return <article key={item.id}>
          <button className="language-history-open" type="button" onClick={() => restoreHistory(item)}>
            <strong>{item.tool === 'translation' ? 'Translation' : 'Transcription'}</strong>
            <span>{item.input}</span><small className="language-history-route">{item.tool === 'translation' ? `${languageLabel(item.sourceLanguage)} → ${languageLabel(item.targetLanguage)}` : `Spoken language: ${languageLabel(item.audioLanguage)}`}</small>{(item.provider || typeof item.durationSeconds === 'number') && <small>{item.provider ? `Provider: ${item.provider}` : ''}{item.provider && typeof item.durationSeconds === 'number' ? ' · ' : ''}{typeof item.durationSeconds === 'number' ? `Duration: ${formatRecordingTime(Math.round(item.durationSeconds))}` : ''}</small>}<small>{new Date(item.createdAt).toLocaleString()}</small>
          </button>
          <div className="language-history-actions">
            <button className={item.favorite ? 'favorite active' : 'favorite'} type="button" onClick={() => toggleHistoryFavorite(item.id)} title={item.favorite ? 'Remove from favorites' : 'Add to favorites'} aria-label={item.favorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={Boolean(item.favorite)}><Star size={15} fill={item.favorite ? 'currentColor' : 'none'} /></button>
            <button type="button" onClick={() => void copyHistoryResult(item)} title="Copy saved result" aria-label="Copy saved result"><Copy size={15} /></button>
            <button type="button" onClick={() => downloadHistoryText(item)} title="Download saved result as text" aria-label="Download saved result as text"><Download size={15} /></button>
            {itemLanguage && <button type="button" onClick={() => void pronounceText(item.result, itemLanguage)} title="Pronounce saved result" aria-label="Pronounce saved result"><Volume2 size={15} /></button>}
            {canDownloadSpeech && <button type="button" disabled={downloadingHistoryId === item.id} onClick={() => void downloadHistoryPronunciation(item)} title="Download saved result as MP3" aria-label="Download saved result as MP3">{downloadingHistoryId === item.id ? <LoaderCircle className="spin" size={15} /> : <Download size={15} />}</button>}
            <button className="language-history-delete" type="button" onClick={() => removeHistory(item.id)}
              aria-label={`Delete ${item.tool} history item`} title="Delete saved result"><Trash2 size={15} /></button>
          </div>
        </article>})}</div>}
    </section>
  </WorkspaceLayout>
}

export default LanguageToolsPage
