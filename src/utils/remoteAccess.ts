import type { UserRole, WorkspacePermission } from './accessControl'

export const DEVICE_ID_KEY = 'lampstand-device-id-v1'
export const DEVICE_NAME_KEY = 'lampstand-device-name-v1'
export const REMOTE_POLICY_KEY = 'lampstand-remote-policy-v1'
export const ENROLLMENT_KEY = 'lampstand-device-enrollment-v1'
export const CLOUD_SESSION_KEY = 'lampstand-cloud-session-v1'

export interface CloudSession {
  accessToken: string
  refreshToken: string
  expiresAt: number
  user: { id: string; email?: string }
}

export interface RemoteFamily { id: string; name: string; owner_id: string }
export interface RemoteDevice { id: string; family_id: string; device_key: string; name: string; approved: boolean; revoked_at?: string | null }
export interface RemoteMember {
  id: string
  family_id: string
  user_id?: string | null
  invited_email: string
  display_name: string
  role: UserRole
  permissions: WorkspacePermission[]
  suspended: boolean
  created_at: string
  updated_at: string
}

export interface RemotePermissionPolicy {
  version: 1
  deviceId: string
  profileId: string
  permissions: WorkspacePermission[]
  issuedAt: string
  expiresAt: string
  revoked?: boolean
}

export interface DeviceEnrollment {
  deviceId: string
  code: string
  createdAt: string
  expiresAt: string
}

export function cloudConfiguration() {
  const url = String(import.meta.env.VITE_LAMPSTAND_CLOUD_URL || '').replace(/\/+$/, '')
  const publicKey = String(import.meta.env.VITE_LAMPSTAND_CLOUD_PUBLIC_KEY || '')
  return { url, publicKey, configured: Boolean(url && publicKey) }
}

export function getOrCreateDeviceId(storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {
  const existing = storage.getItem(DEVICE_ID_KEY)
  if (existing) return existing
  const id = crypto.randomUUID()
  storage.setItem(DEVICE_ID_KEY, id)
  return id
}

export function getDeviceName(storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {
  const existing = storage.getItem(DEVICE_NAME_KEY)
  if (existing) return existing
  const name = `Lampstand on ${navigator.platform || 'Windows'}`
  storage.setItem(DEVICE_NAME_KEY, name)
  return name
}

export function createEnrollment(deviceId: string, now = new Date()): DeviceEnrollment {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  const code = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()
  return { deviceId, code, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString() }
}

export function saveEnrollment(storage: Pick<Storage, 'setItem'>, enrollment: DeviceEnrollment) {
  storage.setItem(ENROLLMENT_KEY, JSON.stringify(enrollment))
}

export function parseRemotePolicy(value: string | null, deviceId: string, now = new Date()): RemotePermissionPolicy | null {
  if (!value) return null
  try {
    const policy = JSON.parse(value) as RemotePermissionPolicy
    if (policy.version !== 1 || policy.deviceId !== deviceId || !policy.profileId || !Array.isArray(policy.permissions)) return null
    if (policy.revoked || new Date(policy.expiresAt).getTime() <= now.getTime()) return null
    return policy
  } catch { return null }
}

export function cachedRemotePolicy(storage: Pick<Storage, 'getItem'>, deviceId: string, now = new Date()) {
  return parseRemotePolicy(storage.getItem(REMOTE_POLICY_KEY), deviceId, now)
}

function cloudHeaders(accessToken?: string, prefer?: string) {
  const cloud = cloudConfiguration()
  return {
    apikey: cloud.publicKey,
    Authorization: `Bearer ${accessToken || cloud.publicKey}`,
    'Content-Type': 'application/json',
    ...(prefer ? { Prefer: prefer } : {}),
  }
}

async function cloudRequest<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  const cloud = cloudConfiguration()
  if (!cloud.configured) throw new Error('Lampstand cloud is not configured.')
  const response = await fetch(`${cloud.url}${path}`, { ...init, headers: { ...cloudHeaders(accessToken), ...(init.headers || {}) } })
  const body = await response.text()
  if (!response.ok) {
    try { throw new Error((JSON.parse(body) as { message?: string; error_description?: string }).message || JSON.parse(body).error_description || `Cloud request failed (${response.status}).`) }
    catch (error) { if (error instanceof Error && !error.message.startsWith('Unexpected token')) throw error }
    throw new Error(body || `Cloud request failed (${response.status}).`)
  }
  return (body ? JSON.parse(body) : null) as T
}

const LIBRARY_BUCKET = 'lampstand-library'

function storageObjectPath(path: string) {
  return String(path || '').split('/').filter(Boolean).map(encodeURIComponent).join('/')
}

export function publicLibraryObjectUrl(path: string) {
  const cloud = cloudConfiguration()
  return `${cloud.url}/storage/v1/object/public/${LIBRARY_BUCKET}/${storageObjectPath(path)}`
}

export async function loadPublishedLibraryManifest() {
  const response = await fetch(`${publicLibraryObjectUrl('manifest.json')}?t=${Date.now()}`, { cache: 'no-store' })
  if (response.status === 404) return { version: '', files: [] as Array<{ path: string; url: string; sha256: string; size: number }> }
  if (!response.ok) throw new Error(`Unable to load the current library manifest (${response.status}).`)
  return response.json() as Promise<{ version: string; files: Array<{ path: string; url: string; sha256: string; size: number }> }>
}

export async function uploadLibraryObject(session: CloudSession, path: string, body: Blob, contentType = 'application/octet-stream') {
  const cloud = cloudConfiguration()
  if (!cloud.configured) throw new Error('Lampstand cloud is not configured.')
  const response = await fetch(`${cloud.url}/storage/v1/object/${LIBRARY_BUCKET}/${storageObjectPath(path)}`, {
    method: 'POST',
    headers: { apikey: cloud.publicKey, Authorization: `Bearer ${session.accessToken}`, 'Content-Type': contentType, 'x-upsert': 'true' },
    body,
  })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Library upload failed (${response.status}).`)
  }
}

export function loadCloudSession(storage: Pick<Storage, 'getItem'> = localStorage): CloudSession | null {
  try {
    const value = storage.getItem(CLOUD_SESSION_KEY)
    if (!value) return null
    const session = JSON.parse(value) as CloudSession
    return session.accessToken && session.user?.id ? session : null
  } catch { return null }
}

export function saveCloudSession(session: CloudSession, storage: Pick<Storage, 'setItem'> = localStorage) {
  storage.setItem(CLOUD_SESSION_KEY, JSON.stringify(session))
}

export function clearCloudSession(storage: Pick<Storage, 'removeItem'> = localStorage) {
  storage.removeItem(CLOUD_SESSION_KEY)
}

function sessionFromResponse(value: { access_token: string; refresh_token: string; expires_in: number; user: { id: string; email?: string } }): CloudSession {
  return { accessToken: value.access_token, refreshToken: value.refresh_token, expiresAt: Date.now() + value.expires_in * 1000, user: value.user }
}

export async function signInOwner(email: string, password: string) {
  const result = await cloudRequest<{ access_token: string; refresh_token: string; expires_in: number; user: { id: string; email?: string } }>('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) })
  return sessionFromResponse(result)
}

export function cloudSessionNeedsRefresh(session: CloudSession, now = Date.now()) {
  return !session.refreshToken || session.expiresAt <= now + 60_000
}

export async function refreshCloudSession(session: CloudSession) {
  if (!session.refreshToken) throw new Error('Your sign-in session has expired. Please sign in again.')
  const result = await cloudRequest<{ access_token: string; refresh_token: string; expires_in: number; user: { id: string; email?: string } }>(
    '/auth/v1/token?grant_type=refresh_token',
    { method: 'POST', body: JSON.stringify({ refresh_token: session.refreshToken }) },
  )
  return sessionFromResponse(result)
}

export async function ensureFreshCloudSession(session: CloudSession, now = Date.now()) {
  return cloudSessionNeedsRefresh(session, now) ? refreshCloudSession(session) : session
}

export async function signUpOwner(email: string, password: string) {
  const result = await cloudRequest<{ access_token?: string; refresh_token?: string; expires_in?: number; user: { id: string; email?: string } }>('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email, password }) })
  if (!result.access_token || !result.refresh_token || !result.expires_in) throw new Error('Account created. Confirm the email address, then sign in.')
  return sessionFromResponse(result as { access_token: string; refresh_token: string; expires_in: number; user: { id: string; email?: string } })
}

export async function signOutOwner(session: CloudSession) {
  await cloudRequest<null>('/auth/v1/logout', { method: 'POST' }, session.accessToken)
}

export async function getOrCreateRemoteFamily(session: CloudSession, familyName = 'My Family'): Promise<RemoteFamily> {
  const existing = await cloudRequest<RemoteFamily[]>('/rest/v1/lampstand_families?select=id,name,owner_id&limit=1', {}, session.accessToken)
  if (existing[0]) return existing[0]
  const created = await cloudRequest<RemoteFamily[]>('/rest/v1/lampstand_families', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ name: familyName, owner_id: session.user.id }) }, session.accessToken)
  return created[0]
}

export async function getOwnedRemoteFamily(session: CloudSession) {
  const rows = await cloudRequest<RemoteFamily[]>(`/rest/v1/lampstand_families?owner_id=eq.${encodeURIComponent(session.user.id)}&select=id,name,owner_id&limit=1`, {}, session.accessToken)
  return rows[0] || null
}

export async function claimFirstRemoteOwner(session: CloudSession, familyName = 'Lampstand Family') {
  return cloudRequest<RemoteFamily>('/rest/v1/rpc/lampstand_claim_first_owner', { method: 'POST', body: JSON.stringify({ family_name: familyName }) }, session.accessToken)
}

export async function registerOwnerDevice(session: CloudSession, family: RemoteFamily, deviceId: string, name: string): Promise<RemoteDevice> {
  const query = `/rest/v1/lampstand_devices?device_key=eq.${encodeURIComponent(deviceId)}&select=id,family_id,device_key,name,approved,revoked_at`
  const existing = await cloudRequest<RemoteDevice[]>(query, {}, session.accessToken)
  if (existing[0]) {
    const updated = await cloudRequest<RemoteDevice[]>(`/rest/v1/lampstand_devices?id=eq.${existing[0].id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ name, approved: true, revoked_at: null, last_seen_at: new Date().toISOString() }) }, session.accessToken)
    return updated[0]
  }
  const created = await cloudRequest<RemoteDevice[]>('/rest/v1/lampstand_devices', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ family_id: family.id, device_key: deviceId, name, platform: navigator.platform || 'Windows', approved: true, last_seen_at: new Date().toISOString() }) }, session.accessToken)
  return created[0]
}

export async function listRemoteMembers(session: CloudSession, familyId: string) {
  return cloudRequest<RemoteMember[]>(`/rest/v1/lampstand_members?family_id=eq.${familyId}&select=id,family_id,user_id,invited_email,display_name,role,permissions,suspended,created_at,updated_at&order=created_at.asc`, {}, session.accessToken)
}

export async function inviteRemoteMember(session: CloudSession, familyId: string, member: Pick<RemoteMember, 'invited_email' | 'display_name' | 'role' | 'permissions'>) {
  const rows = await cloudRequest<RemoteMember[]>('/rest/v1/lampstand_members', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      family_id: familyId,
      local_profile_id: crypto.randomUUID(),
      invited_email: member.invited_email.trim().toLowerCase(),
      display_name: member.display_name.trim(),
      role: member.role,
      permissions: member.permissions,
      invited_by: session.user.id,
    }),
  }, session.accessToken)
  return rows[0]
}

export async function updateRemoteMember(session: CloudSession, memberId: string, changes: Partial<Pick<RemoteMember, 'display_name' | 'role' | 'permissions' | 'suspended'>>) {
  const rows = await cloudRequest<RemoteMember[]>(`/rest/v1/lampstand_members?id=eq.${memberId}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(changes),
  }, session.accessToken)
  return rows[0]
}

export async function removeRemoteMember(session: CloudSession, memberId: string) {
  await cloudRequest<null>(`/rest/v1/lampstand_members?id=eq.${memberId}`, { method: 'DELETE' }, session.accessToken)
}

export async function loadSignedInMembership(session: CloudSession) {
  const rows = await cloudRequest<RemoteMember[]>('/rest/v1/lampstand_members?user_id=eq.' + encodeURIComponent(session.user.id) + '&select=id,family_id,user_id,invited_email,display_name,role,permissions,suspended,created_at,updated_at&limit=1', {}, session.accessToken)
  return rows[0] || null
}

export async function syncRemotePolicy(session: CloudSession, device: RemoteDevice, storage: Pick<Storage, 'setItem'> = localStorage) {
  const rows = await cloudRequest<Array<{ policy: RemotePermissionPolicy; expires_at: string; revoked_at?: string | null }>>(`/rest/v1/lampstand_policies?device_id=eq.${device.id}&revoked_at=is.null&select=policy,expires_at,revoked_at&order=created_at.desc&limit=1`, {}, session.accessToken)
  if (!rows[0]) return null
  const policy = { ...rows[0].policy, deviceId: device.device_key, expiresAt: rows[0].expires_at, revoked: Boolean(rows[0].revoked_at) }
  storage.setItem(REMOTE_POLICY_KEY, JSON.stringify(policy))
  return policy
}
