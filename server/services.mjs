import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
let servicesEnabled

const definitions = (config) => [
  { id: 'ollama', label: 'Translation', url: `${config.ollamaUrl}/api/tags`, executable: config.ollamaExecutable,
    args: ['serve'], cwd: workspaceRoot },
  { id: 'whisper', label: 'Transcription', url: `${config.whisperUrl}/health`,
    executable: config.whisperPython || join(workspaceRoot, '.venv-whisper', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'),
    args: ['-m', 'uvicorn', 'whisper_server.app:app', '--host', '127.0.0.1', '--port', '8000'], cwd: workspaceRoot },
  { id: 'comfy', label: 'Standard image and audio', url: `${config.comfyUrl}/system_stats`, pinokioApp: config.comfyPinokioApp },
  { id: 'wangp', label: 'Maximum image, music, and video', url: config.wanUrl, pinokioApp: config.wanPinokioApp },
  { id: 'speech', label: 'Speech generation', url: `${config.ttsUrl}/gradio_api/info`, pinokioApp: config.ttsPinokioApp },
  { id: 'voicestudio', label: 'Voice Studio (speech and transcription)', url: `${config.voiceStudioUrl}/health`,
    executable: config.voiceStudioExecutable, args: [] },
]

async function isAvailable(url, fetcher) {
  try {
    const response = await fetcher(url, { signal: AbortSignal.timeout(1800) })
    return response.ok
  } catch { return false }
}

function findPterm(config) {
  const candidates = [config.ptermPath]
  try {
    const pinokioConfig = JSON.parse(readFileSync(join(homedir(), '.pinokio', 'config.json'), 'utf8'))
    if (pinokioConfig.home) {
      candidates.push(join(pinokioConfig.home, 'bin', 'npm', process.platform === 'win32' ? 'pterm.cmd' : 'pterm'))
      candidates.push(join(pinokioConfig.home, 'bin', 'pterm'))
    }
  } catch { /* Pinokio is optional. */ }
  return candidates.find((candidate) => candidate && existsSync(candidate)) || ''
}

function startDetached(executable, args, cwd, shell = false) {
  const child = spawn(executable, args, { cwd, detached: true, shell, stdio: 'ignore', windowsHide: true })
  child.unref()
}

function validPinokioApp(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9._-]+$/.test(value)
}

export async function getAiServicesStatus(config, fetcher = fetch) {
  const providers = await Promise.all(definitions(config).map(async (service) => {
    const available = await isAvailable(service.url, fetcher)
    const configured = available || Boolean(
      service.pinokioApp ||
      (service.executable && existsSync(service.executable)),
    )

    return {
      id: service.id,
      label: service.label,
      available,
      configured,
    }
  }))
  const allReady = providers.every((provider) => provider.available)
  if (servicesEnabled === undefined) servicesEnabled = allReady
  return { enabled: Boolean(servicesEnabled), allReady, automaticResourceManagement: true, providers }
}

export async function startAiServices(config, fetcher = fetch, start = startDetached) {
  const current = await getAiServicesStatus(config, fetcher)
  const availability = new Map(current.providers.map((provider) => [provider.id, provider.available]))
  const pterm = findPterm(config)
  const started = []
  const errors = []

  for (const service of definitions(config)) {
    if (availability.get(service.id)) continue
    try {
      if (service.pinokioApp) {
        if (!pterm) throw new Error('Pinokio control is unavailable.')
        if (!validPinokioApp(service.pinokioApp)) throw new Error('Invalid Pinokio application name.')
        start(pterm, ['run', service.pinokioApp], workspaceRoot, process.platform === 'win32' && pterm.endsWith('.cmd'))
      } else {
        if (!service.executable || !existsSync(service.executable)) throw new Error(`${service.label} is not installed.`)
        start(service.executable, service.args, service.cwd)
      }
      started.push(service.id)
    } catch (error) {
      errors.push({ id: service.id, message: error instanceof Error ? error.message : `Unable to start ${service.label}.` })
    }
  }
  servicesEnabled = true
  return { ...(await getAiServicesStatus(config, fetcher)), started, errors }
}

export async function repairAiServices(config, fetcher = fetch, start = startDetached) {
  const result = await startAiServices(config, fetcher, start)
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1200))
  return { ...(await getAiServicesStatus(config, fetcher)), repaired: result.started ?? [], errors: result.errors ?? [] }
}

async function postQuietly(url, body, fetcher) {
  try {
    const response = await fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(5000) })
    return response.ok
  } catch { return false }
}

export async function unloadAiModels(config, fetcher = fetch) {
  const [comfy, wangpQueued] = await Promise.all([
    postQuietly(`${config.comfyUrl}/free`, { unload_models: true, free_memory: true }, fetcher),
    postQuietly(`${config.wanUrl}/gradio_api/call/release_ram_and_notify`, { data: [] }, fetcher),
  ])
  servicesEnabled = false
  return { ...(await getAiServicesStatus(config, fetcher)), unloaded: { comfy, wangp: wangpQueued } }
}

export function resetAiServicesState() { servicesEnabled = undefined }
