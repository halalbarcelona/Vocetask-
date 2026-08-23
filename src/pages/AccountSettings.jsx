import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccountContext } from '../hooks/AccountContext'
import { useTasksContext } from '../hooks/TasksContext'
import { usePremiumContext } from '../hooks/PremiumContext'
import { BackIcon } from '../components/icons'

export default function AccountSettings() {
  const navigate = useNavigate()
  const { account, updateAccount, logOut } = useAccountContext()
  const { clearAllTasks } = useTasksContext()
  const { deactivatePremium, isPaid } = usePremiumContext()

  const [name, setName] = useState(account?.name ?? '')
  const [email, setEmail] = useState(account?.email ?? '')
  const [saved, setSaved] = useState(false)

  const handleSave = (e) => {
    e.preventDefault()
    const nextEmail = email.trim()

    // Premium is keyed to the account email all the way through Stripe and
    // the backend, so silently changing it strands a purchase under the old
    // address with no way to recover it on another device.
    if (isPaid && nextEmail !== account?.email) {
      const ok = window.confirm(
        `Your Premium purchase is linked to ${account?.email}.\n\n` +
          `Changing your email to ${nextEmail} will unlink it, and you may lose Premium ` +
          `when you sign in on another device.\n\nChange it anyway?`,
      )
      if (!ok) {
        setEmail(account?.email ?? '')
        return
      }
    }

    updateAccount({ name: name.trim(), email: nextEmail })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleLogOut = () => {
    logOut()
    navigate('/create-account', { replace: true })
  }

  const handleDeleteAccount = () => {
    const confirmed = window.confirm(
      'Delete your account? This removes your profile, all tasks, and Premium status from this device. This cannot be undone.',
    )
    if (!confirmed) return
    clearAllTasks()
    deactivatePremium()
    logOut()
    navigate('/create-account', { replace: true })
  }

  return (
    <div className="screen">
      <header className="page-header">
        <button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label="Go back">
          <BackIcon />
        </button>
        <h1 className="page-header__title">Account settings</h1>
        <span className="icon-button icon-button--spacer" />
      </header>

      <main className="screen__content">
        <form className="card confirm-card" onSubmit={handleSave}>
          <label className="field">
            <span className="field__label">Name</span>
            <input
              type="text"
              className="field__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="field">
            <span className="field__label">Email</span>
            <input
              type="email"
              className="field__input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <button type="submit" className="button button--primary button--wide">
            {saved ? 'Saved' : 'Save changes'}
          </button>
        </form>

        <section className="settings-group">
          <h2 className="section-title">Account</h2>
          <div className="card">
            <button type="button" className="settings-row settings-row--link" onClick={handleLogOut}>
              <span>Log out</span>
            </button>
            <button type="button" className="settings-row settings-row--danger" onClick={handleDeleteAccount}>
              <span>Delete account</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
