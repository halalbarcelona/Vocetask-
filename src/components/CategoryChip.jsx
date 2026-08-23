export default function CategoryChip({ category, selected, onClick }) {
  // Never trust the caller for this — an undefined category used to throw
  // on .toLowerCase() and white-screen the whole app.
  const label = typeof category === 'string' && category ? category : 'Personal'
  const classes = [
    'chip',
    `chip--${label.toLowerCase().replace(/\s+/g, '-')}`,
    selected ? 'chip--selected' : '',
    onClick ? 'chip--button' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick}>
        {label}
      </button>
    )
  }

  return <span className={classes}>{label}</span>
}
