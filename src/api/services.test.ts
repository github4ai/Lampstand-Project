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
})
