export type UserRole = 'owner' | 'family-admin' | 'adult' | 'student' | 'child' | 'guest'

export type WorkspaceId =
  | 'chat' | 'knowledge' | 'agents' | 'ministry' | 'church'
  | 'school' | 'media' | 'language-tools' | 'documents' | 'history' | 'settings'

export type AccessAction = 'view' | 'create' | 'edit' | 'delete' | 'import' | 'export' | 'share' | 'manage'

export interface WorkspacePermission {
  workspace: WorkspaceId
  actions: AccessAction[]
}

export interface LocalUserProfile {
  id: string
  name: string
  role: UserRole
  avatar?: string
  pinHash?: string
  permissions: WorkspacePermission[]
  createdAt: string
  updatedAt: string
  suspended?: boolean
}

export interface AccessControlState {
  version: 1
  activeProfileId: string
  profiles: LocalUserProfile[]
}

export const ACCESS_CONTROL_STORAGE_KEY = 'lampstand-access-control-v1'

const allActions: AccessAction[] = ['view', 'create', 'edit', 'delete', 'import', 'export', 'share', 'manage']
const allWorkspaces: WorkspaceId[] = ['chat', 'knowledge', 'agents', 'ministry', 'church', 'school', 'media', 'language-tools', 'documents', 'history', 'settings']

const roleWorkspaces: Record<UserRole, WorkspaceId[]> = {
  owner: allWorkspaces,
  'family-admin': allWorkspaces.filter((workspace) => workspace !== 'settings'),
  adult: ['chat', 'knowledge', 'agents', 'ministry', 'church', 'media', 'language-tools', 'documents', 'history'],
  student: ['chat', 'knowledge', 'school', 'language-tools', 'documents', 'history'],
  child: ['school', 'language-tools'],
  guest: ['chat', 'ministry', 'language-tools'],
}

function actionsForRole(role: UserRole): AccessAction[] {
  if (role === 'owner') return allActions
  if (role === 'family-admin') return allActions.filter((action) => action !== 'manage')
  if (role === 'adult') return ['view', 'create', 'edit', 'import', 'export', 'share']
  if (role === 'student') return ['view', 'create', 'edit', 'import', 'export']
  if (role === 'child') return ['view', 'create']
  return ['view']
}

export function defaultPermissions(role: UserRole): WorkspacePermission[] {
  const actions = actionsForRole(role)
  return roleWorkspaces[role].map((workspace) => ({ workspace, actions: [...actions] }))
}

export function createInitialAccessState(now = new Date()): AccessControlState {
  const timestamp = now.toISOString()
  const owner: LocalUserProfile = {
    id: 'owner',
    name: 'Owner',
    role: 'owner',
    permissions: defaultPermissions('owner'),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  return { version: 1, activeProfileId: owner.id, profiles: [owner] }
}

export function parseAccessControlState(value: string | null): AccessControlState | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as AccessControlState
    if (parsed.version !== 1 || !Array.isArray(parsed.profiles) || !parsed.activeProfileId) return null
    if (!parsed.profiles.some((profile) => profile.id === parsed.activeProfileId)) return null
    return parsed
  } catch {
    return null
  }
}

export function loadOrCreateAccessState(storage: Pick<Storage, 'getItem' | 'setItem'>, now = new Date()): AccessControlState {
  const existing = parseAccessControlState(storage.getItem(ACCESS_CONTROL_STORAGE_KEY))
  if (existing) {
    let changed = false
    const profiles = existing.profiles.map((profile) => {
      if (profile.role !== 'student') return profile
      const permissions = profile.permissions.map((permission) => {
        if ((permission.workspace !== 'documents' && permission.workspace !== 'knowledge') || permission.actions.includes('import')) return permission
        changed = true
        return { ...permission, actions: [...permission.actions, 'import' as const] }
      })
      return { ...profile, permissions }
    })
    const migrated = changed ? { ...existing, profiles } : existing
    if (changed) storage.setItem(ACCESS_CONTROL_STORAGE_KEY, JSON.stringify(migrated))
    return migrated
  }
  const initial = createInitialAccessState(now)
  storage.setItem(ACCESS_CONTROL_STORAGE_KEY, JSON.stringify(initial))
  return initial
}

export function canAccess(profile: LocalUserProfile | null | undefined, workspace: WorkspaceId, action: AccessAction = 'view'): boolean {
  if (!profile || profile.suspended) return false
  if (profile.role === 'owner') return true
  return profile.permissions.some((permission) => permission.workspace === workspace && permission.actions.includes(action))
}
