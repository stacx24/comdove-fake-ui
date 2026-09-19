// Tile grid for one group, opened via /client?group=name (FR-14, FR-16).
import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Tile from '../components/Tile'
import type { ConnectionState } from '../data'
import { onlineCount, totalQueued } from '../session/reducer'
import { useGroupSession } from '../session/useGroupSession'
import type { LaunchState } from './Launch'
import styles from './ClientGrid.module.css'

const CONNECTION: Record<ConnectionState, { text: string; tone: 'green' | 'amber' | 'grey' }> = {
  mock: { text: 'Mock data', tone: 'amber' },
  connecting: { text: 'Connecting…', tone: 'grey' },
  open: { text: 'WebSocket connected', tone: 'green' },
  reconnecting: { text: 'Reconnecting…', tone: 'amber' },
  closed: { text: 'Disconnected', tone: 'grey' },
}

export default function ClientGrid() {
  const [params] = useSearchParams()
  const group = params.get('group') ?? ''
  // A new key per group gives each group a fresh session.
  return <GroupView key={group} group={group} />
}

function GroupView({ group }: { group: string }) {
  const navigate = useNavigate()
  const { state, check, checkError, businessNumbers, autoReply, paused, actions, recheck } = useGroupSession(group)
  const back = () => navigate('/client')

  // Claim refused: back to the launch page, which shows the notice (Tech Spec §7).
  useEffect(() => {
    if (state.phase === 'locked') {
      const refused: LaunchState = { refused: group }
      navigate('/client', { replace: true, state: refused })
    }
  }, [state.phase, group, navigate])

  if (check === 'not-found') {
    return (
      <div className={styles.message} data-testid="group-not-found">
        <span>
          No group called <span className="mono">{group}</span>.
        </span>
        <button type="button" className={styles.button} data-testid="back-to-groups" onClick={back}>
          ← Groups
        </button>
      </div>
    )
  }

  if (check === 'error') {
    return (
      <div className={styles.message}>
        <span className={styles.error}>{checkError}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className={styles.button} data-testid="back-to-groups" onClick={back}>
            ← Groups
          </button>
          <button type="button" className={styles.button} data-testid="group-retry" onClick={recheck}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  const ready = state.phase === 'ready'
  const connection = CONNECTION[state.connection]
  const tiles = state.order.map((n) => state.tiles[n])

  return (
    <div className={styles.page} data-testid="client-grid">
      <div className={styles.subheader}>
        <button type="button" className={styles.back} data-testid="back-to-groups" onClick={back}>
          ← Groups
        </button>
        <div className={styles.name}>{group}</div>
        <div className={`${styles.url} mono`}>/client?group={group}</div>

        <div className={styles.stats}>
          <div className={styles.connection} data-testid="connection-state">
            <span className={`${styles.dot} ${styles[connection.tone]}`} />
            <span className={styles.connectionText}>{connection.text}</span>
          </div>
          {ready && (
            <>
              <div data-testid="online-count">
                <span className={`${styles.num} mono`}>
                  {onlineCount(state)}/{tiles.length}
                </span>{' '}
                tiles online
              </div>
              <div data-testid="queued-count">
                <span className={`${styles.num} mono`}>{totalQueued(state)}</span> queued
              </div>
            </>
          )}
        </div>
      </div>

      <div className={styles.scroll}>
        <div className={styles.grid}>
          {ready
            ? tiles.map((tile) => (
                <Tile
                  key={tile.number}
                  tile={tile}
                  businessNumbers={businessNumbers}
                  actions={actions}
                  autoReply={autoReply[tile.number]}
                  paused={!!paused[tile.number]}
                />
              ))
            : Array.from({ length: 6 }, (_, i) => <div key={i} className={styles.skeleton} aria-hidden="true" />)}
        </div>
      </div>
    </div>
  )
}
