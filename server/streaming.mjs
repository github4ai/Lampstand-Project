import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

async function containPipeline(source, response) {
  try {
    await pipeline(source, response)
    return true
  } catch {
    if (!response.destroyed) response.destroy()
    return false
  }
}

export function pipeWebStream(body, response) {
  const source = Readable.fromWeb(body)
  // Keep a permanent listener in addition to pipeline's temporary listeners.
  // Some aborted web streams emit a second, late error after pipeline settles.
  source.on('error', () => {})
  return containPipeline(source, response)
}

export function pipeNodeStream(source, response) {
  source.on('error', () => {})
  return containPipeline(source, response)
}
