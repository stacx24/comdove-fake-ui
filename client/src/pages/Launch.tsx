// Launch page: lists groups with free/locked status (FR-09, FR-16).
import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { data } from '../data'
import type { Group } from '../types'
import styles from './Launch.module.css'

const REFRESH_MS = 5000

// Set by the grid when it sends the tester back from a locked group.
export interface LaunchState {
  refused?: string
}

export default function Launch() {
  const location = useLocation()
  const navigate = useNavigate()

  const [groups, setGroups] = useState<Group[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refused, setRefused] = useState<string | null>(
    () => (location.state as LaunchState | null)?.refused ?? null,
  )

  // Browsers keep history state across a reload; clear it so the notice shows only once.
  useEffect(() => {
    if ((location.state as LaunchState | null)?.refused) {
      navigate(location.pathname + location.search, { replace: true, state: null })
    }
  }, [location, navigate])

  const load = useCallback(() => {
    data.listGroups().then(
      (list) => {
        setGroups(list)
        setError(null)
      },
      (err: unknown) => setError(err instanceof Error ? err.message : String(err)),
    )
  }, [])

  // Locks change when another tester opens or closes a tab: refetch every 5s and on focus.
  useEffect(() => {
    load()
    const timer = setInterval(load, REFRESH_MS)
    window.addEventListener('focus', load)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', load)
    }
  }, [load])

  const retry = () => {
    setError(null)
    setGroups(null)
    load()
  }

  return (
    <div className={styles.page} data-testid="launch-page">
      <div className={styles.column}>
        <h1 className={styles.title}>Client groups</h1>
        <p className={styles.subtitle}>
          Pick a free group. One browser session per group; the lock releases when the tab closes.
        </p>

        {refused && (
          <div className={styles.notice} role="status" data-testid="refused-notice">
            <span className={styles.noticeText}>
              <span className="mono">{refused}</span> is open in another session.
            </span>
            <button
              type="button"
              className={styles.dismiss}
              data-testid="refused-dismiss"
              aria-label="Dismiss"
              onClick={() => setRefused(null)}
            >
              ✕
            </button>
          </div>
        )}

        <div className={styles.card}>
          {error && !groups ? (
            <div className={`${styles.message} ${styles.error}`} data-testid="groups-error">
              <span>{error}</span>
              <button type="button" className={styles.retry} data-testid="groups-retry" onClick={retry}>
                Retry
              </button>
            </div>
          ) : groups === null ? (
            Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={styles.skeleton} aria-hidden="true">
                <div className={styles.bone} />
              </div>
            ))
          ) : groups.length === 0 ? (
            <div className={styles.message} data-testid="groups-empty">
              <span>No groups yet — create one from Admin.</span>
              <Link to="/admin">Go to Admin</Link>
            </div>
          ) : (
            groups.map((g) => (
              <button
                key={g.name}
                type="button"
                className={styles.row}
                data-testid={`group-${g.name}`}
                disabled={g.locked}
                title={g.locked ? 'Open in another session' : undefined}
                onClick={() => navigate(`/client?group=${encodeURIComponent(g.name)}`)}
              >
                <div className={styles.nameBlock}>
                  <span className={styles.name}>{g.name}</span>
                  <span className={`${styles.url} mono`}>/client?group={g.name}</span>
                </div>
                <span className={`${styles.count} mono`}>{g.numbers.length} numbers</span>
                <span className={`${styles.pill} ${g.locked ? '' : styles.free}`}>
                  <span className={styles.pillDot} />
                  <span>{g.locked ? 'locked' : 'free'}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
