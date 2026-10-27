import { BookOpen, Clapperboard, Download, FileText, FolderPlus, Image, Languages, Layers, Map, Mic, MonitorUp, MousePointerClick, Search, UserRoundCheck, Wrench } from 'lucide-react'
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
  { icon: Image, title: 'Project images and video', text: 'The Media tab keeps pictures, video, audio and PDFs on this computer and plays them on the projector. While one is live, the transport bar controls play, pause, restart, mute and level.' },
  { icon: Layers, title: 'PowerPoint decks', text: 'Press Make slides on a .pptx in the Media tab to put one projected image per slide into the queue. If PowerPoint is not installed, save the deck as a PDF and step through its pages.' },
  { icon: Map, title: 'Maps, streams and meetings', text: 'Web output fills the projector window with a Google Maps search, a YouTube video or live stream, a Meet, Zoom or Teams link, or any other web page.' },
  { icon: MousePointerClick, title: 'Sign in once on the projector', text: 'Audience monitor and remote mirrors the projector window and forwards your clicks and keystrokes, so a login-protected webcast is already signed in next meeting.' },
  { icon: Mic, title: 'Room audio', text: 'In Program Output choose the speaker the room uses; the microphone can be sent to that same output with a live level bar, and one button mutes the room.' },
  { icon: Clapperboard, title: 'Video training', text: 'In Ministry, open Video Training to play stored training messages and add MP4, WebM, MOV, PDF, or text handouts from this computer.' },
  { icon: BookOpen, title: 'Open a Bible chapter', text: 'The Recovery Bible opens with Book and Chapter lists, the same way Life-Study does. Type John 3:16 in the reference box to jump straight there.' },
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
