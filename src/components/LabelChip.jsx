// A label's colour is the whole point — it's the fastest way to tell labels
// apart at a glance across a crowded list, the same way Todoist does it.
export default function LabelChip({ name, color, selected, onClick }) {
  const style = selected
    ? { background: color, color: '#fff', borderColor: color }
    : { color, borderColor: color }

  const content = (
    <>
      <span className="label-chip__dot" style={{ background: color }} />
      {name}
    </>
  )

  if (onClick) {
    return (
      <button type="button" className="label-chip label-chip--button" style={style} onClick={onClick}>
        {content}
      </button>
    )
  }

  return (
    <span className="label-chip" style={{ color }}>
      {content}
    </span>
  )
}
