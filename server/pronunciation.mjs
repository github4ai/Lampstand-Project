import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { delimiter, join } from 'node:path'

const voices = {
  en: ['en-IN-NeerjaNeural', 'en-IN-PrabhatNeural'],
  zh: ['zh-CN-XiaoxiaoNeural', 'zh-CN-YunxiNeural'],
  ta: ['ta-IN-PallaviNeural', 'ta-IN-ValluvarNeural'],
  hi: ['hi-IN-SwaraNeural', 'hi-IN-MadhurNeural'],
  mr: ['mr-IN-AarohiNeural', 'mr-IN-ManoharNeural'],
  te: ['te-IN-ShrutiNeural', 'te-IN-MohanNeural'],
  ml: ['ml-IN-SobhanaNeural', 'ml-IN-MidhunNeural'],
  kn: ['kn-IN-SapnaNeural', 'kn-IN-GaganNeural'],
  // Konkani uses Devanagari; Marathi and Hindi neural voices provide the
  // closest broadly available pronunciation support for this script.
  kok: ['mr-IN-AarohiNeural', 'mr-IN-ManoharNeural', 'hi-IN-SwaraNeural', 'hi-IN-MadhurNeural', 'en-IN-NeerjaNeural', 'en-IN-PrabhatNeural'],
  ru: ['ru-RU-SvetlanaNeural', 'ru-RU-DmitryNeural'],
  ko: ['ko-KR-SunHiNeural', 'ko-KR-InJoonNeural'],
}

function pythonExecutable() {
  return installedPython() || 'python'
}

function installedPython() {
  const configured = [process.env.AIOS_PRONUNCIATION_PYTHON?.trim(), process.env.AIOS_DOCUMENT_PYTHON?.trim()].filter(Boolean)
  const bundled = join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe')
  const onPath = (process.env.PATH || '').split(delimiter).filter(Boolean)
    .map((directory) => join(directory, process.platform === 'win32' ? 'python.exe' : 'python'))
  return [...configured, bundled, ...onPath].find(existsSync) || ''
}

function pronunciationScript() {
  return process.env.AIOS_PRONUNCIATION_SCRIPT?.trim() || join(process.cwd(), 'server', 'edge-pronunciation.py')
}

export function pronunciationReadiness() {
  if (!installedPython()) return { ready: false, reason: 'Online voices need Python, which is not installed on this computer. Choose a Windows voice instead, or install Python 3.11 and restart the app.' }
  if (!existsSync(pronunciationScript())) return { ready: false, reason: 'Pronunciation support is missing from this installation. Use Settings → App updates → Reinstall this version to repair it.' }
  return { ready: true, reason: '' }
}

/** Python tracebacks name server paths the operator cannot act on; the app log keeps the detail. */
function onlineVoiceFailure(stderr) {
  const detail = String(stderr || '').trim()
  if (/NoAudioReceived|403|handshake|Forbidden/i.test(detail)) return 'Microsoft\u2019s online voice service could not be reached. Check the internet connection, then try again or choose a Windows voice.'
  if (/getaddrinfo|Cannot connect|Network is unreachable|TimeoutError|SSL/i.test(detail)) return 'The online voice service is unreachable. Check this computer\u2019s internet connection, then try again.'
  if (/ModuleNotFound|ImportError|SyntaxError|No such file|Traceback/i.test(detail)) return 'The online voice service could not start on this computer. Choose a Windows voice, or reinstall the app from Settings \u2192 App updates.'
  return 'The online voice service did not return audio. Try again, or choose a Windows voice instead.'
}

export function supportsOnlinePronunciation(language) {
  return Boolean(voices[language]?.length)
}

export function onlinePronunciationLanguages() {
  return Object.keys(voices)
}

export async function createOnlinePronunciation({ text, language, rate = 0.9, voice: requestedVoice }, _config) {
  const value = String(text || '').trim()
  const availableVoices = voices[language] || []
  const voice = availableVoices.includes(requestedVoice) ? requestedVoice : availableVoices[0]
  if (!value) throw Object.assign(new Error('Enter text to pronounce.'), { status: 400 })
  if (value.length > 5000) throw Object.assign(new Error('Pronunciation text is limited to 5,000 characters.'), { status: 413 })
  if (!voice) throw Object.assign(new Error('No online pronunciation voice is configured for this language.'), { status: 400 })

  const script = pronunciationScript()
  const ready = pronunciationReadiness()
  if (!ready.ready) throw Object.assign(new Error(ready.reason), { status: 503 })
  const pythonPath = process.env.AIOS_PYTHON_OVERRIDES?.trim() || join(process.cwd(), 'python_overrides')
  const ratePercent = Math.round((Math.max(0.5, Math.min(1.5, Number(rate) || 0.9)) - 1) * 100)
  return new Promise((resolve, reject) => {
  const child = spawn(pythonExecutable(), [script], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', PYTHONPATH: [pythonPath, process.env.PYTHONPATH].filter(Boolean).join(';') },
      windowsHide: true,
    })
    const audio = []; const errors = []
    child.stdout.on('data', (chunk) => audio.push(chunk))
    child.stderr.on('data', (chunk) => errors.push(chunk))
    child.on('error', (cause) => {
      console.error(`[pronunciation] ${voice} spawn failed: ${cause.message}`)
      reject(Object.assign(new Error('The online voice service could not start on this computer. Choose a Windows voice, or reinstall the app from Settings \u2192 App updates.'), { status: 503 }))
    })
    child.on('close', (code) => {
      const detail = Buffer.concat(errors).toString('utf8')
      if (code || !audio.length) {
        console.error(`[pronunciation] ${voice} failed (exit ${code}): ${detail.trim().slice(0, 2000) || 'no output'}`)
        return reject(Object.assign(new Error(onlineVoiceFailure(detail)), { status: 502 }))
      }
      resolve({ audio: Buffer.concat(audio), voice, provider: 'Microsoft neural voice' })
    })
    child.stdin.end(JSON.stringify({ text: value, voice, rate: `${ratePercent >= 0 ? '+' : ''}${ratePercent}%` }))
  })
}
