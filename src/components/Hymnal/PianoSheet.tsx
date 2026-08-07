import type { Hymn } from '../../types/hymnal'

function PianoSheet({ hymn }: { hymn: Hymn }) {
  if (hymn.pianoSheetUrl) return <div className="hymnal-piano-sheet">
    <img src={hymn.pianoSheetUrl} alt={'Piano sheet for ' + hymn.title} />
  </div>
  if (!hymn.tune) return <div className="hymnal-piano-empty">
    No piano sheet is available for this hymn yet.
  </div>
  const width = Math.max(680, hymn.tune.notes.length * 38 + 80)
  return <div className="hymnal-piano-sheet generated">
    <h3>Practice melody</h3>
    <p>Treble guide generated from the local tune data.</p>
    <svg viewBox={'0 0 ' + width + ' 180'} role="img"
      aria-label={'Practice melody for ' + hymn.title}>
      {[50, 65, 80, 95, 110].map((y) =>
        <line x1="35" x2={width - 25} y1={y} y2={y} key={y} />)}
      {hymn.tune.notes.map((note, index) => {
        const x = 65 + index * 38
        const y = 110 - (note.midi - 60) * 4
        return <g key={note.midi + '-' + index}>
          <ellipse cx={x} cy={y} rx="8" ry="6" />
          <line x1={x + 7} x2={x + 7} y1={y} y2={y - 30} />
        </g>
      })}
    </svg>
  </div>
}
export default PianoSheet
