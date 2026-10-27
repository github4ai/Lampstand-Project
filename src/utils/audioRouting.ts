export type AudioDevice = { deviceId: string; label: string }

/** Chromium only names a device once the microphone has been allowed, so the list is refreshed after a grant. */
export async function listAudioDevices(): Promise<{ inputs: AudioDevice[]; outputs: AudioDevice[] }> {
  const devices = await navigator.mediaDevices.enumerateDevices()
  const pick = (kind: 'audioinput' | 'audiooutput') => devices
    .filter((device) => device.kind === kind)
    .map((device) => ({ deviceId: device.deviceId, label: device.label || `${kind === 'audioinput' ? 'Microphone' : 'Speaker'} ${device.deviceId.slice(0, 4) || 'default'}` }))
  return { inputs: pick('audioinput'), outputs: pick('audiooutput') }
}

export const canChooseAudioOutput = () => typeof HTMLMediaElement === 'function' && 'setSinkId' in HTMLMediaElement.prototype

/** Route one media element through a chosen speaker output; unsupported devices keep the system default. */
export async function setElementSink(element: HTMLMediaElement, deviceId: string) {
  if (!deviceId || !('setSinkId' in element)) return false
  try { await element.setSinkId(deviceId); return true } catch { return false }
}

/** 0 to 1 loudness of one analyser frame — the meter the operator watches to trust the microphone is live. */
export function levelFromSamples(samples: Uint8Array) {
  if (!samples.length) return 0
  let total = 0
  for (const sample of samples) {
    const offset = (sample - 128) / 128
    total += offset * offset
  }
  return Math.min(1, Math.sqrt(total / samples.length) * 3)
}

export type MicrophoneMonitor = { stop(): void }

/**
 * Sends the chosen microphone out of the chosen speaker output so a speaker's voice reaches the room
 * through the same cable the videos use. Nothing is recorded or sent anywhere.
 */
export async function startMicrophoneMonitor(options: { inputDeviceId: string; outputDeviceId: string; onLevel: (level: number) => void }): Promise<MicrophoneMonitor> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: options.inputDeviceId ? { exact: options.inputDeviceId } : undefined } })
  const element = document.createElement('audio')
  element.srcObject = stream
  element.volume = 1
  await setElementSink(element, options.outputDeviceId)
  await element.play().catch(() => undefined)
  const context = new AudioContext()
  const source = context.createMediaStreamSource(stream)
  const analyser = context.createAnalyser()
  analyser.fftSize = 512
  source.connect(analyser)
  const samples = new Uint8Array(analyser.frequencyBinCount)
  let frame = 0
  const tick = () => {
    analyser.getByteTimeDomainData(samples)
    options.onLevel(levelFromSamples(samples))
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  return {
    stop() {
      cancelAnimationFrame(frame)
      stream.getTracks().forEach((track) => track.stop())
      element.pause()
      element.srcObject = null
      void context.close().catch(() => undefined)
      options.onLevel(0)
    },
  }
}
