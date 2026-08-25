import { CloudUpload, FolderOpen } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ensureFreshCloudSession, loadCloudSession, loadPublishedLibraryManifest, publicLibraryObjectUrl, saveCloudSession, uploadLibraryObject } from '../../utils/remoteAccess'

type Destination = 'school' | 'ministry' | 'church' | 'library'

const prefixes: Record<Exclude<Destination, 'library'>, string> = {
  school: 'data/knowledge/School', ministry: 'data/knowledge/Ministry', church: 'data/knowledge/Church',
}

function cleanPart(value: string) {
  return value.replaceAll('\\', '/').split('/').filter((part) => part && part !== '.' && part !== '..').join('/')
}

async function checksum(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export default function LibraryPublisherPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [destination, setDestination] = useState<Destination>('school')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [notice, setNotice] = useState('')
  const session = loadCloudSession()

  useEffect(() => { inputRef.current?.setAttribute('webkitdirectory', '') }, [])

  async function publish() {
    if (!session || files.length === 0) return
    setBusy(true); setProgress(0); setNotice('Preparing library update…')
    try {
      const fresh = await ensureFreshCloudSession(session); saveCloudSession(fresh)
      const manifest = await loadPublishedLibraryManifest()
      const entries = new Map(manifest.files.map((entry) => [entry.path, entry]))
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        const relative = cleanPart(file.webkitRelativePath || file.name).split('/').slice(file.webkitRelativePath ? 1 : 0).join('/') || cleanPart(file.name)
        const target = destination === 'library'
          ? `data/${cleanPart(file.webkitRelativePath || file.name).replace(/^data\//i, '')}`
          : `${prefixes[destination]}/${relative}`
        if (!target.toLowerCase().startsWith('data/')) throw new Error(`Invalid target for ${file.name}. Choose a folder whose contents belong under data.`)
        const objectPath = `files/${target}`
        setNotice(`Uploading ${index + 1} of ${files.length}: ${file.name}`)
        await uploadLibraryObject(fresh, objectPath, file, file.type || 'application/octet-stream')
        entries.set(target, { path: target, url: publicLibraryObjectUrl(objectPath), sha256: await checksum(file), size: file.size })
        setProgress(Math.round(((index + 1) / files.length) * 90))
      }
      const version = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
      const nextManifest = { version, files: [...entries.values()].sort((left, right) => left.path.localeCompare(right.path)) }
      await uploadLibraryObject(fresh, 'manifest.json', new Blob([JSON.stringify(nextManifest, null, 2)], { type: 'application/json' }), 'application/json')
      setProgress(100); setFiles([]); if (inputRef.current) inputRef.current.value = ''
      setNotice(`Library ${version} published. Members can use Settings → Check library.`)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to publish the library update.') }
    finally { setBusy(false) }
  }

  return <div className="settings-library-publisher">
    <div className="settings-panel-title"><CloudUpload size={18} /><div><h3>Publish library content</h3><p>Owner-only: upload an authorized folder without creating a new app release.</p></div></div>
    {!session ? <p className="settings-update-note">Sign in as Owner under Remote family access to publish library files.</p> : <>
      <div className="settings-library-publish-fields">
        <label>Content destination<select value={destination} onChange={(event) => setDestination(event.target.value as Destination)}><option value="school">School documents</option><option value="ministry">Ministry documents</option><option value="church">Church documents</option><option value="library">Packaged library data</option></select></label>
        <label>Folder to publish<span className="settings-folder-input"><FolderOpen size={15} /><input ref={inputRef} type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} /></span></label>
      </div>
      <p className="settings-update-note">{files.length ? `${files.length} files selected.` : 'Choose a folder. Its subfolder structure is preserved.'}</p>
      {busy && <div className="settings-update-progress"><progress value={progress} max="100" /><span>{progress}%</span></div>}
      <div className="settings-update-actions"><button type="button" className="primary" disabled={busy || files.length === 0} onClick={() => void publish()}><CloudUpload size={14} /> Publish library update</button></div>
    </>}
    {notice && <p className="settings-backup-notice" role="status">{notice}</p>}
  </div>
}
