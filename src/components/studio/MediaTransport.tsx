import { Maximize2, Pause, Play, Radio, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { MediaSlideSource } from '../../utils/mediaSlide'
import './StudioPanels.css'

/**
 * The projector window is full-screen and has no controls of its own, so the operator drives the
 * player from here: the studio sends one command to the media already on air.
 */
export default function MediaTransport({ media, onPage }: { media?: MediaSlideSource; onPage: (delta: -1 | 1) => void }) {
  const desktop = window.lampstandDesktop?.presentation
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  useEffect(() => setMuted(Boolean(media?.muted)), [media?.muted])
  if (!media || media.kind === 'image') return null
  if (!desktop) return <div className="transport-bar"><span className="transport-label"><Radio size={13}/>Media</span><span>The projector window plays this on its own - transport controls need the desktop app.</span></div>

  const playable = media.kind === 'video' || media.kind === 'audio'

  return <div className="transport-bar">
    <span className="transport-label"><Radio size={13}/>{playable ? 'Media transport' : 'Document'}</span>
    {playable && <>
      <button type="button" onClick={() => void desktop.command('toggle')}><Play size={15}/> Play</button>
      <button type="button" onClick={() => void desktop.command('pause')}><Pause size={15}/> Pause</button>
      <button type="button" onClick={() => void desktop.command('restart')}><RotateCcw size={15}/> Restart</button>
      <button type="button" onClick={() => { const next = !muted; setMuted(next); void desktop.command(next ? 'mute' : 'unmute') }}>{muted ? <VolumeX size={15}/> : <Volume2 size={15}/>} {muted ? 'Unmute' : 'Mute'}</button>
      <label>Level<input type="range" min={0} max={100} value={Math.round(volume * 100)} onChange={(event) => { const next = Number(event.target.value) / 100; setVolume(next); void desktop.command('volume', next) }}/></label>
      {media.kind === 'video' && <button type="button" onClick={() => void desktop.command('fullscreen')}><Maximize2 size={15}/> Fullscreen</button>}
    </>}
    {media.kind === 'document' && <>
      <button type="button" onClick={() => onPage(-1)}>Previous page</button>
      <strong>Page {Math.max(1, Number(media.page) || 1)}</strong>
      <button type="button" onClick={() => onPage(1)}>Next page</button>
      <button type="button" onClick={() => void desktop.command('reload')}><RotateCcw size={15}/> Reload</button>
    </>}
  </div>
}
