import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, BookOpen, BookOpenCheck, Brain, CalendarDays, CheckCircle2, Download, FileText, GraduationCap, Highlighter, ListChecks, MessageSquareText, Plus, Printer, Search, Star, Upload } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { getKnowledgeCategory, getKnowledgeSources, type KnowledgeCategory, type KnowledgeDocument, type KnowledgeSourceFile } from '../services/knowledge'
import { getKnowledgeOutline } from '../api/knowledgeViewer'
import type { KnowledgeOutlineSection } from '../types/knowledgeViewer'
import PresentOnDisplay from '../components/PresentOnDisplay'
import '../styles/school.css'
import '../styles/school-activities.css'

const KEYS = {
  progress: 'aios-school-learning-progress-v1', notes: 'aios-school-notes-v1', bookmarks: 'aios-school-bookmarks-v1',
  assessments: 'aios-school-assessments-v1', plans: 'aios-school-study-plans-v1', profile: 'aios-school-profile-v1',
} as const
const schoolBackupKeys = Object.values(KEYS)
type View = 'dashboard' | 'read' | 'library' | 'quiz' | 'flashcards' | 'revision' | 'notes' | 'planner' | 'results'
type ProgressEntry = { openedAt?: string; completed?: boolean; percent?: number; minutes?: number }
type SchoolProgress = Record<string, ProgressEntry>
type SchoolNote = { id: string; document: string; excerpt: string; note: string; color: string; createdAt: string }
type Assessment = { id: string; title: string; subject: string; document: string; score: number; total: number; date: string; type: 'Quiz' | 'Assignment' | 'Exercise' }
type StudyPlan = { id: string; title: string; subject: string; document: string; dueDate: string; done: boolean }
type Profile = { level: string; learner: string }
type QuizQuestion = { question: string; choices: string[]; answer: number; explanation: string }

const FULL_QUIZ_BANK: Record<string, QuizQuestion[]> = {
  English: [
    { question: 'Which word is a noun?', choices: ['quickly', 'school', 'bright', 'write'], answer: 1, explanation: '“School” names a place, so it is a noun.' },
    { question: 'Choose the correct past tense of “go”.', choices: ['goed', 'gone', 'went', 'going'], answer: 2, explanation: '“Went” is the simple past tense of “go”.' },
    { question: 'Which sentence is punctuated correctly?', choices: ['Where are you going.', 'Where are you going?', 'where are you going?', 'Where are you going!'], answer: 1, explanation: 'A direct question begins with a capital letter and ends with a question mark.' },
    { question: 'Which word is an adjective?', choices: ['beautiful', 'slowly', 'school', 'write'], answer: 0, explanation: '“Beautiful” describes a noun, so it is an adjective.' },
    { question: 'Choose the correct plural of “child”.', choices: ['childs', 'childes', 'children', 'childrens'], answer: 2, explanation: '“Children” is the irregular plural of “child”.' },
    { question: 'Which word means the opposite of “ancient”?', choices: ['old', 'modern', 'historic', 'past'], answer: 1, explanation: '“Modern” is the opposite of “ancient”.' },
  ],
  Science: [
    { question: 'Which process allows green plants to make food?', choices: ['Respiration', 'Photosynthesis', 'Digestion', 'Evaporation'], answer: 1, explanation: 'Plants use sunlight, water, and carbon dioxide during photosynthesis.' },
    { question: 'Which material is a good conductor of electricity?', choices: ['Rubber', 'Plastic', 'Copper', 'Wood'], answer: 2, explanation: 'Copper conducts electricity well and is commonly used in wires.' },
    { question: 'What causes day and night?', choices: ['Earth’s rotation', 'Earth’s revolution', 'The Moon’s rotation', 'Cloud movement'], answer: 0, explanation: 'Day and night result from Earth rotating on its axis.' },
    { question: 'Which organ pumps blood around the body?', choices: ['Lungs', 'Brain', 'Heart', 'Stomach'], answer: 2, explanation: 'The heart pumps blood through the circulatory system.' },
    { question: 'Water changes into vapour by which process?', choices: ['Freezing', 'Melting', 'Condensation', 'Evaporation'], answer: 3, explanation: 'Evaporation changes liquid water into water vapour.' },
    { question: 'Which force pulls objects toward Earth?', choices: ['Magnetism', 'Gravity', 'Friction', 'Electricity'], answer: 1, explanation: 'Gravity attracts objects toward Earth.' },
  ],
  Mathematics: [
    { question: 'What is 3/4 of 20?', choices: ['5', '10', '15', '18'], answer: 2, explanation: '20 ÷ 4 = 5, and 5 × 3 = 15.' },
    { question: 'Which number is a factor of 36?', choices: ['5', '7', '9', '11'], answer: 2, explanation: '36 ÷ 9 = 4, so 9 is a factor.' },
    { question: 'What is the perimeter of a square with side 6 cm?', choices: ['12 cm', '24 cm', '30 cm', '36 cm'], answer: 1, explanation: 'A square has four equal sides: 4 × 6 = 24 cm.' },
    { question: 'What is 25% of 80?', choices: ['10', '20', '25', '40'], answer: 1, explanation: '25% is one quarter, and one quarter of 80 is 20.' },
    { question: 'What is 7 × 8?', choices: ['48', '54', '56', '64'], answer: 2, explanation: 'Seven groups of eight equal 56.' },
    { question: 'Which fraction equals one half?', choices: ['2/3', '3/6', '4/5', '5/8'], answer: 1, explanation: '3/6 simplifies to 1/2.' },
  ],
  'Computer Skills': [
    { question: 'Which program is mainly used to create text documents?', choices: ['Word processor', 'Calculator', 'Media player', 'Paint program'], answer: 0, explanation: 'A word processor is designed to create, edit, and format text documents.' },
    { question: 'What does a strong password help protect?', choices: ['Screen brightness', 'Personal information', 'Printer paper', 'Speaker volume'], answer: 1, explanation: 'Strong passwords help prevent unauthorized access to accounts and information.' },
    { question: 'Which device is used to point and select items?', choices: ['Keyboard', 'Printer', 'Mouse', 'Speaker'], answer: 2, explanation: 'A mouse controls the pointer and selects on-screen items.' },
    { question: 'Which key starts a new line?', choices: ['Shift', 'Enter', 'Escape', 'Tab'], answer: 1, explanation: 'The Enter key starts a new line or confirms an action.' },
    { question: 'What is a folder used for?', choices: ['Organizing files', 'Playing sound', 'Printing only', 'Turning off the screen'], answer: 0, explanation: 'Folders organize files and other folders.' },
    { question: 'Which application is used for slide presentations?', choices: ['PowerPoint', 'Notepad', 'Calculator', 'Paint'], answer: 0, explanation: 'PowerPoint is designed for slide presentations.' },
  ],
  'Social Science': [
    { question: 'Which level of government is closest to a local community?', choices: ['Local government', 'National government', 'International organization', 'Parliament only'], answer: 0, explanation: 'Local government manages many services within towns, cities, and villages.' },
    { question: 'A map key is used to explain what?', choices: ['Weather only', 'Distances only', 'Map symbols', 'Page numbers'], answer: 2, explanation: 'The key or legend explains the symbols used on a map.' },
    { question: 'Which is a renewable resource?', choices: ['Coal', 'Petroleum', 'Sunlight', 'Natural gas'], answer: 2, explanation: 'Sunlight is naturally replenished and is renewable.' },
    { question: 'Which direction is opposite to east?', choices: ['North', 'South', 'West', 'North-east'], answer: 2, explanation: 'West is opposite to east.' },
    { question: 'What does a timeline show?', choices: ['Events in date order', 'Only map symbols', 'Weather forecasts', 'Building plans'], answer: 0, explanation: 'A timeline arranges events in chronological order.' },
    { question: 'Which body makes laws for a country?', choices: ['Library', 'Legislature', 'Hospital', 'Market'], answer: 1, explanation: 'The legislature debates and makes laws.' },
  ],
  'Cutting and Tailoring': [
    { question: 'What should be done before cutting fabric?', choices: ['Stitch the hem', 'Take accurate measurements', 'Attach buttons', 'Iron the finished garment'], answer: 1, explanation: 'Accurate measurements are required before marking and cutting fabric.' },
    { question: 'Which tool is used to remove unwanted stitches?', choices: ['Seam ripper', 'Thimble', 'Tape measure', 'Tailor’s chalk'], answer: 0, explanation: 'A seam ripper safely cuts and removes stitches.' },
    { question: 'Why is seam allowance added?', choices: ['For decoration only', 'To provide fabric for joining pieces', 'To shorten the pattern', 'To change fabric colour'], answer: 1, explanation: 'Seam allowance provides the fabric needed to stitch pieces together.' },
    { question: 'Which tool marks fabric without permanent ink?', choices: ['Tailor’s chalk', 'Seam ripper', 'Thimble', 'Button'], answer: 0, explanation: 'Tailor’s chalk makes removable construction marks.' },
    { question: 'What protects a finger while hand sewing?', choices: ['Bodkin', 'Thimble', 'Ruler', 'Bobbin'], answer: 1, explanation: 'A thimble protects the finger when pushing a needle.' },
    { question: 'Why should fabric grain be checked before cutting?', choices: ['For correct drape and fit', 'To change its colour', 'To sharpen scissors', 'To count buttons'], answer: 0, explanation: 'Correct grain helps a garment hang and fit properly.' },
  ],
}

function randomQuestions(subject: string) {
  const source = FULL_QUIZ_BANK[subject] ?? FULL_QUIZ_BANK.English
  const prefixes = ['', 'Review: ', 'From the selected lesson: ', 'Choose carefully: ']
  const questions = source.flatMap((item) => prefixes.map((prefix) => {
    const choices = item.choices.map((choice, index) => ({ choice, correct: index === item.answer }))
    for (let index = choices.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1)); [choices[index], choices[swap]] = [choices[swap], choices[index]]
    }
    return {
      question: `${prefix}${prefix ? item.question.charAt(0).toLowerCase() + item.question.slice(1) : item.question}`,
      choices: choices.map((entry) => entry.choice),
      answer: choices.findIndex((entry) => entry.correct),
      explanation: item.explanation,
    }
  }))
  for (let index = questions.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1)); [questions[index], questions[swap]] = [questions[swap], questions[index]]
  }
  return questions.slice(0, Math.min(10, questions.length))
}
function normalizeSubject(value = '') {
  const text = value.toLowerCase().replace(/[^a-z]+/g, ' ').trim()
  if (/tailor|sew|garment|fabric|cutting/.test(text)) return 'Cutting and Tailoring'
  if (/social|history|geograph|civic/.test(text)) return 'Social Science'
  if (/computer|information technology|ict/.test(text)) return 'Computer Skills'
  if (/math/.test(text)) return 'Mathematics'
  if (/science/.test(text)) return 'Science'
  if (/english/.test(text)) return 'English'
  return value || 'General'
}

function readJson<T>(key: string, fallback: T): T { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback } catch { return fallback } }
function writeJson(key: string, value: unknown) { localStorage.setItem(key, JSON.stringify(value)) }
function cleanName(name: string) { return name.replace(/\.[^.]+$/, '').replaceAll('_', ' ') }
function inferSubject(name: string) {
  const value = name.toLowerCase()
  if (value.includes('math')) return 'Mathematics'
  if (value.includes('social')) return 'Social Science'
  if (value.includes('science')) return 'Science'
  if (value.includes('english')) return 'English'
  if (value.includes('computer')) return 'Computer Skills'
  if (/sew|garment|tailor|fabric|stitch|bodice|dress|pattern|cutting/.test(value)) return 'Cutting and Tailoring'
  return 'General'
}

function categoryFromSources(files: KnowledgeSourceFile[]): KnowledgeCategory {
  const documents: KnowledgeDocument[] = files.map((file) => ({
    id: file.relativePath,
    name: file.name,
    stem: file.name.replace(/\.[^.]+$/, ''),
    category: 'School',
    chunks: null,
    embeddings: null,
    chunk_file: null,
    embedding_file: null,
    faiss_files: [],
    indexed: true,
    modified_at: file.modifiedAt,
  }))
  return { name: 'School', document_count: documents.length, indexed_document_count: documents.length, chunk_count: 0, embedding_count: 0, faiss_index_count: 0, metadata_file_count: 0, modified_at: null, documents, faiss_files: [], metadata_files: [] }
}

export default function SchoolPage() {
  const navigate = useNavigate()
  const [library, setLibrary] = useState<KnowledgeCategory | null>(null)
  const [sources, setSources] = useState<KnowledgeSourceFile[]>([])
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState('')
  const [view, setView] = useState<View>('dashboard'); const [query, setQuery] = useState(''); const [subject, setSubject] = useState('All subjects')
  const [progress, setProgress] = useState<SchoolProgress>(() => readJson(KEYS.progress, {}))
  const [notes] = useState<SchoolNote[]>(() => readJson(KEYS.notes, []))
  const [bookmarks, setBookmarks] = useState<string[]>(() => readJson(KEYS.bookmarks, []))
  const [assessments, setAssessments] = useState<Assessment[]>(() => readJson(KEYS.assessments, []))
  const [plans, setPlans] = useState<StudyPlan[]>(() => readJson(KEYS.plans, []))
  const [profile, setProfile] = useState<Profile>(() => ({ ...readJson(KEYS.profile, { level: 'Level C', learner: 'Learner' }), level: 'Level C' }))
  const [quizSubject, setQuizSubject] = useState('English')
  const [quizDocument, setQuizDocument] = useState('')
  const [quizChapters, setQuizChapters] = useState<string[]>([])
  const [quizOutline, setQuizOutline] = useState<KnowledgeOutlineSection[]>([])
  const [quizStarted, setQuizStarted] = useState(false)
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [flashcardsStarted, setFlashcardsStarted] = useState(false)
  const [flashcardIndex, setFlashcardIndex] = useState(0)
  const [flashcardFlipped, setFlashcardFlipped] = useState(false)
  const [knownFlashcards, setKnownFlashcards] = useState<number[]>([])
  const [revisionStarted, setRevisionStarted] = useState(false)
  const [generatedQuestions, setGeneratedQuestions] = useState<QuizQuestion[]>([])
  const [noteOptions, setNoteOptions] = useState(['10-point summary', 'Key ideas', 'Vocabulary'])
  const [readingSubject, setReadingSubject] = useState('')
  const [readingDocument, setReadingDocument] = useState('')
  const [readingSection, setReadingSection] = useState('')
  const [readingOutline, setReadingOutline] = useState<KnowledgeOutlineSection[]>([])
  const [outlineLoading, setOutlineLoading] = useState(false)
  const [assessmentForm, setAssessmentForm] = useState({ title: '', subject: 'General', document: '', score: '0', total: '10', type: 'Quiz' as Assessment['type'] })
  const [planForm, setPlanForm] = useState({ title: '', subject: 'General', document: '', dueDate: new Date().toISOString().slice(0, 10) })
  const restoreInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('')
    Promise.allSettled([getKnowledgeCategory('School', controller.signal), getKnowledgeSources()]).then(([categoryResult, sourcesResult]) => {
      if (controller.signal.aborted) return
      const schoolSources = sourcesResult.status === 'fulfilled' ? sourcesResult.value.filter((file) => file.category === 'School') : []
      setSources(schoolSources)
      if (categoryResult.status === 'fulfilled') setLibrary(categoryResult.value)
      else if (schoolSources.length > 0) setLibrary(categoryFromSources(schoolSources))
      else setError(categoryResult.reason instanceof Error ? categoryResult.reason.message : 'Unable to load the School library.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])

  const metadata = useMemo(() => new Map((library?.documents ?? []).map((document) => {
    const source = sources.find((item) => item.name === document.name)
    const parts = (source?.subcollection ?? '').split(' / ').filter(Boolean)
    return [document.name, { level: 'Level C', subject: normalizeSubject(parts[1] || inferSubject(document.name)) }]
  })), [library, sources])
  const subjects = useMemo(() => ['All subjects', ...new Set([...metadata.values()].map((item) => item.subject))], [metadata])
  const documents = useMemo(() => (library?.documents ?? []).filter((document) => {
    const item = metadata.get(document.name); const term = query.trim().toLowerCase()
    return (subject === 'All subjects' || item?.subject === subject) && (!term || `${document.name} ${item?.subject} ${item?.level}`.toLowerCase().includes(term))
  }), [library, metadata, query, subject])
  const quizDocuments = useMemo(() => (library?.documents ?? []).filter((document) => {
    const documentSubject = metadata.get(document.name)?.subject
    return normalizeSubject(documentSubject) === normalizeSubject(quizSubject)
  }), [library, metadata, quizSubject])
  const readingSubjects = useMemo(() => subjects.filter((item) => item !== 'All subjects'), [subjects])
  const readingDocuments = useMemo(() => (library?.documents ?? []).filter((document) => normalizeSubject(metadata.get(document.name)?.subject) === normalizeSubject(readingSubject)), [library, metadata, readingSubject])
  const QUIZ_BANK = FULL_QUIZ_BANK
  const activityQuestions = generatedQuestions.length ? generatedQuestions : (QUIZ_BANK[quizSubject] ?? QUIZ_BANK.English)
  const recent = useMemo(() => Object.entries(progress).filter(([, item]) => item.openedAt).sort(([, a], [, b]) => (b.openedAt ?? '').localeCompare(a.openedAt ?? '')).slice(0, 4), [progress])
  const completed = Object.values(progress).filter((item) => item.completed).length
  const average = assessments.length ? Math.round(assessments.reduce((sum, item) => sum + item.score / Math.max(item.total, 1) * 100, 0) / assessments.length) : 0
  const planned = plans.filter((item) => !item.done).sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  useEffect(() => {
    const document = readingDocuments.find((item) => item.name === readingDocument)
    if (!document) { setReadingOutline([]); setReadingSection(''); return }
    const controller = new AbortController(); setOutlineLoading(true)
    getKnowledgeOutline(document.category, document.stem, controller.signal).then((result) => {
      setReadingOutline(result.sections)
      setReadingSection((current) => result.sections.some((item) => item.id === current) ? current : result.sections[0]?.id ?? '')
    }).catch(() => { setReadingOutline([]); setReadingSection('') }).finally(() => setOutlineLoading(false))
    return () => controller.abort()
  }, [readingDocument, readingDocuments])

  useEffect(() => {
    const document = quizDocuments.find((item) => item.name === quizDocument)
    if (!document) { setQuizOutline([]); setQuizChapters([]); return }
    const controller = new AbortController()
    getKnowledgeOutline(document.category, document.stem, controller.signal).then((result) => {
      setQuizOutline(result.sections); setQuizChapters([])
    }).catch(() => { setQuizOutline([]); setQuizChapters([]) })
    return () => controller.abort()
  }, [quizDocument, quizDocuments])

  function updateProfile(next: Profile) { setProfile(next); writeJson(KEYS.profile, next) }
  function openReader() {
    const nextSubject = subject !== 'All subjects' && readingSubjects.includes(subject) ? subject : readingSubject || readingSubjects[0] || ''
    setReadingSubject(nextSubject)
    const available = (library?.documents ?? []).filter((document) => normalizeSubject(metadata.get(document.name)?.subject) === normalizeSubject(nextSubject))
    setReadingDocument((current) => available.some((item) => item.name === current) ? current : available[0]?.name ?? '')
    setView('read')
  }
  function readSelectedLesson() {
    const document = readingDocuments.find((item) => item.name === readingDocument)
    const section = readingOutline.find((item) => item.id === readingSection)
    if (!document || !section) return
    const source = sources.find((item) => item.category === document.category && item.name === document.name)
    updateProgress(document.name, { openedAt: new Date().toISOString() })
    if (source) {
      const params = new URLSearchParams({ path: source.relativePath, title: cleanName(document.name), section: section.label })
      if (section.page) params.set('page', String(section.page))
      navigate(`/school/read?${params.toString()}`)
      return
    }
    navigate(`/knowledge/view/${encodeURIComponent(document.category)}/${encodeURIComponent(document.stem)}/${section.chunk_id}?from=school`)
  }
  function openQuiz() { const selected = subject !== 'All subjects' && QUIZ_BANK[subject] ? subject : 'English'; const first = (library?.documents ?? []).find((document) => normalizeSubject(metadata.get(document.name)?.subject) === selected); setQuizSubject(selected); setQuizDocument(first?.name ?? ''); setQuizChapters([]); setGeneratedQuestions(randomQuestions(selected)); setQuizStarted(false); setQuizAnswers({}); setQuizSubmitted(false); setView('quiz') }
  function openFlashcards() { const selected = subject !== 'All subjects' && QUIZ_BANK[subject] ? subject : 'English'; const first = (library?.documents ?? []).find((document) => normalizeSubject(metadata.get(document.name)?.subject) === selected); setQuizSubject(selected); setQuizDocument(first?.name ?? ''); setQuizChapters([]); setGeneratedQuestions(randomQuestions(selected)); setFlashcardsStarted(false); setFlashcardIndex(0); setFlashcardFlipped(false); setKnownFlashcards([]); setView('flashcards') }
  function openRevision() { const selected = subject !== 'All subjects' && QUIZ_BANK[subject] ? subject : 'English'; const first = (library?.documents ?? []).find((document) => normalizeSubject(metadata.get(document.name)?.subject) === normalizeSubject(selected)); setQuizSubject(selected); setQuizDocument(first?.name ?? ''); setQuizChapters([]); setGeneratedQuestions(randomQuestions(selected)); setRevisionStarted(false); setView('revision') }
  function openNotes() { if (!quizDocument) { const selected = subject !== 'All subjects' && QUIZ_BANK[subject] ? subject : 'English'; const first = (library?.documents ?? []).find((document) => normalizeSubject(metadata.get(document.name)?.subject) === normalizeSubject(selected)); setQuizSubject(selected); setQuizDocument(first?.name ?? '') } setView('notes') }
  function submitQuiz() {
    const questions = activityQuestions
    const score = questions.reduce((sum, item, index) => sum + (quizAnswers[index] === item.answer ? 1 : 0), 0)
    const labels = quizChapters.map((id) => quizOutline.find((item) => item.id === id)?.label ?? id)
    const chapterLabel = labels.length === 1 ? labels[0] : `${labels.length} lessons/chapters`
    const result: Assessment = { id: crypto.randomUUID(), title: `${quizSubject}: ${chapterLabel}`, subject: quizSubject, document: `${quizDocument} | ${labels.join(' | ')}`, score, total: questions.length, date: new Date().toISOString(), type: 'Quiz' }
    const next = [result, ...assessments]; setAssessments(next); writeJson(KEYS.assessments, next); setQuizSubmitted(true); setNotice(`Quiz completed: ${score} of ${questions.length}. The score was saved in Results.`)
  }
  function updateProgress(name: string, update: Partial<ProgressEntry>) { const next = { ...progress, [name]: { ...progress[name], ...update } }; setProgress(next); writeJson(KEYS.progress, next) }
  function openDocument(document: KnowledgeDocument) { updateProgress(document.name, { openedAt: new Date().toISOString() }); navigate(`/documents/${encodeURIComponent(document.category)}/${encodeURIComponent(document.name)}?from=school`) }
  function toggleComplete(name: string) { updateProgress(name, { completed: !progress[name]?.completed, percent: progress[name]?.completed ? Math.min(progress[name]?.percent ?? 0, 99) : 100 }) }
  function toggleBookmark(name: string) { const next = bookmarks.includes(name) ? bookmarks.filter((item) => item !== name) : [name, ...bookmarks]; setBookmarks(next); writeJson(KEYS.bookmarks, next) }
  function askSchool(prompt: string) { localStorage.setItem('aios-studio-chat-handoff-v1', JSON.stringify({ question: `${prompt}\nLearner: ${profile.learner}; Level: ${profile.level}; Subject: ${subject}.`, agentId: 'school' })); navigate('/') }
  function addAssessment(event: React.FormEvent) { event.preventDefault(); const total = Math.max(1, Number(assessmentForm.total)); const score = Math.min(total, Math.max(0, Number(assessmentForm.score))); const next = [{ ...assessmentForm, id: crypto.randomUUID(), score, total, date: new Date().toISOString() }, ...assessments]; setAssessments(next); writeJson(KEYS.assessments, next); setAssessmentForm((current) => ({ ...current, title: '', score: '0' })); setNotice('Result saved.') }
  function addPlan(event: React.FormEvent) { event.preventDefault(); if (!planForm.title.trim()) return; const next = [...plans, { ...planForm, id: crypto.randomUUID(), done: false }]; setPlans(next); writeJson(KEYS.plans, next); setPlanForm((current) => ({ ...current, title: '' })); setNotice('Study task added.') }
  function togglePlan(id: string) { const next = plans.map((item) => item.id === id ? { ...item, done: !item.done } : item); setPlans(next); writeJson(KEYS.plans, next) }
  function downloadReport(extension: 'html' | 'doc') {
    const rows = assessments.map((item) => `<tr><td>${item.title}</td><td>${item.subject}</td><td>${item.type}</td><td>${item.score}/${item.total}</td><td>${new Date(item.date).toLocaleDateString()}</td></tr>`).join('')
    const body = `<!doctype html><html><head><meta charset="utf-8"><title>School progress</title><style>body{font:16px Arial;max-width:900px;margin:40px auto;color:#172033}h1{color:#075985}table{border-collapse:collapse;width:100%}th,td{border:1px solid #94a3b8;padding:8px;text-align:left}</style></head><body><h1>${profile.learner} — ${profile.level}</h1><p>Generated ${new Date().toLocaleString()}</p><p><b>${completed}</b> completed documents · <b>${average}%</b> assessment average · <b>${notes.length}</b> study notes</p><h2>Results</h2><table><thead><tr><th>Activity</th><th>Subject</th><th>Type</th><th>Score</th><th>Date</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No results recorded</td></tr>'}</tbody></table></body></html>`
    const blob = new Blob([body], { type: extension === 'doc' ? 'application/msword' : 'text/html' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `school-progress-${new Date().toISOString().slice(0, 10)}.${extension}`; anchor.click(); URL.revokeObjectURL(url)
  }
  function downloadBackup() { const data: Record<string, string | null> = {}; schoolBackupKeys.forEach((key) => { data[key] = localStorage.getItem(key) }); const blob = new Blob([JSON.stringify({ format: 'aios-school-progress', version: 2, exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `aios-school-progress-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url); setNotice('School progress backed up.') }
  async function restoreBackup(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; try { const backup = JSON.parse(await file.text()) as { format?: string; data?: Record<string, unknown> }; if (backup.format !== 'aios-school-progress' || !backup.data) throw new Error(); schoolBackupKeys.forEach((key) => { const value = backup.data?.[key]; if (typeof value === 'string') localStorage.setItem(key, value) }); window.location.reload() } catch { setNotice('This is not a valid AIOS School progress backup.') } }

  return <section className="school-page">
    <header className="school-header"><span><GraduationCap size={28} /></span><div><h1>School</h1><p>Structured Level C learning, practice, and progress grounded in your School library.</p></div><div><button type="button" onClick={downloadBackup}><Download size={15} /> Backup</button><button type="button" onClick={() => restoreInput.current?.click()}><Upload size={15} /> Restore</button><input ref={restoreInput} hidden type="file" accept=".json,application/json" onChange={restoreBackup} /></div></header>
    {notice && <p className="school-notice" role="status">{notice}</p>}
    {view === 'notes' && <section className="school-card school-notes-builder">
      <header><div><h2><FileText size={19} /> Create lesson notes</h2><p>Choose the sections you need, then create notes from your selected Level C lesson or chapter.</p></div></header>
      <section className="school-notes-source"><label>Subject<select value={quizSubject} onChange={(event) => { const next = event.target.value; const first = (library?.documents ?? []).find((document) => normalizeSubject(metadata.get(document.name)?.subject) === normalizeSubject(next)); setQuizSubject(next); setQuizDocument(first?.name ?? ''); setQuizChapters([]) }}>{Object.keys(QUIZ_BANK).map((item) => <option key={item}>{item}</option>)}</select></label><label>Book / material<select value={quizDocument} onChange={(event) => { setQuizDocument(event.target.value); setQuizChapters([]) }}><option value="">Choose material</option>{quizDocuments.map((document) => <option key={document.id} value={document.name}>{cleanName(document.name)}</option>)}</select></label></section>
      <div className="school-notes-lessons">{quizOutline.length ? quizOutline.map((item) => <label key={item.id}><input type="checkbox" checked={quizChapters.includes(item.id)} onChange={() => setQuizChapters((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} /> {item.label}</label>) : <p>Choose a material to see its lessons or chapters.</p>}</div>
      <div className="school-note-options">{['10-point summary', 'Summary', 'Key ideas', 'Vocabulary', 'Important facts', 'Questions to review', 'My own notes'].map((option) => <label key={option}><input type="checkbox" checked={noteOptions.includes(option)} onChange={() => setNoteOptions((current) => current.includes(option) ? current.filter((item) => item !== option) : [...current, option])} /> {option}</label>)}</div>
      <div className="school-notes-actions"><button className="school-create-notes-button" type="button" disabled={!quizDocument || quizChapters.length === 0 || noteOptions.length === 0} onClick={() => askSchool(`Create structured notes from ${cleanName(quizDocument)}, ${quizChapters.map((id) => quizOutline.find((item) => item.id === id)?.label ?? id).join(', ')}. Include only: ${noteOptions.join(', ')}. When 10-point summary is selected, provide exactly ten numbered, distinct, lesson-grounded points. Use only the indexed School material.`)}><FileText size={16} /> Create notes from selected lesson</button><PresentOnDisplay disabled={!quizDocument || quizChapters.length === 0} title={`${quizSubject} — selected lesson${quizChapters.length === 1 ? '' : 's'}`} subtitle={cleanName(quizDocument)} html={`<h2>Selected lessons or chapters</h2><ol>${quizChapters.map((id) => `<li>${quizOutline.find((item) => item.id === id)?.label ?? id}</li>`).join('')}</ol>`} /></div>
    </section>}
    <section className="school-profile"><label>Learner<input value={profile.learner} onChange={(event) => updateProfile({ ...profile, learner: event.target.value })} /></label><div className="school-fixed-level"><span>Learning level</span><strong>Level C</strong></div><p className="school-activity-note">Activities use the complete available question set. Starting again creates a freshly ordered set.</p><nav aria-label="School workspace views">{(['dashboard', 'read', 'library', 'quiz', 'flashcards', 'revision', 'notes', 'planner', 'results'] as View[]).map((item) => <button type="button" className={view === item ? 'active' : ''} key={item} onClick={() => item === 'read' ? openReader() : item === 'quiz' ? openQuiz() : item === 'flashcards' ? openFlashcards() : item === 'revision' ? openRevision() : item === 'notes' ? openNotes() : setView(item)}>{item === 'read' ? 'Read lessons' : item === 'revision' ? 'Revision sheet' : item === 'notes' ? 'Create notes' : item[0].toUpperCase() + item.slice(1)}</button>)}</nav></section>
    <div className="school-summary"><div><span>School documents</span><strong>{library?.document_count ?? 0}</strong></div><div><span>Completed</span><strong>{completed}</strong></div><div><span>Assessment average</span><strong>{average}%</strong></div><div><span>Study tasks</span><strong>{planned.length}</strong></div><div><span>Notes & highlights</span><strong>{notes.length}</strong></div></div>

    {view === 'dashboard' && <><section className="school-tools"><button type="button" onClick={openReader}><BookOpen size={20} /><span><strong>Read a lesson</strong><small>Choose subject and lesson</small></span></button><button type="button" onClick={() => askSchool('Explain a difficult lesson using only my indexed School materials. Ask which chapter I want before answering.')}><MessageSquareText size={20} /><span><strong>Explain a lesson</strong><small>Grounded, Level C help</small></span></button><button type="button" onClick={openRevision}><BookOpenCheck size={20} /><span><strong>Revision sheet</strong><small>Select, prepare, and print</small></span></button><button type="button" onClick={openQuiz}><Brain size={20} /><span><strong>Interactive quiz</strong><small>Answer, check, score, and retry</small></span></button><button type="button" onClick={openFlashcards}><Highlighter size={20} /><span><strong>Flashcards</strong><small>Flip cards and track recall</small></span></button><button type="button" onClick={openNotes}><FileText size={20} /><span><strong>Create notes</strong><small>Choose lesson and note sections</small></span></button></section>
      <div className="school-dashboard-grid"><section className="school-card"><h2><CalendarDays size={18} /> Up next</h2>{planned.length ? planned.slice(0, 5).map((item) => <label className="school-task" key={item.id}><input type="checkbox" checked={item.done} onChange={() => togglePlan(item.id)} /><span><strong>{item.title}</strong><small>{item.subject} · due {new Date(`${item.dueDate}T00:00:00`).toLocaleDateString()}</small></span></label>) : <p>No study tasks planned.</p>}<button type="button" className="school-text-button" onClick={() => setView('planner')}>Open study planner</button></section><section className="school-card"><h2><BarChart3 size={18} /> Progress snapshot</h2><div className="school-progress-bar"><span style={{ width: `${library?.document_count ? completed / library.document_count * 100 : 0}%` }} /></div><p>{completed} of {library?.document_count ?? 0} documents complete</p><p>Assessment average: <strong>{average}%</strong></p><button type="button" className="school-text-button" onClick={() => setView('results')}>View learning report</button></section></div>
      {recent.length > 0 && <section className="school-recent"><h2>Continue learning</h2><div>{recent.map(([name, item]) => <button type="button" key={name} onClick={() => { const document = library?.documents.find((entry) => entry.name === name); if (document) openDocument(document) }}><FileText size={18} /><span><strong>{cleanName(name)}</strong><small>{metadata.get(name)?.subject} · {item.percent ?? 0}% complete</small></span></button>)}</div></section>}</>}

    {view === 'read' && <section className="school-reader school-card"><header><span><BookOpen size={22} /></span><div><h2>Read Level C lessons</h2><p>Choose a subject, book, and lesson or chapter.</p></div></header>{loading ? <p className="school-state">Loading School lessons…</p> : error ? <div className="school-state error"><strong>School lessons unavailable</strong><span>{error}</span></div> : <div className="school-reader-controls"><label>Subject<select value={readingSubject} onChange={(event) => { const nextSubject = event.target.value; setReadingSubject(nextSubject); const first = (library?.documents ?? []).find((document) => metadata.get(document.name)?.subject === nextSubject); setReadingDocument(first?.name ?? '') }}><option value="">Choose a subject</option>{readingSubjects.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Book / material<select value={readingDocument} disabled={!readingSubject} onChange={(event) => setReadingDocument(event.target.value)}><option value="">Choose material</option>{readingDocuments.map((document) => <option key={document.id} value={document.name}>{cleanName(document.name)}</option>)}</select></label><label>Lesson / chapter<select value={readingSection} disabled={!readingDocument || outlineLoading} onChange={(event) => setReadingSection(event.target.value)}><option value="">{outlineLoading ? 'Finding lessons…' : 'Choose a lesson or chapter'}</option>{readingOutline.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><button type="button" disabled={!readingSection} onClick={readSelectedLesson}><BookOpen size={17} /> Open selection</button></div>}{!loading && !error && readingSubject && readingDocuments.length === 0 && <p className="school-state">No indexed lessons are available for {readingSubject}.</p>}</section>}

    {view === 'quiz' && <section className="school-quiz school-card"><header><div><h2><Brain size={19} /> Interactive Level C quiz</h2><p>Select a subject, book, and one or more lessons or chapters. Completed scores are saved in Results.</p></div><label>Subject<select value={quizSubject} disabled={quizStarted} onChange={(event) => { const nextSubject = event.target.value; const first = (library?.documents ?? []).find((document) => metadata.get(document.name)?.subject === nextSubject); setQuizSubject(nextSubject); setQuizDocument(first?.name ?? ''); setQuizChapters([]); setQuizStarted(false); setQuizAnswers({}); setQuizSubmitted(false) }}>{Object.keys(QUIZ_BANK).map((item) => <option key={item}>{item}</option>)}</select></label></header>{!quizStarted && <section className="school-quiz-setup"><label className="school-quiz-material">Book / material<select value={quizDocument} onChange={(event) => setQuizDocument(event.target.value)}><option value="">Choose material</option>{quizDocuments.map((document) => <option key={document.id} value={document.name}>{cleanName(document.name)}</option>)}</select></label><h3>Choose lesson(s) or chapter(s)</h3>{quizOutline.length ? <div>{quizOutline.map((section) => <label key={section.id}><input type="checkbox" checked={quizChapters.includes(section.id)} onChange={() => setQuizChapters((current) => current.includes(section.id) ? current.filter((id) => id !== section.id) : [...current, section.id])} /><span>{section.label}</span></label>)}</div> : <p>Choose an indexed book or material to see its lessons and chapters.</p>}<button type="button" disabled={quizChapters.length === 0} onClick={() => setQuizStarted(true)}>Start quiz from {quizChapters.length || 0} selection{quizChapters.length === 1 ? '' : 's'}</button></section>}{quizStarted && <><div className="school-quiz-scope"><span>{quizSubject}</span><strong>{quizChapters.map((id) => quizOutline.find((item) => item.id === id)?.label ?? id).join(' · ')}</strong><button type="button" onClick={() => { setQuizStarted(false); setQuizAnswers({}); setQuizSubmitted(false) }}>Change selection</button></div><div className="school-quiz-questions">{activityQuestions.map((item, index) => <fieldset key={item.question}><legend><span>{index + 1}</span>{item.question}</legend>{item.choices.map((choice, choiceIndex) => { const selected = quizAnswers[index] === choiceIndex; const state = quizSubmitted ? choiceIndex === item.answer ? 'correct' : selected ? 'incorrect' : '' : selected ? 'selected' : ''; return <label className={state} key={choice}><input type="radio" name={`quiz-${index}`} checked={selected} disabled={quizSubmitted} onChange={() => setQuizAnswers((current) => ({ ...current, [index]: choiceIndex }))} /><span>{choice}</span></label> })}{quizSubmitted && <p className={quizAnswers[index] === item.answer ? 'quiz-correct' : 'quiz-incorrect'}>{quizAnswers[index] === item.answer ? 'Correct. ' : `Correct answer: ${item.choices[item.answer]}. `}{item.explanation}</p>}</fieldset>)}</div><footer>{quizSubmitted ? <><strong>{Object.entries(quizAnswers).filter(([key, value]) => activityQuestions[Number(key)]?.answer === value).length} / {activityQuestions.length} correct</strong><button type="button" onClick={() => { setQuizAnswers({}); setQuizSubmitted(false); setNotice('') }}>Try again</button><button type="button" onClick={() => setView('results')}>View Results</button></> : <button type="button" disabled={Object.keys(quizAnswers).length !== activityQuestions.length} onClick={submitQuiz}><CheckCircle2 size={16} /> Check answers</button>}</footer></> }</section>}

    {view === 'flashcards' && <section className="school-activity school-card"><header><div><h2><Highlighter size={19} /> Interactive flashcards</h2><p>Select the exact Level C material and lesson before starting.</p></div><label>Subject<select value={quizSubject} disabled={flashcardsStarted} onChange={(event) => { const nextSubject = event.target.value; const first = (library?.documents ?? []).find((document) => metadata.get(document.name)?.subject === nextSubject); setQuizSubject(nextSubject); setQuizDocument(first?.name ?? ''); setQuizChapters([]) }}>{Object.keys(QUIZ_BANK).map((item) => <option key={item}>{item}</option>)}</select></label></header>{!flashcardsStarted ? <section className="school-quiz-setup"><label className="school-quiz-material">Book / material<select value={quizDocument} onChange={(event) => { setQuizDocument(event.target.value); setQuizChapters([]) }}><option value="">Choose material</option>{quizDocuments.map((document) => <option key={document.id} value={document.name}>{cleanName(document.name)}</option>)}</select></label><h3>Choose one or more lessons or chapters</h3>{quizOutline.length ? <div>{quizOutline.map((section) => <label key={section.id}><input type="checkbox" checked={quizChapters.includes(section.id)} onChange={() => setQuizChapters((current) => current.includes(section.id) ? current.filter((id) => id !== section.id) : [...current, section.id])} /><span>{section.label}</span></label>)}</div> : <p>Choose a material to see its lessons and chapters.</p>}<button type="button" disabled={!quizDocument || quizChapters.length === 0} onClick={() => { setFlashcardsStarted(true); setFlashcardIndex(0); setFlashcardFlipped(false); setKnownFlashcards([]) }}>Start flashcards</button></section> : <div className="school-flashcard-session"><div className="school-quiz-scope"><span>{quizSubject}</span><strong>{quizChapters.map((id) => quizOutline.find((item) => item.id === id)?.label ?? id).join(' · ')}</strong><button type="button" onClick={() => setFlashcardsStarted(false)}>Change selection</button></div><p className="school-flashcard-progress">Card {flashcardIndex + 1} of {activityQuestions.length} · {knownFlashcards.length} known</p>{(() => { const item = activityQuestions[flashcardIndex]; return <button type="button" className={`school-flashcard ${flashcardFlipped ? 'flipped' : ''}`} onClick={() => setFlashcardFlipped((value) => !value)}><small>{flashcardFlipped ? 'Answer' : 'Question'}</small><strong>{flashcardFlipped ? item.choices[item.answer] : item.question}</strong>{flashcardFlipped && <span>{item.explanation}</span>}<em>Click to {flashcardFlipped ? 'show question' : 'reveal answer'}</em></button> })()}<div className="school-flashcard-actions"><button type="button" onClick={() => { setKnownFlashcards((current) => current.filter((item) => item !== flashcardIndex)); setFlashcardIndex((current) => (current + 1) % activityQuestions.length); setFlashcardFlipped(false) }}>Review again</button><button type="button" onClick={() => { setKnownFlashcards((current) => current.includes(flashcardIndex) ? current : [...current, flashcardIndex]); setFlashcardIndex((current) => (current + 1) % activityQuestions.length); setFlashcardFlipped(false) }}>I know this</button></div></div>}</section>}

    {view === 'revision' && <section className="school-activity school-card"><header><div><h2><BookOpenCheck size={19} /> Revision sheet</h2><p>Select a subject, material, and lesson or chapter before preparing the sheet.</p></div><label>Subject<select value={quizSubject} disabled={revisionStarted} onChange={(event) => { const nextSubject = event.target.value; const first = (library?.documents ?? []).find((document) => metadata.get(document.name)?.subject === nextSubject); setQuizSubject(nextSubject); setQuizDocument(first?.name ?? ''); setQuizChapters([]) }}>{Object.keys(QUIZ_BANK).map((item) => <option key={item}>{item}</option>)}</select></label></header>{!revisionStarted ? <section className="school-quiz-setup"><label className="school-quiz-material">Book / material<select value={quizDocument} onChange={(event) => { setQuizDocument(event.target.value); setQuizChapters([]) }}><option value="">Choose material</option>{quizDocuments.map((document) => <option key={document.id} value={document.name}>{cleanName(document.name)}</option>)}</select></label><h3>Choose lesson(s) or chapter(s)</h3>{quizOutline.length ? <div>{quizOutline.map((section) => <label key={section.id}><input type="checkbox" checked={quizChapters.includes(section.id)} onChange={() => setQuizChapters((current) => current.includes(section.id) ? current.filter((id) => id !== section.id) : [...current, section.id])} /><span>{section.label}</span></label>)}</div> : <p>Choose a material to see its lessons and chapters.</p>}<button type="button" disabled={!quizDocument || quizChapters.length === 0} onClick={() => setRevisionStarted(true)}>Prepare revision sheet</button></section> : <article className="school-revision-sheet"><header><div><small>LAMPSTAND PROJECT · LEVEL C</small><h2>{quizSubject} Revision Sheet</h2><p>{cleanName(quizDocument)} · {quizChapters.map((id) => quizOutline.find((item) => item.id === id)?.label ?? id).join(', ')}</p></div><div><button type="button" onClick={() => setRevisionStarted(false)}>Change selection</button><button type="button" onClick={() => window.print()}><Printer size={14} /> Print / PDF</button></div></header><section><h3>Review questions</h3>{activityQuestions.map((item, index) => <div className="school-revision-question" key={item.question}><strong>{index + 1}. {item.question}</strong><span>Answer: ______________________________________________</span></div>)}</section><section><h3>Key points to remember</h3>{activityQuestions.map((item) => <p key={item.explanation}>• {item.explanation}</p>)}</section><section><h3>My notes</h3><div className="school-writing-lines" /></section></article>}</section>}

    {view === 'library' && <section className="school-library"><header><div><h2>Level C subject library</h2><p>Open a chapter, record progress, bookmark it, or add a study note in its viewer.</p></div><Link to="/documents?category=School&add=true"><Plus size={14} /> Add knowledge</Link></header><div className="school-library-filters"><label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search School documents…" /></label><select value={subject} onChange={(event) => setSubject(event.target.value)}>{subjects.map((item) => <option key={item}>{item}</option>)}</select></div>
      {loading ? <p className="school-state">Loading School library…</p> : error ? <div className="school-state error"><strong>School library unavailable</strong><span>{error}</span></div> : documents.length === 0 ? <div className="school-state"><strong>No matching documents</strong></div> : <div className="school-document-list">{documents.map((document) => <article key={document.id}><button className="school-document-open" type="button" onClick={() => openDocument(document)}><FileText size={19} /><span><strong>{cleanName(document.name)}</strong><small>{metadata.get(document.name)?.level} · {metadata.get(document.name)?.subject} · {document.chunks ?? 0} chunks</small><progress value={progress[document.name]?.percent ?? 0} max="100" /></span></button><button type="button" className={progress[document.name]?.completed ? 'complete' : ''} onClick={() => toggleComplete(document.name)} aria-label={`Mark ${document.name} ${progress[document.name]?.completed ? 'incomplete' : 'complete'}`}><CheckCircle2 size={17} /></button><button type="button" className={bookmarks.includes(document.name) ? 'active' : ''} onClick={() => toggleBookmark(document.name)} aria-label={`Bookmark ${document.name}`}><Star size={16} fill={bookmarks.includes(document.name) ? 'currentColor' : 'none'} /></button></article>)}</div>}
    </section>}

    {view === 'planner' && <div className="school-form-grid"><section className="school-card"><h2><CalendarDays size={18} /> Study schedule</h2><form onSubmit={addPlan}><label>Task<input required value={planForm.title} onChange={(event) => setPlanForm({ ...planForm, title: event.target.value })} placeholder="Read Chapter 3" /></label><label>Subject<select value={planForm.subject} onChange={(event) => setPlanForm({ ...planForm, subject: event.target.value })}>{subjects.filter((item) => item !== 'All subjects').map((item) => <option key={item}>{item}</option>)}</select></label><label>Document<select value={planForm.document} onChange={(event) => setPlanForm({ ...planForm, document: event.target.value })}><option value="">Optional</option>{library?.documents.map((item) => <option key={item.id} value={item.name}>{cleanName(item.name)}</option>)}</select></label><label>Due date<input type="date" value={planForm.dueDate} onChange={(event) => setPlanForm({ ...planForm, dueDate: event.target.value })} /></label><button type="submit"><Plus size={15} /> Add to schedule</button></form></section><section className="school-card"><h2>Planned learning</h2>{plans.length ? plans.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((item) => <label className={`school-task ${item.done ? 'done' : ''}`} key={item.id}><input type="checkbox" checked={item.done} onChange={() => togglePlan(item.id)} /><span><strong>{item.title}</strong><small>{item.subject} · {item.dueDate}</small></span></label>) : <p>No study tasks yet.</p>}</section></div>}

    {view === 'results' && <div className="school-form-grid"><section className="school-card"><h2><ListChecks size={18} /> Record a result</h2><form onSubmit={addAssessment}><label>Activity title<input required value={assessmentForm.title} onChange={(event) => setAssessmentForm({ ...assessmentForm, title: event.target.value })} /></label><label>Type<select value={assessmentForm.type} onChange={(event) => setAssessmentForm({ ...assessmentForm, type: event.target.value as Assessment['type'] })}><option>Quiz</option><option>Assignment</option><option>Exercise</option></select></label><label>Subject<select value={assessmentForm.subject} onChange={(event) => setAssessmentForm({ ...assessmentForm, subject: event.target.value })}>{subjects.filter((item) => item !== 'All subjects').map((item) => <option key={item}>{item}</option>)}</select></label><div className="school-score-fields"><label>Score<input type="number" min="0" value={assessmentForm.score} onChange={(event) => setAssessmentForm({ ...assessmentForm, score: event.target.value })} /></label><label>Out of<input type="number" min="1" value={assessmentForm.total} onChange={(event) => setAssessmentForm({ ...assessmentForm, total: event.target.value })} /></label></div><button type="submit"><Plus size={15} /> Save result</button></form></section><section className="school-card school-report"><header><div><h2><BarChart3 size={18} /> Learning report</h2><p>{profile.learner} · {profile.level}</p></div><div><button type="button" onClick={() => window.print()}><Printer size={14} /> PDF / Print</button><button type="button" onClick={() => downloadReport('doc')}><Download size={14} /> Word</button></div></header><div className="school-report-score"><strong>{average}%</strong><span>Overall average</span></div>{assessments.length ? <table><thead><tr><th>Activity</th><th>Subject</th><th>Score</th></tr></thead><tbody>{assessments.map((item) => <tr key={item.id}><td>{item.title}<small>{item.type}</small></td><td>{item.subject}</td><td>{item.score}/{item.total}</td></tr>)}</tbody></table> : <p>No results recorded yet.</p>}</section></div>}
  </section>
}

