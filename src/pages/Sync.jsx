import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccountContext } from '../hooks/AccountContext'
import { useSyncContext } from '../hooks/SyncContext'
import { useTasksContext } from '../hooks/TasksContext'
import { usePremiumContext } from '../hooks/PremiumContext'
import LockedOverlay from '../components/LockedOverlay'
import { BackIcon, CheckIcon, LayersIcon } from '../components/icons'
import { supabaseConfigured } from '../lib/supabaseClient'

// A code that fails because the backend table doesn't exist yet reads the
// same to a tester as "sync is broken" whether or not that's true — surface
// something actionable instead of a raw Postgres/PostgREST error string.
function friendlySyncError(message) {
  if (!message) return ''
  if (/relation .* does not exist|schema cache|PGRST20/i.test(message)) {
    return 'Sync isn’t turned on for this project yet — the backend migration hasn’t been run.'
  }
  return message
}

export default function Sync() {
  const navigate = useNavigate()
  const { account } = useAccountContext()
  const { isPremium } = usePremiumContext()
  const { isSignedIn, userEmail, loading, error: authError, requestCode, verifyCode, signOut } = useSyncContext()
  const { syncStatus, syncError, syncNow } = useTasksContext()

  const [email, setEmail] = useState(account?.email ?? '')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState('email') // 'email' | 'code'
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState('')

  const handleSendCode = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    setFormError('')
    const result = await requestCode(email.trim())
    setSending(false)
    if (result.ok) setStage('code')
    else setFormError(result.message)
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    if (!code.trim()) return
    setSending(true)
    setFormError('')
    const result = await verifyCode(email.trim(), code.trim())
    setSending(false)
    if (!result.ok) setFormError(result.message)
    // On success, isSignedIn flips reactively via the auth listener — no
    // further action needed here.
  }

  return (
    <div className="screen">
      <header className="page-header">
        <button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label="Go back">
          <BackIcon />
        </button>
        <h1 className="page-header__title">Sync across devices</h1>
        <span className="icon-button icon-button--spacer" />
      </header>

      <main className="screen__content">
        <LockedOverlay
          locked={!isPremium}
          title="Take your tasks anywhere"
          subtitle="Unlock Premium to sync across your phone, tablet, and computer."
        >
          {!supabaseConfigured ? (
            <div className="empty-state">
              <LayersIcon width={28} height={28} className="empty-state__icon" />
              <p>Sync isn’t set up yet.</p>
            </div>
          ) : loading ? (
            <p className="record-hint">Checking sign-in status…</p>
          ) : isSignedIn ? (
            <>
              <div className="card upsell-card">
                <p className="upsell-card__feature">
                  <CheckIcon /> Synced as {userEmail}
                </p>
                <p className="upsell-card__message">
                  {syncStatus === 'syncing' && 'Syncing…'}
                  {syncStatus === 'synced' && 'Everything on this device is backed up and matched to your account.'}
                  {syncStatus === 'error' && friendlySyncError(syncError)}
                  {syncStatus === 'idle' && 'Ready to sync.'}
                </p>
              </div>
              <div className="confirm-actions">
                <button type="button" className="button button--primary button--wide" onClick={syncNow}>
                  Sync now
                </button>
                <button
                  type="button"
                  className="button button--ghost button--wide"
                  onClick={() => {
                    signOut()
                    setStage('email')
                    setCode('')
                  }}
                >
                  Turn off sync on this device
                </button>
              </div>
              <p className="record-hint">
                Your tasks stay right here too — turning sync off just stops this device from sending
                or receiving updates. Nothing already saved locally is deleted.
              </p>
            </>
          ) : stage === 'email' ? (
            <form className="card confirm-card" onSubmit={handleSendCode}>
              <p className="confirm-hint" style={{ marginTop: 0 }}>
                We’ll email you a 6-digit code — no password to remember, and nothing else about this
                sign-in touches your local tasks or account profile.
              </p>
              <label className="field">
                <span className="field__label">Email</span>
                <input
                  type="email"
                  className="field__input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </label>
              {(formError || authError) && <p className="record-error">{formError || authError}</p>}
              <button type="submit" className="button button--primary button--wide" disabled={sending || !email.trim()}>
                {sending ? 'Sending…' : 'Send code'}
              </button>
            </form>
          ) : (
            <form className="card confirm-card" onSubmit={handleVerify}>
              <p className="confirm-hint" style={{ marginTop: 0 }}>
                Enter the code sent to {email}.
              </p>
              <label className="field">
                <span className="field__label">Code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="field__input"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  autoFocus
                />
              </label>
              {(formError || authError) && <p className="record-error">{formError || authError}</p>}
              <button type="submit" className="button button--primary button--wide" disabled={sending || !code.trim()}>
                {sending ? 'Verifying…' : 'Verify'}
              </button>
              <button type="button" className="link-button" onClick={() => { setStage('email'); setCode(''); setFormError('') }}>
                Use a different email
              </button>
            </form>
          )}
        </LockedOverlay>
      </main>
    </div>
  )
}
