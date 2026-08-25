import { type ChangeEvent, useMemo, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Clipboard, Download, FileEdit, HeartHandshake, History, Megaphone, MessageCircle, RotateCcw, Search, Send, Trash2, Undo2, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { loadChurchGroupDefaults, loadSavedChurchGroups, saveChurchGroupDefaults, saveChurchGroups } from '../utils/churchGroups'
import '../styles/church.css'

const churchBackupTimeKey = 'aios-church-last-backup-v1'

type ArchiveItem = {
  id: string
  kind: 'Prayer Points' | 'Announcement'
  title: string
  content: string
  group?: string
  savedAt: string
  postedAt?: string
  scheduledAt?: string
  sourceDate?: string
  editPath: string
  received?: string
  additional?: string
  eventTime?: string
  details?: string
  contact?: string
}

function readList(key: string): Record<string, unknown>[] {
  try {
    const value = localStorage.getItem(key)
    const parsed = value ? JSON.parse(value) : []
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function loadArchive(): ArchiveItem[] {
  const prayers = readList('aios-church-prayer-burdens-v1').map((item) => ({
    id: String(item.id), kind: 'Prayer Points' as const,
    title: item.meetingDate ? `Prayer meeting · ${new Date(`${item.meetingDate}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Prayer Points',
    content: String(item.content || ''), group: item.targetGroup ? String(item.targetGroup) : undefined, savedAt: String(item.savedAt || ''),
    postedAt: item.postedAt ? String(item.postedAt) : undefined, scheduledAt: item.scheduledAt ? String(item.scheduledAt) : undefined, sourceDate: item.meetingDate ? String(item.meetingDate) : undefined, editPath: '/church/prayer-points',
    received: item.received ? String(item.received) : undefined, additional: item.additional ? String(item.additional) : undefined,
  }))
  const announcements = readList('aios-church-announcements-v1').map((item) => ({
    id: String(item.id), kind: 'Announcement' as const, title: String(item.title || 'Church announcement'),
    content: String(item.content || ''), group: item.targetGroup ? String(item.targetGroup) : undefined,
    savedAt: String(item.savedAt || ''), postedAt: item.postedAt ? String(item.postedAt) : undefined, scheduledAt: item.scheduledAt ? String(item.scheduledAt) : undefined,
    sourceDate: item.eventDate ? String(item.eventDate) : undefined, editPath: '/church/announcements',
    eventTime: item.eventTime ? String(item.eventTime) : undefined, details: item.details ? String(item.details) : undefined,
    contact: item.contact ? String(item.contact) : undefined,
  }))
  return [...prayers, ...announcements].sort((a, b) => Date.parse(b.postedAt || b.savedAt) - Date.parse(a.postedAt || a.savedAt))
}

export default function ChurchPostingHistoryPage() {
  const [items, setItems] = useState(loadArchive)
  const [query, setQuery] = useState('')
  const [type, setType] = useState('All')
  const [status, setStatus] = useState('All')
  const [group, setGroup] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState('Newest saved')
  const [copied, setCopied] = useState('')
  const [notice, setNotice] = useState('')
  const [lastBackupAt, setLastBackupAt] = useState(() => localStorage.getItem(churchBackupTimeKey) || '')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [savedGroups, setSavedGroups] = useState(loadSavedChurchGroups)
  const [repairGroup, setRepairGroup] = useState('')
  const restoreInput = useRef<HTMLInputElement>(null)
  const groups = useMemo(() => [...new Set(items.map((item) => item.group).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)), [items])
  const unavailableCount = useMemo(() => items.filter((item) => !item.group || !savedGroups.includes(item.group)).length, [items, savedGroups])
  const filtered = useMemo(() => items.filter((item) => {
    const matchesText = `${item.title} ${item.content} ${item.group || ''}`.toLowerCase().includes(query.toLowerCase())
    const recordDate = item.sourceDate || (item.savedAt ? item.savedAt.slice(0, 10) : '')
    const matchesDate = (!dateFrom || recordDate >= dateFrom) && (!dateTo || recordDate <= dateTo)
    return matchesText && matchesDate && (type === 'All' || item.kind === type)
      && (status === 'All' || (status === 'Posted' ? item.postedAt : status === 'Scheduled' ? !item.postedAt && item.scheduledAt : !item.postedAt && !item.scheduledAt))
      && (group === 'All' || item.group === group)
  }).sort((a, b) => {
    if (sort === 'Oldest saved') return Date.parse(a.postedAt || a.savedAt) - Date.parse(b.postedAt || b.savedAt)
    if (sort === 'Event date') return String(b.sourceDate || '').localeCompare(String(a.sourceDate || ''))
    if (sort === 'Title') return a.title.localeCompare(b.title)
    if (sort === 'WhatsApp group') return (a.group || '').localeCompare(b.group || '') || a.title.localeCompare(b.title)
    return Date.parse(b.postedAt || b.savedAt) - Date.parse(a.postedAt || a.savedAt)
  }), [items, query, type, status, group, dateFrom, dateTo, sort])

  function resetFilters() {
    setQuery(''); setType('All'); setStatus('All'); setGroup('All'); setDateFrom(''); setDateTo(''); setSort('Newest saved')
  }

  function toggleExpanded(item: ArchiveItem) {
    const key = `${item.kind}-${item.id}`
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  async function copy(item: ArchiveItem) {
    await navigator.clipboard.writeText(item.content); setCopied(item.id)
    window.setTimeout(() => setCopied(''), 1800)
  }

  function downloadMessage(item: ArchiveItem) {
    const date = item.sourceDate || (item.savedAt ? item.savedAt.slice(0, 10) : new Date().toISOString().slice(0, 10))
    const safeTitle = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'church-message'
    const metadata = [item.kind, item.group ? `Group: ${item.group}` : '', `${item.postedAt ? 'Posted' : 'Saved'}: ${new Date(item.postedAt || item.savedAt).toLocaleString('en-IN')}`].filter(Boolean).join('\n')
    const blob = new Blob([`${metadata}\n\n${item.content}\n`], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = `${date}-${safeTitle}.txt`; link.click()
    URL.revokeObjectURL(url); setNotice(`${item.kind} downloaded as a text file.`)
  }

  function prepareReuse(item: ArchiveItem) {
    if (item.kind === 'Prayer Points') {
      const key = 'aios-church-prayer-burden-working-v1'
      let current: Record<string, unknown> = {}
      try { current = JSON.parse(localStorage.getItem(key) || '{}') } catch { /* use a clean working draft */ }
      localStorage.setItem(key, JSON.stringify({ ...current, meetingDate: item.sourceDate, targetGroup: item.group || current.targetGroup || '', received: item.received || '', additional: item.additional || '', draft: item.content, editingRecordId: '' }))
    } else {
      const key = 'aios-church-announcement-working-v1'
      let current: Record<string, unknown> = {}
      try { current = JSON.parse(localStorage.getItem(key) || '{}') } catch { /* use a clean working draft */ }
      localStorage.setItem(key, JSON.stringify({ ...current, title: item.title, eventDate: item.sourceDate || '', eventTime: item.eventTime || '', targetGroup: item.group || '', details: item.details || '', contact: item.contact || '', draft: item.content, editingRecordId: '' }))
    }
  }

  function setPostingStatus(item: ArchiveItem, posted: boolean) {
    const key = item.kind === 'Prayer Points' ? 'aios-church-prayer-burdens-v1' : 'aios-church-announcements-v1'
    const records = readList(key).map((record) => {
      if (String(record.id) !== item.id) return record
      if (posted) { const next: Record<string, unknown> = { ...record, postedAt: new Date().toISOString() }; delete next.scheduledAt; return next }
      const draftRecord = { ...record }
      delete draftRecord.postedAt
      return draftRecord
    })
    localStorage.setItem(key, JSON.stringify(records))
    setItems(loadArchive()); setNotice(`${item.kind} marked as ${posted ? 'posted now' : 'a draft'}.`)
  }

  function shareRecord(item: ArchiveItem) {
    if (!item.group?.trim() || !loadSavedChurchGroups().includes(item.group)) { setNotice('Choose a currently saved WhatsApp group by opening this record in its editor before sharing.'); return }
    setPostingStatus(item, true)
    window.open(`https://wa.me/?text=${encodeURIComponent(item.content)}`, '_blank', 'noopener,noreferrer')
  }

  function deleteRecord(item: ArchiveItem) {
    if (!window.confirm(`Delete this ${item.kind.toLowerCase()} record? This cannot be undone unless you have a Church Records backup.`)) return
    const key = item.kind === 'Prayer Points' ? 'aios-church-prayer-burdens-v1' : 'aios-church-announcements-v1'
    localStorage.setItem(key, JSON.stringify(readList(key).filter((record) => String(record.id) !== item.id)))
    setItems(loadArchive()); setNotice(`${item.kind} record deleted.`)
  }

  function reassignUnavailableRecords() {
    if (!repairGroup || !savedGroups.includes(repairGroup)) { setNotice('Choose a saved WhatsApp group first.'); return }
    let updated = 0
    ;['aios-church-prayer-burdens-v1', 'aios-church-announcements-v1'].forEach((key) => {
      const records = readList(key).map((record) => {
        const currentGroup = String(record.targetGroup || '').trim()
        if (currentGroup && savedGroups.includes(currentGroup)) return record
        updated += 1
        return { ...record, targetGroup: repairGroup }
      })
      localStorage.setItem(key, JSON.stringify(records))
    })
    setItems(loadArchive())
    setNotice(`${updated} ${updated === 1 ? 'record was' : 'records were'} reassigned to ${repairGroup}.`)
  }

  function downloadBackup() {
    const backup = { format: 'aios-church-records', version: 4, exportedAt: new Date().toISOString(), prayerPoints: readList('aios-church-prayer-burdens-v1'), announcements: readList('aios-church-announcements-v1'), whatsappGroups: loadSavedChurchGroups(), whatsappGroupDefaults: loadChurchGroupDefaults() }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = `aios-church-records-${new Date().toISOString().slice(0, 10)}.json`; link.click()
    const backedUpAt = new Date().toISOString()
    URL.revokeObjectURL(url); localStorage.setItem(churchBackupTimeKey, backedUpAt); setLastBackupAt(backedUpAt); setNotice('Church records backup downloaded.')
  }

  function mergeRecords(current: Record<string, unknown>[], restored: Record<string, unknown>[]) {
    const records = new Map(current.map((item) => [String(item.id), item]))
    restored.forEach((item) => records.set(String(item.id), item))
    return [...records.values()]
  }

  async function restoreBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const backup = JSON.parse(await file.text()) as Record<string, unknown>
      const restoredPrayerPoints = Array.isArray(backup.prayerPoints) ? backup.prayerPoints : backup.prayerBurdens
      if (backup.format !== 'aios-church-records' || !Array.isArray(restoredPrayerPoints) || !Array.isArray(backup.announcements)) throw new Error('Invalid backup')
      const prayers = mergeRecords(readList('aios-church-prayer-burdens-v1'), restoredPrayerPoints as Record<string, unknown>[])
      const announcements = mergeRecords(readList('aios-church-announcements-v1'), backup.announcements as Record<string, unknown>[])
      localStorage.setItem('aios-church-prayer-burdens-v1', JSON.stringify(prayers))
      localStorage.setItem('aios-church-announcements-v1', JSON.stringify(announcements))
      if (Array.isArray(backup.whatsappGroups)) saveChurchGroups([...loadSavedChurchGroups(), ...backup.whatsappGroups.map(String)])
      const availableGroups = loadSavedChurchGroups()
      setSavedGroups(availableGroups)
      if (backup.whatsappGroupDefaults && typeof backup.whatsappGroupDefaults === 'object') {
        const restoredDefaults = backup.whatsappGroupDefaults as Record<string, unknown>
        const prayerPoints = String(restoredDefaults.prayerPoints || '')
        const announcementsDefault = String(restoredDefaults.announcements || '')
        saveChurchGroupDefaults({ prayerPoints: availableGroups.includes(prayerPoints) ? prayerPoints : '', announcements: availableGroups.includes(announcementsDefault) ? announcementsDefault : '' })
      }
      setItems(loadArchive()); setNotice(`Backup restored. ${prayers.length + announcements.length} records, ${availableGroups.length} reusable groups, and available default-group selections are ready.`)
    } catch { setNotice('This file is not a valid AIOS Church Records backup.') }
  }

  return <section className="church-page church-history-page">
    <Link className="church-back" to="/church"><ArrowLeft size={16} /> Church</Link>
    <header className="church-header"><span><History size={27} /></span><div><h1>Posting History</h1><p>Prayer points and announcements saved for future reference.</p></div></header>
    <div className="church-history-topline"><div><div className="church-history-summary"><strong>{items.length}</strong> saved records <span>·</span><strong>{items.filter((item) => item.postedAt).length}</strong> posted</div><p className={`church-backup-status ${lastBackupAt ? 'backed-up' : ''}`}>{lastBackupAt ? `Last backup: ${new Date(lastBackupAt).toLocaleString('en-IN')}` : items.length ? 'No Church Records backup downloaded yet.' : 'Download a backup after adding Church records.'}</p></div><div className="church-history-backup-actions"><button type="button" onClick={downloadBackup}><Download size={16} /> Download backup</button><button type="button" onClick={() => restoreInput.current?.click()}><Upload size={16} /> Restore backup</button><input ref={restoreInput} type="file" accept="application/json,.json" onChange={restoreBackup} hidden /></div></div>
    {notice && <p className="prayer-notice church-history-notice" role="status">{notice}</p>}
    {unavailableCount > 0 && <section className="church-group-repair"><div><strong>{unavailableCount} {unavailableCount === 1 ? 'record needs' : 'records need'} a valid WhatsApp group</strong><span>Choose one saved group to update all unavailable or missing group references.</span></div><select value={repairGroup} onChange={(event) => setRepairGroup(event.target.value)}><option value="">Choose saved group</option>{savedGroups.map((name) => <option key={name} value={name}>{name}</option>)}</select><button type="button" onClick={reassignUnavailableRecords} disabled={!repairGroup}>Reassign records</button></section>}
    <div className="church-history-filters">
      <label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search saved messages or groups…" /></label>
      <select value={type} onChange={(event) => setType(event.target.value)} aria-label="Filter by record type"><option>All</option><option>Prayer Points</option><option>Announcement</option></select>
      <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by posting status"><option>All</option><option>Posted</option><option>Scheduled</option><option>Draft</option></select>
      <select value={group} onChange={(event) => setGroup(event.target.value)} aria-label="Filter by WhatsApp group"><option>All</option>{groups.map((name) => <option key={name}>{name}</option>)}</select>
      <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} aria-label="Show records from date" title="From date" />
      <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} aria-label="Show records through date" title="To date" />
      <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort posting history"><option>Newest saved</option><option>Oldest saved</option><option>Event date</option><option>Title</option><option>WhatsApp group</option></select>
      <button className="church-history-reset" type="button" onClick={resetFilters}><RotateCcw size={14} /> Reset</button>
    </div>
    {filtered.length === 0 ? <div className="prayer-history-empty church-history-empty"><History size={24} /><p>No matching saved records.</p></div> : <div className="church-history-list">{filtered.map((item) => { const itemKey = `${item.kind}-${item.id}`; const isExpanded = expanded.has(itemKey); return <article key={itemKey}>
      <div className={`church-history-icon ${item.kind === 'Prayer Points' ? 'prayer' : 'announcement'}`}>{item.kind === 'Prayer Points' ? <HeartHandshake size={20} /> : <Megaphone size={20} />}</div>
      <div className="church-history-content"><div className="church-history-heading"><div><span>{item.kind}</span><h2>{item.title}</h2></div><span className={`posting-status ${item.postedAt ? 'posted' : item.scheduledAt ? 'scheduled' : 'draft'}`}>{item.postedAt ? <CheckCircle2 size={14} /> : <FileEdit size={14} />}{item.postedAt ? 'Posted' : item.scheduledAt ? 'Scheduled' : 'Draft'}</span></div>
        <p className={`church-history-message ${isExpanded ? 'expanded' : ''}`}>{item.content}</p>
        {item.content.length > 180 && <button className="church-history-expand" type="button" onClick={() => toggleExpanded(item)}>{isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}{isExpanded ? 'Collapse' : 'Show full message'}</button>}
        <div className="church-history-meta">{item.group && <span>Group: {item.group}{!loadSavedChurchGroups().includes(item.group) && <em className="church-group-unavailable"> · no longer available</em>}</span>}<span>{item.postedAt ? 'Posted' : item.scheduledAt ? 'Reminder' : 'Saved'} {new Date(item.postedAt || item.scheduledAt || item.savedAt).toLocaleString('en-IN')}</span></div>
        <div className="church-history-actions"><button type="button" onClick={() => copy(item)}><Clipboard size={15} /> {copied === item.id ? 'Copied' : 'Copy message'}</button><button type="button" onClick={() => downloadMessage(item)}><Download size={15} /> Download</button><button className="whatsapp-history-button" type="button" onClick={() => shareRecord(item)}><MessageCircle size={15} /> Share to WhatsApp</button>{item.postedAt ? <button type="button" onClick={() => setPostingStatus(item, false)}><Undo2 size={15} /> Mark as draft</button> : <button type="button" className="mark-posted-button" onClick={() => setPostingStatus(item, true)}><Send size={15} /> Mark posted now</button>}<Link to={item.editPath} onClick={() => prepareReuse(item)}>Use again</Link><button className="church-history-delete" type="button" onClick={() => deleteRecord(item)}><Trash2 size={15} /> Delete</button></div>
      </div>
    </article> })}</div>}
  </section>
}
