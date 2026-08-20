import { Route, Routes } from 'react-router-dom'
import { TasksProvider } from './hooks/TasksContext'
import { PremiumProvider } from './hooks/PremiumContext'
import Home from './pages/Home'
import Record from './pages/Record'
import Confirm from './pages/Confirm'
import Calendar from './pages/Calendar'
import Settings from './pages/Settings'
import Upgrade from './pages/Upgrade'
import UpgradeSuccess from './pages/UpgradeSuccess'

export default function App() {
  return (
    <PremiumProvider>
      <TasksProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/record" element={<Record />} />
          <Route path="/confirm" element={<Confirm />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/upgrade" element={<Upgrade />} />
          <Route path="/upgrade-success" element={<UpgradeSuccess />} />
        </Routes>
      </TasksProvider>
    </PremiumProvider>
  )
}
