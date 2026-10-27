import { describe, expect, it } from 'vitest'
import { detectWebSource, mapsUrl, normalizeWebUrl, webProjectionUrl, youtubeProjectionUrl } from './webSources'

describe('normalizeWebUrl', () => {
  it('adds the scheme to a bare address', () => {
    expect(normalizeWebUrl('maps.google.com')).toBe('https://maps.google.com/')
  })

  it('refuses anything that is not a web page', () => {
    expect(normalizeWebUrl('javascript:alert(1)')).toBe('')
    expect(normalizeWebUrl('file:///C:/Windows/system32/config/sam')).toBe('')
    expect(normalizeWebUrl('   ')).toBe('')
  })
})

describe('mapsUrl', () => {
  it('builds a searchable map at the chosen zoom and basemap', () => {
    expect(mapsUrl('Chapel Hill, Durham', { zoom: 15, basemap: 'satellite' })).toBe('https://maps.google.com/maps?q=Chapel%20Hill%2C%20Durham&z=15&t=k')
  })

  it('keeps an out-of-range zoom inside the map scale', () => {
    expect(mapsUrl('home', { zoom: 99 })).toContain('&z=21&')
    expect(mapsUrl('home', { zoom: 0 })).toContain('&z=2&')
  })

  it('returns nothing without a place', () => {
    expect(mapsUrl('  ')).toBe('')
  })
})

describe('youtubeProjectionUrl', () => {
  it('turns a watch page into the clean player', () => {
    expect(youtubeProjectionUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0')
    expect(youtubeProjectionUrl('youtu.be/abc123')).toBe('https://www.youtube.com/embed/abc123?autoplay=1&rel=0')
    expect(youtubeProjectionUrl('https://youtube.com/shorts/abc123')).toBe('https://www.youtube.com/embed/abc123?autoplay=1&rel=0')
  })

  it('leaves a live page alone because the stream keeps its own player', () => {
    expect(youtubeProjectionUrl('https://www.youtube.com/live/abc123')).toBe('https://www.youtube.com/live/abc123')
  })

  it('passes a non-YouTube address through', () => {
    expect(youtubeProjectionUrl('https://meet.google.com/xxx-yyyy-zzz')).toBe('https://meet.google.com/xxx-yyyy-zzz')
  })
})

describe('detectWebSource', () => {
  it('names the services the operator meets most', () => {
    expect(detectWebSource('https://meet.google.com/abc-defg-hij')).toBe('meet')
    expect(detectWebSource('https://us02web.zoom.us/j/123456789')).toBe('zoom')
    expect(detectWebSource(mapsUrl('Durham'))).toBe('maps')
    expect(detectWebSource('https://www.lsmwebcast.com/')).toBe('web')
  })
})

describe('webProjectionUrl', () => {
  it('embeds a YouTube video but keeps every other page as typed', () => {
    expect(webProjectionUrl('youtube.com/watch?v=abc123')).toBe('https://www.youtube.com/embed/abc123?autoplay=1&rel=0')
    expect(webProjectionUrl('https://www.lsmwebcast.com/')).toBe('https://www.lsmwebcast.com/')
  })

  it('returns nothing for an unusable address', () => {
    expect(webProjectionUrl('not a url at all')).toBe('')
  })
})
