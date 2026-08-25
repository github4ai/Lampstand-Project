export const PROFILE_UNLOCK_PREFIX = 'lampstand-profile-unlocked:'

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('')
}

export function isValidPin(pin: string) { return /^\d{4,8}$/.test(pin) }

export async function hashPin(pin: string, salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)))) {
  if (!isValidPin(pin)) throw new Error('PIN must contain 4 to 8 digits.')
  const data = new TextEncoder().encode(`${salt}:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return `${salt}:${bytesToHex(new Uint8Array(digest))}`
}

export async function verifyPin(pin: string, stored: string) {
  const separator = stored.indexOf(':')
  if (separator < 1 || !isValidPin(pin)) return false
  const salt = stored.slice(0, separator)
  const candidate = await hashPin(pin, salt)
  if (candidate.length !== stored.length) return false
  let difference = 0
  for (let index = 0; index < candidate.length; index += 1) difference |= candidate.charCodeAt(index) ^ stored.charCodeAt(index)
  return difference === 0
}

export function markProfileUnlocked(profileId: string) { sessionStorage.setItem(PROFILE_UNLOCK_PREFIX + profileId, 'true') }
export function lockProfile(profileId: string) { sessionStorage.removeItem(PROFILE_UNLOCK_PREFIX + profileId) }
export function isProfileUnlocked(profileId: string) { return sessionStorage.getItem(PROFILE_UNLOCK_PREFIX + profileId) === 'true' }

