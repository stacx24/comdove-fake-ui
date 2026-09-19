import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import Shell from './components/Shell'
import TopBar from './components/TopBar'
import Admin from './pages/Admin'
import ClientGrid from './pages/ClientGrid'
import Launch from './pages/Launch'

// /client shows the launch page; /client?group=alpha opens that group directly.
function ClientRoute() {
  const [params] = useSearchParams()
  return params.get('group') ? <ClientGrid /> : <Launch />
}

export default function App() {
  return (
    <Shell>
    <div className="app">
      <TopBar />
      <Routes>
        <Route path="/" element={<Navigate to="/client" replace />} />
        <Route path="/client" element={<ClientRoute />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Shell>
    </div>
  )
}
