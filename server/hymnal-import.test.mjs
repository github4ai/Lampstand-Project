import { describe, expect, it } from 'vitest'
import { parseHymnalPage } from './hymnal-import.mjs'

const html = `<h1 id="song-title">Blending is the Way</h1>
<span class="label label-success">NS1156</span><span id="keysig">F Major</span>
<article class="js-stanzas"><div data-type="verse" class="verse "><div class="text-container">We have come<br/>Together</div><div class="chord-container hidden"><div class="line"><div class="chord-text"><span class="chord">F</span>We&nbsp;</div>have&nbsp;come</div><div class="line">To<div class="chord-text"><span class="chord">C</span>gether</div></div></div></div><div data-type="chorus" class="verse "><div class="chorus text-container">Blending is the way</div></div></article>
<div class="row"><label>Category:</label><div>The Church</div></div><div class="row"><label>Subcategory:</label><div>Her Building</div></div><div class="row"><label>Lyrics:</label><div>L. M.</div></div><div class="row"><label>Music:</label><div>L. M.</div></div><div class="row"><label>Time:</label><div>4/4</div></div><div class="row"><label>Hymn Code:</label><div>1234</div></div>
<div class="row sidebar-title"><h4>Related Songs</h4></div><div class="row common-panel hymn-related-songs"><a href="590.html">One</a><a href="../h/819.html">Two</a></div><div class="row sidebar-title"><h4>Downloads</h4></div>
<a href="https://example/ns1156_p.pdf">Piano</a><a href="https://example/ns1156_g.pdf">Guitar</a><a href="https://example/ns1156.mp3">mp3</a><a href="https://example/ns1156_sing.mp3">Singing</a>`

describe('hymnal.net mirror parser', () => {
  it('maps a canonical page into an AIOS hymn', () => {
    const hymn = parseHymnalPage(html, 'en/hymn/ns/1156.html')
    expect(hymn).toMatchObject({ id: 'hymnal-net-ns-1156', title: 'Blending is the Way', catalogPrefix: 'NS', hymnNumber: '1156', originalKey: 'F', category: 'The Church', subcategory: 'Her Building', rightsStatus: 'local-library', relatedCatalogs: ['NS590', 'H819'] })
    expect(hymn.sections).toEqual([{ label: 'Verse 1', lines: ['[F]We have come', 'To[C]gether'] }, { label: 'Chorus', lines: ['Blending is the way'] }])
  })

  it('rejects navigation and search pages', () => {
    expect(() => parseHymnalPage('<title>Search</title>', 'search.html')).toThrow('Not a canonical hymn page')
  })

  it('uses the canonical path when a collection page has no number badge', () => {
    const withoutBadge = html.replace('<span class="label label-success">NS1156</span>', '')
    expect(parseHymnalPage(withoutBadge, 'en/hymn/c/1.html')).toMatchObject({ catalogPrefix: 'C', hymnNumber: '1' })
  })

  it('preserves source lyric lines when chord markup has a different line count', () => {
    const malformedChords = html.replace('<div class="line">To<div class="chord-text"><span class="chord">C</span>gether</div></div>', '')
    const hymn = parseHymnalPage(malformedChords, 'en/hymn/ns/1156.html')
    expect(hymn.sections[0].lines).toEqual(['We have come', 'Together'])
  })
})
