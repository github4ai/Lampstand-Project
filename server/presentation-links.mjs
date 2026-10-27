const fail = (status, detail) => Object.assign(new Error(detail), { status })

/** Reads the video and playlist identifiers out of the YouTube address shapes people actually paste. */
export function describeYouTubeUrl(url) {
  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  const search = url.searchParams.get('v') || ''
  const short = host === 'youtu.be' ? url.pathname.slice(1).split('/')[0] : ''
  const pathVideo = /^\/(embed|shorts|live|v)\/([^/?#]+)/.exec(url.pathname)?.[2] || ''
  const videoId = /^[A-Za-z0-9_-]{11}$/.test(search) ? search : ''
  const altId = /^[A-Za-z0-9_-]{11}$/.test(short) ? short : ''
  const embedId = /^[A-Za-z0-9_-]{11}$/.test(pathVideo) ? pathVideo : ''
  const playlistParam = url.searchParams.get('list') || ''
  const playlistId = /^[A-Za-z0-9_-]{13,34}$/.test(playlistParam) ? playlistParam : ''
  const id = videoId || altId || embedId
  if (id && playlistId) return { kind: 'youtube-video', videoId: id, playlistId }
  if (id) return { kind: 'youtube-video', videoId: id }
  if (host === 'youtube.com' && playlistId) return { kind: 'youtube-playlist', playlistId }
  return { kind: 'youtube-channel' }
}

export function classifyWebLink(rawUrl) {
  let url
  try { url = new URL(String(rawUrl || '').trim()) } catch { throw fail(400, 'Enter a full web address starting with http or https.') }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw fail(400, 'Only web addresses can be projected.')
  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  if (host === 'youtube.com' || host === 'youtu.be' || host === 'm.youtube.com') return { url, host, ...describeYouTubeUrl(url) }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') return { url, host, kind: 'vimeo' }
  return { url, host, kind: 'page' }
}

/**
 * Only the two providers with a public oEmbed endpoint are ever contacted, so the gateway never
 * fetches an address the operator types. Everything else is described from the address itself.
 */
export async function describeWebLink(rawUrl) {
  const { url, host, kind, videoId, playlistId } = classifyWebLink(rawUrl)
  const base = { url: url.toString(), host, kind }
  if (kind === 'youtube-playlist') {
    return { ...base, title: 'YouTube playlist', thumbnail: '', watchUrl: `https://www.youtube.com/playlist?list=${playlistId}` }
  }
  if (kind === 'youtube-channel') {
    return { ...base, title: host, thumbnail: '' }
  }
  if (kind !== 'youtube-video' && kind !== 'vimeo') return { ...base, title: host, thumbnail: '' }
  const endpoint = kind === 'vimeo' ? 'https://vimeo.com/api/oembed.json' : 'https://www.youtube.com/oembed'
  let payload = null
  try {
    const response = await fetch(`${endpoint}?format=json&url=${encodeURIComponent(url.toString())}`, {
      headers: { 'User-Agent': 'Lampstand-Project/1.0' },
      signal: AbortSignal.timeout(6000),
    })
    if (response.ok) payload = await response.json()
  } catch { payload = null }
  const title = typeof payload?.title === 'string' && payload.title.trim() ? payload.title.trim().slice(0, 180) : kind === 'vimeo' ? host : 'YouTube video'
  const thumbnail = typeof payload?.thumbnail_url === 'string' ? payload.thumbnail_url : (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '')
  return {
    ...base,
    title,
    author: typeof payload?.author_name === 'string' ? payload.author_name.slice(0, 120) : '',
    thumbnail,
    videoId: videoId || '',
    playlistId: playlistId || '',
    watchUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}${playlistId ? `&list=${playlistId}` : ''}` : url.toString(),
  }
}
