export default function CategoryChip({ category, selected, onClick }) {
  const classes = [
    'chip',
    `chip--${category.toLowerCase()}`,
    selected ? 'chip--selected' : '',
    onClick ? 'chip--button' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick}>
        {category}
      </button>
    )
  }

  return <span className={classes}>{category}</span>
}
