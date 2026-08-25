import { useEffect, useState } from 'react'
import { ArrowLeft, Check, Clipboard, LoaderCircle, Megaphone, MessageCircle, RotateCcw, Save, Sparkles, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { generateChurchText } from '../api/church'
import { useAccessControl } from '../hooks/useAccessControl'
import { loadChurchGroupDefaults, loadSavedChurchGroups } from '../utils/churchGroups'
import '../styles/church.css'

type SavedAnnouncement = { id: string; title: string; eventDate: string; eventTime?: string; targetGroup?: string; details?: string; contact?: string; content: string; savedAt: string; postedAt?: string; scheduledAt?: string }
const storageKey = 'aios-church-announcements-v1'
const workingStorageKey = 'aios-church-announcement-working-v1'
type AnnouncementWorkingDraft = { title?: string; eventDate?: string; eventTime?: string; targetGroup?: string; details?: string; contact?: string; draft?: string; editingRecordId?: string; scheduledAt?: string }

function loadWorkingDraft(): AnnouncementWorkingDraft {
  try { return JSON.parse(localStorage.getItem(workingStorageKey) || '{}') } catch { return {} }
}

function loadChurchGroups() {
  return loadSavedChurchGroups()
}

function loadHistory(): SavedAnnouncement[] {
  try { const value = localStorage.getItem(storageKey); return value ? JSON.parse(value) : [] } catch { return [] }
}

function displayDate(value: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
}

export default function ChurchAnnouncementsPage() {
  const { can } = useAccessControl()
  const [workingDraft] = useState(loadWorkingDraft)
  const [churchGroups] = useState(loadChurchGroups)
  const [title, setTitle] = useState(workingDraft.title || '')
  const [eventDate, setEventDate] = useState(workingDraft.eventDate || '')
  const [eventTime, setEventTime] = useState(workingDraft.eventTime || '')
  const [targetGroup, setTargetGroup] = useState(() => {
    const preferred = workingDraft.targetGroup || loadChurchGroupDefaults().announcements
    return churchGroups.includes(preferred) ? preferred : ''
  })
  const [details, setDetails] = useState(workingDraft.details || '')
  const [contact, setContact] = useState(workingDraft.contact || '')
  const [draft, setDraft] = useState(workingDraft.draft || '')
  const [editingRecordId, setEditingRecordId] = useState(workingDraft.editingRecordId || '')
  const [notice, setNotice] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [history, setHistory] = useState<SavedAnnouncement[]>(loadHistory)
  const [scheduledAt, setScheduledAt] = useState(workingDraft.scheduledAt || '')

  useEffect(() => {
    localStorage.setItem(workingStorageKey, JSON.stringify({ title, eventDate, eventTime, targetGroup, details, contact, draft, editingRecordId, scheduledAt }))
  }, [title, eventDate, eventTime, targetGroup, details, contact, draft, editingRecordId, scheduledAt])

  function createDraft() {
    if (!can('church', 'create')) { setNotice('Your profile cannot create announcements.'); return }
    if (!title.trim() || !details.trim()) { setNotice('Add an announcement title and details first.'); return }
    const sections = ['📣 *CHURCH ANNOUNCEMENT*', `*${title.trim()}*`, eventDate ? `📅 ${displayDate(eventDate)}` : '', eventTime ? `🕒 ${eventTime}` : '', details.trim(), contact.trim() ? `For more information: ${contact.trim()}` : '', 'Please take note and share with the saints concerned.'].filter(Boolean)
    setDraft(sections.join('\n\n')); setNotice('Draft created. Please review it before sharing.')
  }
  function persist(next: SavedAnnouncement[]) { setHistory(next); localStorage.setItem(storageKey, JSON.stringify(next)) }
  async function refineWithAI() {
    if (!can('church', 'create')) { setNotice('Your profile cannot generate announcements.'); return }
    if (!title.trim() || !details.trim()) { setNotice('Add an announcement title and message first.'); return }
    setIsGenerating(true); setNotice('AIOS is refining the announcement for your review…')
    try {
      const response = await generateChurchText(`Rewrite the following church announcement as a concise, warm, respectful WhatsApp-ready message.

Title: ${title.trim()}
Date: ${eventDate ? displayDate(eventDate) : 'Not supplied'}
Time: ${eventTime || 'Not supplied'}
Message: ${details.trim()}
Contact: ${contact.trim() || 'Not supplied'}

Preserve every supplied name, date, time, phone number, instruction, and fact exactly. Do not invent a venue, contact, event detail, promise, or scripture. Use a short "CHURCH ANNOUNCEMENT" heading and restrained WhatsApp formatting. Produce only the final message and do not say that you are an AI.`)
      if (!response.text?.trim()) throw new Error('Empty response')
      setDraft(response.text.trim()); setNotice(`AI-refined draft created locally with ${response.model}. Please verify every detail before sharing.`)
    } catch { setNotice('Lampstand could not refine this announcement right now. You can still use Create WhatsApp draft.') }
    finally { setIsGenerating(false) }
  }
  function archiveDraft(posted = false, schedule = false) {
    if (!can('church', editingRecordId ? 'edit' : 'create')) { setNotice('Your profile cannot save announcements.'); return }
    if (!draft.trim()) return
    if (!targetGroup || !churchGroups.includes(targetGroup)) { setNotice('Choose a saved WhatsApp group before saving.'); return }
    const now = new Date().toISOString()
    const id = editingRecordId || crypto.randomUUID()
    persist([{ id, title: title || 'Church announcement', eventDate, eventTime, targetGroup: targetGroup.trim(), details, contact, content: draft.trim(), savedAt: now, postedAt: posted ? now : undefined, scheduledAt: schedule ? new Date(scheduledAt).toISOString() : undefined }, ...history.filter((item) => item.id !== id)])
    setEditingRecordId(id)
    setNotice(posted ? 'Announcement archived with its posting time.' : schedule ? 'Announcement scheduled. Lampstand Project will show a reminder when it is due.' : editingRecordId ? 'Saved announcement updated.' : 'Announcement saved locally as a draft.')
  }
  function saveDraft() { archiveDraft(false) }
  function scheduleDraft() { if (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now()) { setNotice('Choose a future date and time.'); return } archiveDraft(false, true) }
  function shareToWhatsApp() {
    if (!can('church', 'share')) { setNotice('Your profile cannot share announcements.'); return }
    if (!draft.trim()) return
    if (!targetGroup || !churchGroups.includes(targetGroup)) { setNotice('Choose a saved WhatsApp group before sharing.'); return }
    archiveDraft(true)
    window.open(`https://wa.me/?text=${encodeURIComponent(draft)}`, '_blank', 'noopener,noreferrer')
  }
  async function copyDraft() { if (!can('church', 'share')) { setNotice('Your profile cannot copy announcements for sharing.'); return } if (draft.trim()) { await navigator.clipboard.writeText(draft); setNotice('Announcement copied for WhatsApp.') } }
  function startNew() {
    if ((title || details || draft) && !window.confirm('Start a new announcement? Unsaved working text will be cleared.')) return
    setTitle(''); setEventDate(''); setEventTime(''); setDetails(''); setContact(''); setDraft(''); setEditingRecordId(''); setScheduledAt(''); setNotice('New announcement started.')
    localStorage.setItem(workingStorageKey, JSON.stringify({ title: '', eventDate: '', eventTime: '', targetGroup, details: '', contact: '', draft: '', editingRecordId: '' }))
  }

  function deleteAnnouncement(id: string) {
    if (!can('church', 'delete')) { setNotice('Your profile cannot delete saved announcements.'); return }
    if (!window.confirm('Delete this saved announcement? This cannot be undone unless you have a Church Records backup.')) return
    persist(history.filter((entry) => entry.id !== id))
    if (editingRecordId === id) setEditingRecordId('')
  }

  return <section className="church-page prayer-workspace">
    <Link className="church-back" to="/church"><ArrowLeft size={16} /> Church</Link>
    <header className="church-header"><span><Megaphone size={27} /></span><div><h1>Church Announcements</h1><p>Prepare and approve announcements before sharing them with the saints.</p></div><button className="church-start-new" type="button" onClick={startNew}><RotateCcw size={16} /> Start new</button></header>
    <div className="prayer-layout">
      <section className="prayer-panel prayer-input-panel">
        <div className="prayer-panel-title"><div><h2>Announcement details</h2><p>Only the title and message are required.</p></div></div>
        <label className="prayer-field">Title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Prayer meeting, conference, service arrangement…" /></label>
        <div className="announcement-field-row"><label className="prayer-field">Date<input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} /></label><label className="prayer-field">Time<input type="time" value={eventTime} onChange={(event) => setEventTime(event.target.value)} /></label></div>
        <label className="prayer-field">WhatsApp group for this post<select value={targetGroup} onChange={(event) => setTargetGroup(event.target.value)} disabled={churchGroups.length === 0}><option value="">{churchGroups.length ? 'Choose a saved group' : 'No WhatsApp groups added'}</option>{churchGroups.map((group) => <option key={group} value={group}>{group}</option>)}</select><span><Link to="/church/groups">Add or manage WhatsApp groups</Link></span></label>
        <label className="prayer-field">Message<textarea rows={8} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Enter the complete announcement…" /></label>
        <label className="prayer-field">Contact or coordinator (optional)<input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Name or phone number" /></label>
        <div className="prayer-generation-actions"><button className="prayer-primary-button" type="button" onClick={createDraft}><Sparkles size={17} /> Create WhatsApp draft</button><button className="prayer-ai-button" type="button" onClick={refineWithAI} disabled={isGenerating}>{isGenerating ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />} {isGenerating ? 'Refining…' : 'Refine with AI'}</button></div>
      </section>
      <section className="prayer-panel prayer-preview-panel">
        <div className="prayer-panel-title"><div><h2>Review before posting</h2><p>Edit the final announcement here.</p></div><span className="review-badge"><Check size={14} /> Approval required</span></div>
        <textarea className="prayer-draft" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Your formatted announcement will appear here." />
        <label className="prayer-field prayer-schedule-field">Posting reminder (optional)<input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>
        <div className="prayer-actions"><button type="button" onClick={saveDraft} disabled={!draft.trim()}><Save size={16} /> {editingRecordId ? 'Update' : 'Save'}</button><button type="button" onClick={copyDraft} disabled={!draft.trim()}><Clipboard size={16} /> Copy</button><button type="button" onClick={scheduleDraft} disabled={!draft.trim() || !scheduledAt}><Save size={16} /> Schedule reminder</button><button className="whatsapp-button" type="button" disabled={!draft.trim()} onClick={shareToWhatsApp}><MessageCircle size={16} /> Share to WhatsApp</button></div>
        {notice && <p className="prayer-notice" role="status">{notice}</p>}
      </section>
    </div>
    <section className="prayer-history"><div className="prayer-panel-title"><div><h2>Saved announcements</h2><p>Stored privately in this browser.</p></div></div>
      {history.length === 0 ? <div className="prayer-history-empty"><Megaphone size={22} /><p>Saved announcements will appear here.</p></div> : <div className="prayer-history-list">{history.map((item) => <article key={item.id}><button className="prayer-history-open" type="button" onClick={() => { setTitle(item.title); setEventDate(item.eventDate); setEventTime(item.eventTime || ''); setTargetGroup(item.targetGroup && churchGroups.includes(item.targetGroup) ? item.targetGroup : ''); setDetails(item.details || ''); setContact(item.contact || ''); setDraft(item.content); setEditingRecordId(item.id); setScheduledAt(item.scheduledAt ? item.scheduledAt.slice(0, 16) : ''); setNotice(item.targetGroup && !churchGroups.includes(item.targetGroup) ? 'This record used an old group. Choose a currently saved group before updating it.' : 'Editing saved announcement.'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}><strong>{item.title}</strong><span>{item.targetGroup ? `${item.targetGroup} · ` : ''}{item.postedAt ? `Posted ${new Date(item.postedAt).toLocaleString('en-IN')}` : item.scheduledAt ? `Scheduled ${new Date(item.scheduledAt).toLocaleString('en-IN')}` : `Draft saved ${new Date(item.savedAt).toLocaleString('en-IN')}`}</span></button><button className="prayer-delete" type="button" onClick={() => deleteAnnouncement(item.id)} aria-label="Delete announcement"><Trash2 size={16} /></button></article>)}</div>}
    </section>
  </section>
}
