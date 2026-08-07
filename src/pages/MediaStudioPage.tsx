import { Download, Image, LoaderCircle, Music2, Sparkles, Video } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import WorkspaceLayout from '../layouts/WorkspaceLayout'
import { generateMedia, getMediaGeneration } from '../api/media'
import type { MediaGeneration, MediaKind } from '../types/media'

const kinds: Array<{ id: MediaKind; label: string; icon: typeof Image }> = [
  { id: 'image', label: 'Image', icon: Image },
  { id: 'audio', label: 'Audio', icon: Music2 },
  { id: 'video', label: 'Video', icon: Video },
]

const MEDIA_HISTORY_KEY = 'aios-studio-media-history-v1'
const audioStyles = {
  speech: ['Narration', 'Sermon', 'Devotional', 'Prayer', 'Audiobook'],
  music: ['Original Composition', 'Worship Music', 'Gospel', 'Classical', 'Contemporary'],
  instrumental: ['Worship Underscore', 'Ambient', 'Cinematic', 'Acoustic', 'Electronic'],
  song: ['Worship Song', 'Hymn', 'Gospel', 'Contemporary Christian', 'Choir'],
} as const

function loadMediaHistory(): MediaGeneration[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(MEDIA_HISTORY_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((item): item is MediaGeneration =>
      typeof item === 'object' && item !== null && typeof item.id === 'string' &&
      typeof item.kind === 'string' && typeof item.status === 'string') : []
  } catch { return [] }
}

function MediaStudioPage() {
  const [kind, setKind] = useState<MediaKind>('image')
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [duration, setDuration] = useState(10)
  const [audioMode, setAudioMode] = useState<'speech' | 'music' | 'instrumental' | 'song'>('speech')
  const [language, setLanguage] = useState('en')
  const [genre, setGenre] = useState('Worship')
  const [audioStyle, setAudioStyle] = useState('Narration')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState(loadMediaHistory)
  const maximumDuration = kind === 'video' ? 60 : 300
  const displayedDuration = Math.min(duration, maximumDuration)
  const durationMinutes = Math.floor(displayedDuration / 60)
  const durationSeconds = displayedDuration % 60
  const pendingIds = useMemo(() => results
    .filter((result) => result.status === 'queued' || result.status === 'processing')
    .map((result) => result.id), [results])
  const pendingKey = pendingIds.join('|')

  useEffect(() => {
    localStorage.setItem(MEDIA_HISTORY_KEY, JSON.stringify(results))
  }, [results])

  useEffect(() => {
    if (!pendingKey) return
    const controller = new AbortController()
    const ids = pendingKey.split('|')
    async function refresh() {
      const updates = await Promise.allSettled(
        ids.map((id) => getMediaGeneration(id, controller.signal)))
      if (controller.signal.aborted) return
      const completed = new Map(updates
        .filter((result): result is PromiseFulfilledResult<MediaGeneration> => result.status === 'fulfilled')
        .map((result) => [result.value.id, result.value]))
      if (completed.size > 0) setResults((current) =>
        current.map((result) => completed.get(result.id) ?? result))
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 2500)
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [pendingKey])

  async function submit() {
    const normalized = prompt.trim()
    if (!normalized || generating) return
    setGenerating(true)
    setError('')
    try {
      const result = await generateMedia({ kind, prompt: normalized,
        aspectRatio: kind !== 'audio' ? aspectRatio : undefined,
        durationSeconds: kind !== 'image' ? duration : undefined,
        audioMode: kind === 'audio' ? audioMode : undefined,
        language: kind === 'audio' && (audioMode === 'speech' || audioMode === 'song')
          ? language : undefined,
        genre: kind === 'audio' && audioMode !== 'speech' ? genre : undefined,
        audioStyle: kind === 'audio' ? audioStyle : undefined })
      setResults((current) => [result, ...current])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to generate media.')
    } finally { setGenerating(false) }
  }

  return <WorkspaceLayout title="Media Studio"
    subtitle="Create ministry images, audio, and video through your configured AIOS providers."
    icon={<Sparkles size={25} />} statusBar={<span>Generated media remains under your configured provider and storage policies.</span>}
    className="media-studio-page">
    <div className="media-studio-grid">
      <section className="media-creator">
        <div className="media-kind-tabs">{kinds.map((item) => {
          const Icon = item.icon
          return <button className={kind === item.id ? 'active' : ''} type="button"
            onClick={() => setKind(item.id)} key={item.id}><Icon size={17} /> {item.label}</button>
        })}</div>
        <label className="media-prompt">Describe what you want to create
          <textarea rows={7} value={prompt} onChange={(event) => setPrompt(event.target.value)}
            placeholder={`Describe the ${kind} for your ministry project...`} /></label>
        <div className="media-options">
          {kind !== 'audio' && <label>Aspect ratio<select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)}>
            <option>16:9</option><option>1:1</option><option>4:5</option><option>9:16</option>
          </select></label>}
          {kind === 'audio' && <label>Audio type<select value={audioMode}
            onChange={(event) => {
              const mode = event.target.value as typeof audioMode
              setAudioMode(mode)
              setAudioStyle(audioStyles[mode][0])
            }}>
            <option value="speech">Speech</option><option value="music">Music</option>
            <option value="instrumental">Instrumental</option><option value="song">Song</option>
          </select></label>}
          {kind === 'audio' && audioMode !== 'speech' && <label>Genre<select value={genre}
            onChange={(event) => setGenre(event.target.value)}>
            {['Worship', 'Gospel', 'Hymn', 'Contemporary Christian', 'Classical', 'Acoustic',
              'Cinematic', 'Ambient', 'Folk', 'Rock', 'Pop'].map((item) =>
              <option key={item}>{item}</option>)}
          </select></label>}
          {kind === 'audio' && <label>Type<select value={audioStyle}
            onChange={(event) => setAudioStyle(event.target.value)}>
            {audioStyles[audioMode].map((item) => <option key={item}>{item}</option>)}
          </select></label>}
          {kind === 'audio' && <label>Language<select value={language}
            disabled={audioMode !== 'speech' && audioMode !== 'song'}
            onChange={(event) => setLanguage(event.target.value)}>
            <option value="en">English</option>
            <option value="hi">Hindi</option><option value="ml">Malayalam</option>
            <option value="mr">Marathi</option>
            <option value="ta">Tamil</option><option value="te">Telugu</option>
            <option value="es">Spanish</option><option value="fr">French</option>
            <option value="de">German</option><option value="zh">Chinese</option>
          </select></label>}
          {kind !== 'image' && <label className="media-duration">Duration
            <div><input type="range" min={1} max={maximumDuration}
              value={displayedDuration}
              onChange={(event) => setDuration(Number(event.target.value))} />
              <input type="number" min={0} max={Math.floor(maximumDuration / 60)}
                value={durationMinutes} onChange={(event) => {
                  const minutes = Math.max(0, Number(event.target.value) || 0)
                  setDuration(Math.min(maximumDuration,
                    Math.max(1, minutes * 60 + durationSeconds)))
                }} aria-label="Duration minutes" /><span>min</span>
              <input type="number" min={0} max={59} value={durationSeconds}
                onChange={(event) => {
                  const seconds = Math.min(59, Math.max(0, Number(event.target.value) || 0))
                  setDuration(Math.min(maximumDuration,
                    Math.max(1, durationMinutes * 60 + seconds)))
                }} aria-label="Duration seconds" /><span>sec</span></div>
          </label>}
        </div>
        {error && <p className="media-error">{error}</p>}
        <button className="media-generate" type="button" disabled={!prompt.trim() || generating} onClick={() => void submit()}>
          {generating ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
          {generating ? 'Generating...' : `Generate ${kind}`}
        </button>
      </section>
      <section className="media-results"><header><h2>Recent creations</h2><div>
        {results.length > 0 && <button type="button" onClick={() => setResults([])}>Clear</button>}
        <span>{results.length}</span></div></header>
        {results.length === 0 ? <div className="media-empty"><Sparkles size={28} /><h3>Your creations will appear here</h3>
          <p>Connect an AIOS media provider to begin generating.</p></div> :
          <div className="media-result-list">{results.map((result) => <article key={result.id}>
            {result.url && result.kind === 'image' && <img src={result.url} alt={result.prompt} />}
            {result.url && result.kind === 'audio' && <audio controls src={result.url} />}
            {result.url && result.kind === 'video' && <video controls src={result.url} />}
            <div><span>{result.kind} - {result.status}</span><p>{result.prompt}</p>
              {result.url && <a href={result.url} download><Download size={14} /> Download</a>}</div>
          </article>)}</div>}
      </section>
    </div>
  </WorkspaceLayout>
}

export default MediaStudioPage
