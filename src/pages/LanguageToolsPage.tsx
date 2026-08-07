import { ArrowLeftRight, Copy, Download, FileAudio, History, Languages, LoaderCircle, Mic, Square, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import WorkspaceLayout from '../layouts/WorkspaceLayout'
import { getLanguageProviderStatus, transcribeAudio, translateText } from '../api/languageTools'
import type { LanguageHistoryItem, LanguageProviderStatus, SupportedLanguage, TranslationSourceLanguage } from '../types/languageTools'

const LANGUAGE_HISTORY_KEY = 'aios-studio-language-history-v1'

function loadHistory(): LanguageHistoryItem[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(LANGUAGE_HISTORY_KEY) ?? '[]')
    return Array.isArray(value) ? value.slice(0, 20) as LanguageHistoryItem[] : []
  } catch {
    return []
  }
}

const languages: Array<{ code: SupportedLanguage; label: string }> = [
  { code: 'en', label: 'English' }, { code: 'zh', label: 'Chinese' },
  { code: 'ta', label: 'Tamil' }, { code: 'hi', label: 'Hindi' },
  { code: 'mr', label: 'Marathi' }, { code: 'te', label: 'Telugu' },
  { code: 'ml', label: 'Malayalam' },
]

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
  const [tool, setTool] = useState<'translation' | 'transcription'>('translation')
  const [sourceLanguage, setSourceLanguage] = useState<TranslationSourceLanguage>('auto')
  const [targetLanguage, setTargetLanguage] = useState<SupportedLanguage>('ml')
  const [text, setText] = useState('')
  const [audioLanguage, setAudioLanguage] = useState<SupportedLanguage>('en')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<LanguageHistoryItem[]>(loadHistory)
  const [providerStatus, setProviderStatus] = useState<LanguageProviderStatus | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [audioPreviewUrl, setAudioPreviewUrl] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordingChunksRef = useRef<Blob[]>([])

  useEffect(() => {
    const controller = new AbortController()
    void getLanguageProviderStatus(controller.signal).then(setProviderStatus).catch(() => setProviderStatus(null))
    return () => controller.abort()
  }, [])

  useEffect(() => () => {
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop())
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
    const next = [{ ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...history].slice(0, 20)
    setHistory(next)
    localStorage.setItem(LANGUAGE_HISTORY_KEY, JSON.stringify(next))
  }

  function removeHistory(id: string) {
    const next = history.filter((item) => item.id !== id)
    setHistory(next)
    localStorage.setItem(LANGUAGE_HISTORY_KEY, JSON.stringify(next))
  }

  function restoreHistory(item: LanguageHistoryItem) {
    setTool(item.tool)
    setResult(item.result)
    setError('')
    if (item.tool === 'translation') {
      setText(item.input)
      if (item.sourceLanguage) setSourceLanguage(item.sourceLanguage)
      if (item.targetLanguage) setTargetLanguage(item.targetLanguage)
    } else if (item.audioLanguage) {
      setAudioLanguage(item.audioLanguage)
    }
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

  async function run() {
    if (loading) return
    setLoading(true); setError(''); setResult('')
    try {
      if (tool === 'translation') {
        if (!text.trim()) throw new Error('Enter text to translate.')
        const response = await translateText({ text: text.trim(), sourceLanguage, targetLanguage })
        setResult(response.translatedText)
        saveHistory({ tool, input: text.trim(), result: response.translatedText, sourceLanguage, targetLanguage })
      } else {
        if (!audioFile) throw new Error('Choose an audio file to transcribe.')
        const response = await transcribeAudio(audioFile, audioLanguage)
        setResult(response.text)
        saveHistory({ tool, input: audioFile.name, result: response.text, audioLanguage })
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Language request failed.') }
    finally { setLoading(false) }
  }

  return <WorkspaceLayout title="Language Tools"
    subtitle="Translate ministry text and transcribe spoken audio in supported languages."
    icon={<Languages size={25} />} statusBar={<span>Translation and transcription are processed by your configured AIOS providers.</span>}
    className="language-tools-page">
    <div className="language-provider-status" aria-label="Language provider status">
      {(['ollama', 'whisper', 'openai'] as const).map((provider) => {
        const status = providerStatus?.providers[provider]
        return <span className={status?.available ? 'available' : 'unavailable'} key={provider}>
          <i />{provider === 'ollama' ? 'Ollama Translation' : provider === 'whisper' ? 'Local Whisper' : 'OpenAI'}
          <small>{!providerStatus ? 'Status unavailable' : status?.available ? 'Ready' : status?.configured ? 'Offline' : 'Not configured'}</small>
        </span>
      })}
    </div>
    <div className="language-tools-tabs">
      <button className={tool === 'translation' ? 'active' : ''} type="button"
        onClick={() => { setTool('translation'); setResult(''); setError('') }}><Languages size={17} /> Text Translation</button>
      <button className={tool === 'transcription' ? 'active' : ''} type="button"
        onClick={() => { setTool('transcription'); setResult(''); setError('') }}><FileAudio size={17} /> Audio Transcription</button>
    </div>
    <div className="language-tools-grid">
      <section className="language-input-panel">
        {tool === 'translation' ? <>
          <div className="language-selects"><LanguageSelect label="From" value={sourceLanguage} onChange={setSourceLanguage} allowAuto />
            <button className="language-swap" type="button" disabled={sourceLanguage === 'auto'} onClick={swapLanguages}
              aria-label="Swap translation languages" title={sourceLanguage === 'auto' ? 'Choose a source language to swap' : 'Swap languages'}>
              <ArrowLeftRight size={17} />
            </button>
            <LanguageSelect label="To" value={targetLanguage} onChange={setTargetLanguage} /></div>
          <label className="language-text-input">Text to translate<textarea rows={11} value={text}
            onChange={(event) => setText(event.target.value)} placeholder="Enter text..." /></label>
        </> : <>
          <LanguageSelect label="Spoken language" value={audioLanguage} onChange={setAudioLanguage} />
          <label className="language-file-input"><FileAudio size={25} /><strong>{audioFile?.name ?? 'Choose an audio file'}</strong>
            <span>MP3, WAV, M4A, or another format supported by AIOS</span>
            <input type="file" accept="audio/*" onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)} /></label>
          <button className={recording ? 'language-record recording' : 'language-record'} type="button"
            onClick={recording ? stopRecording : () => void startRecording()}>
            {recording ? <Square size={16} /> : <Mic size={16} />}
            {recording ? `Stop Recording · ${formatRecordingTime(recordingSeconds)}` : 'Record with Microphone'}
          </button>
          {audioPreviewUrl && <div className="language-audio-preview"><span>Preview recording</span>
            <audio controls preload="metadata" src={audioPreviewUrl}>Audio preview is not supported by this browser.</audio></div>}
        </>}
        {error && <p className="language-error">{error}</p>}
        <button className="language-run" type="button" disabled={loading} onClick={() => void run()}>
          {loading && <LoaderCircle className="spin" size={16} />}{loading ? 'Processing...' : tool === 'translation' ? 'Translate Text' : 'Transcribe Audio'}
        </button>
      </section>
      <section className="language-result-panel"><header><h2>Result</h2>
        {result && <div className="language-result-actions">
          <button type="button" onClick={() => void navigator.clipboard.writeText(result)}><Copy size={14} /> Copy</button>
          <button type="button" onClick={downloadResult}><Download size={14} /> Download</button>
        </div>}</header>
        <div className={result ? 'language-result-content' : 'language-result-content empty'}>
          {result || 'Your translated or transcribed text will appear here.'}</div>
      </section>
    </div>
    <section className="language-history-panel">
      <header><div><History size={18} /><h2>Recent Results</h2></div><span>Stored locally · latest 20</span></header>
      {history.length === 0 ? <p className="language-history-empty">Completed translations and transcriptions will appear here.</p> :
        <div className="language-history-list">{history.map((item) => <article key={item.id}>
          <button className="language-history-open" type="button" onClick={() => restoreHistory(item)}>
            <strong>{item.tool === 'translation' ? 'Translation' : 'Transcription'}</strong>
            <span>{item.input}</span><small>{new Date(item.createdAt).toLocaleString()}</small>
          </button>
          <button className="language-history-delete" type="button" onClick={() => removeHistory(item.id)}
            aria-label={`Delete ${item.tool} history item`}><Trash2 size={15} /></button>
        </article>)}</div>}
    </section>
  </WorkspaceLayout>
}

export default LanguageToolsPage
