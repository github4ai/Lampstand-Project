import { LockKeyhole } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import BrandMark from '../BrandMark'
import type { LocalUserProfile } from '../../utils/accessControl'
import { markProfileUnlocked, verifyPin } from '../../utils/pinSecurity'

export default function ProfileLockScreen({ profile }: { profile: LocalUserProfile }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  async function unlock(event: FormEvent) {
    event.preventDefault()
    if (!profile.pinHash) return
    setChecking(true)
    const valid = await verifyPin(pin, profile.pinHash)
    if (valid) { markProfileUnlocked(profile.id); window.location.reload(); return }
    setChecking(false); setPin(''); setError('Incorrect PIN. Try again.')
  }
  return <main className="profile-lock-screen"><section><BrandMark size={54} /><LockKeyhole size={24} /><h1>Welcome, {profile.name}</h1><p>Enter your Lampstand PIN to open this profile.</p><form onSubmit={(event) => void unlock(event)}><input autoFocus inputMode="numeric" pattern="[0-9]*" maxLength={8} type="password" value={pin} onChange={(event) => { setPin(event.target.value.replace(/\D/g, '').slice(0, 8)); setError('') }} aria-label="Profile PIN" placeholder="4–8 digit PIN" /><button type="submit" disabled={checking || pin.length < 4}>{checking ? 'Checking…' : 'Unlock'}</button></form>{error && <span role="alert">{error}</span>}</section></main>
}
