const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!))

export type AnnouncementSlide = { heading: string; lines: string[]; footer?: string; numbered?: boolean }

const rules = `.announcement-slide{display:grid;gap:1em;justify-items:center}.announcement-slide .announcement-heading{margin:0;color:#245fc7;font:italic 400 1.25em/1.3 Georgia,'Times New Roman',serif;text-align:center}.announcement-slide ol,.announcement-slide ul{margin:0;padding-left:1.5em;display:grid;gap:.65em;justify-items:start;width:100%;max-width:32em}.announcement-slide li{line-height:1.45;text-align:left}.announcement-slide .announcement-footer{margin:0;padding-top:.8em;border-top:.06em solid #1919192b;width:100%;max-width:32em;color:#4a5a6a;font:italic 400 .82em/1.5 Georgia,'Times New Roman',serif;text-align:center}.audience-dark .announcement-slide .announcement-heading{color:#83dcfa}.audience-dark .announcement-slide .announcement-footer{color:#9fb6cc;border-top-color:#ffffff2b}`

/** Announcements are read from the stage, so each line stands on its own rather than forming a paragraph. */
export function announcementSlideHtml({ heading, lines, footer, numbered = true }: AnnouncementSlide) {
  const items = lines.map((line) => line.trim()).filter(Boolean).map((line) => `<li>${escapeHtml(line)}</li>`).join('')
  const list = items ? (numbered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`) : ''
  const closing = footer?.trim() ? `<p class="announcement-footer">${escapeHtml(footer.trim())}</p>` : ''
  return `<style>${rules}</style><div class="announcement-slide"><h2 class="announcement-heading">${escapeHtml(heading.trim() || 'Announcements')}</h2>${list}${closing}</div>`
}
