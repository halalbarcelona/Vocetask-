export default function Toast({ toast, onDismiss }) {
  if (!toast) return null

  return (
    <div className="toast" role="status">
      <span className="toast__message">{toast.message}</span>
      {toast.actionLabel && (
        <button
          type="button"
          className="toast__action"
          onClick={() => {
            toast.onAction?.()
            onDismiss()
          }}
        >
          {toast.actionLabel}
        </button>
      )}
    </div>
  )
}
