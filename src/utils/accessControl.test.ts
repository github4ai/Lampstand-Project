import { describe, expect, it, vi } from 'vitest'
import { ACCESS_CONTROL_STORAGE_KEY, canAccess, canManageUsers, createInitialAccessState, defaultPermissions, loadOrCreateAccessState, parseAccessControlState } from './accessControl'

describe('Lampstand local access control', () => {
  it('migrates the existing single-user workspace to an Owner profile', () => {
    const values = new Map<string, string>()
    const storage = { getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, value: string) => values.set(key, value)) }
    const state = loadOrCreateAccessState(storage as unknown as Storage, new Date('2026-08-14T00:00:00.000Z'))
    expect(state.activeProfileId).toBe('owner')
    expect(state.profiles[0]).toMatchObject({ name: 'Owner', role: 'owner' })
    expect(storage.setItem).toHaveBeenCalledWith(ACCESS_CONTROL_STORAGE_KEY, expect.any(String))
    expect(state.customRoles).toEqual([])
  })

  it('preserves owner-created custom role templates and existing user overrides', () => {
    const owner = createInitialAccessState().profiles[0]
    const template = { id: 'teacher', name: 'Teacher', baseRole: 'adult' as const, permissions: defaultPermissions('adult').filter((permission) => permission.workspace !== 'media'), createdAt: owner.createdAt, updatedAt: owner.updatedAt }
    const teacher = { ...owner, id: 'teacher-user', name: 'Teacher User', role: 'adult' as const, roleLabel: 'Teacher', customRoleId: template.id, permissions: [...template.permissions, { workspace: 'school' as const, actions: ['view' as const] }] }
    const values = new Map([[ACCESS_CONTROL_STORAGE_KEY, JSON.stringify({ version: 1, activeProfileId: owner.id, profiles: [owner, teacher], customRoles: [template] })]])
    const storage = { getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, value: string) => values.set(key, value)) }
    const state = loadOrCreateAccessState(storage as unknown as Storage)
    expect(state.customRoles?.[0]).toMatchObject({ name: 'Teacher', baseRole: 'adult' })
    expect(state.profiles[1].permissions.some((permission) => permission.workspace === 'school')).toBe(true)
  })

  it('gives the Owner complete access', () => {
    const owner = createInitialAccessState().profiles[0]
    expect(canAccess(owner, 'settings', 'manage')).toBe(true)
    expect(canAccess(owner, 'media', 'delete')).toBe(true)
    expect(canAccess(owner, 'presentation')).toBe(true)
    expect(canManageUsers(owner)).toBe(true)
  })

  it('allows every active role to open Settings without granting user administration', () => {
    const owner = createInitialAccessState().profiles[0]
    const student = { ...owner, id: 'student', role: 'student' as const, permissions: defaultPermissions('student') }
    const familyAdmin = { ...owner, id: 'family-admin', role: 'family-admin' as const, permissions: defaultPermissions('family-admin') }
    expect(canManageUsers(student)).toBe(false)
    expect(canManageUsers(familyAdmin)).toBe(false)
    expect(canManageUsers(owner)).toBe(true)
  })

  it('supports independently enabled and disabled Presentation access', () => {
    const adult = { ...createInitialAccessState().profiles[0], role: 'adult' as const, permissions: defaultPermissions('adult') }
    expect(canAccess(adult, 'presentation')).toBe(true)
    expect(canAccess({ ...adult, permissions: adult.permissions.filter((permission) => permission.workspace !== 'presentation') }, 'presentation')).toBe(false)
  })

  it('keeps restricted roles away from administrative workspaces', () => {
    const profile = { ...createInitialAccessState().profiles[0], role: 'student' as const, permissions: defaultPermissions('student') }
    expect(canAccess(profile, 'school', 'create')).toBe(true)
    expect(canAccess(profile, 'documents', 'import')).toBe(true)
    expect(canAccess(profile, 'settings')).toBe(false)
    expect(canAccess(profile, 'media')).toBe(false)
  })

  it('upgrades existing Student profiles so they can add documents', () => {
    const owner = createInitialAccessState().profiles[0]
    const student = { ...owner, id: 'student', role: 'student' as const, permissions: defaultPermissions('student').map((permission) => ({ ...permission, actions: permission.actions.filter((action) => action !== 'import') })) }
    const values = new Map([[ACCESS_CONTROL_STORAGE_KEY, JSON.stringify({ version: 1, activeProfileId: 'student', profiles: [student] })]])
    const storage = { getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, value: string) => values.set(key, value)) }
    const state = loadOrCreateAccessState(storage as unknown as Storage)
    expect(canAccess(state.profiles[0], 'documents', 'import')).toBe(true)
    expect(storage.setItem).toHaveBeenCalled()
  })

  it('migrates saved profiles without Presentation access from their existing Ministry access', () => {
    const permissions = defaultPermissions('adult').filter((permission) => permission.workspace !== 'presentation')
    const profile = { ...createInitialAccessState().profiles[0], id: 'adult', role: 'adult' as const, permissions }
    const values = new Map([[ACCESS_CONTROL_STORAGE_KEY, JSON.stringify({ version: 1, activeProfileId: 'adult', profiles: [profile] })]])
    const storage = { getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, value: string) => values.set(key, value)) }
    const state = loadOrCreateAccessState(storage as unknown as Storage)
    expect(canAccess(state.profiles[0], 'presentation')).toBe(true)
    expect(storage.setItem).toHaveBeenCalled()
  })

  it('rejects suspended and malformed profiles', () => {
    const guest = { ...createInitialAccessState().profiles[0], suspended: true }
    expect(canAccess(guest, 'chat')).toBe(false)
    expect(parseAccessControlState('{"version":1,"profiles":[]}')).toBeNull()
  })
})
