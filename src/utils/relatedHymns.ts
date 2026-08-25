import type { Hymn } from '../types/hymnal'

export function getRelatedHymns(selected: Hymn, hymns: Hymn[], limit = 4): Hymn[] {
  const catalogKey = (hymn: Hymn) => `${hymn.catalogPrefix ?? ''}${hymn.hymnNumber ?? ''}`.toUpperCase()
  const explicit = (selected.relatedCatalogs ?? []).map((catalog) =>
    hymns.find((hymn) => hymn.id !== selected.id && catalogKey(hymn) === catalog.toUpperCase()))
    .filter((hymn): hymn is Hymn => Boolean(hymn))
  if (explicit.length >= limit) return explicit.slice(0, limit)
  const selectedThemes = new Set(selected.themes.map((theme) => theme.toLowerCase()))
  const inferred = hymns
    .filter((hymn) => hymn.id !== selected.id)
    .map((hymn) => ({
      hymn,
      score: hymn.themes.reduce(
        (total, theme) => total + (selectedThemes.has(theme.toLowerCase()) ? 2 : 0),
        hymn.category && hymn.category === selected.category ? 1 : 0,
      ),
    }))
    .filter((item) => item.score > 0)
    .sort((first, second) =>
      second.score - first.score || first.hymn.title.localeCompare(second.hymn.title))
    .map((item) => item.hymn)
    .filter((hymn) => !explicit.some((item) => item.id === hymn.id))
  return [...explicit, ...inferred].slice(0, limit)
}
