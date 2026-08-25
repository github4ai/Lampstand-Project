import { describe, expect, it } from 'vitest'

import { buildContextualQuestion } from './contextualQuestion'

describe('buildContextualQuestion', () => {
  it('keeps a first question unchanged', () => {
    expect(buildContextualQuestion('What is grace?', [])).toBe('What is grace?')
  })

  it('includes recent conversation context for a follow-up', () => {
    const result = buildContextualQuestion('Put the outline in a PDF.', [
      { id: '1', role: 'user', content: 'Create an outline about grace.' },
      { id: '2', role: 'assistant', content: 'I. Grace is God enjoyed by us.' },
    ])

    expect(result).toContain('Create an outline about grace.')
    expect(result).toContain('I. Grace is God enjoyed by us.')
    expect(result).toContain('CURRENT REQUEST\nPut the outline in a PDF.')
  })

  it('does not contaminate a new independent question with earlier answers', () => {
    const result = buildContextualQuestion('What is Galatians 2:20?', [
      { id: '1', role: 'user', content: 'What is Genesis 1:26?' },
      { id: '2', role: 'assistant', content: 'Genesis 1:26 says...' },
    ])

    expect(result).toBe('What is Galatians 2:20?')
    expect(result).not.toContain('Genesis 1:26')
  })

  it('includes context for a pronoun-based follow-up', () => {
    const result = buildContextualQuestion('Explain that more.', [
      { id: '1', role: 'user', content: 'What is grace?' },
      { id: '2', role: 'assistant', content: 'Grace is God enjoyed by us.' },
    ])

    expect(result).toContain('Grace is God enjoyed by us.')
    expect(result).toContain('CURRENT REQUEST\nExplain that more.')
  })
})
