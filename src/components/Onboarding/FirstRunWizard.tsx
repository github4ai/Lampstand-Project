import { BookOpenCheck, Check, ChevronLeft, ChevronRight, Cpu, FolderArchive, ShieldCheck, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import BrandMark from '../BrandMark'
import { ACCESS_CONTROL_STORAGE_KEY, loadOrCreateAccessState } from '../../utils/accessControl'
import { hashPin, isValidPin, markProfileUnlocked } from '../../utils/pinSecurity'
import { parseWorkspaceBackup, restoreWorkspaceBackup } from '../../utils/workspaceBackup'
import { getAiServicesStatus, type AiServiceStatus } from '../../api/services'
import { AIOS_API_BASE_URL } from '../../config/api'

export const FIRST_RUN_KEY = 'lampstand-first-run-complete-v1'

interface LibraryStatus { hymns: number; hwmr: number; bibleBooks: number; checked: boolean }

export default function FirstRunWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const [ownerName, setOwnerName] = useState('Owner')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [services, setServices] = useState<AiServiceStatus | null>(null)
  const [serviceError, setServiceError] = useState('')
  const [libraries, setLibraries] = useState<LibraryStatus>({ hymns: 0, hwmr: 0, bibleBooks: 0, checked: false })
  const [restoreNotice, setRestoreNotice] = useState('No backup restored. You can start with a clean workspace.')
  const [finishing, setFinishing] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    void getAiServicesStatus().then(setServices).catch(() => setServiceError('Optional AI services are not ready yet. You can configure them later in Settings.'))
    void Promise.all([
      fetch(`${AIOS_API_BASE_URL}/hymnal/library`).then((response) => response.ok ? response.json() : null),
      fetch(`${AIOS_API_BASE_URL}/hwmr/library`).then((response) => response.ok ? response.json() : null),
      fetch(`${AIOS_API_BASE_URL}/recovery-bible/books`).then((response) => response.ok ? response.json() : null),
    ]).then(([hymnal, hwmr, bible]) => setLibraries({
      hymns: Array.isArray(hymnal?.hymns) ? hymnal.hymns.length : 0,
      hwmr: Array.isArray(hwmr?.books) ? hwmr.books.length : 0,
      bibleBooks: Array.isArray(bible?.books) ? bible.books.length : Array.isArray(bible) ? bible.length : 0,
      checked: true,
    })).catch(() => setLibraries((current) => ({ ...current, checked: true })))
  }, [])

  async function restoreBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const backup = parseWorkspaceBackup(JSON.parse(await file.text()))
      if (!backup) throw new Error('Invalid backup')
      const result = restoreWorkspaceBackup(localStorage, backup, 'merge')
      setRestoreNotice(`${result.restored} saved settings and records restored. Your current installation was preserved.`)
    } catch { setRestoreNotice('This file is not a valid Lampstand Project backup.') }
  }

  async function finish() {
    if (!ownerName.trim() || !isValidPin(pin) || pin !== confirmPin) return
    setFinishing(true)
    const state = loadOrCreateAccessState(localStorage)
    const owner = state.profiles.find((profile) => profile.role === 'owner') ?? state.profiles[0]
    const pinHash = await hashPin(pin)
    const next = { ...state, activeProfileId: owner.id, profiles: state.profiles.map((profile) => profile.id === owner.id ? { ...profile, name: ownerName.trim(), pinHash, updatedAt: new Date().toISOString() } : profile) }
    localStorage.setItem(ACCESS_CONTROL_STORAGE_KEY, JSON.stringify(next))
    localStorage.setItem(FIRST_RUN_KEY, new Date().toISOString())
    markProfileUnlocked(owner.id)
    onComplete()
    window.location.reload()
  }

  const ownerValid = ownerName.trim().length > 0 && isValidPin(pin) && pin === confirmPin
  const steps = ['Owner', 'Libraries', 'AI services', 'Restore']
  return <main className="first-run"><section className="first-run-card">
    <header><BrandMark size={58} /><div><span>WELCOME TO</span><h1>Lampstand Project</h1><p>Let’s prepare this computer for your family.</p></div></header>
    <nav aria-label="Setup progress">{steps.map((label, index) => <span key={label} className={index === step ? 'active' : index < step ? 'done' : ''}>{index < step ? <Check size={13} /> : index + 1}<small>{label}</small></span>)}</nav>

    <div className="first-run-content">
      {step === 0 && <div className="first-run-owner"><ShieldCheck size={30} /><h2>Create the Owner profile</h2><p>The Owner manages family members, workspaces, backups, and remote access.</p><label><span>Owner name</span><input autoFocus value={ownerName} onChange={(event) => setOwnerName(event.target.value)} /></label><div className="first-run-pin"><label><span>4–8 digit PIN</span><input inputMode="numeric" type="password" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))} /></label><label><span>Confirm PIN</span><input inputMode="numeric" type="password" value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 8))} /></label></div>{confirmPin && pin !== confirmPin && <em>PINs do not match.</em>}</div>}
      {step === 1 && <div><BookOpenCheck size={30} /><h2>Local libraries</h2><p>Lampstand checks the reading libraries bundled with or connected to this computer.</p><div className="first-run-checks"><span><Check /> Hymnal <b>{libraries.checked ? `${libraries.hymns.toLocaleString()} hymns` : 'Checking…'}</b></span><span><Check /> Holy Word for Morning Revival <b>{libraries.checked ? `${libraries.hwmr} books` : 'Checking…'}</b></span><span className={libraries.bibleBooks ? '' : 'optional'}><Check /> Recovery Bible <b>{libraries.checked ? libraries.bibleBooks ? `${libraries.bibleBooks} books` : 'Connect later' : 'Checking…'}</b></span></div><small>Additional Ministry, School, and personal documents can be added after setup.</small></div>}
      {step === 2 && <div><Cpu size={30} /><h2>Optional AI services</h2><p>Lampstand works as a library and organizer without every AI provider. Install or connect more services whenever needed.</p><div className="first-run-checks">{services?.providers.map((provider) => <span className={provider.available ? '' : 'optional'} key={provider.id}><Check /> {provider.label}<b>{provider.available ? 'Ready' : provider.configured === false ? 'Optional' : 'Set up later'}</b></span>) ?? <span className="optional"><Cpu /> Local AI services<b>{serviceError || 'Checking…'}</b></span>}</div></div>}
      {step === 3 && <div><FolderArchive size={30} /><h2>Restore an existing workspace</h2><p>If you already use Lampstand Project, restore a JSON workspace backup. Large library and media folders remain separate.</p><button className="first-run-restore" type="button" onClick={() => inputRef.current?.click()}><Upload size={17} /> Choose backup</button><input ref={inputRef} hidden type="file" accept=".json,application/json" onChange={(event) => void restoreBackup(event)} /><span className="first-run-notice">{restoreNotice}</span><p className="first-run-ready">Your Owner profile will be secured when you finish setup.</p></div>}
    </div>

    <footer><button type="button" disabled={step === 0} onClick={() => setStep((current) => current - 1)}><ChevronLeft size={16} /> Back</button>{step < steps.length - 1 ? <button className="primary" type="button" disabled={step === 0 && !ownerValid} onClick={() => setStep((current) => current + 1)}>Continue <ChevronRight size={16} /></button> : <button className="primary" type="button" disabled={!ownerValid || finishing} onClick={() => void finish()}>{finishing ? 'Finishing…' : 'Finish setup'} <Check size={16} /></button>}</footer>
  </section></main>
}
