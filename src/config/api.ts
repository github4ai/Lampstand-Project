const DEFAULT_AIOS_API_URL = 'http://127.0.0.1:8766'

const configuredUrl =
  import.meta.env.VITE_AIOS_API_URL?.trim()

export const AIOS_API_BASE_URL = (
  configuredUrl || DEFAULT_AIOS_API_URL
).replace(/\/+$/, '')
