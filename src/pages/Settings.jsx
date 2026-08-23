import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomTabBar from '../components/BottomTabBar'
import { ChevronIcon, LockIcon, MoonIcon, SunIcon } from '../components/icons'
import { usePremiumContext } from '../hooks/PremiumContext'
import { useAccountContext } from '../hooks/AccountContext'
import { useTasksContext } from '../hooks/TasksContext'
import { useNotifications } from '../hooks/useNotifications'
import { useTheme } from '../hooks/useTheme'
import { downloadICS } from '../utils/icsExport'
import { exportTasksJSON, parseBackupFile } from '../utils/backup'
import { buildTodaySummary, shareText } from '../utils/share'
import { isDueOn } from '../utils/recurrence'
import { todayISO } from '../utils/dateUtils'

function PremiumRow({ isPremium, label, onClick }) {
  return (
    <button type="button" className="settings-row settings-row--link" onClick={onClick}>
      <span>
        {label}
        {!isPremium && (
          <span className="field__label-badge">
            <LockIcon width={12} height={12} /> Premium
          </span>
        )}
      </span>
      <ChevronIcon />
    </button>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const { isPremium, isPaid, trialActive, trialDaysLeft } = usePremiumContext()
  const { account } = useAccountContext()
  const { tasks, importTasks } = useTasksContext()
  const notifications = useNotifications(tasks)
  const { theme, setTheme } = useTheme()
  const [calendarSync, setCalendarSync] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const importInputRef = useRef(null)

  const initial = account?.name?.trim()?.[0]?.toUpperCase() || '?'

  const flashStatus = (message) => {
    setStatusMessage(message)
    setTimeout(() => setStatusMessage(''), 3000)
  }

  const requirePremium = (action) => {
    if (!isPremium) {
      navigate('/upgrade')
      return
    }
    action()
  }

  const handleBackup = () => requirePremium(() => exportTasksJSON(tasks))

  const handleRestoreClick = () => requirePremium(() => importInputRef.current?.click())

  const handleRestoreFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const importedTasks = await parseBackupFile(file)
      importTasks(importedTasks)
      flashStatus(`Restored ${importedTasks.length} task(s)`)
    } catch {
      flashStatus('That file isn’t a valid Aura Task backup')
    }
  }

  const handleShareToday = () =>
    requirePremium(async () => {
      const todayTasks = tasks.filter((t) => isDueOn(t, todayISO()))
      const result = await shareText(buildTodaySummary(todayTasks))
      if (result === 'copied') flashStatus('Copied today’s list to clipboard')
    })

  return (
    <div className="screen">
      <header className="page-header">
        <h1 className="page-header__title">Settings</h1>
      </header>

      <main className="screen__content">
        <div className="card profile-card">
          <div className="profile-card__avatar">{initial}</div>
          <div>
            <p className="profile-card__name">{account?.name || 'Aura User'}</p>
            <p className="profile-card__email">{account?.email || ''}</p>
          </div>
        </div>

        <p className="trust-badge">
          <LockIcon width={13} height={13} /> Your tasks stay on this device — nothing is uploaded.
        </p>

        <div className={`upgrade-banner${isPremium ? ' upgrade-banner--premium' : ''}`}>
          <div>
            <p className="upgrade-banner__title">
              {isPaid
                ? 'Premium — lifetime'
                : trialActive
                  ? `Premium trial — ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left`
                  : 'You’re on Free'}
            </p>
            <p className="upgrade-banner__subtitle">
              {isPaid
                ? 'Paid once. Every feature, forever.'
                : trialActive
                  ? 'Keep every feature for one payment'
                  : 'One-time payment — no subscription'}
            </p>
          </div>
          {!isPaid && (
            <button type="button" className="button button--light" onClick={() => navigate('/upgrade')}>
              {trialActive ? 'Keep it' : 'Upgrade'}
            </button>
          )}
        </div>

        <section className="settings-group">
          <h2 className="section-title">Preferences</h2>
          <div className="card">
            <div className="settings-row">
              <span>
                Push notifications
                {notifications.enabled && <span className="settings-row__note"> · while app is open</span>}
              </span>
              <Toggle
                checked={notifications.enabled}
                onChange={notifications.setEnabled}
                label="Push notifications"
              />
            </div>
            <div className="settings-row">
              <span>Appearance</span>
              <div className="theme-row">
                {[
                  { value: 'system', label: 'Auto' },
                  { value: 'light', label: 'Light', icon: <SunIcon width={13} height={13} /> },
                  { value: 'dark', label: 'Dark', icon: <MoonIcon width={13} height={13} /> },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`theme-chip${theme === option.value ? ' theme-chip--active' : ''}`}
                    onClick={() => setTheme(option.value)}
                    aria-pressed={theme === option.value}
                  >
                    {option.icon}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-row">
              <span>Calendar sync</span>
              <Toggle checked={calendarSync} onChange={setCalendarSync} label="Calendar sync" />
            </div>
          </div>
        </section>

        <section className="settings-group">
          <h2 className="section-title">Insights</h2>
          <div className="card">
            <PremiumRow
              isPremium={isPremium}
              label="Productivity report"
              onClick={() => (isPremium ? navigate('/stats') : navigate('/upgrade'))}
            />
            <PremiumRow
              isPremium={isPremium}
              label="Task templates"
              onClick={() => (isPremium ? navigate('/templates') : navigate('/upgrade'))}
            />
          </div>
        </section>

        <section className="settings-group">
          <h2 className="section-title">Data</h2>
          <div className="card">
            <PremiumRow
              isPremium={isPremium}
              label="Export to calendar (.ics)"
              onClick={() => (isPremium ? downloadICS(tasks) : navigate('/upgrade'))}
            />
            <PremiumRow isPremium={isPremium} label="Backup tasks (.json)" onClick={handleBackup} />
            <PremiumRow isPremium={isPremium} label="Restore from backup" onClick={handleRestoreClick} />
            <PremiumRow isPremium={isPremium} label="Share today’s list" onClick={handleShareToday} />
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={handleRestoreFile}
            />
          </div>
          {statusMessage && <p className="settings-row__note" style={{ marginTop: 6 }}>{statusMessage}</p>}
        </section>

        <section className="settings-group">
          <h2 className="section-title">General</h2>
          <div className="card">
            <button type="button" className="settings-row settings-row--link" onClick={() => navigate('/account')}>
              <span>Account settings</span>
              <ChevronIcon />
            </button>
            <button type="button" className="settings-row settings-row--link" onClick={() => navigate('/privacy')}>
              <span>Privacy policy</span>
              <ChevronIcon />
            </button>
          </div>
        </section>
      </main>

      <BottomTabBar />
    </div>
  )
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle${checked ? ' toggle--on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__thumb" />
    </button>
  )
}
