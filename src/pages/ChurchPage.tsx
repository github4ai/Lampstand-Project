import { HeartHandshake, History, Megaphone, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import BrandMark from '../components/BrandMark'
import { loadSavedChurchGroups } from '../utils/churchGroups'
import '../styles/church.css'
import '../styles/church-dashboard.css'

function readRecords(key: string) {
  try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value as Record<string, unknown>[] : [] } catch { return [] }
}

function hasWorkingText(key: string) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}') as Record<string, unknown>
    return ['received', 'additional', 'details', 'draft', 'title'].some((field) => String(value[field] || '').trim())
  } catch { return false }
}

function upcomingTuesday() {
  const date = new Date(); date.setDate(date.getDate() + ((2 - date.getDay() + 7) % 7))
  return date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
}

type RecentChurchItem = { id: string; kind: 'Prayer Points' | 'Announcement'; title: string; targetGroup: string; savedAt: string; postedAt: string }

export default function ChurchPage() {
  const prayers = readRecords('aios-church-prayer-burdens-v1')
  const announcements = readRecords('aios-church-announcements-v1')
  const totalRecords = prayers.length + announcements.length
  const scheduledRecords = [...prayers, ...announcements].filter((item) => !item.postedAt && item.scheduledAt).length
  const dueRecords = [...prayers, ...announcements].filter((item) => !item.postedAt && item.scheduledAt && Date.parse(String(item.scheduledAt)) <= Date.now()).length
  const savedGroups = loadSavedChurchGroups()
  const unresolvedGroups = [...prayers, ...announcements].filter((item) => !item.targetGroup || !savedGroups.includes(String(item.targetGroup))).length
  const prayerInProgress = hasWorkingText('aios-church-prayer-burden-working-v1')
  const announcementInProgress = hasWorkingText('aios-church-announcement-working-v1')
  const recentActivity: RecentChurchItem[] = [
    ...prayers.map((item): RecentChurchItem => ({ id: String(item.id || item.savedAt || item.meetingDate || 'prayer'), kind: 'Prayer Points', title: item.meetingDate ? `Prayer meeting · ${new Date(`${String(item.meetingDate)}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}` : 'Prayer Points', targetGroup: String(item.targetGroup || ''), savedAt: String(item.savedAt || ''), postedAt: String(item.postedAt || '') })),
    ...announcements.map((item): RecentChurchItem => ({ id: String(item.id || item.savedAt || item.title || 'announcement'), kind: 'Announcement', title: String(item.title || 'Church announcement'), targetGroup: String(item.targetGroup || ''), savedAt: String(item.savedAt || ''), postedAt: String(item.postedAt || '') })),
  ].sort((a, b) => Date.parse(b.postedAt || b.savedAt) - Date.parse(a.postedAt || a.savedAt)).slice(0, 4)

  return <section className="church-page">
    <header className="church-header"><span><BrandMark size={27} monochrome /></span><div><h1>Church</h1><p>Local tools for church prayer, fellowship, care, and service.</p></div></header>
    <section className="church-dashboard-summary">
      <div><span>Next prayer meeting</span><strong>{upcomingTuesday()}</strong></div>
      <div><span>Working drafts</span><strong>{Number(prayerInProgress) + Number(announcementInProgress)}</strong></div>
      <div><span>Saved records</span><strong>{totalRecords}</strong></div>
      <div className={dueRecords ? 'attention' : ''}><span>{dueRecords ? 'Posting reminders due' : 'Scheduled reminders'}</span><strong>{dueRecords || scheduledRecords}</strong></div>
      <div><span>WhatsApp groups</span><strong>{savedGroups.length}</strong></div>
      <div className={unresolvedGroups ? 'attention' : ''}><span>Need valid group</span><strong>{unresolvedGroups}</strong></div>
    </section>
    <div className="church-section-grid">
      <Link to="/church/prayer-points" className="church-section-card"><span><HeartHandshake size={25} /></span><div><h2>Prayer Points</h2><p>Record, organize, follow, and pray for current prayer points.</p>{prayerInProgress && <small>Draft in progress</small>}</div></Link>
      <Link to="/church/announcements" className="church-section-card"><span><Megaphone size={25} /></span><div><h2>Announcements</h2><p>Prepare, approve, and share church announcements.</p>{announcementInProgress && <small>Draft in progress</small>}</div></Link>
      <Link to="/church/posting-history" className="church-section-card"><span><History size={25} /></span><div><h2>Posting History</h2><p>Find past prayer points, announcements, drafts, and posted messages.</p>{unresolvedGroups > 0 && <small className="attention">{unresolvedGroups} {unresolvedGroups === 1 ? 'record needs' : 'records need'} a group</small>}</div></Link>
      <Link to="/church/groups" className="church-section-card"><span><UsersRound size={25} /></span><div><h2>WhatsApp Groups</h2><p>Manage reusable group names for Church posts.</p><small>{savedGroups.length} saved {savedGroups.length === 1 ? 'group' : 'groups'}</small></div></Link>
    </div>
    <section className="church-recent-activity">
      <header><div><History size={18} /><h2>Recent Church Activity</h2></div><Link to="/church/posting-history">View all</Link></header>
      {recentActivity.length === 0 ? <p className="church-recent-empty">Saved Prayer Points and Announcements will appear here.</p> : <div className="church-recent-list">{recentActivity.map((item) => <Link to="/church/posting-history" key={`${item.kind}-${String(item.id)}`}>
        <span className={item.kind === 'Prayer Points' ? 'prayer' : 'announcement'}>{item.kind === 'Prayer Points' ? <HeartHandshake size={17} /> : <Megaphone size={17} />}</span>
        <div><strong>{String(item.title)}</strong><small>{item.kind}{item.targetGroup ? ` · ${String(item.targetGroup)}` : ''}</small></div>
        <time>{item.postedAt ? 'Posted' : 'Saved'} {new Date(String(item.postedAt || item.savedAt)).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</time>
      </Link>)}</div>}
    </section>
  </section>
}
