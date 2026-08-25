import { afterEach, describe, expect, test } from 'vitest'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { searchLocalKnowledge } from './knowledge-search.mjs'

const root = join(tmpdir(), `lampstand-knowledge-search-${process.pid}`)

afterEach(async () => { await rm(root, { recursive: true, force: true }) })

describe('local knowledge search', () => {
  test('uses document names and chunk text to find a school lesson', async () => {
    const chunks = join(root, 'School', 'Chunks')
    await mkdir(chunks, { recursive: true })
    await writeFile(join(chunks, 'English_chunks.json'), JSON.stringify([
      { chunk: 1, source: 'OBEEnglish_LevelC.pdf', text: 'CONTENTS\nLesson Name\n1) Beena and Amit\n2) Amit’s Family' },
      { chunk: 2, source: 'Mathematics.pdf', text: 'Lesson 1 Numbers and counting' },
    ]))
    const result = await searchLocalKnowledge({ query: 'Which is the first lesson in English?', category: 'School', topK: 2, includeText: true }, { knowledgeIndexDir: root })
    expect(result.results[0].source).toBe('OBEEnglish_LevelC.pdf')
    expect(result.results[0].text).toContain('Beena and Amit')
  })

  test('does not mix similarly numbered chapters from different school subjects', async () => {
    const chunks = join(root, 'School', 'Chunks')
    await mkdir(chunks, { recursive: true })
    await writeFile(join(chunks, 'mixed_chunks.json'), JSON.stringify([
      { chunk: 1, source: 'OBEEnglish_LevelC.pdf', text: 'CONTENTS\n1) Beena and Amit\n2) Amit’s Family' },
      { chunk: 2, source: 'Science_Level_C.pdf', text: 'Chapter 1 Soil Pollution and biological resources' },
      { chunk: 3, source: 'Basic_computer_skills_Level C.pdf', text: 'Lesson 1 Recapitulation and word processing' },
    ]))
    const result = await searchLocalKnowledge({ query: 'Create English flashcards for Lesson 1', category: 'School', topK: 10, includeText: true }, { knowledgeIndexDir: root })
    expect(result.results.length).toBeGreaterThan(0)
    expect(result.results.every((item) => item.source === 'OBEEnglish_LevelC.pdf')).toBe(true)
  })
})
