import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAiServicesStatus, resetAiServicesState, startAiService, startAiServices, unloadAiModels } from './services.mjs'

const config = {
  ollamaUrl: 'http://ollama', whisperUrl: 'http://whisper', comfyUrl: 'http://comfy',
  wanUrl: 'http://wangp', ttsUrl: 'http://speech', ptermPath: '',
  comfyPinokioApp: 'comfy.git', wanPinokioApp: 'wan.git', ttsPinokioApp: 'tts.git',
  ollamaExecutable: '', whisperPython: '',
  voiceStudioUrl: 'http://voicestudio', voiceStudioExecutable: 'Z:\\missing-voicestudio.exe',
}

const pythonEntry = process.platform === 'win32' ? ['Scripts', 'python.exe'] : ['bin', 'python']
const createdHomes = []

/** A Pinokio folder holding only the files a launch recipe looks for. */
function fakePinokioHome(interpreters) {
  const home = mkdtempSync(join(tmpdir(), 'lampstand-pinokio-'))
  createdHomes.push(home)
  for (const relative of interpreters) {
    const file = join(home, ...relative.split('/'))
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, '')
  }
  return home
}

beforeEach(() => resetAiServicesState())
afterEach(() => { while (createdHomes.length) rmSync(createdHomes.pop(), { recursive: true, force: true }) })

describe('AI service manager', () => {
  it('reports all local dependencies through one status response', async () => {
    const fetcher = vi.fn(async () => ({ ok: true }))
    const status = await getAiServicesStatus(config, fetcher)
    expect(status.enabled).toBe(true)
    expect(status.allReady).toBe(true)
    expect(status.providers.map((provider) => provider.id)).toEqual(['ollama', 'whisper', 'comfy', 'wangp', 'speech', 'voicestudio'])
    expect(fetcher).toHaveBeenCalledWith('http://voicestudio/health', expect.anything())
  })

  it('unloads large models while leaving providers available in standby', async () => {
    const fetcher = vi.fn(async () => ({ ok: true }))
    const status = await unloadAiModels(config, fetcher)
    expect(status.enabled).toBe(false)
    expect(status.unloaded).toEqual({ comfy: true, wangp: true })
    expect(fetcher).toHaveBeenCalledWith('http://comfy/free', expect.objectContaining({ method: 'POST' }))
    expect(fetcher).toHaveBeenCalledWith('http://wangp/gradio_api/call/release_ram_and_notify', expect.objectContaining({ method: 'POST' }))
  })

  it('distinguishes missing local setup from configured Pinokio providers', async () => {
    const fetcher = vi.fn(async () => ({ ok: false }))
    const status = await getAiServicesStatus({ ...config, whisperPython: 'Z:\\missing-whisper-python.exe' }, fetcher)
    const configured = Object.fromEntries(status.providers.map((provider) => [provider.id, provider.configured]))
    expect(configured).toEqual({ ollama: false, whisper: false, comfy: true, wangp: true, speech: true, voicestudio: false })
  })

  it('returns actionable errors when unavailable services cannot be started', async () => {
    const fetcher = vi.fn(async () => ({ ok: false }))
    const status = await startAiServices({ ...config, whisperPython: 'Z:\\missing-whisper-python.exe' }, fetcher, vi.fn())
    expect(status.enabled).toBe(true)
    expect(status.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'ollama', message: expect.stringContaining('not installed') }),
      expect.objectContaining({ id: 'whisper', message: expect.stringContaining('not installed') }),
    ]))
  })

  it('starts a heavy app itself, on the port it probes, with no Pinokio window', async () => {
    const home = fakePinokioHome([`api/wan.git/app/env/${pythonEntry.join('/')}`])
    const fetcher = vi.fn(async () => ({ ok: false }))
    const start = vi.fn(() => ({ pid: 4242 }))
    const stateFile = join(home, 'services-started.json')
    await startAiService({ ...config, pinokioHome: home, servicesStateFile: stateFile }, 'wangp', fetcher, start)
    expect(start).toHaveBeenCalledWith(
      join(home, 'api', 'wan.git', 'app', 'env', ...pythonEntry),
      ['wgp.py', '--multiple-images', '--server-name', '127.0.0.1', '--server-port', '42003'],
      expect.objectContaining({ cwd: join(home, 'api', 'wan.git', 'app') }),
    )
    expect(JSON.parse(readFileSync(stateFile, 'utf8')).services).toEqual([{ id: 'wangp', pid: 4242, name: 'python' }])
  })

  it('starts the speech app from its own environment and pins its port', async () => {
    const home = fakePinokioHome([`api/tts.git/app/tts_env/${process.platform === 'win32' ? 'python.exe' : 'bin/python'}`])
    const fetcher = vi.fn(async () => ({ ok: false }))
    const start = vi.fn(() => ({ pid: 9 }))
    await startAiService({ ...config, pinokioHome: home }, 'speech', fetcher, start)
    expect(start).toHaveBeenCalledWith(
      process.platform === 'win32'
        ? join(home, 'api', 'tts.git', 'app', 'tts_env', 'python.exe')
        : join(home, 'api', 'tts.git', 'app', 'tts_env', 'bin', 'python'),
      ['launch.py'],
      expect.objectContaining({ env: expect.objectContaining({ GRADIO_SERVER_PORT: '7860' }) }),
    )
  })

  it('offers a start control only where the app can actually launch the service', async () => {
    const fetcher = vi.fn(async () => ({ ok: false }))
    const status = await getAiServicesStatus({ ...config, pinokioHome: fakePinokioHome([]) }, fetcher)
    const startable = Object.fromEntries(status.providers.map((provider) => [provider.id, provider.startable]))
    expect(startable).toEqual({ ollama: false, whisper: false, comfy: false, wangp: false, speech: false, voicestudio: false })
  })
})
