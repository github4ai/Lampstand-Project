import { richItems, ROOM_LINE_HEIGHTS, type CustomSpacing } from './customSlide'

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!))

/** `source` is the markup the formatting window holds, one block per announcement. */
export type AnnouncementSlide = { heading: string; source: string; footer?: string; numbered?: boolean; spacing?: CustomSpacing }

/**
 * The marker comes from the slide, since the list is how the notices are read from the stage; the words keep
 * whatever face, size, colour or alignment the operator gave them in the window.
 */
const rules = (spacing: CustomSpacing) => [
  `.announcement-slide{display:grid;gap:1em;justify-items:center}`,
  `.announcement-slide .announcement-heading{margin:0;color:#245fc7;font:italic 400 1.25em/1.3 Georgia,'Times New Roman',serif;text-align:center}`,
  `.announcement-slide ol,.announcement-slide ul{margin:0;padding-left:1.5em;display:grid;gap:.65em;justify-items:start;width:100%;max-width:32em}`,
  `.announcement-slide li{line-height:${ROOM_LINE_HEIGHTS[spacing]};text-align:left}`,
  `.announcement-slide li h2{margin:0;font-size:1.15em}`,
  `.announcement-slide .announcement-footer{margin:0;padding-top:.8em;border-top:.06em solid #1919192b;width:100%;max-width:32em;color:#4a5a6a;font:italic 400 .82em/1.5 Georgia,'Times New Roman',serif;text-align:center}`,
  '.audience-dark .announcement-slide .announcement-heading{color:#83dcfa}',
  '.audience-dark .announcement-slide .announcement-footer{color:#9fb6cc;border-top-color:#ffffff2b}',
].join('')

/** Announcements are read from the stage, so each item stands on its own rather than forming a paragraph. */
export function announcementSlideHtml({ heading, source, footer, numbered = true, spacing = 'normal' }: AnnouncementSlide) {
  const items = richItems(source).map(({ body, align }) => `<li${align ? ` style="text-align:${align}"` : ''}>${body}</li>`).join('')
  const list = items ? (numbered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`) : ''
  const closing = footer?.trim() ? `<p class="announcement-footer">${escapeHtml(footer.trim())}</p>` : ''
  return `<style>${rules(spacing)}</style><div class="announcement-slide"><h2 class="announcement-heading">${escapeHtml(heading.trim() || 'Announcements')}</h2>${list}${closing}</div>`
}
