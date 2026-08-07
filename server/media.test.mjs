import { describe, expect, it, vi } from 'vitest'
import { createMediaGeneration, getMediaGeneration } from './media.mjs'

const config = { comfyUrl: 'http://comfy', comfyCheckpoint: 'model.safetensors' }

describe('ComfyUI image generation', () => {
  it('queues an image workflow with the selected aspect ratio', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ prompt_id: 'prompt-1' }), { status: 200 }))
    const job = await createMediaGeneration({ kind: 'image', prompt: 'A peaceful church', aspectRatio: '9:16', quality: 'draft' }, config, fetcher)
    expect(job).toMatchObject({ kind: 'image', status: 'queued', prompt: 'A peaceful church' })
    const body = JSON.parse(fetcher.mock.calls[0][1].body)
    expect(body.prompt['4'].inputs).toMatchObject({ width: 576, height: 1024 })
    expect(body.prompt['5'].inputs.steps).toBe(14)
  })

  it('returns a completed gateway image URL from ComfyUI history', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ prompt_id: 'prompt-2' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ 'prompt-2': { outputs: { '7': { images: [{ filename: 'result.png', subfolder: '', type: 'output' }] } } } }), { status: 200 }))
    const queued = await createMediaGeneration({ kind: 'image', prompt: 'Hope' }, config, fetcher)
    const completed = await getMediaGeneration(queued.id, config, fetcher)
    expect(completed).toMatchObject({ status: 'completed' })
    expect(completed.url).toContain('/media/files?filename=result.png')
  })

  it('rejects media types without a configured provider', async () => {
    await expect(createMediaGeneration({ kind: 'video', prompt: 'Test' }, config, vi.fn()))
      .rejects.toThrow('video generation is not configured yet')
  })

  it('queues English speech generation without blocking the request', async () => {
    const fetcher = vi.fn().mockImplementation(() => new Promise(() => {}))
    const job = await createMediaGeneration({ kind: 'audio', audioMode: 'speech', language: 'en', prompt: 'Welcome' },
      { ...config, ttsUrl: 'http://tts' }, fetcher)
    expect(job).toMatchObject({ kind: 'audio', status: 'processing', prompt: 'Welcome' })
  })

  it('reports unsupported local speech languages clearly', async () => {
    await expect(createMediaGeneration({ kind: 'audio', audioMode: 'speech', language: 'mr', prompt: 'Namaskar' }, config, vi.fn()))
      .rejects.toThrow('currently supports English')
  })
})
