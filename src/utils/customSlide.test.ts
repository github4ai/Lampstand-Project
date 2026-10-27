import { describe, expect, it } from 'vitest'
import { customSlideHtml, DEFAULT_CUSTOM_STYLE, legibleInk, localFontStack, richItems, sanitizeRichText, TEXT_COLORS } from './customSlide'

describe('customSlideHtml', () => {
  it('keeps blank-line paragraphs and single-line breaks', () => {
    const html = customSlideHtml('Baptism service at 10.\n\nBook stand.\nTracts by the door.', DEFAULT_CUSTOM_STYLE)
    expect(html).toContain('<p>Baptism service at 10.</p>')
    expect(html).toContain('<p>Book stand.<br>Tracts by the door.</p>')
  })

  it('carries the chosen alignment and spacing to the projector', () => {
    const html = customSlideHtml('Grace to you.', { align: 'justify', spacing: 'open' })
    expect(html).toContain('text-align:justify')
    expect(html).toContain('line-height:2.2')
  })

  it('reads in the serif the rest of the service already uses, at its own weight', () => {
    const html = customSlideHtml('One line.', DEFAULT_CUSTOM_STYLE)
    expect(html).toContain('font-family:Georgia')
    expect(html).toContain('font-weight:400')
    expect(html).toContain('text-align:left')
    expect(html).toContain('.custom-slide h1,.custom-slide h2,.custom-slide h3,.custom-slide h4{margin:0;font-family:Georgia')
    expect(html).toContain('font-weight:700')
  })

  it('keeps the typeface and size given to single words', () => {
    const html = customSlideHtml('<p>Take <span style="font-family:Arial,sans-serif;font-size:1.5em">this</span> verse.</p>', DEFAULT_CUSTOM_STYLE)
    expect(html).toContain('<span style="font-family:Arial,sans-serif; font-size:1.5em">this</span>')
  })

  it('keeps formatted text and wraps it in the slide rules', () => {
    const html = customSlideHtml('<p><b>Book</b> stand.</p>', DEFAULT_CUSTOM_STYLE)
    expect(html).toContain('<style>')
    expect(html).toContain('<div class="custom-slide"><p><b>Book</b> stand.</p></div>')
  })

  it('leaves a lone angle bracket as the words it is', () => {
    expect(customSlideHtml('Less than 5 < 10.', DEFAULT_CUSTOM_STYLE)).toContain('<p>Less than 5 &lt; 10.</p>')
  })
})

describe('sanitizeRichText', () => {
  it('keeps the words of a pasted document and its own line breaks', () => {
    expect(sanitizeRichText('<div class="MsoNormal"><b>Bold</b> lead</div>')).toBe('<p><b>Bold</b> lead</p>')
    expect(sanitizeRichText('<div>Book stand.</div><div>Tracts by the door.</div>')).toBe('<p>Book stand.</p><p>Tracts by the door.</p>')
    expect(sanitizeRichText('Book stand.')).toBe('<p>Book stand.</p>')
  })

  it('keeps the lists and headings a formatted portion carries', () => {
    expect(sanitizeRichText('<ul><li>Tracts</li><li>Books</li></ul>')).toBe('<ul><li>Tracts</li><li>Books</li></ul>')
    expect(sanitizeRichText('<ol start="3"><li>Third</li></ol>')).toBe('<ol start="3"><li>Third</li></ol>')
    expect(sanitizeRichText('<h2>Welcome</h2>')).toBe('<h2>Welcome</h2>')
  })

  it('turns a legacy font tag into the style a projection honours', () => {
    expect(sanitizeRichText('<font face="Arial" size="5">Large</font>')).toBe('<p><span style="font-family:Arial;font-size:x-large">Large</span></p>')
    expect(sanitizeRichText('<font color="#ff0000">Red</font>')).toBe('<p><span style="color:#ff0000">Red</span></p>')
  })

  it('keeps a quoted typeface whole when a pasted document writes it as an entity', () => {
    expect(sanitizeRichText('<span style="font-size:12.0pt;font-family:&quot;Segoe UI&quot;">Door</span>')).toBe('<p><span style="font-size:12.0pt; font-family:Segoe UI">Door</span></p>')
  })

  it('never lets a script reach the projector, not even its words', () => {
    expect(sanitizeRichText('<script>alert(1)</script><p>Hi</p>')).toBe('<p>Hi</p>')
    expect(sanitizeRichText('<img src=x onerror=alert(1)>')).toBe('')
    expect(sanitizeRichText('<a href="javascript:alert(1)" onclick="steal()">Click</a>')).toBe('<p>Click</p>')
    expect(sanitizeRichText('<!-- <p>hidden</p> -->')).toBe('')
    expect(sanitizeRichText('<font face="<script>">x</font>')).toBe('<p><span>x</span></p>')
  })

  it('keeps only the style declarations a projection can honour', () => {
    expect(sanitizeRichText('<span style="color:#ff0000;font-family:Georgia,serif">Red</span>')).toBe('<p><span style="color:#ff0000; font-family:Georgia,serif">Red</span></p>')
    expect(sanitizeRichText('<span style="letter-spacing:2px">Wide</span>')).toBe('<p><span>Wide</span></p>')
    expect(sanitizeRichText('<p style="background:url(javascript:1)">x</p>')).toBe('<p>x</p>')
  })

  it('escapes words that arrive as text', () => {
    expect(sanitizeRichText('5 > 2 & falling')).toBe('<p>5 &gt; 2 &amp; falling</p>')
  })

  it('leaves the entities a real document writes for itself alone', () => {
    expect(sanitizeRichText('<p>Brother&nbsp;Love</p>')).toBe('<p>Brother&nbsp;Love</p>')
    expect(sanitizeRichText('<p>Tom &amp; Jerry</p>')).toBe('<p>Tom &amp; Jerry</p>')
  })
})

describe('the lines a formatted window hands to a slide that lays its own markers', () => {
  it('reads one item per line and keeps the shape of each', () => {
    expect(richItems('<p>Tracts</p><p>Books</p>')).toEqual([{ body: 'Tracts' }, { body: 'Books' }])
    expect(richItems('<ul><li>Tracts</li><li>Books</li></ul>')).toEqual([{ body: 'Tracts' }, { body: 'Books' }])
    expect(richItems('<h2>Opening prayer</h2>')).toEqual([{ body: '<h2>Opening prayer</h2>' }])
  })

  it('keeps the alignment written on the line but leaves the marker to the slide', () => {
    expect(richItems('<p style="text-align:center">Lunch after the meeting</p>')).toEqual([{ body: 'Lunch after the meeting', align: 'center' }])
  })

  it('drops an empty line and a smuggled script rather than projecting them', () => {
    expect(richItems('<p></p><p><script>alert(1)</script>Only the words</p>')).toEqual([{ body: 'Only the words' }])
  })

  it('treats blank-line paragraphs of plain text as items too', () => {
    expect(richItems('Book stand.\n\nTracts by the door.')).toEqual([{ body: 'Book stand.' }, { body: 'Tracts by the door.' }])
  })

  it('breaks a pasted list into one item a line, break and all', () => {
    expect(richItems('<p>Tracts<br>Books<br>Magazines</p>')).toEqual([{ body: 'Tracts' }, { body: 'Books' }, { body: 'Magazines' }])
    expect(richItems('Tracts\nBooks')).toEqual([{ body: 'Tracts' }, { body: 'Books' }])
  })

  it('keeps a heading whole when its line carries a break', () => {
    expect(richItems('<h2>Brotherhood<br>lunch</h2>')).toEqual([{ body: '<h2>Brotherhood<br>lunch</h2>' }])
  })
})

describe('a typeface or colour read off this computer', () => {
  it('puts the slide serif behind a local family so another machine still reads it', () => {
    expect(localFontStack('Amithen Extra')).toBe('"Amithen Extra", Georgia,\'Times New Roman\',serif')
    expect(localFontStack('  "quoted" name  ')).toBe('"quoted name", Georgia,\'Times New Roman\',serif')
  })

  it('keeps dark ink on a light mark and light ink on a dark one', () => {
    expect(legibleInk('#ffe066')).toBe('#171717')
    expect(legibleInk('#0a2a4a')).toBe('#fffdf7')
    expect(legibleInk('rgb(255, 224, 102)')).toBe('#171717')
    expect(legibleInk('rgb(10, 42, 74)')).toBe('#fffdf7')
    expect(legibleInk('nonsense')).toBe('#171717')
  })

  it('leaves unhighlighted words the ink of the projection theme', () => {
    const html = customSlideHtml('<p>Book <span style="background-color:transparent; color:#171717">stand</span>.</p>', DEFAULT_CUSTOM_STYLE)
    expect(html).toContain('[style*="background-color"]:not([style*="transparent"])')
  })

  it('carries a colour chosen for the words, and the inherit that hands them back', () => {
    expect(sanitizeRichText('<span style="color:#e05a4f">Flame</span>')).toBe('<p><span style="color:#e05a4f">Flame</span></p>')
    expect(sanitizeRichText('<span style="color: inherit">Plain</span>')).toBe('<p><span style="color: inherit">Plain</span></p>')
  })

  it('offers colours deep enough for a light slide and bright enough for a dark one', () => {
    // The same brightness the app reads a mark by, as a share of white.
    const brightness = (color: string) => {
      const hex = color.slice(1)
      const [red, green, blue] = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
      return (0.2126 * red! + 0.7152 * green! + 0.0722 * blue!) / 255
    }
    for (const colour of TEXT_COLORS) {
      expect(colour.value).toMatch(/^#[0-9a-f]{6}$/)
      expect(brightness(colour.value)).toBeGreaterThan(0.2)
      expect(brightness(colour.value)).toBeLessThan(0.8)
    }
  })
})
