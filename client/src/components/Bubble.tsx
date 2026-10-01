// One chat bubble, shared by the tile grid and the inbox view. The customer's own messages
// sit on the right, Comdove's on the left with ticks (PRD §7).
import { useState } from 'react'
import { hhmm } from '../lib/format'
import type { UiMessage } from '../session/reducer'
import type { Interactive } from '../types'
import styles from './Tile.module.css'

export interface BubbleProps {
  m: UiMessage
  own: boolean
  /** Business number above Comdove's messages: which number wrote this. */
  sender: string | null
  onRetry(m: UiMessage): void
  /**
   * WS-357: the tester picked an option on an interactive menu. Left out in read-only
   * views (the group feed), where the options are shown but cannot be tapped.
   */
  onSelect?(wamid: string, optionId: string): Promise<void>
}

export default function Bubble({ m, own, sender, onRetry, onSelect }: BubbleProps) {
  const failed = m.pending === 'failed'
  return (
    <div className={`${styles.row} ${own ? styles.rowRight : styles.rowLeft}`}>
      <div
        className={`${styles.bubble} ${own ? styles.customer : styles.comdove} ${failed ? styles.failed : ''}`}
        data-testid={`msg-${m.wamid}`}
        data-status={m.status}
      >
        {!own && sender && <div className={`${styles.sender} mono`}>{sender}</div>}
        {/* A menu carries its own body text, so showing m.body too would print it twice. */}
        {m.interactive ? <Menu menu={m.interactive} wamid={m.wamid} onSelect={onSelect} /> : <div>{m.body}</div>}
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

// WhatsApp hides a list behind a button and stacks reply buttons under the text. Here every
// option is drawn inline instead: a tester has to see and tap them without a second step,
// and seeing all ten rows at once is the point of the screen.
function Menu({
  menu,
  wamid,
  onSelect,
}: {
  menu: Interactive
  wamid: string
  onSelect?: (wamid: string, optionId: string) => Promise<void>
}) {
  // The id being sent, so a double-tap can't send the same choice twice.
  const [busy, setBusy] = useState<string | null>(null)
  const readOnly = !onSelect

  const pick = async (id: string) => {
    if (!onSelect || busy) return
    setBusy(id)
    try {
      await onSelect(wamid, id)
    } finally {
      setBusy(null)
    }
  }

  const option = (o: { id: string; title: string; description?: string }) => (
    <button
      key={o.id}
      type="button"
      className={styles.menuOption}
      data-testid={`option-${o.id}`}
      data-option-id={o.id}
      disabled={readOnly || busy !== null}
      title={readOnly ? 'Read-only view' : `Reply with "${o.title}" (id: ${o.id})`}
      onClick={(e) => {
        e.stopPropagation()
        void pick(o.id)
      }}
    >
      <span className={styles.menuOptionTitle}>{o.title}</span>
      {o.description && <span className={styles.menuOptionDesc}>{o.description}</span>}
    </button>
  )

  return (
    <div className={styles.menu} data-testid={`menu-${wamid}`} data-kind={menu.kind}>
      {menu.header && <div className={styles.menuHeader}>{menu.header}</div>}
      <div className={styles.menuBody}>{menu.body}</div>

      {menu.kind === 'list'
        ? menu.sections.map((section, i) => (
            <div key={i} className={styles.menuSection}>
              {section.title && <div className={`${styles.menuSectionTitle} mono`}>{section.title}</div>}
              {section.rows.map(option)}
            </div>
          ))
        : <div className={styles.menuSection}>{menu.buttons.map(option)}</div>}

      {menu.footer && <div className={styles.menuFooter}>{menu.footer}</div>}
      <div className={`${styles.menuKind} mono`}>
        {menu.kind === 'list' ? `list · ${menu.button}` : 'reply buttons'}
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
