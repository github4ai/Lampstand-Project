import { describe, expect, it } from 'vitest'
import { getAgent, listAgents } from './agents.mjs'

describe('local AIOS assistants', () => {
  it('provides all configured assistants without the legacy API', () => {
    expect(listAgents().map((agent) => agent.id)).toEqual(['general', 'ministry', 'school'])
  })

  it('provides capabilities and recommended tasks', () => {
    const ministry = getAgent('MINISTRY')
    expect(ministry?.capabilities).toContain('HWMR and Life-Study')
    expect(ministry?.recommended_tasks.length).toBeGreaterThan(0)
  })

  it('returns null for unknown assistants', () => {
    expect(getAgent('unknown')).toBeNull()
  })

  it('normalizes assistant ids for API callers', () => {
    expect(getAgent('  SCHOOL ')?.id).toBe('school')
    expect(getAgent('MINISTRY')?.id).toBe('ministry')
  })
})
