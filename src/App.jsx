import { Route, Routes } from 'react-router-dom'
import { TasksProvider } from './hooks/TasksContext'
import Home from './pages/Home'
import Record from './pages/Record'
import Confirm from './pages/Confirm'
import Calendar from './pages/Calendar'
import Settings from './pages/Settings'

export default function App() {
  return (
    <TasksProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/record" element={<Record />} />
        <Route path="/confirm" element={<Confirm />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </TasksProvider>
  )
}
