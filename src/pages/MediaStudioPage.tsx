import { Ban, Check, ChevronLeft, ChevronRight, Clipboard, Download, FolderDown, FolderPlus, Image, LoaderCircle, Maximize2, Music2, RotateCcw, Search, Sparkles, Star, Trash2, Upload, Video, X } from 'lucide-react'
import { useAccessControl } from '../hooks/useAccessControl'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import WorkspaceLayout from '../layouts/WorkspaceLayout'
import { cancelMediaGeneration, generateMedia, getMediaGeneration, getMediaGenerations, getMediaProviderStatus, getWanVideos } from '../api/media'
import type { MediaGeneration, MediaGenerationRequest, MediaKind, MediaProviderStatus } from '../types/media'

const kinds: Array<{ id: MediaKind; label: string; icon: typeof Image }> = [
  { id: 'image', label: 'Image', icon: Image },
  { id: 'audio', label: 'Audio', icon: Music2 },
  { id: 'video', label: 'Video', icon: Video },
]

const MEDIA_HISTORY_KEY = 'aios-studio-media-history-v1'
const MEDIA_PROJECTS_KEY = 'aios-studio-media-projects-v1'
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

function formatCreatedAt(value: string) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(date)
}

function MediaStudioPage() {
  const { can } = useAccessControl()
  const canCreate = can('media', 'create')
  const canImport = can('media', 'import')
  const canExport = can('media', 'export')
  const canDelete = can('media', 'delete')
  const location = useLocation()
  const navigate = useNavigate()
  const [kind, setKind] = useState<MediaKind>('image')
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [duration, setDuration] = useState(10)
  const [audioMode, setAudioMode] = useState<'speech' | 'music' | 'instrumental' | 'song'>('speech')
  const [language, setLanguage] = useState('en')
  const [genre, setGenre] = useState('Worship')
  const [audioStyle, setAudioStyle] = useState('Narration')
  const [imageMode, setImageMode] = useState<'sermon_illustration' | 'social_post' | 'thumbnail' | 'poster' | 'background'>('sermon_illustration')
  const [imageResolution, setImageResolution] = useState<'high' | 'ultra' | '2k' | '4k' | '8k'>('high')
  const [videoMode, setVideoMode] = useState<'text_to_video' | 'lyric_video' | 'sermon_clip' | 'scripture_animation'>('text_to_video')
  const [visualStyle, setVisualStyle] = useState('Cinematic')
  const [quality, setQuality] = useState<'draft' | 'standard' | 'high' | 'ultra'>('standard')
  const [resolution, setResolution] = useState<'720p' | '1080p' | '2k' | '4k' | '8k'>('1080p')
  const [generating, setGenerating] = useState(false)
  const [importingVideos, setImportingVideos] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState(loadMediaHistory)
  const [historyFilter, setHistoryFilter] = useState<'all' | MediaKind>('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [historyQuery, setHistoryQuery] = useState('')
  const [historySort, setHistorySort] = useState<'newest' | 'oldest'>('newest')
  const [statusFilter, setStatusFilter] = useState<'all' | MediaGeneration['status']>('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [project, setProject] = useState('General')
  const [projects, setProjects] = useState<string[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(MEDIA_PROJECTS_KEY) ?? '[]') as unknown
      return Array.isArray(stored) ? ['General', ...stored.filter((item): item is string => typeof item === 'string' && item !== 'General')] : ['General']
    } catch { return ['General'] }
  })
  const [visibleLimit, setVisibleLimit] = useState(12)
  const [copiedPromptId, setCopiedPromptId] = useState('')
  const [providerStatus, setProviderStatus] = useState<MediaProviderStatus | null>(null)
  const [refreshingProviders, setRefreshingProviders] = useState(false)
  const [previewResult, setPreviewResult] = useState<MediaGeneration | null>(null)
  const maximumDuration = kind === 'video' ? 60 : 300
  const displayedDuration = Math.min(duration, maximumDuration)
  const durationMinutes = Math.floor(displayedDuration / 60)
  const durationSeconds = displayedDuration % 60
  const pendingIds = useMemo(() => results
    .filter((result) => result.status === 'queued' || result.status === 'processing')
    .map((result) => result.id), [results])
  const pendingKey = pendingIds.join('|')
  const visibleResults = results.filter((result) =>
    (historyFilter === 'all' || result.kind === historyFilter) &&
    (statusFilter === 'all' || result.status === statusFilter) &&
    (projectFilter === 'all' || (result.project || 'General') === projectFilter) &&
    (!favoritesOnly || result.favorite) &&
    (!historyQuery.trim() || result.prompt.toLowerCase().includes(historyQuery.trim().toLowerCase())))
    .sort((left, right) => historySort === 'newest'
      ? (right.createdAt || '').localeCompare(left.createdAt || '')
      : (left.createdAt || '').localeCompare(right.createdAt || ''))
  const displayedResults = visibleResults.slice(0, visibleLimit)
  const previewableResults = visibleResults.filter((result) =>
    Boolean(result.url) && (result.kind === 'image' || result.kind === 'video'))
  const previewPosition = previewResult
    ? previewableResults.findIndex((result) => result.id === previewResult.id) : -1
  const activeCount = results.filter((result) => result.status === 'queued' || result.status === 'processing').length
  const failedCount = results.filter((result) => result.status === 'failed').length

  useEffect(() => {
    setVisibleLimit(12)
  }, [historyFilter, statusFilter, projectFilter, favoritesOnly, historyQuery, historySort])

  useEffect(() => {
    localStorage.setItem(MEDIA_HISTORY_KEY, JSON.stringify(results))
  }, [results])

  useEffect(() => {
    const controller = new AbortController()
    void getMediaGenerations(controller.signal).then((saved) => {
      setResults((current) => saved.reduce<MediaGeneration[]>((merged, job) => {
        const local = merged.find((item) => item.id === job.id)
        return local ? merged.map((item) => item.id === job.id ? { ...local, ...job } : item) : [job, ...merged]
      }, current))
    }).catch(() => { /* Local history remains available while the gateway reconnects. */ })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const state = location.state as { mediaDraft?: {
      kind?: MediaKind; prompt?: string; audioMode?: 'speech' | 'music' | 'instrumental' | 'song'; language?: string
      genre?: string; audioStyle?: string
    } } | null
    const draft = state?.mediaDraft
    if (!draft?.prompt) return
    setKind(draft.kind ?? 'audio')
    setPrompt(draft.prompt)
    if (draft.audioMode) {
      setAudioMode(draft.audioMode)
      setAudioStyle(audioStyles[draft.audioMode][0])
    }
    if (draft.language) setLanguage(draft.language)
    if (draft.genre) setGenre(draft.genre)
    if (draft.audioStyle) setAudioStyle(draft.audioStyle)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  useEffect(() => {
    if (kind !== 'video') return
    const syncCompletedVideos = () => void getWanVideos().then((videos) => {
      setResults((current) => [...videos, ...current.filter((item) => !videos.some((video) => video.id === item.id))])
    }).catch(() => { /* Manual import displays actionable errors; background sync stays quiet. */ })
    window.addEventListener('focus', syncCompletedVideos)
    return () => window.removeEventListener('focus', syncCompletedVideos)
  }, [kind])

  useEffect(() => {
    const controller = new AbortController()
    const refresh = () => void getMediaProviderStatus(controller.signal)
      .then(setProviderStatus).catch(() => setProviderStatus(null))
    refresh()
    const timer = window.setInterval(refresh, 15000)
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [])

  const requiredProvider = kind === 'image' ? providerStatus?.providers.comfy
    : kind === 'audio' && audioMode === 'speech' ? providerStatus?.providers.speech
      : kind === 'audio' ? providerStatus?.providers.aceStep : providerStatus?.providers.wan
  const providerChecking = providerStatus === null
  const providerOffline = !providerChecking && requiredProvider?.available === false
  const providerUnavailable = providerChecking || providerOffline
  const providerLabel = kind === 'image' ? 'ComfyUI' : kind === 'video' ? 'WanGP / LTX-2.3'
    : audioMode === 'speech' ? 'Speech' : 'ACE-Step'

  async function refreshProviderStatus() {
    setRefreshingProviders(true)
    try {
      setProviderStatus(await getMediaProviderStatus())
      setError('')
    } catch {
      setProviderStatus(null)
      setError('Unable to check media providers. Confirm that the AIOS gateway is connected.')
    } finally {
      setRefreshingProviders(false)
    }
  }

  useEffect(() => {
    if (!pendingKey) return
    const controller = new AbortController()
    const ids = pendingKey.split('|')
    async function refresh() {
      const updates = await Promise.allSettled(
        ids.map(async (id) => ({ id, value: await getMediaGeneration(id, controller.signal) })))
      if (controller.signal.aborted) return
      const completed = new Map(updates
        .filter((result): result is PromiseFulfilledResult<{ id: string; value: MediaGeneration }> => result.status === 'fulfilled')
        .map((result) => [result.value.id, result.value.value]))
      updates.forEach((result, index) => {
        const message = result.status === 'rejected'
          ? result.reason instanceof Error ? result.reason.message : String(result.reason || '')
          : ''
        if (result.status === 'rejected' && /not found/i.test(message)) completed.set(ids[index], {
          id: ids[index], kind: 'image', status: 'failed', prompt: '', createdAt: '',
          error: 'This generation belonged to an earlier gateway session. Generate it again.',
        })
      })
      if (completed.size > 0) setResults((current) =>
        current.map((result) => {
          const update = completed.get(result.id)
          return update ? { ...result, ...update, prompt: update.prompt || result.prompt,
            createdAt: update.createdAt || result.createdAt, kind: result.kind } : result
        }))
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 2500)
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [pendingKey])

  async function submit() {
    if (!canCreate) { setError('Your profile cannot generate media.'); return }
    const normalized = prompt.trim()
    if (!normalized || generating) return
    setGenerating(true)
    setError('')
    try {
      const result = await generateMedia({ kind, prompt: normalized, project,
        aspectRatio: kind !== 'audio' ? aspectRatio : undefined,
        durationSeconds: kind !== 'image' ? duration : undefined,
        audioMode: kind === 'audio' ? audioMode : undefined,
        language: kind === 'audio' && (audioMode === 'speech' || audioMode === 'song')
          ? language : undefined,
        genre: kind === 'audio' && audioMode !== 'speech' ? genre : undefined,
        audioStyle: kind === 'audio' ? audioStyle : undefined,
        imageMode: kind === 'image' ? imageMode : undefined,
        imageResolution: kind === 'image' ? imageResolution : undefined,
        videoMode: kind === 'video' ? videoMode : undefined,
        visualStyle: kind !== 'audio' ? visualStyle : undefined,
        quality: kind === 'image' ? quality : undefined,
        resolution: kind === 'video' ? resolution : undefined })
      const enriched: MediaGeneration = { ...result, project, settings: {
        aspectRatio, durationSeconds: duration, audioMode, language, genre, audioStyle,
        imageMode, imageResolution, videoMode, visualStyle, quality, resolution,
      } }
      setResults((current) => [enriched, ...current])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to generate media.')
    } finally { setGenerating(false) }
  }

  function requestFor(result: MediaGeneration): MediaGenerationRequest {
    const settings = result.settings || {}
    return {
      kind: result.kind, prompt: result.prompt, project: result.project || 'General',
      aspectRatio: typeof settings.aspectRatio === 'string' ? settings.aspectRatio : undefined,
      durationSeconds: typeof settings.durationSeconds === 'number' ? settings.durationSeconds : undefined,
      audioMode: typeof settings.audioMode === 'string' ? settings.audioMode as MediaGenerationRequest['audioMode'] : undefined,
      language: typeof settings.language === 'string' ? settings.language : undefined,
      genre: typeof settings.genre === 'string' ? settings.genre : undefined,
      audioStyle: typeof settings.audioStyle === 'string' ? settings.audioStyle : undefined,
      imageMode: typeof settings.imageMode === 'string' ? settings.imageMode as MediaGenerationRequest['imageMode'] : undefined,
      imageResolution: typeof settings.imageResolution === 'string' ? settings.imageResolution as MediaGenerationRequest['imageResolution'] : undefined,
      videoMode: typeof settings.videoMode === 'string' ? settings.videoMode as MediaGenerationRequest['videoMode'] : undefined,
      visualStyle: typeof settings.visualStyle === 'string' ? settings.visualStyle : undefined,
      quality: typeof settings.quality === 'string' ? settings.quality as MediaGenerationRequest['quality'] : undefined,
      resolution: typeof settings.resolution === 'string' ? settings.resolution as MediaGenerationRequest['resolution'] : undefined,
    }
  }

  async function retryResult(result: MediaGeneration) {
    if (!canCreate) { setError('Your profile cannot generate media.'); return }
    setError('')
    try {
      const retry = await generateMedia(requestFor(result))
      setResults((current) => [{ ...retry, project: result.project, settings: result.settings }, ...current])
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to retry this generation.') }
  }

  async function cancelResult(result: MediaGeneration) {
    try {
      const cancelled = await cancelMediaGeneration(result.id)
      setResults((current) => current.map((item) => item.id === result.id ? { ...item, ...cancelled } : item))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to cancel this generation.') }
  }

  async function downloadResult(result: MediaGeneration) {
    if (!result.url) return
    try {
      const response = await fetch(result.url)
      if (!response.ok) throw new Error(`File unavailable (${response.status}).`)
      const blob = await response.blob()
      const extension = blob.type.includes('png') ? 'png' : blob.type.includes('jpeg') ? 'jpg'
        : blob.type.includes('mpeg') ? 'mp3' : blob.type.includes('wav') ? 'wav'
          : blob.type.includes('webm') ? 'webm' : result.kind === 'video' ? 'mp4' : 'bin'
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `AIOS-${result.kind}-${result.id.slice(0, 8)}.${extension}`; link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (cause) { setError(cause instanceof Error ? `Download failed: ${cause.message}` : 'Download failed.') }
  }

  async function openVideoProvider() {
    const normalized = prompt.trim()
    if (normalized && navigator.clipboard) {
      try { await navigator.clipboard.writeText(normalized) } catch { /* The provider still opens if clipboard access is denied. */ }
    }
    const providerWindow = window.open('http://127.0.0.1:42003/', 'aios-wangp')
    providerWindow?.focus()
  }

  function reuseResult(result: MediaGeneration) {
    setKind(result.kind)
    setPrompt(result.prompt)
    setProject(result.project || 'General')
    const settings = result.settings
    if (settings) {
      if (typeof settings.aspectRatio === 'string') setAspectRatio(settings.aspectRatio)
      if (typeof settings.durationSeconds === 'number') setDuration(settings.durationSeconds)
      if (typeof settings.visualStyle === 'string') setVisualStyle(settings.visualStyle)
    }
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function addProject() {
    const name = window.prompt('Project name')?.trim()
    if (!name) return
    const existing = projects.find((item) => item.toLocaleLowerCase() === name.toLocaleLowerCase())
    const selected = existing || name
    const next = existing ? projects : [...projects, name].sort((left, right) => left.localeCompare(right))
    setProjects(next); setProject(selected)
    localStorage.setItem(MEDIA_PROJECTS_KEY, JSON.stringify(next.filter((item) => item !== 'General')))
  }

  function removeResult(id: string) {
    if (!canDelete) { setError('Your profile cannot remove creations.'); return }
    setResults((current) => current.filter((result) => result.id !== id))
  }

  function clearHistory() {
    if (!canDelete) { setError('Your profile cannot clear media history.'); return }
    if (!window.confirm(`Clear all ${results.length} creations, including favorites? This cannot be undone.`)) return
    setResults([])
    setPreviewResult(null)
  }

  function clearUnstarred() {
    if (!canDelete) { setError('Your profile cannot clear media history.'); return }
    const count = results.filter((result) => !result.favorite).length
    if (!count || !window.confirm(`Clear ${count} unstarred creation${count === 1 ? '' : 's'}? Favorites will be kept.`)) return
    setResults((current) => current.filter((result) => result.favorite))
    if (previewResult && !previewResult.favorite) setPreviewResult(null)
  }

  function toggleFavorite(id: string) {
    setResults((current) => current.map((result) =>
      result.id === id ? { ...result, favorite: !result.favorite } : result))
  }

  async function copyPrompt(result: MediaGeneration) {
    try {
      await navigator.clipboard.writeText(result.prompt)
      setCopiedPromptId(result.id)
      window.setTimeout(() => setCopiedPromptId((current) => current === result.id ? '' : current), 1800)
    } catch {
      setError('The browser could not copy this prompt. Select and copy the prompt manually.')
    }
  }

  function navigatePreview(direction: -1 | 1) {
    if (!previewResult || previewableResults.length < 2) return
    const currentIndex = previewableResults.findIndex((result) => result.id === previewResult.id)
    const nextIndex = (Math.max(0, currentIndex) + direction + previewableResults.length) % previewableResults.length
    setPreviewResult(previewableResults[nextIndex])
  }

  useEffect(() => {
    if (!previewResult) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setPreviewResult(null)
      if (event.key === 'ArrowLeft') navigatePreview(-1)
      if (event.key === 'ArrowRight') navigatePreview(1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  function exportHistory() {
    if (!canExport) { setError('Your profile cannot export media history.'); return }
    const file = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(file)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `aios-media-history-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function importHistory(file: File) {
    if (!canImport) { setError('Your profile cannot restore media history.'); return }
    try {
      const value: unknown = JSON.parse(await file.text())
      if (!Array.isArray(value)) throw new Error('The selected file is not an AIOS media-history backup.')
      const imported = value.filter((item): item is MediaGeneration => typeof item === 'object' && item !== null &&
        typeof item.id === 'string' && ['image', 'audio', 'video'].includes(String(item.kind)) &&
        ['queued', 'processing', 'completed', 'failed'].includes(String(item.status)) && typeof item.prompt === 'string')
      if (!imported.length && value.length) throw new Error('No valid media-history entries were found.')
      setResults((current) => [...imported, ...current.filter((item) => !imported.some((entry) => entry.id === item.id))])
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to restore media history.')
    }
  }

  async function importWanVideos() {
    if (!canImport) { setError('Your profile cannot import completed videos.'); return }
    setImportingVideos(true)
    setError('')
    try {
      const videos = await getWanVideos()
      setResults((current) => [...videos, ...current.filter((item) => !videos.some((video) => video.id === item.id))])
      setHistoryFilter('video')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to import LTX videos.')
    } finally { setImportingVideos(false) }
  }

  return <WorkspaceLayout title="Media Studio"
    subtitle="Create ministry images, audio, and video through your configured AIOS providers."
    icon={<Sparkles size={25} />} statusBar={<span>Generated media remains under your configured provider and storage policies.</span>}
    className="media-studio-page">
    <div className="media-studio-grid">
      <section className="media-creator">
        <div className="media-provider-heading"><strong>Media providers</strong><button type="button"
          onClick={() => void refreshProviderStatus()} disabled={refreshingProviders}><RotateCcw className={refreshingProviders ? 'spin' : ''} size={13} />
          {refreshingProviders ? 'Checking…' : 'Refresh'}</button></div>
        <div className="media-provider-status" aria-label="Media provider status">
          {[
            ['ComfyUI', providerStatus?.providers.comfy],
            ['ACE-Step', providerStatus?.providers.aceStep],
            ['Speech', providerStatus?.providers.speech],
            ['LTX-2.3', providerStatus?.providers.wan],
          ].map(([label, status]) => <span className={typeof status === 'object' && status.available ? 'available' : ''} key={String(label)}>
            <i /><strong>{String(label)}</strong><small>{!providerStatus ? 'Checking' : typeof status === 'object' && status.available ? 'Ready' : 'Offline'}</small>
          </span>)}
        </div>
        <div className="media-kind-tabs">{kinds.map((item) => {
          const Icon = item.icon
          return <button className={kind === item.id ? 'active' : ''} type="button"
            onClick={() => setKind(item.id)} key={item.id}><Icon size={17} /> {item.label}</button>
        })}</div>
        <label className="media-prompt">Describe what you want to create
          <textarea rows={7} value={prompt} onChange={(event) => setPrompt(event.target.value)}
            placeholder={`Describe the ${kind} for your ministry project...`} /></label>
        <div className="media-project-picker"><label>Project<select value={project} onChange={(event) => setProject(event.target.value)}>
          {projects.map((item) => <option key={item}>{item}</option>)}
        </select></label><button type="button" onClick={addProject}><FolderPlus size={15} /> New project</button></div>
        <div className="media-options">
          {kind === 'image' && <label>Purpose<select value={imageMode}
            onChange={(event) => setImageMode(event.target.value as typeof imageMode)}>
            <option value="sermon_illustration">Sermon Illustration</option>
            <option value="social_post">Social Post</option><option value="thumbnail">Thumbnail</option>
            <option value="poster">Poster</option><option value="background">Background</option>
          </select></label>}
          {kind === 'video' && <label>Format<select value={videoMode}
            onChange={(event) => setVideoMode(event.target.value as typeof videoMode)}>
            <option value="text_to_video">Text to Video</option><option value="lyric_video">Lyric Video</option>
            <option value="sermon_clip">Sermon Clip</option><option value="scripture_animation">Scripture Animation</option>
          </select></label>}
          {kind !== 'audio' && <label>Style<select value={visualStyle}
            onChange={(event) => setVisualStyle(event.target.value)}>
            {['Cinematic', 'Photorealistic', 'Illustration', 'Watercolor', 'Minimal',
              'Stained Glass', 'Documentary'].map((item) => <option key={item}>{item}</option>)}
          </select></label>}
          {kind === 'image' && <label>Quality<select value={quality}
            onChange={(event) => setQuality(event.target.value as typeof quality)}>
            <option value="draft">Draft</option><option value="standard">Standard</option>
            <option value="high">High</option><option value="ultra">Ultra</option>
          </select></label>}
          {kind === 'image' && <label>Output size<select value={imageResolution}
            onChange={(event) => setImageResolution(event.target.value as typeof imageResolution)}>
            <option value="high">High</option><option value="ultra">Ultra</option>
            <option value="2k">2K</option><option value="4k">4K</option><option value="8k">8K</option>
          </select></label>}
          {kind === 'video' && <label>Resolution<select value={resolution}
            onChange={(event) => setResolution(event.target.value as typeof resolution)}>
            <option value="720p">High (720p)</option><option value="1080p">Ultra (1080p)</option>
            <option value="2k">2K</option><option value="4k">4K</option><option value="8k">8K</option>
          </select></label>}
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
        {providerChecking && <p className="media-provider-warning">Checking {providerLabel} availability…</p>}
        {providerOffline && <p className="media-provider-warning">{providerLabel} is offline. Start the provider and wait for the status to become Ready.</p>}
        {kind === 'video' && requiredProvider?.available && <p className="media-provider-warning">
          LTX-2.3 Q4 is ready. Your prompt is copied when the generator opens; completed videos sync when you return.
        </p>}
        <button className="media-generate" type="button"
          disabled={!canCreate || !prompt.trim() || generating || providerUnavailable}
          title={!canCreate ? 'Your profile cannot generate media.' : undefined}
          onClick={() => kind === 'video' ? void openVideoProvider() : void submit()}>
          {generating ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
          {generating ? 'Generating...' : kind === 'video' ? 'Open LTX-2.3 generator' : `Generate ${kind}`}
        </button>
        {kind === 'video' && canImport && <button className="media-import" type="button" disabled={importingVideos || providerUnavailable}
          onClick={() => void importWanVideos()}><FolderDown size={16} />
          {importingVideos ? 'Importing...' : 'Import completed LTX videos'}</button>}
      </section>
      <section className="media-results"><div className="media-production-status">
        <div><strong>{activeCount}</strong><span>Active jobs</span></div><div><strong>{results.filter((item) => item.status === 'completed').length}</strong><span>Completed</span></div><div className={failedCount ? 'attention' : ''}><strong>{failedCount}</strong><span>Need attention</span></div>
        <p>{activeCount ? 'Jobs continue through page refreshes and are recovered after reopening Media Studio.' : 'Queue ready. New jobs and their settings are saved automatically.'}</p>
      </div><header><h2>Production history</h2><div>
        {canExport && results.length > 0 && <button type="button" onClick={exportHistory}><Download size={12} /> Export</button>}
        {canImport && <label className="media-history-import"><Upload size={12} /> Restore<input type="file" accept="application/json,.json"
          onChange={(event) => { const file = event.target.files?.[0]; if (file) void importHistory(file); event.target.value = '' }} /></label>}
        {canDelete && results.some((result) => result.favorite) && results.some((result) => !result.favorite) &&
          <button type="button" onClick={clearUnstarred}>Clear unstarred</button>}
        {canDelete && results.length > 0 && <button type="button" onClick={clearHistory}>Clear all</button>}
        <span>{visibleResults.length}</span></div></header>
        {results.length > 0 && <div className="media-history-filters" aria-label="Filter recent creations">
          {(['all', 'image', 'audio', 'video'] as const).map((filter) =>
            <button className={historyFilter === filter ? 'active' : ''} type="button" key={filter}
              onClick={() => setHistoryFilter(filter)}>{filter}</button>)}
          <button className={favoritesOnly ? 'active favorite' : 'favorite'} type="button"
            onClick={() => setFavoritesOnly((current) => !current)} aria-pressed={favoritesOnly}>
            <Star size={12} fill={favoritesOnly ? 'currentColor' : 'none'} /> Favorites
          </button>
          <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} aria-label="Filter by project">
            <option value="all">All projects</option>{projects.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} aria-label="Filter by status">
            <option value="all">All statuses</option><option value="queued">Queued</option><option value="processing">Processing</option>
            <option value="completed">Completed</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option>
          </select>
          <label><Search size={13} /><input value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)}
            placeholder="Search prompts" aria-label="Search creation prompts" /></label>
          <select value={historySort} onChange={(event) => setHistorySort(event.target.value as typeof historySort)}
            aria-label="Sort recent creations"><option value="newest">Newest</option><option value="oldest">Oldest</option></select>
        </div>}
        {visibleResults.length === 0 ? <div className="media-empty"><Sparkles size={28} /><h3>{results.length ? `No ${historyFilter} creations yet` : 'Your creations will appear here'}</h3>
          <p>Connect an AIOS media provider to begin generating.</p></div> :
          <><div className="media-result-list">{displayedResults.map((result) => <article key={result.id}>
            {result.url && result.kind === 'image' && <button className="media-preview-button" type="button"
              onClick={() => setPreviewResult(result)} aria-label="Enlarge generated image">
              <img src={result.url} alt={result.prompt} /><Maximize2 size={18} /></button>}
            {result.url && result.kind === 'audio' && <audio controls src={result.url} />}
            {result.url && result.kind === 'video' && <button className="media-preview-button" type="button"
              onClick={() => setPreviewResult(result)} aria-label="Enlarge generated video">
              <video src={result.url} /><Maximize2 size={18} /></button>}
            {(result.status === 'queued' || result.status === 'processing') && <div className="media-progress">
              <div><span style={{ width: `${result.progress ?? 10}%` }} /></div><small>{result.progress ?? 10}%</small>
            </div>}
            <div><div className="media-result-meta"><span>{result.kind} - {result.status}</span>
              <time dateTime={result.createdAt} title={formatCreatedAt(result.createdAt)}>{formatCreatedAt(result.createdAt)}</time>
            </div><small className="media-result-project">{result.project || 'General'}</small><p className="media-result-prompt" title={result.prompt}>{result.prompt}</p>
              {result.error && <p className="media-result-error">{result.error}</p>}
              <div className="media-result-actions">
                {result.url && <button type="button" onClick={() => void downloadResult(result)}><Download size={14} /> Download</button>}
                <button type="button" onClick={() => reuseResult(result)}><RotateCcw size={13} /> Reuse prompt</button>
                {(result.status === 'failed' || result.status === 'cancelled') && <button type="button" onClick={() => void retryResult(result)}><Sparkles size={13} /> Retry now</button>}
                {(result.status === 'queued' || result.status === 'processing') && <button type="button" onClick={() => void cancelResult(result)}><Ban size={13} /> Cancel</button>}
                <button type="button" onClick={() => void copyPrompt(result)}>
                  {copiedPromptId === result.id ? <Check size={13} /> : <Clipboard size={13} />}
                  {copiedPromptId === result.id ? 'Copied' : 'Copy prompt'}
                </button>
                <button className={result.favorite ? 'is-favorite' : ''} type="button"
                  onClick={() => toggleFavorite(result.id)}
                  aria-label={result.favorite ? 'Remove from favorites' : 'Add to favorites'}
                  title={result.favorite ? 'Remove from favorites' : 'Add to favorites'}>
                  <Star size={13} fill={result.favorite ? 'currentColor' : 'none'} />
                </button>
                <button type="button" onClick={() => removeResult(result.id)} aria-label="Remove creation"><Trash2 size={13} /></button>
              </div></div>
          </article>)}</div>
          {displayedResults.length < visibleResults.length && <button className="media-show-more" type="button"
            onClick={() => setVisibleLimit((current) => current + 12)}>
            Show more ({visibleResults.length - displayedResults.length} remaining)
          </button>}</>}
      </section>
    </div>
    {previewResult?.url && <div className="media-lightbox" role="dialog" aria-modal="true" aria-label="Media preview"
      onClick={() => setPreviewResult(null)}>
      <button type="button" onClick={() => setPreviewResult(null)} aria-label="Close preview"><X size={22} /></button>
      {previewableResults.length > 1 && <button className="media-lightbox-previous" type="button"
        onClick={(event) => { event.stopPropagation(); navigatePreview(-1) }} aria-label="Previous creation">
        <ChevronLeft size={25} />
      </button>}
      {previewableResults.length > 1 && <button className="media-lightbox-next" type="button"
        onClick={(event) => { event.stopPropagation(); navigatePreview(1) }} aria-label="Next creation">
        <ChevronRight size={25} />
      </button>}
      <div onClick={(event) => event.stopPropagation()}>
        {previewResult.kind === 'image' && <img src={previewResult.url} alt={previewResult.prompt} />}
        {previewResult.kind === 'video' && <video src={previewResult.url} controls autoPlay />}
        {previewableResults.length > 1 && <small className="media-lightbox-position">
          {previewPosition + 1} of {previewableResults.length}
        </small>}
        <p>{previewResult.prompt}</p>
      </div>
    </div>}
  </WorkspaceLayout>
}

export default MediaStudioPage
