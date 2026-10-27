import { ArrowLeft, ArrowRight, MousePointerClick, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import './StudioPanels.css'

const NAMED_KEYS = ['enter', 'tab', 'escape', 'backspace', 'space', 'delete', 'home', 'end', 'pageup', 'pagedown', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'] as const

/**
 * The audience window is a full-screen page the operator cannot see while it is on the projector,
 * so this mirrors it back and forwards clicks and keystrokes into it. A sign-in typed here is kept
 * by the audience window's own profile, so the same login is still valid next meeting.
 */
export default function AudienceMonitor() {
  const desktop = window.lampstandDesktop?.presentation
  const [following, setFollowing] = useState(false)
  const [frame, setFrame] = useState('')
  const [paste, setPaste] = useState('')
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!following || !desktop) return
    let cancelled = false
    const pull = () => { void desktop.capture().then((image) => { if (!cancelled) setFrame(image) }).catch(() => undefined) }
    pull()
    const timer = window.setInterval(pull, 1200)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [following, desktop])

  if (!desktop) return <p className="studio-note">The audience monitor needs the desktop app - it mirrors the projector window so you can sign in to a protected page without leaving the studio.</p>

  const at = (event: { clientX: number; clientY: number }) => {
    const box = stageRef.current?.getBoundingClientRect()
    if (!box) return { x: 0, y: 0 }
    return { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height }
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const named = NAMED_KEYS.find((key) => key === event.key.toLowerCase())
    if (named) { event.preventDefault(); void desktop?.sendToAudience({ type: 'key', value: named }); return }
    if (event.key.length === 1) { event.preventDefault(); void desktop?.sendToAudience({ type: 'text', value: event.key }) }
  }

  return <div>
    <div className="studio-actions-row">
      <button type="button" className="primary-action" onClick={() => setFollowing((value) => !value)}><MousePointerClick size={16}/>{following ? 'Stop mirroring' : 'Mirror the audience screen'}</button>
      <button type="button" onClick={() => void desktop?.command('reload')} title="Reload the audience page"><RotateCcw size={15}/> Reload</button>
      <button type="button" onClick={() => void desktop?.command('back')} title="Go back in the audience page"><ArrowLeft size={15}/></button>
      <button type="button" onClick={() => void desktop?.command('forward')} title="Go forward in the audience page"><ArrowRight size={15}/></button>
    </div>
    <div className="monitor-stage" ref={stageRef} tabIndex={0} role="application" aria-label="Audience screen mirror"
      onKeyDown={onKeyDown}
      onMouseMove={(event) => { const { x, y } = at(event); void desktop?.sendToAudience({ type: 'move', x, y }) }}
      onClick={(event) => { const { x, y } = at(event); void desktop?.sendToAudience({ type: 'click', x, y }); stageRef.current?.focus() }}
      onDoubleClick={(event) => { const { x, y } = at(event); void desktop?.sendToAudience({ type: 'double-click', x, y }) }}
      onWheel={(event) => { const { x, y } = at(event); void desktop?.sendToAudience({ type: 'wheel', x, y, deltaY: event.deltaY }) }}>
      {frame ? <img src={frame} alt="What the audience screen is showing" /> : <div className="monitor-empty">{following ? 'Waiting for the audience window…' : 'Mirror the audience screen to click into a login page, a map, or a meeting.'}</div>}
    </div>
    <div className="monitor-keys">
      {(['tab', 'enter', 'backspace', 'escape'] as const).map((key) => <button type="button" key={key} onClick={() => void desktop?.sendToAudience({ type: 'key', value: key })}>{key[0].toUpperCase() + key.slice(1)}</button>)}
    </div>
    <div className="field-row">
      <label>Paste into the focused field<input value={paste} onChange={(event) => setPaste(event.target.value)} placeholder="Address, meeting link, or a long text" /></label>
      <button className="primary-action" disabled={!paste} onClick={() => { void desktop?.sendToAudience({ type: 'text', value: paste }); setPaste('') }}><MousePointerClick size={15}/> Send</button>
    </div>
    <p className="studio-note">Click the mirror to focus the real page, then type - every keystroke goes to the audience window, nothing is stored by Lampstand.</p>
  </div>
}
