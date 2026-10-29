import { execFile } from 'node:child_process'
import { cpus, freemem, totalmem } from 'node:os'

const GPU_QUERY = ['--query-gpu=name,memory.used,memory.total,utilization.gpu', '--format=csv,noheader,nounits']

function runNvidiaSmi(executable) {
  return new Promise((resolve, reject) => {
    execFile(executable, GPU_QUERY, { timeout: 2500, windowsHide: true, encoding: 'utf8' }, (error, stdout) => {
      if (error) reject(error)
      else resolve(stdout)
    })
  })
}

/**
 * `nvidia-smi` prints one line per card, and leaves the utilisation blank on cards whose
 * driver will not report it, so a missing number stays null instead of becoming a zero.
 */
export function parseNvidiaSmi(output) {
  const [line] = String(output ?? '').split('\n').map((row) => row.trim()).filter(Boolean)
  if (!line) return null
  const [name, usedMb, totalMb, utilization] = line.split(',').map((part) => part.trim())
  if (!name || !Number.isFinite(Number(usedMb)) || !Number.isFinite(Number(totalMb))) return null

  return {
    name,
    vendor: 'nvidia',
    percent: Number.isFinite(Number(utilization)) ? Math.round(Number(utilization)) : null,
    memoryUsedBytes: Math.round(Number(usedMb) * 1024 * 1024),
    memoryTotalBytes: Math.round(Number(totalMb) * 1024 * 1024),
  }
}

function cpuTicks(list) {
  let idle = 0
  let total = 0
  for (const cpu of list) {
    const times = cpu?.times || {}
    const idleMs = (times.idle || 0) + (times.irq || 0)
    idle += idleMs
    total += idleMs + (times.user || 0) + (times.nice || 0) + (times.sys || 0)
  }

  return { idle, total }
}

/**
 * Percentages come from the change between two reads, so the first read of a session reports
 * the hardware it can name and leaves the busy figures empty rather than guessing them.
 */
export function createResourceSampler({
  readCpus = cpus,
  readTotalMemory = totalmem,
  readFreeMemory = freemem,
  readAppMemory = async () => ({ bytes: process.memoryUsage().rss, scope: 'gateway' }),
  readGpu = () => runNvidiaSmi('nvidia-smi'),
  gpuCacheMs = 4000,
  now = Date.now,
} = {}) {
  let previousCpu = null
  let gpuCache = { at: Number.NEGATIVE_INFINITY, value: null }

  async function readGpuCached() {
    const stamp = now()
    if (stamp - gpuCache.at < gpuCacheMs) return gpuCache.value
    gpuCache = { at: stamp, value: null }
    try {
      gpuCache.value = parseNvidiaSmi(await readGpu())
    } catch { /* No NVIDIA driver means the panel shows the adapter name alone. */ }

    return gpuCache.value
  }

  async function snapshot() {
    const list = readCpus()
    const current = cpuTicks(list)
    const delta = current.total - (previousCpu?.total ?? current.total)
    const idleDelta = current.idle - (previousCpu?.idle ?? current.idle)
    const percent = previousCpu && delta > 0
      ? Math.min(100, Math.max(0, Math.round(100 * (1 - idleDelta / delta))))
      : null
    previousCpu = current

    const totalBytes = readTotalMemory()
    const usedBytes = Math.max(0, totalBytes - readFreeMemory())
    const gpu = await readGpuCached()
    let app
    try {
      app = await readAppMemory()
    } catch {
      app = { bytes: process.memoryUsage().rss, scope: 'gateway' }
    }

    return {
      cpu: { model: String(list[0]?.model || '').trim() || 'Unknown processor', cores: list.length, percent },
      memory: { totalBytes, usedBytes },
      gpu,
      app,
    }
  }

  return { snapshot }
}
