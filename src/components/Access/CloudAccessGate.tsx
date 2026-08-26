import { KeyRound, LogIn, ShieldCheck } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { ACCESS_CONTROL_STORAGE_KEY, defaultPermissions, migrateLegacyPermissions, type AccessControlState, type LocalUserProfile } from '../../utils/accessControl'
import { claimFirstRemoteOwner, clearCloudSession, cloudConfiguration, ensureFreshCloudSession, getOwnedRemoteFamily, loadCloudSession, loadSignedInMembership, saveCloudSession, signInOwner, signUpOwner, type CloudSession } from '../../utils/remoteAccess'
import { FIRST_RUN_KEY } from '../Onboarding/FirstRunWizard'

type GateState = 'checking' | 'signed-out' | 'ready' | 'denied'

function activateProfile(profile: LocalUserProfile) {
  const state: AccessControlState = { version: 1, activeProfileId: profile.id, profiles: [profile] }
  localStorage.setItem(ACCESS_CONTROL_STORAGE_KEY, JSON.stringify(state))
  localStorage.setItem(FIRST_RUN_KEY, 'true')
}

export default function CloudAccessGate({ children }: { children: ReactNode }) {
  const cloud = cloudConfiguration()
  const [session, setSession] = useState<CloudSession | null>(() => loadCloudSession())
  const [state, setState] = useState<GateState>(() => session ? 'checking' : 'signed-out')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!cloud.configured || !session) return
    let cancelled = false
    async function resolveAccess() {
      try {
        const activeSession = await ensureFreshCloudSession(session!)
        if (activeSession.accessToken !== session!.accessToken) {
          saveCloudSession(activeSession)
          if (!cancelled) setSession(activeSession)
          return
        }
        const membership = await loadSignedInMembership(activeSession)
        if (membership) {
          if (membership.suspended) throw new Error('Your Lampstand access has been suspended by the Owner.')
          activateProfile({ id: membership.id, name: membership.display_name, role: membership.role, permissions: migrateLegacyPermissions(membership.role, membership.permissions), suspended: membership.suspended, createdAt: membership.created_at, updatedAt: membership.updated_at })
          if (!cancelled) setState('ready')
          return
        }
        let family = await getOwnedRemoteFamily(activeSession)
        if (!family) family = await claimFirstRemoteOwner(activeSession)
        activateProfile({ id: activeSession.user.id, name: activeSession.user.email?.split('@')[0] || 'Owner', role: 'owner', permissions: defaultPermissions('owner'), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        if (!cancelled) setState('ready')
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'This email does not have Lampstand access.'
          if (/jwt expired|refresh token|session.*expired/i.test(message)) {
            clearCloudSession(); setSession(null); setNotice('Your session expired. Please sign in again.'); setState('signed-out')
          } else {
            setNotice(message); setState('denied')
          }
        }
      }
    }
    void resolveAccess()
    return () => { cancelled = true }
  }, [session?.accessToken])

  if (!cloud.configured) return children
  if (state === 'ready') return children

  async function authenticate(event: FormEvent, mode: 'signin' | 'signup') {
    event.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email.trim()) || password.length < 8) { setNotice('Enter a valid email and a password of at least 8 characters.'); return }
    setBusy(true); setNotice('')
    try {
      const next = mode === 'signin' ? await signInOwner(email.trim(), password) : await signUpOwner(email.trim(), password)
      saveCloudSession(next); setSession(next); setState('checking')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Account access failed.') }
    finally { setBusy(false) }
  }
  function reset() { clearCloudSession(); setSession(null); setState('signed-out'); setNotice('') }

  return <main className="cloud-access-gate"><section>
    <div className="cloud-access-brand"><ShieldCheck size={32} /><span><strong>Lampstand Project</strong><small>Verified member access</small></span></div>
    {state === 'checking' ? <div className="cloud-access-checking"><KeyRound size={24} /><h1>Checking your access…</h1><p>Loading the workspaces assigned to this email.</p></div> : <>
      <h1>{state === 'denied' ? 'Access is not available' : 'Sign in to Lampstand'}</h1>
      <p>{state === 'denied' ? 'Ask the Lampstand Owner to invite this exact email address or restore your access.' : 'Use the verified email address invited by your Lampstand Owner.'}</p>
      {state !== 'denied' && <form onSubmit={(event) => void authenticate(event, 'signin')}>
        <label><span>Email address</span><input autoFocus type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button type="submit" disabled={busy}><LogIn size={16} /> {busy ? 'Please wait…' : 'Sign in'}</button>
        <button type="button" className="cloud-create-account" disabled={busy} onClick={(event) => void authenticate(event as unknown as FormEvent, 'signup')}>Create and verify account</button>
      </form>}
      {notice && <div className="cloud-access-notice" role="status">{notice}</div>}
      {state === 'denied' && <button type="button" className="cloud-try-another" onClick={reset}>Use another email</button>}
    </>}
  </section></main>
}
