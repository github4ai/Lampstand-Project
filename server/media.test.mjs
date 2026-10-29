import { describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cancelMediaGeneration, createMediaGeneration, getMediaGeneration, listMediaGenerations } from './media.mjs'

const config = { comfyUrl: 'http://comfy', comfyCheckpoint: 'model.safetensors',
  aceStepModel: 'ace.safetensors', aceStepEncoder: 'qwen.safetensors', aceStepVae: 'vae.safetensors' }

describe('ComfyUI image generation', () => {
  it('queues an image workflow with the selected aspect ratio', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ prompt_id: 'prompt-1' }), { status: 200 }))
    const job = await createMediaGeneration({ kind: 'image', prompt: 'A peaceful church', aspectRatio: '9:16', quality: 'draft' }, config, fetcher)
    expect(job).toMatchObject({ kind: 'image', status: 'queued', prompt: 'A peaceful church' })
    const body = JSON.parse(fetcher.mock.calls[0][1].body)
    expect(body.prompt['4'].inputs).toMatchObject({ width: 576, height: 1024 })
    expect(body.prompt['5'].inputs.steps).toBe(14)
    expect(body.prompt['11']).toMatchObject({
      class_type: 'UltralyticsDetectorProvider',
      inputs: { model_name: 'bbox/face_yolov8m.pt' },
    })
    expect(body.prompt['12']).toMatchObject({
      class_type: 'FaceDetailer',
      inputs: { image: ['6', 0], bbox_detector: ['11', 0], denoise: 0.32 },
    })
    expect(body.prompt['7'].inputs.images).toEqual(['12', 0])
  })

  it('uses higher resolution and sampling for ultra images', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ prompt_id: 'ultra-1' }), { status: 200 }))
    await createMediaGeneration({ kind: 'image', prompt: 'Detailed sanctuary', aspectRatio: '16:9', quality: 'ultra' }, config, fetcher)
    const workflow = JSON.parse(fetcher.mock.calls[0][1].body).prompt
    expect(workflow['4'].inputs).toMatchObject({ width: 1024, height: 576 })
    expect(workflow['5'].inputs.steps).toBe(40)
    expect(workflow['8']).toBeUndefined()
  })

  it('scales refined images to a requested 4K output', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ prompt_id: '4k-1' }), { status: 200 }))
    await createMediaGeneration({ kind: 'image', prompt: 'Detailed sanctuary', aspectRatio: '16:9',
      quality: 'high', imageResolution: '4k' }, config, fetcher)
    const workflow = JSON.parse(fetcher.mock.calls[0][1].body).prompt
    expect(workflow['10'].inputs).toMatchObject({ width: 3840, height: 2160, upscale_method: 'lanczos' })
    expect(workflow['10'].inputs.image).toEqual(['12', 0])
    expect(workflow['7'].inputs.images).toEqual(['10', 0])
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

  it('queues an ACE-Step instrumental workflow with the requested duration', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ prompt_id: 'audio-prompt' }), { status: 200 }))
    const job = await createMediaGeneration({ kind: 'audio', audioMode: 'instrumental', prompt: 'Gentle piano',
      durationSeconds: 20, genre: 'Worship', audioStyle: 'Ambient' }, config, fetcher)
    expect(job).toMatchObject({ kind: 'audio', status: 'queued', prompt: 'Gentle piano' })
    const workflow = JSON.parse(fetcher.mock.calls[0][1].body).prompt
    expect(workflow['94'].inputs).toMatchObject({ lyrics: '[Instrumental]', duration: 20 })
    expect(workflow['98'].inputs.seconds).toBe(20)
    expect(workflow['104'].inputs.unet_name).toBe('ace.safetensors')
  })

  it('returns a completed gateway audio URL from ComfyUI history', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ prompt_id: 'audio-prompt-2' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ 'audio-prompt-2': { outputs: {
        '107': { audio: [{ filename: 'song.mp3', subfolder: 'audio', type: 'output' }] },
      } } }), { status: 200 }))
    const queued = await createMediaGeneration({ kind: 'audio', audioMode: 'music', prompt: 'Hopeful score' }, config, fetcher)
    const completed = await getMediaGeneration(queued.id, config, fetcher)
    expect(completed).toMatchObject({ status: 'completed' })
    expect(completed.url).toContain('/media/files?filename=song.mp3')
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

  it('generates speech through Voice Studio and keeps its file path off the public job', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lampstand-speech-'))
    const speechConfig = { ...config, mediaJobsFile: join(directory, 'media-jobs.json'),
      ttsUrl: 'http://tts', voiceStudioUrl: 'http://voicestudio',
      voiceStudioSpeechModel: 'omnivoice', voiceStudioSpeechVoice: 'default' }
    const fetcher = vi.fn(async (url) => String(url) === 'http://voicestudio/health'
      ? new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
      : new Response(new Uint8Array([1, 2, 3, 4]), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } }))
    try {
      const queued = await createMediaGeneration({ kind: 'audio', audioMode: 'speech', language: 'en', prompt: 'Welcome' }, speechConfig, fetcher)
      let completed = await getMediaGeneration(queued.id, speechConfig, fetcher)
      for (let attempt = 0; attempt < 100 && completed?.status !== 'completed'; attempt += 1) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 10))
        completed = await getMediaGeneration(queued.id, speechConfig, fetcher)
      }
      expect(completed).toMatchObject({ status: 'completed', url: `/media/audio/${queued.id}` })
      expect(completed.audioFile).toBeUndefined()
      const speechCall = fetcher.mock.calls.find(([url]) => String(url).endsWith('/v1/audio/speech'))
      expect(JSON.parse(speechCall[1].body)).toMatchObject({ model: 'omnivoice', input: 'Welcome', voice: 'default', response_format: 'mp3' })
      expect(await readFile(join(directory, 'media-audio', `${queued.id}.mp3`))).toEqual(Buffer.from([1, 2, 3, 4]))
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('lists and cancels active queue jobs for recovery controls', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ prompt_id: 'cancel-me' }), { status: 200 }))
    const queued = await createMediaGeneration({ kind: 'image', prompt: 'Queue recovery', project: 'Sunday', quality: 'high' }, config, fetcher)
    expect(listMediaGenerations(config)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: queued.id, project: 'Sunday', settings: expect.objectContaining({ quality: 'high' }) }),
    ]))
    expect(cancelMediaGeneration(queued.id, config)).toMatchObject({ status: 'cancelled', progress: 100 })
    await expect(getMediaGeneration(queued.id, config, fetcher)).resolves.toMatchObject({ status: 'cancelled' })
  })

  it('persists jobs as readable JSON when a jobs file is configured', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lampstand-media-'))
    const mediaJobsFile = join(directory, 'media-jobs.json')
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ prompt_id: 'persisted-job' }), { status: 200 }))
    try {
      const job = await createMediaGeneration({ kind: 'image', prompt: 'Persist this job' }, { ...config, mediaJobsFile }, fetcher)
      const saved = JSON.parse(await readFile(mediaJobsFile, 'utf8'))
      expect(saved).toEqual(expect.arrayContaining([expect.objectContaining({ id: job.id, prompt: 'Persist this job' })]))
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
