import { afterEach, describe, expect, it, vi } from 'vitest'
import { getHymnalLibrary, importHymnalMirror } from './hymnal'

afterEach(() => vi.unstubAllGlobals())

describe('Hymnal library API', () => {
  it('loads the local library', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ hymns: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await getHymnalLibrary()
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:9656/hymnal/library', { signal: undefined })
  })

  it('starts a mirror import', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ imported: 10, failed: 0 }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    await importHymnalMirror('C:\\Hymnal')
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:9656/hymnal/import-mirror', expect.objectContaining({ method: 'POST' }))
  })
})
