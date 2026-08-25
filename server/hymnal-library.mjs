import { readFile } from 'node:fs/promises'
import { importHymnalMirror } from './hymnal-import.mjs'

const DEFAULT_COLLECTIONS = ['h', 'ns', 'nt', 'c', 'lb']

export async function readHymnalLibrary(config) {
  try {
    const library = JSON.parse(await readFile(config.hymnalLibraryFile, 'utf8'))
    return {
      importedAt: library.importedAt || null,
      root: library.root || null,
      hymns: Array.isArray(library.hymns) ? library.hymns : [],
      failures: Array.isArray(library.failures) ? library.failures : [],
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return { importedAt: null, root: null, hymns: [], failures: [] }
    throw error
  }
}

export async function importConfiguredHymnal(body, config) {
  const root = typeof body?.root === 'string' && body.root.trim() ? body.root.trim() : config.hymnalMirrorRoot
  const collections = Array.isArray(body?.collections)
    ? body.collections.filter((item) => typeof item === 'string' && /^[a-z]+$/i.test(item))
    : DEFAULT_COLLECTIONS
  return importHymnalMirror(root, config.hymnalLibraryFile, collections)
}
