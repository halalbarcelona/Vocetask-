import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { TasksProvider } from './hooks/TasksContext'
import { PremiumProvider, usePremiumContext } from './hooks/PremiumContext'
import { AccountProvider, useAccountContext } from './hooks/AccountContext'
import { CategoriesProvider } from './hooks/CategoriesContext'
import { LabelsProvider } from './hooks/LabelsContext'
import { FiltersProvider } from './hooks/FiltersContext'
import { AccentProvider } from './hooks/AccentContext'
import { SyncProvider } from './hooks/SyncContext'
import { NotificationsProvider } from './hooks/NotificationsContext'
import { UILangProvider } from './hooks/UILangContext'
import { CommandPaletteProvider } from './hooks/CommandPaletteContext'
import { PreferencesProvider } from './hooks/PreferencesContext'
import CommandPalette from './components/CommandPalette'
import UpdatePrompt from './components/UpdatePrompt'
import Home from './pages/Home'
import Record from './pages/Record'
import Confirm from './pages/Confirm'
import Calendar from './pages/Calendar'
import Settings from './pages/Settings'
import Upgrade from './pages/Upgrade'
import UpgradeSuccess from './pages/UpgradeSuccess'
import CreateAccount from './pages/CreateAccount'
import AccountSettings from './pages/AccountSettings'
import Privacy from './pages/Privacy'
import Stats from './pages/Stats'
import Habits from './pages/Habits'
import Board from './pages/Board'
import Review from './pages/Review'
import Templates from './pages/Templates'
import TrialEnded from './pages/TrialEnded'
import VoiceTest from './pages/VoiceTest'
import Filters from './pages/Filters'
import ShareTarget from './pages/ShareTarget'
import Upcoming from './pages/Upcoming'
import Timeline from './pages/Timeline'
import Labels from './pages/Labels'
import Focus from './pages/Focus'
import Sync from './pages/Sync'
import QuickAction from './pages/QuickAction'

function RequireAccount() {
  const { hasAccount } = useAccountContext()
  if (!hasAccount) return <Navigate to="/create-account" replace />
  return <Outlet />
}

// Checks the backend once per account so a premium purchase made on another
// device (or verified after a webhook delay) is picked up here too.
function PremiumBackendSync() {
  const { account } = useAccountContext()
  const { syncFromBackend } = usePremiumContext()

  useEffect(() => {
    if (account?.email) syncFromBackend(account.email)
  }, [account?.email, syncFromBackend])

  return null
}

// A notification's action button posts here (see src/sw.js) when a tab is
// already open and gets focused rather than a new one being opened — the
// same /quick-action route the fresh-tab case navigates to, so both paths
// share one implementation of what "Mark done" / "Snooze 10m" actually do.
function QuickActionListener() {
  const navigate = useNavigate()

  useEffect(() => {
    const onMessage = (event) => {
      if (event.data?.type !== 'QUICK_ACTION' || !event.data.taskId) return
      navigate(`/quick-action?task=${encodeURIComponent(event.data.taskId)}&action=${event.data.action}`)
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage)
  }, [navigate])

  return null
}

export default function App() {
  return (
    <>
    <UpdatePrompt />
    <QuickActionListener />
    <UILangProvider>
    <PreferencesProvider>
    <AccountProvider>
      <AccentProvider>
        <PremiumProvider>
          <PremiumBackendSync />
          <SyncProvider>
            <TasksProvider>
              <NotificationsProvider>
              <CategoriesProvider>
                <LabelsProvider>
                  <FiltersProvider>
                    <Routes>
                      <Route path="/create-account" element={<CreateAccount />} />
                      <Route element={<RequireAccount />}>
                        <Route
                          element={
                            <CommandPaletteProvider>
                              <CommandPalette />
                              <Outlet />
                            </CommandPaletteProvider>
                          }
                        >
                        <Route path="/" element={<Home />} />
                        <Route path="/record" element={<Record />} />
                        <Route path="/confirm" element={<Confirm />} />
                        <Route path="/calendar" element={<Calendar />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/account" element={<AccountSettings />} />
                        <Route path="/privacy" element={<Privacy />} />
                        <Route path="/upgrade" element={<Upgrade />} />
                        <Route path="/upgrade-success" element={<UpgradeSuccess />} />
                        <Route path="/stats" element={<Stats />} />
                        <Route path="/habits" element={<Habits />} />
                        <Route path="/board" element={<Board />} />
                        <Route path="/review" element={<Review />} />
                        <Route path="/templates" element={<Templates />} />
                        <Route path="/trial-ended" element={<TrialEnded />} />
                        <Route path="/voice-test" element={<VoiceTest />} />
                        <Route path="/filters" element={<Filters />} />
                        <Route path="/share-target" element={<ShareTarget />} />
                        <Route path="/upcoming" element={<Upcoming />} />
                        <Route path="/timeline" element={<Timeline />} />
                        <Route path="/labels" element={<Labels />} />
                        <Route path="/focus" element={<Focus />} />
                        <Route path="/sync" element={<Sync />} />
                        <Route path="/quick-action" element={<QuickAction />} />
                        </Route>
                      </Route>
                    </Routes>
                  </FiltersProvider>
                </LabelsProvider>
              </CategoriesProvider>
              </NotificationsProvider>
            </TasksProvider>
          </SyncProvider>
        </PremiumProvider>
      </AccentProvider>
    </AccountProvider>
    </PreferencesProvider>
    </UILangProvider>
    </>
  )
}
