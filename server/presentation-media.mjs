import { createReadStream, existsSync } from 'node:fs'
import { mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join, resolve, sep } from 'node:path'

const imageExtensions = new Map([
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.gif', 'image/gif'],
  ['.webp', 'image/webp'], ['.bmp', 'image/bmp'], ['.avif', 'image/avif'],
])
const videoExtensions = new Map([
  ['.mp4', 'video/mp4'], ['.m4v', 'video/mp4'], ['.webm', 'video/webm'], ['.mov', 'video/quicktime'],
  ['.avi', 'video/x-msvideo'], ['.mkv', 'video/x-matroska'], ['.wmv', 'video/x-ms-wmv'],
])
const audioExtensions = new Map([
  ['.mp3', 'audio/mpeg'], ['.wav', 'audio/wav'], ['.m4a', 'audio/mp4'], ['.aac', 'audio/aac'],
  ['.ogg', 'audio/ogg'], ['.flac', 'audio/flac'],
])
const documentExtensions = new Map([
  ['.pdf', 'application/pdf'], ['.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ['.ppt', 'application/vnd.ms-powerpoint'],
])

export const contentTypes = new Map([...imageExtensions, ...videoExtensions, ...audioExtensions, ...documentExtensions])

const kindOf = (name) => {
  const extension = extname(name).toLowerCase()
  if (imageExtensions.has(extension)) return 'image'
  if (videoExtensions.has(extension)) return 'video'
  if (audioExtensions.has(extension)) return 'audio'
  return 'document'
}

const titleFromFilename = (name) => basename(name, extname(name)).replace(/_/g, ' ').replace(/\s+/g, ' ').trim() || name

/** Every refusal carries the HTTP status the gateway should answer with. */
function fail(status, message) {
  const error = new Error(message)
  error.status = status
  throw error
}

// A name arrives from the client, so every segment is reduced to a plain folder/file name before it is ever joined.
export function safeRelativePath(value) {
  const segments = String(value || '').replace(/\\/g, '/').split('/').filter((segment) => segment && segment !== '.')
  if (!segments.length || segments.length > 3) fail(400, 'The media file name is invalid.')
  return segments.map((segment, index) => {
    const isFile = index === segments.length - 1
    if (!isFile) {
      const folder = segment.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80)
      if (!folder || folder.startsWith('.')) fail(400, 'The media file name is invalid.')
      return folder
    }
    const extension = extname(segment).toLowerCase()
    if (!contentTypes.has(extension)) fail(400, 'Choose an image, video, audio, PDF, or PowerPoint file.')
    const stem = basename(segment, extname(segment)).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120)
    if (!stem || stem.startsWith('.')) fail(400, 'The media file name is invalid.')
    return `${stem}${extension}`
  }).join('/')
}

export const presentationMediaRoot = (config) => resolve(config.presentationMediaDir)

/** Absolute path plus the sanitised name, or a refusal. Nothing outside the media folder is ever reachable. */
export function resolvePresentationMediaFile(name, config) {
  const root = presentationMediaRoot(config)
  const relative = safeRelativePath(name)
  const path = join(root, ...relative.split('/'))
  if (resolve(path) !== path || !path.startsWith(root + sep)) fail(400, 'The media file name is invalid.')
  return { path, relative }
}

function resolveExistingFile(name, config) {
  const found = resolvePresentationMediaFile(name, config)
  if (!existsSync(found.path)) fail(404, 'That media file is no longer in the library.')
  return found
}

const describeItem = (relative, info) => ({
  id: relative,
  title: titleFromFilename(relative),
  media: kindOf(relative),
  extension: extname(relative).toLowerCase(),
  group: relative.split('/').slice(0, -1).join('/'),
  bytes: info.size,
  addedAt: info.mtime.toISOString(),
})

async function walk(root, prefix, depth, items) {
  if (depth > 2) return items
  for (const entry of await readdir(root, { withFileTypes: true }).catch(() => [])) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      await walk(join(root, entry.name), relative, depth + 1, items)
      continue
    }
    if (!entry.isFile() || !contentTypes.has(extname(entry.name).toLowerCase())) continue
    const info = await stat(join(root, entry.name)).catch(() => null)
    if (info) items.push(describeItem(relative, info))
  }
  return items
}

/** The studio lists whatever is in the folder, so a file copied in by hand appears like an uploaded one. */
export async function getPresentationMediaLibrary(config) {
  const root = presentationMediaRoot(config)
  if (!existsSync(root)) return { root, total: 0, items: [] }
  const items = await walk(root, '', 0, [])
  items.sort((left, right) => right.addedAt.localeCompare(left.addedAt))
  return { root, total: items.length, items }
}

/** Browsers ask for byte ranges when they play video, so media streams instead of loading whole files into memory. */
export async function streamPresentationMediaFile(request, response, name, config, origin = '') {
  const { path, relative } = resolveExistingFile(name, config)
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
    'Content-Disposition': `inline; filename="${basename(relative).replace(/"/g, '')}"`,
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
export async function savePresentationMediaUpload(request, config) {
  const query = new URL(request.url, `http://${request.headers.host}`).searchParams
  const relative = safeRelativePath(query.get('name'))
  const limit = config.maxPresentationMediaBytes
  if (Number(request.headers['content-length'] || 0) > limit) fail(413, `The selected file is larger than the ${Math.round(limit / 1024 / 1024)} MB upload limit.`)
  const root = presentationMediaRoot(config)
  const destination = join(root, ...relative.split('/'))
  if (resolve(destination) !== destination || !destination.startsWith(root + sep)) fail(400, 'The media file name is invalid.')
  await mkdir(join(destination, '..'), { recursive: true })
  if (existsSync(destination)) fail(409, 'A media file with this name already exists. Rename it before adding it again.')
  // Written as a .part file so an interrupted upload never appears in the library as a complete file.
  const temporary = `${destination}.part`
  const chunks = []
  let written = false
  let size = 0
  try {
    for await (const chunk of request) {
      size += chunk.length
      if (size > limit) fail(413, 'The media file exceeded the upload limit and was discarded.')
      chunks.push(chunk)
      // Flush each burst under its own flag: the first creates the file, the rest append.
      if (size >= 32 * 1024 * 1024) {
        await writeFile(temporary, Buffer.concat(chunks), { flag: written ? 'a' : 'w' })
        written = true
        chunks.length = 0
      }
    }
    if (!size) fail(400, 'The uploaded media file was empty.')
    await writeFile(temporary, Buffer.concat(chunks), { flag: written ? 'a' : 'w' })
    await rename(temporary, destination)
  } catch (failure) {
    await rm(temporary, { force: true })
    throw failure
  }
  const info = await stat(destination)
  return describeItem(relative, info)
}

export async function deletePresentationMediaFile(name, config) {
  const { path } = resolveExistingFile(name, config)
  await rm(path, { force: true })
  return { removed: true }
}

/** A converted deck is removed as a unit, so only plain folder names inside the media root are accepted. */
export async function deletePresentationMediaGroup(group, config) {
  const root = presentationMediaRoot(config)
  const segments = String(group || '').replace(/\\/g, '/').split('/').filter((segment) => segment && segment !== '.')
  if (!segments.length || segments.length > 2 || segments.some((segment) => segment.startsWith('.') || /[\\/:*?"<>|]/.test(segment) || segment.length > 80)) {
    fail(400, 'The media group name is invalid.')
  }
  const path = join(root, ...segments)
  if (resolve(path) !== path || !path.startsWith(root + sep)) fail(400, 'The media group name is invalid.')
  if (!existsSync(path)) fail(404, 'That media group is no longer in the library.')
  await rm(path, { recursive: true, force: true })
  return { removed: true }
}
