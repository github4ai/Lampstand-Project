import { describe, expect, it, vi } from 'vitest'
import { createResourceSampler, parseNvidiaSmi } from './resources.mjs'

const cpuSet = (user, sys, idle) => [{ model: '  Test Processor @ 3.00GHz  ', times: { user, nice: 0, sys, idle, irq: 0 } }]

const baseOptions = (overrides = {}) => ({
  readCpus: () => [cpuSet(100, 50, 800)[0]],
  readTotalMemory: () => 16 * 1024 ** 3,
  readFreeMemory: () => 12 * 1024 ** 3,
  readGpu: async () => 'NVIDIA GeForce RTX 2080, 2048, 8192, 40\n',
  ...overrides,
})

describe('resource sampler', () => {
  it('names the processor and reports memory in use from the machine totals', async () => {
    const snapshot = await createResourceSampler(baseOptions()).snapshot()
    expect(snapshot.cpu).toEqual({ model: 'Test Processor @ 3.00GHz', cores: 1, percent: null })
    expect(snapshot.memory).toEqual({ totalBytes: 16 * 1024 ** 3, usedBytes: 4 * 1024 ** 3 })
  })

  it('measures processor load from the change between two reads', async () => {
    const reads = [[cpuSet(100, 50, 800)[0]], [cpuSet(200, 100, 1600)[0]]]
    const sampler = createResourceSampler(baseOptions({ readCpus: () => reads.shift() }))
    expect((await sampler.snapshot()).cpu.percent).toBe(null)
    expect((await sampler.snapshot()).cpu.percent).toBe(16)
  })

  it('reads the graphics card once per cache window', async () => {
    let stamp = 1_000
    const readGpu = vi.fn(baseOptions().readGpu)
    const sampler = createResourceSampler(baseOptions({ readGpu, now: () => stamp }))
    const first = await sampler.snapshot()
    stamp += 1_000
    expect((await sampler.snapshot()).gpu).toEqual(first.gpu)
    expect(readGpu).toHaveBeenCalledTimes(1)
    stamp += 4_000
    await sampler.snapshot()
    expect(readGpu).toHaveBeenCalledTimes(2)
    expect(first.gpu).toEqual({
      name: 'NVIDIA GeForce RTX 2080',
      vendor: 'nvidia',
      percent: 40,
      memoryUsedBytes: 2048 * 1024 * 1024,
      memoryTotalBytes: 8192 * 1024 * 1024,
    })
  })

  it('leaves the card out when the driver is missing instead of failing the read', async () => {
    const readGpu = vi.fn(async () => { throw new Error('spawn nvidia-smi ENOENT') })
    const sampler = createResourceSampler(baseOptions({ readGpu }))
    expect((await sampler.snapshot()).gpu).toBe(null)
    expect((await sampler.snapshot()).gpu).toBe(null)
    expect(readGpu).toHaveBeenCalledTimes(1)
  })

  it('uses the whole-application figure when the desktop host supplies one', async () => {
    const readAppMemory = async () => ({ bytes: 900 * 1024 * 1024, scope: 'app' })
    const snapshot = await createResourceSampler(baseOptions({ readAppMemory })).snapshot()
    expect(snapshot.app).toEqual({ bytes: 900 * 1024 * 1024, scope: 'app' })
  })

  it('keeps reporting the gateway figure when the application memory is unavailable', async () => {
    const readAppMemory = async () => { throw new Error('not supported on this platform') }
    const snapshot = await createResourceSampler(baseOptions({ readAppMemory })).snapshot()
    expect(snapshot.app.bytes).toBeGreaterThan(0)
    expect(snapshot.app.scope).toBe('gateway')
  })
})

describe('nvidia-smi output', () => {
  it('accepts the primary card and tolerates a driver that will not report utilisation', () => {
    expect(parseNvidiaSmi('NVIDIA GeForce RTX 2080, 7193, 8192, [N/A]\n').percent).toBe(null)
    expect(parseNvidiaSmi('NVIDIA GeForce RTX 2080, 7193, 8192, 24\n').memoryUsedBytes).toBe(7193 * 1024 * 1024)
  })

  it('returns nothing for output it cannot trust', () => {
    expect(parseNvidiaSmi('')).toBe(null)
    expect(parseNvidiaSmi('ERROR: no devices')).toBe(null)
    expect(parseNvidiaSmi(null)).toBe(null)
  })
})
