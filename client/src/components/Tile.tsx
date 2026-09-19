// One customer number. Bubble sides follow the Comdove Mock UI design: the customer's own messages
// on the left, Comdove's messages on the right with ticks. Header with online toggle, badges and gear.
import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { businessLabel, hhmm, plus } from '../lib/format'
import { lastSender, peers, unread, unreadMessages, type UiMessage, type UiTile } from '../session/reducer'
import type { TileActions } from '../session/useGroupSession'
import type { AutoReplyConfig, BusinessNumber } from '../types'
import AutoReplyPopover from './AutoReplyPopover'
import styles from './Tile.module.css'

export interface TileProps {
  tile: UiTile
  businessNumbers: BusinessNumber[]
  actions: TileActions
  autoReply: AutoReplyConfig
  /** Auto-reply hit the loop guard. */
  paused: boolean
}

// Only auto-scroll when the tester is already reading the latest messages.
const NEAR_BOTTOM_PX = 40

export default function Tile({ tile, businessNumbers, actions, autoReply, paused }: TileProps) {
  const n = tile.number
  const tilePeers = peers(tile)
  const unreadCount = unread(tile)
  const multiPeer = tilePeers.length > 1

  // Reply target (no picker, as in the design): whoever wrote to this tile last, else the last
  // business number it talked to, else the first registered one for an empty chat.
  const target = lastSender(tile) ?? tilePeers[0] ?? businessNumbers[0]?.display_number

  const [settingsOpen, setSettingsOpen] = useState(false)
  const gearRef = useRef<HTMLButtonElement>(null)
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  const [draft, setDraft] = useState('')
  // As in the design, Send only dims when the tile can't send at all; empty text is just ignored.
  const canSend = tile.online && !!target

  const label = (number: string) => businessLabel(number, businessNumbers) ?? plus(number)

  const send = () => {
    const body = draft.trim()
    if (!body || !tile.online || !target) return
    actions.send(n, target, body)
    setDraft('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') send()
  }

  // "Read when the chat is opened" (FR-06): here, when the tester engages with the tile.
  const markRead = () => {
    const from = new Set(unreadMessages(tile).map((m) => m.from))
    for (const peer of from) actions.markRead(n, peer)
  }

  // Keep the view pinned to the bottom when new messages arrive, unless the tester scrolled up.
  const chatRef = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  useLayoutEffect(() => {
    const el = chatRef.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [tile.history.length])
  const onScroll = () => {
    const el = chatRef.current
    if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
  }

  return (
    <section data-testid={`tile-${number}`}>
      <h2>{number}</h2>
      <h2>whyy</h2>
    </section>
    
  )
}

interface BubbleProps {
  m: UiMessage
  own: boolean
  /** Business label above Comdove's messages, only when the tile talks to more than one. */
  sender: string | null
  onRetry(m: UiMessage): void
}

function Bubble({ m, own, sender, onRetry }: BubbleProps) {
  const failed = m.pending === 'failed'
  return (
    <div className={`${styles.row} ${own ? styles.rowLeft : styles.rowRight}`}>
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
