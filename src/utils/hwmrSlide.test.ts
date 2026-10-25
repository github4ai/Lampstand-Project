import { describe, expect, it } from 'vitest'
import { hwmrDaySlideHtml, hwmrOutlineSlideHtml } from './hwmrSlide'

const day = {
  morningVerses: [
    { reference: 'Gen. 1:1', text: 'In the beginning God created the heavens and the earth.' },
    { reference: 'John 3:3', text: 'Unless one is born from above, he cannot see the kingdom of God.' },
  ],
  morningNourishment: 'The first creation shows us the beginning of a new thing.\n\nFurther Reading: Mat. 8:11, 12 .',
  todaysReading: 'Read Gen. 1 today.',
}

describe('HWMR audience slides', () => {
  it('keeps the reader order of verse reference, verse text, commentary and reading', () => {
    const html = hwmrDaySlideHtml(day)
    expect(html).toContain('Morning Nourishment')
    expect(html).toContain('Today’s Reading')
    expect(html.indexOf('verse-reference')).toBeLessThan(html.indexOf('verse-text'))
    expect(html.indexOf('verse-text')).toBeLessThan(html.indexOf('hwmr-commentary'))
  })

  it('carries the book of a list written without one', () => {
    const html = hwmrDaySlideHtml({ ...day, morningVerses: [{ reference: 'Hos. 6:6, 7', text: 'For I desire compassion...' }] })
    expect(html).toContain('data-book="hosea" data-chapter="6" data-verse="6"')
    expect(html).toContain('data-book="hosea" data-chapter="6" data-verse="7"')
  })

  it('gives every reference the coordinates the audience window projects from', () => {
    const html = hwmrDaySlideHtml(day)
    expect(html).toContain('class="verse-link" href="#" data-book="genesis" data-chapter="1" data-verse="1" data-verse-end="1"')
    expect(html).toContain('data-book="john" data-chapter="3" data-verse="3"')
  })

  it('escapes text before it reaches the projector', () => {
    const html = hwmrDaySlideHtml({ ...day, morningVerses: [{ reference: 'Gen. 1:1', text: 'The earth was <void> & "empty"' }] })
    expect(html).toContain('&lt;void&gt; &amp; &quot;empty&quot;')
    expect(html).not.toContain('<void>')
  })

  it('repairs a scanned volume line so the reference stays whole', () => {
    const html = hwmrDaySlideHtml({ ...day, morningNourishment: 'As vol.\n\n3 says, and 1 Cor. 12:3 adds it.' })
    expect(html).toContain('vol. 3')
    expect(html).toContain('data-book="1-corinthians" data-chapter="12" data-verse="3"')
  })

  it('indents outline lines by the level they are printed at', () => {
    const html = hwmrOutlineSlideHtml('I. The first thing.\n  A. Subpoint.\n    1. Detail.\n      a. Deeper detail.')
    expect(html).toContain('<p class="major">I. The first thing.</p>')
    expect(html).toContain('<p class="level-a">A. Subpoint.</p>')
    expect(html).toContain('<p class="level-1">1. Detail.</p>')
    expect(html).toContain('<p class="level-a-lower">a. Deeper detail.</p>')
  })
})
