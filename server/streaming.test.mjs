import { Readable, Writable } from 'node:stream'
import { describe, expect, it } from 'vitest'

import { pipeNodeStream, pipeWebStream } from './streaming.mjs'

describe('gateway stream containment', () => {
  it('contains an upstream stream failure without rejecting', async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('partial'))
        controller.error(new DOMException('Timed out', 'TimeoutError'))
      },
    })
    const response = new Writable({ write(_chunk, _encoding, callback) { callback() } })

    await expect(pipeWebStream(body, response)).resolves.toBe(false)
    expect(response.destroyed).toBe(true)
  })

  it('contains a second stream error emitted after the pipeline settles', async () => {
    const source = Readable.from(['complete'])
    const response = new Writable({ write(_chunk, _encoding, callback) { callback() } })
    await expect(pipeNodeStream(source, response)).resolves.toBe(true)
    expect(() => source.emit('error', new DOMException('Late timeout', 'TimeoutError'))).not.toThrow()
  })
})
