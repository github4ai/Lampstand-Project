export interface AgentSummary {
  id: string
  name: string
  description: string
  category: string
  icon: string
  capabilities?: string[]
  recommended_tasks?: string[]
}
