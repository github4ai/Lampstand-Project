import { describe, expect, it, vi } from 'vitest'
import { parseHymnImport } from './importHymn'

describe('parseHymnImport', () => {
  vi.stubGlobal('crypto', { randomUUID: () => 'hymn-id' })

  it('imports structured JSON hymns', () => {
    const hymn = parseHymnImport(JSON.stringify({
      title: 'Test Hymn', author: 'Author', originalKey: 'G',
      sections: [{ label: 'Verse 1', lines: ['[G]Test line'] }],
    }), 'test.json')
    expect(hymn).toMatchObject({
      id: 'hymn-id', title: 'Test Hymn', originalKey: 'G', rightsStatus: 'user-provided',
    })
  })

  it('imports ChordPro metadata and sections', () => {
    const hymn = parseHymnImport([
      '{title: ChordPro Hymn}', '{artist: Test Author}', '{key: D}',
      '{prefix: NS}', '{number: 1156}',
      '{audio: https://example.com/tune.mp3}', '{sheet: https://example.com/sheet.png}',
      '[D]First verse', '{start_of_chorus}', '[G]Chorus line', '{end_of_chorus}',
    ].join('\n'), 'song.cho')
    expect(hymn).toMatchObject({
      title: 'ChordPro Hymn', author: 'Test Author', originalKey: 'D',
      catalogPrefix: 'NS', hymnNumber: '1156',
      audioUrl: 'https://example.com/tune.mp3', pianoSheetUrl: 'https://example.com/sheet.png',
    })
    expect(hymn?.sections).toHaveLength(2)
    expect(hymn?.sections[1].label).toBe('Chorus')
  })

  it('normalizes language codes from JSON hymns', () => {
    const hymn = parseHymnImport(JSON.stringify({
      title: 'Marathi Hymn', language: ' MR ',
      sections: [{ label: 'Verse', lines: ['गीत'] }],
    }), 'marathi.json')
    expect(hymn?.language).toBe('mr')
  })

  it('imports language metadata and aliases from ChordPro', () => {
    const language = parseHymnImport('{title: Malayalam Hymn}\n{language: ml}\nLine', 'malayalam.pro')
    const alias = parseHymnImport('{title: Telugu Hymn}\n{lang: te}\nLine', 'telugu.pro')
    expect(language?.language).toBe('ml')
    expect(alias?.language).toBe('te')
  })

  it('defaults unsupported hymn languages to English', () => {
    const hymn = parseHymnImport(JSON.stringify({
      title: 'Unknown Language', language: 'xx',
      sections: [{ label: 'Verse', lines: ['Line'] }],
    }), 'unknown.json')
    expect(hymn?.language).toBe('en')
  })

  it('drops unsafe media URLs', () => {
    const hymn = parseHymnImport(JSON.stringify({
      title: 'Safe', audioUrl: 'javascript:alert(1)', pianoSheetUrl: 'file:///secret',
      sections: [{ label: 'Verse', lines: ['Line'] }],
    }), 'safe.json')
    expect(hymn?.audioUrl).toBeUndefined()
    expect(hymn?.pianoSheetUrl).toBeUndefined()
  })

  it('rejects malformed files', () => {
    expect(parseHymnImport('{bad json', 'bad.json')).toBeNull()
    expect(parseHymnImport('[C]Missing title', 'bad.pro')).toBeNull()
  })
})
