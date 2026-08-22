import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { TasksProvider } from './hooks/TasksContext'
import { PremiumProvider, usePremiumContext } from './hooks/PremiumContext'
import { AccountProvider, useAccountContext } from './hooks/AccountContext'
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
    <AccountProvider>
      <PremiumProvider>
        <PremiumBackendSync />
        <TasksProvider>
          <Routes>
            <Route path="/create-account" element={<CreateAccount />} />
            <Route element={<RequireAccount />}>
              <Route path="/" element={<Home />} />
              <Route path="/record" element={<Record />} />
              <Route path="/confirm" element={<Confirm />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/account" element={<AccountSettings />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/upgrade" element={<Upgrade />} />
              <Route path="/upgrade-success" element={<UpgradeSuccess />} />
            </Route>
          </Routes>
        </TasksProvider>
      </PremiumProvider>
    </AccountProvider>
  )
}
