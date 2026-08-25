import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAiServicesStatus, resetAiServicesState, startAiServices, unloadAiModels } from './services.mjs'

const config = {
  ollamaUrl: 'http://ollama', whisperUrl: 'http://whisper', comfyUrl: 'http://comfy',
  wanUrl: 'http://wangp', ttsUrl: 'http://speech', ptermPath: '',
  comfyPinokioApp: 'comfy.git', wanPinokioApp: 'wan.git', ttsPinokioApp: 'tts.git',
  ollamaExecutable: '', whisperPython: '',
}

beforeEach(() => resetAiServicesState())

describe('AI service manager', () => {
  it('reports all local dependencies through one status response', async () => {
    const fetcher = vi.fn(async () => ({ ok: true }))
    const status = await getAiServicesStatus(config, fetcher)
    expect(status.enabled).toBe(true)
    expect(status.allReady).toBe(true)
    expect(status.providers.map((provider) => provider.id)).toEqual(['ollama', 'whisper', 'comfy', 'wangp', 'speech'])
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
    expect(configured).toEqual({ ollama: false, whisper: false, comfy: true, wangp: true, speech: true })
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
})
