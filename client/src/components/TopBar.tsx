// Top bar shared by Client and Admin (design: "Top bar").
import { NavLink } from 'react-router-dom'
import { webhookUrl } from '../api'

const serverHost = __MOCK_SERVER_URL__.replace(/^https?:\/\//, '')

const links = [
  { id: 'client', label: 'Client', path: '/client' },
  { id: 'admin', label: 'Admin', path: '/admin' },
]

export default function TopBar() {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-logo">M</div>
        <div className="brand-name">comdove-mock</div>
        <div className="brand-server">{serverHost}</div>
      </div>

      <nav className="nav">
        {links.map((link) => (
          <NavLink
            key={link.id}
            to={link.path}
            data-testid={`nav-${link.id}`}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span>{link.label}</span>
            <span className="nav-path">{link.path}</span>
          </NavLink>
        ))}
      </nav>

      {/* Grey = not checked: the server does not report the webhook handshake yet (plan §3.0). */}
      <div className="webhook-status" data-testid="webhook-status" title="Webhook handshake not checked yet">
        <span className="dot" style={{ background: 'var(--faint)' }} />
        <span>webhook →</span>
        <span className="mono" style={{ color: 'var(--text-2)' }}>
          {webhookUrl.replace(/^https?:\/\//, '')}
        </span>
      </div>
    </header>
  )
}
