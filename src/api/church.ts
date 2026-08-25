import { AIOS_API_BASE_URL } from '../config/api'

export async function generateChurchText(prompt: string) {
  const response = await fetch(`${AIOS_API_BASE_URL}/church/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body?.detail || `Church generation failed with status ${response.status}.`)
  }
  return response.json() as Promise<{ text: string; provider: string; model: string }>
}
