import { ChevronDown, MapPin, Plus, Radio, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { presentWebSource } from '../../components/PresentOnDisplay'
import { detectWebSource, mapsUrl, normalizeWebUrl, webProjectionUrl, webSourceLabel, type WebShortcut } from '../../utils/webSources'
import type { NewQueueItem } from '../../utils/presentationQueue'
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
 */
export default function WebSourcePanel({ onAdd, onNotice }: { onAdd: (item: NewQueueItem) => void; onNotice: (message: string) => void }) {
  const [address, setAddress] = useState('')
  const [mapQuery, setMapQuery] = useState('')
  const [mapZoom, setMapZoom] = useState(14)
  const [basemap, setBasemap] = useState<'roadmap' | 'satellite' | 'hybrid' | 'terrain'>('roadmap')
  const [shortcuts, setShortcuts] = useState<WebShortcut[]>(readShortcuts)
  const [monitorOpen, setMonitorOpen] = useState(false)

  const typedUrl = normalizeWebUrl(address)
  const mapCandidate = mapQuery.trim() ? mapsUrl(mapQuery, { zoom: mapZoom, basemap }) : ''
  const target = mapCandidate || webProjectionUrl(typedUrl)
  const detected = target ? detectWebSource(target) : null
  const title = detected === 'maps' ? mapQuery.trim() : target ? `${hostLabel(new URL(target))}` : ''

  async function project(url: string, label: string) {
    const opened = await presentWebSource({ url, title: label })
    onNotice(opened ? `Projecting ${label} on the audience screen.` : 'The audience screen would not open this page.')
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
    {detected && <p className="web-detected"><MapPin size={14}/> {webSourceLabel[detected]} will fill the projector window.</p>}

    <div className="studio-actions-row">
      <button className="primary-action" disabled={!target} onClick={() => void project(target, title || 'the page')}><Radio size={16}/> Project now</button>
      <button type="button" disabled={!target} onClick={() => { if (!target) return; onAdd({ kind: 'web', title: title || 'Web output', subtitle: webSourceLabel[detected ?? 'web'], html: '', notes: '', url: target }); setAddress(''); setMapQuery('') }}><Plus size={16}/> Add to the show</button>
      <button type="button" disabled={!target} onClick={saveShortcut}><Save size={15}/> Save link</button>
    </div>

    <div className="studio-subhead">Saved links</div>
    <div className="web-shortcuts">
      {shortcuts.map((shortcut) => <span key={shortcut.id} style={{ display: 'contents' }}>
        <button type="button" onClick={() => void project(webProjectionUrl(shortcut.url), shortcut.label)} title={shortcut.url}>{shortcut.label}</button>
        {!DEFAULT_SHORTCUTS.some((item) => item.id === shortcut.id) && <button type="button" onClick={() => removeShortcut(shortcut)} aria-label={`Remove ${shortcut.label}`}><Trash2 size={13}/></button>}
      </span>)}
    </div>
    <p className="studio-note"><strong>Sign-in pages</strong> such as the live streaming webcast keep their own session inside the projector window: sign in once through the monitor below and the next meeting is already logged in. Lampstand never stores or sends the password.</p>

    <button type="button" className="primary-action" onClick={() => setMonitorOpen((value) => !value)} aria-expanded={monitorOpen}><ChevronDown size={15} className={monitorOpen ? 'open' : ''}/> Audience monitor and remote</button>
    {monitorOpen && <AudienceMonitor />}
  </div>
}
