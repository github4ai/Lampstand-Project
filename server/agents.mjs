const agents = [
  {
    id: 'general',
    name: 'General Assistant',
    description: 'General-purpose Lampstand assistant for broad questions, writing, planning, and everyday tasks.',
    category: 'General',
    icon: 'bot',
    capabilities: ['Questions and explanations', 'Writing and rewriting', 'Planning and summaries'],
    recommended_tasks: ['Explain a topic clearly', 'Draft or improve text', 'Plan a project or checklist'],
  },
  {
    id: 'ministry',
    name: 'Ministry Assistant',
    description: 'Grounded assistant for Bible study, HWMR, Life-Study, hymns, outlines, and ministry materials.',
    category: 'Ministry',
    icon: 'book-open',
    capabilities: ['Recovery Bible and study notes', 'HWMR and Life-Study', 'Hymns and ministry outlines'],
    recommended_tasks: ['Find and explain a Bible passage', 'Prepare a weekly sharing outline', 'Summarize an indexed ministry document'],
  },
  {
    id: 'school',
    name: 'School Assistant',
    description: 'Learning assistant for subject-grounded explanations, revision, exercises, and study support.',
    category: 'School',
    icon: 'graduation-cap',
    capabilities: ['Lesson explanations', 'Revision and practice', 'Document-grounded school help'],
    recommended_tasks: ['Explain a difficult lesson', 'Create revision questions', 'Summarize a school chapter'],
  },
]

export function listAgents() {
  return agents.map((agent) => ({ ...agent, capabilities: [...agent.capabilities], recommended_tasks: [...agent.recommended_tasks] }))
}

export function getAgent(id) {
  const normalized = String(id || '').trim().toLowerCase()
  const agent = agents.find((item) => item.id === normalized)
  return agent ? { ...agent, capabilities: [...agent.capabilities], recommended_tasks: [...agent.recommended_tasks] } : null
}
