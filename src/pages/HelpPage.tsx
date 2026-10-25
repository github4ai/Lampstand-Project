import { BookOpen, Download, FileText, FolderPlus, Languages, MonitorUp, MousePointerClick, Search, UserRoundCheck, Wrench } from 'lucide-react'
import { useState } from 'react'
import MarkdownMessage from '../components/Message/MarkdownMessage'
import installationGuide from '../../docs/INSTALLATION-GUIDE.md?raw'
import userManual from '../../docs/USER-MANUAL.md?raw'
import technicalDocumentation from '../../docs/TECHNICAL-DOCUMENTATION.md?raw'

const guides = {
  manual: { label: 'User Manual', icon: BookOpen, content: userManual, filename: 'Lampstand-Project-User-Manual.md' },
  installation: { label: 'Installation Guide', icon: Download, content: installationGuide, filename: 'Lampstand-Project-Installation-Guide.md' },
  documentation: { label: 'Documentation', icon: Wrench, content: technicalDocumentation, filename: 'Lampstand-Project-Documentation.md' },
} as const
type GuideKey = keyof typeof guides

const quickHelp = [
  { icon: FolderPlus, title: 'Custom categories', text: 'In Documents, choose Add custom category to keep personal, business, research, or other material separate.' },
  { icon: FileText, title: 'HWMR uploads', text: 'Adding a Morning Revival PDF in Documents rebuilds the HWMR reader and names any file it could not use.' },
  { icon: MonitorUp, title: 'Scripture footnotes on screen', text: 'In Presentation Studio, set Footnotes to Show before adding verses to print their Recovery Bible notes underneath.' },
  { icon: MousePointerClick, title: 'Click a verse on the projector', text: 'Verse references are live links in the preview and on the audience screen. Clicking one projects that verse alone; Return to restores the slide.' },
  { icon: Search, title: 'Find a phrase', text: 'On the Recovery Bible and Ministry Books tabs, search the exact wording of a passage. Pick a result to load it into the slide picker.' },
  { icon: UserRoundCheck, title: 'Remembered profile', text: 'Lampstand restores the last selected profile on this computer. PIN protection and assigned permissions still apply.' },
  { icon: Languages, title: 'Translation fallback', text: 'Hybrid mode tries suitable local Ollama models first, then only the cloud providers configured in Settings.' },
]

export default function HelpPage() {
  const [active, setActive] = useState<GuideKey>('manual')
  const guide = guides[active]
  function downloadGuide() {
    const url = URL.createObjectURL(new Blob([guide.content], { type: 'text/markdown;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = guide.filename; anchor.click(); URL.revokeObjectURL(url)
  }
  return <section className="help-page">
    <header><span><FileText size={27} /></span><div><h1>Help & Guides</h1><p>Read the user manual, installation instructions, and technical documentation inside Lampstand Project.</p></div></header>
    <aside className="help-quick-notes" aria-label="Common help topics">{quickHelp.map((item) => { const Icon = item.icon; return <div key={item.title}><Icon size={18} /><span><strong>{item.title}</strong><small>{item.text}</small></span></div> })}</aside>
    <nav aria-label="Lampstand guides">{Object.entries(guides).map(([key, item]) => { const Icon = item.icon; return <button type="button" className={active === key ? 'active' : ''} onClick={() => setActive(key as GuideKey)} key={key}><Icon size={16} />{item.label}</button> })}<button type="button" onClick={downloadGuide}><Download size={16} /> Download this guide</button></nav>
    <article className="help-document"><MarkdownMessage content={guide.content} /></article>
  </section>
}
