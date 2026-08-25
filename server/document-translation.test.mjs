import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadConfig } from './config.mjs'

const run = promisify(execFile)
const config = loadConfig()
let folder

beforeAll(async () => { folder = await mkdtemp(join(tmpdir(), 'aios-document-test-')) })
afterAll(async () => { if (folder) await rm(folder, { recursive: true, force: true }) })

describe('layout-aware document processor', () => {
  it('retains DOCX structure and uses the dominant run formatting', async () => {
    const source=join(folder,'source.docx'); const output=join(folder,'output.docx'); const translations=join(folder,'docx.json')
    await run(config.documentPython,['-c',`from docx import Document\nd=Document(); p=d.add_paragraph(); p.add_run('1').bold=True; p.add_run(' Main paragraph text'); d.add_table(rows=1,cols=2); d.sections[0].header.paragraphs[0].text='Header'; d.save(r'${source}')`])
    const extracted=JSON.parse((await run(config.documentPython,[config.documentTranslationScript,'extract',source])).stdout)
    await writeFile(translations,JSON.stringify(extracted.map((item)=>({...item,text:item.id.startsWith('word/header')?'Header':'Translated paragraph'}))))
    await run(config.documentPython,[config.documentTranslationScript,'apply',source,'--output',output,'--translations',translations])
    const checked=(await run(config.documentPython,['-c',`from docx import Document\nd=Document(r'${output}'); p=d.paragraphs[0]; print(len(d.tables),d.sections[0].header.paragraphs[0].text,p.text,p.runs[-1].text,p.runs[-1].bold)`])).stdout.trim()
    expect(checked).toContain('1 Header Translated paragraph Translated paragraph None')
  })

  it('retains HTML markup while replacing visible text only', async () => {
    const source=join(folder,'source.html'); const output=join(folder,'output.html'); const translations=join(folder,'html.json')
    await writeFile(source,'<!doctype html><html><style>.x{color:red}</style><body><h1 class="x">Hello</h1><p>World</p></body></html>')
    const extracted=JSON.parse((await run(config.documentPython,[config.documentTranslationScript,'extract',source])).stdout)
    await writeFile(translations,JSON.stringify(extracted.map((item,index)=>({...item,text:index?'Duniya':'Namaste'}))))
    await run(config.documentPython,[config.documentTranslationScript,'apply',source,'--output',output,'--translations',translations])
    const html=await readFile(output,'utf8')
    expect(html).toContain('<h1 class="x">Namaste</h1>'); expect(html).toContain('<style>.x{color:red}</style>')
  })

  it('retains PPTX slide geometry while translating slide text', async () => {
    const source=join(folder,'source.pptx'); const output=join(folder,'output.pptx'); const translations=join(folder,'pptx.json')
    await run(config.documentPython,['-c',`from pptx import Presentation\nfrom pptx.util import Inches\nr=Presentation(); s=r.slides.add_slide(r.slide_layouts[6]); box=s.shapes.add_textbox(Inches(1),Inches(2),Inches(5),Inches(1)); box.text_frame.paragraphs[0].text='Original title'; r.save(r'${source}')`])
    const extracted=JSON.parse((await run(config.documentPython,[config.documentTranslationScript,'extract',source])).stdout)
    await writeFile(translations,JSON.stringify(extracted.map((item)=>({...item,text:'Translated title'}))))
    await run(config.documentPython,[config.documentTranslationScript,'apply',source,'--output',output,'--translations',translations])
    const checked=(await run(config.documentPython,['-c',`from pptx import Presentation\nr=Presentation(r'${output}'); s=r.slides[0].shapes[0]; print(s.text,s.left,s.top,s.width,s.height)`])).stdout.trim()
    expect(checked).toBe('Translated title 914400 1828800 4572000 914400')
  })

  it('retains the source PDF page dimensions', async () => {
    const source=join(folder,'source.pdf'); const output=join(folder,'output.pdf'); const translations=join(folder,'pdf.json')
    await run(config.documentPython,['-c',`from reportlab.pdfgen.canvas import Canvas\nc=Canvas(r'${source}',pagesize=(400,600)); c.drawString(40,550,'Hello PDF'); c.save()`])
    const extracted=JSON.parse((await run(config.documentPython,[config.documentTranslationScript,'extract',source])).stdout)
    await writeFile(translations,JSON.stringify(extracted.map((item)=>({...item,text:'Translated PDF'}))))
    await run(config.documentPython,[config.documentTranslationScript,'apply',source,'--output',output,'--translations',translations])
    const size=(await run(config.documentPython,['-c',`from pypdf import PdfReader\np=PdfReader(r'${output}').pages[0]; print(float(p.mediabox.width),float(p.mediabox.height))`])).stdout.trim()
    expect(size).toBe('400.0 600.0')
  })
})
