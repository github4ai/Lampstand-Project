import { File } from 'node:buffer'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { inspectKnowledgeHealth, listKnowledgeSources, readKnowledgeCategory, readKnowledgeContext, readKnowledgeDocument, readKnowledgeLibrary, readKnowledgeOutline, readKnowledgePreview, readKnowledgeViewer, saveKnowledgeUpload, trashKnowledgeSource, updateKnowledgeSource } from './knowledge.mjs'

const temporaryFolders = []

async function testConfig() {
  const root = await mkdtemp(join(tmpdir(), 'aios-knowledge-'))
  temporaryFolders.push(root)
  return {
    knowledgeDir: join(root, 'Knowledge'),
    knowledgeTrashDir: join(root, 'Trash'),
    knowledgeIndexDir: join(root, 'Index'),
    maxKnowledgeBytes: 5 * 1024 * 1024,
  }
}

function uploadForm(name, content = 'Test content') {
  const form = new FormData()
  form.set('file', new File([content], name))
  form.set('category', 'Ministry')
  form.set('collection', 'Bible')
  return form
}

afterEach(async () => {
  await Promise.all(temporaryFolders.splice(0).map((folder) => rm(folder, { recursive: true, force: true })))
})

describe('knowledge document formats', () => {
  it.each(['bible.html', 'bible.htm', 'bible.epub', 'bible.docx', 'bible.pptx', 'bible.txt', 'bible.md', 'bible.markdown', 'bible.pdb', 'bible.pdf'])(
    'accepts %s', async (name) => {
      const config = await testConfig()
      const result = await saveKnowledgeUpload(uploadForm(name), config)
      expect(result.name).toBe(name)
    },
  )

  it('rejects unsupported formats', async () => {
    const config = await testConfig()
    await expect(saveKnowledgeUpload(uploadForm('bible.rtf'), config)).rejects.toThrow('Supported formats')
  })

  it('hides generated PDF companions and removes them with their source', async () => {
    const config = await testConfig()
    await saveKnowledgeUpload(uploadForm('bible.html', '<h1>Bible</h1>'), config)
    const folder = join(config.knowledgeDir, 'Ministry', 'Bible')
    await writeFile(join(folder, 'bible.aios-index.pdf'), 'generated')
    await mkdir(join(config.knowledgeIndexDir, 'Ministry', 'Metadata'), { recursive: true })
    await writeFile(join(config.knowledgeIndexDir, 'Ministry', 'Metadata', 'indexed_files.json'), JSON.stringify({
      [join(folder, 'bible.aios-index.pdf')]: { hash: 'test' },
    }))

    const sources = await listKnowledgeSources(config)
    expect(sources.map((source) => source.name)).toEqual(['bible.html'])
    await trashKnowledgeSource('Ministry/Bible/bible.html', config)
    const metadata = JSON.parse(await readFile(join(config.knowledgeIndexDir, 'Ministry', 'Metadata', 'indexed_files.json'), 'utf8'))
    expect(metadata).toEqual({})
  })

  it('saves metadata, renames and moves a source safely', async () => {
    const config = await testConfig()
    await saveKnowledgeUpload(uploadForm('notes.txt'), config)
    const result = await updateKnowledgeSource({ relativePath: 'Ministry/Bible/notes.txt', name: 'Study Notes.txt', category: 'School', collection: 'Level C/English', title: 'Study Notes', description: 'Class notes', tags: ['lesson', 'review'] }, config)
    expect(result.relativePath).toBe('School/Level C/English/Study Notes.txt')
    expect(await listKnowledgeSources(config)).toMatchObject([{ name: 'Study Notes.txt', category: 'School', title: 'Study Notes', tags: ['lesson', 'review'] }])
  })

  it('previews PDFs and reports duplicates and pending sources', async () => {
    const config = await testConfig()
    await saveKnowledgeUpload(uploadForm('one.pdf', 'same bytes'), config)
    await saveKnowledgeUpload(uploadForm('two.pdf', 'same bytes'), config)
    const preview = await readKnowledgePreview('Ministry/Bible/one.pdf', config)
    expect(preview.contentType).toBe('application/pdf')
    const health = await inspectKnowledgeHealth(config)
    expect(health.pending).toHaveLength(2)
    expect(health.duplicates).toEqual([['Ministry/Bible/one.pdf', 'Ministry/Bible/two.pdf']])
  })

  it('builds the desktop library response without the legacy API', async () => {
    const config = await testConfig()
    await saveKnowledgeUpload(uploadForm('lesson.pdf', 'lesson content'), config)
    await mkdir(join(config.knowledgeIndexDir, 'Ministry', 'Chunks'), { recursive: true })
    await writeFile(join(config.knowledgeIndexDir, 'Ministry', 'Chunks', 'lesson_chunks.json'), '[]')

    const library = await readKnowledgeLibrary(config)
    expect(library.document_count).toBe(1)
    expect(library.indexed_document_count).toBe(1)
    expect(library.categories[0].documents[0]).toMatchObject({ name: 'lesson.pdf', indexed: true })
  })

  it('opens indexed chunks and surrounding context without the legacy API', async () => {
    const config = await testConfig()
    await saveKnowledgeUpload(uploadForm('lesson.pdf', 'lesson content'), config)
    const chunksFolder = join(config.knowledgeIndexDir, 'Ministry', 'Chunks')
    await mkdir(chunksFolder, { recursive: true })
    await writeFile(join(chunksFolder, 'lesson_chunks.json'), JSON.stringify([
      { id: 1, chunk: 1, text: 'First lesson', word_count: 2, page: 1 },
      { id: 2, chunk: 2, text: 'Second lesson', word_count: 2, page: 2 },
      { id: 3, chunk: 3, text: 'Third lesson', word_count: 2, page: 3 },
    ]))

    const viewer = await readKnowledgeViewer('Ministry', 'lesson', 2, config)
    expect(viewer.chunk).toMatchObject({ id: 2, text: 'Second lesson', previous_chunk_id: 1, next_chunk_id: 3 })
    expect(viewer.statistics).toMatchObject({ pages: 3, chunks: 3, words: 6 })

    const context = await readKnowledgeContext('Ministry', 'lesson', 2, 1, config)
    expect(context.chunks.map((chunk) => [chunk.id, chunk.is_current])).toEqual([[1, false], [2, true], [3, false]])
  })

  it('serves a category and its document detail without the legacy API', async () => {
    const config = await testConfig()
    await saveKnowledgeUpload(uploadForm('lesson.pdf', 'lesson content'), config)
    const chunksFolder = join(config.knowledgeIndexDir, 'Ministry', 'Chunks')
    await mkdir(chunksFolder, { recursive: true })
    await writeFile(join(chunksFolder, 'lesson_chunks.json'), JSON.stringify([
      { text: 'First lesson here', page: 1 },
      { text: 'Second lesson here', page: 2 },
    ]))
    const embeddingsFolder = join(config.knowledgeIndexDir, 'Ministry', 'Embeddings')
    await mkdir(embeddingsFolder, { recursive: true })
    await writeFile(join(embeddingsFolder, 'lesson_embeddings.npy'),
      Buffer.from('\x93NUMPY\x01\x00\x1a\x00{\'descr\': \'<f4\', \'shape\': (2, 384)}\n', 'latin1'))

    const category = await readKnowledgeCategory('ministry', config)
    expect(category).toMatchObject({ name: 'Ministry', document_count: 1, indexed_document_count: 1, chunk_count: 2 })

    const detail = await readKnowledgeDocument('Ministry', 'lesson', config)
    expect(detail.statistics).toMatchObject({ pages: 2, chunks: 2, vectors: 2, words: 6 })
    expect(detail.embedding_dimensions).toBe(384)
    expect(detail.pages).toEqual([1, 2])
    expect(detail.source_hash).toMatch(/^[0-9a-f]{64}$/)

    await expect(readKnowledgeCategory('Missing', config)).rejects.toThrow('The knowledge category "Missing" was not found on this computer.')
  })

  it('discovers lessons and chapters inside an indexed textbook', async () => {
    const config = await testConfig()
    await saveKnowledgeUpload(uploadForm('reader.pdf', 'reader'), config)
    const chunksFolder = join(config.knowledgeIndexDir, 'Ministry', 'Chunks')
    await mkdir(chunksFolder, { recursive: true })
    await writeFile(join(chunksFolder, 'reader_chunks.json'), JSON.stringify([
      { text: 'Cover page' },
      { text: 'Lesson 1\nLearning Together\nBody' },
      { text: 'Chapter 2: Growing Up\nBody' },
    ]))
    const outline = await readKnowledgeOutline('Ministry', 'reader', config)
    expect(outline.sections.map((item) => [item.label, item.chunk_id])).toEqual([
      ['Lesson 1', 2], ['Chapter 2 — Growing Up', 3],
    ])
  })
})
