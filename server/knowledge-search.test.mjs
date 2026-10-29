import { afterEach, describe, expect, test, vi } from 'vitest'
import { File } from 'node:buffer'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { answerMinistryQuestion, generateSchoolLessonQuestions, parseLessonQuestions, searchLocalKnowledge } from './knowledge-search.mjs'
import { readKnowledgeOutline, saveKnowledgeUpload } from './knowledge.mjs'

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

  test('keeps a ministry answer inside the source selected in Chat', async () => {
    const chunks = join(root, 'Ministry', 'Chunks')
    await mkdir(chunks, { recursive: true })
    await writeFile(join(chunks, 'matthew_chunks.json'), JSON.stringify([
      { chunk: 1, source: '40 Matthew - Recovery Version.pdf', text: 'From that time Jesus began to preach the word of the kingdom of the heavens.' },
    ]))
    await writeFile(join(chunks, 'hwmr_chunks.json'), JSON.stringify(
      Array.from({ length: 12 }, (_, index) => ({ chunk: index + 1, source: '2026 HWMR - The Ministry of the Word.pdf', text: `The ministry of the word speaks the word of the kingdom, number ${index + 1}.` })),
    ))
    const answer = await answerMinistryQuestion('What is the word of the kingdom?', { knowledgeIndexDir: root }, 'bible')
    expect(answer.grounded).toBe(true)
    expect(answer.sources.map((source) => source.document)).toEqual(['40 Matthew - Recovery Version.pdf'])
    const hymnal = await answerMinistryQuestion('What is the word of the kingdom?', { knowledgeIndexDir: root }, 'hymnal')
    expect(hymnal.grounded).toBe(false)
    expect(hymnal.text).toContain('Hymnal')
  })
})

async function activityFixture() {
  const config = {
    knowledgeDir: join(root, 'Knowledge'), knowledgeTrashDir: join(root, 'Trash'),
    knowledgeIndexDir: join(root, 'Index'), maxKnowledgeBytes: 5 * 1024 * 1024,
    providerMode: 'local', ollamaUrl: 'http://ollama.test', ollamaModel: 'lesson-model',
  }
  const form = new FormData()
  form.set('file', new File(['school reader'], 'OBEEnglish_LevelC.pdf'))
  form.set('category', 'School')
  form.set('collection', 'Level C')
  await saveKnowledgeUpload(form, config)
  const chunks = join(config.knowledgeIndexDir, 'School', 'Chunks')
  await mkdir(chunks, { recursive: true })
  await writeFile(join(chunks, 'OBEEnglish_LevelC_chunks.json'), JSON.stringify([
    { text: 'English Level C reader cover page' },
    { text: `Lesson 1 Seeds and growth\n${'Seeds need warm soil, sunlight and clean water before they can sprout into strong young plants. '.repeat(4)}` },
    ...Array.from({ length: 5 }, (_, index) => ({ text: `The learner reads the first part, page ${index + 1}.` })),
    { text: 'Lesson 2 Rivers and rains\nRivers carry snowmelt from the high hills down to the sea before the monsoon clouds return.' },
  ]))
  return config
}

describe('lesson-grounded school activities', () => {
  test('writes questions from the lesson the learner selected, and no other', async () => {
    const config = await activityFixture()
    const outline = await readKnowledgeOutline('School', 'OBEEnglish_LevelC', config)
    const lesson = outline.sections.find((section) => section.label.startsWith('Lesson 1'))
    const modelOutput = JSON.stringify({ questions: [
      { question: 'What does a seed need before it can sprout?', choices: ['Warm soil, sunlight and water', 'Only darkness', 'Ice', 'Salt'], answer: 0, explanation: 'The lesson names warm soil, sunlight and clean water.' },
      { question: 'Which of these is not mentioned for a sprouting seed?', choices: ['Sunlight', 'Clean water', 'Warm soil', 'Snow'], answer: 'Snow', explanation: 'Snow belongs to the river lesson, not this one.' },
    ] })
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: { content: modelOutput } })))
    const result = await generateSchoolLessonQuestions({ category: 'School', document: 'OBEEnglish_LevelC', sections: [lesson.id], count: 8 }, config, fetcher)
    const prompt = JSON.parse(fetcher.mock.calls[0][1].body).messages[0].content
    expect(result.questions).toHaveLength(2)
    expect(result.reason).toBe('')
    expect(result.model).toBe('lesson-model')
    expect(result.lessonLabels).toEqual([lesson.label])
    expect(prompt).toContain('exactly 8 multiple-choice questions')
    expect(prompt).toContain('Seeds need warm soil')
    expect(prompt).not.toContain('Rivers carry snowmelt')
  })

  test('says the model is unavailable when the local model cannot answer', async () => {
    const config = await activityFixture()
    const outline = await readKnowledgeOutline('School', 'OBEEnglish_LevelC', config)
    const fetcher = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:11434'))
    const result = await generateSchoolLessonQuestions({ category: 'School', document: 'OBEEnglish_LevelC', sections: [outline.sections[0].id] }, config, fetcher)
    expect(result).toMatchObject({ questions: [], reason: 'model-unavailable' })
  })

  test('asks for a lesson before it generates anything', async () => {
    const config = await activityFixture()
    const result = await generateSchoolLessonQuestions({ category: 'School', document: 'OBEEnglish_LevelC', sections: [] }, config, vi.fn())
    expect(result).toMatchObject({ questions: [], reason: 'no-lesson-selected' })
  })

  test('reports the material as unindexed when its lessons cannot be read', async () => {
    const config = await activityFixture()
    const result = await generateSchoolLessonQuestions({ category: 'School', document: 'Missing', sections: ['1-1'] }, config, vi.fn())
    expect(result).toMatchObject({ questions: [], reason: 'lesson-not-indexed' })
  })
})

describe('lesson question parsing', () => {
  const item = (n) => ({ question: `Which answer belongs to question ${n}?`, choices: ['First', 'Second', 'Third', 'Fourth'], answer: 1, explanation: `Because ${n}.` })

  test('reads strict JSON, fenced output, and output wrapped in prose', () => {
    expect(parseLessonQuestions(JSON.stringify({ questions: [item(1), item(2)] }), 8)).toHaveLength(2)
    expect(parseLessonQuestions(`\`\`\`json\n${JSON.stringify([item(1)])}\n\`\`\``, 8)).toHaveLength(1)
    expect(parseLessonQuestions(`Here are your questions:\n${JSON.stringify({ questions: [item(1)] })}\nHope this helps.`, 8)).toHaveLength(1)
  })

  test('maps letter and written answers to the choice index', () => {
    const [letter] = parseLessonQuestions(JSON.stringify({ questions: [{ ...item(1), answer: 'B' }] }), 8)
    expect(letter.answer).toBe(1)
    const [written] = parseLessonQuestions(JSON.stringify({ questions: [{ ...item(2), answer: 'Second' }] }), 8)
    expect(written.answer).toBe(1)
  })

  test('drops malformed and repeated questions and stops at the requested count', () => {
    const parsed = parseLessonQuestions(JSON.stringify({ questions: [
      item(1),
      { ...item(1), answer: 0 },
      { question: 'Only three choices here?', choices: ['One', 'Two', 'Three'], answer: 0, explanation: 'Short.' },
      { question: 'A question with no real answer?', choices: ['Alpha', 'Beta', 'Gamma', 'Delta'], answer: 'not a choice', explanation: '' },
      item(5),
      item(6),
    ] }), 2)
    expect(parsed.map((question) => question.question)).toEqual([
      'Which answer belongs to question 1?', 'Which answer belongs to question 5?',
    ])
  })

  test('explains an answer when the model leaves the explanation out', () => {
    const [question] = parseLessonQuestions(JSON.stringify({ questions: [{ question: 'What does the lesson say about rain?', choices: ['Blue', 'Red', 'Green', 'Black'], answer: 2 }] }), 8)
    expect(question.explanation).toContain('Green')
  })

  test('returns nothing when the model replies in prose only', () => {
    expect(parseLessonQuestions('I could not write questions from that lesson.', 8)).toEqual([])
  })

  test('repairs the small JSON slips a local model makes', () => {
    const slipped = '{ "questions": [ { "question": "What does the lesson say about seeds?", ""choices": ["Sunlight", "Darkness", "Ice", "Salt"], "answer": 0, "explanation": "The lesson names sunlight." }, ] }'
    const parsed = parseLessonQuestions(slipped, 8)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].choices).toEqual(['Sunlight', 'Darkness', 'Ice', 'Salt'])
  })
})
