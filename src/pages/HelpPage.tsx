import { BookOpen, Clapperboard, Cpu, Download, FileText, FolderPlus, Gauge, Image, Keyboard, Languages, Layers, Map, MessageSquare, Mic, MonitorUp, MousePointerClick, Palette, Search, Type, UserRoundCheck, Volume2, Wrench, ZoomIn, type LucideIcon } from 'lucide-react'
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

const tipGroups = ['Getting started', 'Reading & study', 'Building slides', 'On the projector', 'Sound & language'] as const
type TipGroup = typeof tipGroups[number]

type QuickTip = { icon: LucideIcon; title: string; text: string; group: TipGroup }

const quickHelp: QuickTip[] = [
  { icon: Cpu, group: 'Getting started', title: 'The side panel', text: 'Destinations are grouped as Meeting, Study, Assistant and App, and only the ones your profile may open appear. The assistant picker and your saved conversations show on the Chat page. Pinned at the bottom, This computer reports what the graphics card, processor and memory are doing and how much Lampstand itself is holding - it refreshes every few seconds, and a bar turns amber then red as it fills. Rest the pointer on a row for the full name and figures.' },
  { icon: UserRoundCheck, group: 'Getting started', title: 'Remembered profile', text: 'Lampstand restores the last selected profile on this computer. PIN protection and assigned permissions still apply.' },
  { icon: Type, group: 'Getting started', title: 'Text size', text: 'Labels, lists and buttons across the app keep a readable minimum size, and entry fields are set a step larger. The Bible and ministry-book readers have their own text-size control, and audience slides follow the size you choose in Output.' },
  { icon: Palette, group: 'Getting started', title: 'Light, dark, or the device setting', text: 'In Settings, under Appearance and reading, Colour mode either follows Windows or keeps the app Light or Dark. Following Windows is live: change the PC theme and the app changes with it, no restart. Whichever you choose, the side panel, the page beside it, the tables, buttons and status marks all change together, and Accent colour recolours the highlights, the links and the destination you are on straight away. The Bible, HWMR and ministry-book readers keep their paper look in either mode, and the projector shows whatever slide theme you picked in Output.' },
  { icon: FolderPlus, group: 'Reading & study', title: 'Custom categories', text: 'In Documents, choose Add custom category to keep personal, business, research, or other material separate.' },
  { icon: FileText, group: 'Reading & study', title: 'HWMR uploads', text: 'Adding a Morning Revival PDF in Documents rebuilds the HWMR reader and names any file it could not use.' },
  { icon: Search, group: 'Reading & study', title: 'Find a phrase', text: 'On the Recovery Bible and Ministry Books tabs, search the exact wording of a passage. Pick a result to load it into the slide picker.' },
  { icon: BookOpen, group: 'Reading & study', title: 'Open a Bible chapter', text: 'The Recovery Bible opens with Book and Chapter lists, the same way Life-Study does. Type John 3:16 in the reference box to jump straight there.' },
  { icon: MessageSquare, group: 'Reading & study', title: 'Ask the Ministry Assistant', text: 'On the Chat page, pick Ministry Assistant and ask in your own words. It reads only the ministry documents indexed on this computer and lists the book and passage each answer came from, so you can open what it quotes. The buttons under the box - All Ministry, Recovery Bible, HWMR, Life-Study, Ministry Books, Hymnal - choose which shelf it reads; if that shelf holds nothing on the subject it says so plainly instead of quoting something nearby. An exact reference such as John 3:16 opens straight from the Recovery Bible. General Assistant answers from the language model alone and never quotes your books, and Web searches the internet once you have put a search key in Settings.' },
  { icon: Clapperboard, group: 'Reading & study', title: 'Video training', text: 'In Ministry, open Video Training to play stored training messages and add MP4, WebM, MOV, PDF, or text handouts from this computer.' },
  { icon: MousePointerClick, group: 'Reading & study', title: 'New conversation', text: 'In the side panel, New conversation opens Chat with a fresh session for the assistant you have picked. If the conversation on screen is still untouched it keeps that one instead of adding an identical second session, and tells you so. It waits while an answer is still being written - stop that answer first. When it says no assistant is connected, the AI service has not answered or your profile may not open Chat; the status card at the bottom of the panel re-checks the connection.' },
  { icon: MonitorUp, group: 'Building slides', title: 'Scripture footnotes on screen', text: 'In Presentation Studio, set Footnotes to Show before adding verses to print their Recovery Bible notes underneath.' },
  { icon: Type, group: 'Building slides', title: 'Format a portion or an announcement', text: 'On the Custom portion and Announcements tabs, type or paste the text and select the words to make them bold, italic, underlined, bigger, coloured, highlighted, a heading or a list, or to give them a typeface from the fonts installed on this computer. Pasting from Word keeps its typography. The alignment marks set the line the caret is on, the last menu sets the room between the lines of the whole slide, and the window opens taller by dragging its bottom edge. Everything you format travels onto the projector.' },
  { icon: Gauge, group: 'Building slides', title: 'One rail runs the projector', text: 'In Program Output, Preview cues the next slide and picks the screen, Live steps what the audience sees and takes the cue on air, and Output sets the title, text size, theme and fade. The preview pane is what the room will see, not a sketch of it: change the text size or light/dark there and the preview redraws at once, and hiding the title drops its line out of the preview too - so a size can be chosen by looking at the console before anything goes on air. Every icon says what it does when you rest the pointer on it.' },
  { icon: Keyboard, group: 'Building slides', title: 'Work the run of show without the mouse', text: 'Tab walks the queue: Enter or Space on a row previews that slide, and the Move up, Move down, Duplicate and Delete buttons beside its title run the same way. Focus stays on the button you pressed, so holding Enter walks one slide through the order.' },
  { icon: MousePointerClick, group: 'On the projector', title: 'Click a verse on the projector', text: 'Verse references are live links in the preview and on the audience screen. Clicking one projects that verse alone; Return to restores the slide.' },
  { icon: Image, group: 'On the projector', title: 'Project images and video', text: 'The Media tab keeps pictures, video, audio and PDFs on this computer and plays them on the projector. Press Project and the slide appears in Program Output ready but not on air; nothing starts playing there, only on the audience screen when you Take live. While one is live, the transport bar shows the time and a bar you can drag to any moment, with play, restart, mute and level. Media opens at one fifth volume and remembers what you last set.' },
  { icon: ZoomIn, group: 'On the projector', title: 'Zoom a projected picture', text: 'While an image, a PDF page or a PowerPoint slide is on air, the transport bar has zoom. Each press enlarges the frame by a quarter, centred, and the projector cuts off what runs past its edges; Whole frame puts it back. Zooming changes only the picture - the sound keeps playing and your run of show is untouched.' },
  { icon: Layers, group: 'On the projector', title: 'PowerPoint decks', text: 'On the Media tab, choose the PowerPoint filter. A .pptx you add there turns into one full-screen image per slide and queues the whole deck as a single entry. While it is live, the console arrows step it slide by slide. If PowerPoint is not installed, save the deck as a PDF and step through its pages.' },
  { icon: MonitorUp, group: 'On the projector', title: 'A media file that has gone', text: 'Media is read from this computer at the moment it is projected. If a file was deleted or moved after you queued it, taking the slide live tells you on the console - naming the tab that puts it back - instead of the audience screen quietly going black.' },
  { icon: Map, group: 'On the projector', title: 'Maps, streams and meetings', text: 'Web output fills the projector window with a Google Maps search, a YouTube video or live stream, a Meet, Zoom or Teams link, or any other web page. Open on my screen puts it on your own display first - sign in, choose a seat, frame the map - and the room sees it only when you press Take it live. Until then the page can be reloaded, stepped back and forward, or closed without the audience screen changing.' },
  { icon: MousePointerClick, group: 'On the projector', title: 'Sign in once on the projector', text: 'The projector keeps its own web profile, separate from the studio. Sign in on the page you opened on your screen, or use Audience monitor and remote to work the projector directly, and the next meeting opens already logged in. Lampstand never stores, sends or records the password.' },
  { icon: Mic, group: 'Sound & language', title: 'Room audio', text: 'In Program Output choose the speaker the room uses; the microphone can be sent to that same output with a live level bar, and one button mutes the room. A projected web page - a stream, a meeting - leaves through that speaker too, at the console media level. A projected video or song plays through the output Windows gives the projector, so point that at the room as well.' },
  { icon: Mic, group: 'Sound & language', title: 'Voice Studio', text: 'If the separate Voice Studio program is running on this computer, Lampstand transcribes recordings with it and makes spoken English audio with it - Language Tools names the provider that answered each result. Closed, transcription falls back to Local Whisper. Pronunciation of translated text does not go through it: that uses the voices installed in Windows, or Microsoft online voices when Windows has none, because Voice Studio is verified for English only.' },
  { icon: Volume2, group: 'Sound & language', title: 'When Pronounce stays silent', text: 'Pronunciation asks a voice installed in Windows first. For most Indian languages Windows has none, so with Online fallback for missing voices checked the words go to a Microsoft neural voice instead, and the line under the translation names whichever one answered. If nothing plays, the message beside the button says why: online voices are off and no Windows voice exists, Windows listed a voice it did not deliver, this computer cannot reach the voice service, or Python is not installed on this computer at all. Manage Windows voices opens the place to add one, and Refresh voices re-reads them afterwards.' },
  { icon: Languages, group: 'Sound & language', title: 'Translation fallback', text: 'Hybrid mode tries suitable local Ollama models first, then only the cloud providers configured in Settings.' },
]

export default function HelpPage() {
  const [active, setActive] = useState<GuideKey>('manual')
  const [tipsOpen, setTipsOpen] = useState(false)
  const [tipQuery, setTipQuery] = useState('')
  const guide = guides[active]
  const query = tipQuery.trim().toLowerCase()
  const matchedTips = query
    ? quickHelp.filter((tip) => `${tip.title} ${tip.text}`.toLowerCase().includes(query))
    : quickHelp
  const showTips = tipsOpen || query.length > 0
  function downloadGuide() {
    const url = URL.createObjectURL(new Blob([guide.content], { type: 'text/markdown;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = guide.filename; anchor.click(); URL.revokeObjectURL(url)
  }
  return <section className="help-page">
    <header><span><FileText size={27} /></span><div><h1>Help & Guides</h1><p>Read the user manual, installation instructions, and technical documentation inside Lampstand Project.</p></div></header>
    <nav aria-label="Lampstand guides">{Object.entries(guides).map(([key, item]) => { const Icon = item.icon; return <button type="button" className={active === key ? 'active' : ''} onClick={() => setActive(key as GuideKey)} key={key}><Icon size={16} />{item.label}</button> })}<button type="button" onClick={downloadGuide}><Download size={16} /> Download this guide</button></nav>
    <article className="help-document"><MarkdownMessage content={guide.content} /></article>
    <section className="help-tips" aria-label="Quick tips">
      <div className="help-tips-bar">
        <h2>Quick tips</h2>
        <label className="help-tips-search"><Search size={15} /><input type="search" value={tipQuery} onChange={(event) => setTipQuery(event.target.value)} placeholder="Search the tips" aria-label="Search quick tips" /></label>
        <button type="button" className="help-tips-toggle" aria-expanded={showTips} onClick={() => setTipsOpen((open) => !open)}>{tipsOpen ? 'Hide tips' : `Show ${quickHelp.length} tips`}</button>
      </div>
      {showTips && (
        <div className="help-tips-body">
          {matchedTips.length === 0 && <p className="help-tips-empty">No tip mentions &ldquo;{tipQuery.trim()}&rdquo;.</p>}
          {tipGroups.map((group) => {
            const tips = matchedTips.filter((tip) => tip.group === group)
            if (tips.length === 0) { return null }
            return <div className="help-tips-group" key={group}>
              <h3>{group}</h3>
              <div className="help-quick-notes">{tips.map((item) => { const Icon = item.icon; return <div key={item.title}><Icon size={18} /><span><strong>{item.title}</strong><small>{item.text}</small></span></div> })}</div>
            </div>
          })}
        </div>
      )}
    </section>
  </section>
}
