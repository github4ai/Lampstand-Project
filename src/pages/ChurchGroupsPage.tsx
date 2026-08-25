import { useState } from 'react'
import { ArrowLeft, Check, MessageCircle, Pencil, Plus, Trash2, UsersRound, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { loadChurchGroupDefaults, loadSavedChurchGroups, saveChurchGroupDefaults, saveChurchGroups } from '../utils/churchGroups'
import '../styles/church.css'

const churchRecordKeys = ['aios-church-prayer-burdens-v1', 'aios-church-announcements-v1']

function loadGroupUsage() {
  const usage = new Map<string, number>()
  churchRecordKeys.forEach((key) => {
    try {
      const records: unknown = JSON.parse(localStorage.getItem(key) || '[]')
      if (!Array.isArray(records)) return
      records.forEach((record) => {
        if (!record || typeof record !== 'object') return
        const group = String((record as { targetGroup?: unknown }).targetGroup || '').trim()
        if (group) usage.set(group.toLowerCase(), (usage.get(group.toLowerCase()) || 0) + 1)
      })
    } catch { /* Ignore malformed local records. */ }
  })
  return usage
}

export default function ChurchGroupsPage() {
  const [groups, setGroups] = useState(loadSavedChurchGroups)
  const [name, setName] = useState('')
  const [notice, setNotice] = useState('')
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [groupUsage, setGroupUsage] = useState(loadGroupUsage)
  const [defaults, setDefaults] = useState(loadChurchGroupDefaults)

  function updateDefaults(next: typeof defaults, message = 'Default groups updated.') {
    setDefaults(next)
    saveChurchGroupDefaults(next)
    setNotice(message)
  }

  function addGroup() {
    const trimmed = name.trim()
    if (!trimmed) { setNotice('Enter a WhatsApp group name.'); return }
    if (groups.some((group) => group.toLowerCase() === trimmed.toLowerCase())) { setNotice('That group is already saved.'); return }
    const next = [...groups, trimmed].sort((a, b) => a.localeCompare(b))
    setGroups(next); saveChurchGroups(next); setName(''); setNotice('WhatsApp group saved.')
  }

  function removeGroup(group: string) {
    if (!window.confirm(`Remove “${group}” from reusable group suggestions? Existing Church records will not be changed.`)) return
    const next = groups.filter((item) => item !== group)
    setGroups(next); saveChurchGroups(next)
    const nextDefaults = { prayerPoints: defaults.prayerPoints === group ? '' : defaults.prayerPoints, announcements: defaults.announcements === group ? '' : defaults.announcements }
    updateDefaults(nextDefaults, 'Group removed from suggestions. Existing Church records were not changed.')
  }

  function beginEditing(group: string) {
    setEditingGroup(group)
    setEditingName(group)
    setNotice('')
  }

  function saveEditedGroup() {
    if (!editingGroup) return
    const trimmed = editingName.trim()
    if (!trimmed) { setNotice('Enter a WhatsApp group name.'); return }
    if (groups.some((group) => group !== editingGroup && group.toLowerCase() === trimmed.toLowerCase())) {
      setNotice('That group is already saved.')
      return
    }
    const next = groups.map((group) => group === editingGroup ? trimmed : group).sort((a, b) => a.localeCompare(b))
    setGroups(next)
    saveChurchGroups(next)
    if (trimmed !== editingGroup) {
      churchRecordKeys.forEach((key) => {
        try {
          const records: unknown = JSON.parse(localStorage.getItem(key) || '[]')
          if (!Array.isArray(records)) return
          localStorage.setItem(key, JSON.stringify(records.map((record) => {
            if (!record || typeof record !== 'object') return record
            return String((record as { targetGroup?: unknown }).targetGroup || '').trim() === editingGroup
              ? { ...record, targetGroup: trimmed }
              : record
          })))
        } catch { /* Leave malformed local records unchanged. */ }
      })
      setGroupUsage(loadGroupUsage())
    }
    if (defaults.prayerPoints === editingGroup || defaults.announcements === editingGroup) {
      updateDefaults({ prayerPoints: defaults.prayerPoints === editingGroup ? trimmed : defaults.prayerPoints, announcements: defaults.announcements === editingGroup ? trimmed : defaults.announcements }, 'Group, defaults, and matching Church records updated.')
    }
    setEditingGroup(null)
    setEditingName('')
    if (defaults.prayerPoints !== editingGroup && defaults.announcements !== editingGroup) setNotice('Group and matching Church records updated.')
  }

  return <section className="church-page church-groups-page">
    <Link className="church-back" to="/church"><ArrowLeft size={16} /> Church</Link>
    <header className="church-header"><span><UsersRound size={27} /></span><div><h1>WhatsApp Groups</h1><p>Maintain reusable group names for Prayer Points and Announcements.</p></div></header>
    <section className="church-groups-panel">
      <div className="church-groups-add"><label>Group name<input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addGroup() }} placeholder="For example: Sakinaka–Mumbai Prayer Group" /></label><button type="button" onClick={addGroup}><Plus size={16} /> Add group</button></div>
      <div className="church-group-defaults"><label>Default for Prayer Points<select value={defaults.prayerPoints} onChange={(event) => updateDefaults({ ...defaults, prayerPoints: event.target.value })}><option value="">No default group</option>{groups.map((group) => <option key={group} value={group}>{group}</option>)}</select></label><label>Default for Announcements<select value={defaults.announcements} onChange={(event) => updateDefaults({ ...defaults, announcements: event.target.value })}><option value="">No default group</option>{groups.map((group) => <option key={group} value={group}>{group}</option>)}</select></label></div>
      {notice && <p className="prayer-notice" role="status">{notice}</p>}
      {groups.length === 0 ? <div className="prayer-history-empty"><MessageCircle size={22} /><p>No reusable groups saved yet.</p></div> : <div className="church-groups-list">{groups.map((group) => { const usageCount = groupUsage.get(group.toLowerCase()) || 0; return <article key={group}>{editingGroup === group ? <div className="church-group-editor"><MessageCircle size={17} /><input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveEditedGroup(); if (event.key === 'Escape') setEditingGroup(null) }} aria-label={`Edit ${group}`} /></div> : <div className="church-group-name"><MessageCircle size={17} /><span><strong>{group}</strong><small>{usageCount === 0 ? 'Not used in saved records' : `Used in ${usageCount} saved ${usageCount === 1 ? 'record' : 'records'}`}</small></span></div>}<div className="church-group-actions">{editingGroup === group ? <><button className="save" type="button" onClick={saveEditedGroup} aria-label="Save group name"><Check size={16} /></button><button type="button" onClick={() => setEditingGroup(null)} aria-label="Cancel editing"><X size={16} /></button></> : <><button className="edit" type="button" onClick={() => beginEditing(group)} aria-label={`Edit ${group}`}><Pencil size={15} /></button><button type="button" onClick={() => removeGroup(group)} aria-label={`Remove ${group}`}><Trash2 size={16} /></button></>}</div></article> })}</div>}
      <p className="church-groups-help">Removing a suggestion never deletes Prayer Points, Announcements, or their posting history.</p>
    </section>
  </section>
}
