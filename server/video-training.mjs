import { createReadStream, existsSync } from 'node:fs'
import { mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join, resolve, sep } from 'node:path'

const videoExtensions = new Map([
  ['.mp4', 'video/mp4'], ['.m4v', 'video/mp4'], ['.webm', 'video/webm'], ['.mov', 'video/quicktime'],
  ['.avi', 'video/x-msvideo'], ['.mkv', 'video/x-matroska'], ['.wmv', 'video/x-ms-wmv'],
])
const documentExtensions = new Map([
  ['.pdf', 'application/pdf'], ['.txt', 'text/plain; charset=utf-8'], ['.md', 'text/markdown; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'], ['.htm', 'text/html; charset=utf-8'],
])
const contentTypes = new Map([...videoExtensions, ...documentExtensions])

const titleFromFilename = (name) => basename(name, extname(name)).replace(/_/g, ' ').replace(/\s+/g, ' ').trim() || name

/** Every refusal carries the HTTP status the gateway should answer with. */
function fail(status, message) {
  const error = new Error(message)
  error.status = status
  throw error
}

// A name arrives from the client, so it is reduced to a single safe basename before it is ever joined.
function safeFilename(value) {
  const filename = basename(String(value || '')).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()
  const extension = extname(filename).toLowerCase()
  if (!filename || !contentTypes.has(extension)) fail(400, 'Choose an MP4, WebM, MOV, AVI, MKV, WMV, PDF, TXT, Markdown, or HTML file.')
  return `${basename(filename, extension).slice(0, 120)}${extension}`
}

const trainingRoot = (config) => resolve(config.videoTrainingDir)

const describeItem = (name, info) => ({
  id: name,
  title: titleFromFilename(name),
  media: videoExtensions.has(extname(name).toLowerCase()) ? 'video' : 'document',
  extension: extname(name).toLowerCase(),
  bytes: info.size,
  addedAt: info.mtime.toISOString(),
})

/** The page lists whatever is in the folder, so a file copied in by hand appears like an uploaded one. */
export async function getVideoTrainingLibrary(config) {
  const root = trainingRoot(config)
  if (!existsSync(root)) return { root, total: 0, items: [] }
  const items = []
  for (const name of await readdir(root)) {
    if (!contentTypes.has(extname(name).toLowerCase())) continue
    const info = await stat(join(root, name)).catch(() => null)
    if (!info?.isFile()) continue
    items.push(describeItem(name, info))
  }
  items.sort((left, right) => right.addedAt.localeCompare(left.addedAt))
  return { root, total: items.length, items }
}

function resolveVideoTrainingFile(name, config) {
  const root = trainingRoot(config)
  const filename = safeFilename(name)
  const path = join(root, filename)
  if (resolve(path) !== path || !path.startsWith(root + sep)) fail(400, 'The training file name is invalid.')
  if (!existsSync(path)) fail(404, 'That training file is no longer in the library.')
  return { path, filename }
}

/** Browsers and the <video> tag both ask for byte ranges, so playback streams instead of loading whole files. */
export async function streamVideoTrainingFile(request, response, name, config, origin = '') {
  const { path, filename } = resolveVideoTrainingFile(name, config)
  const info = await stat(path)
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(request.headers.range || ''))
  const [, first, last] = range || []
  // "bytes=-N" asks for the last N bytes, so an empty start is only open-ended when a tail length follows.
  const start = first ? Number(first) : last ? Math.max(0, info.size - Number(last)) : 0
  const end = first && last ? Math.min(Number(last), info.size - 1) : info.size - 1
  if (start >= info.size) {
    response.writeHead(416, { 'Content-Range': `bytes */${info.size}`, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' })
    return response.end()
  }
  const isPartial = Boolean(first || last)
  const headers = {
    'Content-Type': contentTypes.get(extname(path).toLowerCase()),
    'Content-Length': String(end - start + 1),
    'Content-Disposition': `inline; filename="${filename.replace(/"/g, '')}"`,
    'Accept-Ranges': 'bytes',
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
  }
  if (isPartial) headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`
  response.writeHead(isPartial ? 206 : 200, headers)
  if (request.method === 'HEAD') return response.end()
  createReadStream(path, { start, end }).pipe(response)
}

/** Uploads stream straight to disk; a video is far too large to hold in memory as form data. */
export async function saveVideoTrainingUpload(request, config) {
  const query = new URL(request.url, `http://${request.headers.host}`).searchParams
  const filename = safeFilename(query.get('name'))
  const limit = config.maxVideoTrainingBytes
  if (Number(request.headers['content-length'] || 0) > limit) fail(413, `The selected file is larger than the ${Math.round(limit / 1024 / 1024)} MB upload limit.`)
  const root = trainingRoot(config)
  await mkdir(root, { recursive: true })
  const destination = join(root, filename)
  if (existsSync(destination)) fail(409, 'A training file with this name already exists. Rename it before adding it again.')
  // Written as a .part file so an interrupted upload never appears in the library as a complete video.
  const temporary = `${destination}.part`
  const chunks = []
  let written = false
  let size = 0
  try {
    for await (const chunk of request) {
      size += chunk.length
      if (size > limit) fail(413, 'The training file exceeded the upload limit and was discarded.')
      chunks.push(chunk)
      // Flush each burst under its own flag: the first creates the file, the rest append.
      if (size >= 32 * 1024 * 1024) {
        await writeFile(temporary, Buffer.concat(chunks), { flag: written ? 'a' : 'w' })
        written = true
        chunks.length = 0
      }
    }
    if (!size) fail(400, 'The uploaded training file was empty.')
    await writeFile(temporary, Buffer.concat(chunks), { flag: written ? 'a' : 'w' })
    await rename(temporary, destination)
  } catch (failure) {
    await rm(temporary, { force: true })
    throw failure
  }
  const info = await stat(destination)
  return describeItem(filename, info)
}

/** Deleting a training file only removes what this folder holds, so a stray name is refused rather than followed. */
export async function deleteVideoTrainingFile(name, config) {
  await rm(resolveVideoTrainingFile(name, config).path, { force: true })
  return { removed: true }
}
