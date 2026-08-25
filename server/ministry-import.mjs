import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

const sections = new Set(['recovery-bible', 'life-study', 'ministry-books'])
const formats = new Set(['.html', '.htm', '.json', '.xml'])

function decodeEntities(value) {
  return value.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
}

function textFromMarkup(value) {
  return decodeEntities(value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(?:p|div|li|h[1-6])>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+/g, ' ').replace(/\n\s+/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function titleFromMarkup(value, fallback) {
  return textFromMarkup(value.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    || value.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || fallback)
}

function normalizeJson(value, fallback) {
  const title = typeof value?.title === 'string' ? value.title : typeof value?.name === 'string' ? value.name : fallback
  const content = typeof value?.content === 'string' ? value.content
    : typeof value?.text === 'string' ? value.text : JSON.stringify(value, null, 2)
  return { title, content, metadata: typeof value?.metadata === 'object' ? value.metadata : {} }
}

function parseExport(name, raw) {
  const extension = extname(name).toLowerCase()
  if (!formats.has(extension)) throw Object.assign(new Error(`${name}: supported formats are HTML, HTM, JSON, and XML.`), { status: 400 })
  if (extension === '.json') {
    try { return normalizeJson(JSON.parse(raw), name) } catch { throw Object.assign(new Error(`${name}: invalid JSON.`), { status: 400 }) }
  }
  return { title: titleFromMarkup(raw, name), content: textFromMarkup(raw), metadata: {} }
}

function safeName(value) {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'import'
}

export async function importMinistryExports(form, config) {
  const section = String(form.get('section') || '')
  if (!sections.has(section)) throw Object.assign(new Error('Choose Recovery Bible, Life-Study, or Ministry Books.'), { status: 400 })
  const files = form.getAll('files').filter((file) => file && typeof file !== 'string')
  if (!files.length) throw Object.assign(new Error('Choose at least one authorized export file.'), { status: 400 })
  const target = join(config.ministryLibraryDir, section, 'imports')
  await mkdir(target, { recursive: true })
  const imported = []
  for (const file of files) {
    const normalized = parseExport(file.name, await file.text())
    const id = `${Date.now()}-${safeName(file.name)}`
    const record = { version: 1, id, section, sourceFile: file.name, sourceFormat: extname(file.name).slice(1).toLowerCase(), importedAt: new Date().toISOString(), ...normalized }
    await writeFile(join(target, `${id}.json`), JSON.stringify(record, null, 2), 'utf8')
    imported.push({ id, title: record.title, sourceFile: file.name, section })
  }
  return { imported: imported.length, section, items: imported }
}

async function countImports(directory) {
  try { return (await readdir(directory)).filter((name) => name.endsWith('.json')).length } catch { return 0 }
}

export async function readMinistryLibraryStatus(config) {
  const result = {}
  for (const section of sections) result[section] = { imports: await countImports(join(config.ministryLibraryDir, section, 'imports')) }
  return { sections: result, supportedFormats: ['html', 'htm', 'json', 'xml'], folder: config.ministryLibraryDir }
}
