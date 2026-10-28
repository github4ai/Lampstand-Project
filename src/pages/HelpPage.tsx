import { BookOpen, Clapperboard, Download, FileText, FolderPlus, Gauge, Image, Keyboard, Languages, Layers, Map, Mic, MonitorUp, MousePointerClick, Search, Type, UserRoundCheck, Wrench, ZoomIn } from 'lucide-react'
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
  { icon: Image, title: 'Project images and video', text: 'The Media tab keeps pictures, video, audio and PDFs on this computer and plays them on the projector. Press Project and the slide appears in Program Output ready but not on air; nothing starts playing there, only on the audience screen when you Take live. While one is live, the transport bar shows the time and a bar you can drag to any moment, with play, restart, mute and level. Media opens at one fifth volume and remembers what you last set.' },
  { icon: ZoomIn, title: 'Zoom a projected picture', text: 'While an image, a PDF page or a PowerPoint slide is on air, the transport bar has zoom. Each press enlarges the frame by a quarter, centred, and the projector cuts off what runs past its edges; Whole frame puts it back. Zooming changes only the picture - the sound keeps playing and your run of show is untouched.' },
  { icon: Layers, title: 'PowerPoint decks', text: 'On the Media tab, choose the PowerPoint filter. A .pptx you add there turns into one full-screen image per slide and queues the whole deck as a single entry. While it is live, the console arrows step it slide by slide. If PowerPoint is not installed, save the deck as a PDF and step through its pages.' },
  { icon: MonitorUp, title: 'A media file that has gone', text: 'Media is read from this computer at the moment it is projected. If a file was deleted or moved after you queued it, taking the slide live tells you on the console - naming the tab that puts it back - instead of the audience screen quietly going black.' },
  { icon: Gauge, title: 'One rail runs the projector', text: 'In Program Output, Preview cues the next slide and picks the screen, Live steps what the audience sees and takes the cue on air, and Output sets the title, text size, theme and fade. Every icon says what it does when you rest the pointer on it.' },
  { icon: Keyboard, title: 'Work the run of show without the mouse', text: 'Tab walks the queue: Enter or Space on a row previews that slide, and the Move up, Move down, Duplicate and Delete buttons beside its title run the same way. Focus stays on the button you pressed, so holding Enter walks one slide through the order.' },
  { icon: Type, title: 'Format a portion or an announcement', text: 'On the Custom portion and Announcements tabs, type or paste the text and select the words to make them bold, italic, underlined, bigger, coloured, highlighted, a heading or a list, or to give them a typeface from the fonts installed on this computer. Pasting from Word keeps its typography. The alignment marks set the line the caret is on, the last menu sets the room between the lines of the whole slide, and the window opens taller by dragging its bottom edge. Everything you format travels onto the projector.' },
  { icon: Map, title: 'Maps, streams and meetings', text: 'Web output fills the projector window with a Google Maps search, a YouTube video or live stream, a Meet, Zoom or Teams link, or any other web page. Open on my screen puts it on your own display first - sign in, choose a seat, frame the map - and the room sees it only when you press Take it live. Until then the page can be reloaded, stepped back and forward, or closed without the audience screen changing.' },
  { icon: MousePointerClick, title: 'Sign in once on the projector', text: 'The projector keeps its own web profile, separate from the studio. Sign in on the page you opened on your screen, or use Audience monitor and remote to work the projector directly, and the next meeting opens already logged in. Lampstand never stores, sends or records the password.' },
  { icon: Mic, title: 'Room audio', text: 'In Program Output choose the speaker the room uses; the microphone can be sent to that same output with a live level bar, and one button mutes the room. A projected web page - a stream, a meeting - leaves through that speaker too, at the console media level. A projected video or song plays through the output Windows gives the projector, so point that at the room as well.' },
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
