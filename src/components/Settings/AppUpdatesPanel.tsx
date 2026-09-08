import { CheckCircle2, Download, RefreshCw, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { LampstandLibraryUpdateState, LampstandUpdateState } from '../../types/desktop'
import { cloudConfiguration, publicLibraryObjectUrl } from '../../utils/remoteAccess'
import LibraryPublisherPanel from './LibraryPublisherPanel'
import { getKnowledgeIndexStatus, startKnowledgeIndex, type KnowledgeIndexStatus } from '../../services/knowledge'

const browserState: LampstandUpdateState = {
  status: 'development', currentVersion: 'Browser', availableVersion: null, percent: 0,
  message: 'Automatic updates are available in the installed Windows app.',
}

interface AppUpdatesPanelProps {
  allowManifestConfiguration?: boolean
  allowPublishing?: boolean
}

export default function AppUpdatesPanel({
  allowManifestConfiguration = false,
  allowPublishing = false,
}: AppUpdatesPanelProps) {
  const [state, setState] = useState<LampstandUpdateState>(browserState)
  const [busy, setBusy] = useState(false)
  const updates = window.lampstandDesktop?.updates
  const libraries = window.lampstandDesktop?.libraries
  const [libraryState, setLibraryState] = useState<LampstandLibraryUpdateState>({ status: 'idle', installedVersion: null, availableVersion: null, percent: 0, message: 'Ready to check library updates.', manifestUrl: '' })
  const [manifestUrl, setManifestUrl] = useState('')
  const [libraryBusy, setLibraryBusy] = useState(false)
  const [indexState, setIndexState] = useState<KnowledgeIndexStatus | null>(null)
  const suggestedManifestUrl = cloudConfiguration().configured ? publicLibraryObjectUrl('manifest.json') : ''

  useEffect(() => {
    if (!updates) return
    void updates.getState().then(setState)
    return updates.subscribe(setState)
  }, [updates])

  useEffect(() => {
    if (!libraries) return
    void libraries.getState().then((next) => { setLibraryState(next); setManifestUrl(next.manifestUrl || suggestedManifestUrl) })
    return libraries.subscribe(setLibraryState)
  }, [libraries])

  useEffect(() => {
    if (!libraryState.knowledgeChanged) return
    let cancelled = false
    let timer: number | undefined
    const refresh = async () => {
      try {
        const next = await getKnowledgeIndexStatus()
        if (cancelled) return
        setIndexState(next)
        if (next.state === 'running') timer = window.setTimeout(refresh, 1500)
      } catch { if (!cancelled) setIndexState(null) }
    }
    void refresh()
    return () => { cancelled = true; if (timer) window.clearTimeout(timer) }
  }, [libraryState.knowledgeChanged])

  async function prepareSearch() {
    setLibraryBusy(true)
    try { setIndexState(await startKnowledgeIndex()) }
    catch { setIndexState(null) }
    finally { setLibraryBusy(false) }
  }

  async function installLibraryUpdate() {
    if (!libraries) return
    setLibraryBusy(true)
    try {
      const next = await libraries.download()
      setLibraryState(next)
      if (next.knowledgeChanged) {
        try { setIndexState(await startKnowledgeIndex()) }
        catch { setIndexState(null) }
      }
    } finally { setLibraryBusy(false) }
  }

  async function run(action: 'check' | 'download' | 'install') {
    if (!updates) return
    setBusy(true)
    try {
      if (action === 'check') setState(await updates.check())
      else if (action === 'download') setState(await updates.download())
      else {
        await updates.install()
      }
    } finally { setBusy(false) }
  }

  async function reinstallCurrentVersion() {
    if (!updates || !window.confirm('Download the installer for this version? Run it after the download finishes to repair or reinstall Lampstand Project. Your personal data is preserved.')) return
    setBusy(true)
    try { await updates.reinstall() }
    finally { setBusy(false) }
  }

  const checking = busy || state.status === 'checking'
  return <section id="app-updates" className="settings-panel settings-updates-panel">
    <div className="settings-panel-title"><Download size={19} /><div><h2>App updates</h2><p>Updates are delivered through Lampstand Project GitHub releases.</p></div></div>
    <div className="settings-update-summary">
      <span className={state.status === 'error' ? 'settings-service-dot' : 'settings-service-dot online'} />
      <div><strong>Version {state.currentVersion}</strong><small>{state.message}</small></div>
    </div>
    {state.status === 'downloading' && <div className="settings-update-progress"><progress value={state.percent} max="100" /><span>{state.percent}%</span></div>}
    <div className="settings-update-actions">
      <button type="button" disabled={!updates || checking || state.status === 'downloading'} onClick={() => void run('check')}><RefreshCw size={14} className={checking ? 'spin' : undefined} /> Check for updates</button>
      {state.status === 'available' && <button type="button" disabled={busy} onClick={() => void run('download')}><Download size={14} /> Download version {state.availableVersion}</button>}
      {state.status === 'ready' && <button type="button" className="primary" onClick={() => void run('install')}><RotateCcw size={14} /> Restart and install</button>}
      {state.status === 'current' && <span><CheckCircle2 size={14} /> Up to date</span>}
      {updates && state.status !== 'development' && <button type="button" disabled={busy || state.status === 'downloading'} onClick={() => void reinstallCurrentVersion()}><RotateCcw size={14} /> Reinstall this version</button>}
    </div>
    <p className="settings-update-note">App updates and reinstalls replace program files only. Your profiles, sign-in identity, reading progress, annotations, conversations, and other personal data remain in the Lampstand data folder.</p>

    <div className="settings-library-update">
      <div className="settings-panel-title"><Download size={18} /><div><h3>Library updates</h3><p>Update authorized School, Ministry, Church, and other library content without reinstalling the app.</p></div></div>
      {allowManifestConfiguration && <label>Secure library manifest address
        <div><input type="url" value={manifestUrl} placeholder="https://…/lampstand-library.json" onChange={(event) => setManifestUrl(event.target.value)} /><button type="button" disabled={!libraries || libraryBusy} onClick={async () => { if (!libraries) return; setLibraryBusy(true); try { setLibraryState(await libraries.setManifestUrl(manifestUrl.trim())) } finally { setLibraryBusy(false) } }}>Save</button></div>
      </label>}
      <div className="settings-update-summary"><span className={libraryState.status === 'error' ? 'settings-service-dot' : 'settings-service-dot online'} /><div><strong>{libraryState.installedVersion ? `Library ${libraryState.installedVersion}` : 'Bundled library'}</strong><small>{libraryState.message}</small></div></div>
      {libraryState.status === 'downloading' && <div className="settings-update-progress"><progress value={libraryState.percent} max="100" /><span>{libraryState.percent}%</span></div>}
      <div className="settings-update-actions">
        <button type="button" disabled={!libraries || libraryBusy || libraryState.status === 'downloading'} onClick={async () => { if (!libraries) return; setLibraryBusy(true); try { await libraries.setManifestUrl(manifestUrl.trim()); setLibraryState(await libraries.check()) } finally { setLibraryBusy(false) } }}><RefreshCw size={14} className={libraryBusy ? 'spin' : undefined} /> Check library</button>
        {libraryState.status === 'available' && <button type="button" className="primary" disabled={libraryBusy} onClick={() => void installLibraryUpdate()}><Download size={14} /> Download library only</button>}
        {libraryState.status === 'ready' && libraryState.knowledgeChanged && indexState?.state !== 'running' && indexState?.state !== 'completed' && <button type="button" className="primary" disabled={libraryBusy} onClick={() => void prepareSearch()}><RefreshCw size={14} /> Retry search preparation</button>}
        {libraryState.status === 'ready' && <button type="button" onClick={() => window.location.reload()}><RotateCcw size={14} /> Reload Lampstand</button>}
      </div>
      {indexState?.state === 'running' && <div className="settings-update-progress"><progress value={indexState.processed || 0} max={indexState.total || 1} /><span>{indexState.processed || 0} / {indexState.total || 0}</span></div>}
      {indexState && indexState.state !== 'idle' && indexState.state !== 'running' && <p className="settings-update-note">Search preparation: {indexState.state === 'completed' ? 'complete' : indexState.state === 'completed_with_errors' ? 'completed with some files needing attention' : 'not completed'}.</p>}
      <p className="settings-update-note">Only files listed in the HTTPS manifest are installed, and SHA-256 checksums are verified when supplied. Owners publish library manifests separately from GitHub releases.</p>
      {allowPublishing && <LibraryPublisherPanel />}
    </div>
    <p className="settings-update-note">Ollama, Whisper, image, audio, and video engines remain optional because they can require many gigabytes. Lampstand prefers local providers and can use configured cloud providers when local models are unavailable.</p>
  </section>
}
