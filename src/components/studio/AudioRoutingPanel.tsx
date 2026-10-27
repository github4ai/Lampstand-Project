import { Mic, MicOff, RefreshCw, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { canChooseAudioOutput, listAudioDevices, startMicrophoneMonitor, type AudioDevice, type MicrophoneMonitor } from '../../utils/audioRouting'
import './StudioPanels.css'

/**
 * A worship room needs one audio path: the microphone and whatever the studio is playing leave
 * through the same speaker output the projector cable is attached to. Nothing here is recorded.
 */
export default function AudioRoutingPanel({ outputDeviceId, onOutputDevice, onNotice }: { outputDeviceId: string; onOutputDevice: (deviceId: string) => void; onNotice: (message: string) => void }) {
  const desktop = window.lampstandDesktop?.presentation
  const [inputs, setInputs] = useState<AudioDevice[]>([])
  const [outputs, setOutputs] = useState<AudioDevice[]>([])
  const [micInput, setMicInput] = useState('')
  const [micOn, setMicOn] = useState(false)
  const [masterMute, setMasterMute] = useState(false)
  const [level, setLevel] = useState(0)
  const [error, setError] = useState('')
  const monitorRef = useRef<MicrophoneMonitor | null>(null)

  async function loadDevices() {
    try {
      const devices = await listAudioDevices()
      setInputs(devices.inputs)
      setOutputs(devices.outputs)
      if (!devices.inputs.length) setError('No microphone was found on this computer.')
    } catch (err) { setError(err instanceof Error ? err.message : 'The audio devices could not be listed.') }
  }
  useEffect(() => { void loadDevices() }, [])

  useEffect(() => {
    let cancelled = false
    if (!micOn || masterMute) { monitorRef.current?.stop(); monitorRef.current = null; setLevel(0); return }
    void startMicrophoneMonitor({ inputDeviceId: micInput, outputDeviceId, onLevel: (value) => { if (!cancelled) setLevel(value) } })
      .then((monitor) => { if (cancelled) monitor.stop(); else monitorRef.current = monitor })
      .catch((err: Error) => { setMicOn(false); setError(err.message || 'The microphone could not be opened - allow microphone access for this app.') })
    return () => { cancelled = true; monitorRef.current?.stop(); monitorRef.current = null }
  }, [micOn, masterMute, micInput, outputDeviceId])

  useEffect(() => () => { monitorRef.current?.stop() }, [])

  function toggleMasterMute() {
    const next = !masterMute
    setMasterMute(next)
    void desktop?.command(next ? 'mute' : 'unmute')
    onNotice(next ? 'All sound to the room is muted.' : 'Sound to the room is back on.')
  }

  const canChooseOutput = canChooseAudioOutput()

  return <div className="audio-panel">
    <div className="audio-row">
      <label>Speaker output for the room
        <select value={outputDeviceId} disabled={!canChooseOutput} onChange={(event) => onOutputDevice(event.target.value)}>
          <option value="">System default</option>
          {outputs.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
        </select>
      </label>
      <label>Microphone input
        <select value={micInput} onChange={(event) => setMicInput(event.target.value)}>
          <option value="">Default microphone</option>
          {inputs.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
        </select>
      </label>
      <button type="button" className={micOn ? 'take-live' : ''} onClick={() => setMicOn((value) => !value)}>{micOn ? <MicOff size={15}/> : <Mic size={15}/>} {micOn ? 'Stop the microphone to the room' : 'Send the microphone to the room'}</button>
      <span className="level-meter" role="meter" aria-valuenow={Math.round(level * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Microphone level"><span style={{ width: `${Math.round(level * 100)}%` }} /></span>
      <button type="button" onClick={toggleMasterMute}>{masterMute ? <Volume2 size={15}/> : <MicOff size={15}/>} {masterMute ? 'Unmute the room' : 'Mute the room'}</button>
      <button type="button" onClick={() => void loadDevices()} title="Some devices only name themselves after access is allowed"><RefreshCw size={14}/> Refresh devices</button>
    </div>
    {!canChooseOutput && <p className="studio-note">This browser cannot pick a speaker, so audio uses the system default. The desktop app can route it to the projector output.</p>}
    <p className="studio-note">Media played from the studio - videos, audio, PDF - leaves through the speaker chosen above. The microphone button is a live path only: it is not recorded and it does not go to the internet.</p>
    {error && <p className="audio-error">{error}</p>}
    {masterMute && <p className="audio-error">Room audio is muted by the studio.</p>}
  </div>
}
