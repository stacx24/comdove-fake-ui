// App frame: the 48px top bar with navigation, server label and webhook label.
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import styles from './Shell.module.css'

const NAV = [
  { id: 'client', label: 'Client', path: '/client' },
  { id: 'admin', label: 'Admin', path: '/admin' },
]

const isMock = import.meta.env.VITE_DATA_SOURCE !== 'server'
const webhookUrl = import.meta.env.VITE_WEBHOOK_URL

export default function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <div className={styles.brand}>
          <div className={styles.logo}>M</div>
          <div className={styles.name}>comdove-mock</div>
          <div className={`${styles.server} mono`}>{__MOCK_SERVER_URL__}</div>
        </div>

        <nav className={styles.nav}>
          {NAV.map((item) => {
            const active = pathname.startsWith(item.path)
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`nav-${item.id}`}
                aria-current={active ? 'page' : undefined}
                className={`${styles.navItem} ${active ? styles.active : ''}`}
                onClick={() => navigate(item.path)}
              >
                <span>{item.label}</span>
                <span className={`${styles.path} mono`}>{item.path}</span>
              </button>
            )
          })}
        </nav>

        <div className={styles.right}>
          {isMock && (
            <span className={styles.mockPill} data-testid="mock-data-pill">
              Mock data
            </span>
          )}
          {webhookUrl && (
            <div className={styles.webhook}>
              <span className={styles.dot} />
              <span>webhook →</span>
              <span className={`${styles.webhookUrl} mono`}>{webhookUrl}</span>
            </div>
          )}
        </div>
      </header>

      <main className={styles.main}>{children}</main>
    </div>
  )
}
