import { AIOS_API_BASE_URL } from '../config/api'

export type MediaSlideSource = {
  kind: 'image' | 'video' | 'audio' | 'document'
  /** A path inside the media library; the audience window is a separate document, so it needs the gateway URL. */
  name: string
  title: string
  caption?: string
  fit?: 'contain' | 'cover'
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
  page?: number
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!))

export const mediaFileUrl = (name: string) => `${AIOS_API_BASE_URL}/presentation-media/file?name=${encodeURIComponent(name)}`

const rules = `.media-slide{display:grid;gap:.7em;justify-items:center}.slide-content>.media-slide,.presentation-preview article>.media-slide{width:100%;max-width:none}.media-slide figure{margin:0;width:100%}.media-slide img,.media-slide video{display:block;width:100%;height:auto;max-height:var(--media-max,66vh);margin:0 auto;background:#0000}.media-slide.fit-cover img,.media-slide.fit-cover video{height:var(--media-max,66vh);object-fit:cover}.media-slide figcaption{margin-top:.5em;color:#4a5a6a;font:italic 400 .8em/1.45 Georgia,'Times New Roman',serif;text-align:center}.media-slide .media-frame{display:block;width:100%;height:var(--media-max,70vh);margin:0;border:1px solid #b9c2cc;border-radius:.25em;background:#fff}.media-slide .media-audio{display:grid;gap:.6em;justify-items:center;padding:2.2em 1.4em;border:1px solid #b9c2cc;border-radius:.4em;background:#1919190a}.media-slide .media-audio strong{font:.7em/1.3 Inter,'Segoe UI',sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#245fc7}.media-slide .media-audio audio{width:min(100%,28em)}.audience-dark .media-slide figcaption{color:#9fb6cc}.audience-dark .media-slide .media-frame{border-color:#3a516c}.audience-dark .media-slide .media-audio{border-color:#3a516c;background:#ffffff0f}.audience-dark .media-slide .media-audio strong{color:#83dcfa}`

/** One builder for every media kind so the projected page keeps a single, predictable frame. */
export function mediaSlideHtml(source: MediaSlideSource) {
  const url = mediaFileUrl(source.name)
  const fit = source.fit === 'cover' ? ' fit-cover' : ''
  const caption = source.caption?.trim() ? `<figcaption>${escapeHtml(source.caption.trim())}</figcaption>` : ''
  const body = source.kind === 'image'
    ? `<figure><img src="${url}" alt="${escapeHtml(source.title)}"${source.fit === 'cover' ? '' : ' loading="lazy"'}>${caption}</figure>`
    : source.kind === 'video'
      ? `<figure><video src="${url}"${source.autoplay ? ' autoplay' : ''}${source.loop ? ' loop' : ''}${source.muted ? ' muted playsinline' : ''} preload="metadata"></video>${caption}</figure>`
      : source.kind === 'audio'
        ? `<div class="media-audio"><strong>${escapeHtml(source.title)}</strong><audio src="${url}"${source.autoplay ? ' autoplay' : ''}${source.loop ? ' loop' : ''} preload="metadata"></audio>${caption}</div>`
        : `<iframe class="media-frame" src="${url}#page=${Math.max(1, Number(source.page) || 1)}&toolbar=0&statusbar=0&view=FitH" title="${escapeHtml(source.title)}"></iframe>`
  return `<style>${rules}</style><div class="media-slide${fit}">${body}</div>`
}
