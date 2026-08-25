import { describe, expect, it, vi } from 'vitest'
import { ACCESS_CONTROL_STORAGE_KEY, canAccess, createInitialAccessState, defaultPermissions, loadOrCreateAccessState, parseAccessControlState } from './accessControl'

describe('Lampstand local access control', () => {
  it('migrates the existing single-user workspace to an Owner profile', () => {
    const values = new Map<string, string>()
    const storage = { getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, value: string) => values.set(key, value)) }
    const state = loadOrCreateAccessState(storage as unknown as Storage, new Date('2026-08-14T00:00:00.000Z'))
    expect(state.activeProfileId).toBe('owner')
    expect(state.profiles[0]).toMatchObject({ name: 'Owner', role: 'owner' })
    expect(storage.setItem).toHaveBeenCalledWith(ACCESS_CONTROL_STORAGE_KEY, expect.any(String))
  })

  it('gives the Owner complete access', () => {
    const owner = createInitialAccessState().profiles[0]
    expect(canAccess(owner, 'settings', 'manage')).toBe(true)
    expect(canAccess(owner, 'media', 'delete')).toBe(true)
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

  it('rejects suspended and malformed profiles', () => {
    const guest = { ...createInitialAccessState().profiles[0], suspended: true }
    expect(canAccess(guest, 'chat')).toBe(false)
    expect(parseAccessControlState('{"version":1,"profiles":[]}')).toBeNull()
  })
})
