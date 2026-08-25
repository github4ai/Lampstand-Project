import { Save, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { defaultPermissions, type UserRole, type WorkspaceId, type WorkspacePermission } from '../../utils/accessControl'
import { inviteRemoteMember, listRemoteMembers, removeRemoteMember, updateRemoteMember, type CloudSession, type RemoteFamily, type RemoteMember } from '../../utils/remoteAccess'

const workspaces: Array<{ id: WorkspaceId; label: string }> = [
  { id: 'chat', label: 'Chat' }, { id: 'knowledge', label: 'Knowledge' }, { id: 'agents', label: 'Agents' },
  { id: 'ministry', label: 'Ministry' }, { id: 'church', label: 'Church' }, { id: 'school', label: 'School' },
  { id: 'media', label: 'Media Studio' }, { id: 'language-tools', label: 'Language Tools' },
  { id: 'documents', label: 'Documents' }, { id: 'history', label: 'History' },
]
const roles: UserRole[] = ['family-admin', 'adult', 'student', 'child', 'guest']

function selectedWorkspaces(permissions: WorkspacePermission[]) { return new Set(permissions.filter((item) => item.actions.includes('view')).map((item) => item.workspace)) }
function permissionsFor(role: UserRole, selected: Set<WorkspaceId>) { return defaultPermissions(role).filter((item) => selected.has(item.workspace)) }
function toggleMemberWorkspace(member: RemoteMember, workspace: WorkspaceId) {
  const selected = selectedWorkspaces(member.permissions)
  selected.has(workspace) ? selected.delete(workspace) : selected.add(workspace)
  return permissionsFor(member.role, selected)
}

export default function RemoteMemberManager({ session, family }: { session: CloudSession; family: RemoteFamily }) {
  const [members, setMembers] = useState<RemoteMember[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('student')
  const [selected, setSelected] = useState(() => selectedWorkspaces(defaultPermissions('student')))
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const count = useMemo(() => members.filter((member) => !member.suspended).length, [members])

  async function refresh() {
    try { setMembers(await listRemoteMembers(session, family.id)) }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not load remote members.') }
  }
  useEffect(() => { void refresh() }, [family.id])

  function changeRole(next: UserRole) { setRole(next); setSelected(selectedWorkspaces(defaultPermissions(next))) }
  function toggle(workspace: WorkspaceId) { setSelected((current) => { const next = new Set(current); next.has(workspace) ? next.delete(workspace) : next.add(workspace); return next }) }
  async function invite() {
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) { setNotice('Enter the member name and a valid email address.'); return }
    setBusy(true)
    try {
      await inviteRemoteMember(session, family.id, { display_name: name, invited_email: email, role, permissions: permissionsFor(role, selected) })
      setName(''); setEmail(''); setNotice('Member access prepared. They can now create and verify an account with this email.'); await refresh()
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not add this member.') }
    finally { setBusy(false) }
  }
  async function save(member: RemoteMember, changes: Partial<RemoteMember>) {
    setBusy(true)
    try { await updateRemoteMember(session, member.id, changes); setNotice('Remote access updated.'); await refresh() }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not update access.') }
    finally { setBusy(false) }
  }
  async function remove(member: RemoteMember) {
    if (!window.confirm(`Remove remote access for ${member.display_name}?`)) return
    setBusy(true)
    try { await removeRemoteMember(session, member.id); setNotice('Member access removed.'); await refresh() }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not remove access.') }
    finally { setBusy(false) }
  }

  return <div className="settings-remote-members">
    <div className="settings-remote-members-heading"><span><strong>Members &amp; permissions</strong><small>{count} active member{count === 1 ? '' : 's'}</small></span></div>
    <div className="settings-member-invite">
      <label><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Member name" /></label>
      <label><span>Verified email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="member@example.com" /></label>
      <label><span>Role</span><select value={role} onChange={(event) => changeRole(event.target.value as UserRole)}>{roles.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <div className="settings-member-workspaces">{workspaces.map((workspace) => <label key={workspace.id}><input type="checkbox" checked={selected.has(workspace.id)} onChange={() => toggle(workspace.id)} /> {workspace.label}</label>)}</div>
      <button type="button" disabled={busy} onClick={() => void invite()}><UserPlus size={15} /> Add member access</button>
    </div>
    <div className="settings-member-list">{members.map((member) => <article key={member.id}>
      <div className="settings-member-identity"><strong>{member.display_name}</strong><small>{member.invited_email} · {member.user_id ? 'Email account connected' : 'Awaiting sign-up'}</small></div>
      <select value={member.role} disabled={busy} onChange={(event) => { const nextRole = event.target.value as UserRole; void save(member, { role: nextRole, permissions: defaultPermissions(nextRole) }) }}>{roles.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <label><input type="checkbox" checked={!member.suspended} disabled={busy} onChange={(event) => void save(member, { suspended: !event.target.checked })} /> Active</label>
      <button type="button" title="Save current access" disabled={busy} onClick={() => void save(member, {})}><Save size={14} /></button>
      <button type="button" title="Remove member" disabled={busy} onClick={() => void remove(member)}><Trash2 size={14} /></button>
      <fieldset className="settings-member-workspace-editor">
        <legend>Allowed parts of Lampstand</legend>
        {workspaces.map((workspace) => <label key={workspace.id}>
          <input
            type="checkbox"
            checked={selectedWorkspaces(member.permissions).has(workspace.id)}
            disabled={busy}
            onChange={() => void save(member, { permissions: toggleMemberWorkspace(member, workspace.id) })}
          /> {workspace.label}
        </label>)}
      </fieldset>
    </article>)}</div>
    {notice && <p className="settings-backup-notice" role="status">{notice}</p>}
  </div>
}
