/**
 * A fetch rejected because the caller aborted it is a cancelled load, not a
 * failed one: its signal is already aborted when the rejection arrives.
 */
export function isAborted(signal: AbortSignal | undefined, error: unknown): boolean {
  return Boolean(signal?.aborted) || (
    error instanceof DOMException && error.name === 'AbortError'
  )
}
