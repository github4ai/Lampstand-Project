import { describe, expect, it } from 'vitest'
import { hashPin, isValidPin, verifyPin } from './pinSecurity'

describe('profile PIN security', () => {
  it('accepts only 4 to 8 digits', () => {
    expect(isValidPin('1234')).toBe(true)
    expect(isValidPin('12345678')).toBe(true)
    expect(isValidPin('123')).toBe(false)
    expect(isValidPin('12ab')).toBe(false)
  })

  it('stores a salted hash and verifies without retaining the PIN', async () => {
    const stored = await hashPin('2468', '00112233445566778899aabbccddeeff')
    expect(stored).not.toContain('2468')
    expect(await verifyPin('2468', stored)).toBe(true)
    expect(await verifyPin('1357', stored)).toBe(false)
  })
})
