import { describe, expect, it } from 'vitest'
import { bibleSlideHtml } from './bibleSlide'

const verse = {
  reference: 'John 3:3',
  text: 'Jesus answered and said to him, Truly, truly, I say to you, unless one is born anew, he cannot see the kingdom of God.',
  footnotes: [
    '[1a] born — Or, born from above. So in v. 7 . To be born anew is to be born from above.',
    '[2] see — In spiritual things, to see is to enter into.',
  ],
}

describe('Bible audience slides', () => {
  it('keeps the verse text alone while footnotes are hidden', () => {
    const html = bibleSlideHtml([verse], 'hidden')
    expect(html).toContain('<strong>John 3:3</strong>')
    expect(html).not.toContain('born from above')
    expect(html).not.toContain('class="footnote"')
  })

  it('prints each footnote under the verse it explains', () => {
    const html = bibleSlideHtml([verse], 'shown')
    expect(html).toContain('<span class="footnote-tag">1a born —</span>Or, born from above. So in v. 7 . To be born anew is to be born from above.')
    expect(html.match(/class="footnote"/g)).toHaveLength(2)
  })

  it('escapes verse and footnote text before injecting it into the projector', () => {
    const html = bibleSlideHtml([{ reference: '1 Cor. 5:1', text: 'It is <reported> & "said"', footnotes: ['[1] said — <Italic> & "note"'] }], 'shown')
    expect(html).toContain('It is &lt;reported&gt; &amp; &quot;said&quot;')
    expect(html).toContain('&lt;Italic&gt; &amp; &quot;note&quot;')
    expect(html).not.toContain('<reported>')
  })

  it('keeps a footnote that carries no explained word readable', () => {
    const html = bibleSlideHtml([{ ...verse, footnotes: ['[1] Lit., out of water.'] }], 'shown')
    expect(html).toContain('<p class="footnote">[1] Lit., out of water.</p>')
  })

  it('leaves a verse without footnotes unchanged when they are shown', () => {
    expect(bibleSlideHtml([{ reference: 'John 3:16', text: 'For God so loved the world...', footnotes: [] }], 'shown'))
      .toBe(bibleSlideHtml([{ reference: 'John 3:16', text: 'For God so loved the world...', footnotes: [] }], 'hidden'))
  })
})
