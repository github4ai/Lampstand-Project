export type WebSourceKind = 'maps' | 'youtube' | 'meet' | 'zoom' | 'web'
export type WebShortcut = { id: string; label: string; url: string; kind: WebSourceKind }

/** Adds a scheme when the operator typed a bare address, and refuses anything that is not a web page. */
export function normalizeWebUrl(input: string) {
  const value = String(input || '').trim()
  if (!value) return ''
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`
  try {
    const parsed = new URL(candidate)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : ''
  } catch { return '' }
}

export function detectWebSource(url: string): WebSourceKind {
  let host = ''
  try { host = new URL(url).hostname.replace(/^www\./, '').toLowerCase() } catch { return 'web' }
  if (host.endsWith('google.com') && new URL(url).pathname.startsWith('/maps')) return 'maps'
  if (host === 'maps.google.com' || host === 'google.com/maps') return 'maps'
  if (host.endsWith('youtube.com') || host.endsWith('youtu.be')) return 'youtube'
  if (host.endsWith('meet.google.com')) return 'meet'
  if (host.endsWith('zoom.us')) return 'zoom'
  return 'web'
}

export const webSourceLabel: Record<WebSourceKind, string> = {
  maps: 'Google Maps',
  youtube: 'YouTube',
  meet: 'Google Meet',
  zoom: 'Zoom',
  web: 'Web page',
}

/** A bare address becomes a Maps search with the zoom and basemap the studio controls are showing. */
export function mapsUrl(query: string, options: { zoom?: number; basemap?: 'roadmap' | 'satellite' | 'hybrid' | 'terrain' } = {}) {
  const search = String(query || '').trim()
  if (!search) return ''
  const basemap = { roadmap: 'm', satellite: 'k', hybrid: 'h', terrain: 'p' }[options.basemap || 'roadmap']
  const requested = Number(options.zoom)
  const zoom = Math.min(21, Math.max(2, Math.round(Number.isFinite(requested) ? requested : 14)))
  return `https://maps.google.com/maps?q=${encodeURIComponent(search)}&z=${zoom}&t=${basemap}`
}

const youtubeVideoId = (url: URL) =>
  url.hostname.replace(/^www\./, '') === 'youtu.be' ? url.pathname.slice(1).split('/')[0]
    : /^\/embed\/([^/?#]+)/.test(url.pathname) ? /\/embed\/([^/?#]+)/.exec(url.pathname)?.[1]
      : /^\/shorts\/([^/?#]+)/.test(url.pathname) ? /\/shorts\/([^/?#]+)/.exec(url.pathname)?.[1]
        : url.searchParams.get('v') || ''

/** A regular video is projected as the clean player; a live page is loaded as it is so the stream keeps its own controls. */
export function youtubeProjectionUrl(input: string) {
  const value = normalizeWebUrl(input)
  if (!value) return ''
  const url = new URL(value)
  if (detectWebSource(value) !== 'youtube') return value
  if (/\/(live|streaming)\b/i.test(url.pathname) || url.searchParams.get('live') === 'true') return value
  const id = youtubeVideoId(url)
  if (!id) return value
  return `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`
}

/** What the audience window should load for whatever the operator typed or picked. */
export function webProjectionUrl(input: string) {
  const value = normalizeWebUrl(input)
  if (!value) return ''
  return detectWebSource(value) === 'youtube' ? youtubeProjectionUrl(value) : value
}
