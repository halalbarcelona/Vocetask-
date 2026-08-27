// Color is the whole point once there's more than the two defaults — the
// fastest way to tell projects/lists apart at a glance, the same job
// LabelChip's color does for labels. The two renders stay deliberately
// different: inside a task row's meta line, a colored dot plus plain text
// keeps the row's text one color and still scannable; a standalone picker
// chip (Confirm, Filters) gets the bolder colored-text treatment since
// picking a category is the one thing that row is for.
export default function CategoryChip({ category, color, selected, onClick }) {
  // Never trust the caller for this — an undefined category used to throw
  // on .toLowerCase() and white-screen the whole app.
  const label = typeof category === 'string' && category ? category : 'Personal'
  const tint = color || '#8a8a94'

  if (onClick) {
    const style = {
      color: tint,
      ...(selected ? { borderColor: tint, background: `color-mix(in srgb, ${tint} 14%, var(--surface))` } : {}),
    }
    return (
      <button type="button" className={`chip chip--button${selected ? ' chip--selected' : ''}`} style={style} onClick={onClick}>
        {label}
      </button>
    )
  }

  return (
    <span className="chip">
      <span className="chip__dot" style={{ background: tint }} aria-hidden="true" />
      {label}
    </span>
  )
}
