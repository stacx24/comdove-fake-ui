// One chat bubble, shared by the tile grid and the inbox view. The customer's own messages
// sit on the right, Comdove's on the left with ticks (PRD §7).
import { hhmm } from '../lib/format'
import type { UiMessage } from '../session/reducer'
import styles from './Tile.module.css'

export interface BubbleProps {
  m: UiMessage
  own: boolean
  /** Business number above Comdove's messages: which number wrote this. */
  sender: string | null
  onRetry(m: UiMessage): void
}

export default function Bubble({ m, own, sender, onRetry }: BubbleProps) {
  const failed = m.pending === 'failed'
  return (
    <div className={`${styles.row} ${own ? styles.rowRight : styles.rowLeft}`}>
      <div
        className={`${styles.bubble} ${own ? styles.customer : styles.comdove} ${failed ? styles.failed : ''}`}
        data-testid={`msg-${m.wamid}`}
        data-status={m.status}
      >
        {!own && sender && <div className={`${styles.sender} mono`}>{sender}</div>}
        <div>{m.body}</div>
        <div className={`${styles.meta} mono`}>
          {failed ? (
            <>
              <span className={styles.notSent}>Not sent ·</span>
              <button
                type="button"
                className={styles.retry}
                data-testid={`retry-${m.localId}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onRetry(m)
                }}
              >
                Retry
              </button>
            </>
          ) : (
            <>
              <span>{hhmm(m.timestamp)}</span>
              <Ticks m={m} own={own} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Comdove's messages: ✓ sent, ✓✓ delivered, blue ✓✓ read. The customer's own: only blue ✓✓ once read.
function Ticks({ m, own }: { m: UiMessage; own: boolean }) {
  if (own) return m.status === 'read' ? <span className={styles.tickRead} title="Read by Comdove">✓✓</span> : null
  if (m.status === 'read') return <span className={styles.tickRead} title="Read">✓✓</span>
  if (m.status === 'delivered') return <span className={styles.tick} title="Delivered">✓✓</span>
  if (m.status === 'sent') return <span className={styles.tick} title="Sent">✓</span>
  return null
}
