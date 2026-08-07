import { Download, Image, LoaderCircle, Music2, Sparkles, Video } from 'lucide-react'
import { useState } from 'react'
import WorkspaceLayout from '../layouts/WorkspaceLayout'
import { generateMedia } from '../api/media'
import type { MediaGeneration, MediaKind } from '../types/media'

const kinds: Array<{ id: MediaKind; label: string; icon: typeof Image }> = [
  { id: 'image', label: 'Image', icon: Image },
  { id: 'audio', label: 'Audio', icon: Music2 },
  { id: 'video', label: 'Video', icon: Video },
]

function MediaStudioPage() {
  const [kind, setKind] = useState<MediaKind>('image')
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [duration, setDuration] = useState(10)
  const [audioMode, setAudioMode] = useState<'speech' | 'music'>('speech')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<MediaGeneration[]>([])

  async function submit() {
    const normalized = prompt.trim()
    if (!normalized || generating) return
    setGenerating(true)
    setError('')
    try {
      const result = await generateMedia({ kind, prompt: normalized,
        aspectRatio: kind !== 'audio' ? aspectRatio : undefined,
        durationSeconds: kind !== 'image' ? duration : undefined,
        audioMode: kind === 'audio' ? audioMode : undefined })
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
          {kind === 'audio' && <label>Audio type<select value={audioMode} onChange={(event) => setAudioMode(event.target.value as 'speech' | 'music')}>
            <option value="speech">Speech</option><option value="music">Music</option>
          </select></label>}
          {kind !== 'image' && <label>Duration<select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
            <option value={5}>5 seconds</option><option value={10}>10 seconds</option><option value={30}>30 seconds</option><option value={60}>60 seconds</option>
          </select></label>}
        </div>
        {error && <p className="media-error">{error}</p>}
        <button className="media-generate" type="button" disabled={!prompt.trim() || generating} onClick={() => void submit()}>
          {generating ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
          {generating ? 'Generating...' : `Generate ${kind}`}
        </button>
      </section>
      <section className="media-results"><header><h2>Recent creations</h2><span>{results.length}</span></header>
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
