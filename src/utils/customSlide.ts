export type CustomFontFamily = 'script' | 'print' | 'typewriter'
export type CustomSpacing = 'normal' | 'roomy' | 'open'
export type CustomAlign = 'left' | 'center' | 'justify'

/** A portion sets the alignment and the breathing room of the whole slide; every word carries its own face, size and weight. */
export type CustomSlideStyle = {
  align: CustomAlign
  spacing: CustomSpacing
}

export const DEFAULT_CUSTOM_STYLE: CustomSlideStyle = { align: 'left', spacing: 'normal' }

const families: Record<CustomFontFamily, string> = {
  script: "Georgia,'Times New Roman',serif",
  print: "Inter,'Segoe UI',Arial,sans-serif",
  typewriter: "'Cascadia Mono',Consolas,'Courier New',monospace",
}

/** The reading serif the rest of the service already uses - a written portion is not a different kind of text. */
const SLIDE_FAMILY = families.script

const roomAligns: Record<CustomAlign, string> = { left: 'left', center: 'center', justify: 'justify' }

/** The room reads a line of text more easily when it breathes, so the spacing control is measured in line heights. */
export const ROOM_LINE_HEIGHTS: Record<CustomSpacing, number> = { normal: 1.55, roomy: 1.85, open: 2.2 }

/** The typefaces the text window offers for selected words: the three faces this app draws with, plus the two plain faces every Windows room has. */
export const WORD_FONTS = [
  { label: 'Script', stack: families.script },
  { label: 'Print', stack: families.print },
  { label: 'Typewriter', stack: families.typewriter },
  { label: 'Book serif', stack: "'Times New Roman',Georgia,serif" },
  { label: 'Plain sans', stack: "Arial,'Segoe UI',sans-serif" },
]

/** A typeface from this computer keeps the slide's own serif behind it, so a show opened on another machine still reads. */
export const localFontStack = (family: string) => `"${family.replace(/["'\\]/g, '').trim()}", ${families.script}`

/** The marks a volunteer reaches for mid-meeting: light enough that the room reads them on either projection theme. */
export const HIGHLIGHT_COLORS = [
  { label: 'Yellow', value: '#ffe066' },
  { label: 'Green', value: '#b8f0a2' },
  { label: 'Blue', value: '#a9d8ff' },
  { label: 'Pink', value: '#ffb8d6' },
  { label: 'Orange', value: '#ffd6a5' },
  { label: 'Purple', value: '#dcc6ff' },
]

/**
 * A colour chosen for the words themselves has to read on a light slide and a dark one, so these sit in the
 * middle of their range: bright enough for a dark theme, deep enough for a light one. Anything else the
 * operator picks by hand is their own bargain with the theme, and "Slide colour" hands the words back.
 */
export const TEXT_COLORS = [
  { label: 'Flame', value: '#e05a4f' },
  { label: 'Amber', value: '#d9a13c' },
  { label: 'Leaf', value: '#5cb878' },
  { label: 'Sky', value: '#4fa8e8' },
  { label: 'Violet', value: '#a481f0' },
  { label: 'Rose', value: '#e0699f' },
]

/**
 * A colour can also come from the system picker, where nothing guarantees it is light, so the ink is
 * chosen from the colour's own brightness. The browser writes a highlight back as rgb(), and anything
 * it does not recognise falls back to the dark ink the slide already uses.
 */
export function legibleInk(color: string) {
  const rgb = color.match(/rgba?\(\s*([\d.]+)[^\d]+([\d.]+)[^\d]+([\d.]+)/i)
  let channels: number[] | null = rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null
  if (!channels) {
    const hex = color.trim().replace(/^#/, '').match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1]
    if (!hex) return '#171717'
    const short = hex.length === 3
    channels = [0, 1, 2].map((i) => Number.parseInt(short ? hex[i]! + hex[i]! : hex.slice(i * 2, i * 2 + 2), 16))
  }
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]! > 150 ? '#171717' : '#fffdf7'
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!))

/**
 * Words lifted out of a real document arrive with their entities already written - a non-breaking space from
 * Word is &nbsp;, and escaping its ampersand again would put the code itself on the screen for the room to read.
 */
const escapeText = (value: string) => value.replace(/&(?!#?\w+;)/g, '&amp;').replace(/[<>]/g, (character) => (character === '<' ? '&lt;' : '&gt;'))

const paragraphs = (value: string) => value.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean).map((part) => `<p>${escapeHtml(part).replace(/\n/g, '<br>')}</p>`).join('')

/**
 * The text window hands its markup straight to the projector window, where it is written into a page
 * with no framework between, so anything that is not on this list never reaches the audience screen.
 */
const ALLOWED_TAGS = new Set(['p', 'br', 'div', 'span', 'b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'sub', 'sup', 'h1', 'h2', 'h3', 'h4', 'mark', 'ul', 'ol', 'li', 'blockquote'])
/** Kept for their words but never for their own layout: a pasted div is simply a line of the portion. */
const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'li', 'blockquote'])
const LISTS = new Set(['ul', 'ol'])
/** Their text is dropped too - a script or a style sheet has nothing a projected portion should say. */
const DROPPED = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'noscript', 'template', 'svg', 'math', 'head'])
const ALLOWED_STYLE = new Set(['font-family', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line', 'text-align', 'color', 'background-color', 'font-size'])

/** A declaration survives only as a plain value: no references to files, no functions, no markup. */
function safeStyle(raw: string) {
  /** A quoted typeface arrives as an entity, and &quot; ends in a semicolon - decode first or the split below cuts the name in half. */
  const text = raw.replace(/&quot;|&#34;/gi, '"').replace(/&apos;|&#39;/gi, "'")
  if (/[<>]|url\(|expression|javascript:/i.test(text)) return ''
  const kept = text.split(';').map((declaration) => declaration.trim()).filter((declaration) => {
    const property = declaration.split(':')[0]?.trim().toLowerCase()
    return Boolean(property) && ALLOWED_STYLE.has(property!)
  })
  return kept.length ? kept.join('; ') : ''
}

function safeAttributes(raw: string) {
  const pairs: string[] = []
  const attribute = /([A-Za-z-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g
  for (const match of raw.matchAll(attribute)) {
    const name = match[1].toLowerCase()
    const value = match[2] ?? match[3] ?? match[4] ?? ''
    if (name === 'style') {
      const style = safeStyle(value)
      if (style) pairs.push(`style="${style.replaceAll('"', '')}"`)
    } else if (name === 'start' && /^\d+$/.test(value)) pairs.push(`start="${value}"`)
  }
  return pairs.length ? ` ${pairs.join(' ')}` : ''
}

/** The browser counts a legacy size 1 to 7, and 3 is the size the page already reads at. */
const LEGACY_SIZES = ['', 'x-small', 'small', 'medium', 'large', 'x-large', 'xx-large', 'xxx-large']

/** Older documents write their typeface, size and colour as <font> attributes rather than style, so they become a span. */
function legacyFontStyle(raw: string) {
  const declarations: string[] = []
  for (const match of raw.matchAll(/\b(face|size|color)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi)) {
    const value = (match[2] ?? match[3] ?? match[4] ?? '').trim().replaceAll('"', '')
    if (!value || /[<>]|url\(|javascript:/i.test(value)) continue
    const name = match[1].toLowerCase()
    if (name === 'size' && /^\d$/.test(value)) declarations.push(`font-size:${LEGACY_SIZES[Number(value)]}`)
    else if (name === 'face') declarations.push(`font-family:${value}`)
    else if (name === 'color' && /^(#[0-9a-f]{3,8}|[a-z]+)$/i.test(value)) declarations.push(`color:${value}`)
  }
  return declarations.length ? ` style="${declarations.join(';')}"` : ''
}

/**
 * A hand-written allowlist pass rather than DOM parsing, so the rule that guards the projector is the
 * same rule the tests run against. Any tag that is not allowed is removed and its words are kept, and
 * any text left over is escaped, so nothing that arrives can be read as markup.
 */
export function sanitizeRichText(source: string): string {
  const out: string[] = []
  const dropped: string[] = []
  let blockDepth = 0
  let openParagraph = false
  const closeParagraph = () => { if (openParagraph) { out.push('</p>'); openParagraph = false } }
  const startParagraph = () => { if (!blockDepth && !openParagraph) { out.push('<p>'); openParagraph = true } }
  const tokens = /<(\/?)([A-Za-z][A-Za-z0-9]*)((?:"[^"]*"|'[^']*'|[^>"])*)>|([^<]+)/g
  const withoutComments = source.replace(/<!--[\s\S]*?(?:-->|$)/g, '')

  for (const match of withoutComments.matchAll(tokens)) {
    if (match[4] !== undefined) {
      if (dropped.length) continue
      startParagraph()
      out.push(escapeText(match[4]))
      continue
    }
    const name = match[2].toLowerCase()
    if (DROPPED.has(name)) {
      if (match[1]) { if (dropped[dropped.length - 1] === name) dropped.pop() } else dropped.push(name)
      continue
    }
    if (dropped.length) continue
    /** A legacy font tag writes its face, size or colour as attributes, so they become a span the projector honours. */
    if (name === 'font') {
      if (match[1]) { out.push('</span>'); continue }
      startParagraph()
      out.push(`<span${legacyFontStyle(match[3] || '')}>`)
      continue
    }
    if (!ALLOWED_TAGS.has(name)) continue
    /** A div, a paragraph, a heading, a list item or a list all begin a line of their own, so nothing loose can sit inside them. */
    const isBlock = BLOCK_TAGS.has(name) || LISTS.has(name) || name === 'div'
    if (match[1]) {
      if (!isBlock) { out.push(`</${name}>`); continue }
      blockDepth = Math.max(0, blockDepth - 1)
      closeParagraph()
      out.push(name === 'div' ? '</p>' : `</${name}>`)
      continue
    }
    if (isBlock) {
      closeParagraph()
      blockDepth += 1
      out.push(name === 'div' ? '<p>' : `<${name}${safeAttributes(match[3] || '')}>`)
      continue
    }
    startParagraph()
    out.push(name === 'br' ? '<br>' : `<${name}${safeAttributes(match[3] || '')}>`)
  }
  closeParagraph()
  return out.join('')
}

/** One block of a formatted window, with the alignment the operator gave that line. */
export type RichItem = { body: string; align?: CustomAlign; tag?: string }

/**
 * A portion typed in the formatting window is a stack of lines, and a slide that lays its own markers -
 * an announcement list, a numbered order of service - needs those lines separately. Each block is read
 * back with the words inside it and the alignment written on it, since the marker belongs to the slide
 * while the line belongs to the operator.
 */
export function richItems(source: string): RichItem[] {
  const html = /<[A-Za-z/]/.test(source) ? sanitizeRichText(source) : paragraphs(source)
  const items: RichItem[] = []
  for (const match of html.matchAll(/<(p|li|h[1-4]|blockquote)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
    const align = match[2]?.match(/text-align:\s*(left|center|justify)/)?.[1] as CustomAlign | undefined
    // A heading or a quotation is one line by nature; a break inside a plain line is the next item, however the operator typed it.
    const tag = match[1] === 'p' || match[1] === 'li' ? undefined : match[1]
    for (const part of tag ? [match[3]!] : match[3]!.split(/<br\s*\/?>/i)) {
      const body = part.trim()
      if (body) items.push({ body: tag ? `<${tag}>${body}</${tag}>` : body, ...(align ? { align } : {}) })
    }
  }
  return items
}

/**
 * One source of typography, read by the text window and by the projector alike, so what the operator
 * formats is what the room sees. The slide carries its alignment and spacing; the words themselves
 * bring their own face, size and weight from the text window.
 */
export function customSlideRules(style: CustomSlideStyle) {
  const align = `text-align:${roomAligns[style.align]}`
  const lineHeight = `line-height:${ROOM_LINE_HEIGHTS[style.spacing]}`
  return [
    `.custom-slide p,.custom-slide li{margin:0;font-family:${SLIDE_FAMILY};font-weight:400;font-style:normal;${align};${lineHeight}}`,
    `.custom-slide p+p,.custom-slide h1+p,.custom-slide h2+p,.custom-slide h3+p,.custom-slide h4+p,.custom-slide ul+p,.custom-slide ol+p{margin-top:.8em}`,
    `.custom-slide h1,.custom-slide h2,.custom-slide h3,.custom-slide h4{margin:0;font-family:${SLIDE_FAMILY};font-weight:700;${align};line-height:1.2}`,
    '.custom-slide h1{font-size:1.7em}.custom-slide h2{font-size:1.45em}.custom-slide h3{font-size:1.22em}.custom-slide h4{font-size:1.08em}',
    `.custom-slide ul,.custom-slide ol{margin:0;padding-left:1.35em;${align}}`,
    '.custom-slide li+li{margin-top:.28em}',
    '.custom-slide blockquote{margin:.8em 0 0;padding-left:.9em;border-left:.16em solid #9dd7ee;font-style:italic}',
    '.custom-slide mark{background:#ffe066;color:#171717;padding:0 .08em;border-radius:3px}',
    // Highlighted words take the dark ink, or a light theme would put them on yellow the room cannot read; a chosen dark mark brings its own light ink, and taking the colour off leaves the slide's own.
    '.custom-slide [style*="background-color"]:not([style*="transparent"]){color:#171717}',
    '.slide-content>.custom-slide{width:100%;max-width:none;display:grid;gap:0}',
    '.presentation-preview article>.custom-slide{width:100%;max-width:none}',
  ].join('')
}

/**
 * A pasted portion keeps its own typography, which travels with the slide to both the preview and the
 * projector. Plain text still means blank-line paragraphs, so a typed or imported portion is unchanged.
 */
export function customSlideHtml(source: string, style: CustomSlideStyle = DEFAULT_CUSTOM_STYLE) {
  const body = /<[A-Za-z/]/.test(source) ? sanitizeRichText(source) : paragraphs(source)
  return `<style>${customSlideRules(style)}</style><div class="custom-slide">${body}</div>`
}
