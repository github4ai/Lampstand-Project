const { app, BrowserWindow, dialog, ipcMain, screen, shell } = require('electron')
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
let webPort = REQUESTED_WEB_PORT
let webServer
let gatewayServer
let serviceProcess
let mainWindow
let presentationWindow
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
    await shell.openExternal(`https://github.com/github4ai/Lampstand-Studio-Releases/releases/download/v${version}/${installer}`)
    return true
  })
}

function configurePresentationWindows() {
  ipcMain.handle('lampstand:presentation-displays', () => {
    const primaryId = screen.getPrimaryDisplay().id
    return screen.getAllDisplays().map((display, index) => ({ id: String(display.id), label: `${display.id === primaryId ? 'Main display' : `Display ${index + 1}`} · ${display.workAreaSize.width} × ${display.workAreaSize.height}`, primary: display.id === primaryId }))
  })
  ipcMain.handle('lampstand:open-presentation', (_event, payload = {}) => {
    const displays = screen.getAllDisplays(); const primary = screen.getPrimaryDisplay()
    const selected = displays.find((display) => String(display.id) === String(payload.displayId)) || displays.find((display) => display.id !== primary.id) || primary
    const { x, y, width, height } = selected.bounds
    const bounds = { x, y, width, height }
    if (!presentationWindow || presentationWindow.isDestroyed()) {
      presentationWindow = new BrowserWindow({ ...bounds, title: String(payload.title || 'Lampstand presentation'), backgroundColor: '#f5f1e8', frame: false, fullscreen: true, autoHideMenuBar: true, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } })
      presentationWindow.setMenuBarVisibility(false)
      presentationWindow.on('closed', () => { presentationWindow = undefined })
    } else {
      presentationWindow.setFullScreen(false)
      presentationWindow.setBounds(bounds)
      presentationWindow.setTitle(String(payload.title || 'Lampstand presentation'))
      presentationWindow.setMenuBarVisibility(false)
      presentationWindow.setFullScreen(true)
    }
    const clean = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character))
    const highlightUi = `<div id="highlight-tools" hidden><span>Highlight</span><button class="highlight-swatch" data-color="#ffe066" style="background:#ffe066" aria-label="Yellow"></button><button class="highlight-swatch" data-color="#a9e5a0" style="background:#a9e5a0" aria-label="Green"></button><button class="highlight-swatch" data-color="#9ed8ff" style="background:#9ed8ff" aria-label="Blue"></button><button class="highlight-swatch" data-color="#f8b4d9" style="background:#f8b4d9" aria-label="Pink"></button><button class="highlight-swatch" data-color="#ffc98b" style="background:#ffc98b" aria-label="Orange"></button><button class="highlight-remove" type="button">Remove</button><button class="highlight-close" type="button" aria-label="Close">&times;</button></div><script>(()=>{const main=document.querySelector('main'),tools=document.getElementById('highlight-tools'),selection=()=>window.getSelection();let range=null,target=null;const hide=()=>{tools.hidden=true;range=null;target=null;selection()?.removeAllRanges()};const show=()=>{tools.hidden=false};document.addEventListener('mouseup',event=>{if(event.target.closest('#highlight-tools')||event.target.closest('mark'))return;const current=selection();if(!current||current.isCollapsed||!current.rangeCount)return;const next=current.getRangeAt(0);if(!main.contains(next.commonAncestorContainer))return;range=next.cloneRange();target=null;show()});main.addEventListener('click',event=>{const mark=event.target.closest('mark');if(!mark)return;target=mark;range=null;show();event.stopPropagation()});tools.querySelectorAll('[data-color]').forEach(button=>button.addEventListener('click',()=>{const color=button.dataset.color;if(target){target.style.backgroundColor=color}else if(range&&!range.collapsed){const mark=document.createElement('mark');mark.style.backgroundColor=color;try{mark.appendChild(range.extractContents());range.insertNode(mark)}catch{hide();return}}hide()}));tools.querySelector('.highlight-remove').addEventListener('click',()=>{if(target){const parent=target.parentNode;while(target.firstChild)parent.insertBefore(target.firstChild,target);target.remove();parent.normalize()}hide()});tools.querySelector('.highlight-close').addEventListener('click',hide);document.addEventListener('keydown',event=>{if(event.key==='Escape')hide()})})()</script>`
    const audienceScrollUi = '<script>(()=>{const slide=document.querySelector(".slide-content");if(!slide)return;window.addEventListener("wheel",event=>{const onSlide=event.target instanceof Node&&slide.contains(event.target);if(!onSlide)slide.scrollTop+=event.deltaY;},{passive:true});window.addEventListener("keydown",event=>{if(event.ctrlKey||event.metaKey||event.altKey)return;const height=slide.clientHeight;let step=0;if(event.key==="ArrowDown")step=48;else if(event.key==="ArrowUp")step=-48;else if(event.key==="PageDown"||event.key===" ")step=Math.round(height*.85);else if(event.key==="PageUp")step=-Math.round(height*.85);else if(event.key==="Home")step=-slide.scrollHeight;else if(event.key==="End")step=slide.scrollHeight;else return;event.preventDefault();slide.scrollTop+=step;})})()</script>'
    const showTitle = payload.showTitle !== false
    const fontScale = Math.min(2, Math.max(0.8, Number(payload.fontScale) || 1))
    const projectionTheme = payload.theme === 'dark' ? 'dark' : 'light'
    const transitionClass = payload.transition === 'fade' ? ' audience-fade' : ''
    const fadeSeconds = ({ fast: 0.15, normal: 0.3, slow: 0.6, slower: 1 })[payload.transitionSpeed] || 0.3
    const transitionStyle = payload.transition === 'fade' ? ` style="--audience-fade:${fadeSeconds}s"` : ''
    const titleStyle = showTitle ? '' : 'main{grid-template-rows:minmax(0,1fr)}.slide-header{display:none}'
    const document = payload.blank
      ? '<!doctype html><html><head><meta charset="utf-8"><style>html,body{width:100%;height:100%;margin:0;background:#000}</style></head><body></body></html>'
      : `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${clean(payload.title || 'Presentation')}</title><style>html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#132238}body{display:grid;place-items:center;color:#172033}main{box-sizing:border-box;display:grid;grid-template-rows:auto minmax(0,1fr);width:min(100vw,177.7778vh);height:min(100vh,56.25vw);aspect-ratio:16/9;overflow:hidden;background:#f7f3ea;box-shadow:0 0 50px #0006}.slide-header{box-sizing:border-box;padding:clamp(18px,2.2vw,38px) clamp(34px,5vw,90px) clamp(14px,1.6vw,28px);border-bottom:clamp(2px,.18vw,4px) solid #35bdec;text-align:center;font-family:Inter,Segoe UI,sans-serif}.slide-header h1{margin:0;color:#172033;font-size:clamp(28px,3vw,58px);line-height:1.12}.slide-content{box-sizing:border-box;min-height:0;overflow-y:auto;scrollbar-gutter:stable;scrollbar-width:thin;scrollbar-color:#0c547488 transparent;display:grid;justify-items:start;align-content:safe center;padding:clamp(26px,3.2vw,58px) clamp(46px,7vw,128px) clamp(42px,5vw,90px);font-family:Georgia,'Times New Roman',serif;font-size:calc(clamp(20px,1.75vw,34px) * ${fontScale});line-height:1.55;text-align:left}.slide-content>*{box-sizing:border-box;width:100%;max-width:44em}.slide-content h2,.slide-content h3{color:#0c5474;font-family:Inter,Segoe UI,sans-serif}.slide-content strong{color:#0c3853}.slide-content a{color:#047bad}body.audience-dark{background:#05070a;color:#f4f7fb}body.audience-dark main{background:#101722;box-shadow:0 0 50px #000}.audience-dark .slide-header{border-color:#58d4ff}.audience-dark .slide-header h1,.audience-dark .slide-content{color:#f4f7fb;scrollbar-color:#83dcfa66 transparent}.audience-dark .slide-content h2,.audience-dark .slide-content h3{color:#83dcfa}.audience-dark .slide-content strong{color:#d9f3ff}.audience-dark .slide-content a{color:#83dcfa}@keyframes audienceFadeIn{from{opacity:0}to{opacity:1}}main.audience-fade{animation:audienceFadeIn var(--audience-fade,0.3s) ease-out both}mark{padding:0 .08em;border-radius:3px;color:#171717;box-decoration-break:clone;-webkit-box-decoration-break:clone;cursor:pointer}#highlight-tools{position:fixed;z-index:20;font:600 14px/1.2 Inter,Segoe UI,sans-serif;box-shadow:0 8px 28px #0005;left:50%;bottom:18px;transform:translateX(-50%);display:flex;align-items:center;gap:9px;padding:10px 12px;border:1px solid #ffffff66;border-radius:14px;background:#132238f5;color:#fff}#highlight-tools[hidden]{display:none}.highlight-swatch{width:30px;height:30px;padding:0;border:2px solid #fff;border-radius:50%;cursor:pointer}.highlight-remove{min-height:32px;padding:0 12px;border:1px solid #ff9b9b;border-radius:8px;background:transparent;color:#ffd0d0;cursor:pointer}.highlight-close{width:30px;height:30px;padding:0;border:0;background:transparent;color:#fff;font-size:22px;cursor:pointer}${titleStyle}</style></head><body class="audience-${projectionTheme}"><main class="${transitionClass.trim()}"${transitionStyle}><header class="slide-header"><h1>${clean(payload.title || 'Presentation')}</h1></header><section class="slide-content">${String(payload.html || '')}</section></main>${highlightUi}${audienceScrollUi}</body></html>`
    void presentationWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(document)}`).then(() => {
      if (!presentationWindow || presentationWindow.isDestroyed()) return
      presentationWindow.show()
      presentationWindow.setFullScreen(true)
      presentationWindow.focus()
    })
    return true
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
    AIOS_DOCUMENT_PYTHON: join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'),
    AIOS_PRONUNCIATION_PYTHON: join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'),
    AIOS_DOCUMENT_TRANSLATION_SCRIPT: join(root, 'scripts', 'translate-document.py'),
    AIOS_PRONUNCIATION_SCRIPT: join(root, 'server', 'edge-pronunciation.py'),
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
  window.loadURL(`http://127.0.0.1:${webPort}`)
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
    await startWebServer(root)
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
