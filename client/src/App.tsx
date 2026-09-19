import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
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
    <Routes>
      <Route path="/" element={<Navigate to="/client" replace />} />
      <Route path="/client" element={<ClientRoute />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  )
}
