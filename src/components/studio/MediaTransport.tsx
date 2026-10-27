import { ChevronLeft, ChevronRight, Clapperboard, Maximize2, Pause, Play, Radio, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { readPresentationPrefs, writePresentationPrefs } from '../PresentOnDisplay'
import type { AudienceMediaState } from '../../types/desktop'
import type { MediaSlideSource } from '../../utils/mediaSlide'
import { formatMediaTime } from '../../utils/mediaTime'
import './StudioPanels.css'

/** The projector window is the clock and the speaker, so the console asks it for its position twice a second. */
const POLL_MS = 500

/**
 * The projector window is full-screen and has no controls of its own, so the operator drives the
 * player from here: the studio sends one command to the media already on air and reads its position back.
 */
export default function MediaTransport({ media, onPage }: { media?: MediaSlideSource; onPage: (delta: -1 | 1) => void }) {
  const desktop = window.lampstandDesktop?.presentation
  const [state, setState] = useState<AudienceMediaState | null>(null)
  const [level, setLevel] = useState(() => readPresentationPrefs().mediaLevel)
  const [muted, setMuted] = useState(false)
  const [scrub, setScrub] = useState<number | null>(null)
  const levelTouched = useRef(0)
  const playable = media?.kind === 'video' || media?.kind === 'audio'

  useEffect(() => setMuted(Boolean(media?.muted)), [media?.muted])

  useEffect(() => {
    setScrub(null)
    if (!desktop || !playable) return
    let alive = true
    const ask = async () => {
      const next = await desktop.mediaState().catch(() => null)
      if (!alive || !next) return
      setState(next)
      // A slider the operator has just moved outranks the reading still in flight.
      if (Date.now() - levelTouched.current > 1200) setLevel(next.volume)
    }
    void ask()
    const timer = setInterval(() => void ask(), POLL_MS)
    return () => { alive = false; clearInterval(timer) }
  }, [desktop, playable, media?.name])

  if (!media || media.kind === 'image') return null
  if (!desktop) return <div className="transport-bar"><span className="transport-label"><Radio size={13}/>Media</span><span>The projector window plays this on its own - transport controls need the desktop app.</span></div>

  if (!playable && media.kind === 'deck') {
    const total = media.pages?.length || 0
    const page = Math.min(total, Math.max(1, Number(media.page) || 1))
    return <div className="transport-bar">
      <span className="transport-label"><Clapperboard size={13}/>PowerPoint</span>
      <button type="button" title="Previous slide" disabled={page <= 1} onClick={() => onPage(-1)}><ChevronLeft size={15}/></button>
      <span className="transport-time">{page} / {total}</span>
      <button type="button" title="Next slide" disabled={page >= total} onClick={() => onPage(1)}><ChevronRight size={15}/></button>
      <button type="button" title="Redraw this slide on the projector" onClick={() => void desktop.command('reload')}><RotateCcw size={15}/></button>
    </div>
  }

  if (!playable) return <div className="transport-bar">
    <span className="transport-label"><Radio size={13}/>Document</span>
    <button type="button" title="Previous page" onClick={() => onPage(-1)}>‹ Prev</button>
    <strong>Page {Math.max(1, Number(media.page) || 1)}</strong>
    <button type="button" title="Next page" onClick={() => onPage(1)}>Next ›</button>
    <button type="button" title="Reload this page on the projector" onClick={() => void desktop.command('reload')}><RotateCcw size={15}/></button>
  </div>

  const duration = state?.duration || 0
  const position = scrub !== null ? scrub * duration : state?.time || 0
  const progress = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0
  const isPlaying = Boolean(state?.playing)

  return <div className="transport-bar">
    <span className="transport-label"><Radio size={13}/>Media transport</span>
    <button type="button" title={isPlaying ? 'Pause' : 'Play'} onClick={() => { void desktop.command('toggle'); setState(null) }}>
      {isPlaying ? <Pause size={15}/> : <Play size={15}/>}
    </button>
    <button type="button" title="Restart from the beginning" onClick={() => void desktop.command('restart')}><RotateCcw size={15}/></button>
    <span className="transport-time">{formatMediaTime(position)}{duration > 0 ? ` / ${formatMediaTime(duration)}` : ''}</span>
    <label className="transport-progress" title="Drag to move the projector to that moment">
      <input type="range" aria-label="Position" min={0} max={1000} value={Math.round(progress * 1000)} disabled={duration <= 0}
        onChange={(event) => setScrub(Number(event.target.value) / 1000)}
        onPointerUp={() => { if (scrub !== null) void desktop.command('seek', scrub); setScrub(null) }}
        onKeyDown={(event) => { if (event.key === 'Enter' && scrub !== null) { void desktop.command('seek', scrub); setScrub(null) } }}/>
    </label>
    <button type="button" title={muted ? 'Unmute' : 'Mute'} onClick={() => { const next = !muted; setMuted(next); levelTouched.current = Date.now(); void desktop.command(next ? 'mute' : 'unmute') }}>
      {muted ? <VolumeX size={15}/> : <Volume2 size={15}/>}
    </button>
    <label>Level<input type="range" min={0} max={100} value={Math.round(level * 100)} onChange={(event) => { const next = Number(event.target.value) / 100; setLevel(next); levelTouched.current = Date.now(); writePresentationPrefs({ mediaLevel: next }); void desktop.command('volume', next) }}/></label>
    {media.kind === 'video' && <button type="button" title="Fullscreen the video on the projector" onClick={() => void desktop.command('fullscreen')}><Maximize2 size={15}/></button>}
  </div>
}
