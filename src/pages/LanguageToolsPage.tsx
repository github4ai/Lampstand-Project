import { ArrowLeftRight, Copy, Download, FileAudio, History, Languages, LoaderCircle, Trash2 } from 'lucide-react'
import { useState } from 'react'
import WorkspaceLayout from '../layouts/WorkspaceLayout'
import { transcribeAudio, translateText } from '../api/languageTools'
import type { LanguageHistoryItem, SupportedLanguage, TranslationSourceLanguage } from '../types/languageTools'

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
