import { describe, expect, it } from 'vitest'
import { formatCount, formatFileSize, formatKnowledgeDate } from './knowledge'

describe('formatFileSize', () => {
  it('handles empty and invalid sizes', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(-1)).toBe('0 B')
    expect(formatFileSize(Number.NaN)).toBe('0 B')
  })

  it('formats byte and binary unit values', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(1024)).toBe('1.00 KB')
    expect(formatFileSize(1536)).toBe('1.50 KB')
    expect(formatFileSize(1024 ** 2)).toBe('1.00 MB')
  })
})

describe('formatCount', () => {
  it('returns a localized numeric value', () => {
    expect(formatCount(1234).replace(/\D/g, '')).toBe('1234')
  })
})

describe('formatKnowledgeDate', () => {
  it('handles missing and invalid dates', () => {
    expect(formatKnowledgeDate(null)).toBe('Not available')
    expect(formatKnowledgeDate('not-a-date')).toBe('Not available')
  })

  it('formats a valid date', () => {
    expect(formatKnowledgeDate('2026-08-07T00:00:00Z')).not.toBe('Not available')
  })
})
