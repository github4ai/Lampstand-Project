export type CustomFontFamily = 'script' | 'print' | 'typewriter'
export type CustomSpacing = 'normal' | 'roomy' | 'open'

export type CustomSlideStyle = {
  family: CustomFontFamily
  bold: boolean
  italic: boolean
  align: 'left' | 'center'
  spacing: CustomSpacing
}

export const DEFAULT_CUSTOM_STYLE: CustomSlideStyle = { family: 'script', bold: false, italic: false, align: 'left', spacing: 'normal' }

const families: Record<CustomFontFamily, string> = {
  script: "Georgia,'Times New Roman',serif",
  print: "Inter,'Segoe UI',Arial,sans-serif",
  typewriter: "'Cascadia Mono',Consolas,'Courier New',monospace",
}

/** The room reads a line of text more easily when it breathes, so the spacing control is measured in line heights. */
const lineHeights: Record<CustomSpacing, number> = { normal: 1.55, roomy: 1.85, open: 2.2 }

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!))

const paragraphs = (value: string) => value.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean).map((part) => `<p>${escapeHtml(part).replace(/\n/g, '<br>')}</p>`).join('')

/**
 * A pasted portion keeps its own typography, which travels with the slide to both the preview and the
 * projector. Size stays with the studio's audience text control so one dial still governs readability.
 */
export function customSlideHtml(text: string, style: CustomSlideStyle = DEFAULT_CUSTOM_STYLE) {
  const rules = `.custom-slide p{margin:0;font-family:${families[style.family]};font-weight:${style.bold ? 700 : 400};font-style:${style.italic ? 'italic' : 'normal'};text-align:${style.align};line-height:${lineHeights[style.spacing]}}.custom-slide p+p{margin-top:.8em}.slide-content>.custom-slide{width:100%;max-width:none;display:grid;gap:0}.presentation-preview article>.custom-slide{width:100%;max-width:none}`
  return `<style>${rules}</style><div class="custom-slide">${paragraphs(text)}</div>`
}
