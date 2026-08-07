import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatCount, formatFileSize, formatKnowledgeDate, getKnowledgeDocument } from './knowledge'

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

describe('getKnowledgeDocument', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('encodes category and document route values', async () => {
    const payload = { id: 'Ministry Notes/Test File', name: 'Test File.pdf' }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      getKnowledgeDocument('Ministry Notes', 'Test File'),
    ).resolves.toEqual(payload)

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8765/knowledge/Ministry%20Notes/Test%20File',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('forwards an abort signal', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{}', { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await getKnowledgeDocument('Ministry', 'Test', controller.signal)

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    )
  })

  it('includes status and detail in API errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ detail: 'Document was not found.' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    await expect(
      getKnowledgeDocument('Ministry', 'Missing'),
    ).rejects.toMatchObject({
      name: 'KnowledgeApiError',
      message: 'Document was not found.',
      status: 404,
    })
  })
})
