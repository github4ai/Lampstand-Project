interface ReadingVerse { number: number; text: string }

export function formatVerseReading(book: string, chapter: number, verses: ReadingVerse[]) {
  if (!verses.length) return ''
  const groups = verses.reduce<ReadingVerse[][]>((result, verse) => {
    const current = result.at(-1)
    if (current?.at(-1)?.number === verse.number - 1) current.push(verse)
    else result.push([verse])
    return result
  }, [])
  const spoken = groups.map((group) => {
    const first = group[0]
    const last = group.at(-1)!
    const label = group.length > 1 ? `Verses ${first.number} through ${last.number}.` : `Verse ${first.number}.`
    return `${label} ${group.map((verse) => verse.text).join(' ')}`
  })
  return `${book}, chapter ${chapter}. ${spoken.join(' ')}`
}
