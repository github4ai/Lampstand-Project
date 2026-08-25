import { describe, expect, it } from 'vitest'
import { collectWorkspaceBackup, parseWorkspaceBackup, restoreWorkspaceBackup } from './workspaceBackup'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return { get length() { return data.size }, key: (index: number) => [...data.keys()][index] ?? null, getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => { data.delete(key) }, data }
}

describe('workspace backup migration', () => {
  it('includes Lampstand access profiles while retaining legacy AIOS data', () => {
    const storage = memoryStorage({ 'aios-old': '1', 'lampstand-access-control-v1': '{"version":1}', unrelated: 'skip' })
    const backup = collectWorkspaceBackup(storage as unknown as Storage)
    expect(backup.data).toEqual({ 'aios-old': '1', 'lampstand-access-control-v1': '{"version":1}' })
  })
  it('collects only AIOS browser data', () => {
    const storage = memoryStorage({ 'aios-chat': 'saved', unrelated: 'private' })
    expect(collectWorkspaceBackup(storage as unknown as Storage, new Date('2026-08-14T00:00:00Z'))).toMatchObject({ storageEntries: 1, data: { 'aios-chat': 'saved' } })
  })
  it('rejects malformed or non-AIOS entries', () => {
    expect(parseWorkspaceBackup({ format: 'aios-studio-workspace', data: { unsafe: 'value' } })).toBeNull()
    expect(parseWorkspaceBackup({ format: 'other', data: {} })).toBeNull()
  })
  it('supports merge and explicit replacement', () => {
    const backup = parseWorkspaceBackup({ format: 'aios-studio-workspace', version: 1, data: { 'aios-new': '2' } })!
    const merged = memoryStorage({ 'aios-old': '1', unrelated: 'keep' }); restoreWorkspaceBackup(merged as unknown as Storage, backup, 'merge')
    expect(Object.fromEntries(merged.data)).toEqual({ 'aios-old': '1', unrelated: 'keep', 'aios-new': '2' })
    const replaced = memoryStorage({ 'aios-old': '1', unrelated: 'keep' }); restoreWorkspaceBackup(replaced as unknown as Storage, backup, 'replace')
    expect(Object.fromEntries(replaced.data)).toEqual({ unrelated: 'keep', 'aios-new': '2' })
  })
})
