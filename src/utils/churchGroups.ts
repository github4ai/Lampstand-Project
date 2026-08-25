export const churchGroupsStorageKey = 'aios-church-groups-v1'
export const churchGroupDefaultsStorageKey = 'aios-church-group-defaults-v1'
export type ChurchGroupDefaults = { prayerPoints: string; announcements: string }

export function loadSavedChurchGroups() {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(churchGroupsStorageKey) || '[]')
    return Array.isArray(value) ? value.map(String).map((group) => group.trim()).filter(Boolean) : []
  } catch { return [] }
}

export function saveChurchGroups(groups: string[]) {
  localStorage.setItem(churchGroupsStorageKey, JSON.stringify([...new Set(groups.map((group) => group.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))))
}

export function loadChurchGroupDefaults(): ChurchGroupDefaults {
  try {
    const value = JSON.parse(localStorage.getItem(churchGroupDefaultsStorageKey) || '{}') as Partial<ChurchGroupDefaults>
    return { prayerPoints: String(value.prayerPoints || '').trim(), announcements: String(value.announcements || '').trim() }
  } catch { return { prayerPoints: '', announcements: '' } }
}

export function saveChurchGroupDefaults(defaults: ChurchGroupDefaults) {
  localStorage.setItem(churchGroupDefaultsStorageKey, JSON.stringify({ prayerPoints: defaults.prayerPoints.trim(), announcements: defaults.announcements.trim() }))
}
