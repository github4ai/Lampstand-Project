import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, delimiter, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pythonEntry = process.platform === 'win32' ? ['Scripts', 'python.exe'] : ['bin', 'python']

/** The operator's choice, not a measurement: false only after they put the services in standby. */
let servicesRequested

function portOf(url, fallback) {
  try { return Number(new URL(url).port) || fallback } catch { return fallback }
}

function validPinokioApp(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9._-]+$/.test(value)
}

function pinokioHome(config) {
  const declared = config.pinokioHome?.trim()
  if (declared) return resolve(declared)
  try {
    const value = JSON.parse(readFileSync(join(homedir(), '.pinokio', 'config.json'), 'utf8')).home
    return typeof value === 'string' && value.trim() ? resolve(value) : ''
  } catch { return '' }
}

/** Where an app Pinokio installed lives, or an empty string when Pinokio never set up here. */
function pinokioAppRoot(home, app) {
  return home && validPinokioApp(app) ? join(home, 'api', app) : ''
}

/** Pinokio points each app at its own model caches; without them a direct start re-downloads. */
function pinokioCacheEnv(appRoot) {
  const env = {}
  for (const key of ['HF_HOME', 'TORCH_HOME', 'GRADIO_TEMP_DIR']) {
    const directory = join(appRoot, 'cache', key)
    if (existsSync(directory)) env[key] = directory
  }
  return env
}

const definitions = (config, home) => [
  { id: 'ollama', label: 'Translation', url: `${config.ollamaUrl}/api/tags`, executable: config.ollamaExecutable,
    args: ['serve'], cwd: workspaceRoot },
  { id: 'whisper', label: 'Transcription', url: `${config.whisperUrl}/health`, executable: config.whisperPython,
    args: ['-m', 'uvicorn', 'whisper_server.app:app', '--host', '127.0.0.1', '--port', portOf(config.whisperUrl, 8000)], cwd: workspaceRoot },
  { id: 'comfy', label: 'Standard image and audio', url: `${config.comfyUrl}/system_stats`,
    pinokioApp: config.comfyPinokioApp,
    launch: () => {
      const appRoot = pinokioAppRoot(home, config.comfyPinokioApp)
      const cwd = join(appRoot, 'app')
      const executable = join(cwd, 'env', ...pythonEntry)
      if (!appRoot || !existsSync(executable)) return null
      return { executable, args: ['main.py', '--port', String(portOf(config.comfyUrl, 8188))], cwd,
        env: { ...pinokioCacheEnv(appRoot), PYTORCH_ENABLE_MPS_FALLBACK: '1', TOKENIZERS_PARALLELISM: 'false' } }
    },
  },
  { id: 'wangp', label: 'Maximum image, music, and video', url: config.wanUrl,
    pinokioApp: config.wanPinokioApp,
    launch: () => {
      const appRoot = pinokioAppRoot(home, config.wanPinokioApp)
      const cwd = join(appRoot, 'app')
      const executable = join(cwd, 'env', ...pythonEntry)
      if (!appRoot || !existsSync(executable)) return null
      // Wan2GP otherwise binds a port Pinokio hands out at random, so the app pins the one it probes.
      return { executable, args: ['wgp.py', '--multiple-images', '--server-name', '127.0.0.1',
        '--server-port', String(portOf(config.wanUrl, 42003))], cwd, env: pinokioCacheEnv(appRoot) }
    },
  },
  { id: 'speech', label: 'Speech generation', url: `${config.ttsUrl}/gradio_api/info`,
    pinokioApp: config.ttsPinokioApp,
    launch: () => {
      const appRoot = pinokioAppRoot(home, config.ttsPinokioApp)
      const cwd = join(appRoot, 'app')
      const envRoot = join(cwd, 'tts_env')
      const executable = process.platform === 'win32' ? join(envRoot, 'python.exe') : join(envRoot, 'bin', 'python')
      if (!appRoot || !existsSync(executable)) return null
      // This one runs from a conda environment, whose DLL folders have to be on the path.
      const path = process.platform === 'win32'
        ? [envRoot, join(envRoot, 'Library', 'bin'), join(envRoot, 'DLLs'), process.env.PATH].join(delimiter)
        : undefined
      return { executable, args: ['launch.py'], cwd,
        env: { ...pinokioCacheEnv(appRoot), GRADIO_SERVER_NAME: '127.0.0.1',
          GRADIO_SERVER_PORT: String(portOf(config.ttsUrl, 7860)), ...(path ? { PATH: path } : {}) } }
    },
  },
  { id: 'voicestudio', label: 'Voice Studio (speech and transcription)', url: `${config.voiceStudioUrl}/health`,
    executable: config.voiceStudioExecutable, args: [] },
]

function findPterm(config, home) {
  const candidates = [config.ptermPath]
  if (home) {
    candidates.push(join(home, 'bin', 'npm', process.platform === 'win32' ? 'pterm.cmd' : 'pterm'))
    candidates.push(join(home, 'bin', 'pterm'))
  }
  return candidates.find((candidate) => candidate && existsSync(candidate)) || ''
}

async function isAvailable(url, fetcher) {
  try {
    const response = await fetcher(url, { signal: AbortSignal.timeout(1800) })
    return response.ok
  } catch { return false }
}

function startDetached(executable, args, { cwd, env, shell = false } = {}) {
  const child = spawn(executable, args, {
    cwd, detached: true, shell, stdio: 'ignore', windowsHide: true,
    ...(env ? { env: { ...process.env, ...env } } : {}),
  })
  child.unref()
  return child
}

/**
 * Quit stops only what the app itself launched, so the state file is appended to rather than
 * rewritten: the boot script already recorded the services it started.
 */
function recordStartedService(config, id, child, executable) {
  const file = config.servicesStateFile
  if (!file || !child?.pid) return
  const entry = { id, pid: child.pid, name: basename(executable, extname(executable)) }
  let services = []
  try {
    const existing = JSON.parse(readFileSync(file, 'utf8'))
    if (Array.isArray(existing.services)) services = existing.services.filter((service) => service.id !== id)
  } catch { /* first record */ }
  try {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify({ startedAt: new Date().toISOString(), services: [...services, entry] }, null, 2), 'utf8')
  } catch { /* quitting without a record leaves the service running, which is safe */ }
}

function launchOne(service, pterm, start) {
  const recipe = service.launch?.()
  const chosen = recipe || (service.executable && existsSync(service.executable) ? service : null)
  if (chosen) return { executable: chosen.executable, child: start(chosen.executable, chosen.args, { cwd: chosen.cwd, env: chosen.env }), tracked: true }
  if (service.pinokioApp && pterm) {
    // Pinokio's launcher exits after handing the server to its own process tree, so this launch
    // cannot be recorded by pid and is left running when the app quits.
    return { child: start(pterm, ['run', service.pinokioApp], {
      cwd: workspaceRoot, shell: process.platform === 'win32' && pterm.endsWith('.cmd'),
    }), tracked: false }
  }
  throw new Error(`${service.label} is not installed.`)
}

async function startMissing(service, pterm, fetcher, start) {
  if (await isAvailable(service.url, fetcher)) return null
  try {
    return { started: service.id, ...launchOne(service, pterm, start) }
  } catch (error) {
    return { error: { id: service.id, message: error instanceof Error ? error.message : `Unable to start ${service.label}.` } }
  }
}

export async function getAiServicesStatus(config, fetcher = fetch) {
  const home = pinokioHome(config)
  const pterm = findPterm(config, home)
  const providers = await Promise.all(definitions(config, home).map(async (service) => {
    const available = await isAvailable(service.url, fetcher)
    const configured = available || Boolean(
      service.pinokioApp ||
      (service.executable && existsSync(service.executable)),
    )
    const startable = !available && Boolean(
      service.launch?.() ||
      (service.executable && existsSync(service.executable)) ||
      (service.pinokioApp && pterm),
    )

    return {
      id: service.id,
      label: service.label,
      available,
      configured,
      startable,
    }
  }))
  const allReady = providers.every((provider) => provider.available)
  return { enabled: servicesRequested !== false, allReady, automaticResourceManagement: true, providers }
}

export async function startAiServices(config, fetcher = fetch, start = startDetached) {
  const home = pinokioHome(config)
  const pterm = findPterm(config, home)
  const started = []
  const errors = []

  for (const service of definitions(config, home)) {
    const outcome = await startMissing(service, pterm, fetcher, start)
    if (!outcome) continue
    if (outcome.error) errors.push(outcome.error)
    else {
      started.push(outcome.started)
      if (outcome.tracked) recordStartedService(config, outcome.started, outcome.child, outcome.executable)
    }
  }
  servicesRequested = true
  return { ...(await getAiServicesStatus(config, fetcher)), started, errors }
}

export async function startAiService(config, id, fetcher = fetch, start = startDetached) {
  const home = pinokioHome(config)
  const service = definitions(config, home).find((candidate) => candidate.id === id)
  if (!service) throw new Error('Unknown AI service.')
  const outcome = await startMissing(service, findPterm(config, home), fetcher, start)
  if (outcome?.error) throw new Error(outcome.error.message)
  if (outcome?.tracked) recordStartedService(config, outcome.started, outcome.child, outcome.executable)
  servicesRequested = true
  return await getAiServicesStatus(config, fetcher)
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
  servicesRequested = false
  return { ...(await getAiServicesStatus(config, fetcher)), unloaded: { comfy, wangp: wangpQueued } }
}

export function resetAiServicesState() { servicesRequested = undefined }
