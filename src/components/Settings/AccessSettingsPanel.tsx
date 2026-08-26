import { Check, KeyRound, Plus, ShieldCheck, Trash2, UserRoundCog } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  ACCESS_CONTROL_STORAGE_KEY,
  type AccessControlState,
  type LocalUserProfile,
  type UserRole,
  type WorkspaceId,
  defaultPermissions,
  loadOrCreateAccessState,
} from '../../utils/accessControl'
import { hashPin, isValidPin, lockProfile, markProfileUnlocked, verifyPin } from '../../utils/pinSecurity'

const roles: Array<{ id: UserRole; label: string }> = [
  { id: 'owner', label: 'Owner' },
  { id: 'family-admin', label: 'Family Admin' },
  { id: 'adult', label: 'Adult' },
  { id: 'student', label: 'Student' },
  { id: 'child', label: 'Child' },
  { id: 'guest', label: 'Guest' },
]

const workspaces: Array<{ id: WorkspaceId; label: string }> = [
  { id: 'chat', label: 'Chat' }, { id: 'knowledge', label: 'Knowledge' },
  { id: 'agents', label: 'Agents' }, { id: 'ministry', label: 'Ministry' },
  { id: 'presentation', label: 'Presentation' },
  { id: 'church', label: 'Church' }, { id: 'school', label: 'School' },
  { id: 'media', label: 'Media Studio' }, { id: 'language-tools', label: 'Language Tools' },
  { id: 'documents', label: 'Documents' }, { id: 'history', label: 'History' },
]

function saveState(state: AccessControlState) {
  localStorage.setItem(ACCESS_CONTROL_STORAGE_KEY, JSON.stringify(state))
}

export default function AccessSettingsPanel() {
  const [state, setState] = useState(() => loadOrCreateAccessState(localStorage))
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('adult')
  const [notice, setNotice] = useState('')
  const activeProfile = useMemo(() => state.profiles.find((profile) => profile.id === state.activeProfileId) ?? state.profiles[0], [state])
  const canManage = activeProfile?.role === 'owner'

  function commit(update: (current: AccessControlState) => AccessControlState, message: string) {
    setState((current) => {
      const next = update(current)
      saveState(next)
      return next
    })
    setNotice(message)
  }

  function addProfile() {
    const name = newName.trim()
    if (!name || newRole === 'owner') return
    const timestamp = new Date().toISOString()
    const profile: LocalUserProfile = {
      id: crypto.randomUUID(), name, role: newRole,
      permissions: defaultPermissions(newRole), createdAt: timestamp, updatedAt: timestamp,
    }
    commit((current) => ({ ...current, profiles: [...current.profiles, profile] }), `${name} was added.`)
    setNewName('')
  }

  function updateProfile(profileId: string, changes: Partial<LocalUserProfile>) {
    commit((current) => ({
      ...current,
      profiles: current.profiles.map((profile) => profile.id === profileId
        ? { ...profile, ...changes, updatedAt: new Date().toISOString() }
        : profile),
    }), 'Access settings saved.')
  }

  function changeRole(profile: LocalUserProfile, role: UserRole) {
    if (profile.role === 'owner' || role === 'owner') return
    updateProfile(profile.id, { role, permissions: defaultPermissions(role) })
  }

  function toggleWorkspace(profile: LocalUserProfile, workspace: WorkspaceId) {
    const exists = profile.permissions.some((permission) => permission.workspace === workspace)
    const permissions = exists
      ? profile.permissions.filter((permission) => permission.workspace !== workspace)
      : [...profile.permissions, defaultPermissions(profile.role).find((permission) => permission.workspace === workspace) ?? { workspace, actions: ['view'] as const }]
    updateProfile(profile.id, { permissions })
  }

  function removeProfile(profile: LocalUserProfile) {
    if (profile.role === 'owner' || !window.confirm(`Remove ${profile.name}? Their local profile settings will no longer be available.`)) return
    commit((current) => ({ ...current, profiles: current.profiles.filter((item) => item.id !== profile.id) }), `${profile.name} was removed.`)
  }

  async function switchProfile(profile: LocalUserProfile) {
    if (profile.suspended) return
    if (profile.pinHash) {
      const pin = window.prompt(`Enter the PIN for ${profile.name}.`)
      if (!pin || !await verifyPin(pin, profile.pinHash)) { setNotice('Incorrect PIN. The active profile was not changed.'); return }
      markProfileUnlocked(profile.id)
    }
    commit((current) => ({ ...current, activeProfileId: profile.id }), `Switching to ${profile.name}.`)
    window.setTimeout(() => window.location.reload(), 400)
  }

  async function setProfilePin(profile: LocalUserProfile) {
    const pin = window.prompt(`Set a 4–8 digit PIN for ${profile.name}. The PIN cannot be recovered if forgotten.`) ?? ''
    if (!pin) return
    if (!isValidPin(pin)) { setNotice('PIN must contain 4 to 8 digits.'); return }
    const confirmation = window.prompt('Enter the same PIN again to confirm.') ?? ''
    if (pin !== confirmation) { setNotice('The PINs did not match. Nothing was changed.'); return }
    const pinHash = await hashPin(pin)
    updateProfile(profile.id, { pinHash })
    if (profile.id === state.activeProfileId) markProfileUnlocked(profile.id)
    setNotice(`PIN protection enabled for ${profile.name}.`)
  }

  function removeProfilePin(profile: LocalUserProfile) {
    if (!window.confirm(`Remove PIN protection from ${profile.name}?`)) return
    updateProfile(profile.id, { pinHash: undefined })
    lockProfile(profile.id)
    setNotice(`PIN protection removed from ${profile.name}.`)
  }

  return (
    <section className="settings-panel settings-access-panel">
      <div className="settings-panel-title"><UserRoundCog size={19} /><div><h2>Users &amp; Access</h2><p>Create local family profiles and choose which workspaces each person may use.</p></div></div>
      <div className="settings-active-user"><ShieldCheck size={18} /><span><strong>Currently using Lampstand as {activeProfile.name}</strong><small>{roles.find((role) => role.id === activeProfile.role)?.label} profile · permissions are stored locally on this computer.</small></span></div>

      {canManage && <div className="settings-add-user">
        <label><span>Name</span><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Family member name" /></label>
        <label><span>Role</span><select value={newRole} onChange={(event) => setNewRole(event.target.value as UserRole)}>{roles.filter((role) => role.id !== 'owner').map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</select></label>
        <button type="button" onClick={addProfile} disabled={!newName.trim()}><Plus size={15} /> Add user</button>
      </div>}

      <div className="settings-user-list">
        {state.profiles.map((profile) => <article className={profile.id === state.activeProfileId ? 'active' : ''} key={profile.id}>
          <header><div className="settings-user-avatar">{profile.name.slice(0, 1).toUpperCase()}</div><div><strong>{profile.name}</strong><small>{roles.find((role) => role.id === profile.role)?.label}{profile.suspended ? ' · Suspended' : ''}</small></div>{profile.id === state.activeProfileId && <span className="settings-current-badge"><Check size={12} /> Current</span>}</header>
          {canManage && profile.role !== 'owner' && <>
            <label className="settings-role-select"><span>Role</span><select value={profile.role} onChange={(event) => changeRole(profile, event.target.value as UserRole)}>{roles.filter((role) => role.id !== 'owner').map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</select></label>
            <fieldset><legend>Allowed workspaces</legend><div>{workspaces.map((workspace) => <label key={workspace.id}><input type="checkbox" checked={profile.permissions.some((permission) => permission.workspace === workspace.id)} onChange={() => toggleWorkspace(profile, workspace.id)} />{workspace.label}</label>)}</div></fieldset>
            <div className="settings-user-actions"><label><input type="checkbox" checked={profile.suspended === true} onChange={(event) => updateProfile(profile.id, { suspended: event.target.checked })} /> Suspend access</label><button type="button" onClick={() => removeProfile(profile)}><Trash2 size={14} /> Remove</button></div>
          </>}
          {canManage && <div className="settings-pin-actions"><span><KeyRound size={14} /> {profile.pinHash ? 'PIN protected' : 'No PIN set'}</span><button type="button" onClick={() => void setProfilePin(profile)}>{profile.pinHash ? 'Change PIN' : 'Set PIN'}</button>{profile.pinHash && <button type="button" className="remove" onClick={() => removeProfilePin(profile)}>Remove PIN</button>}</div>}
          {profile.id !== state.activeProfileId && !profile.suspended && <button className="settings-switch-profile" type="button" onClick={() => void switchProfile(profile)}>Switch to {profile.name}</button>}
        </article>)}
      </div>
      {!canManage && <p className="settings-access-readonly">Only the Owner can change users and workspace permissions. Switch back to the Owner profile to manage access.</p>}
      {notice && <p className="settings-backup-notice" role="status">{notice}</p>}
    </section>
  )
}
