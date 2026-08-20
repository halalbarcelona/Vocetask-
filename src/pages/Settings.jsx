import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomTabBar from '../components/BottomTabBar'
import { ChevronIcon } from '../components/icons'
import { usePremiumContext } from '../hooks/PremiumContext'

export default function Settings() {
  const navigate = useNavigate()
  const { isPremium } = usePremiumContext()
  const [pushNotifications, setPushNotifications] = useState(true)
  const [calendarSync, setCalendarSync] = useState(false)

  return (
    <div className="screen">
      <header className="page-header">
        <h1 className="page-header__title">Settings</h1>
      </header>

      <main className="screen__content">
        <div className="card profile-card">
          <div className="profile-card__avatar">A</div>
          <div>
            <p className="profile-card__name">Aura User</p>
            <p className="profile-card__email">you@example.com</p>
          </div>
        </div>

        <div className={`upgrade-banner${isPremium ? ' upgrade-banner--premium' : ''}`}>
          <div>
            <p className="upgrade-banner__title">{isPremium ? 'You’re on Premium' : 'You’re on Free'}</p>
            <p className="upgrade-banner__subtitle">
              {isPremium ? 'Unlimited tasks and voice entry are unlocked' : 'Upgrade for unlimited voice tasks'}
            </p>
          </div>
          {!isPremium && (
            <button type="button" className="button button--light" onClick={() => navigate('/upgrade')}>
              Upgrade
            </button>
          )}
        </div>

        <section className="settings-group">
          <h2 className="section-title">Preferences</h2>
          <div className="card">
            <div className="settings-row">
              <span>Push Notifications</span>
              <Toggle checked={pushNotifications} onChange={setPushNotifications} label="Push Notifications" />
            </div>
            <div className="settings-row">
              <span>Calendar Sync</span>
              <Toggle checked={calendarSync} onChange={setCalendarSync} label="Calendar Sync" />
            </div>
          </div>
        </section>

        <section className="settings-group">
          <h2 className="section-title">General</h2>
          <div className="card">
            <button type="button" className="settings-row settings-row--link">
              <span>Account Settings</span>
              <ChevronIcon />
            </button>
            <button type="button" className="settings-row settings-row--link">
              <span>Privacy Policy</span>
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
