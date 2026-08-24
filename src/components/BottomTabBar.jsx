import { NavLink } from 'react-router-dom'
import { HomeIcon, CalendarIcon, SettingsIcon } from './icons'
import { useUILangContext } from '../hooks/UILangContext'

export default function BottomTabBar() {
  const { t } = useUILangContext()
  const TABS = [
    { to: '/', label: t('navHome'), Icon: HomeIcon, end: true },
    { to: '/calendar', label: t('navCalendar'), Icon: CalendarIcon, end: false },
    { to: '/settings', label: t('navSettings'), Icon: SettingsIcon, end: false },
  ]
  return (
    <nav className="tab-bar">
      {TABS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `tab-bar__item${isActive ? ' tab-bar__item--active' : ''}`}
        >
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
