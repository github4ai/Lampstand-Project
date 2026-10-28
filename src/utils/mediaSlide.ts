import { AIOS_API_BASE_URL } from '../config/api'

export type MediaSlideSource = {
  kind: 'image' | 'video' | 'audio' | 'document' | 'deck'
  /** A path inside the media library; the audience window is a separate document, so it needs the gateway URL. For a deck this is the source file, and pages holds the slide paths. */
  name: string
  title: string
  caption?: string
  fit?: 'contain' | 'cover'
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
  page?: number
  /** A converted PowerPoint deck: the library path of every slide, in order. */
  pages?: string[]
  /** Enlargement of the frame on the stage: 1 shows it as it fits, 2 shows it twice as big. */
  zoom?: number
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!))

export const mediaFileUrl = (name: string) => `${AIOS_API_BASE_URL}/presentation-media/file?name=${encodeURIComponent(name)}`

export const MIN_ZOOM = 1
export const MAX_ZOOM = 4
/** The frame fits at 1, so zooming only ever enlarges it and the stage clips what falls past the edge. */
export const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((Number(value) || MIN_ZOOM) * 100) / 100))
const zoomStyle = (source: MediaSlideSource) => {
  const zoom = clampZoom(Number(source.zoom) || MIN_ZOOM)
  return zoom > MIN_ZOOM ? ` style="--media-zoom:${zoom}"` : ''
}

const rules = `.media-slide{display:grid;gap:.7em;justify-items:center}.slide-content>.media-slide,.presentation-preview article>.media-slide{width:100%;max-width:none}.media-slide figure{margin:0;width:100%;transform:scale(var(--media-zoom,1));transform-origin:center}.media-slide img,.media-slide video{display:block;width:100%;height:auto;max-height:var(--media-max,66vh);margin:0 auto;background:#0000}.media-slide.fit-cover img,.media-slide.fit-cover video{height:var(--media-max,66vh);object-fit:cover}.media-slide figcaption{margin-top:.5em;color:#4a5a6a;font:italic 400 .8em/1.45 Georgia,'Times New Roman',serif;text-align:center}.media-slide .media-audio{display:grid;gap:.6em;justify-items:center;padding:2.2em 1.4em;border:1px solid #b9c2cc;border-radius:.4em;background:#1919190a}.media-slide .media-audio strong{font:.7em/1.3 Inter,'Segoe UI',sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#245fc7}.media-slide .media-audio audio{width:min(100%,28em)}.audience-dark .media-slide figcaption{color:#9fb6cc}.audience-dark .media-slide .media-audio{border-color:#3a516c;background:#ffffff0f}.audience-dark .media-slide .media-audio strong{color:#83dcfa}`

/**
 * A deck slide or a PDF page owns the whole 16:9 stage: no heading, no padding. Both renderer
 * families are named because the studio preview uses article/header while the projector uses slide-content/slide-header.
 */
const fullBleedRules = (stage: string) => `body{background:#000}main{grid-template-rows:minmax(0,1fr)}.slide-header{display:none}.slide-content{padding:0;overflow:hidden;align-content:stretch;justify-items:stretch}.slide-content>*{width:100%;max-width:none;height:100%}.presentation-preview>div{grid-template-rows:minmax(0,1fr)}.presentation-preview header{display:none}.presentation-preview article{padding:0;overflow:hidden;align-content:stretch;justify-items:stretch}.presentation-preview article>*{width:100%;max-width:none;height:100%}.${stage}{position:relative;overflow:hidden;width:100%;height:100%;background:#000}.${stage} img,.${stage} iframe{display:block;width:100%;height:100%;border:0;transform:scale(var(--media-zoom,1));transform-origin:center}`

/** The page a deck slide is about to show, after the console arrows have moved it. */
export const deckSlidePath = (source: MediaSlideSource) => {
  const pages = source.pages || []
  const index = Math.min(pages.length - 1, Math.max(0, (Number(source.page) || 1) - 1))
  return pages[index] || pages[0] || source.name
}

/** One builder for every media kind so the projected page keeps a single, predictable frame. */
export function mediaSlideHtml(source: MediaSlideSource) {
  if (source.kind === 'deck') {
    const total = (source.pages || []).length
    const number = Math.min(total, Math.max(1, Number(source.page) || 1))
    const alt = escapeHtml(total ? `${source.title} - slide ${number} of ${total}` : source.title)
    return `<style>${fullBleedRules('deck-stage')}</style><div class="deck-stage"${zoomStyle(source)}><img src="${mediaFileUrl(deckSlidePath(source))}" alt="${alt}"></div>`
  }
  if (source.kind === 'document') {
    const page = Math.max(1, Number(source.page) || 1)
    // Fit shows the entire page; fitting the width of a portrait page to a wide screen would run it off the bottom.
    return `<style>${fullBleedRules('doc-stage')}</style><div class="doc-stage"${zoomStyle(source)}><iframe src="${mediaFileUrl(source.name)}#page=${page}&toolbar=0&statusbar=0&navpanes=0&view=Fit" title="${escapeHtml(source.title)}"></iframe></div>`
  }
  const url = mediaFileUrl(source.name)
  const fit = source.fit === 'cover' ? ' fit-cover' : ''
  const caption = source.caption?.trim() ? `<figcaption>${escapeHtml(source.caption.trim())}</figcaption>` : ''
  const body = source.kind === 'image'
    ? `<figure><img src="${url}" alt="${escapeHtml(source.title)}"${source.fit === 'cover' ? '' : ' loading="lazy"'}>${caption}</figure>`
    : source.kind === 'video'
      ? `<figure><video src="${url}"${source.autoplay ? ' autoplay' : ''}${source.loop ? ' loop' : ''}${source.muted ? ' muted playsinline' : ''} preload="metadata"></video>${caption}</figure>`
      : source.kind === 'audio'
        ? `<div class="media-audio"><strong>${escapeHtml(source.title)}</strong><audio src="${url}"${source.autoplay ? ' autoplay' : ''}${source.loop ? ' loop' : ''} preload="metadata"></audio>${caption}</div>`
        : ''
  return `<style>${rules}</style><div class="media-slide${fit}"${zoomStyle(source)}>${body}</div>`
}
