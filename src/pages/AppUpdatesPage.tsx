import { Download } from 'lucide-react'
import AppUpdatesPanel from '../components/Settings/AppUpdatesPanel'
import '../styles/settings.css'
import '../styles/app-updates.css'

export default function AppUpdatesPage() {
  return <section className="settings-page app-updates-page">
    <header className="settings-header">
      <span><Download size={26} /></span>
      <div>
        <h1>App Updates</h1>
        <p>Keep Lampstand Project and its authorized libraries current.</p>
      </div>
    </header>
    <div className="settings-grid app-updates-grid">
      <AppUpdatesPanel />
    </div>
  </section>
}
