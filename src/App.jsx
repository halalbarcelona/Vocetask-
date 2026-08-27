import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { TasksProvider } from './hooks/TasksContext'
import { PremiumProvider, usePremiumContext } from './hooks/PremiumContext'
import { AccountProvider, useAccountContext } from './hooks/AccountContext'
import { CategoriesProvider } from './hooks/CategoriesContext'
import { LabelsProvider } from './hooks/LabelsContext'
import { FiltersProvider } from './hooks/FiltersContext'
import { AccentProvider } from './hooks/AccentContext'
import { SyncProvider } from './hooks/SyncContext'
import { UILangProvider } from './hooks/UILangContext'
import { CommandPaletteProvider } from './hooks/CommandPaletteContext'
import CommandPalette from './components/CommandPalette'
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
import Templates from './pages/Templates'
import TrialEnded from './pages/TrialEnded'
import VoiceTest from './pages/VoiceTest'
import Filters from './pages/Filters'
import ShareTarget from './pages/ShareTarget'
import Upcoming from './pages/Upcoming'
import Focus from './pages/Focus'
import Sync from './pages/Sync'

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

export default function App() {
  return (
    <UILangProvider>
    <AccountProvider>
      <AccentProvider>
        <PremiumProvider>
          <PremiumBackendSync />
          <SyncProvider>
            <TasksProvider>
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
                        <Route path="/templates" element={<Templates />} />
                        <Route path="/trial-ended" element={<TrialEnded />} />
                        <Route path="/voice-test" element={<VoiceTest />} />
                        <Route path="/filters" element={<Filters />} />
                        <Route path="/share-target" element={<ShareTarget />} />
                        <Route path="/upcoming" element={<Upcoming />} />
                        <Route path="/focus" element={<Focus />} />
                        <Route path="/sync" element={<Sync />} />
                        </Route>
                      </Route>
                    </Routes>
                  </FiltersProvider>
                </LabelsProvider>
              </CategoriesProvider>
            </TasksProvider>
          </SyncProvider>
        </PremiumProvider>
      </AccentProvider>
    </AccountProvider>
    </UILangProvider>
  )
}
