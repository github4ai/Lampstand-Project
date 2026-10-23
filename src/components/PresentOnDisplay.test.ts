import { beforeEach, describe, expect, it } from 'vitest'
import { readPresentationPrefs, resolvePresentationSettings, writePresentationPrefs } from './PresentOnDisplay'

const prefs = { showTitle: true, fontScale: 1, theme: 'light', transition: 'fade' } as const

beforeEach(() => {
  const store = new Map<string, string>()
  ;(globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value) },
    },
  }
})

describe('resolvePresentationSettings', () => {
  it('lets an explicit payload override the saved preference', () => {
    expect(resolvePresentationSettings({ theme: 'dark', transition: 'none' }, prefs))
      .toMatchObject({ theme: 'dark', transition: 'none' })
  })

  it('applies the saved preference when a page presents without it', () => {
    expect(resolvePresentationSettings({ title: 'Song', html: '' }, { ...prefs, theme: 'dark', fontScale: 1.45 }))
      .toEqual({ showTitle: true, fontScale: 1.45, theme: 'dark', transition: 'fade' })
  })

  it('keeps a hidden title that the payload switched on', () => {
    expect(resolvePresentationSettings({ showTitle: true }, { ...prefs, showTitle: false }).showTitle).toBe(true)
  })

  it('clamps the audience text size to the projector range', () => {
    expect(resolvePresentationSettings({ fontScale: 6 }, prefs).fontScale).toBe(2)
    expect(resolvePresentationSettings({ fontScale: 0.2 }, prefs).fontScale).toBe(.8)
  })

  it('coerces an unknown theme or transition to a supported value', () => {
    const legacy = { theme: 'sepia', transition: 'slide' } as unknown as Parameters<typeof resolvePresentationSettings>[0]
    expect(resolvePresentationSettings(legacy, prefs)).toMatchObject({ theme: 'light', transition: 'none' })
  })
})

describe('saved preferences', () => {
  it('starts from the defaults, including fade on', () => {
    expect(readPresentationPrefs()).toEqual({ showTitle: true, fontScale: 1, theme: 'light', transition: 'fade' })
  })

  it('survives a corrupt stored value', () => {
    window.localStorage.setItem('lampstand.presentation.prefs', 'not json')
    expect(readPresentationPrefs().theme).toBe('light')
  })

  it('round-trips a partial patch without dropping the rest', () => {
    writePresentationPrefs({ theme: 'dark' })
    expect(writePresentationPrefs({ fontScale: 3 })).toEqual({ showTitle: true, fontScale: 2, theme: 'dark', transition: 'fade' })
  })

  it('keeps a stored text size when only another field is patched', () => {
    writePresentationPrefs({ fontScale: 1.45 })
    expect(writePresentationPrefs({ theme: 'dark' }).fontScale).toBe(1.45)
  })

  it('honours transition none once stored', () => {
    writePresentationPrefs({ transition: 'none', showTitle: false })
    expect(readPresentationPrefs()).toMatchObject({ transition: 'none', showTitle: false })
  })
})
