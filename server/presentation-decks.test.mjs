import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { convertPresentationDeck, deckFolderName, parseConverterResult } from './presentation-decks.mjs'

let root = ''
let config = null
let fakeConverter = ''

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'lampstand-decks-'))
  fakeConverter = join(root, 'fake-converter.ps1')
  config = { presentationMediaDir: root, presentationDeckScript: fakeConverter }
  await writeFile(fakeConverter, [
    "param([string]$Source,[string]$OutDir,[int]$Width=1600,[int]$Height=900)",
    "New-Item -ItemType Directory -Force -Path $OutDir | Out-Null",
    "Set-Content -Path (Join-Path $OutDir 'slide-01.png') -Value 'first page'",
    "Set-Content -Path (Join-Path $OutDir 'slide-02.png') -Value 'second page'",
    "@{ ok=$true; count=2; pages=@(@{number=1;title='The lampstand';file='slide-01.png'},@{number=2;title='';file='slide-02.png'}) } | ConvertTo-Json -Compress -Depth 5",
  ].join('\n'))
  await mkdir(join(root, 'decks'), { recursive: true })
  await writeFile(join(root, 'Spring training.pptx'), 'a deck')
})

afterAll(() => rm(root, { recursive: true, force: true }))

describe('PowerPoint deck conversion', () => {
  it('names the output folder after the deck, not after whatever the client sent', () => {
    expect(deckFolderName('Spring_training-2026.pptx')).toBe('Spring training-2026')
    expect(deckFolderName('../../escape.pptx')).toBe('escape')
  })

  it('writes each converted page into the media library and reports it', async () => {
    const result = await convertPresentationDeck('Spring training.pptx', config)
    expect(result).toMatchObject({ group: 'decks/Spring training', source: 'Spring training.pptx', total: 2 })
    expect(result.pages[0]).toMatchObject({ id: 'decks/Spring training/slide-01.png', title: 'The lampstand' })
    expect(result.pages[0].bytes).toBeGreaterThan(0)
    expect(result.pages[1].title).toBe('Slide 2')
  })

  it('refuses a file that is not a PowerPoint deck', async () => {
    await writeFile(join(root, 'offering.png'), 'image')
    await expect(convertPresentationDeck('offering.png', config)).rejects.toMatchObject({ status: 400 })
  })

  it('refuses a deck that is no longer in the library', async () => {
    await expect(convertPresentationDeck('removed.pptx', config)).rejects.toMatchObject({ status: 404 })
  })

  it('refuses politely when the converter itself is missing', async () => {
    await expect(convertPresentationDeck('Spring training.pptx', { ...config, presentationDeckScript: join(root, 'nope.ps1') })).rejects.toMatchObject({ status: 500 })
  })

  it('turns a converter failure into an instruction the reader can follow', () => {
    expect(() => parseConverterResult('{"ok":false,"error":"Microsoft PowerPoint is not installed on this computer."}')).toThrow(/save it as a PDF/i)
    expect(() => parseConverterResult('')).toThrow(/could not be read/i)
  })
})
