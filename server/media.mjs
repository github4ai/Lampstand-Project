import { randomUUID } from 'node:crypto'

const jobs = new Map()

function publicJob(job) {
  const { providerId: _providerId, providerUrl: _providerUrl, ...result } = job
  return result
}

const dimensions = {
  '16:9': [1024, 576],
  '1:1': [1024, 1024],
  '4:5': [832, 1024],
  '9:16': [576, 1024],
}

function workflowFor(request, config, seed) {
  const [width, height] = dimensions[request.aspectRatio] || dimensions['16:9']
  const steps = request.quality === 'draft' ? 14 : request.quality === 'high' ? 32 : 22
  const style = request.visualStyle ? `${request.visualStyle} style, ` : ''
  const purpose = request.imageMode?.replaceAll('_', ' ') || 'ministry image'
  const prompt = `${style}${purpose}, ${request.prompt}, high quality, detailed, respectful Christian ministry visual`
  return {
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: config.comfyCheckpoint } },
    '2': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['1', 1] } },
    '3': { class_type: 'CLIPTextEncode', inputs: { text: 'blurry, distorted, watermark, logo, illegible text, low quality', clip: ['1', 1] } },
    '4': { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } },
    '5': { class_type: 'KSampler', inputs: {
      seed, steps, cfg: 7, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1,
      model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0],
    } },
    '6': { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
    '7': { class_type: 'SaveImage', inputs: { filename_prefix: 'AIOS_Studio', images: ['6', 0] } },
  }
}

async function requestJson(url, options, fetcher) {
  const response = await fetcher(url, options)
  if (!response.ok) throw new Error((await response.text()) || `ComfyUI returned ${response.status}.`)
  return response.json()
}

async function createImageGeneration(request, config, fetcher = fetch) {
  if (!request?.prompt?.trim()) throw new Error('A description is required.')
  if (request.kind !== 'image') throw new Error(`${request.kind || 'This media type'} generation is not configured yet.`)
  const id = randomUUID()
  const seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
  const queued = await requestJson(`${config.comfyUrl}/prompt`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflowFor({ ...request, prompt: request.prompt.trim() }, config, seed), client_id: `aios-${id}` }),
    signal: AbortSignal.timeout(15000),
  }, fetcher)
  const job = { id, providerId: queued.prompt_id, kind: 'image', status: 'queued',
    prompt: request.prompt.trim(), createdAt: new Date().toISOString() }
  jobs.set(id, job)
  return publicJob(job)
}

async function getImageGeneration(id, config, fetcher = fetch) {
  const job = jobs.get(id)
  if (!job) return null
  if (job.status === 'completed' || job.status === 'failed') return publicJob(job)
  const history = await requestJson(`${config.comfyUrl}/history/${encodeURIComponent(job.providerId)}`,
    { signal: AbortSignal.timeout(10000) }, fetcher)
  const entry = history[job.providerId]
  if (!entry) return { ...publicJob(job), status: 'processing' }
  if (entry.status?.status_str === 'error') {
    Object.assign(job, { status: 'failed', error: entry.status.messages?.at(-1)?.[1]?.exception_message || 'Image generation failed.' })
    return publicJob(job)
  }
  const image = Object.values(entry.outputs || {}).flatMap((output) => output.images || [])[0]
  if (!image) return { ...publicJob(job), status: 'processing' }
  const query = new URLSearchParams({ filename: image.filename, subfolder: image.subfolder || '', type: image.type || 'output' })
  Object.assign(job, { status: 'completed', url: `/media/files?${query}` })
  return publicJob(job)
}

function parseGradioResult(events) {
  const complete = events.split('\n').findLast((line) => line.startsWith('data: ['))
  if (!complete) throw new Error('The speech provider returned no audio result.')
  return JSON.parse(complete.slice(6))
}

async function callGradio(name, data, config, fetcher) {
  const queued = await requestJson(`${config.ttsUrl}/gradio_api/call/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }),
    signal: AbortSignal.timeout(15000),
  }, fetcher)
  const response = await fetcher(`${config.ttsUrl}/gradio_api/call/${name}/${queued.event_id}`,
    { signal: AbortSignal.timeout(300000) })
  if (!response.ok) throw new Error(`The speech provider returned ${response.status}.`)
  return parseGradioResult(await response.text())
}

async function runSpeechJob(job, request, config, fetcher) {
  try {
    job.status = 'processing'
    await callGradio('handle_load_kokoro', [], config, fetcher)
    const info = await requestJson(`${config.ttsUrl}/gradio_api/info`,
      { signal: AbortSignal.timeout(15000) }, fetcher)
    const parameters = info.named_endpoints?.['/generate_unified_tts']?.parameters
    if (!Array.isArray(parameters)) throw new Error('Ultimate TTS Studio API information is unavailable.')
    const data = parameters.map((parameter) => parameter.parameter_has_default ? parameter.parameter_default : null)
    const set = (name, value) => { const index = parameters.findIndex((parameter) => parameter.parameter_name === name); if (index >= 0) data[index] = value }
    set('text_input', request.prompt.trim())
    set('tts_engine', 'Kokoro TTS')
    set('audio_format', 'wav')
    set('kokoro_voice', 'af_heart')
    const [audio] = await callGradio('generate_unified_tts', data, config, fetcher)
    if (!audio?.url) throw new Error('Ultimate TTS Studio did not return an audio file.')
    Object.assign(job, { status: 'completed', providerUrl: audio.url, url: `/media/audio/${job.id}` })
  } catch (error) {
    Object.assign(job, { status: 'failed', error: error instanceof Error ? error.message : 'Speech generation failed.' })
  }
}

export async function createMediaGeneration(request, config, fetcher = fetch) {
  if (!request?.prompt?.trim()) throw new Error('A description is required.')
  if (request.kind === 'image') return createImageGeneration(request, config, fetcher)
  if (request.kind !== 'audio' || request.audioMode !== 'speech') {
    throw new Error(`${request.audioMode || request.kind || 'This media type'} generation is not configured yet.`)
  }
  if ((request.language || 'en') !== 'en') {
    throw new Error('Local speech generation currently supports English. Additional languages require a compatible voice model.')
  }
  const id = randomUUID()
  const job = { id, kind: 'audio', status: 'queued', prompt: request.prompt.trim(), createdAt: new Date().toISOString() }
  jobs.set(id, job)
  void runSpeechJob(job, request, config, fetcher)
  return publicJob(job)
}

export async function getMediaGeneration(id, config, fetcher = fetch) {
  const job = jobs.get(id)
  if (!job) return null
  return job.kind === 'image' ? getImageGeneration(id, config, fetcher) : publicJob(job)
}

export async function proxyAudioFile(id, config, response, allowedOrigin, fetcher = fetch) {
  const job = jobs.get(id)
  if (!job?.providerUrl) throw new Error('Generated audio is unavailable.')
  const upstream = await fetcher(job.providerUrl, { signal: AbortSignal.timeout(30000) })
  if (!upstream.ok || !upstream.body) throw new Error('Generated audio is unavailable from Ultimate TTS Studio.')
  response.writeHead(200, { 'Content-Type': upstream.headers.get('content-type') || 'audio/wav',
    'Content-Disposition': 'inline; filename="aios-speech.wav"', 'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin' })
  const { Readable } = await import('node:stream')
  Readable.fromWeb(upstream.body).pipe(response)
}

export async function proxyComfyFile(searchParams, config, response, origin, allowedOrigin, fetcher = fetch) {
  const upstream = await fetcher(`${config.comfyUrl}/view?${searchParams}`, { signal: AbortSignal.timeout(30000) })
  if (!upstream.ok || !upstream.body) throw new Error('Generated image is unavailable from ComfyUI.')
  response.writeHead(200, { 'Content-Type': upstream.headers.get('content-type') || 'image/png',
    'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin' })
  const { Readable } = await import('node:stream')
  Readable.fromWeb(upstream.body).pipe(response)
}
