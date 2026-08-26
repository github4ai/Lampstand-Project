import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  getAiServicesStatus,
  startAiServices,
  unloadAiModels,
} from './services'
import { streamAIOS } from '../services/api'

const status = {
  enabled: true,
  allReady: false,
  automaticResourceManagement: true,
  providers: [
    {
      id: 'ollama',
      label: 'Translation',
      available: true,
      configured: true,
    },
  ],
}

describe('AI services API', () => {
  afterEach(() =>
    vi.unstubAllGlobals(),
  )

  it('loads service status with an abort signal', async () => {
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify(status),
          { status: 200 },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    await expect(
      getAiServicesStatus(controller.signal),
    ).resolves.toEqual(status)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:9656/services/status',
      {
        method: 'GET',
        signal: controller.signal,
      },
    )
  })

  it('starts and unloads services with POST requests', async () => {
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify(status),
          { status: 200 },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await startAiServices()
    await unloadAiModels()

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:9656/services/start',
      { method: 'POST', signal: undefined },
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:9656/services/unload',
      { method: 'POST', signal: undefined },
    )
  })

  it('reports the gateway response when a service action fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          'Pinokio control is unavailable.',
          { status: 503 },
        ),
      ),
    )

    await expect(
      startAiServices(),
    ).rejects.toThrow(
      'Pinokio control is unavailable.',
    )
  })

  it('parses streamed events across chunk boundaries', async () => {
    const chunks = [
      '{"type":"metadata","agent_id":"school","category":"School","model":"Local","grounded":true,"source_count":1,"sources":[]}',
      '\n{"type":"chunk","content":"Hello"}\n{"type":"done","grounded":true,"completed":true}\n',
    ]
    const fetchMock = vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(chunks[0]))
        controller.enqueue(new TextEncoder().encode(chunks[1]))
        controller.close()
      },
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const events: string[] = []

    await streamAIOS('question', 'school', {
      onMetadata: (event) => events.push(`metadata:${event.agent_id}:${event.grounded}`),
      onChunk: (chunk) => events.push(`chunk:${chunk}`),
      onDone: (event) => events.push(`done:${event.completed}`),
    })

    expect(events).toEqual(['metadata:school:true', 'chunk:Hello', 'done:true'])
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:9656/ask/stream',
      expect.objectContaining({
        method: 'POST',
        signal: undefined,
      }),
    )
  })

  it('passes an abort signal to the streaming request', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn().mockImplementation((_url, options: RequestInit) =>
      new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const promise = streamAIOS('question', 'school', { onChunk: () => {} }, 'all', controller.signal)
    controller.abort()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:9656/ask/stream',
      expect.objectContaining({ signal: controller.signal }),
    )
  })

  it('rejects malformed streamed events', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"type":"chunk"}\n'))
          controller.close()
        },
      }),
      { status: 200 },
    )))

    await expect(streamAIOS('question', 'school', { onChunk: () => {} }))
      .rejects.toThrow('invalid streaming event')
  })
})
