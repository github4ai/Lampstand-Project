import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'

import { proxyLegacy } from './index.mjs'

describe('legacy proxy containment', () => {
  it('contains a late request-stream timeout instead of crashing the gateway', async () => {
    const request = Object.assign(new EventEmitter(), {
      headers: {}, method: 'POST', url: '/ask',
    })
    const response = { writeHead() {}, end() {} }
    const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    const fetcher = async () => {
      request.emit('error', timeout)
      throw timeout
    }

    await expect(proxyLegacy(request, response, '', fetcher))
      .rejects.toThrow('operation was aborted due to timeout')
    expect(request.listenerCount('error')).toBeGreaterThan(0)
  })
})
