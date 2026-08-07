import type { Hymn } from '../types/hymnal'

export function getRelatedHymns(selected: Hymn, hymns: Hymn[], limit = 4): Hymn[] {
  const selectedThemes = new Set(selected.themes.map((theme) => theme.toLowerCase()))
  return hymns
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
    .slice(0, limit)
    .map((item) => item.hymn)
}
