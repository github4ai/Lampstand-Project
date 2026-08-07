import { describe, expect, it, vi } from 'vitest'
import { createImageGeneration, getImageGeneration } from './media.mjs'

const config = { comfyUrl: 'http://comfy', comfyCheckpoint: 'model.safetensors' }

describe('ComfyUI image generation', () => {
  it('queues an image workflow with the selected aspect ratio', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ prompt_id: 'prompt-1' }), { status: 200 }))
    const job = await createImageGeneration({ kind: 'image', prompt: 'A peaceful church', aspectRatio: '9:16', quality: 'draft' }, config, fetcher)
    expect(job).toMatchObject({ kind: 'image', status: 'queued', prompt: 'A peaceful church' })
    const body = JSON.parse(fetcher.mock.calls[0][1].body)
    expect(body.prompt['4'].inputs).toMatchObject({ width: 576, height: 1024 })
    expect(body.prompt['5'].inputs.steps).toBe(14)
  })

  it('returns a completed gateway image URL from ComfyUI history', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ prompt_id: 'prompt-2' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ 'prompt-2': { outputs: { '7': { images: [{ filename: 'result.png', subfolder: '', type: 'output' }] } } } }), { status: 200 }))
    const queued = await createImageGeneration({ kind: 'image', prompt: 'Hope' }, config, fetcher)
    const completed = await getImageGeneration(queued.id, config, fetcher)
    expect(completed).toMatchObject({ status: 'completed' })
    expect(completed.url).toContain('/media/files?filename=result.png')
  })

  it('rejects media types without a configured provider', async () => {
    await expect(createImageGeneration({ kind: 'video', prompt: 'Test' }, config, vi.fn()))
      .rejects.toThrow('video generation is not configured yet')
  })
})
