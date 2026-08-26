import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'
import { basename, delimiter, extname, relative, resolve, sep } from 'node:path'
import { spawn } from 'node:child_process'

let indexJob = { state: 'idle', startedAt: null, finishedAt: null, output: '', exitCode: null, processed: 0, total: 0, current: '', errors: 0 }

const supportedKnowledgeExtensions = new Set(['.pdf', '.html', '.htm', '.epub', '.docx', '.pptx', '.txt', '.md', '.markdown', '.pdb'])
const generatedIndexSuffix = '.aios-index.pdf'
const metadataSuffix = '.aios-meta.json'

export function getKnowledgeIndexStatus() {
  return indexJob
}

export async function startKnowledgeIndex(config) {
  if (indexJob.state === 'running') return indexJob
  const total = (await listKnowledgeSources(config)).length
  indexJob = { state: 'running', startedAt: new Date().toISOString(), finishedAt: null, output: '', exitCode: null, processed: 0, total, current: '', errors: 0 }
  const child = spawn(config.knowledgeIndexPython, [config.knowledgeIndexScript], {
    cwd: config.knowledgeIndexCwd,
    windowsHide: true,
    env: {
      ...process.env,
      PYTHONPATH: [config.knowledgeIndexCwd, config.knowledgeIndexSitePackages, process.env.PYTHONPATH].filter(Boolean).join(delimiter),
      AIOS_AI_ROOT: config.knowledgeIndexCwd,
      AIOS_KNOWLEDGE_DIR: config.knowledgeDir,
      AIOS_KNOWLEDGE_INDEX_DIR: config.knowledgeIndexDir,
      AIOS_INDEX_BUILDER: config.knowledgeIndexBuilder,
      AIOS_OCR_ARCHIVE: config.knowledgeOcrArchive,
    },
  })
  const append = (chunk) => {
    const text = chunk.toString()
    indexJob.output = (indexJob.output + text).slice(-12000)
    for (const line of text.split(/\r?\n/)) {
      const active = line.match(/^(?:CONVERT|OCR)\s*:\s*(.+)$/)
      if (active) indexJob.current = active[1].trim()
      if (/^(?:CONVERTED|OCR COMPLETED)\s*:/i.test(line)) indexJob.processed = Math.min(indexJob.total, indexJob.processed + 1)
      if (/FAILED\s*:/i.test(line)) indexJob.errors += 1
    }
  }
  child.stdout.on('data', append)
  child.stderr.on('data', append)
  child.on('error', (error) => {
    indexJob = { ...indexJob, state: 'failed', finishedAt: new Date().toISOString(), output: `${indexJob.output}\n${error.message}`.trim(), errors: indexJob.errors + 1 }
  })
  child.on('close', (code) => {
    const completedWithErrors = code === 0 && /(^|\n)FAILED\s*:/m.test(indexJob.output)
    indexJob = { ...indexJob, state: code === 0 ? (completedWithErrors ? 'completed_with_errors' : 'completed') : 'failed', finishedAt: new Date().toISOString(), exitCode: code, processed: code === 0 ? indexJob.total : indexJob.processed, current: '' }
  })
  return indexJob
}

function safeFolderParts(value, label) {
  const normalized = String(value || '').trim().replace(/\\/g, '/')
  if (!normalized) return []
  return normalized.split('/').map((part) => safeSegment(part, label))
}

export async function listKnowledgeSubcollections(categoryValue, parentValue, config) {
  const category = safeSegment(categoryValue, 'Category')
  const parentParts = safeFolderParts(parentValue, 'Subcollection')
  const root = resolve(config.knowledgeDir)
  const folder = resolve(root, category, ...parentParts)
  if (!folder.startsWith(root + sep)) {
    const error = new Error('The knowledge category is invalid.')
    error.status = 400
    throw error
  }
  try {
    const entries = await readdir(folder, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
}

export async function listKnowledgeSources(config) {
  const root = resolve(config.knowledgeDir)
  const results = []
  async function walk(folder, parts) {
    let entries
    try {
      entries = await readdir(folder, { withFileTypes: true })
    } catch (error) {
      if (error?.code === 'ENOENT') return
      throw error
    }
    for (const entry of entries) {
      const nextParts = [...parts, entry.name]
      const fullPath = resolve(folder, entry.name)
      if (!fullPath.startsWith(root + sep)) continue
      if (entry.isDirectory()) await walk(fullPath, nextParts)
      else if (parts.length > 1 && entry.isFile() && supportedKnowledgeExtensions.has(extname(entry.name).toLowerCase()) &&
        !entry.name.toLowerCase().endsWith(generatedIndexSuffix)) {
        const file = await stat(fullPath)
        let metadata = {}
        try { metadata = JSON.parse(await readFile(`${fullPath}${metadataSuffix}`, 'utf8')) } catch { /* Optional metadata. */ }
        results.push({
          name: entry.name,
          category: nextParts[0] || '',
          subcollection: nextParts.length > 2 ? nextParts.slice(1, -1).join(' / ') : null,
          relativePath: nextParts.join('/'),
          sizeBytes: file.size,
          modifiedAt: file.mtime.toISOString(),
          title: typeof metadata.title === 'string' ? metadata.title : '',
          description: typeof metadata.description === 'string' ? metadata.description : '',
          tags: Array.isArray(metadata.tags) ? metadata.tags.filter((tag) => typeof tag === 'string') : [],
        })
      }
    }
  }
  await walk(root, [])
  return results.sort((left, right) => left.relativePath.localeCompare(right.relativePath, undefined, { sensitivity: 'base' }))
}

export async function readKnowledgeLibrary(config) {
  const sources = await listKnowledgeSources(config)
  const health = await inspectKnowledgeHealth(config)
  const pending = new Set(health.pending.map((path) => path.toLowerCase()))
  const grouped = new Map()

  async function artifactDetails(source) {
    const extension = extname(source.name)
    const sourceStem = basename(source.name, extension)
    const stem = extension.toLowerCase() === '.pdf' ? sourceStem : `${sourceStem}.aios-index`
    const categoryRoot = resolve(config.knowledgeIndexDir, source.category)
    const chunkPath = resolve(categoryRoot, 'Chunks', `${stem}_chunks.json`)
    const embeddingPath = resolve(categoryRoot, 'Embeddings', `${stem}_embeddings.npy`)
    const faissPath = resolve(categoryRoot, 'FAISS', `${stem}.index`)
    let chunks = null
    try {
      const parsed = JSON.parse(await readFile(chunkPath, 'utf8'))
      chunks = Array.isArray(parsed) ? parsed.length : 0
    } catch { /* Missing or unreadable artifacts are reported as pending. */ }
    let embeddings = null
    try { await stat(embeddingPath); embeddings = chunks ?? 0 } catch { /* Optional artifact. */ }
    const fileDetails = async (filePath) => {
      try {
        const file = await stat(filePath)
        return {
          name: basename(filePath),
          stem: basename(filePath, extname(filePath)),
          extension: extname(filePath),
          relative_path: relative(resolve(config.knowledgeIndexDir), filePath).replace(/\\/g, '/'),
          size_bytes: file.size,
          modified_at: file.mtime.toISOString(),
        }
      } catch { return null }
    }
    const chunkFile = chunks === null ? null : await fileDetails(chunkPath)
    const embeddingFile = embeddings === null ? null : await fileDetails(embeddingPath)
    const faissFiles = []
    try { await stat(faissPath); faissFiles.push(basename(faissPath)) } catch { /* Optional artifact. */ }
    const detailedFaissFiles = (await Promise.all(faissFiles.map(() => fileDetails(faissPath)))).filter(Boolean)
    return {
      stem,
      chunks,
      embeddings,
      chunk_file: chunkFile,
      embedding_file: embeddingFile,
      faiss_files: detailedFaissFiles,
    }
  }

  for (const source of sources) {
    if (!grouped.has(source.category)) grouped.set(source.category, [])
    const artifacts = await artifactDetails(source)
    const indexed = !pending.has(source.relativePath.toLowerCase()) && artifacts.chunks !== null
    grouped.get(source.category).push({
      id: source.relativePath,
      name: source.name,
      relative_path: source.relativePath,
      stem: artifacts.stem,
      category: source.category,
      chunks: artifacts.chunks,
      embeddings: artifacts.embeddings,
      chunk_file: artifacts.chunk_file,
      embedding_file: artifacts.embedding_file,
      faiss_files: artifacts.faiss_files,
      indexed,
      modified_at: source.modifiedAt,
    })
  }

  const metadataByCategory = new Map()
  for (const name of grouped.keys()) {
    const metadataRoot = resolve(config.knowledgeIndexDir, name, 'Metadata')
    try {
      const entries = await readdir(metadataRoot, { withFileTypes: true })
      const files = await Promise.all(entries.filter((entry) => entry.isFile()).map(async (entry) => {
        const path = resolve(metadataRoot, entry.name)
        const file = await stat(path)
        return { name: entry.name, stem: basename(entry.name, extname(entry.name)), extension: extname(entry.name), relative_path: relative(resolve(config.knowledgeIndexDir), path).replace(/\\/g, '/'), size_bytes: file.size, modified_at: file.mtime.toISOString() }
      }))
      metadataByCategory.set(name, files)
    } catch { metadataByCategory.set(name, []) }
  }

  const categories = [...grouped.entries()].map(([name, documents]) => {
    const faissFiles = documents.flatMap((document) => document.faiss_files)
    const metadataFiles = metadataByCategory.get(name) || []
    return {
      name,
      document_count: documents.length,
      indexed_document_count: documents.filter((document) => document.indexed).length,
      chunk_count: documents.reduce((total, document) => total + (document.chunks ?? 0), 0),
      embedding_count: documents.reduce((total, document) => total + (document.embeddings ?? 0), 0),
      faiss_index_count: faissFiles.length,
      metadata_file_count: metadataFiles.length,
      modified_at: documents.map((document) => document.modified_at).sort().at(-1) || null,
      documents,
      faiss_files: faissFiles,
      metadata_files: metadataFiles,
    }
  }).sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))

  return {
    index_root: config.knowledgeIndexDir,
    exists: true,
    category_count: categories.length,
    document_count: sources.length,
    indexed_document_count: categories.reduce((total, category) => total + category.indexed_document_count, 0),
    chunk_count: categories.reduce((total, category) => total + category.chunk_count, 0),
    embedding_count: categories.reduce((total, category) => total + category.embedding_count, 0),
    faiss_index_count: categories.reduce((total, category) => total + category.faiss_index_count, 0),
    categories,
  }
}

function normalizeViewerChunk(item, index, total, document, category, chunkFile) {
  const text = typeof item?.text === 'string' ? item.text : ''
  const pageValue = item?.page ?? item?.metadata?.page
  const page = Number.isFinite(Number(pageValue)) ? Number(pageValue) : null
  const vectorValue = item?.vector_id ?? item?.metadata?.vector_id
  return {
    id: Number.isFinite(Number(item?.id)) ? Number(item.id) : index + 1,
    chunk: Number.isFinite(Number(item?.chunk)) ? Number(item.chunk) : index + 1,
    vector_id: Number.isFinite(Number(vectorValue)) ? Number(vectorValue) : null,
    page,
    word_count: Number.isFinite(Number(item?.word_count)) ? Number(item.word_count) : text.trim().split(/\s+/).filter(Boolean).length,
    character_count: text.length,
    source: typeof item?.source === 'string' ? item.source : document.name,
    category: typeof item?.category === 'string' ? item.category : category,
    chunk_file: chunkFile,
    text,
    position: index,
    previous_chunk_id: index > 0 ? index : null,
    next_chunk_id: index + 1 < total ? index + 2 : null,
  }
}

async function loadViewerDocument(categoryValue, documentValue, config) {
  const categoryName = safeSegment(categoryValue, 'Category')
  const documentName = safeSegment(documentValue, 'Document')
  const library = await readKnowledgeLibrary(config)
  const category = library.categories.find((item) => item.name.toLowerCase() === categoryName.toLowerCase())
  const document = category?.documents.find((item) => item.stem.toLowerCase() === documentName.toLowerCase())
  if (!category || !document || !document.chunk_file) {
    const error = new Error('The indexed knowledge document was not found.')
    error.status = 404
    throw error
  }
  const categoryRoot = resolve(config.knowledgeIndexDir, category.name)
  const chunkPath = resolve(categoryRoot, 'Chunks', document.chunk_file.name)
  if (!chunkPath.startsWith(categoryRoot + sep)) {
    const error = new Error('The knowledge document path is invalid.')
    error.status = 400
    throw error
  }
  let chunks
  try { chunks = JSON.parse(await readFile(chunkPath, 'utf8')) } catch {
    const error = new Error('The indexed knowledge content could not be read.')
    error.status = 404
    throw error
  }
  if (!Array.isArray(chunks) || chunks.length === 0) {
    const error = new Error('This knowledge document does not contain readable chunks.')
    error.status = 404
    throw error
  }
  return { category, document, chunks }
}

export async function readKnowledgeViewer(categoryValue, documentValue, chunkIdValue, config) {
  const { category, document, chunks } = await loadViewerDocument(categoryValue, documentValue, config)
  const chunkId = Number(chunkIdValue)
  if (!Number.isInteger(chunkId) || chunkId < 1 || chunkId > chunks.length) {
    const error = new Error('The requested knowledge chunk was not found.')
    error.status = 404
    throw error
  }
  const normalized = chunks.map((item, index) => normalizeViewerChunk(item, index, chunks.length, document, category.name, document.chunk_file.name))
  const pages = new Set(normalized.map((item) => item.page).filter((page) => page !== null))
  return {
    category: category.name,
    document: document.stem,
    statistics: {
      pages: pages.size || null,
      chunks: normalized.length,
      embeddings: document.embeddings ?? 0,
      vectors: document.embeddings ?? 0,
      words: normalized.reduce((total, item) => total + item.word_count, 0),
    },
    chunk: normalized[chunkId - 1],
  }
}

export async function readKnowledgeContext(categoryValue, documentValue, chunkIdValue, radiusValue, config) {
  const { category, document, chunks } = await loadViewerDocument(categoryValue, documentValue, config)
  const chunkId = Number(chunkIdValue)
  const parsedRadius = Number.parseInt(radiusValue, 10)
  const radius = Math.min(10, Math.max(0, Number.isNaN(parsedRadius) ? 1 : parsedRadius))
  if (!Number.isInteger(chunkId) || chunkId < 1 || chunkId > chunks.length) {
    const error = new Error('The requested knowledge chunk was not found.')
    error.status = 404
    throw error
  }
  const start = Math.max(0, chunkId - 1 - radius)
  const end = Math.min(chunks.length, chunkId + radius)
  const selected = chunks.slice(start, end).map((item, offset) => {
    const normalized = normalizeViewerChunk(item, start + offset, chunks.length, document, category.name, document.chunk_file.name)
    const { position: _position, previous_chunk_id: _previous, next_chunk_id: _next, ...contextChunk } = normalized
    return { ...contextChunk, is_current: normalized.id === chunkId || start + offset + 1 === chunkId }
  })
  return {
    category: category.name,
    document: document.stem,
    current_chunk_id: chunkId,
    radius,
    total_chunks: chunks.length,
    start_chunk_id: selected[0]?.id ?? null,
    end_chunk_id: selected.at(-1)?.id ?? null,
    chunks: selected,
  }
}

function outlineText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function outlineKind(value) {
  return /chapter/i.test(value) ? 'chapter' : /lesson/i.test(value) ? 'lesson' : 'section'
}

export async function readKnowledgeOutline(categoryValue, documentValue, config) {
  const { category, document, chunks } = await loadViewerDocument(categoryValue, documentValue, config)
  const sections = []
  const seen = new Set()
  const add = (label, chunkId, kind = outlineKind(label)) => {
    const cleanLabel = outlineText(label)
    if (!cleanLabel || seen.has(`${cleanLabel.toLowerCase()}|${chunkId}`)) return
    seen.add(`${cleanLabel.toLowerCase()}|${chunkId}`)
    const pageValue = chunks[chunkId - 1]?.page ?? chunks[chunkId - 1]?.metadata?.page
    const page = Number.isFinite(Number(pageValue)) ? Number(pageValue) : null
    sections.push({ id: `${chunkId}-${sections.length + 1}`, label: cleanLabel, chunk_id: chunkId, page, type: kind })
  }

  const openingText = outlineText(chunks.slice(0, 8).map((item) => item?.text).join('\n'))
  const contentsChunkIndex = chunks.slice(0, 8).findIndex((item) => /\bcontents\b/i.test(String(item?.text || '')))
  const contentSearchStart = contentsChunkIndex >= 0 ? contentsChunkIndex + 2 : 2
  const pageHeadingIndex = openingText.search(/Page No\.?/i)
  const contentsText = pageHeadingIndex >= 0 ? openingText.slice(pageHeadingIndex).replace(/^Page No\.?\s*/i, '') : openingText
  const contents = []
  if (/social[ _-]*science/i.test(document.stem)) {
    const socialScienceLessons = [
      'Social Studies: An Introduction', 'Evolution of Human Civilization', 'Vedic Civilization',
      'Life After Vedic Civilization', 'Social, Economic and Political System after the Mauryas',
      'Delhi Sultanate', 'Mughals and After Them', 'Rule of British Company',
      'British Rule and Independent India', 'Our Country: India', 'Mineral and Energy Resources of India',
      'Agriculture in India', 'Development of Industry', 'Means of Transport and Communication',
      'Population Explosion and Population Control', 'Nature of Government System',
      'Constitution of India', 'State Government', 'Democracy and Local Administration',
      'Our Advancing Steps',
    ]
    socialScienceLessons.forEach((title, index) => contents.push({ number: String(index + 1), title }))
  }
  const contentsPatterns = [
    /(\d{1,2})\)\s+(.+?)\s+\d{1,3}(?=\s+(?:\d{1,2}\)|Student(?:['’]s)? Assignment|List of|Sample Question|$))/gi,
    /(\d{1,2})\.\s+(.+?)\s+\d{1,3}(?=\s+(?:\d{1,2}\.|Assessment Paper|Examination Paper|Sample Question|Answer Key|$))/gi,
  ]
  for (const pattern of contents.length ? [] : contentsPatterns) {
    let match
    while ((match = pattern.exec(contentsText))) {
      const title = outlineText(match[2])
      if (title.length >= 3 && title.length <= 160 && /[A-Za-z]/.test(title)) contents.push({ number: match[1], title })
    }
    if (contents.length) break
  }

  let searchCursor = contentSearchStart
  for (const entry of contents) {
    const titleNeedle = outlineText(entry.title).toLowerCase().replace(/[^a-z0-9 ]/g, '')
    const significant = titleNeedle.split(' ').filter((word) => word.length > 2).slice(0, 7)
    let index = chunks.findIndex((item, chunkIndex) => {
      if (chunkIndex < searchCursor) return false
      const lines = String(item?.text || '').split(/\r?\n/).map((line) => outlineText(line).toLowerCase().replace(/[^a-z0-9 ]/g, '')).filter(Boolean)
      return lines.some((line) => line === titleNeedle || (line.startsWith(`${titleNeedle} `) && line.length <= titleNeedle.length + 24))
    })
    if (index < 0 && significant.length >= 1) index = chunks.findIndex((item, chunkIndex) => {
      if (chunkIndex < searchCursor) return false
      const beginning = outlineText(item?.text).slice(0, 900).toLowerCase().replace(/[^a-z0-9 ]/g, '')
      return significant.every((word) => beginning.includes(word))
    })
    if (index >= 0) add(`${entry.number}. ${entry.title}`, index + 1, 'lesson')
    if (index >= 0) searchCursor = index + 1
  }

  if (!sections.length) chunks.forEach((item, index) => {
    const lines = String(item?.text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    const first = lines[0] || ''
    const explicit = first.match(/^(?:lesson|chapter)\s*(\d+[A-Za-z]?)\s*[:.\-–—]?\s*(.*)$/i)
    if (explicit) add(`${outlineKind(first) === 'chapter' ? 'Chapter' : 'Lesson'} ${explicit[1]}${explicit[2] ? ` — ${explicit[2]}` : ''}`, index + 1)
  })

  if (!sections.length) {
    const name = document.name.replace(/\.[^.]+$/, '').replaceAll('_', ' ')
    add(name, 1, outlineKind(name))
  }
  return { category: category.name, document: document.stem, sections }
}

function sourceParts(relativePathValue) {
  const relativePath = String(relativePathValue || '').replace(/\\/g, '/').replace(/^\/+/, '')
  const parts = relativePath.split('/').filter(Boolean)
  if (parts.length < 2 || parts.some((part) => !part || part === '.' || part === '..')) {
    const error = new Error('The knowledge file path is invalid.'); error.status = 400; throw error
  }
  return { relativePath, parts }
}

function sourcePath(relativePathValue, config) {
  const { relativePath, parts } = sourceParts(relativePathValue)
  const root = resolve(config.knowledgeDir); const path = resolve(root, ...parts)
  if (!path.startsWith(root + sep) || !supportedKnowledgeExtensions.has(extname(path).toLowerCase())) {
    const error = new Error('This knowledge document format is not supported.'); error.status = 400; throw error
  }
  return { relativePath, parts, path }
}

export async function readKnowledgePreview(relativePathValue, config) {
  const source = sourcePath(relativePathValue, config); const extension = extname(source.path).toLowerCase()
  let path = source.path; let contentType = extension === '.pdf' ? 'application/pdf' : ''
  if (extension !== '.pdf') {
    const companion = resolve(source.path, '..', `${basename(source.path, extension)}${generatedIndexSuffix}`)
    try { await stat(companion); path = companion; contentType = 'application/pdf' }
    catch { const error = new Error('Preview will be available after this document is indexed.'); error.status = 409; throw error }
  }
  return { buffer: await readFile(path), filename: basename(path), contentType }
}

export async function updateKnowledgeSource(input, config) {
  const source = sourcePath(input?.relativePath, config)
  const extension = extname(source.path).toLowerCase()
  const category = safeSegment(input?.category || source.parts[0], 'Category')
  const collectionParts = safeFolderParts(input?.collection ?? source.parts.slice(1, -1).join('/'), 'Collection')
  const requestedName = String(input?.name || source.parts.at(-1)).trim()
  const name = safeSegment(requestedName.slice(0, requestedName.length - extname(requestedName).length), 'Document name') + extension
  const root = resolve(config.knowledgeDir); const targetFolder = resolve(root, category, ...collectionParts); const target = resolve(targetFolder, name)
  if (!target.startsWith(root + sep)) { const error = new Error('The knowledge destination is invalid.'); error.status = 400; throw error }
  await mkdir(targetFolder, { recursive: true })
  if (target.toLowerCase() !== source.path.toLowerCase()) {
    try { await stat(target); const conflict = new Error('A document with this name already exists in the destination.'); conflict.status = 409; throw conflict }
    catch (error) { if (error?.status === 409) throw error; if (error?.code !== 'ENOENT') throw error }
    await rename(source.path, target)
    await moveIfPresent(`${source.path}${metadataSuffix}`, `${target}${metadataSuffix}`)
    if (extension !== '.pdf') await moveIfPresent(resolve(source.path, '..', `${basename(source.path, extension)}${generatedIndexSuffix}`), resolve(targetFolder, `${basename(target, extension)}${generatedIndexSuffix}`))
    const artifactStem = extension === '.pdf' ? basename(source.path, extension) : `${basename(source.path, extension)}.aios-index`
    const retiredRoot = resolve(config.knowledgeTrashDir, new Date().toISOString().replace(/[:.]/g, '-'), 'Replaced Index', source.parts[0])
    for (const [folder, filename] of [['Chunks', `${artifactStem}_chunks.json`], ['Embeddings', `${artifactStem}_embeddings.npy`], ['FAISS', `${artifactStem}.index`]]) {
      await moveIfPresent(resolve(config.knowledgeIndexDir, source.parts[0], folder, filename), resolve(retiredRoot, folder, filename))
    }
    const manifest = resolve(config.knowledgeIndexDir, source.parts[0], 'Metadata', 'indexed_files.json')
    try {
      const indexed = JSON.parse(await readFile(manifest, 'utf8'))
      for (const key of Object.keys(indexed)) if (key.replace(/\\/g, '/').toLowerCase().includes(source.relativePath.toLowerCase()) || key.toLowerCase().endsWith(`/${artifactStem}.pdf`.toLowerCase())) delete indexed[key]
      await writeFile(manifest, JSON.stringify(indexed, null, 4), 'utf8')
    } catch (error) { if (error?.code !== 'ENOENT') throw error }
  }
  const metadata = { title: String(input?.title || '').trim(), description: String(input?.description || '').trim(), tags: Array.isArray(input?.tags) ? input.tags.map(String).map((tag) => tag.trim()).filter(Boolean).slice(0, 30) : [] }
  await writeFile(`${target}${metadataSuffix}`, JSON.stringify(metadata, null, 2), 'utf8')
  return { relativePath: [category, ...collectionParts, name].join('/'), ...metadata, status: 'saved' }
}

async function hashFile(path) {
  const hash = createHash('sha256')
  await new Promise((resolvePromise, reject) => { const stream = createReadStream(path); stream.on('data', (chunk) => hash.update(chunk)); stream.on('error', reject); stream.on('end', resolvePromise) })
  return hash.digest('hex')
}

export async function inspectKnowledgeHealth(config) {
  const sources = await listKnowledgeSources(config); const hashes = new Map(); let totalSizeBytes = 0; const pending = []
  for (const source of sources) {
    const path = resolve(config.knowledgeDir, ...source.relativePath.split('/')); totalSizeBytes += source.sizeBytes
    const hash = await hashFile(path); hashes.set(hash, [...(hashes.get(hash) || []), source.relativePath])
    const extension = extname(path).toLowerCase(); const artifact = extension === '.pdf' ? path : resolve(path, '..', `${basename(path, extension)}${generatedIndexSuffix}`)
    const stem = basename(artifact, '.pdf'); const chunk = resolve(config.knowledgeIndexDir, source.category, 'Chunks', `${stem}_chunks.json`)
    try { await stat(chunk) } catch { pending.push(source.relativePath) }
  }
  const duplicates = [...hashes.values()].filter((paths) => paths.length > 1)
  return { checkedAt: new Date().toISOString(), sources: sources.length, totalSizeBytes, indexed: sources.length - pending.length, pending, duplicates, healthy: pending.length === 0 && duplicates.length === 0 }
}

async function moveIfPresent(source, destination) {
  try {
    await mkdir(resolve(destination, '..'), { recursive: true })
    await rename(source, destination)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

export async function trashKnowledgeSource(relativePathValue, config) {
  const located = sourcePath(relativePathValue, config)
  const { relativePath, parts, path: source } = located
  const root = resolve(config.knowledgeDir)
  const extension = extname(source).toLowerCase()
  if (!source.startsWith(root + sep) || !supportedKnowledgeExtensions.has(extension)) {
    const error = new Error('This knowledge document format cannot be removed.')
    error.status = 400
    throw error
  }
  const category = parts[0]
  const filename = parts.at(-1)
  const stem = filename.slice(0, -extension.length)
  const artifactStem = extension === '.pdf' ? stem : `${stem}.aios-index`
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const trashRoot = resolve(config.knowledgeTrashDir, stamp)
  if (!await moveIfPresent(source, resolve(trashRoot, 'Knowledge', ...parts))) {
    const error = new Error('The knowledge document was not found.')
    error.status = 404
    throw error
  }
  await moveIfPresent(`${source}${metadataSuffix}`, resolve(trashRoot, 'Knowledge', ...parts.slice(0, -1), `${filename}${metadataSuffix}`))
  if (extension !== '.pdf') {
    const companion = resolve(source, '..', `${stem}${generatedIndexSuffix}`)
    await moveIfPresent(companion, resolve(trashRoot, 'Knowledge', ...parts.slice(0, -1), `${stem}${generatedIndexSuffix}`))
  }
  const indexCategory = resolve(config.knowledgeIndexDir, category)
  const artifacts = [
    ['Chunks', `${artifactStem}_chunks.json`],
    ['Embeddings', `${artifactStem}_embeddings.npy`],
    ['FAISS', `${artifactStem}.index`],
  ]
  for (const [folder, name] of artifacts) {
    await moveIfPresent(resolve(indexCategory, folder, name), resolve(trashRoot, 'Index', category, folder, name))
  }
  const indexedFile = resolve(indexCategory, 'Metadata', 'indexed_files.json')
  try {
    const metadata = JSON.parse(await readFile(indexedFile, 'utf8'))
    for (const key of Object.keys(metadata)) {
      const normalizedKey = key.replace(/\\/g, '/').toLowerCase()
      if (normalizedKey.endsWith('/' + relativePath.toLowerCase()) || normalizedKey.endsWith('/' + filename.toLowerCase()) ||
        normalizedKey.endsWith('/' + `${artifactStem}.pdf`.toLowerCase())) delete metadata[key]
    }
    await writeFile(indexedFile, JSON.stringify(metadata, null, 4), 'utf8')
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  return { removed: relativePath, recoverableFrom: trashRoot }
}

function safeSegment(value, label) {
  const normalized = String(value || '').trim()
  if (!normalized || normalized === '.' || normalized === '..' || /[\\/:*?"<>|]/.test(normalized)) {
    const error = new Error(`${label} contains unsupported characters.`)
    error.status = 400
    throw error
  }
  return normalized
}

export async function saveKnowledgeUpload(form, config) {
  const file = form.get('file')
  if (!file || typeof file === 'string') {
    const error = new Error('Choose a supported document to upload.')
    error.status = 400
    throw error
  }
  if (file.size > config.maxKnowledgeBytes) {
    const error = new Error('The selected knowledge file is too large.')
    error.status = 413
    throw error
  }
  const filename = basename(file.name)
  const extension = extname(filename).toLowerCase()
  if (!supportedKnowledgeExtensions.has(extension)) {
    const error = new Error('Supported formats: HTML, HTM, EPUB, DOCX, PPTX, TXT, Markdown, PDB, and PDF.')
    error.status = 400
    throw error
  }
  const category = safeSegment(form.get('category'), 'Category')
  const collectionParts = safeFolderParts(form.get('collection'), 'Collection')
  const collection = collectionParts.join('/')
  const root = resolve(config.knowledgeDir)
  const folder = resolve(root, category, ...collectionParts)
  if (folder !== root && !folder.startsWith(root + sep)) {
    const error = new Error('The knowledge destination is invalid.')
    error.status = 400
    throw error
  }
  await mkdir(folder, { recursive: true })
  const destination = resolve(folder, filename)
  await writeFile(destination, Buffer.from(await file.arrayBuffer()), { flag: 'wx' }).catch((error) => {
    if (error?.code === 'EEXIST') {
      const conflict = new Error('A file with this name already exists in that collection.')
      conflict.status = 409
      throw conflict
    }
    throw error
  })
  return { name: filename, category, collection: collection || null, size: file.size, status: 'pending_index' }
}
