import { CheckCircle2, RefreshCw, Server, Settings, SlidersHorizontal } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { AIOS_API_BASE_URL } from '../config/api'
const STORAGE_KEY = 'aios-studio-settings-v1'

interface Preferences { compactUi: boolean; reducedMotion: boolean }

function loadPreferences(): Preferences {
  try {
    return { compactUi: false, reducedMotion: false, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  } catch {
    return { compactUi: false, reducedMotion: false }
  }
}

function SettingsPage() {
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences)
  const [checking, setChecking] = useState(true)
  const [online, setOnline] = useState(false)
  const [status, setStatus] = useState('Checking connection...')

  const checkConnection = useCallback(async () => {
    setChecking(true)
    try {
      const response = await fetch(AIOS_API_BASE_URL + '/', { headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error()
      const payload = await response.json() as { status?: string }
      setOnline(true)
      setStatus(payload.status ?? 'Connected')
    } catch {
      setOnline(false)
      setStatus('Unavailable')
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => { void checkConnection() }, [checkConnection])
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    document.documentElement.classList.toggle('compact-ui', preferences.compactUi)
    document.documentElement.classList.toggle('reduced-motion', preferences.reducedMotion)
  }, [preferences])

  function toggle(key: keyof Preferences) {
    setPreferences((current) => ({ ...current, [key]: !current[key] }))
  }

  return (
    <section className="settings-page">
      <header className="settings-header">
        <span><Settings size={25} /></span>
        <div><h1>Settings</h1><p>Manage local preferences and verify AIOS services.</p></div>
      </header>

      <div className="settings-grid">
        <section className="settings-panel">
          <div className="settings-panel-title"><SlidersHorizontal size={19} /><div><h2>Appearance</h2><p>Preferences are saved in this browser.</p></div></div>
          <label className="settings-row"><span><strong>Compact interface</strong><small>Reduce navigation and workspace spacing.</small></span>
            <input type="checkbox" checked={preferences.compactUi} onChange={() => toggle('compactUi')} /></label>
          <label className="settings-row"><span><strong>Reduce motion</strong><small>Disable non-essential transitions and animations.</small></span>
            <input type="checkbox" checked={preferences.reducedMotion} onChange={() => toggle('reducedMotion')} /></label>
        </section>

        <section className="settings-panel">
          <div className="settings-panel-title"><Server size={19} /><div><h2>AIOS API</h2><p>Connection used by Chat and Knowledge.</p></div></div>
          <div className="settings-service">
            <span className={online ? 'settings-service-dot online' : 'settings-service-dot'} />
            <div><strong>{checking ? 'Checking...' : status}</strong><code>{AIOS_API_BASE_URL}</code></div>
            <button type="button" onClick={() => void checkConnection()} disabled={checking}>
              <RefreshCw size={15} className={checking ? 'spin' : ''} /> Check
            </button>
          </div>
          {online && <p className="settings-success"><CheckCircle2 size={15} /> API requests are available.</p>}
        </section>
      </div>
    </section>
  )
}
export default SettingsPage
