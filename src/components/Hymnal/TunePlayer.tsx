import { Pause, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Hymn } from '../../types/hymnal'
import { midiToFrequency, tuneDuration } from '../../utils/tune'

function TunePlayer({ hymn }: { hymn: Hymn }) {
  const [playing, setPlaying] = useState(false)
  const [recording, setRecording] = useState<'singing' | 'piano'>(hymn.singingAudioUrl ? 'singing' : 'piano')
  const contextRef = useRef<AudioContext | null>(null)
  const sourcesRef = useRef<OscillatorNode[]>([])
  const timerRef = useRef<number | null>(null)

  function stop() {
    sourcesRef.current.forEach((source) => { try { source.stop() } catch { /* stopped */ } })
    sourcesRef.current = []
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
    setPlaying(false)
  }

  useEffect(() => {
    stop()
    setRecording(hymn.singingAudioUrl ? 'singing' : 'piano')
  }, [hymn.id, hymn.singingAudioUrl])

  function play() {
    if (!hymn.tune) return
    stop()
    const context = contextRef.current ?? new AudioContext()
    contextRef.current = context
    void context.resume()
    let start = context.currentTime + 0.06
    for (const note of hymn.tune.notes) {
      const duration = note.beats * 60 / hymn.tune.bpm
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'triangle'
      oscillator.frequency.value = midiToFrequency(note.midi)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.16, start + 0.025)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(0.04, duration - 0.03))
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(start)
      oscillator.stop(start + duration)
      sourcesRef.current.push(oscillator)
      start += duration
    }
    setPlaying(true)
    timerRef.current = window.setTimeout(
      stop, tuneDuration(hymn.tune.notes, hymn.tune.bpm) * 1000 + 100)
  }

  const archivedAudio = recording === 'singing' ? hymn.singingAudioUrl : hymn.audioUrl
  if (hymn.audioUrl || hymn.singingAudioUrl) return <div className="hymnal-recording-player">
    <div className="hymnal-recording-tabs" aria-label="Hymn recording">
      {hymn.singingAudioUrl && <button className={recording === 'singing' ? 'active' : ''} type="button"
        onClick={() => setRecording('singing')}>Singing</button>}
      {hymn.audioUrl && <button className={recording === 'piano' ? 'active' : ''} type="button"
        onClick={() => setRecording('piano')}>Piano tune</button>}
    </div>
    <audio className="hymnal-audio" controls preload="none" src={archivedAudio} key={archivedAudio} />
  </div>
  if (!hymn.tune) return <p className="hymnal-media-unavailable">Practice tune not available yet.</p>
  return <button className="hymnal-tune-button" type="button" onClick={playing ? stop : play}>
    {playing ? <Pause size={16} /> : <Play size={16} />}
    {playing ? 'Stop practice tune' : 'Play practice tune'}
  </button>
}
export default TunePlayer
