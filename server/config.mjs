import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const cleanUrl = (value, fallback) => (value?.trim() || fallback).replace(/\/+$/, '')

function defaultWanOutputDir(env) {
  try {
    const pinokio = JSON.parse(readFileSync(join(homedir(), '.pinokio', 'config.json'), 'utf8'))
    if (pinokio.home) return join(pinokio.home, 'api', env.WANGP_PINOKIO_APP?.trim() || 'wan.git', 'app', 'outputs')
  } catch { /* WanGP output import is optional. */ }
  return ''
}

function documentPython(env, aiRoot) {
  const candidates=[env.AIOS_DOCUMENT_PYTHON?.trim(),join(homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','python','python.exe'),join(env.LOCALAPPDATA||'','Programs','Python','Python311','python.exe'),join(aiRoot,'ai-env','Scripts','python.exe')].filter(Boolean)
  return resolve(candidates.find((candidate)=>existsSync(candidate))||candidates[0])
}

function importPython(env, aiRoot) {
  // The HWMR reader needs the PDF libraries, which live in the ai-env interpreter when it exists.
  const candidates = [env.AIOS_HWMR_IMPORT_PYTHON?.trim(), join(aiRoot, 'ai-env', 'Scripts', 'python.exe'), join(env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe')].filter(Boolean)
  return resolve(candidates.find((candidate) => existsSync(candidate)) || candidates[0])
}

// VoiceStudio is an optional, separately installed app; its per-user install is the common one.
function voiceStudioExecutable(env) {
  const candidates = [env.VOICESTUDIO_EXE?.trim(), join(env.LOCALAPPDATA || '', 'Programs', 'VoiceStudio', 'VoiceStudio.exe'),
    join(env.PROGRAMFILES || '', 'VoiceStudio', 'VoiceStudio.exe')].filter(Boolean)
  return resolve(candidates.find((candidate) => existsSync(candidate)) || candidates[0])
}

/**
 * One order for which Python runs the transcription server, because the desktop launcher and the
 * gateway used to pick different environments: an explicit choice, then the interpreter the
 * installer laid down, then the one in the source tree, then the system Python. Empty means none of
 * them exist, and the transcription server is simply not started.
 */
export function resolveWhisperPython(env = process.env, projectRoot = process.cwd()) {
  const scripts = process.platform === 'win32' ? ['Scripts', 'python.exe'] : ['bin', 'python']
  const candidates = [
    env.WHISPER_PYTHON?.trim(),
    join(env.APPDATA || '', 'lampstand-studio', 'ai', 'whisper', '.venv', ...scripts),
    join(projectRoot, '.venv-whisper', ...scripts),
    join(env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', process.platform === 'win32' ? 'python.exe' : 'python'),
  ].filter(Boolean)
  return candidates.find((candidate) => existsSync(candidate)) || ''
}

export function loadConfig(env = process.env) {
  const aiRoot = resolve(env.AIOS_AI_ROOT?.trim() || join(process.cwd(), '..'))
  const knowledgeDir = resolve(env.AIOS_KNOWLEDGE_DIR?.trim() || join(aiRoot, 'Knowledge'))
  const projectRoot = resolve(process.cwd())
  return {
    projectRoot,
    mediaJobsFile: resolve(env.AIOS_MEDIA_JOBS_FILE?.trim() || join(process.cwd(), 'data', 'media-jobs.json')),
    servicesStateFile: resolve(env.AIOS_SERVICES_STATE_FILE?.trim() || join(process.cwd(), 'data', 'services-started.json')),
    host: env.AIOS_API_HOST?.trim() || '127.0.0.1',
    port: Number(env.AIOS_API_PORT || 9656),
    providerMode: env.AIOS_PROVIDER_MODE?.trim() || 'hybrid',
    providerPreferencesFile: resolve(env.AIOS_PROVIDER_PREFERENCES_FILE?.trim() || join(homedir(), '.lampstand-project', 'provider-settings.json')),
    allowedOrigins: [...new Set([
      ...(env.AIOS_ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean),
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5174',
    ])],
    ollamaUrl: cleanUrl(env.OLLAMA_URL, 'http://127.0.0.1:11434'),
    ollamaModel: env.OLLAMA_MODEL?.trim() || 'qwen3:8b',
    ollamaTranslationModel: env.OLLAMA_TRANSLATION_MODEL?.trim() || 'qwen3:8b',
    whisperUrl: cleanUrl(env.WHISPER_URL, 'http://127.0.0.1:8000'),
    whisperModel: env.WHISPER_MODEL?.trim() || 'whisper-1',
    comfyUrl: cleanUrl(env.COMFYUI_URL, 'http://127.0.0.1:8188'),
    wanUrl: cleanUrl(env.WANGP_URL, 'http://127.0.0.1:42003'),
    wanOutputDir: env.WANGP_OUTPUT_DIR?.trim() || defaultWanOutputDir(env),
    comfyCheckpoint: env.COMFYUI_CHECKPOINT?.trim() || 'juggernautXL_v8Rundiffusion.safetensors',
    aceStepModel: env.ACE_STEP_MODEL?.trim() || 'acestep_v1.5_turbo.safetensors',
    aceStepEncoder: env.ACE_STEP_ENCODER?.trim() || 'qwen_0.6b_ace15.safetensors',
    aceStepVae: env.ACE_STEP_VAE?.trim() || 'ace_1.5_vae.safetensors',
    ttsUrl: cleanUrl(env.ULTIMATE_TTS_URL, 'http://127.0.0.1:7860'),
    voiceStudioUrl: cleanUrl(env.VOICESTUDIO_URL, 'http://127.0.0.1:3900'),
    voiceStudioExecutable: voiceStudioExecutable(env),
    voiceStudioTranscriptionModel: env.VOICESTUDIO_TRANSCRIPTION_MODEL?.trim() || 'whisper-1',
    voiceStudioSpeechModel: env.VOICESTUDIO_SPEECH_MODEL?.trim() || 'omnivoice',
    voiceStudioSpeechVoice: env.VOICESTUDIO_SPEECH_VOICE?.trim() || 'default',
    ptermPath: env.AIOS_PTERM_PATH?.trim() || '',
    pinokioHome: env.PINOKIO_HOME?.trim() || '',
    comfyPinokioApp: env.COMFYUI_PINOKIO_APP?.trim() || 'comfy.git',
    wanPinokioApp: env.WANGP_PINOKIO_APP?.trim() || 'wan.git',
    ttsPinokioApp: env.TTS_PINOKIO_APP?.trim() || 'Ultimate-TTS-Studio.git',
    ollamaExecutable: env.OLLAMA_EXE?.trim() || join(env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'),
    whisperPython: resolveWhisperPython(env, projectRoot),
    legacyApiUrl: cleanUrl(env.AIOS_LEGACY_API_URL, 'http://127.0.0.1:9655'),
    openaiUrl: cleanUrl(env.OPENAI_BASE_URL, 'https://api.openai.com/v1'),
    openaiApiKey: env.OPENAI_API_KEY?.trim() || '',
    openaiTextModel: env.OPENAI_TEXT_MODEL?.trim() || 'gpt-4.1-mini',
    openaiTranscriptionModel: env.OPENAI_TRANSCRIPTION_MODEL?.trim() || 'gpt-4o-mini-transcribe',
    geminiUrl: cleanUrl(env.GEMINI_BASE_URL, 'https://generativelanguage.googleapis.com/v1beta'),
    geminiApiKey: env.GEMINI_API_KEY?.trim() || '',
    geminiTextModel: env.GEMINI_TEXT_MODEL?.trim() || 'gemini-3.6-flash',
    anthropicUrl: cleanUrl(env.ANTHROPIC_BASE_URL, 'https://api.anthropic.com/v1'),
    anthropicApiKey: env.ANTHROPIC_API_KEY?.trim() || '',
    anthropicTextModel: env.ANTHROPIC_TEXT_MODEL?.trim() || 'claude-3-5-haiku-latest',
    tavilyUrl: cleanUrl(env.TAVILY_BASE_URL, 'https://api.tavily.com'),
    tavilyApiKey: env.TAVILY_API_KEY?.trim() || '',
    maxAudioBytes: Number(env.AIOS_MAX_AUDIO_MB || 25) * 1024 * 1024,
    maxDocumentBytes: Number(env.AIOS_MAX_DOCUMENT_MB || 50) * 1024 * 1024,
    documentPython: documentPython(env, aiRoot),
    documentTranslationScript: resolve(env.AIOS_DOCUMENT_TRANSLATION_SCRIPT?.trim() || join(process.cwd(), 'scripts', 'translate-document.py')),
    knowledgeDir,
    knowledgeTrashDir: resolve(env.AIOS_KNOWLEDGE_TRASH_DIR?.trim() || join(process.cwd(), '..', 'Knowledge Trash')),
    knowledgeIndexDir: resolve(env.AIOS_KNOWLEDGE_INDEX_DIR?.trim() || join(process.cwd(), '..', 'Index')),
    maxKnowledgeBytes: Number(env.AIOS_MAX_KNOWLEDGE_MB || 100) * 1024 * 1024,
    knowledgeIndexPython: resolve(env.AIOS_INDEX_PYTHON?.trim() || join(env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe')),
    knowledgeIndexSitePackages: join(aiRoot, 'ai-env', 'Lib', 'site-packages'),
    knowledgeIndexScript: resolve(env.AIOS_INDEX_SCRIPT?.trim() || join(process.cwd(), 'scripts', 'prepare-and-index.py')),
    knowledgeIndexBuilder: resolve(env.AIOS_INDEX_BUILDER?.trim() || join(aiRoot, 'Scripts', 'Indexing', 'build_index.py')),
    knowledgeOcrArchive: resolve(env.AIOS_OCR_ARCHIVE?.trim() || join(aiRoot, 'OCR', 'Archive')),
    knowledgeIndexCwd: aiRoot,
    hymnalLibraryFile: resolve(env.AIOS_HYMNAL_LIBRARY_FILE?.trim() || join(process.cwd(), 'data', 'hymnal-library.json')),
    hwmrLibraryFile: resolve(env.AIOS_HWMR_LIBRARY_FILE?.trim() || join(process.cwd(), 'data', 'hwmr-library.json')),
    hwmrSourceDir: resolve(env.AIOS_HWMR_SOURCE_DIR?.trim() || join(knowledgeDir, 'Ministry', 'HWMR')),
    videoTrainingDir: resolve(env.AIOS_VIDEO_TRAINING_DIR?.trim() || join(knowledgeDir, 'Ministry', 'Video Training')),
    maxVideoTrainingBytes: Number(env.AIOS_MAX_VIDEO_TRAINING_MB || 2048) * 1024 * 1024,
    presentationMediaDir: resolve(env.AIOS_PRESENTATION_MEDIA_DIR?.trim() || join(knowledgeDir, 'Presentation Media')),
    maxPresentationMediaBytes: Number(env.AIOS_MAX_PRESENTATION_MEDIA_MB || 2048) * 1024 * 1024,
    presentationDeckScript: resolve(env.AIOS_PRESENTATION_DECK_SCRIPT?.trim() || join(process.cwd(), 'scripts', 'export-presentation-deck.ps1')),
    hwmrImporterScript: resolve(env.AIOS_HWMR_IMPORTER_SCRIPT?.trim() || join(process.cwd(), 'scripts', 'import-hwmr.py')),
    hwmrImportPython: importPython(env, aiRoot),
    hymnalMirrorRoot: resolve(env.AIOS_HYMNAL_MIRROR_ROOT?.trim() || 'I:\\AI\\Libraries\\HymnalNet\\www.hymnal.net'),
    recoveryBibleDir: resolve(env.AIOS_RECOVERY_BIBLE_DIR?.trim() || join(process.cwd(), '..', 'Knowledge', 'Ministry', 'Bible', 'Recovery Version')),
    recoveryFootnotesDir: resolve(env.AIOS_RECOVERY_FOOTNOTES_DIR?.trim() || 'I:\\AI\\Libraries\\Ministry\\Footnotes\\footnotes\\bibleread.online\\note'),
    lifeStudyDir: resolve(env.AIOS_LIFE_STUDY_DIR?.trim() || 'I:\\AI\\Libraries\\Ministry\\Bible, Life-Study, Ministry Books\\Bible - Recovery Version\\bibleread.online\\life-study-of-the-bible'),
    ministryBooksDir: resolve(env.AIOS_MINISTRY_BOOKS_DIR?.trim() || 'I:\\AI\\Libraries\\Ministry\\Bible, Life-Study, Ministry Books\\Bible - Recovery Version\\bibleread.online\\all-books-by-Watchman-Nee-and-Witness-Lee'),
    ministryBooksDatabase: resolve(env.AIOS_MINISTRY_BOOKS_DATABASE?.trim() || join(process.cwd(), 'data', 'ministry-books', 'library.sqlite')),
    ministryLibraryDir: resolve(env.AIOS_MINISTRY_LIBRARY_DIR?.trim() || join(process.cwd(), 'data', 'ministry-library')),
  }
}
