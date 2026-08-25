import { AIOS_API_BASE_URL } from '../config/api'

export interface HwmrMorningVerse { reference: string; text: string }
export interface HwmrDay { day: number; pages: [number, number]; morningVerses: HwmrMorningVerse[]; morningNourishment: string; todaysReading: string }
export interface HwmrHymn { number: string; pages: [number, number]; text: string }
export interface HwmrWeek { number: number; title: string; outline: string; days: HwmrDay[]; hymn: HwmrHymn | null }
export interface HwmrBook { id: string; fileName: string; title: string; generalSubject: string; volume: string; author: string; event: string; keyStatements: string[]; pageCount: number; structure?: 'weekly' | 'messages'; weeks: HwmrWeek[] }
export interface HwmrAudit { status: 'passed'; checkedAt: string; books: number; weeks: number; weeklyBooks: number; dailyPortions: number; morningVerses: number }

export async function getHwmrLibrary(signal?: AbortSignal) {
  const response = await fetch(`${AIOS_API_BASE_URL}/hwmr/library`, { signal })
  if (!response.ok) throw new Error('Unable to load the HWMR library.')
  return response.json() as Promise<{ books: HwmrBook[]; audit?: HwmrAudit }>
}

export async function refreshHwmrLibrary() {
  const response = await fetch(`${AIOS_API_BASE_URL}/hwmr/refresh`, { method: 'POST' })
  if (!response.ok) throw new Error('The PDF was uploaded, but the HWMR reader could not be refreshed.')
  return response.json() as Promise<HwmrAudit & { qualityCheck: 'passed' }>
}
