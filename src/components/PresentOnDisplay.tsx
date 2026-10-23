import { MonitorUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import './PresentOnDisplay.css'

type Display = { id: string; label: string; primary: boolean }
const PRESENTATION_DISPLAY_KEY = 'lampstand.presentation.display'
const PRESENTATION_PREFS_KEY = 'lampstand.presentation.prefs'
let browserPresentationWindow: Window | null = null

export type PresentationPayload = { title: string; subtitle?: string; html: string; displayId?: string; blank?: boolean; showTitle?: boolean; fontScale?: number; theme?: 'light' | 'dark'; transition?: 'none' | 'fade' }

export type PresentationPrefs = { showTitle: boolean; fontScale: number; theme: 'light' | 'dark'; transition: 'none' | 'fade' }

const DEFAULT_PRESENTATION_PREFS: PresentationPrefs = { showTitle: true, fontScale: 1, theme: 'light', transition: 'fade' }

const clampFontScale = (value: number) => Math.min(2, Math.max(.8, value))

export function readPresentationPrefs(): PresentationPrefs {
  let stored: Partial<PresentationPrefs> = {}
  try { stored = JSON.parse(window.localStorage.getItem(PRESENTATION_PREFS_KEY) ?? '') as Partial<PresentationPrefs> } catch { /* First run, or a value from an older build. */ }
  return {
    showTitle: stored.showTitle !== false,
    fontScale: clampFontScale(Number(stored.fontScale) || DEFAULT_PRESENTATION_PREFS.fontScale),
    theme: stored.theme === 'dark' ? 'dark' : 'light',
    transition: stored.transition === 'none' ? 'none' : 'fade',
  }
}

export function writePresentationPrefs(patch: Partial<PresentationPrefs>): PresentationPrefs {
  const next = { ...readPresentationPrefs(), ...patch, fontScale: clampFontScale(patch.fontScale ?? readPresentationPrefs().fontScale) }
  window.localStorage.setItem(PRESENTATION_PREFS_KEY, JSON.stringify(next))
  return next
}

export function resolvePresentationSettings(payload: Partial<PresentationPayload>, prefs: PresentationPrefs): PresentationPrefs {
  return {
    showTitle: payload.showTitle ?? prefs.showTitle,
    fontScale: clampFontScale(payload.fontScale ?? prefs.fontScale),
    theme: (payload.theme ?? prefs.theme) === 'dark' ? 'dark' : 'light',
    transition: (payload.transition ?? prefs.transition) === 'fade' ? 'fade' : 'none',
  }
}

const escapeText = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character] ?? character))

const audienceLayoutStyles = `html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#132238}body{display:grid;place-items:center;color:#172033}main{box-sizing:border-box;display:grid;grid-template-rows:auto minmax(0,1fr);width:min(100vw,177.7778vh);height:min(100vh,56.25vw);aspect-ratio:16/9;overflow:hidden;background:#f7f3ea;box-shadow:0 0 50px #0006}.slide-header{box-sizing:border-box;padding:clamp(18px,2.2vw,38px) clamp(34px,5vw,90px) clamp(14px,1.6vw,28px);border-bottom:clamp(2px,.18vw,4px) solid #35bdec;text-align:center;font-family:Inter,Segoe UI,sans-serif}.slide-header small{display:block;margin-bottom:.25em;color:#147aa2;font-size:clamp(14px,1.1vw,22px);font-weight:700;letter-spacing:.08em;text-transform:uppercase}.slide-header h1{margin:0;color:#172033;font-size:clamp(28px,3vw,58px);line-height:1.12}.slide-content{box-sizing:border-box;min-height:0;overflow-y:auto;scrollbar-gutter:stable;padding:clamp(26px,3.2vw,58px) clamp(46px,7vw,128px) clamp(42px,5vw,90px);font:clamp(20px,1.75vw,34px)/1.55 Georgia,'Times New Roman',serif;text-align:left}.slide-content>*{box-sizing:border-box;max-width:44em;margin-left:auto;margin-right:auto}.slide-content p,.slide-content li{width:100%}.slide-content h2,.slide-content h3{color:#0c5474;font-family:Inter,Segoe UI,sans-serif}.slide-content strong{color:#0c3853}.slide-content a{color:#047bad}body.audience-dark{background:#05070a;color:#f4f7fb}body.audience-dark main{background:#101722;box-shadow:0 0 50px #000}.audience-dark .slide-header{border-color:#58d4ff}.audience-dark .slide-header small{color:#75d8f6}.audience-dark .slide-header h1,.audience-dark .slide-content{color:#f4f7fb}.audience-dark .slide-content h2,.audience-dark .slide-content h3{color:#83dcfa}.audience-dark .slide-content strong{color:#d9f3ff}.audience-dark .slide-content a{color:#83dcfa}@keyframes audienceFadeIn{from{opacity:0}to{opacity:1}}main.audience-fade{animation:audienceFadeIn .42s ease-out both}`

const liveHighlightStyles = `mark{padding:0 .08em;border-radius:3px;color:#171717;box-decoration-break:clone;-webkit-box-decoration-break:clone;cursor:pointer}#highlight-help,#highlight-tools{position:fixed;z-index:20;font:600 14px/1.2 Inter,Segoe UI,sans-serif;box-shadow:0 8px 28px #0005}#highlight-help{left:18px;bottom:16px;padding:10px 14px;border:1px solid #ffffff55;border-radius:999px;background:#132238e8;color:#fff}#highlight-tools{left:50%;bottom:18px;transform:translateX(-50%);display:flex;align-items:center;gap:9px;padding:10px 12px;border:1px solid #ffffff66;border-radius:14px;background:#132238f5;color:#fff}#highlight-tools[hidden]{display:none}.highlight-swatch{width:30px;height:30px;padding:0;border:2px solid #fff;border-radius:50%;cursor:pointer}.highlight-remove{min-height:32px;padding:0 12px;border:1px solid #ff9b9b;border-radius:8px;background:transparent;color:#ffd0d0;cursor:pointer}.highlight-close{width:30px;height:30px;padding:0;border:0;background:transparent;color:#fff;font-size:22px;cursor:pointer}`

const liveHighlightUi = `<div id="highlight-help">Select text to highlight</div><div id="highlight-tools" hidden><span>Highlight</span><button class="highlight-swatch" data-color="#ffe066" style="background:#ffe066" aria-label="Yellow"></button><button class="highlight-swatch" data-color="#a9e5a0" style="background:#a9e5a0" aria-label="Green"></button><button class="highlight-swatch" data-color="#9ed8ff" style="background:#9ed8ff" aria-label="Blue"></button><button class="highlight-swatch" data-color="#f8b4d9" style="background:#f8b4d9" aria-label="Pink"></button><button class="highlight-swatch" data-color="#ffc98b" style="background:#ffc98b" aria-label="Orange"></button><button class="highlight-remove" type="button">Remove</button><button class="highlight-close" type="button" aria-label="Close">&times;</button></div><script>(()=>{const main=document.querySelector('main'),tools=document.getElementById('highlight-tools'),selection=()=>window.getSelection();let range=null,target=null;const hide=()=>{tools.hidden=true;range=null;target=null;selection()?.removeAllRanges()};const show=()=>{tools.hidden=false};document.addEventListener('mouseup',event=>{if(event.target.closest('#highlight-tools')||event.target.closest('mark'))return;const current=selection();if(!current||current.isCollapsed||!current.rangeCount)return;const next=current.getRangeAt(0);if(!main.contains(next.commonAncestorContainer))return;range=next.cloneRange();target=null;show()});main.addEventListener('click',event=>{const mark=event.target.closest('mark');if(!mark)return;target=mark;range=null;show();event.stopPropagation()});tools.querySelectorAll('[data-color]').forEach(button=>button.addEventListener('click',()=>{const color=button.dataset.color;if(target){target.style.backgroundColor=color}else if(range&&!range.collapsed){const mark=document.createElement('mark');mark.style.backgroundColor=color;try{mark.appendChild(range.extractContents());range.insertNode(mark)}catch{hide();return}}hide()}));tools.querySelector('.highlight-remove').addEventListener('click',()=>{if(target){const parent=target.parentNode;while(target.firstChild)parent.insertBefore(target.firstChild,target);target.remove();parent.normalize()}hide()});tools.querySelector('.highlight-close').addEventListener('click',hide);document.addEventListener('keydown',event=>{if(event.key==='Escape')hide()})})()</script>`

export async function presentOnSavedDisplay(payload: PresentationPayload) {
  const displayId = payload.displayId ?? window.localStorage.getItem(PRESENTATION_DISPLAY_KEY) ?? ''
  const settings = resolvePresentationSettings(payload, readPresentationPrefs())
  if (window.lampstandDesktop?.presentation) return window.lampstandDesktop.presentation.open({ ...payload, displayId, ...settings })
  if (!browserPresentationWindow || browserPresentationWindow.closed) browserPresentationWindow = window.open('', 'lampstand-presentation', 'popup,width=1200,height=800')
  if (!browserPresentationWindow) return false
  const transitionClass = settings.transition === 'fade' ? 'audience-fade' : ''
  browserPresentationWindow.document.open()
  browserPresentationWindow.document.write(payload.blank
    ? '<!doctype html><html><head><title>Lampstand Presentation</title><style>html,body{width:100%;height:100%;margin:0;background:#05070a}</style></head><body></body></html>'
    : `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeText(payload.title)}</title><style>${audienceLayoutStyles}${settings.showTitle ? '' : 'main{grid-template-rows:minmax(0,1fr)}.slide-header{display:none}'} .slide-content{font-size:calc(clamp(20px,1.75vw,34px)*${settings.fontScale})}${liveHighlightStyles}</style></head><body class="audience-${settings.theme}"><main class="${transitionClass}"><header class="slide-header">${payload.subtitle ? `<small>${escapeText(payload.subtitle)}</small>` : ''}<h1>${escapeText(payload.title)}</h1></header><section class="slide-content">${payload.html}</section></main>${liveHighlightUi}</body></html>`)
  browserPresentationWindow.document.close()
  browserPresentationWindow.focus()
  try { await browserPresentationWindow.document.documentElement.requestFullscreen() } catch { /* Browser fullscreen permission is controlled by the browser. */ }
  return true
}

export default function PresentOnDisplay({ title, subtitle, html, disabled = false, showTitle, fontScale, theme, transition, onPresented }: { title: string; subtitle?: string; html: string; disabled?: boolean; showTitle?: boolean; fontScale?: number; theme?: 'light' | 'dark'; transition?: 'none' | 'fade'; onPresented?: () => void }) {
  const [displays, setDisplays] = useState<Display[]>([])
  const [displayId, setDisplayId] = useState('')
  useEffect(() => {
    void window.lampstandDesktop?.presentation.getDisplays().then((items) => {
      const savedDisplayId = window.localStorage.getItem(PRESENTATION_DISPLAY_KEY)
      const selectedDisplayId = items.some((item) => item.id === savedDisplayId)
        ? savedDisplayId!
        : items.find((item) => !item.primary)?.id ?? items[0]?.id ?? ''
      setDisplays(items)
      setDisplayId(selectedDisplayId)
      if (selectedDisplayId) window.localStorage.setItem(PRESENTATION_DISPLAY_KEY, selectedDisplayId)
    })
  }, [])

  function selectDisplay(nextDisplayId: string) {
    setDisplayId(nextDisplayId)
    if (nextDisplayId) window.localStorage.setItem(PRESENTATION_DISPLAY_KEY, nextDisplayId)
  }

  async function present() {
    if (await presentOnSavedDisplay({ title, subtitle, html, displayId, showTitle, fontScale, theme, transition })) onPresented?.()
  }
  return <div className="present-on-display">
    <div className="present-on-display-heading"><MonitorUp size={17} /><span><strong>Presentation</strong><small>Fullscreen display</small></span></div>
    <label><span>Screen</span><select aria-label="Presentation monitor" value={displayId} onChange={(event) => selectDisplay(event.target.value)}>{displays.length ? displays.map((display) => <option key={display.id} value={display.id}>{display.label}</option>) : <option value="">Presentation window</option>}</select></label>
    <button type="button" disabled={disabled} onClick={() => void present()}><MonitorUp size={16} /> Take live</button>
  </div>
}
