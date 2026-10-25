import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readHwmrLibrary, refreshHwmrLibrary } from './hwmr-library.mjs'

const temporaryFolders = []

async function temporaryFolder() {
  const folder = await mkdtemp(join(tmpdir(), 'aios-hwmr-test-'))
  temporaryFolders.push(folder)
  return folder
}

afterEach(async () => {
  await Promise.all(temporaryFolders.splice(0).map((folder) => rm(folder, { recursive: true, force: true })))
})

describe('HWMR library server', () => {
  it('preserves the generated verification record', async () => {
    const folder = await temporaryFolder()
    const libraryFile = join(folder, 'library.json')
    const audit = { status: 'passed', checkedAt: '2026-08-14T00:00:00Z', books: 3, dailyPortions: 84, morningVerses: 150 }
    await writeFile(libraryFile, JSON.stringify({ books: [{ id: 'book-1' }], audit }))

    await expect(readHwmrLibrary({ hwmrLibraryFile: libraryFile })).resolves.toEqual({ books: [{ id: 'book-1' }], audit })
  })

  it('accepts a refresh only when the importer quality check passes', async () => {
    const folder = await temporaryFolder()
    const importer = join(folder, 'importer.mjs')
    await writeFile(importer, 'console.log(JSON.stringify({ qualityCheck: "passed", dailyPortions: 84, morningVerses: 150 }))')

    await expect(refreshHwmrLibrary({
      hwmrImportPython: process.execPath,
      hwmrImporterScript: importer,
      hwmrSourceDir: folder,
      hwmrLibraryFile: join(folder, 'library.json'),
      projectRoot: folder,
    })).resolves.toMatchObject({ qualityCheck: 'passed', dailyPortions: 84, morningVerses: 150 })
  })

  it('reports the PDFs an import had to leave out', async () => {
    const folder = await temporaryFolder()
    const result = { qualityCheck: 'passed_with_exclusions', dailyPortions: 84, morningVerses: 150, excluded: [{ file: 'believers.pdf', reason: 'Week 6 has no parsed verses' }] }
    const importer = join(folder, 'importer.mjs')
    await writeFile(importer, `console.log(${JSON.stringify(JSON.stringify(result))})`)

    await expect(refreshHwmrLibrary({
      hwmrImportPython: process.execPath,
      hwmrImporterScript: importer,
      hwmrSourceDir: folder,
      hwmrLibraryFile: join(folder, 'library.json'),
      projectRoot: folder,
    })).resolves.toMatchObject({ notice: '1 PDF not added — believers.pdf: Week 6 has no parsed verses' })
  })

  it('carries the importer failure out of the server log', async () => {
    const folder = await temporaryFolder()
    const importer = join(folder, 'importer.mjs')
    await writeFile(importer, 'console.error("ModuleNotFoundError: No module named fitz"); process.exit(1)')

    await expect(refreshHwmrLibrary({
      hwmrImportPython: process.execPath,
      hwmrImporterScript: importer,
      hwmrSourceDir: folder,
      hwmrLibraryFile: join(folder, 'library.json'),
      projectRoot: folder,
    })).rejects.toThrow('No module named')
  })

  it('rejects an unverified refresh result', async () => {
    const folder = await temporaryFolder()
    const importer = join(folder, 'importer.mjs')
    await writeFile(importer, 'console.log(JSON.stringify({ qualityCheck: "failed" }))')

    await expect(refreshHwmrLibrary({
      hwmrImportPython: process.execPath,
      hwmrImporterScript: importer,
      hwmrSourceDir: folder,
      hwmrLibraryFile: join(folder, 'library.json'),
      projectRoot: folder,
    })).rejects.toThrow('could not be refreshed')
  })
})
