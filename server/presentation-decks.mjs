import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, rm, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { promisify } from 'node:util'
import { presentationMediaRoot, resolvePresentationMediaFile } from './presentation-media.mjs'

const run = promisify(execFile)
const convertExtensions = new Set(['.pptx', '.ppt'])

function fail(status, message) {
  const error = new Error(message)
  error.status = status
  throw error
}

const deckTitle = (name) => basename(name, extname(name)).replace(/_/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Deck'

/** Converted pages live beside the originals so the studio lists them like any other image. */
export const deckFolderName = (name) => deckTitle(name).replace(/[\\/:*?"<>|]/g, '').trim() || 'Deck'

export function parseConverterResult(stdout) {
  const line = String(stdout || '').trim().split('\n').at(-1) || ''
  let report = null
  try { report = JSON.parse(line) } catch { /* fall through to the shared refusal below */ }
  if (report?.ok && Array.isArray(report.pages)) return report.pages
  if (report?.error) fail(422, `${report.error} To project this deck anyway, open it in PowerPoint and save it as a PDF, then add the PDF to the media library.`)
  fail(422, 'The deck could not be read on this computer. Open it in PowerPoint and save it as a PDF, then add the PDF to the media library.')
}

export async function convertPresentationDeck(name, config) {
  const { path, relative } = resolvePresentationMediaFile(name, config)
  const extension = extname(path).toLowerCase()
  if (!convertExtensions.has(extension)) fail(400, 'Only PowerPoint decks are converted here. A PDF is projected page by page as it is.')
  if (!existsSync(path)) fail(404, 'That deck is no longer in the library.')
  const script = config.presentationDeckScript
  if (!script || !existsSync(script)) fail(500, 'The deck converter is missing from this installation.')

  const folder = deckFolderName(relative)
  const outputDir = join(presentationMediaRoot(config), 'decks', folder)
  if (join(outputDir, '..') !== join(presentationMediaRoot(config), 'decks')) fail(400, 'The deck name is invalid.')
  await rm(outputDir, { recursive: true, force: true })
  await mkdir(outputDir, { recursive: true })

  let stdout = ''
  try {
    const result = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-Source', path, '-OutDir', outputDir], {
      windowsHide: true,
      timeout: 300000,
      maxBuffer: 8 * 1024 * 1024,
    })
    stdout = result.stdout
  } catch (failure) {
    await rm(outputDir, { recursive: true, force: true })
    if (failure.code === 'ENOENT') fail(422, 'PowerPoint conversion needs Windows PowerShell, which is unavailable on this computer. Save the deck as a PDF and add it to the media library.')
    if (failure.killed || failure.signal) fail(504, 'The deck took too long to convert. Close any PowerPoint window that is open and try again.')
    stdout = failure.stdout || ''
  }

  const pages = parseConverterResult(stdout)
  const listed = []
  for (const page of pages) {
    const id = `decks/${folder}/${String(page.file || '')}`
    const info = await stat(join(presentationMediaRoot(config), ...id.split('/'))).catch(() => null)
    if (!info?.isFile()) continue
    listed.push({ id, number: Number(page.number) || listed.length + 1, title: String(page.title || '').trim() || `Slide ${listed.length + 1}`, bytes: info.size })
  }
  if (!listed.length) {
    await rm(outputDir, { recursive: true, force: true })
    fail(422, 'PowerPoint produced no pages for this deck. Save it as a PDF and add the PDF to the media library.')
  }
  return { group: `decks/${folder}`, source: relative, total: listed.length, pages: listed }
}
