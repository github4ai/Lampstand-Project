import { describe, expect, it, vi } from 'vitest'
import { cloudSessionNeedsRefresh, createEnrollment, getOrCreateDeviceId, parseRemotePolicy } from './remoteAccess'

describe('remote access foundation', () => {
  it('creates and retains a stable device identity', () => {
    const values = new Map<string, string>()
    const storage = { getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, value: string) => values.set(key, value)) }
    const first = getOrCreateDeviceId(storage)
    expect(getOrCreateDeviceId(storage)).toBe(first)
    expect(storage.setItem).toHaveBeenCalledTimes(1)
  })

  it('creates a short-lived enrollment code', () => {
    const enrollment = createEnrollment('device-1', new Date('2026-08-14T10:00:00Z'))
    expect(enrollment.code).toMatch(/^[0-9A-F]{8}$/)
    expect(enrollment.expiresAt).toBe('2026-08-14T10:15:00.000Z')
  })

  it('accepts only current policies for the matching device', () => {
    const policy = JSON.stringify({ version: 1, deviceId: 'device-1', profileId: 'child-1', permissions: [], issuedAt: '2026-08-14T09:00:00Z', expiresAt: '2026-08-15T09:00:00Z' })
    expect(parseRemotePolicy(policy, 'device-1', new Date('2026-08-14T10:00:00Z'))?.profileId).toBe('child-1')
    expect(parseRemotePolicy(policy, 'other-device', new Date('2026-08-14T10:00:00Z'))).toBeNull()
    expect(parseRemotePolicy(policy, 'device-1', new Date('2026-08-16T10:00:00Z'))).toBeNull()
  })

  it('refreshes an expired or nearly expired cloud session', () => {
    const session = { accessToken: 'access', refreshToken: 'refresh', expiresAt: 1_100_000, user: { id: 'user-1' } }
    expect(cloudSessionNeedsRefresh(session, 1_000_000)).toBe(false)
    expect(cloudSessionNeedsRefresh(session, 1_050_000)).toBe(true)
  })
})
