import { describe, expect, it } from 'vitest'
import { announcementSlideHtml } from './announcementSlide'
import { mediaSlideHtml } from './mediaSlide'

describe('mediaSlideHtml', () => {
  it('projects a library file through the local gateway URL', () => {
    const html = mediaSlideHtml({ kind: 'image', name: 'decks/Spring training/slide-01.png', title: 'Slide 1' })
    expect(html).toContain('/presentation-media/file?name=decks%2FSpring%20training%2Fslide-01.png')
    expect(html).toContain('<img')
    expect(html).toContain('class="media-slide"')
  })

  it('gives video no on-screen controls because the studio drives the player', () => {
    const html = mediaSlideHtml({ kind: 'video', name: 'clip.mp4', title: 'Clip', autoplay: true, loop: true })
    expect(html).toContain('<video src="')
    expect(html).toContain('autoplay loop')
    expect(html).not.toContain('controls')
    expect(html).not.toContain('muted')
  })

  it('starts a silent video ready to be heard through the room speakers', () => {
    expect(mediaSlideHtml({ kind: 'video', name: 'clip.mp4', title: 'Clip', muted: true })).toContain('muted playsinline')
  })

  it('opens a document at the page the operator chose', () => {
    const html = mediaSlideHtml({ kind: 'document', name: 'order-of-service.pdf', title: 'Order of Service', page: 3 })
    expect(html).toContain('#page=3&toolbar=0&statusbar=0&view=FitH')
    expect(mediaSlideHtml({ kind: 'document', name: 'a.pdf', title: 'A', page: 0 })).toContain('#page=1&')
  })

  it('escapes a title that carries markup', () => {
    expect(mediaSlideHtml({ kind: 'image', name: 'a.png', title: '<img src=x onerror=alert(1)>' })).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })
})

describe('announcementSlideHtml', () => {
  it('drops blank lines and numbers the items by default', () => {
    const html = announcementSlideHtml({ heading: 'Announcements', lines: ['Baptism service', '', '  Book stand  ', ''] })
    expect(html).toContain('<ol><li>Baptism service</li><li>Book stand</li></ol>')
  })

  it('switches to bullets and prints a closing line', () => {
    const html = announcementSlideHtml({ heading: 'Notices', lines: ['One'], numbered: false, footer: 'Lunch after the meeting' })
    expect(html).toContain('<ul><li>One</li></ul>')
    expect(html).toContain('<p class="announcement-footer">Lunch after the meeting</p>')
  })

  it('falls back to a heading the congregation recognises', () => {
    expect(announcementSlideHtml({ heading: '  ', lines: [] })).toContain('<h2 class="announcement-heading">Announcements</h2>')
  })
})
