import { describe, expect, it } from 'vitest'
import { parseImportedConversation } from './importConversation'

const now = '2026-08-07T12:00:00.000Z'
function ids() { let count = 0; return () => `id-${++count}` }

describe('parseImportedConversation', () => {
  it('normalizes a valid exported conversation', () => {
    const result = parseImportedConversation({
      id: 'old', title: '  Imported chat  ', agentId: 'research-agent',
      createdAt: '2026-08-01T10:00:00.000Z', pinned: true,
      messages: [{ id: 'old-message', role: 'assistant', content: 'Answer',
        grounded: true, sources: [{ id: 1, citation: '[1]', source: 'notes.pdf',
          page: 2, chunk: 4, rerank_score: 0.9 }] }],
    }, ids(), now)
    expect(result).toMatchObject({
      id: 'id-2', title: 'Imported chat', agentId: 'research-agent',
      createdAt: '2026-08-01T10:00:00.000Z', updatedAt: now, pinned: false,
      messages: [{ id: 'id-1', role: 'assistant', content: 'Answer' }],
    })
  })
  it('rejects invalid messages and malformed sources', () => {
    expect(parseImportedConversation({
      title: 'Invalid', agentId: 'agent',
      messages: [{ role: 'system', content: 'No' }],
    }, ids(), now)).toBeNull()
    expect(parseImportedConversation({
      title: 'Invalid', agentId: 'agent',
      messages: [{ role: 'assistant', content: 'No', sources: [{ citation: '[1]' }] }],
    }, ids(), now)).toBeNull()
  })
  it('uses safe defaults for empty optional metadata', () => {
    const result = parseImportedConversation({
      title: '   ', agentId: 'agent', messages: [],
    }, ids(), now)
    expect(result).toMatchObject({
      title: 'Imported conversation', createdAt: now, updatedAt: now, pinned: false,
    })
  })
})
