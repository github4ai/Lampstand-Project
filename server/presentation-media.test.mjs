import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Writable } from 'node:stream'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { deletePresentationMediaFile, deletePresentationMediaGroup, getPresentationMediaLibrary, savePresentationMediaUpload, streamPresentationMediaFile } from './presentation-media.mjs'

let root = ''
let config = null

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'lampstand-media-'))
  config = { presentationMediaDir: root, maxPresentationMediaBytes: 1024 * 1024 }
})

afterAll(() => rm(root, { recursive: true, force: true }))

function uploadRequest(name, chunks, contentLength = chunks.reduce((total, chunk) => total + chunk.length, 0)) {
  const request = {
    method: 'POST',
    url: `/presentation-media/upload?name=${encodeURIComponent(name)}`,
    headers: { host: '127.0.0.1:9656', 'content-length': String(contentLength) },
  }
  request[Symbol.iterator] = function* bodies() { for (const chunk of chunks) yield chunk }
  return request
}

function responseStub() {
  const response = new Writable({
    write(chunk, _encoding, done) { response.body.push(chunk); done() },
  })
  response.body = []
  response.statusCode = 0
  response.headers = {}
  response.writeHead = (status, headers = {}) => { response.statusCode = status; Object.assign(response.headers, headers); return response }
  response.text = () => Buffer.concat(response.body).toString('utf8')
  return response
}

const finished = (response) => new Promise((resolve) => response.once('finish', resolve))

async function streamed(name, range) {
  const response = responseStub()
  const request = { method: 'GET', url: `/presentation-media/file?name=${encodeURIComponent(name)}`, headers: range ? { range } : {} }
  await streamPresentationMediaFile(request, response, name, config, 'http://localhost:5173')
  await finished(response)
  return response
}

describe('Presentation media library', () => {
  it('stores an upload and lists it with a readable title', async () => {
    const stored = await savePresentationMediaUpload(uploadRequest('baptism_service.mp4', [Buffer.from('video bytes')]), config)
    expect(stored).toMatchObject({ id: 'baptism_service.mp4', title: 'baptism service', media: 'video', group: '', bytes: 11 })
    const library = await getPresentationMediaLibrary(config)
    expect(library.items[0].media).toBe('video')
  })

  it('recognises images, audio, and PowerPoint as the kinds the studio projects', async () => {
    await savePresentationMediaUpload(uploadRequest('offer.png', [Buffer.from('png')]), config)
    await savePresentationMediaUpload(uploadRequest('reading.mp3', [Buffer.from('mp3')]), config)
    await savePresentationMediaUpload(uploadRequest('training.pptx', [Buffer.from('pptx')]), config)
    const library = await getPresentationMediaLibrary(config)
    expect(Object.fromEntries(library.items.map((item) => [item.id, item.media]))).toMatchObject({ 'offer.png': 'image', 'reading.mp3': 'audio', 'training.pptx': 'document' })
  })

  it('lists converted deck pages under the group they belong to', async () => {
    await mkdir(join(root, 'decks', 'Spring training'), { recursive: true })
    await writeFile(join(root, 'decks', 'Spring training', 'slide-01.png'), 'first page')
    const library = await getPresentationMediaLibrary(config)
    const page = library.items.find((item) => item.id === 'decks/Spring training/slide-01.png')
    expect(page).toMatchObject({ media: 'image', group: 'decks/Spring training', title: 'slide-01' })
    expect((await streamed('decks/Spring training/slide-01.png')).text()).toBe('first page')
  })

  it('refuses a file type it cannot project and a name that climbs out of the folder', async () => {
    await expect(savePresentationMediaUpload(uploadRequest('setup.exe', [Buffer.from('nope')]), config)).rejects.toMatchObject({ status: 400 })
    await expect(savePresentationMediaUpload(uploadRequest('script.svg', [Buffer.from('nope')]), config)).rejects.toMatchObject({ status: 400 })
    await expect(streamed('../../secret.png')).rejects.toMatchObject({ status: 400 })
    await expect(streamed('decks/../../Windows/win.ini')).rejects.toMatchObject({ status: 400 })
  })

  it('serves byte ranges so a video seeks without downloading the whole file', async () => {
    const full = await streamed('baptism_service.mp4')
    expect(full.statusCode).toBe(200)
    expect(full.headers['Content-Type']).toBe('video/mp4')
    expect(full.headers['Accept-Ranges']).toBe('bytes')

    const partial = await streamed('baptism_service.mp4', 'bytes=6-10')
    expect(partial.statusCode).toBe(206)
    expect(partial.headers['Content-Range']).toBe('bytes 6-10/11')
    expect(partial.text()).toBe('bytes')

    const tail = await streamed('baptism_service.mp4', 'bytes=-4')
    expect(tail.headers['Content-Range']).toBe('bytes 7-10/11')

    const pastEnd = await streamed('baptism_service.mp4', 'bytes=900-')
    expect(pastEnd.statusCode).toBe(416)
    expect(pastEnd.headers['Content-Range']).toBe('bytes */11')
  })

  it('removes a single file without touching the rest of the library', async () => {
    await expect(deletePresentationMediaFile('reading.mp3', config)).resolves.toEqual({ removed: true })
    await expect(streamed('reading.mp3')).rejects.toMatchObject({ status: 404 })
    expect((await readdir(root)).sort()).toEqual(['baptism_service.mp4', 'decks', 'offer.png', 'training.pptx'])
  })

  it('removes a whole deck as one group and refuses to reach outside the library', async () => {
    await expect(deletePresentationMediaGroup('decks', config)).resolves.toEqual({ removed: true })
    expect(await stat(join(root, 'decks')).catch(() => null)).toBeNull()
    await expect(deletePresentationMediaGroup('../..', config)).rejects.toMatchObject({ status: 400 })
  })

  it('discards a file that walks past the upload limit', async () => {
    await expect(savePresentationMediaUpload(uploadRequest('too-big.mp4', [Buffer.alloc(600 * 1024), Buffer.alloc(600 * 1024)]), config)).rejects.toMatchObject({ status: 413 })
    expect(await readdir(root)).not.toContain('too-big.mp4')
  })
})
