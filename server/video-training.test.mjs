import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Writable } from 'node:stream'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { deleteVideoTrainingFile, getVideoTrainingLibrary, saveVideoTrainingUpload, streamVideoTrainingFile } from './video-training.mjs'

let root = ''
let config = null

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'lampstand-training-'))
  config = { videoTrainingDir: root, maxVideoTrainingBytes: 1024 * 1024 }
})

afterAll(() => rm(root, { recursive: true, force: true }))

/** The gateway hands these routes a Node request, so the tests only need its body iterator and headers. */
function uploadRequest(name, chunks, contentLength = chunks.reduce((total, chunk) => total + chunk.length, 0)) {
  const request = {
    method: 'POST',
    url: `/video-training/upload?name=${encodeURIComponent(name)}`,
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
  const request = { method: 'GET', url: `/video-training/file?name=${encodeURIComponent(name)}`, headers: range ? { range } : {} }
  await streamVideoTrainingFile(request, response, name, config, 'http://localhost:5173')
  await finished(response)
  return response
}

describe('Video training library', () => {
  it('stores an upload and lists it with a readable title', async () => {
    const stored = await saveVideoTrainingUpload(uploadRequest('Elders_training_part-1.mp4', [Buffer.from('video bytes')]), config)
    expect(stored).toMatchObject({ id: 'Elders_training_part-1.mp4', title: 'Elders training part-1', media: 'video', bytes: 11 })
    expect(await readdir(root)).toEqual(['Elders_training_part-1.mp4'])
    const library = await getVideoTrainingLibrary(config)
    expect(library.total).toBe(1)
    expect(library.items[0].media).toBe('video')
  })

  it('keeps a hand-copied document in the same list as an upload', async () => {
    await writeFile(join(root, 'Weekend notes.txt'), 'prepared in the folder itself')
    const library = await getVideoTrainingLibrary(config)
    const document = library.items.find((item) => item.id === 'Weekend notes.txt')
    expect(document).toMatchObject({ media: 'document', extension: '.txt', bytes: 29 })
    expect((await streamed('Weekend notes.txt')).text()).toBe('prepared in the folder itself')
  })

  it('refuses a file type the player cannot open and a name that climbs out of the folder', async () => {
    await expect(saveVideoTrainingUpload(uploadRequest('setup.exe', [Buffer.from('nope')]), config)).rejects.toMatchObject({ status: 400 })
    await expect(streamed('../../secret.mp4')).rejects.toMatchObject({ status: 404 })
    expect((await readdir(root)).sort()).toEqual(['Elders_training_part-1.mp4', 'Weekend notes.txt'])
  })

  it('refuses a second file under a name the library already holds', async () => {
    await expect(saveVideoTrainingUpload(uploadRequest('Elders_training_part-1.mp4', [Buffer.from('other')]), config)).rejects.toMatchObject({ status: 409 })
  })

  it('serves byte ranges so the player seeks without downloading the whole video', async () => {
    const full = await streamed('Elders_training_part-1.mp4')
    expect(full.statusCode).toBe(200)
    expect(full.headers['Content-Type']).toBe('video/mp4')
    expect(full.headers['Accept-Ranges']).toBe('bytes')
    expect(full.headers['Content-Range']).toBeUndefined()

    const partial = await streamed('Elders_training_part-1.mp4', 'bytes=6-10')
    expect(partial.statusCode).toBe(206)
    expect(partial.headers['Content-Range']).toBe('bytes 6-10/11')
    expect(partial.text()).toBe('bytes')

    const openEnded = await streamed('Elders_training_part-1.mp4', 'bytes=6-')
    expect(openEnded.text()).toBe('bytes')

    const tail = await streamed('Elders_training_part-1.mp4', 'bytes=-4')
    expect(tail.headers['Content-Range']).toBe('bytes 7-10/11')

    const pastEnd = await streamed('Elders_training_part-1.mp4', 'bytes=900-')
    expect(pastEnd.statusCode).toBe(416)
    expect(pastEnd.headers['Content-Range']).toBe('bytes */11')
  })

  it('reports a file that is no longer in the folder and removes the one it names', async () => {
    await expect(streamed('gone.mp4')).rejects.toMatchObject({ status: 404 })
    await expect(deleteVideoTrainingFile('Weekend notes.txt', config)).resolves.toEqual({ removed: true })
    expect(await readdir(root)).toEqual(['Elders_training_part-1.mp4'])
  })

  it('discards a file that walks past the upload limit', async () => {
    await expect(saveVideoTrainingUpload(uploadRequest('too-big.mp4', [Buffer.alloc(600 * 1024), Buffer.alloc(600 * 1024)]), config)).rejects.toMatchObject({ status: 413 })
    expect(await readdir(root)).toEqual(['Elders_training_part-1.mp4'])
  })
})
