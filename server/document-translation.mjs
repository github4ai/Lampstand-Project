import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { spawn } from 'node:child_process'
import { translateWithProviders } from './providers.mjs'

const supported = new Set(['.docx', '.pptx', '.pdf', '.txt', '.md', '.html', '.htm'])
const run = (python, args) => new Promise((resolve, reject) => {
  const child=spawn(python,args,{windowsHide:true}); let out=''; let error=''
  child.stdout.on('data',x=>out+=x); child.stderr.on('data',x=>error+=x)
  child.on('error',reject); child.on('close',code=>code===0?resolve(out):reject(new Error(error.trim()||`Document processor exited with ${code}.`)))
})

export async function translateDocument(form, config) {
  const file=form.get('file'); const sourceLanguage=String(form.get('sourceLanguage')||'auto'); const targetLanguage=String(form.get('targetLanguage')||'')
  if (!file || typeof file==='string') throw Object.assign(new Error('Document file is required.'),{status:400})
  const extension=extname(file.name).toLowerCase()
  if (extension === '.ppt') throw Object.assign(new Error('Legacy PPT files must be saved as PPTX before translation. PowerPoint can convert them with File > Save As > PowerPoint Presentation (.pptx).'),{status:400})
  if (!supported.has(extension)) throw Object.assign(new Error('Supported formats: DOCX, PPTX, PDF, TXT, Markdown, HTML, and HTM.'),{status:400})
  if (file.size>config.maxDocumentBytes) throw Object.assign(new Error('Document is larger than the 50 MB limit.'),{status:413})
  const folder=await mkdtemp(join(tmpdir(),'aios-document-')); const source=join(folder,`source${extension}`); const output=join(folder,`translated${extension}`); const translationsFile=join(folder,'translations.json')
  try {
    await writeFile(source,Buffer.from(await file.arrayBuffer()))
    const segments=JSON.parse(await run(config.documentPython,[config.documentTranslationScript,'extract',source]))
    if (!segments.length) throw new Error('No translatable text was found. Scanned PDFs require OCR before translation.')
    const translated=[]
    for (const segment of segments) {
      const chunks=segment.text.match(/[\s\S]{1,6000}/g)||[]; const parts=[]
      for (const text of chunks) parts.push((await translateWithProviders({text,sourceLanguage,targetLanguage},config)).translatedText)
      translated.push({...segment,text:parts.join('\n')})
    }
    await writeFile(translationsFile,JSON.stringify(translated),'utf8')
    await run(config.documentPython,[config.documentTranslationScript,'apply',source,'--output',output,'--translations',translationsFile])
    const contentTypes={'.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation','.html':'text/html; charset=utf-8','.htm':'text/html; charset=utf-8','.md':'text/markdown; charset=utf-8','.txt':'text/plain; charset=utf-8'}
    return { buffer:await readFile(output), filename:`${basename(file.name,extension)}-${targetLanguage}${extension}`, contentType:contentTypes[extension], segments:translated.length, fidelity:['.docx','.pptx','.html','.htm'].includes(extension)?'native':'best-effort' }
  } finally { await rm(folder,{recursive:true,force:true}) }
}
