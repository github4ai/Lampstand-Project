import { beforeEach, describe, expect, it } from 'vitest'
import { FADE_SPEEDS, mediaProjectionWarning, readPresentationPrefs, resolvePresentationSettings, writePresentationPrefs } from './PresentOnDisplay'

const prefs = { showTitle: true, fontScale: 1, theme: 'light', transition: 'fade', transitionSpeed: 'normal', audioOutput: '', mediaLevel: .2 } as const

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
      .toEqual({ showTitle: true, fontScale: 1.45, theme: 'dark', transition: 'fade', transitionSpeed: 'normal', audioOutput: '', mediaLevel: .2 })
  })

  it('keeps a hidden title that the payload switched on', () => {
    expect(resolvePresentationSettings({ showTitle: true }, { ...prefs, showTitle: false }).showTitle).toBe(true)
  })

  it('clamps the audience text size to the projector range', () => {
    expect(resolvePresentationSettings({ fontScale: 6 }, prefs).fontScale).toBe(2)
    expect(resolvePresentationSettings({ fontScale: 0.2 }, prefs).fontScale).toBe(.8)
  })

  it('carries the chosen room speaker through to the projector window', () => {
    expect(resolvePresentationSettings({ audioSinkId: 'sink-2' }, prefs).audioOutput).toBe('sink-2')
    expect(resolvePresentationSettings({ title: 'Song', html: '' }, { ...prefs, audioOutput: 'sink-1' }).audioOutput).toBe('sink-1')
  })

  it('coerces an unknown theme or transition to a supported value', () => {
    const legacy = { theme: 'sepia', transition: 'slide' } as unknown as Parameters<typeof resolvePresentationSettings>[0]
    expect(resolvePresentationSettings(legacy, prefs)).toMatchObject({ theme: 'light', transition: 'none' })
  })
})

describe('saved preferences', () => {
  it('starts from the defaults, including a 300 millisecond fade', () => {
    expect(readPresentationPrefs()).toEqual({ showTitle: true, fontScale: 1, theme: 'light', transition: 'fade', transitionSpeed: 'normal', audioOutput: '', mediaLevel: .2 })
    expect(FADE_SPEEDS.normal).toBe(.3)
  })

  it('survives a corrupt stored value', () => {
    window.localStorage.setItem('lampstand.presentation.prefs', 'not json')
    expect(readPresentationPrefs().theme).toBe('light')
  })

  it('round-trips a partial patch without dropping the rest', () => {
    writePresentationPrefs({ theme: 'dark' })
    expect(writePresentationPrefs({ fontScale: 3 })).toEqual({ showTitle: true, fontScale: 2, theme: 'dark', transition: 'fade', transitionSpeed: 'normal', audioOutput: '', mediaLevel: .2 })
  })

  it('holds the media level the operator last set', () => {
    writePresentationPrefs({ mediaLevel: .8 })
    expect(readPresentationPrefs().mediaLevel).toBe(.8)
    expect(resolvePresentationSettings({ title: 'Clip', html: '' }, readPresentationPrefs()).mediaLevel).toBe(.8)
  })

  it('keeps silence when the slider was parked at zero', () => {
    writePresentationPrefs({ mediaLevel: 0 })
    expect(readPresentationPrefs().mediaLevel).toBe(0)
    expect(resolvePresentationSettings({ title: 'Clip', html: '' }, readPresentationPrefs()).mediaLevel).toBe(0)
  })

  it('keeps a level inside the range the projector accepts', () => {
    expect(writePresentationPrefs({ mediaLevel: 3 }).mediaLevel).toBe(1)
    expect(writePresentationPrefs({ mediaLevel: -4 }).mediaLevel).toBe(0)
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

describe('mediaProjectionWarning', () => {
  const answer = (status: number) => {
    const calls: string[] = []
    ;(globalThis as { fetch?: unknown }).fetch = async (url: string) => { calls.push(String(url)); return { status, ok: status < 400 } }
    return calls
  }

  it('stays quiet when there is no file to show', async () => {
    const calls = answer(200)
    expect(await mediaProjectionWarning(undefined)).toBe('')
    expect(calls).toHaveLength(0)
  })

  it('stays quiet while the library still has the file', async () => {
    answer(200)
    expect(await mediaProjectionWarning({ kind: 'image', name: 'welcome.png', title: 'Welcome' })).toBe('')
  })

  it('names the slide and the tab that fixes a missing deck page', async () => {
    const calls = answer(404)
    const warning = await mediaProjectionWarning({ kind: 'deck', name: 'decks/Msg 2 NCST/slide-03.png', title: 'Msg 2 NCST', pages: ['decks/Msg 2 NCST/slide-01.png', 'decks/Msg 2 NCST/slide-02.png', 'decks/Msg 2 NCST/slide-03.png'], page: 3 })
    expect(warning).toContain('Msg 2 NCST: slide 3')
    expect(warning).toContain('Media tab')
    // The arrows move a deck, so the file being asked about is the page about to go on air.
    expect(calls[0]).toContain(encodeURIComponent('decks/Msg 2 NCST/slide-03.png'))
  })

  it('points at the Media tab when a cued file is gone', async () => {
    answer(404)
    const warning = await mediaProjectionWarning({ kind: 'document', name: 'order-of-service.pdf', title: 'Order of Service' })
    expect(warning).toContain('Order of Service is no longer in the media library')
    expect(warning).toContain('Media tab')
  })

  it('does not blame the library when the gateway is the one failing', async () => {
    answer(500)
    expect(await mediaProjectionWarning({ kind: 'video', name: 'clip.mp4', title: 'Clip' })).toBe('')
    ;(globalThis as { fetch?: unknown }).fetch = async () => { throw new TypeError('Failed to fetch') }
    expect(await mediaProjectionWarning({ kind: 'audio', name: 'hymn.mp3', title: 'Hymn' })).toBe('')
  })
})
