import { Activity, Check, CheckCircle2, Clipboard, Cloud, Download, KeyRound, Palette, Power, RefreshCw, RotateCcw, Server, Settings, Trash2, Upload, Volume2, Wrench } from 'lucide-react'
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'
import { getAiServicesStatus, repairAiServices, saveProviderPreferences, startAiServices, unloadAiModels, type AiServiceStatus, type ProviderPreferences } from '../api/services'
import { AIOS_API_BASE_URL } from '../config/api'
import AccessSettingsPanel from '../components/Settings/AccessSettingsPanel'
import RemoteAccessPanel from '../components/Settings/RemoteAccessPanel'
import AppUpdatesPanel from '../components/Settings/AppUpdatesPanel'
import { BIBLE_VOICE_STORAGE_KEY, INDIA_VOICE_PROFILES } from '../utils/bibleVoices'
import { collectWorkspaceBackup, parseWorkspaceBackup, resetPersonalData, restoreWorkspaceBackup as applyWorkspaceBackup, workspaceBackupSize, type WorkspaceBackup } from '../utils/workspaceBackup'
import { canManageUsers } from '../utils/accessControl'
import { useAccessControl } from '../hooks/useAccessControl'
const STORAGE_KEY = 'aios-studio-settings-v1'

type ThemePreference = 'system' | 'light' | 'dark'
type AccentPreference = 'cyan' | 'blue' | 'teal' | 'purple' | 'gold' | 'green' | 'burgundy'
interface Preferences { compactUi: boolean; reducedMotion: boolean; highContrast: boolean; theme: ThemePreference; accent: AccentPreference }

function loadPreferences(): Preferences {
  try {
    return { compactUi: false, reducedMotion: false, highContrast: false, theme: 'system', accent: 'cyan', ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  } catch {
    return { compactUi: false, reducedMotion: false, highContrast: false, theme: 'system', accent: 'cyan' }
  }
}

function SettingsPage() {
  const { profile } = useAccessControl()
  const canManage = canManageUsers(profile)
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences)
  const [checking, setChecking] = useState(true)
  const [online, setOnline] = useState(false)
  const [status, setStatus] = useState('Checking connection...')
  const [apiLatencyMs, setApiLatencyMs] = useState<number | null>(null)
  const [lastApiCheck, setLastApiCheck] = useState<Date | null>(null)
  const [services, setServices] = useState<AiServiceStatus | null>(null)
  const [managingServices, setManagingServices] = useState(false)
  const [serviceError, setServiceError] = useState('')
  const [providerMode, setProviderMode] = useState<ProviderPreferences['mode']>('hybrid')
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [anthropicApiKey, setAnthropicApiKey] = useState('')
  const [tavilyApiKey, setTavilyApiKey] = useState('')
  const [geminiTextModel, setGeminiTextModel] = useState('gemini-3.6-flash')
  const [openaiTextModel, setOpenaiTextModel] = useState('gpt-4.1-mini')
  const [anthropicTextModel, setAnthropicTextModel] = useState('claude-3-5-haiku-latest')
  const [savingProviders, setSavingProviders] = useState(false)
  const [providerNotice, setProviderNotice] = useState('')
  const [refreshingServices, setRefreshingServices] = useState(false)
  const [lastServiceCheck, setLastServiceCheck] = useState<Date | null>(null)
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false)
  const [diagnosticsCopyError, setDiagnosticsCopyError] = useState('')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [bibleVoice, setBibleVoice] = useState(() => localStorage.getItem(BIBLE_VOICE_STORAGE_KEY) || '')
  const serviceRequestRef = useRef<AbortController | null>(null)
  const apiRequestRef = useRef<AbortController | null>(null)
  const restoreInputRef = useRef<HTMLInputElement | null>(null)
  const [backupNotice, setBackupNotice] = useState('')
  const [pendingBackup, setPendingBackup] = useState<WorkspaceBackup | null>(null)

  const checkConnection = useCallback(async () => {
    apiRequestRef.current?.abort()
    const controller =
      new AbortController()
    apiRequestRef.current =
      controller
    setChecking(true)
    const startedAt =
      performance.now()
    const timeout =
      window.setTimeout(
        () => controller.abort(),
        5000,
      )
    try {
      const response = await fetch(AIOS_API_BASE_URL + '/health', { headers: { Accept: 'application/json' }, signal: controller.signal })
      if (!response.ok) throw new Error()
      const payload = await response.json() as { status?: string }
      setOnline(true)
      setStatus(payload.status ?? 'Connected')
      setApiLatencyMs(
        Math.round(
          performance.now() -
            startedAt,
        ),
      )
      setLastApiCheck(new Date())
    } catch (error) {
      if (
        controller.signal.aborted &&
        apiRequestRef.current !==
          controller
      ) {
        return
      }

      setOnline(false)
      setStatus(
        error instanceof DOMException &&
          error.name === 'AbortError'
          ? 'Connection timed out'
          : 'Unavailable',
      )
      setApiLatencyMs(null)
      setLastApiCheck(new Date())
    } finally {
      window.clearTimeout(timeout)

      if (
        apiRequestRef.current ===
        controller
      ) {
        apiRequestRef.current = null
        setChecking(false)
      }
    }
  }, [])

  const refreshServices = useCallback(async () => {
    serviceRequestRef.current?.abort()
    const controller = new AbortController()
    serviceRequestRef.current = controller
    setRefreshingServices(true)
    try {
      const next = await getAiServicesStatus(controller.signal)
      if (controller.signal.aborted) return
      setServices(next)
      if (next.preferences) {
        setProviderMode(next.preferences.mode)
        setGeminiTextModel(next.preferences.geminiTextModel)
        setOpenaiTextModel(next.preferences.openaiTextModel)
        setAnthropicTextModel(next.preferences.anthropicTextModel)
      }
      setLastServiceCheck(new Date())
      setServiceError(
        next.errors?.map(
          (error) => error.message,
        ).join(' ') ?? '',
      )
    }
    catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setServiceError('The AI service manager is unavailable. Confirm that the Unified AIOS Gateway is running, then refresh the status.')
    } finally {
      if (serviceRequestRef.current === controller) {
        serviceRequestRef.current = null
        setRefreshingServices(false)
      }
    }
  }, [])

  const updateProviderPreferences = useCallback(async (removeProvider?: 'gemini' | 'openai' | 'anthropic' | 'tavily') => {
    setSavingProviders(true)
    setProviderNotice('')
    const previousMode = services?.preferences?.mode ?? providerMode
    const previousPreferences = services?.preferences
    try {
      const input: { mode: ProviderPreferences['mode']; geminiApiKey?: string; openaiApiKey?: string; anthropicApiKey?: string; tavilyApiKey?: string; geminiTextModel?: string; openaiTextModel?: string; anthropicTextModel?: string } = {
        mode: providerMode, geminiTextModel: geminiTextModel.trim(), openaiTextModel: openaiTextModel.trim(), anthropicTextModel: anthropicTextModel.trim(),
      }
      if (removeProvider === 'gemini') input.geminiApiKey = ''
      else if (geminiApiKey.trim()) input.geminiApiKey = geminiApiKey.trim()
      if (removeProvider === 'openai') input.openaiApiKey = ''
      else if (openaiApiKey.trim()) input.openaiApiKey = openaiApiKey.trim()
      if (removeProvider === 'anthropic') input.anthropicApiKey = ''
      else if (anthropicApiKey.trim()) input.anthropicApiKey = anthropicApiKey.trim()
      if (removeProvider === 'tavily') input.tavilyApiKey = ''
      else if (tavilyApiKey.trim()) input.tavilyApiKey = tavilyApiKey.trim()
      const saved = await saveProviderPreferences(input)
      setGeminiApiKey('')
      setOpenaiApiKey('')
      setAnthropicApiKey('')
      setTavilyApiKey('')
      setServices((current) => current ? { ...current, preferences: saved } : current)
      setProviderNotice(removeProvider ? 'Cloud provider removed. Local services remain available.' : 'Provider preference saved. New requests will use this mode.')
      await refreshServices()
    } catch (error) {
      setProviderMode(previousMode)
      if (previousPreferences) setServices((current) => current ? { ...current, preferences: previousPreferences } : current)
      setProviderNotice(error instanceof Error ? error.message : 'Unable to save provider preferences.')
    } finally { setSavingProviders(false) }
  }, [anthropicApiKey, anthropicTextModel, geminiApiKey, geminiTextModel, openaiApiKey, openaiTextModel, providerMode, refreshServices, services?.preferences, tavilyApiKey])

  const toggleServices = useCallback(async () => {
    setManagingServices(true)
    setServiceError('')
    try {
      const next = services?.enabled ? await unloadAiModels() : await startAiServices()
      setServices(next)
      if (next.errors?.length) setServiceError(next.errors.map((error) => error.message).join(' '))
    } catch (error) {
      setServiceError(error instanceof Error ? error.message : 'Unable to change AI service state.')
    } finally { setManagingServices(false) }
  }, [services?.enabled])

  const repairServices = useCallback(async () => {
    setManagingServices(true)
    setServiceError('')
    try {
      const next = await repairAiServices()
      setServices(next)
      if (next.errors?.length) setServiceError(next.errors.map((error) => error.message).join(' '))
    } catch (error) {
      setServiceError(error instanceof Error ? error.message : 'Unable to repair AI services.')
    } finally {
      setManagingServices(false)
    }
  }, [])

  useEffect(() => { void checkConnection() }, [checkConnection])
  useEffect(() => {
    void refreshServices()

    const refreshWhenVisible = () => {
      if (
        document.visibilityState ===
        'visible'
      ) {
        void refreshServices()
      }
    }

    const timer = window.setInterval(
      refreshWhenVisible,
      5000,
    )

    document.addEventListener(
      'visibilitychange',
      refreshWhenVisible,
    )

    return () => {
      window.clearInterval(timer)
      document.removeEventListener(
        'visibilitychange',
        refreshWhenVisible,
      )
      serviceRequestRef.current?.abort()
      apiRequestRef.current?.abort()
    }
  }, [refreshServices])
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    document.documentElement.classList.toggle('compact-ui', preferences.compactUi)
    document.documentElement.classList.toggle('reduced-motion', preferences.reducedMotion)
    document.documentElement.classList.toggle('high-contrast', preferences.highContrast)
    document.documentElement.dataset.theme = preferences.theme
    document.documentElement.dataset.accent = preferences.accent
  }, [preferences])
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const load = () => {
      const available = window.speechSynthesis.getVoices().sort((left, right) => Number(/-IN$/i.test(right.lang)) - Number(/-IN$/i.test(left.lang)) || left.name.localeCompare(right.name))
      setVoices(available)
      const storedVoice = available.find((voice) => voice.voiceURI === bibleVoice)
      const validIndianSelection = bibleVoice.startsWith('profile:') || Boolean(storedVoice && /-IN$/i.test(storedVoice.lang))
      if (!validIndianSelection) setBibleVoice(available.find((voice) => voice.lang.toLowerCase() === 'en-in')?.voiceURI || 'profile:en-IN')
    }
    load(); window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [bibleVoice])
  useEffect(() => { if (bibleVoice) localStorage.setItem(BIBLE_VOICE_STORAGE_KEY, bibleVoice) }, [bibleVoice])

  function toggle(key: keyof Preferences) {
    setPreferences((current) => ({ ...current, [key]: !current[key] }))
  }

  function selectTheme(theme: ThemePreference) {
    document.documentElement.dataset.theme = theme
    setPreferences((current) => ({ ...current, theme }))
  }

  function selectAccent(accent: AccentPreference) {
    document.documentElement.dataset.accent = accent
    setPreferences((current) => ({ ...current, accent }))
  }

  async function copyDiagnostics() {
    const providerLines =
      services?.providers.map(
        (provider) => {
          const providerError =
            services.errors?.find(
              (error) =>
                error.id === provider.id,
            )

          return `- ${provider.label}: ${provider.available ? 'Ready' : providerError?.message || (provider.configured === false ? 'Not configured' : 'Offline')}`
        },
      ) ?? ['- Service status unavailable']

    const report = [
      'Lampstand Project service diagnostics',
      `Generated: ${new Date().toLocaleString()}`,
      `Gateway: ${online ? status : 'Unavailable'}`,
      `Gateway URL: ${AIOS_API_BASE_URL}`,
      `Gateway response time: ${apiLatencyMs === null ? 'Unavailable' : `${apiLatencyMs} ms`}`,
      `Last gateway check: ${lastApiCheck?.toLocaleString() ?? 'Not completed'}`,
      `AI Services: ${services?.enabled ? 'On' : services ? 'Standby' : 'Unavailable'}`,
      `Last service check: ${lastServiceCheck?.toLocaleString() ?? 'Not completed'}`,
      '',
      'Providers:',
      ...providerLines,
      ...(serviceError
        ? ['', `Service error: ${serviceError}`]
        : []),
    ].join('\n')

    try {
      await navigator.clipboard.writeText(
        report,
      )

      setDiagnosticsCopyError('')
      setDiagnosticsCopied(true)
      window.setTimeout(
        () =>
          setDiagnosticsCopied(false),
        2000,
      )
    } catch {
      setDiagnosticsCopied(false)
      setDiagnosticsCopyError(
        'Unable to copy automatically. Allow clipboard access and try again.',
      )
    }
  }

  async function checkAllServices() {
    await Promise.all([
      checkConnection(),
      refreshServices(),
    ])
  }

  function downloadWorkspaceBackup() {
    const backup = collectWorkspaceBackup(localStorage)
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a')
    anchor.href = url; anchor.download = `lampstand-studio-workspace-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url)
    setBackupNotice(`${backup.storageEntries} local AIOS settings and records backed up. Library source files and generated media files remain in their existing folders.`)
  }

  async function restoreWorkspaceBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
    try {
      const backup = parseWorkspaceBackup(JSON.parse(await file.text()))
      if (!backup) throw new Error('Invalid backup')
      setPendingBackup(backup)
      setBackupNotice('Backup validated. Review it below before restoring.')
    } catch { setBackupNotice('This is not a valid Lampstand Project workspace backup.') }
  }

  function commitWorkspaceRestore(mode: 'merge' | 'replace') {
    if (!pendingBackup) return
    const result = applyWorkspaceBackup(localStorage, pendingBackup, mode)
    setPendingBackup(null)
    setBackupNotice(`${result.restored} entries restored${result.removed ? `; ${result.removed} existing workspace entries replaced` : ''}. Reloading Lampstand Project.`)
    window.setTimeout(() => window.location.reload(), 900)
  }

  function resetPersonalWorkspace() {
    if (!window.confirm('Reset all personal Lampstand data on this computer? This clears profiles, conversations, reading progress, annotations, School results, Church drafts, and preferences. Installed libraries, models, and program files are not removed. Download a backup first if you may need this data later.')) return
    resetPersonalData(localStorage)
    setBackupNotice('Personal workspace data was reset. Reloading Lampstand Project…')
    window.setTimeout(() => window.location.reload(), 600)
  }

  const providerCount =
    services?.providers.length ?? 0
  const readyProviderCount =
    services?.providers.filter(
      (provider) =>
        provider.available,
    ).length ?? 0

  return (
    <section className="settings-page">
      <header className="settings-header">
        <span><Settings size={25} /></span>
        <div><h1>Settings</h1><p>Manage local preferences and verify AIOS services.</p></div>
        <button
          type="button"
          className="settings-check-all icon-btn"
          title={checking || refreshingServices ? 'Checking all services' : 'Check all services'}
          aria-label={checking || refreshingServices ? 'Checking all services' : 'Check all services'}
          onClick={() =>
            void checkAllServices()
          }
          disabled={
            checking ||
            refreshingServices ||
            managingServices
          }
        >
          <RefreshCw
            size={15}
            className={
              checking ||
              refreshingServices
                ? 'spin'
                : undefined
            }
          />
        </button>
      </header>

      <div className="settings-grid">
        {canManage && <><h2 className="settings-section-title">Access and devices</h2>
          <AccessSettingsPanel />
          <RemoteAccessPanel /></>}
        <h2 className="settings-section-title">Services and models</h2>
        {canManage && <section className="settings-panel settings-ai-services">
          <div className="settings-panel-title"><Activity size={19} /><div><h2>AI Services</h2>
            <p>One switch starts every local dependency. Large GPU models are managed automatically.</p></div></div>
          <div className="settings-master-control">
            <div><strong>{!services ? 'Checking services...' : services.errors?.length ? 'AI Services need attention' : services.enabled ? services.allReady ? 'AI Services ready' : 'AI Services starting' : 'AI Services on standby'}</strong>
              <small>{services?.enabled ? 'AIOS loads only the model required for your current task.' : 'Large models are unloaded; background services can remain idle.'}</small>
              {services && providerCount > 0 ? (
                <div className="settings-readiness">
                  <span>{readyProviderCount} of {providerCount} providers ready</span>
                  <progress value={readyProviderCount} max={providerCount} aria-label={`${readyProviderCount} of ${providerCount} providers ready`} />
                </div>
              ) : null}
            </div>
            <button className={(services?.enabled ? 'enabled ' : '') + 'icon-btn'} type="button" role="switch"
              aria-checked={services?.enabled ?? false} disabled={!services || managingServices}
              title={services?.enabled ? 'AI services on - select to unload models' : 'AI services on standby - select to start them'}
              aria-label="AI services master switch"
              onClick={() => void toggleServices()}>
              {managingServices ? <RefreshCw className="spin" size={17} /> : <Power size={17} />}
            </button>
          </div>
          <div className="settings-provider-grid">
            {services ? [...services.providers].sort((left, right) => Number(left.available) - Number(right.available)).map((provider) => {
              const providerError = services.errors?.find((error) => error.id === provider.id)
              return <div key={provider.id} className={providerError ? 'has-error' : undefined} title={providerError?.message}>
                <span className={provider.available ? 'settings-service-dot online' : provider.configured === false ? 'settings-service-dot unconfigured' : 'settings-service-dot'} />
                <p><strong>{provider.label}</strong><small>{provider.available ? 'Ready' : providerError?.message || (provider.configured === false ? 'Not configured' : services.enabled ? 'Starting' : 'Offline')}</small></p>
              </div>
            }) : <p className="settings-service-placeholder">Waiting for service status...</p>}
          </div>
          {diagnosticsCopyError && <p className="settings-copy-error" role="alert">{diagnosticsCopyError}</p>}
          <div className="settings-services-refresh">
            <small>{lastServiceCheck ? `Last checked ${lastServiceCheck.toLocaleTimeString()}` : 'Status not checked yet'}</small>
            <div>
              <button type="button" className="icon-btn" title={diagnosticsCopied ? 'Diagnostics copied' : 'Copy service diagnostics'} aria-label="Copy service diagnostics" onClick={() => void copyDiagnostics()}>
                {diagnosticsCopied ? <Check size={14} /> : <Clipboard size={14} />}
              </button>
              <button type="button" className="icon-btn" title={refreshingServices ? 'Checking service status' : 'Refresh service status'} aria-label="Refresh service status" onClick={() => void refreshServices()} disabled={managingServices || refreshingServices}>
                <RefreshCw size={14} className={refreshingServices ? 'spin' : undefined} />
              </button>
              <button type="button" className="icon-btn" title={managingServices ? 'Repairing services' : 'Repair services'} aria-label="Repair services" onClick={() => void repairServices()} disabled={managingServices || refreshingServices}>
                <Wrench size={14} />
              </button>
            </div>
          </div>
          <div className="settings-auto-manage">
            <CheckCircle2 size={17} aria-hidden="true" />
            <span><strong>Automatic resource management</strong><small>Safely unload the previous large model when changing features.</small></span>
          </div>
          <div className="settings-provider-mode">
            <div className="settings-provider-mode-heading"><Cloud size={17} /><span><strong>Where AI requests run</strong><small>Local services protect privacy and work without usage fees. Cloud fallback is optional.</small></span></div>
            <div className="settings-provider-mode-options" role="radiogroup" aria-label="AI provider mode">
              {([
                ['local', 'Local only', 'Keep supported AI work on this computer.'],
                ['hybrid', 'Automatic (recommended)', 'Try local AI first, then a configured cloud provider when needed.'],
                ['cloud', 'Cloud only', 'Use configured Gemini, OpenAI, or Claude APIs for supported requests.'],
              ] as const).map(([value, label, description]) => <label key={value} className={providerMode === value ? 'selected' : ''}>
                <input type="radio" name="provider-mode" value={value} checked={providerMode === value} onChange={() => setProviderMode(value)} />
                <span><strong>{label}</strong><small>{description}</small></span>
              </label>)}
            </div>
            <div className="settings-cloud-providers">
              {([
                ['gemini', 'Gemini API key', 'Free tier available', services?.preferences?.geminiConfigured, geminiApiKey, setGeminiApiKey],
                ['openai', 'OpenAI API key', 'Paid API; separate from ChatGPT plans', services?.preferences?.openaiConfigured, openaiApiKey, setOpenaiApiKey],
                ['anthropic', 'Claude / Anthropic API key', 'Paid API; separate from Claude plans', services?.preferences?.anthropicConfigured, anthropicApiKey, setAnthropicApiKey],
              ] as const).map(([id, label, note, configured, value, setter]) => <div className="settings-cloud-provider-card" key={id}>
                <label className="settings-cloud-key"><span><KeyRound size={15} /><strong>{label}</strong><small>{configured ? `Configured securely. ${note}.` : note}</small></span>
                  <input type="password" autoComplete="off" value={value} onChange={(event) => setter(event.target.value)} placeholder={configured ? 'Enter a new key to replace it' : `Paste ${label}`} />
                </label>
                {configured ? <button type="button" className="settings-remove-provider remove icon-btn" title={`Remove the ${label}`} aria-label={`Remove the ${label}`} disabled={savingProviders} onClick={() => void updateProviderPreferences(id)}><Trash2 size={14} /></button> : null}
              </div>)}
              <div className="settings-cloud-provider-card">
                <label className="settings-cloud-key"><span><KeyRound size={15} /><strong>Tavily web search key</strong><small>{services?.preferences?.webSearchConfigured ? 'Configured securely. Used only when Web search is selected in Chat.' : 'Optional search API; a free developer allowance may be available.'}</small></span><input type="password" autoComplete="off" value={tavilyApiKey} onChange={(event) => setTavilyApiKey(event.target.value)} placeholder={services?.preferences?.webSearchConfigured ? 'Enter a new key to replace it' : 'Paste Tavily API key'} /></label>
                {services?.preferences?.webSearchConfigured ? <button type="button" className="settings-remove-provider remove icon-btn" title="Remove the Tavily web search key" aria-label="Remove the Tavily web search key" disabled={savingProviders} onClick={() => void updateProviderPreferences('tavily')}><Trash2 size={14} /></button> : null}
              </div>
            </div>
            <div className="settings-cloud-providers settings-model-options">
              <label className="settings-cloud-provider-card"><span><strong>Gemini model</strong><small>Choose any model enabled for your Gemini API key.</small></span><input value={geminiTextModel} onChange={(event) => setGeminiTextModel(event.target.value)} placeholder="gemini-3.6-flash" /></label>
              <label className="settings-cloud-provider-card"><span><strong>OpenAI model</strong><small>Choose any model enabled for your OpenAI API project.</small></span><input value={openaiTextModel} onChange={(event) => setOpenaiTextModel(event.target.value)} placeholder="gpt-4.1-mini" /></label>
              <label className="settings-cloud-provider-card"><span><strong>Claude model</strong><small>Choose any model enabled for your Anthropic API key.</small></span><input value={anthropicTextModel} onChange={(event) => setAnthropicTextModel(event.target.value)} placeholder="claude-3-5-haiku-latest" /></label>
            </div>
            <div className="settings-provider-mode-actions">
              <button type="button" className="primary" disabled={savingProviders || (providerMode === 'cloud' && !services?.preferences?.geminiConfigured && !services?.preferences?.openaiConfigured && !services?.preferences?.anthropicConfigured && !geminiApiKey.trim() && !openaiApiKey.trim() && !anthropicApiKey.trim())} onClick={() => void updateProviderPreferences()}>{savingProviders ? <RefreshCw className="spin" size={14} /> : <Check size={14} />} Save provider choice</button>
            </div>
            <p className="settings-provider-privacy">In Automatic mode, requests stay local unless local AI cannot complete them. Only the needed request is sent to the selected cloud API.</p>
            {providerNotice ? <p className="settings-provider-notice" role="status">{providerNotice}</p> : null}
          </div>
          {serviceError && <div className="settings-service-error" role="alert"><strong>AI Services need attention</strong><span>{serviceError}</span><button type="button" className="icon-btn" title="Check service status again" aria-label="Check service status again" onClick={() => void refreshServices()} disabled={refreshingServices}><RefreshCw size={13} /></button></div>}
        </section>}

        <section className="settings-panel settings-api-panel">
          <div className="settings-panel-title"><Server size={19} /><div><h2>AIOS API</h2><p>Connection used by Chat and Knowledge.</p></div></div>
          <div className="settings-service">
            <span className={online ? 'settings-service-dot online' : 'settings-service-dot'} />
            <div><strong>{checking ? 'Checking...' : status}</strong><code>{AIOS_API_BASE_URL}{online && apiLatencyMs !== null ? ` · ${apiLatencyMs} ms response` : ''}</code></div>
            <button type="button" className="icon-btn" title="Check the gateway connection" aria-label="Check the gateway connection" onClick={() => void checkConnection()} disabled={checking}>
              <RefreshCw size={15} className={checking ? 'spin' : ''} />
            </button>
          </div>
          {lastApiCheck && <p className="settings-last-api-check">Last checked {lastApiCheck.toLocaleTimeString()}</p>}
          {!checking && !online && <div className="settings-api-help" role="alert"><strong>Gateway connection unavailable</strong><span>Start Lampstand Project with the desktop launcher, wait for the Lampstand Gateway to report ready, and select Check again.</span></div>}
        </section>

        <h2 className="settings-section-title">Appearance and reading</h2>
        <section className="settings-panel settings-appearance-panel">
          <div className="settings-panel-title"><Palette size={19} /><div><h2>Appearance</h2><p>Choose a comfortable theme. Your selection is remembered on this device.</p></div></div>
          <label className="settings-appearance-choice"><span><strong>Colour mode</strong><small>Use the device setting automatically, or keep the app light or dark.</small></span><select value={preferences.theme} onChange={(event) => selectTheme(event.target.value as ThemePreference)}><option value="system">Use device setting</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
          <div className="settings-accent-choice"><span><strong>Accent colour</strong><small>The selected colour is applied immediately throughout every workspace.</small></span><div>{(['cyan', 'blue', 'teal', 'purple', 'gold', 'green', 'burgundy'] as AccentPreference[]).map((accent) => { const name = accent[0].toUpperCase() + accent.slice(1); return <button key={accent} type="button" className={preferences.accent === accent ? 'active' : ''} data-accent-option={accent} title={`${name} accent`} aria-label={`${name} accent`} aria-pressed={preferences.accent === accent} onClick={() => selectAccent(accent)}><i /></button> })}</div></div>
          <label className="settings-row"><span><strong>Compact interface</strong><small>Reduce navigation and workspace spacing.</small></span>
            <input type="checkbox" checked={preferences.compactUi} onChange={() => toggle('compactUi')} /></label>
          <label className="settings-row"><span><strong>Reduce motion</strong><small>Disable non-essential transitions and animations.</small></span>
            <input type="checkbox" checked={preferences.reducedMotion} onChange={() => toggle('reducedMotion')} /></label>
          <label className="settings-row"><span><strong>High contrast</strong><small>Increase text, border, and keyboard-focus visibility.</small></span>
            <input type="checkbox" checked={preferences.highContrast} onChange={() => toggle('highContrast')} /></label>
          <button className="settings-reset-appearance icon-btn" type="button"
            title="Reset appearance to defaults" aria-label="Reset appearance to defaults"
            disabled={!preferences.compactUi && !preferences.reducedMotion && !preferences.highContrast && preferences.theme === 'system' && preferences.accent === 'cyan'}
            onClick={() => setPreferences({ compactUi: false, reducedMotion: false, highContrast: false, theme: 'system', accent: 'cyan' })}>
            <RotateCcw size={14} />
          </button>
        </section>

        <section className="settings-panel settings-voice-panel">
          <div className="settings-panel-title"><Volume2 size={19} /><div><h2>Reading voice</h2><p>Voice used when reading selected Recovery Bible verses.</p></div></div>
          <label className="settings-voice-row"><span><strong>Bible voice</strong><small>Indian voices installed in Windows and available Indian language profiles.</small></span><select value={bibleVoice} onChange={(event) => setBibleVoice(event.target.value)}><optgroup label="Indian voices">{voices.filter((voice) => /-IN$/i.test(voice.lang)).map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}{INDIA_VOICE_PROFILES.filter(([lang]) => !voices.some((voice) => voice.lang.toLowerCase() === lang.toLowerCase())).map(([lang, name]) => <option key={lang} value={`profile:${lang}`}>{name} — system profile</option>)}</optgroup></select></label>
        </section>

        <h2 className="settings-section-title">Data and updates</h2>
        <section className="settings-panel settings-backup-panel">
          <div className="settings-panel-title"><Download size={19} /><div><h2>Backup and restore</h2><p>Protect locally saved AIOS progress, preferences, conversations, drafts, and history.</p></div></div>
          <p className="settings-backup-explanation">The workspace backup contains browser-saved AIOS data. Large models, indexed libraries, uploaded source documents, and generated media remain in their configured local folders.</p>
          <div className="settings-backup-actions"><button type="button" className="icon-btn" title="Download complete backup" aria-label="Download complete backup" onClick={downloadWorkspaceBackup}><Download size={15} /></button><button type="button" className="icon-btn" title="Restore from a backup file" aria-label="Restore from a backup file" onClick={() => restoreInputRef.current?.click()}><Upload size={15} /></button><button className="settings-reset-data" type="button" onClick={resetPersonalWorkspace}><Trash2 size={15} /> Reset personal data</button><input ref={restoreInputRef} hidden type="file" accept=".json,application/json" onChange={restoreWorkspaceBackup} /></div>
          {pendingBackup && <div className="settings-restore-preview"><strong>Validated AIOS backup</strong><span>{pendingBackup.storageEntries} entries · {(workspaceBackupSize(pendingBackup) / 1024).toFixed(1)} KB · exported {new Date(pendingBackup.exportedAt).toLocaleString()}</span><p><b>Merge</b> keeps other current AIOS data. <b>Replace</b> clears current AIOS browser data before restoring this backup.</p><div><button type="button" onClick={() => commitWorkspaceRestore('merge')}><Upload size={14} /> Merge safely</button><button className="replace" type="button" onClick={() => window.confirm('Replace all current AIOS browser data with this backup? Library files are not affected.') && commitWorkspaceRestore('replace')}><RotateCcw size={14} /> Replace workspace</button><button type="button" onClick={() => { setPendingBackup(null); setBackupNotice('Restore cancelled. No data was changed.') }}>Cancel</button></div></div>}
          {backupNotice && <p className="settings-backup-notice" role="status">{backupNotice}</p>}
        </section>

        <AppUpdatesPanel />
      </div>
    </section>
  )
}
export default SettingsPage
