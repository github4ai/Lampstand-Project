export interface WorkspaceBackup { format: 'aios-studio-workspace'; version: 2; exportedAt: string; storageEntries: number; data: Record<string, string> }
type StorageLike = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>

export function collectWorkspaceBackup(storage: StorageLike, now = new Date()): WorkspaceBackup {
  const data: Record<string, string> = {}
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index); if (!key || (!key.startsWith('aios') && !key.startsWith('lampstand'))) continue
    const value = storage.getItem(key); if (value !== null) data[key] = value
  }
  return { format: 'aios-studio-workspace', version: 2, exportedAt: now.toISOString(), storageEntries: Object.keys(data).length, data }
}

export function parseWorkspaceBackup(value: unknown): WorkspaceBackup | null {
  if (!value || typeof value !== 'object') return null
  const input = value as { format?: unknown; exportedAt?: unknown; data?: unknown }
  if (input.format !== 'aios-studio-workspace' || !input.data || typeof input.data !== 'object' || Array.isArray(input.data)) return null
  const entries = Object.entries(input.data as Record<string, unknown>)
  if (entries.some(([key, item]) => (!key.startsWith('aios') && !key.startsWith('lampstand')) || typeof item !== 'string')) return null
  return { format: 'aios-studio-workspace', version: 2, exportedAt: typeof input.exportedAt === 'string' ? input.exportedAt : new Date(0).toISOString(), storageEntries: entries.length, data: Object.fromEntries(entries) as Record<string, string> }
}

export function restoreWorkspaceBackup(storage: StorageLike, backup: WorkspaceBackup, mode: 'merge' | 'replace') {
  let removed = 0
  if (mode === 'replace') {
    const existing = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => Boolean(key && (key.startsWith('aios') || key.startsWith('lampstand'))))
    existing.forEach((key) => { storage.removeItem(key); removed += 1 })
  }
  Object.entries(backup.data).forEach(([key, value]) => storage.setItem(key, value))
  return { restored: Object.keys(backup.data).length, removed }
}

export function workspaceBackupSize(backup: WorkspaceBackup) { return new Blob([JSON.stringify(backup)]).size }
