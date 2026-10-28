import { Check, KeyRound, Plus, ShieldCheck, Trash2, Unlock, UserRoundCog } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  ACCESS_CONTROL_STORAGE_KEY,
  type AccessControlState,
  type CustomRoleDefinition,
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
  const [newRoleLabel, setNewRoleLabel] = useState('')
  const [newCustomRoleId, setNewCustomRoleId] = useState('')
  const [customRoleName, setCustomRoleName] = useState('')
  const [customRoleBase, setCustomRoleBase] = useState<Exclude<UserRole, 'owner'>>('adult')
  const [customRolePermissions, setCustomRolePermissions] = useState(() => defaultPermissions('adult'))
  const [notice, setNotice] = useState('')
  const activeProfile = useMemo(() => state.profiles.find((profile) => profile.id === state.activeProfileId) ?? state.profiles[0], [state])
  const canManage = activeProfile?.role === 'owner'
  const customRoles = state.customRoles ?? []

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
    const customRole = customRoles.find((role) => role.id === newCustomRoleId)
    const timestamp = new Date().toISOString()
    const profile: LocalUserProfile = {
      id: crypto.randomUUID(), name, role: customRole?.baseRole ?? newRole,
      roleLabel: customRole?.name ?? (newRoleLabel.trim() || undefined),
      customRoleId: customRole?.id,
      permissions: customRole ? structuredClone(customRole.permissions) : defaultPermissions(newRole), createdAt: timestamp, updatedAt: timestamp,
    }
    commit((current) => ({ ...current, profiles: [...current.profiles, profile] }), `${name} was added.`)
    setNewName('')
    setNewRoleLabel('')
    setNewCustomRoleId('')
  }

  function createCustomRole() {
    const name = customRoleName.trim()
    if (!name) return
    const timestamp = new Date().toISOString()
    const role: CustomRoleDefinition = {
      id: crypto.randomUUID(), name, baseRole: customRoleBase,
      permissions: structuredClone(customRolePermissions), createdAt: timestamp, updatedAt: timestamp,
    }
    commit((current) => ({ ...current, customRoles: [...(current.customRoles ?? []), role] }), `${name} role was created.`)
    setCustomRoleName('')
  }

  function toggleCustomRoleWorkspace(workspace: WorkspaceId) {
    setCustomRolePermissions((current) => current.some((permission) => permission.workspace === workspace)
      ? current.filter((permission) => permission.workspace !== workspace)
      : [...current, defaultPermissions(customRoleBase).find((permission) => permission.workspace === workspace) ?? { workspace, actions: ['view'] }])
  }

  function updateCustomRole(roleId: string, changes: Partial<CustomRoleDefinition>) {
    commit((current) => ({ ...current, customRoles: (current.customRoles ?? []).map((role) => role.id === roleId
      ? { ...role, ...changes, updatedAt: new Date().toISOString() }
      : role) }), 'Custom role saved. Existing user overrides were preserved.')
  }

  function toggleSavedRoleWorkspace(role: CustomRoleDefinition, workspace: WorkspaceId) {
    const permissions = role.permissions.some((permission) => permission.workspace === workspace)
      ? role.permissions.filter((permission) => permission.workspace !== workspace)
      : [...role.permissions, defaultPermissions(role.baseRole).find((permission) => permission.workspace === workspace) ?? { workspace, actions: ['view'] as const }]
    updateCustomRole(role.id, { permissions })
  }

  function applyRoleToAssignedUsers(role: CustomRoleDefinition) {
    commit((current) => ({ ...current, profiles: current.profiles.map((profile) => profile.customRoleId === role.id
      ? { ...profile, role: role.baseRole, roleLabel: role.name, permissions: structuredClone(role.permissions), updatedAt: new Date().toISOString() }
      : profile) }), `${role.name} permissions were applied to assigned users.`)
  }

  function removeCustomRole(role: CustomRoleDefinition) {
    if (!window.confirm(`Delete the ${role.name} role template? Assigned users will keep their present access.`)) return
    commit((current) => ({ ...current, customRoles: (current.customRoles ?? []).filter((item) => item.id !== role.id), profiles: current.profiles.map((profile) => profile.customRoleId === role.id ? { ...profile, customRoleId: undefined } : profile) }), `${role.name} role template was deleted.`)
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
    updateProfile(profile.id, { role, roleLabel: undefined, customRoleId: undefined, permissions: defaultPermissions(role) })
  }

  function assignCustomRole(profile: LocalUserProfile, roleId: string) {
    const role = customRoles.find((item) => item.id === roleId)
    if (!role) return
    updateProfile(profile.id, { role: role.baseRole, roleLabel: role.name, customRoleId: role.id, permissions: structuredClone(role.permissions) })
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
      <div className="settings-active-user"><ShieldCheck size={18} /><span><strong>Currently using Lampstand as {activeProfile.name}</strong><small>{activeProfile.roleLabel || roles.find((role) => role.id === activeProfile.role)?.label} profile · permissions are stored locally on this computer.</small></span></div>

      {canManage && <div className="settings-custom-roles">
        <div className="settings-subsection-title"><h3>Custom role templates</h3><p>Create roles such as Teacher, Presenter, Volunteer, or Senior Student, then choose the workspaces they can use.</p></div>
        <div className="settings-role-builder">
          <label><span>Role name</span><input value={customRoleName} onChange={(event) => setCustomRoleName(event.target.value)} placeholder="For example, Teacher" maxLength={40} /></label>
          <label><span>Start with</span><select value={customRoleBase} onChange={(event) => { const baseRole = event.target.value as Exclude<UserRole, 'owner'>; setCustomRoleBase(baseRole); setCustomRolePermissions(defaultPermissions(baseRole)) }}>{roles.filter((role) => role.id !== 'owner').map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</select></label>
          <fieldset><legend>Default workspace access</legend><div>{workspaces.map((workspace) => <label key={workspace.id}><input type="checkbox" checked={customRolePermissions.some((permission) => permission.workspace === workspace.id)} onChange={() => toggleCustomRoleWorkspace(workspace.id)} />{workspace.label}</label>)}</div></fieldset>
          <button type="button" className="icon-btn" title="Create this role template" aria-label="Create this role template" onClick={createCustomRole} disabled={!customRoleName.trim()}><Plus size={15} /></button>
        </div>
        {customRoles.length > 0 && <div className="settings-custom-role-list">{customRoles.map((role) => <article key={role.id}>
          <header><label><span>Role name</span><input value={role.name} onChange={(event) => updateCustomRole(role.id, { name: event.target.value.trimStart() })} maxLength={40} /></label><small>Based on {roles.find((item) => item.id === role.baseRole)?.label}</small></header>
          <fieldset><legend>Default workspace access</legend><div>{workspaces.map((workspace) => <label key={workspace.id}><input type="checkbox" checked={role.permissions.some((permission) => permission.workspace === workspace.id)} onChange={() => toggleSavedRoleWorkspace(role, workspace.id)} />{workspace.label}</label>)}</div></fieldset>
          <div className="settings-custom-role-actions"><button type="button" onClick={() => applyRoleToAssignedUsers(role)}>Apply to assigned users</button><button className="remove icon-btn" type="button" title={`Delete the ${role.name} template`} aria-label={`Delete the ${role.name} template`} onClick={() => removeCustomRole(role)}><Trash2 size={14} /></button></div>
        </article>)}</div>}
      </div>}

      {canManage && <div className="settings-add-user">
        <label><span>Name</span><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Family member name" /></label>
        <label><span>Role</span><select value={newCustomRoleId ? `custom:${newCustomRoleId}` : `base:${newRole}`} onChange={(event) => { const [kind, value] = event.target.value.split(':'); if (kind === 'custom') setNewCustomRoleId(value); else { setNewCustomRoleId(''); setNewRole(value as UserRole) } }}>{roles.filter((role) => role.id !== 'owner').map((role) => <option key={role.id} value={`base:${role.id}`}>{role.label}</option>)}{customRoles.length > 0 && <optgroup label="Custom roles">{customRoles.map((role) => <option key={role.id} value={`custom:${role.id}`}>{role.name}</option>)}</optgroup>}</select></label>
        <label><span>Individual title</span><input value={newRoleLabel} onChange={(event) => setNewRoleLabel(event.target.value)} placeholder="Optional" maxLength={40} disabled={Boolean(newCustomRoleId)} /></label>
        <button type="button" className="icon-btn" title="Add this user" aria-label="Add this user" onClick={addProfile} disabled={!newName.trim()}><Plus size={15} /></button>
      </div>}

      <div className="settings-user-list">
        {state.profiles.map((profile) => <article className={profile.id === state.activeProfileId ? 'active' : ''} key={profile.id}>
          <header><div className="settings-user-avatar">{profile.name.slice(0, 1).toUpperCase()}</div><div><strong>{profile.name}</strong><small>{profile.roleLabel || roles.find((role) => role.id === profile.role)?.label}{profile.suspended ? ' · Suspended' : ''}</small></div>{profile.id === state.activeProfileId && <span className="settings-current-badge"><Check size={12} /> Current</span>}</header>
          {canManage && profile.role !== 'owner' && <>
            <label className="settings-role-select"><span>Role</span><select value={profile.customRoleId ? `custom:${profile.customRoleId}` : `base:${profile.role}`} onChange={(event) => { const [kind, value] = event.target.value.split(':'); if (kind === 'custom') assignCustomRole(profile, value); else changeRole(profile, value as UserRole) }}>{roles.filter((role) => role.id !== 'owner').map((role) => <option key={role.id} value={`base:${role.id}`}>{role.label}</option>)}{customRoles.length > 0 && <optgroup label="Custom roles">{customRoles.map((role) => <option key={role.id} value={`custom:${role.id}`}>{role.name}</option>)}</optgroup>}</select></label>
            <label className="settings-role-select"><span>Individual title</span><input value={profile.roleLabel || ''} onChange={(event) => updateProfile(profile.id, { roleLabel: event.target.value.trimStart() || undefined, customRoleId: undefined })} placeholder="Optional" maxLength={40} /></label>
            <fieldset><legend>Allowed workspaces</legend><div>{workspaces.map((workspace) => <label key={workspace.id}><input type="checkbox" checked={profile.permissions.some((permission) => permission.workspace === workspace.id)} onChange={() => toggleWorkspace(profile, workspace.id)} />{workspace.label}</label>)}</div></fieldset>
            <div className="settings-user-actions"><label><input type="checkbox" checked={profile.suspended === true} onChange={(event) => updateProfile(profile.id, { suspended: event.target.checked })} /> Suspend access</label><button type="button" className="icon-btn" title={`Remove ${profile.name}`} aria-label={`Remove ${profile.name}`} onClick={() => removeProfile(profile)}><Trash2 size={14} /></button></div>
          </>}
          {canManage && <div className="settings-pin-actions"><span><KeyRound size={14} /> {profile.pinHash ? 'PIN protected' : 'No PIN set'}</span><button type="button" className="icon-btn" title={profile.pinHash ? `Change the PIN for ${profile.name}` : `Set a PIN for ${profile.name}`} aria-label={profile.pinHash ? `Change the PIN for ${profile.name}` : `Set a PIN for ${profile.name}`} onClick={() => void setProfilePin(profile)}><KeyRound size={14} /></button>{profile.pinHash && <button type="button" className="remove icon-btn" title={`Remove the PIN for ${profile.name}`} aria-label={`Remove the PIN for ${profile.name}`} onClick={() => removeProfilePin(profile)}><Unlock size={14} /></button>}</div>}
          {profile.id !== state.activeProfileId && !profile.suspended && <button className="settings-switch-profile" type="button" onClick={() => void switchProfile(profile)}>Switch to {profile.name}</button>}
        </article>)}
      </div>
      {!canManage && <p className="settings-access-readonly">Only the Owner can change users and workspace permissions. Switch back to the Owner profile to manage access.</p>}
      {notice && <p className="settings-backup-notice" role="status">{notice}</p>}
    </section>
  )
}
