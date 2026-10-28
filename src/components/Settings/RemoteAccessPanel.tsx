import { Clipboard, Cloud, KeyRound, LogIn, LogOut, RefreshCw, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { cachedRemotePolicy, clearCloudSession, cloudConfiguration, createEnrollment, getDeviceName, getOrCreateDeviceId, getOrCreateRemoteFamily, loadCloudSession, registerOwnerDevice, saveCloudSession, saveEnrollment, signInOwner, signOutOwner, signUpOwner, syncRemotePolicy } from '../../utils/remoteAccess'
import RemoteMemberManager from './RemoteMemberManager'

export default function RemoteAccessPanel() {
  const [deviceId] = useState(() => getOrCreateDeviceId())
  const [deviceName, setDeviceName] = useState(() => getDeviceName())
  const [enrollment, setEnrollment] = useState(() => createEnrollment(deviceId))
  const [notice, setNotice] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [session, setSession] = useState(() => loadCloudSession())
  const [busy, setBusy] = useState(false)
  const [family, setFamily] = useState<Awaited<ReturnType<typeof getOrCreateRemoteFamily>> | null>(null)
  const cloud = cloudConfiguration()
  const policy = cachedRemotePolicy(localStorage, deviceId)

  function updateName(value: string) {
    setDeviceName(value)
    localStorage.setItem('lampstand-device-name-v1', value)
  }
  function renewCode() {
    const next = createEnrollment(deviceId)
    saveEnrollment(localStorage, next); setEnrollment(next); setNotice('A new 15-minute enrollment code was created.')
  }
  async function copy(value: string, message: string) { await navigator.clipboard.writeText(value); setNotice(message) }

  async function authenticate(mode: 'signin' | 'signup') {
    if (!email.trim() || password.length < 8) { setNotice('Enter your email and a password of at least 8 characters.'); return }
    setBusy(true); setNotice('')
    try {
      const next = mode === 'signup' ? await signUpOwner(email.trim(), password) : await signInOwner(email.trim(), password)
      saveCloudSession(next); setSession(next); setPassword(''); setNotice('Owner account connected. Register this computer to enable policy sync.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Owner sign-in failed.') }
    finally { setBusy(false) }
  }

  async function connectDevice() {
    if (!session) return
    setBusy(true); setNotice('')
    try {
      const family = await getOrCreateRemoteFamily(session)
      setFamily(family)
      const device = await registerOwnerDevice(session, family, deviceId, deviceName.trim() || 'Lampstand Project')
      const nextPolicy = await syncRemotePolicy(session, device)
      setNotice(nextPolicy ? 'This computer is approved and its latest policy is cached.' : 'This computer is approved. No restrictive policy has been assigned, so local Owner access remains active.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Device registration failed.') }
    finally { setBusy(false) }
  }

  async function disconnect() {
    if (session) { try { await signOutOwner(session) } catch { /* Clear the local session even when offline. */ } }
    clearCloudSession(); setSession(null); setNotice('Owner cloud session removed from this computer.')
  }

  return <section className="settings-panel settings-remote-panel">
    <div className="settings-panel-title"><Cloud size={19} /><div><h2>Remote family access</h2><p>Register this device and receive Owner-approved workspace policies.</p></div></div>
    <div className={cloud.configured ? 'settings-cloud-state ready' : 'settings-cloud-state'}><span /><div><strong>{cloud.configured ? 'Cloud control configured' : 'Cloud control not connected'}</strong><small>{cloud.configured ? 'This device is ready for Owner sign-in and registration.' : 'Local profiles continue working. Connect a Lampstand cloud project before remote policies can sync.'}</small></div></div>
    {cloud.configured && !session && <div className="settings-cloud-login">
      <label><span>Owner email</span><input type="email" value={email} autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="owner@example.com" /></label>
      <label><span>Password</span><input type="password" value={password} autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
      <div><button type="button" disabled={busy} onClick={() => void authenticate('signin')}><LogIn size={14} /> Sign in</button><button type="button" disabled={busy} onClick={() => void authenticate('signup')}>Create Owner account</button></div>
    </div>}
    {session && <div className="settings-cloud-account"><span><strong>Owner signed in</strong><small>{session.user.email || 'Authenticated Owner'}</small></span><div><button type="button" disabled={busy} onClick={() => void connectDevice()}><ShieldCheck size={14} /> Approve &amp; sync this computer</button><button type="button" disabled={busy} onClick={() => void disconnect()}><LogOut size={14} /> Sign out</button></div></div>}
    <label className="settings-device-name"><span>Device name</span><input value={deviceName} onChange={(event) => updateName(event.target.value)} /></label>
    <div className="settings-device-identity"><span><strong>Device ID</strong><code>{deviceId}</code></span><button type="button" className="icon-btn" title="Copy device ID" aria-label="Copy device ID" onClick={() => void copy(deviceId, 'Device ID copied.')}><Clipboard size={14} /></button></div>
    <div className="settings-enrollment"><KeyRound size={18} /><div><strong>Enrollment code</strong><code>{enrollment.code}</code><small>Expires {new Date(enrollment.expiresAt).toLocaleTimeString()}</small></div><button type="button" className="icon-btn" title="Create a new enrollment code" aria-label="Create a new enrollment code" onClick={renewCode}><RefreshCw size={14} /></button></div>
    <div className="settings-policy-status"><ShieldCheck size={17} /><span><strong>{policy ? 'Cached remote policy available' : 'Using local Owner policy'}</strong><small>{policy ? `Valid until ${new Date(policy.expiresAt).toLocaleString()}` : 'No remote restriction has been received for this device.'}</small></span></div>
    {session && family && <RemoteMemberManager session={session} family={family} />}
    {notice && <p className="settings-backup-notice" role="status">{notice}</p>}
  </section>
}
