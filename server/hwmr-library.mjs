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

export async function refreshHwmrLibrary(config) {
  const { stdout } = await execFileAsync(config.hwmrImportPython, [config.hwmrImporterScript, config.hwmrSourceDir, config.hwmrLibraryFile], {
    cwd: config.projectRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  })
  const resultLine = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1)
  const result = resultLine ? JSON.parse(resultLine) : null
  if (!result || result.qualityCheck !== 'passed') throw new Error('The HWMR reader refresh did not pass its quality check.')
  return result
}
