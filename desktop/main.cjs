const { app, BrowserWindow, dialog, ipcMain, screen, session, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const { createServer } = require('node:http')
const { appendFileSync, createReadStream, existsSync, mkdirSync, statSync } = require('node:fs')
const { cp, mkdir, readFile, rename, rm, writeFile } = require('node:fs/promises')
const { createHash } = require('node:crypto')
const { extname, join, normalize } = require('node:path')
const { pathToFileURL } = require('node:url')
const { spawn } = require('node:child_process')

const REQUESTED_WEB_PORT = process.env.LAMPSTAND_WEB_PORT
  ? Number(process.env.LAMPSTAND_WEB_PORT)
  : app.isPackaged ? 0 : 5173
const API_PORT = Number(process.env.LAMPSTAND_API_PORT || 9656)
/** Set by scripts/desktop-dev.ps1: load Vite's dev server, so a save reaches the window without a build. */
const DEV_URL = app.isPackaged ? '' : String(process.env.LAMPSTAND_DEV_URL || '').trim()
// A projected video or stream starts with the slide, not with a click on the audience screen.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
const AUDIENCE_PARTITION = 'persist:lampstand-audience'
/** Projected media opens quiet so a video never blasts the room; the console Level slider raises it from here. */
const DEFAULT_MEDIA_LEVEL = .2
// The studio remote may drive a web page on the audience screen; only these keys ever reach it.
const KEYS = { enter: 'Enter', tab: 'Tab', escape: 'Escape', backspace: 'Backspace', space: 'Space', delete: 'Delete', home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown', arrowup: 'Up', arrowdown: 'Down', arrowleft: 'Left', arrowright: 'Right' }
let webPort = REQUESTED_WEB_PORT
let webServer
let gatewayServer
let serviceProcess
let mainWindow
let presentationWindow
/** True once a slide is on the projector, so a swap knows there is something to fade out. */
let audienceHasContent = false
let stagingWindow
let updateState = { status: 'idle', currentVersion: app.getVersion(), availableVersion: null, percent: 0, message: 'Ready to check for updates.' }
let libraryUpdateState = { status: 'idle', installedVersion: null, availableVersion: null, percent: 0, message: 'Ready to check library updates.', manifestUrl: '' }

function libraryStateFile() { return join(app.getPath('userData'), 'data', 'library-update.json') }
function libraryOverrideRoot() { return join(app.getPath('userData'), 'data', 'library-overrides') }
function localKnowledgeRoot() { return join(app.getPath('userData'), 'data', 'knowledge') }
function localKnowledgeIndexRoot() { return join(app.getPath('userData'), 'data', 'knowledge-index') }
async function loadLibraryState() {
  try { libraryUpdateState = { ...libraryUpdateState, ...JSON.parse(await readFile(libraryStateFile(), 'utf8')) } } catch { /* first run */ }
  return libraryUpdateState
}
async function saveLibraryState() {
  await mkdir(join(app.getPath('userData'), 'data'), { recursive: true })
  await writeFile(libraryStateFile(), JSON.stringify(libraryUpdateState, null, 2), 'utf8')
}
function publishLibraryState(changes = {}) {
  libraryUpdateState = { ...libraryUpdateState, ...changes }
  void saveLibraryState()
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('lampstand:library-status', libraryUpdateState)
  return libraryUpdateState
}
function safeLibraryPath(relativePath) {
  const normalizedPath = normalize(String(relativePath || '')).replace(/^([/\\])+/, '')
  if (!normalizedPath || normalizedPath.includes('..') || !normalizedPath.toLowerCase().startsWith(`data${require('node:path').sep}`)) throw new Error(`Unsafe library path: ${relativePath}`)
  return normalizedPath
}
async function fetchLibraryManifest(url) {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:') throw new Error('The library manifest must use HTTPS.')
  const response = await fetch(parsed, { headers: { 'User-Agent': `Lampstand-Project/${app.getVersion()}` } })
  if (!response.ok) throw new Error(`Library server returned ${response.status}.`)
  const manifest = await response.json()
  if (!manifest || typeof manifest.version !== 'string' || !Array.isArray(manifest.files)) throw new Error('The library manifest is invalid.')
  return manifest
}
function libraryDestination(relativePath, overrideRoot = libraryOverrideRoot(), knowledgeRoot = localKnowledgeRoot()) {
  const relative = safeLibraryPath(relativePath)
  const knowledgePrefix = join('data', 'knowledge') + require('node:path').sep
  if (relative.toLowerCase().startsWith(knowledgePrefix.toLowerCase())) {
    return join(knowledgeRoot, relative.slice(knowledgePrefix.length))
  }
  return join(overrideRoot, relative)
}
function configureLibraryUpdater() {
  void loadLibraryState()
  ipcMain.handle('lampstand:library-state', async () => loadLibraryState())
  ipcMain.handle('lampstand:set-library-manifest', async (_event, url) => publishLibraryState({ manifestUrl: String(url || '').trim(), message: 'Library update location saved.' }))
  ipcMain.handle('lampstand:check-library-update', async () => {
    try {
      publishLibraryState({ status: 'checking', message: 'Checking for library updates…', percent: 0 })
      if (!libraryUpdateState.manifestUrl) throw new Error('Add the secure library manifest address first.')
      const manifest = await fetchLibraryManifest(libraryUpdateState.manifestUrl)
      return publishLibraryState({ status: manifest.version === libraryUpdateState.installedVersion ? 'current' : 'available', availableVersion: manifest.version, message: manifest.version === libraryUpdateState.installedVersion ? 'Libraries are up to date.' : `Library ${manifest.version} is available.` })
    } catch (error) { return publishLibraryState({ status: 'error', message: error instanceof Error ? error.message : String(error) }) }
  })
  ipcMain.handle('lampstand:download-library-update', async () => {
    const root = libraryOverrideRoot(); const staging = `${root}.staging`
    const knowledgeStaging = `${localKnowledgeRoot()}.staging`
    try {
      const manifest = await fetchLibraryManifest(libraryUpdateState.manifestUrl)
      await rm(staging, { recursive: true, force: true }); await mkdir(staging, { recursive: true })
      await rm(knowledgeStaging, { recursive: true, force: true }); await mkdir(knowledgeStaging, { recursive: true })
      let knowledgeChanged = false
      let completed = 0
      for (const entry of manifest.files) {
        const relative = safeLibraryPath(entry.path)
        const source = new URL(entry.url, libraryUpdateState.manifestUrl)
        if (source.protocol !== 'https:') throw new Error(`Library file must use HTTPS: ${entry.path}`)
        const response = await fetch(source, { headers: { 'User-Agent': `Lampstand-Project/${app.getVersion()}` } })
        if (!response.ok) throw new Error(`Unable to download ${entry.path} (${response.status}).`)
        const bytes = Buffer.from(await response.arrayBuffer())
        if (entry.sha256 && createHash('sha256').update(bytes).digest('hex').toLowerCase() !== String(entry.sha256).toLowerCase()) throw new Error(`Security check failed for ${entry.path}.`)
        const destination = libraryDestination(relative, staging, knowledgeStaging); await mkdir(require('node:path').dirname(destination), { recursive: true }); await writeFile(destination, bytes)
        if (relative.toLowerCase().startsWith((join('data', 'knowledge') + require('node:path').sep).toLowerCase())) knowledgeChanged = true
        completed += 1; publishLibraryState({ status: 'downloading', percent: Math.round((completed / manifest.files.length) * 100), message: `Updating libraries… ${completed} of ${manifest.files.length}` })
      }
      await rm(root, { recursive: true, force: true }); await rename(staging, root)
      if (knowledgeChanged) await cp(knowledgeStaging, localKnowledgeRoot(), { recursive: true, force: true })
      await rm(knowledgeStaging, { recursive: true, force: true })
      return publishLibraryState({ status: 'ready', installedVersion: manifest.version, availableVersion: manifest.version, percent: 100, knowledgeChanged, message: knowledgeChanged ? 'Library files installed. Preparing the searchable knowledge index is recommended.' : 'Library update installed. Reload Lampstand Project to use it.' })
    } catch (error) {
      await rm(staging, { recursive: true, force: true }).catch(() => {})
      await rm(knowledgeStaging, { recursive: true, force: true }).catch(() => {})
      return publishLibraryState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  })
}

function publishUpdateState(changes = {}) {
  updateState = { ...updateState, ...changes, currentVersion: app.getVersion() }
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('lampstand:update-status', updateState)
  return updateState
}

function configureUpdater() {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false
  autoUpdater.on('checking-for-update', () => publishUpdateState({ status: 'checking', message: 'Checking GitHub Releases…', percent: 0 }))
  autoUpdater.on('update-available', (info) => publishUpdateState({ status: 'downloading', availableVersion: info.version, percent: 0, message: `Lampstand Project ${info.version} is available and is downloading…` }))
  autoUpdater.on('update-not-available', () => publishUpdateState({ status: 'current', availableVersion: null, message: 'Lampstand Project is up to date.', percent: 0 }))
  autoUpdater.on('download-progress', (progress) => publishUpdateState({ status: 'downloading', percent: Math.round(progress.percent), message: `Downloading update… ${Math.round(progress.percent)}%` }))
  autoUpdater.on('update-downloaded', async (info) => {
    publishUpdateState({ status: 'ready', availableVersion: info.version, percent: 100, message: 'Update downloaded. Restart Lampstand Project to install it.' })
    const response = await dialog.showMessageBox(mainWindow, {
      type: 'info', title: 'Lampstand Project update ready',
      message: `Version ${info.version} is ready to install.`,
      detail: 'Restart now to complete the update. Personal reading progress, annotations, comments, profiles, and settings will be preserved.',
      buttons: ['Restart and install', 'Later'], defaultId: 0, cancelId: 1, noLink: true,
    })
    if (response.response === 0) setImmediate(() => autoUpdater.quitAndInstall(false, true))
  })
  autoUpdater.on('error', (error) => publishUpdateState({ status: 'error', message: error instanceof Error ? error.message : String(error) }))
  ipcMain.handle('lampstand:update-state', () => updateState)
  ipcMain.handle('lampstand:check-update', async () => {
    if (!app.isPackaged) return publishUpdateState({ status: 'development', message: 'Updates are available in installed releases.' })
    await autoUpdater.checkForUpdates()
    return updateState
  })
  ipcMain.handle('lampstand:download-update', async () => {
    if (app.isPackaged) await autoUpdater.downloadUpdate()
    return updateState
  })
  ipcMain.handle('lampstand:install-update', () => {
    if (app.isPackaged) setImmediate(() => autoUpdater.quitAndInstall(false, true))
    return true
  })
  ipcMain.handle('lampstand:reinstall-current', async () => {
    if (!app.isPackaged) return false
    const version = app.getVersion()
    const installer = `Lampstand-Project-Setup-${version}.exe`
    await shell.openExternal(`https://github.com/github4ai/Lampstand-Project/releases/download/v${version}/${installer}`)
    return true
  })
}

// The studio microphone and a web page on the audience screen both need media access; nothing else is granted.
function configureMediaPermissions() {
  const allowed = new Set(['media', 'mediaKeySystem', 'fullscreen'])
  const grant = (_webContents, permission, callback) => callback(allowed.has(permission))
  session.defaultSession.setPermissionRequestHandler(grant)
  session.fromPartition(AUDIENCE_PARTITION).setPermissionRequestHandler(grant)
}

function configurePresentationWindows() {
  ipcMain.handle('lampstand:presentation-displays', () => {
    const primaryId = screen.getPrimaryDisplay().id
    return screen.getAllDisplays().map((display, index) => ({ id: String(display.id), label: `${display.id === primaryId ? 'Main display' : `Display ${index + 1}`} · ${display.workAreaSize.width} × ${display.workAreaSize.height}`, primary: display.id === primaryId }))
  })
  const audienceBounds = (payload) => {
    const displays = screen.getAllDisplays(); const primary = screen.getPrimaryDisplay()
    const selected = displays.find((display) => String(display.id) === String(payload.displayId)) || displays.find((display) => display.id !== primary.id) || primary
    const { x, y, width, height } = selected.bounds
    return { x, y, width, height }
  }
  const audienceWindowFor = (payload) => {
    if (presentationWindow && !presentationWindow.isDestroyed()) {
      presentationWindow.setFullScreen(false)
      presentationWindow.setBounds(audienceBounds(payload))
      presentationWindow.setTitle(String(payload.title || 'Lampstand presentation'))
      presentationWindow.setMenuBarVisibility(false)
      return presentationWindow
    }
    presentationWindow = new BrowserWindow({ ...audienceBounds(payload), title: String(payload.title || 'Lampstand presentation'), backgroundColor: '#f5f1e8', frame: false, fullscreen: true, autoHideMenuBar: true, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, partition: AUDIENCE_PARTITION, preload: join(__dirname, 'presentation-preload.cjs') } })
    presentationWindow.setMenuBarVisibility(false)
    presentationWindow.on('closed', () => { presentationWindow = undefined; audienceHasContent = false })
    return presentationWindow
  }
  // A web source keeps its own signed-in session, so a login done once here is still valid next meeting.
  ipcMain.handle('lampstand:open-presentation-web', (_event, payload = {}) => {
    const target = /^https?:\/\/\S+$/i.test(String(payload.url || '').trim()) ? String(payload.url).trim() : ''
    if (!target) return false
    const output = audienceWindowFor({ ...payload, title: payload.title || 'Lampstand web output' })
    void output.loadURL(target).then(() => {
      if (output.isDestroyed()) return
      output.show(); output.setFullScreen(true); output.focus()
    })
    return true
  })
  // Web output is signed in and chosen on the operator's own screen first. The projector stays
  // dark until Take live, which loads the same address into the audience window's shared session.
  const stagingWindowFor = () => {
    if (stagingWindow && !stagingWindow.isDestroyed()) return stagingWindow
    const { x, y, width, height } = screen.getPrimaryDisplay().workArea
    stagingWindow = new BrowserWindow({
      x: Math.round(x + width * 0.1), y: Math.round(y + height * 0.08), width: Math.round(width * 0.72), height: Math.round(height * 0.78),
      title: 'Lampstand - staged web output', backgroundColor: '#101b2d', autoHideMenuBar: true, show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, partition: AUDIENCE_PARTITION, preload: join(__dirname, 'presentation-preload.cjs') },
    })
    stagingWindow.setMenuBarVisibility(false)
    // Sign-in flows pop their own window; the child keeps this partition, so the session lands here.
    stagingWindow.setWindowOpenHandler(({ url }) => (/^https?:\/\//i.test(url) ? { action: 'allow', overrideBrowserWindowOptions: { width: 900, height: 700, autoHideMenuBar: true } } : { action: 'deny' }))
    stagingWindow.on('page-title-updated', (event, title) => { event.preventDefault(); stagingWindow?.setTitle(`Lampstand - ${title}`) })
    stagingWindow.on('closed', () => { stagingWindow = undefined })
    return stagingWindow
  }
  ipcMain.handle('lampstand:stage-web', (_event, payload = {}) => {
    const target = /^https?:\/\/\S+$/i.test(String(payload.url || '').trim()) ? String(payload.url).trim() : ''
    if (!target) return false
    const stage = stagingWindowFor()
    void stage.loadURL(target)
    stage.show(); stage.focus()
    return true
  })
  ipcMain.handle('lampstand:stage-state', () => {
    if (!stagingWindow || stagingWindow.isDestroyed()) return { open: false, url: '', title: '', loading: false, canGoBack: false, canGoForward: false }
    const contents = stagingWindow.webContents
    return { open: true, url: contents.getURL(), title: contents.getTitle(), loading: contents.isLoading(), canGoBack: contents.navigationHistory.canGoBack(), canGoForward: contents.navigationHistory.canGoForward() }
  })
  ipcMain.handle('lampstand:stage-capture', async () => {
    if (!stagingWindow || stagingWindow.isDestroyed()) return ''
    const image = await stagingWindow.webContents.capturePage().catch(() => null)
    return image ? image.toDataURL() : ''
  })
  ipcMain.handle('lampstand:stage-command', (_event, payload = {}) => {
    if (!stagingWindow || stagingWindow.isDestroyed()) return false
    const contents = stagingWindow.webContents
    const action = String(payload.action || '')
    if (action === 'reload') return contents.reload(), true
    if (action === 'back') return contents.navigationHistory.canGoBack() ? (contents.goBack(), true) : false
    if (action === 'forward') return contents.navigationHistory.canGoForward() ? (contents.goForward(), true) : false
    if (action === 'close') return stagingWindow.close(), true
    return false
  })
  ipcMain.handle('lampstand:presentation-command', async (_event, payload = {}) => {
    const contents = presentationWindow && !presentationWindow.isDestroyed() ? presentationWindow.webContents : null
    if (!contents || contents.isDestroyed()) return false
    const action = String(payload.action || '')
    if (action === 'reload') return contents.reload(), true
    if (action === 'back') return contents.navigationHistory.canGoBack() ? (contents.goBack(), true) : false
    if (action === 'forward') return contents.navigationHistory.canGoForward() ? (contents.goForward(), true) : false
    // The one number the console sends is a 0-1 amount: a level for volume, a fraction for seek.
    const amount = Math.min(1, Math.max(0, Number(payload.value) || 0))
    // One element is the live one: whichever is playing, otherwise the first the slide contains.
    const live = 'const l=(a=>a.find((m)=>!m.paused)||a[0])([...document.querySelectorAll("video,audio")])'
    const scripts = {
      play: 'document.querySelectorAll("video,audio").forEach((m)=>{const r=m.play&&m.play();if(r&&r.catch)r.catch(()=>{})});"ok"',
      pause: 'document.querySelectorAll("video,audio").forEach((m)=>{m.pause&&m.pause()});"ok"',
      toggle: 'const l=[...document.querySelectorAll("video,audio")].find((m)=>m.pause);if(l){l.paused?(l.play&&l.play().catch(()=>{})):(l.pause&&l.pause())}"ok"',
      restart: 'document.querySelectorAll("video,audio").forEach((m)=>{m.currentTime=0;const r=m.play&&m.play();if(r&&r.catch)r.catch(()=>{})});"ok"',
      mute: 'document.querySelectorAll("video,audio").forEach((m)=>{m.muted=true});"ok"',
      unmute: 'document.querySelectorAll("video,audio").forEach((m)=>{m.muted=false});"ok"',
      volume: `document.querySelectorAll("video,audio").forEach((m)=>{m.volume=${amount};m.muted=${amount === 0}});"ok"`,
      seek: `(()=>{${live};const d=l&&Number(l.duration);if(l&&Number.isFinite(d)&&d>0)l.currentTime=Math.min(d,Math.max(0,d*${amount}));return "ok"})()`,
      fullscreen: 'const v=document.querySelector("video");if(v&&v.requestFullscreen)v.requestFullscreen();"ok"',
    }
    const script = scripts[action]
    if (!script) return false
    await contents.executeJavaScript(script, true).catch(() => undefined)
    return true
  })
  // The player on the projector answers for itself, so the console can show real time and level.
  ipcMain.handle('lampstand:presentation-media-state', async () => {
    const contents = presentationWindow && !presentationWindow.isDestroyed() ? presentationWindow.webContents : null
    if (!contents || contents.isDestroyed()) return null
    const script = '(()=>{const a=[...document.querySelectorAll("video,audio")];if(!a.length)return null;const m=a.find((x)=>!x.paused)||a[0];const d=Number(m.duration);const c=Number(m.currentTime);return {kind:m.tagName.toLowerCase(),playing:!m.paused&&!m.ended,time:Number.isFinite(c)?c:0,duration:Number.isFinite(d)?d:0,volume:Number(m.volume)||0,muted:Boolean(m.muted)}})()'
    return contents.executeJavaScript(script, true).catch(() => null)
  })
  // The studio shows what the audience screen is really displaying and lets the operator work it with mouse and keyboard.
  ipcMain.handle('lampstand:presentation-capture', async () => {
    if (!presentationWindow || presentationWindow.isDestroyed()) return ''
    const image = await presentationWindow.webContents.capturePage().catch(() => null)
    return image ? image.toDataURL() : ''
  })
  ipcMain.handle('lampstand:presentation-input', (_event, payload = {}) => {
    const contents = presentationWindow && !presentationWindow.isDestroyed() ? presentationWindow.webContents : null
    if (!contents || contents.isDestroyed()) return false
    const type = String(payload.type || '')
    if (type === 'text') { contents.insertText(String(payload.value || '').slice(0, 400)); return true }
    if (type === 'key') {
      const key = KEYS[String(payload.value)] ? String(payload.value) : ''
      if (!key) return false
      contents.sendInputEvent({ type: 'keyDown', keyCode: KEYS[key] })
      contents.sendInputEvent({ type: 'char', keyCode: KEYS[key] })
      contents.sendInputEvent({ type: 'keyUp', keyCode: KEYS[key] })
      return true
    }
    const area = contents.getBounds()
    const at = (value) => Math.round(Math.min(1, Math.max(0, Number(value) || 0)) * Math.max(1, area.width))
    const x = at(payload.x); const y = Math.round(Math.min(1, Math.max(0, Number(payload.y) || 0)) * Math.max(1, area.height))
    if (type === 'move') { contents.sendInputEvent({ type: 'mouseMove', x, y }); return true }
    if (type === 'wheel') { contents.sendInputEvent({ type: 'mouseWheel', x, y, deltaX: 0, deltaY: Math.max(-600, Math.min(600, Number(payload.deltaY) || 0)) }); return true }
    if (type !== 'click' && type !== 'double-click') return false
    const clickCount = type === 'double-click' ? 2 : 1
    contents.sendInputEvent({ type: 'mouseMove', x, y })
    contents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount })
    contents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount })
    return true
  })
  ipcMain.handle('lampstand:open-presentation', (_event, payload = {}) => {
    const output = audienceWindowFor(payload)
    const clean = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character))
    const highlightUi = `<div id="highlight-tools" hidden><span>Highlight</span><button class="highlight-swatch" data-color="#ffe066" style="background:#ffe066" aria-label="Yellow"></button><button class="highlight-swatch" data-color="#a9e5a0" style="background:#a9e5a0" aria-label="Green"></button><button class="highlight-swatch" data-color="#9ed8ff" style="background:#9ed8ff" aria-label="Blue"></button><button class="highlight-swatch" data-color="#f8b4d9" style="background:#f8b4d9" aria-label="Pink"></button><button class="highlight-swatch" data-color="#ffc98b" style="background:#ffc98b" aria-label="Orange"></button><button class="highlight-remove" type="button">Remove</button><button class="highlight-close" type="button" aria-label="Close">&times;</button></div><script>(()=>{const main=document.querySelector('main'),tools=document.getElementById('highlight-tools'),selection=()=>window.getSelection();let range=null,target=null;const hide=()=>{tools.hidden=true;range=null;target=null;selection()?.removeAllRanges()};const show=()=>{tools.hidden=false};document.addEventListener('mouseup',event=>{if(event.target.closest('#highlight-tools')||event.target.closest('mark'))return;const current=selection();if(!current||current.isCollapsed||!current.rangeCount)return;const next=current.getRangeAt(0);if(!main.contains(next.commonAncestorContainer))return;range=next.cloneRange();target=null;show()});main.addEventListener('click',event=>{const mark=event.target.closest('mark');if(!mark)return;target=mark;range=null;show();event.stopPropagation()});tools.querySelectorAll('[data-color]').forEach(button=>button.addEventListener('click',()=>{const color=button.dataset.color;if(target){target.style.backgroundColor=color}else if(range&&!range.collapsed){const mark=document.createElement('mark');mark.style.backgroundColor=color;try{mark.appendChild(range.extractContents());range.insertNode(mark)}catch{hide();return}}hide()}));tools.querySelector('.highlight-remove').addEventListener('click',()=>{if(target){const parent=target.parentNode;while(target.firstChild)parent.insertBefore(target.firstChild,target);target.remove();parent.normalize()}hide()});tools.querySelector('.highlight-close').addEventListener('click',hide);document.addEventListener('keydown',event=>{if(event.key==='Escape')hide()})})()</script>`
    const audienceScrollUi = '<script>(()=>{const slide=document.querySelector(".slide-content");if(!slide)return;window.addEventListener("wheel",event=>{const onSlide=event.target instanceof Node&&slide.contains(event.target);if(!onSlide)slide.scrollTop+=event.deltaY;},{passive:true});window.addEventListener("keydown",event=>{if(event.ctrlKey||event.metaKey||event.altKey)return;const height=slide.clientHeight;let step=0;if(event.key==="ArrowDown")step=48;else if(event.key==="ArrowUp")step=-48;else if(event.key==="PageDown"||event.key===" ")step=Math.round(height*.85);else if(event.key==="PageUp")step=-Math.round(height*.85);else if(event.key==="Home")step=-slide.scrollHeight;else if(event.key==="End")step=slide.scrollHeight;else return;event.preventDefault();slide.scrollTop+=step;})})()</script>'
    const audienceVerseUi = '<script>(()=>{document.addEventListener("click",event=>{const link=event.target instanceof Element&&event.target.closest("a[data-book]");if(!link)return;event.preventDefault();const verseEnd=Number(link.dataset.verseEnd)||Number(link.dataset.verse);const request={book:link.dataset.book,chapter:Number(link.dataset.chapter),verse:Number(link.dataset.verse),verseEnd,label:link.textContent.trim()};if(window.lampstandAudience)window.lampstandAudience.selectVerse(request);else if(window.opener)window.opener.postMessage({type:"lampstand:audience-verse",request},"*")})})()</script>'
    const showTitle = payload.showTitle !== false
    const fontScale = Math.min(2, Math.max(0.8, Number(payload.fontScale) || 1))
    const projectionTheme = payload.theme === 'dark' ? 'dark' : 'light'
    const transitionClass = payload.transition === 'fade' ? ' audience-fade' : ''
    const fadeSeconds = ({ fast: 0.15, normal: 0.3, slow: 0.6, slower: 1 })[payload.transitionSpeed] || 0.3
    const transitionStyle = payload.transition === 'fade' ? ` style="--audience-fade:${fadeSeconds}s"` : ''
    const titleStyle = showTitle ? '' : 'main{grid-template-rows:minmax(0,1fr)}.slide-header{display:none}'
    const document = payload.blank
      ? '<!doctype html><html><head><meta charset="utf-8"><style>html,body{width:100%;height:100%;margin:0;background:#000}</style></head><body></body></html>'
      : `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${clean(payload.title || 'Presentation')}</title><style>html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#132238}body{display:grid;place-items:center;color:#172033}main{box-sizing:border-box;display:grid;grid-template-rows:auto minmax(0,1fr);width:min(100vw,177.7778vh);height:min(100vh,56.25vw);aspect-ratio:16/9;overflow:hidden;background:#f7f3ea;box-shadow:0 0 50px #0006}.slide-header{box-sizing:border-box;padding:clamp(18px,2.2vw,38px) clamp(34px,5vw,90px) clamp(14px,1.6vw,28px);border-bottom:clamp(2px,.18vw,4px) solid #35bdec;text-align:center;font-family:Inter,Segoe UI,sans-serif}.slide-header h1{margin:0;color:#172033;font-size:clamp(28px,3vw,58px);line-height:1.12}.slide-content{box-sizing:border-box;min-height:0;overflow-y:auto;scrollbar-gutter:stable;scrollbar-width:thin;scrollbar-color:#0c547488 transparent;display:grid;justify-items:start;align-content:safe center;padding:clamp(26px,3.2vw,58px) clamp(46px,7vw,128px) clamp(42px,5vw,90px);font-family:Georgia,'Times New Roman',serif;font-size:calc(clamp(20px,1.75vw,34px) * ${fontScale});line-height:1.55;text-align:left}.slide-content>*{box-sizing:border-box;width:100%;max-width:44em}.slide-content h2,.slide-content h3{color:#0c5474;font-family:Inter,Segoe UI,sans-serif}.slide-content strong{color:#0c3853}.slide-content a{color:#047bad}.slide-content a[data-book]{text-decoration:none;border-bottom:.06em solid currentColor;cursor:pointer}body.audience-dark{background:#05070a;color:#f4f7fb}body.audience-dark main{background:#101722;box-shadow:0 0 50px #000}.audience-dark .slide-header{border-color:#58d4ff}.audience-dark .slide-header h1,.audience-dark .slide-content{color:#f4f7fb;scrollbar-color:#83dcfa66 transparent}.audience-dark .slide-content h2,.audience-dark .slide-content h3{color:#83dcfa}.audience-dark .slide-content strong{color:#d9f3ff}.audience-dark .slide-content a{color:#83dcfa}@keyframes audienceFadeIn{from{opacity:0}to{opacity:1}}main.audience-fade{animation:audienceFadeIn var(--audience-fade,0.3s) ease-out both}mark{padding:0 .08em;border-radius:3px;color:#171717;box-decoration-break:clone;-webkit-box-decoration-break:clone;cursor:pointer}#highlight-tools{position:fixed;z-index:20;font:600 14px/1.2 Inter,Segoe UI,sans-serif;box-shadow:0 8px 28px #0005;left:50%;bottom:18px;transform:translateX(-50%);display:flex;align-items:center;gap:9px;padding:10px 12px;border:1px solid #ffffff66;border-radius:14px;background:#132238f5;color:#fff}#highlight-tools[hidden]{display:none}.highlight-swatch{width:30px;height:30px;padding:0;border:2px solid #fff;border-radius:50%;cursor:pointer}.highlight-remove{min-height:32px;padding:0 12px;border:1px solid #ff9b9b;border-radius:8px;background:transparent;color:#ffd0d0;cursor:pointer}.highlight-close{width:30px;height:30px;padding:0;border:0;background:transparent;color:#fff;font-size:22px;cursor:pointer}${titleStyle}</style></head><body class="audience-${projectionTheme}"><main class="${transitionClass.trim()}"${transitionStyle}><header class="slide-header"><h1>${clean(payload.title || 'Presentation')}</h1></header><section class="slide-content">${String(payload.html || '')}</section></main>${highlightUi}${audienceScrollUi}${audienceVerseUi}</body></html>`
    // The console carries the level the operator last set; a first run gets the low starting level.
    const mediaLevel = Math.min(1, Math.max(0, Number(payload.mediaLevel))) || DEFAULT_MEDIA_LEVEL
    const fadeMs = Math.round(fadeSeconds * 1000)
    const fadeOut = async () => {
      if (!audienceHasContent || payload.transition === 'none' || output.webContents.isDestroyed()) return
      // Whatever is on air dims and goes quiet over the same beat, so a clip change never snaps or clicks.
      await output.webContents.executeJavaScript(`(()=>{const d=${fadeMs};document.body.style.transition="opacity ${fadeMs}ms linear";document.body.style.opacity="0";const media=[...document.querySelectorAll("video,audio")];const start=media.map((m)=>Number(m.volume)||0);const t0=performance.now();const step=()=>{const k=Math.min(1,(performance.now()-t0)/d);media.forEach((m,i)=>{m.volume=start[i]*(1-k)});if(k<1)requestAnimationFrame(step)};if(media.length)requestAnimationFrame(step);return "ok"})()`, true).catch(() => undefined)
      await new Promise((done) => setTimeout(done, fadeMs))
    }
    const showSlide = async () => {
      await fadeOut()
      await output.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(document)}`)
      if (output.isDestroyed()) return
      audienceHasContent = true
      output.show()
      output.setFullScreen(true)
      output.focus()
      const sink = String(payload.audioSinkId || '')
      // Projected media opens at the console's level, never at full blast.
      void output.webContents.executeJavaScript(`document.querySelectorAll("video,audio").forEach((m)=>{m.volume=${mediaLevel}})`, true).catch(() => undefined)
      // Projected video and audio leave through the speaker output chosen in the studio.
      if (sink) void output.webContents.executeJavaScript(`(()=>{const sink=${JSON.stringify(sink)};const apply=()=>document.querySelectorAll("video,audio").forEach((m)=>{if(m.setSinkId)m.setSinkId(sink).catch(()=>{})});apply();new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true})})()`, true).catch(() => undefined)
    }
    void showSlide().catch(() => undefined)
    return true
  })
  ipcMain.on('lampstand:presentation-verse', (_event, reference) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('lampstand:audience-verse', reference)
  })
}

function applicationRoot() {
  return app.isPackaged ? app.getAppPath() : join(__dirname, '..')
}

function resourceRoot() {
  return app.isPackaged ? process.resourcesPath : join(__dirname, '..')
}

function contentType(path) {
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2' })[extname(path)] || 'application/octet-stream'
}

function startWebServer(root) {
  const dist = join(root, 'dist')
  webServer = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${webPort || 5173}`).pathname)
    const requested = normalize(join(dist, pathname === '/' ? 'index.html' : pathname))
    const safePath = requested.startsWith(dist) && existsSync(requested) && statSync(requested).isFile() ? requested : join(dist, 'index.html')
    response.writeHead(200, { 'Content-Type': contentType(safePath), 'Cache-Control': safePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable' })
    createReadStream(safePath).pipe(response)
  })
  return new Promise((resolve, reject) => {
    webServer.once('error', reject)
    webServer.listen(REQUESTED_WEB_PORT, '127.0.0.1', () => {
      const address = webServer.address()
      webPort = typeof address === 'object' && address ? address.port : REQUESTED_WEB_PORT
      resolve(webPort)
    })
  })
}

function startupLog(message) {
  const directory = join(app.getPath('userData'), 'logs')
  mkdirSync(directory, { recursive: true })
  appendFileSync(join(directory, 'desktop-startup.log'), `${new Date().toISOString()} ${message}\n`, 'utf8')
}

async function startLocalServices(root) {
  const script = join(root, 'scripts', 'desktop-services.ps1')
  if (existsSync(script)) serviceProcess = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-StudioRoot', root], { cwd: root, windowsHide: true, stdio: 'ignore' })
  const server = join(root, 'server', 'index.mjs')
  const userData = app.getPath('userData')
  const adjacentAiRoot = join(root, '..')
  const developmentKnowledge = existsSync(join(adjacentAiRoot, 'Knowledge')) ? join(adjacentAiRoot, 'Knowledge') : 'I:\\AI\\Knowledge'
  const developmentIndex = existsSync(join(adjacentAiRoot, 'Index')) ? join(adjacentAiRoot, 'Index') : 'I:\\AI\\Index'
  const knowledgeDir = existsSync(developmentKnowledge) ? developmentKnowledge : localKnowledgeRoot()
  const knowledgeIndexDir = existsSync(developmentIndex) ? developmentIndex : localKnowledgeIndexRoot()
  if (app.isPackaged) {
    const bundledKnowledge = join(root, 'data', 'knowledge')
    if (existsSync(bundledKnowledge)) await cp(bundledKnowledge, knowledgeDir, { recursive: true, force: false, errorOnExist: false })
    const bundledKnowledgeIndex = join(root, 'data', 'knowledge-index')
    if (existsSync(bundledKnowledgeIndex)) await cp(bundledKnowledgeIndex, knowledgeIndexDir, { recursive: true, force: false, errorOnExist: false })
  }
  const overrides = libraryOverrideRoot()
  // The Python runtime that owns the index builder sits beside the knowledge folder, not inside
  // the installed app, so the gateway has to be told where it is.
  const aiRuntimeRoot = existsSync(join(adjacentAiRoot, 'ai-env')) ? adjacentAiRoot : (existsSync('I:\\AI') ? 'I:\\AI' : adjacentAiRoot)
  const preferOverride = (relative, bundled) => existsSync(join(overrides, relative)) ? join(overrides, relative) : bundled
  Object.assign(process.env, {
    AIOS_API_PORT: String(API_PORT),
    AIOS_ALLOWED_ORIGINS: `http://localhost:${webPort},http://127.0.0.1:${webPort}`,
    AIOS_MEDIA_JOBS_FILE: join(userData, 'data', 'media-jobs.json'),
    AIOS_PROVIDER_PREFERENCES_FILE: join(userData, 'data', 'provider-settings.json'),
    AIOS_HYMNAL_LIBRARY_FILE: preferOverride(join('data', 'hymnal-library.json'), join(root, 'data', 'hymnal-library.json')),
    AIOS_HWMR_LIBRARY_FILE: preferOverride(join('data', 'hwmr-library.json'), join(root, 'data', 'hwmr-library.json')),
    AIOS_MINISTRY_BOOKS_DATABASE: preferOverride(join('data', 'ministry-books', 'library.sqlite'), join(root, 'data', 'ministry-books', 'library.sqlite')),
    AIOS_RECOVERY_BIBLE_DIR: preferOverride(join('data', 'ministry', 'recovery-bible'), join(root, 'data', 'ministry', 'recovery-bible')),
    AIOS_RECOVERY_FOOTNOTES_DIR: preferOverride(join('data', 'ministry', 'recovery-footnotes'), join(root, 'data', 'ministry', 'recovery-footnotes')),
    AIOS_LIFE_STUDY_DIR: preferOverride(join('data', 'ministry', 'life-study'), join(root, 'data', 'ministry', 'life-study')),
    AIOS_MINISTRY_LIBRARY_DIR: join(userData, 'data', 'ministry-library'),
    AIOS_KNOWLEDGE_DIR: knowledgeDir,
    AIOS_KNOWLEDGE_INDEX_DIR: knowledgeIndexDir,
    AIOS_KNOWLEDGE_TRASH_DIR: join(userData, 'data', 'knowledge-trash'),
    AIOS_AI_ROOT: aiRuntimeRoot,
    AIOS_HWMR_IMPORTER_SCRIPT: join(root, 'scripts', 'import-hwmr.py'),
    AIOS_INDEX_SCRIPT: join(root, 'scripts', 'prepare-and-index.py'),
    AIOS_DOCUMENT_PYTHON: join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'),
    AIOS_PRONUNCIATION_PYTHON: join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'),
    AIOS_DOCUMENT_TRANSLATION_SCRIPT: join(root, 'scripts', 'translate-document.py'),
    AIOS_PRONUNCIATION_SCRIPT: join(root, 'server', 'edge-pronunciation.py'),
    AIOS_PRESENTATION_DECK_SCRIPT: join(root, 'scripts', 'export-presentation-deck.ps1'),
    AIOS_PYTHON_OVERRIDES: join(root, 'python_overrides'),
  })
  startupLog(`Knowledge source: ${knowledgeDir}`)
  startupLog(`Knowledge index: ${knowledgeIndexDir}`)
  try {
    const { createAiosServer } = await import(pathToFileURL(server).href)
    gatewayServer = createAiosServer()
    await new Promise((resolve, reject) => {
      gatewayServer.once('error', (error) => error.code === 'EADDRINUSE' ? resolve() : reject(error))
      gatewayServer.listen(API_PORT, '127.0.0.1', resolve)
    })
    startupLog(`Gateway ready on 127.0.0.1:${API_PORT}`)
  } catch (error) {
    startupLog(`Gateway failed: ${error instanceof Error ? error.stack || error.message : String(error)}`)
  }
}

function createWindow(root) {
  const window = new BrowserWindow({
    width: 1480, height: 940, minWidth: 1040, minHeight: 700,
    title: 'Lampstand Project', backgroundColor: '#101b2d',
    icon: join(root, 'public', 'favicon.svg'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: join(__dirname, 'preload.cjs') },
  })
  window.removeMenu()
  window.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
  window.loadURL(DEV_URL || `http://127.0.0.1:${webPort}`)
  mainWindow = window
  window.webContents.once('did-finish-load', () => {
    publishUpdateState()
    if (app.isPackaged) setTimeout(() => autoUpdater.checkForUpdates().catch((error) => publishUpdateState({ status: 'error', message: error instanceof Error ? error.message : String(error) })), 5000)
  })
}

app.whenReady().then(async () => {
  const root = applicationRoot()
  const resources = resourceRoot()
  try {
    configureUpdater()
    configureLibraryUpdater()
    configurePresentationWindows()
    configureMediaPermissions()
    if (DEV_URL) webPort = Number(new URL(DEV_URL).port) || 80
    else await startWebServer(root)
    await startLocalServices(resources)
    createWindow(root)
  } catch (error) {
    dialog.showErrorBox('Lampstand Project could not start', error instanceof Error ? error.message : String(error))
    app.quit()
  }
})

app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => {
  if (gatewayServer) gatewayServer.close()
  if (serviceProcess && !serviceProcess.killed) serviceProcess.kill()
  if (webServer) webServer.close()
})
