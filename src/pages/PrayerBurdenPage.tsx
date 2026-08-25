import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Check,
  Clipboard,
  HeartHandshake,
  MessageCircle,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { generateChurchText } from '../api/church'
import { useAccessControl } from '../hooks/useAccessControl'
import { loadChurchGroupDefaults, loadSavedChurchGroups } from '../utils/churchGroups'
import '../styles/church.css'

type SavedPrayerBurden = {
  id: string
  meetingDate: string
  targetGroup?: string
  content: string
  savedAt: string
  postedAt?: string
  scheduledAt?: string
  received?: string
  additional?: string
}

const storageKey = 'aios-church-prayer-burdens-v1'
const workingStorageKey = 'aios-church-prayer-burden-working-v1'

type PrayerWorkingDraft = { meetingDate?: string; targetGroup?: string; received?: string; additional?: string; instructions?: string; draft?: string; editingRecordId?: string; scheduledAt?: string }

function loadWorkingDraft(): PrayerWorkingDraft {
  try { return JSON.parse(localStorage.getItem(workingStorageKey) || '{}') } catch { return {} }
}

function loadChurchGroups() {
  return loadSavedChurchGroups()
}

function localDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function nextTuesday() {
  const date = new Date()
  const daysUntilTuesday = (2 - date.getDay() + 7) % 7
  date.setDate(date.getDate() + daysUntilTuesday)
  return localDateValue(date)
}

function loadHistory(): SavedPrayerBurden[] {
  try {
    const saved = localStorage.getItem(storageKey)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function extractPrayerPoints(value: string) {
  return value
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
}

function formatPrayerPointsMessage(value: string) {
  const lines = value
    .replace(/\p{Extended_Pictographic}/gu, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/[*_#]/g, '').trim())
    .filter((line) => line && !/^(?:date|time)\s*:/i.test(line) && !/^prayer\s*points$/i.test(line))
  const formatted: string[] = ['Prayer Points']
  lines.forEach((line) => {
    const main = line.match(/^(\d+)[.)]\s*(.+)$/)
    if (main) { formatted.push('', `${main[1]}. ${main[2]}`); return }
    const sub = line.match(/^(?:[-•]|[a-z][.)])\s*(.+)$/i)
    if (sub) { formatted.push(`- ${sub[1]}`); return }
    formatted.push(line)
  })
  return formatted.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function formattedDate(value: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(`${value}T12:00:00`))
}

export default function PrayerBurdenPage() {
  const { can } = useAccessControl()
  const [workingDraft] = useState(loadWorkingDraft)
  const [churchGroups] = useState(loadChurchGroups)
  const [meetingDate, setMeetingDate] = useState(workingDraft.meetingDate || nextTuesday())
  const [targetGroup, setTargetGroup] = useState(() => {
    const preferred = workingDraft.targetGroup || loadChurchGroupDefaults().prayerPoints
    return churchGroups.includes(preferred) ? preferred : ''
  })
  const [received, setReceived] = useState(workingDraft.received || '')
  const [additional, setAdditional] = useState(workingDraft.additional || '')
  const [instructions, setInstructions] = useState(workingDraft.instructions || '')
  const [draft, setDraft] = useState(workingDraft.draft || '')
  const [editingRecordId, setEditingRecordId] = useState(workingDraft.editingRecordId || '')
  const [history, setHistory] = useState<SavedPrayerBurden[]>(loadHistory)
  const [notice, setNotice] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [scheduledAt, setScheduledAt] = useState(workingDraft.scheduledAt || '')

  const prayerPointCount = useMemo(
    () => extractPrayerPoints(received).length + extractPrayerPoints(additional).length,
    [received, additional],
  )

  useEffect(() => {
    localStorage.setItem(workingStorageKey, JSON.stringify({ meetingDate, targetGroup, received, additional, instructions, draft, editingRecordId, scheduledAt }))
  }, [meetingDate, targetGroup, received, additional, instructions, draft, editingRecordId, scheduledAt])

  async function createDraft() {
    if (!can('church', 'create')) { setNotice('Your profile cannot create prayer points.'); return }
    const receivedPrayerPoints = extractPrayerPoints(received)
    const addedPrayerPoints = extractPrayerPoints(additional)
    const prayerPoints = [...receivedPrayerPoints, ...addedPrayerPoints]
    if (!prayerPoints.length) {
      setNotice('Add at least one prayer point first.')
      return
    }

    setIsGenerating(true); setNotice('AIOS is preparing prayer points for your review…')
    try {
      const response = await generateChurchText(`Prepare a concise WhatsApp prayer-points message for the Sakinaka–Mumbai church prayer meeting.

Received prayer points (preserve every fact and do not invent names, events, medical details, or promises):
${receivedPrayerPoints.map((item, index) => `${index + 1}. ${item}`).join('\n') || 'None'}

Additional prayer points supplied by me:
${addedPrayerPoints.map((item, index) => `${index + 1}. ${item}`).join('\n') || 'None'}

Additional drafting instructions from me:
${instructions.trim() || 'None'}

Improve clarity and respectful wording while preserving every supplied main matter as a numbered prayer point. Under every numbered point write exactly three substantial, specific subpoints, and begin every subpoint with "- ". Do not add new main prayer points, names, events, diagnoses, promises, or facts. The title must be exactly "Prayer Points". Do not include a date, time, emoji, icon, greeting, decorative symbol, or closing. Leave one blank line between numbered groups. Produce only the final WhatsApp-ready message.`)
      if (!response.text?.trim()) throw new Error('Empty response')
      setDraft(formatPrayerPointsMessage(response.text)); setNotice(`Draft created with ${response.model}. Please verify every detail before sharing.`)
    } catch {
      const numbered = prayerPoints.map((point, index) => `${index + 1}. ${point}\n\n- Pray specifically concerning this matter and for the Lord's sovereign arrangement.\n- Pray for the Lord's timely leading, strengthening, supply, and blessing in every practical detail.\n- Pray for the saints to stand together in one accord and cooperate faithfully with this burden.`).join('\n\n')
      setDraft(`Prayer Points\n\n${numbered}`)
      setNotice('A local draft was created. Please review it before sharing.')
    } finally { setIsGenerating(false) }
  }

  function archiveDraft(posted = false, schedule = false) {
    if (!can('church', editingRecordId ? 'edit' : 'create')) { setNotice('Your profile cannot save prayer points.'); return }
    if (!draft.trim()) return
    if (!targetGroup || !churchGroups.includes(targetGroup)) { setNotice('Choose a saved WhatsApp group before saving.'); return }
    const now = new Date().toISOString()
    const id = editingRecordId || crypto.randomUUID()
    const item: SavedPrayerBurden = {
      id, meetingDate, targetGroup: targetGroup.trim(), content: draft.trim(), savedAt: now,
      postedAt: posted ? now : undefined, scheduledAt: schedule ? new Date(scheduledAt).toISOString() : undefined,
      received,
      additional,
    }
    const next = [item, ...history.filter((entry) => entry.id !== id)]
    setHistory(next)
    setEditingRecordId(id)
    localStorage.setItem(storageKey, JSON.stringify(next))
    setNotice(posted ? 'Prayer points archived with their posting time.' : schedule ? 'Prayer points scheduled. Lampstand Project will show a reminder when they are due.' : editingRecordId ? 'Saved prayer points updated.' : 'Prayer points saved locally as a draft.')
  }

  function saveDraft() { archiveDraft(false) }
  function scheduleDraft() {
    if (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now()) { setNotice('Choose a future date and time.'); return }
    archiveDraft(false, true)
  }

  async function copyDraft() {
    if (!can('church', 'share')) { setNotice('Your profile cannot copy prayer points for sharing.'); return }
    if (!draft.trim()) return
    await navigator.clipboard.writeText(draft)
    setNotice('Copied. You can now paste it into WhatsApp.')
  }

  function shareToWhatsApp() {
    if (!can('church', 'share')) { setNotice('Your profile cannot share prayer points.'); return }
    if (!draft.trim()) return
    if (!targetGroup || !churchGroups.includes(targetGroup)) { setNotice('Choose a saved WhatsApp group before sharing.'); return }
    archiveDraft(true)
    window.open(`https://wa.me/?text=${encodeURIComponent(draft)}`, '_blank', 'noopener,noreferrer')
  }

  function deleteHistory(id: string) {
    if (!can('church', 'delete')) { setNotice('Your profile cannot delete saved prayer points.'); return }
    if (!window.confirm('Delete these saved prayer points? This cannot be undone unless you have a Church Records backup.')) return
    const next = history.filter((item) => item.id !== id)
    setHistory(next)
    if (editingRecordId === id) setEditingRecordId('')
    localStorage.setItem(storageKey, JSON.stringify(next))
  }

  function startNew() {
    if ((received || additional || draft) && !window.confirm('Start new prayer points? Unsaved working text will be cleared.')) return
    const date = nextTuesday()
    setMeetingDate(date); setReceived(''); setAdditional(''); setDraft(''); setEditingRecordId(''); setScheduledAt(''); setNotice('New prayer points started.')
    localStorage.setItem(workingStorageKey, JSON.stringify({ meetingDate: date, targetGroup, received: '', additional: '', draft: '', editingRecordId: '' }))
  }

  return <section className="church-page prayer-workspace">
    <Link className="church-back" to="/church"><ArrowLeft size={16} /> Church</Link>
    <header className="church-header">
      <span><HeartHandshake size={27} /></span>
      <div><h1>Prayer Points</h1><p>Prepare, review, save, and share Tuesday prayer points.</p></div>
      <button className="church-start-new" type="button" onClick={startNew}><RotateCcw size={16} /> Start new</button>
    </header>

    <div className="prayer-layout">
      <section className="prayer-panel prayer-input-panel">
        <div className="prayer-panel-title"><div><h2>Prepare prayer points</h2><p>{prayerPointCount} prayer point{prayerPointCount === 1 ? '' : 's'} added</p></div></div>

        <label className="prayer-field">Prayer meeting date
          <input type="date" value={meetingDate} onChange={(event) => setMeetingDate(event.target.value)} />
        </label>
        <label className="prayer-field">WhatsApp group for this post
          <select value={targetGroup} onChange={(event) => setTargetGroup(event.target.value)} disabled={churchGroups.length === 0}><option value="">{churchGroups.length ? 'Choose a saved group' : 'No WhatsApp groups added'}</option>{churchGroups.map((group) => <option key={group} value={group}>{group}</option>)}</select>
          <span><Link to="/church/groups">Add or manage WhatsApp groups</Link></span>
        </label>
        <label className="prayer-field">Received through WhatsApp
          <span>Paste each prayer point on a new line.</span>
          <textarea rows={8} value={received} onChange={(event) => setReceived(event.target.value)} placeholder="Paste the 3–5 received prayer points here…" />
        </label>
        <label className="prayer-field">Additional prayer points
          <span>Add prayer points for the saints to pray for.</span>
          <textarea rows={6} value={additional} onChange={(event) => setAdditional(event.target.value)} placeholder="Add one prayer point per line…" />
        </label>
        <label className="prayer-field">Drafting instructions (optional)
          <span>Add tone, emphasis, order, or other directions for this draft.</span>
          <textarea rows={4} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="For example: keep the wording concise and place the gospel burden first." />
        </label>
        <div className="prayer-generation-actions"><button className="prayer-primary-button" type="button" onClick={createDraft} disabled={isGenerating}><Sparkles size={17} /> {isGenerating ? 'Creating draft…' : 'Create WhatsApp draft'}</button></div>
      </section>

      <section className="prayer-panel prayer-preview-panel">
        <div className="prayer-panel-title"><div><h2>Review before posting</h2><p>Edit anything before you share it.</p></div><span className="review-badge"><Check size={14} /> Approval required</span></div>
        <textarea className="prayer-draft" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Your formatted prayer points will appear here." />
        <label className="prayer-field prayer-schedule-field">Posting reminder (optional)<input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>
        <div className="prayer-actions">
          <button type="button" onClick={saveDraft} disabled={!draft.trim()}><Save size={16} /> {editingRecordId ? 'Update' : 'Save'}</button>
          <button type="button" onClick={copyDraft} disabled={!draft.trim()}><Clipboard size={16} /> Copy</button>
          <button type="button" onClick={scheduleDraft} disabled={!draft.trim() || !scheduledAt}><Save size={16} /> Schedule reminder</button>
          <button className="whatsapp-button" type="button" onClick={shareToWhatsApp} disabled={!draft.trim()}><MessageCircle size={16} /> Share to WhatsApp</button>
        </div>
        {notice && <p className="prayer-notice" role="status">{notice}</p>}
      </section>
    </div>

    <section className="prayer-history">
      <div className="prayer-panel-title"><div><h2>Saved prayer points</h2><p>Stored privately in this browser.</p></div></div>
      {history.length === 0 ? <div className="prayer-history-empty"><Plus size={22} /><p>Saved drafts will appear here.</p></div> :
        <div className="prayer-history-list">{history.map((item) => <article key={item.id}>
          <button className="prayer-history-open" type="button" onClick={() => { setMeetingDate(item.meetingDate); setTargetGroup(item.targetGroup && churchGroups.includes(item.targetGroup) ? item.targetGroup : ''); setReceived(item.received || ''); setAdditional(item.additional || ''); setDraft(item.content); setEditingRecordId(item.id); setScheduledAt(item.scheduledAt ? item.scheduledAt.slice(0, 16) : ''); setNotice(item.targetGroup && !churchGroups.includes(item.targetGroup) ? 'This record used an old group. Choose a currently saved group before updating it.' : 'Editing saved prayer points.'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
            <strong>{formattedDate(item.meetingDate)}</strong><span>{item.targetGroup ? `${item.targetGroup} · ` : ''}{item.postedAt ? `Posted ${new Date(item.postedAt).toLocaleString('en-IN')}` : item.scheduledAt ? `Scheduled ${new Date(item.scheduledAt).toLocaleString('en-IN')}` : `Draft saved ${new Date(item.savedAt).toLocaleString('en-IN')}`}</span>
          </button>
          <button className="prayer-delete" type="button" onClick={() => deleteHistory(item.id)} aria-label="Delete saved prayer points"><Trash2 size={16} /></button>
        </article>)}</div>}
    </section>
  </section>
}
