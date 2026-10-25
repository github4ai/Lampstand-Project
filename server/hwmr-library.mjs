import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export async function readHwmrLibrary(config) {
  try {
    const library = JSON.parse(await readFile(config.hwmrLibraryFile, 'utf8'))
    return { books: Array.isArray(library.books) ? library.books : [], audit: library.audit ?? null }
  } catch (error) {
    if (error?.code === 'ENOENT') return { books: [], audit: null }
    throw error
  }
}

const READABLE = ['passed', 'passed_with_exclusions']

export async function refreshHwmrLibrary(config) {
  let stdout
  try {
    const run = await execFileAsync(config.hwmrImportPython, [config.hwmrImporterScript, config.hwmrSourceDir, config.hwmrLibraryFile], {
      cwd: config.projectRoot,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    })
    stdout = run.stdout
  } catch (error) {
    // The importer reports on stderr; without it the app can only say "refresh failed".
    const lines = String(error?.stderr || error?.message || '').trim().split(/\r?\n/).filter(Boolean)
    throw new Error(`The HWMR reader could not be refreshed: ${lines.slice(-2).join(' ') || 'the importer did not run.'}`)
  }
  const resultLine = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1)
  const result = resultLine ? JSON.parse(resultLine) : null
  if (!result) throw new Error('The HWMR reader could not be refreshed: the importer returned no quality check.')
  if (!READABLE.includes(result.qualityCheck)) {
    throw new Error(`The HWMR reader could not be refreshed: ${result.reason || 'the quality check failed.'}`)
  }
  const skipped = Array.isArray(result.excluded) ? result.excluded : []
  if (skipped.length) {
    result.notice = `${skipped.length} PDF${skipped.length === 1 ? '' : 's'} not added — ${skipped.map((entry) => `${entry.file}: ${entry.reason}`).join(' ')}`
  }
  return result
}
