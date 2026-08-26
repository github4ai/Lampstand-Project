import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const voices = {
  en: ['en-IN-NeerjaNeural', 'en-IN-PrabhatNeural'],
  zh: ['zh-CN-XiaoxiaoNeural', 'zh-CN-YunxiNeural'],
  ta: ['ta-IN-PallaviNeural', 'ta-IN-ValluvarNeural'],
  hi: ['hi-IN-SwaraNeural', 'hi-IN-MadhurNeural'],
  mr: ['mr-IN-AarohiNeural', 'mr-IN-ManoharNeural'],
  te: ['te-IN-ShrutiNeural', 'te-IN-MohanNeural'],
  ml: ['ml-IN-SobhanaNeural', 'ml-IN-MidhunNeural'],
  kn: ['kn-IN-SapnaNeural', 'kn-IN-GaganNeural'],
  ru: ['ru-RU-SvetlanaNeural', 'ru-RU-DmitryNeural'],
  ko: ['ko-KR-SunHiNeural', 'ko-KR-InJoonNeural'],
}

function pythonExecutable() {
  const configured = process.env.AIOS_PRONUNCIATION_PYTHON?.trim() || process.env.AIOS_DOCUMENT_PYTHON?.trim()
  if (configured && existsSync(configured)) return configured
  const installed = join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe')
  return existsSync(installed) ? installed : 'python'
}

export function supportsOnlinePronunciation(language) {
  return Boolean(voices[language]?.length)
}

export async function createOnlinePronunciation({ text, language, rate = 0.9, voice: requestedVoice }, _config) {
  const value = String(text || '').trim()
  const availableVoices = voices[language] || []
  const voice = availableVoices.includes(requestedVoice) ? requestedVoice : availableVoices[0]
  if (!value) throw Object.assign(new Error('Enter text to pronounce.'), { status: 400 })
  if (value.length > 5000) throw Object.assign(new Error('Pronunciation text is limited to 5,000 characters.'), { status: 413 })
  if (!voice) throw Object.assign(new Error('No online pronunciation voice is configured for this language.'), { status: 400 })

  const script = process.env.AIOS_PRONUNCIATION_SCRIPT?.trim() || join(process.cwd(), 'server', 'edge-pronunciation.py')
  const pythonPath = process.env.AIOS_PYTHON_OVERRIDES?.trim() || join(process.cwd(), 'python_overrides')
  if (!existsSync(script)) throw Object.assign(new Error('Pronunciation support is missing from this installation. Use Settings → App updates → Reinstall this version to repair it.'), { status: 503 })
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
    child.on('error', reject)
    child.on('close', (code) => {
      if (code || !audio.length) return reject(new Error(Buffer.concat(errors).toString('utf8').trim() || 'The online pronunciation service did not return audio.'))
      resolve({ audio: Buffer.concat(audio), voice, provider: 'Microsoft neural voice' })
    })
    child.stdin.end(JSON.stringify({ text: value, voice, rate: `${ratePercent >= 0 ? '+' : ''}${ratePercent}%` }))
  })
}
