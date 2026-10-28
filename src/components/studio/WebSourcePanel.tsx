import { ArrowLeft, ArrowRight, ChevronDown, MapPin, Monitor, Plus, Radio, RotateCcw, Save, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { detectWebSource, mapsUrl, normalizeWebUrl, webProjectionUrl, webSourceLabel, type WebShortcut } from '../../utils/webSources'
import type { NewQueueItem } from '../../utils/presentationQueue'
import type { StagedWebState } from '../../types/desktop'
import AudienceMonitor from './AudienceMonitor'
import './StudioPanels.css'

const SHORTCUTS_KEY = 'lampstand.presentation.webShortcuts.v1'

const DEFAULT_SHORTCUTS: WebShortcut[] = [
  { id: 'webcast', label: 'LSM Webcast (sign in once)', url: 'https://www.lsmwebcast.com/', kind: 'web' },
  { id: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/', kind: 'youtube' },
  { id: 'meet', label: 'Google Meet', url: 'https://meet.google.com/', kind: 'meet' },
  { id: 'zoom', label: 'Zoom', url: 'https://zoom.us/', kind: 'zoom' },
  { id: 'teams', label: 'Microsoft Teams', url: 'https://teams.microsoft.com/', kind: 'web' },
]

const readShortcuts = (): WebShortcut[] => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(SHORTCUTS_KEY) ?? 'null') as WebShortcut[] | null
    return Array.isArray(stored) && stored.length ? stored : DEFAULT_SHORTCUTS
  } catch { return DEFAULT_SHORTCUTS }
}

const hostLabel = (url: URL) => url.hostname.replace(/^www\./, '').replace(/\.[a-z]{2,}$/i, (suffix) => suffix.toUpperCase())

/**
 * Anything a browser can show can be the audience output: a map, a stream, a meeting. The URL is
 * loaded into the projector window itself, so the page keeps its own player, chat and controls.
 * A page can be opened on the operator's own screen first, so a sign-in or a seat is chosen where
 * the room cannot see it; the projector shares that session.
 */
export default function WebSourcePanel({ onAdd, onNotice, onProject }: { onAdd: (item: NewQueueItem) => void; onNotice: (message: string) => void; onProject: (url: string, title: string) => Promise<boolean> }) {
  const desktop = window.lampstandDesktop?.presentation
  const [address, setAddress] = useState('')
  const [mapQuery, setMapQuery] = useState('')
  const [mapZoom, setMapZoom] = useState(14)
  const [basemap, setBasemap] = useState<'roadmap' | 'satellite' | 'hybrid' | 'terrain'>('roadmap')
  const [shortcuts, setShortcuts] = useState<WebShortcut[]>(readShortcuts)
  const [monitorOpen, setMonitorOpen] = useState(false)
  const [staged, setStaged] = useState<StagedWebState | null>(null)

  const typedUrl = normalizeWebUrl(address)
  const mapCandidate = mapQuery.trim() ? mapsUrl(mapQuery, { zoom: mapZoom, basemap }) : ''
  const target = mapCandidate || webProjectionUrl(typedUrl)
  const detected = target ? detectWebSource(target) : null
  const title = detected === 'maps' ? mapQuery.trim() : target ? `${hostLabel(new URL(target))}` : ''
  // Only a page the staged window has actually loaded is worth putting on the wall.
  const liveableStage = staged?.open && /^https?:\/\//i.test(staged.url) ? staged : null

  // The staged window is a real window the operator works in directly, so the studio only needs to
  // know where it has navigated to - the address it ended on is what goes on the wall.
  useEffect(() => {
    if (!desktop) return
    let cancelled = false
    const pull = () => void desktop.stageState().then((state) => { if (!cancelled) setStaged(state) }).catch(() => undefined)
    pull()
    if (!staged?.open) return () => { cancelled = true }
    const timer = window.setInterval(pull, 1200)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [desktop, staged?.open])

  async function openOnMyScreen(url: string, label: string) {
    if (!desktop) return
    if (await desktop.stage({ url, title: label })) onNotice('Opened on your screen. The audience screen is untouched until you take it live.')
    else onNotice('This page would not open on your screen.')
    // The window answers before its first navigation settles, so this read also starts the polling.
    setStaged(await desktop.stageState().catch(() => null))
  }

  async function commandStage(action: 'reload' | 'back' | 'forward' | 'close') {
    if (!desktop) return
    await desktop.stageCommand(action)
    if (action === 'close') setStaged(await desktop.stageState().catch(() => null))
  }

  async function project(url: string, label: string) {
    await onProject(url, label)
  }

  function saveShortcut() {
    if (!target) return
    const shortcut: WebShortcut = { id: `${Date.now()}`, label: `${title} ${detected === 'maps' ? 'map' : webSourceLabel[detected ?? 'web'].toLowerCase()}`, url: target, kind: detected ?? 'web' }
    const next = [...shortcuts.filter((item) => item.url !== shortcut.url), shortcut]
    setShortcuts(next)
    window.localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(next))
    onNotice(`Saved ${shortcut.label} in the web list.`)
  }

  function removeShortcut(shortcut: WebShortcut) {
    const next = shortcuts.filter((item) => item.id !== shortcut.id)
    setShortcuts(next)
    window.localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(next))
  }

  return <div className="source-form">
    <div className="field-row">
      <label>Place on the map<input value={mapQuery} onChange={(event) => setMapQuery(event.target.value)} placeholder="Church address, city, or landmark" /></label>
      <label>Zoom<input type="range" min={5} max={19} value={mapZoom} onChange={(event) => setMapZoom(Number(event.target.value))}/><span>{mapZoom}</span></label>
    </div>
    <div className="studio-filter-row" role="group" aria-label="Map view">
      {(['roadmap', 'satellite', 'hybrid', 'terrain'] as const).map((option) => <button type="button" key={option} className={basemap === option ? 'active' : ''} onClick={() => setBasemap(option)}>{option === 'roadmap' ? 'Road' : option === 'satellite' ? 'Satellite' : option === 'hybrid' ? 'Hybrid' : 'Terrain'}</button>)}
    </div>
    <label>Or any web address - a stream, a meeting, a login page<input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="https://www.youtube.com/watch?v=… or meet.google.com/xxx-yyyy-zzz" /></label>
    {detected && <p className="web-detected"><MapPin size={14}/> {webSourceLabel[detected]} fills the projector window when you take it live.</p>}

    <div className="studio-actions-row">
      <button className="primary-action" disabled={!target} onClick={() => void project(target, title || 'the page')}><Radio size={16}/> Project now</button>
      {desktop && <button type="button" disabled={!target} onClick={() => void openOnMyScreen(target, title || 'Web page')}><Monitor size={15}/> Open on my screen</button>}
      <button type="button" disabled={!target} onClick={() => { if (!target) return; onAdd({ kind: 'web', title: title || 'Web output', subtitle: webSourceLabel[detected ?? 'web'], html: '', notes: '', url: target }); setAddress(''); setMapQuery('') }}><Plus size={16}/> Add to the show</button>
      <button type="button" disabled={!target} onClick={saveShortcut}><Save size={15}/> Save link</button>
    </div>

    {desktop && <div className="web-stage" role="group" aria-label="Web output on your screen">
      {liveableStage ? <>
        <p className="studio-note"><strong>On your screen, not on air.</strong> Work the page there - sign in, choose a seat, move the map - then take it live. The projector keeps the same session, so the room never sees a login.</p>
        <div className="studio-actions-row">
          <button type="button" className="primary-action" onClick={() => void project(liveableStage.url, liveableStage.title || 'Staged page')}><Radio size={16}/> Take it live</button>
          <button type="button" onClick={() => void commandStage('reload')} title="Reload the page on your screen"><RotateCcw size={15}/> Reload</button>
          <button type="button" disabled={!liveableStage.canGoBack} onClick={() => void commandStage('back')} title="Go back on your screen"><ArrowLeft size={15}/></button>
          <button type="button" disabled={!liveableStage.canGoForward} onClick={() => void commandStage('forward')} title="Go forward on your screen"><ArrowRight size={15}/></button>
          <button type="button" onClick={() => void commandStage('close')}><X size={15}/> Close</button>
        </div>
        <p className="web-stage-address">{liveableStage.loading ? 'Loading… ' : ''}{liveableStage.url}</p>
      </> : <p className="studio-note"><strong>Open a page on your own screen</strong> to sign in to a webcast, join a meeting or frame a map before the room sees it. Nothing reaches the projector until you take it live.</p>}
    </div>}

    <div className="studio-subhead">Saved links</div>
    <div className="web-shortcuts">
      {shortcuts.map((shortcut) => <span key={shortcut.id} style={{ display: 'contents' }}>
        <button type="button" onClick={() => void project(webProjectionUrl(shortcut.url), shortcut.label)} title={shortcut.url}>{shortcut.label}</button>
        {!DEFAULT_SHORTCUTS.some((item) => item.id === shortcut.id) && <button type="button" onClick={() => removeShortcut(shortcut)} aria-label={`Remove ${shortcut.label}`}><Trash2 size={13}/></button>}
      </span>)}
    </div>
    <p className="studio-note"><strong>Sign-in pages</strong> such as the live streaming webcast keep their session inside Lampstand: open the page on your screen, sign in there, and the next meeting is already logged in. Lampstand never stores or sends the password.</p>

    <button type="button" className="primary-action" onClick={() => setMonitorOpen((value) => !value)} aria-expanded={monitorOpen}><ChevronDown size={15} className={monitorOpen ? 'open' : ''}/> Audience monitor and remote</button>
    {monitorOpen && <AudienceMonitor />}
  </div>
}
