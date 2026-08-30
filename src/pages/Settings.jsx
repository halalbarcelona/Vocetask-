import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomTabBar from '../components/BottomTabBar'
import { ChevronIcon, LockIcon, MoonIcon, SunIcon } from '../components/icons'
import { usePremiumContext } from '../hooks/PremiumContext'
import { useAccountContext } from '../hooks/AccountContext'
import { useTasksContext } from '../hooks/TasksContext'
import { useNotificationsContext } from '../hooks/NotificationsContext'
import { useTheme } from '../hooks/useTheme'
import { useAccentContext } from '../hooks/AccentContext'
import { useVoiceLang, VOICE_LANGS } from '../hooks/useVoiceLang'
import { useUILangContext } from '../hooks/UILangContext'
import { usePreferencesContext } from '../hooks/PreferencesContext'
import { downloadICS } from '../utils/icsExport'
import { exportTasksJSON, parseBackupFile } from '../utils/backup'
import { buildTodaySummary, shareText } from '../utils/share'
import { isDueOn } from '../utils/recurrence'
import { todayISO } from '../utils/dateUtils'

function minutesToTimeInput(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function timeInputToMinutes(value) {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

function PremiumRow({ isPremium, label, onClick }) {
  const { t } = useUILangContext()
  return (
    <button type="button" className="settings-row settings-row--link" onClick={onClick}>
      <span>
        {label}
        {!isPremium && (
          <span className="field__label-badge">
            <LockIcon width={12} height={12} /> {t('premiumBadge')}
          </span>
        )}
      </span>
      <ChevronIcon />
    </button>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const { isPremium, isPaid, trialActive, trialDaysLeft, trialAvailable, trialDays, startTrial } =
    usePremiumContext()
  const { account } = useAccountContext()
  const { tasks, importTasks } = useTasksContext()
  const notifications = useNotificationsContext()
  const { theme, setTheme } = useTheme()
  const { workStartMinutes, workEndMinutes, weekStartsOn, setWorkingHours, setWeekStartsOn } = usePreferencesContext()
  const { accent, setAccent, presets } = useAccentContext()
  const { lang: voiceLang, setLang: setVoiceLang } = useVoiceLang()
  const { lang: uiLang, setLang: setUILang, t, options: uiLangOptions } = useUILangContext()
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
        <h1 className="page-header__title">{t('settingsTitle')}</h1>
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
          <LockIcon width={13} height={13} /> {t('trustBadge')}
        </p>

        <div className={`upgrade-banner${isPremium ? ' upgrade-banner--premium' : ''}`}>
          <div>
            <p className="upgrade-banner__title">
              {isPaid
                ? t('premiumLifetime')
                : trialActive
                  ? t('premiumTrialDaysLeft', trialDaysLeft)
                  : trialAvailable
                    ? t('premiumDaysFree', trialDays)
                    : t('onFreePlan')}
            </p>
            <p className="upgrade-banner__subtitle">
              {isPaid
                ? t('paidOncePitch')
                : trialActive
                  ? t('keepEveryFeature')
                  : trialAvailable
                    ? t('noCardNeeded')
                    : t('oneTimeNoSub')}
            </p>
          </div>
          {!isPaid && (
            <button
              type="button"
              className="button button--light"
              onClick={() => (trialAvailable ? startTrial() : navigate('/upgrade'))}
            >
              {trialActive ? t('keep') : trialAvailable ? t('start') : t('upgrade')}
            </button>
          )}
        </div>

        <section className="settings-group">
          <h2 className="section-title">{t('preferences')}</h2>
          <div className="card">
            <div className="settings-row">
              <span>
                {t('inTabReminders')}
                {notifications.inTab.enabled && <span className="settings-row__note">{t('whileAppOpen')}</span>}
              </span>
              <Toggle
                checked={notifications.inTab.enabled}
                onChange={notifications.inTab.setEnabled}
                label={t('inTabReminders')}
              />
            </div>
            {notifications.inTab.permissionDenied && (
              <p className="record-hint" style={{ padding: '0 var(--s1) var(--s3)' }}>
                {t('notificationsBlocked')}
              </p>
            )}
            {notifications.push.supported && (
              <>
                <div className="settings-row">
                  <span>
                    {t('pushNotifications')}
                    {notifications.push.enabled && <span className="settings-row__note">{t('pushNotificationsNote')}</span>}
                  </span>
                  <Toggle
                    checked={notifications.push.enabled}
                    onChange={async (value) => {
                      const result = await notifications.push.setEnabled(value)
                      if (!result.ok && result.message) flashStatus(result.message)
                    }}
                    label={t('pushNotifications')}
                  />
                </div>
                {notifications.push.permissionDenied && (
                  <p className="record-hint" style={{ padding: '0 var(--s1) var(--s3)' }}>
                    {t('notificationsBlocked')}
                  </p>
                )}
              </>
            )}
            <div className="settings-row">
              <span>{t('appearance')}</span>
              <div className="theme-row">
                {[
                  { value: 'system', label: t('auto') },
                  { value: 'light', label: t('light'), icon: <SunIcon width={13} height={13} /> },
                  { value: 'dark', label: t('dark'), icon: <MoonIcon width={13} height={13} /> },
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
            <div className="settings-row settings-row--stacked">
              <span>{t('accentColor')}</span>
              <div className="accent-swatch-row">
                {presets.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    className={`accent-swatch${accent === preset.value ? ' accent-swatch--active' : ''}`}
                    style={{ background: preset.swatch }}
                    onClick={() => setAccent(preset.value)}
                    aria-pressed={accent === preset.value}
                    aria-label={preset.label}
                    title={preset.label}
                  />
                ))}
              </div>
            </div>
            <div className="settings-row">
              <span>{t('appLanguage')}</span>
              <div className="theme-row">
                {uiLangOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`theme-chip${uiLang === option.value ? ' theme-chip--active' : ''}`}
                    onClick={() => setUILang(option.value)}
                    aria-pressed={uiLang === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-row">
              <span>{t('voiceLanguage')}</span>
              <div className="theme-row">
                {VOICE_LANGS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`theme-chip${voiceLang === option.value ? ' theme-chip--active' : ''}`}
                    onClick={() => setVoiceLang(option.value)}
                    aria-pressed={voiceLang === option.value}
                    title={option.hint}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-row">
              <span>Week starts on</span>
              <div className="theme-row">
                {[
                  { value: 0, label: 'Sunday' },
                  { value: 1, label: 'Monday' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`theme-chip${weekStartsOn === option.value ? ' theme-chip--active' : ''}`}
                    onClick={() => setWeekStartsOn(option.value)}
                    aria-pressed={weekStartsOn === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-row settings-row--stacked">
              <span>Working hours</span>
              <p className="settings-row__note">Smart scheduling only suggests times inside this window.</p>
              <div className="working-hours-row">
                <input
                  type="time"
                  className="field__input"
                  value={minutesToTimeInput(workStartMinutes)}
                  onChange={(e) => setWorkingHours(timeInputToMinutes(e.target.value), workEndMinutes)}
                />
                <span>to</span>
                <input
                  type="time"
                  className="field__input"
                  value={minutesToTimeInput(workEndMinutes)}
                  onChange={(e) => setWorkingHours(workStartMinutes, timeInputToMinutes(e.target.value))}
                />
              </div>
            </div>
            <button
              type="button"
              className="settings-row settings-row--link"
              onClick={() => navigate('/voice-test')}
            >
              <span>{t('testTheMic')}</span>
              <ChevronIcon />
            </button>
            <div className="settings-row">
              <span>{t('calendarSync')}</span>
              <Toggle checked={calendarSync} onChange={setCalendarSync} label={t('calendarSync')} />
            </div>
          </div>
        </section>

        <section className="settings-group">
          <h2 className="section-title">{t('insights')}</h2>
          <div className="card">
            <PremiumRow
              isPremium={isPremium}
              label={t('productivityReport')}
              onClick={() => (isPremium ? navigate('/stats') : navigate('/upgrade'))}
            />
            <PremiumRow
              isPremium={isPremium}
              label="Weekly review"
              onClick={() => (isPremium ? navigate('/review') : navigate('/upgrade'))}
            />
            <PremiumRow
              isPremium={isPremium}
              label="Habit tracking"
              onClick={() => (isPremium ? navigate('/habits') : navigate('/upgrade'))}
            />
            <PremiumRow
              isPremium={isPremium}
              label={t('taskTemplates')}
              onClick={() => (isPremium ? navigate('/templates') : navigate('/upgrade'))}
            />
            <PremiumRow
              isPremium={isPremium}
              label={t('filters')}
              onClick={() => (isPremium ? navigate('/filters') : navigate('/upgrade'))}
            />
            <PremiumRow
              isPremium={isPremium}
              label="Manage labels"
              onClick={() => (isPremium ? navigate('/labels') : navigate('/upgrade'))}
            />
          </div>
        </section>

        <section className="settings-group">
          <h2 className="section-title">{t('planAhead')}</h2>
          <div className="card">
            <PremiumRow
              isPremium={isPremium}
              label={t('upcoming7Days')}
              onClick={() => (isPremium ? navigate('/upcoming') : navigate('/upgrade'))}
            />
            <PremiumRow
              isPremium={isPremium}
              label={t('focusTimer')}
              onClick={() => (isPremium ? navigate('/focus') : navigate('/upgrade'))}
            />
            <PremiumRow
              isPremium={isPremium}
              label="Board"
              onClick={() => (isPremium ? navigate('/board') : navigate('/upgrade'))}
            />
            <PremiumRow
              isPremium={isPremium}
              label="Timeline"
              onClick={() => (isPremium ? navigate('/timeline') : navigate('/upgrade'))}
            />
          </div>
        </section>

        <section className="settings-group">
          <h2 className="section-title">{t('data')}</h2>
          <div className="card">
            <PremiumRow
              isPremium={isPremium}
              label={t('exportCalendar')}
              onClick={() => (isPremium ? downloadICS(tasks) : navigate('/upgrade'))}
            />
            <PremiumRow isPremium={isPremium} label={t('backupTasks')} onClick={handleBackup} />
            <PremiumRow isPremium={isPremium} label={t('restoreBackup')} onClick={handleRestoreClick} />
            <PremiumRow isPremium={isPremium} label={t('shareToday')} onClick={handleShareToday} />
            <PremiumRow
              isPremium={isPremium}
              label={t('syncDevices')}
              onClick={() => (isPremium ? navigate('/sync') : navigate('/upgrade'))}
            />
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
          <h2 className="section-title">{t('general')}</h2>
          <div className="card">
            <button type="button" className="settings-row settings-row--link" onClick={() => navigate('/account')}>
              <span>{t('accountSettings')}</span>
              <ChevronIcon />
            </button>
            <button type="button" className="settings-row settings-row--link" onClick={() => navigate('/privacy')}>
              <span>{t('privacyPolicy')}</span>
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
