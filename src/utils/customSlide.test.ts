import { describe, expect, it } from 'vitest'
import { customSlideHtml, DEFAULT_CUSTOM_STYLE } from './customSlide'

describe('customSlideHtml', () => {
  it('keeps blank-line paragraphs and single-line breaks', () => {
    const html = customSlideHtml('Baptism service at 10.\n\nBook stand.\nTracts by the door.', DEFAULT_CUSTOM_STYLE)
    expect(html).toContain('<p>Baptism service at 10.</p>')
    expect(html).toContain('<p>Book stand.<br>Tracts by the door.</p>')
  })

  it('carries the chosen typeface, emphasis, alignment and spacing to the projector', () => {
    const html = customSlideHtml('Grace to you.', { family: 'print', bold: true, italic: true, align: 'center', spacing: 'open' })
    expect(html).toContain('font-family:Inter')
    expect(html).toContain('font-weight:700')
    expect(html).toContain('font-style:italic')
    expect(html).toContain('text-align:center')
    expect(html).toContain('line-height:2.2')
  })

  it('defaults to the reading serif the rest of the service already uses', () => {
    const html = customSlideHtml('One line.', DEFAULT_CUSTOM_STYLE)
    expect(html).toContain('font-family:Georgia')
    expect(html).toContain('font-weight:400')
    expect(html).toContain('text-align:left')
  })

  it('escapes markup pasted into the portion', () => {
    expect(customSlideHtml('<img src=x onerror=alert(1)>', DEFAULT_CUSTOM_STYLE)).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })
})
