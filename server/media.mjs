import { randomUUID } from 'node:crypto'
import { closeSync, createReadStream, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { pipeNodeStream, pipeWebStream } from './streaming.mjs'

const jobs = new Map()
let loadedJobsFile = ''

function loadJobs(config) {
  if (!config.mediaJobsFile || loadedJobsFile === config.mediaJobsFile) return
  jobs.clear()
  try {
    const saved = JSON.parse(readFileSync(config.mediaJobsFile, 'utf8'))
    if (Array.isArray(saved)) saved.forEach((job) => {
      if (job?.id && job?.kind && job?.status) jobs.set(job.id, job)
    })
  } catch {
    try {
      const recovered = JSON.parse(readFileSync(`${config.mediaJobsFile}.tmp`, 'utf8'))
      if (Array.isArray(recovered)) recovered.forEach((job) => { if (job?.id && job?.kind && job?.status) jobs.set(job.id, job) })
    } catch { /* A new installation has no persisted queue yet. */ }
  }
  loadedJobsFile = config.mediaJobsFile
}

function saveJobs(config) {
  if (!config.mediaJobsFile) return
  mkdirSync(dirname(config.mediaJobsFile), { recursive: true })
  const temporary = `${config.mediaJobsFile}.tmp`
  writeFileSync(temporary, JSON.stringify([...jobs.values()], null, 2), 'utf8')
  const descriptor = openSync(temporary, 'r')
  try { try { fsyncSync(descriptor) } catch { /* Some Windows filesystems reject fsync; rename remains atomic. */ } } finally { closeSync(descriptor) }
  renameSync(temporary, config.mediaJobsFile)
}

function storeJob(job, config) {
  jobs.set(job.id, job)
  saveJobs(config)
}

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

const imageLongEdges = { high: 1024, ultra: 1280, '2k': 2048, '4k': 3840, '8k': 7680 }

function fitLongEdge([width, height], longEdge) {
  const scale = longEdge / Math.max(width, height)
  return [Math.round(width * scale / 8) * 8, Math.round(height * scale / 8) * 8]
}

function workflowFor(request, config, seed) {
  const [baseWidth, baseHeight] = dimensions[request.aspectRatio] || dimensions['16:9']
  const requestedSize = request.imageResolution || (request.quality === 'ultra' ? 'ultra' : 'high')
  const [targetWidth, targetHeight] = fitLongEdge([baseWidth, baseHeight], imageLongEdges[requestedSize] || 1024)
  const nativeLongEdge = 1024
  const [width, height] = fitLongEdge([baseWidth, baseHeight], nativeLongEdge)
  const steps = request.quality === 'draft' ? 14 : request.quality === 'high' ? 32 : request.quality === 'ultra' ? 40 : 22
  const faceSteps = request.quality === 'ultra' ? 16 : request.quality === 'high' ? 14 : 12
  const style = request.visualStyle ? `${request.visualStyle} style, ` : ''
  const purpose = request.imageMode?.replaceAll('_', ' ') || 'ministry image'
  const prompt = `${style}${purpose}, ${request.prompt}, exceptionally detailed, intricate textures, crisp edges, layered lighting, realistic materials, sharp focal detail, anatomically natural face, expressive symmetrical eyes, detailed skin texture, individual hair strands, professional composition, respectful Christian ministry visual`
  const workflow = {
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: config.comfyCheckpoint } },
    '2': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['1', 1] } },
    '3': { class_type: 'CLIPTextEncode', inputs: { text: 'blurry, motion blur, smeared, stretched, distorted, asymmetrical eyes, crossed eyes, deformed face, poorly drawn face, duplicate face, duplicate body, malformed hands, extra fingers, bad anatomy, waxy skin, plastic skin, watermark, logo, illegible text, low quality', clip: ['1', 1] } },
    '4': { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } },
    '5': { class_type: 'KSampler', inputs: {
      seed, steps, cfg: 7, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1,
      model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0],
    } },
    '6': { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
    '7': { class_type: 'SaveImage', inputs: { filename_prefix: 'AIOS_Studio', images: ['12', 0] } },
    '11': { class_type: 'UltralyticsDetectorProvider', inputs: { model_name: 'bbox/face_yolov8m.pt' } },
    '12': { class_type: 'FaceDetailer', inputs: {
      image: ['6', 0], model: ['1', 0], clip: ['1', 1], vae: ['1', 2],
      guide_size: 512, guide_size_for: true, max_size: 768, seed: seed + 1,
      steps: faceSteps, cfg: 6.5, sampler_name: 'dpmpp_2m', scheduler: 'karras',
      positive: ['2', 0], negative: ['3', 0], denoise: 0.32, feather: 20,
      noise_mask: true, force_inpaint: true, bbox_threshold: 0.35, bbox_dilation: 12,
      bbox_crop_factor: 2.5, sam_detection_hint: 'none', sam_dilation: 0,
      sam_threshold: 0.93, sam_bbox_expansion: 0, sam_mask_hint_threshold: 0.7,
      sam_mask_hint_use_negative: 'False', drop_size: 10, bbox_detector: ['11', 0],
      wildcard: '', cycle: 1,
    } },
  }
  if (targetWidth !== width || targetHeight !== height) {
    workflow['10'] = { class_type: 'ImageScale', inputs: {
      image: ['12', 0], upscale_method: 'lanczos', width: targetWidth, height: targetHeight, crop: 'disabled',
    } }
    workflow['7'].inputs.images = ['10', 0]
  }
  return workflow
}

function audioWorkflowFor(request, config, seed) {
  const duration = Math.min(300, Math.max(5, Number(request.durationSeconds) || 15))
  const instrumental = request.audioMode !== 'song'
  const descriptors = [request.genre, request.audioStyle, request.prompt]
    .map((value) => value?.trim()).filter(Boolean).join(', ')
  return {
    '3': { class_type: 'KSampler', inputs: {
      seed, steps: 8, cfg: 1, sampler_name: 'euler', scheduler: 'simple', denoise: 1,
      model: ['78', 0], positive: ['94', 0], negative: ['47', 0], latent_image: ['98', 0],
    } },
    '18': { class_type: 'VAEDecodeAudio', inputs: { samples: ['3', 0], vae: ['106', 0] } },
    '47': { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['94', 0] } },
    '78': { class_type: 'ModelSamplingAuraFlow', inputs: { shift: 3, model: ['104', 0] } },
    '94': { class_type: 'TextEncodeAceStepAudio1.5', inputs: {
      tags: descriptors,
      lyrics: instrumental ? '[Instrumental]' : request.prompt.trim(),
      seed, bpm: 78, duration, timesignature: '4', language: request.language || 'en',
      keyscale: 'C major', generate_audio_codes: false, cfg_scale: 2,
      temperature: 0.85, top_p: 0.9, top_k: 0, min_p: 0, clip: ['105', 0],
    } },
    '98': { class_type: 'EmptyAceStep1.5LatentAudio', inputs: { seconds: duration, batch_size: 1 } },
    '104': { class_type: 'UNETLoader', inputs: { unet_name: config.aceStepModel, weight_dtype: 'default' } },
    '105': { class_type: 'DualCLIPLoader', inputs: {
      clip_name1: config.aceStepEncoder, clip_name2: config.aceStepEncoder, type: 'ace', device: 'default',
    } },
    '106': { class_type: 'VAELoader', inputs: { vae_name: config.aceStepVae } },
    '107': { class_type: 'SaveAudioMP3', inputs: {
      filename_prefix: 'audio/AIOS_Studio_ACE', quality: 'V0', audioUI: '', audio: ['18', 0],
    } },
  }
}

async function requestJson(url, options, fetcher) {
  const response = await fetcher(url, options)
  if (!response.ok) throw new Error((await response.text()) || `ComfyUI returned ${response.status}.`)
  return response.json()
}

async function createImageGeneration(request, config, fetcher = fetch) {
  loadJobs(config)
  if (!request?.prompt?.trim()) throw new Error('A description is required.')
  if (request.kind !== 'image') throw new Error(`${request.kind || 'This media type'} generation is not configured yet.`)
  const id = randomUUID()
  const seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
  const queued = await requestJson(`${config.comfyUrl}/prompt`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflowFor({ ...request, prompt: request.prompt.trim() }, config, seed), client_id: `aios-${id}` }),
    signal: AbortSignal.timeout(15000),
  }, fetcher)
  const job = { id, providerId: queued.prompt_id, kind: 'image', status: 'queued', progress: 5,
    prompt: request.prompt.trim(), project: request.project || 'General', settings: { ...request, prompt: undefined, kind: undefined, project: undefined }, createdAt: new Date().toISOString() }
  storeJob(job, config)
  return publicJob(job)
}

async function createComfyAudioGeneration(request, config, fetcher = fetch) {
  loadJobs(config)
  const id = randomUUID()
  const seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
  const queued = await requestJson(`${config.comfyUrl}/prompt`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: audioWorkflowFor(request, config, seed), client_id: `aios-${id}` }),
    signal: AbortSignal.timeout(15000),
  }, fetcher)
  const job = { id, providerId: queued.prompt_id, kind: 'audio', status: 'queued', progress: 5,
    prompt: request.prompt.trim(), project: request.project || 'General', settings: { ...request, prompt: undefined, kind: undefined, project: undefined }, createdAt: new Date().toISOString() }
  storeJob(job, config)
  return publicJob(job)
}

async function getImageGeneration(id, config, fetcher = fetch) {
  loadJobs(config)
  const job = jobs.get(id)
  if (!job) return null
  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') return publicJob(job)
  const history = await requestJson(`${config.comfyUrl}/history/${encodeURIComponent(job.providerId)}`,
    { signal: AbortSignal.timeout(10000) }, fetcher)
  const entry = history[job.providerId]
  if (!entry) {
    Object.assign(job, { status: 'processing', progress: Math.min(90, (job.progress || 5) + 10) })
    saveJobs(config)
    return publicJob(job)
  }
  if (entry.status?.status_str === 'error') {
    Object.assign(job, { status: 'failed', progress: 100, error: entry.status.messages?.at(-1)?.[1]?.exception_message || 'Media generation failed.' })
    saveJobs(config)
    return publicJob(job)
  }
  const file = Object.values(entry.outputs || {}).flatMap((output) => output.images || output.audio || [])[0]
  if (!file) return { ...publicJob(job), status: 'processing' }
  const query = new URLSearchParams({ filename: file.filename, subfolder: file.subfolder || '', type: file.type || 'output' })
  Object.assign(job, { status: 'completed', progress: 100, url: `/media/files?${query}` })
  saveJobs(config)
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
  saveJobs(config)
}

export async function createMediaGeneration(request, config, fetcher = fetch) {
  loadJobs(config)
  if (!request?.prompt?.trim()) throw new Error('A description is required.')
  if (request.kind === 'image') return createImageGeneration(request, config, fetcher)
  if (request.kind === 'audio' && ['music', 'instrumental', 'song'].includes(request.audioMode)) {
    return createComfyAudioGeneration(request, config, fetcher)
  }
  if (request.kind !== 'audio' || request.audioMode !== 'speech') {
    throw new Error(`${request.audioMode || request.kind || 'This media type'} generation is not configured yet.`)
  }
  if ((request.language || 'en') !== 'en') {
    throw new Error('Local speech generation currently supports English. Additional languages require a compatible voice model.')
  }
  const id = randomUUID()
  const job = { id, kind: 'audio', status: 'queued', prompt: request.prompt.trim(), project: request.project || 'General',
    settings: { ...request, prompt: undefined, kind: undefined, project: undefined }, createdAt: new Date().toISOString() }
  storeJob(job, config)
  void runSpeechJob(job, request, config, fetcher)
  return publicJob(job)
}

export async function getMediaGeneration(id, config, fetcher = fetch) {
  loadJobs(config)
  const job = jobs.get(id)
  if (!job) return null
  return job.providerId ? getImageGeneration(id, config, fetcher) : publicJob(job)
}

export function listMediaGenerations(config) {
  loadJobs(config)
  return [...jobs.values()].map(publicJob).sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export function cancelMediaGeneration(id, config) {
  loadJobs(config)
  const job = jobs.get(id)
  if (!job) return null
  if (job.status === 'queued' || job.status === 'processing') {
    Object.assign(job, { status: 'cancelled', progress: 100, error: 'Cancelled by user.' })
    saveJobs(config)
  }
  return publicJob(job)
}

export async function proxyAudioFile(id, config, response, allowedOrigin, fetcher = fetch) {
  loadJobs(config)
  const job = jobs.get(id)
  if (!job?.providerUrl) throw new Error('Generated audio is unavailable.')
  const upstream = await fetcher(job.providerUrl, { signal: AbortSignal.timeout(30000) })
  if (!upstream.ok || !upstream.body) throw new Error('Generated audio is unavailable from Ultimate TTS Studio.')
  response.writeHead(200, { 'Content-Type': upstream.headers.get('content-type') || 'audio/wav',
    'Content-Disposition': 'inline; filename="aios-speech.wav"', 'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin' })
  await pipeWebStream(upstream.body, response)
}

export async function proxyComfyFile(searchParams, config, response, origin, allowedOrigin, fetcher = fetch) {
  const upstream = await fetcher(`${config.comfyUrl}/view?${searchParams}`, { signal: AbortSignal.timeout(30000) })
  if (!upstream.ok || !upstream.body) throw new Error('Generated media is unavailable from ComfyUI.')
  response.writeHead(200, { 'Content-Type': upstream.headers.get('content-type') || 'image/png',
    'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin' })
  await pipeWebStream(upstream.body, response)
}

export function listWanVideos(config) {
  if (!config.wanOutputDir) return []
  try {
    return readdirSync(config.wanOutputDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && ['.mp4', '.webm'].includes(extname(entry.name).toLowerCase()))
      .map((entry) => {
        const stats = statSync(join(config.wanOutputDir, entry.name))
        const prompt = entry.name.replace(/^\d{4}-\d{2}-\d{2}-[^_]+_seed\d+_/, '').replace(/\.(mp4|webm)$/i, '')
        return { id: `wan-${Buffer.from(entry.name).toString('base64url')}`, kind: 'video', status: 'completed',
          prompt, createdAt: stats.mtime.toISOString(), url: `/media/wan/files?name=${encodeURIComponent(entry.name)}` }
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 30)
  } catch { return [] }
}

export async function proxyWanFile(name, config, response, allowedOrigin) {
  const safeName = basename(name)
  if (!config.wanOutputDir || safeName !== name || !['.mp4', '.webm'].includes(extname(safeName).toLowerCase())) {
    throw new Error('Invalid WanGP video file.')
  }
  const file = join(config.wanOutputDir, safeName)
  const stats = statSync(file)
  response.writeHead(200, { 'Content-Type': extname(safeName).toLowerCase() === '.webm' ? 'video/webm' : 'video/mp4',
    'Content-Length': stats.size, 'Content-Disposition': `inline; filename="${safeName.replaceAll('"', '')}"`,
    'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin' })
  await pipeNodeStream(createReadStream(file), response)
}
