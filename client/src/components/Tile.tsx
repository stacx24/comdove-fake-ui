// One customer number. WhatsApp-style (PRD §7): the customer's own messages on the right (outgoing),
// Comdove's messages on the left (incoming) with ticks. Header with online toggle, badges and gear.
import { memo, useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
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

function Tile({ tile, businessNumbers, actions, autoReply, paused }: TileProps) {
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
    <section className={`${styles.tile} ${tile.online ? styles.online : ''}`} data-testid={`tile-${n}`}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.presence}
          data-testid={`presence-${n}`}
          title={tile.online ? 'Online — click to go offline' : 'Offline — click to go online'}
          aria-pressed={tile.online}
          onClick={() => actions.setPresence(n, !tile.online)}
        >
          <span className={styles.presenceDot} />
        </button>
        <div className={`${styles.number} mono`}>{plus(n)}</div>
        {unreadCount > 0 && (
          <div className={`${styles.unread} mono`} data-testid={`unread-${n}`} title="Unread">
            {unreadCount}
          </div>
        )}
        {tile.queued.length > 0 && (
          <div className={styles.queued} data-testid={`queued-${n}`}>
            {tile.queued.length} queued
          </div>
        )}
        <div
          className={`${styles.mode} ${autoReply.mode !== 'manual' ? styles.modeAuto : ''}`}
          data-testid={`mode-${n}`}
        >
          {autoReply.mode}
        </div>
        <button
          ref={gearRef}
          type="button"
          className={`${styles.gear} ${settingsOpen ? styles.gearOpen : ''}`}
          data-testid={`autoreply-${n}`}
          title="Auto-reply mode"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((o) => !o)}
        >
          ⚙
        </button>
      </header>

      {settingsOpen && (
        <AutoReplyPopover
          number={n}
          config={autoReply}
          onChange={(c) => actions.setAutoReply(n, c)}
          onClose={closeSettings}
          anchor={gearRef}
        />
      )}

      <div
        ref={chatRef}
        className={styles.chat}
        data-testid={`chat-${n}`}
        onScroll={onScroll}
        onClick={() => unreadCount > 0 && markRead()}
      >
        {tile.history.length === 0 ? (
          <div className={styles.empty}>No messages yet</div>
        ) : (
          tile.history.map((m) => (
            <Bubble key={m.wamid} m={m} own={m.from === n} sender={multiPeer ? label(m.from) : null} onRetry={actions.retry} />
          ))
        )}
      </div>

      {paused && (
        <div className={styles.paused} data-testid={`autoreply-paused-${n}`}>
          Auto-reply paused (loop guard)
        </div>
      )}

      <div className={styles.composer}>
        <div className={styles.sendRow}>
          <input
            className={styles.input}
            data-testid={`input-${n}`}
            placeholder={tile.online ? 'Message as customer…' : 'Offline'}
            value={draft}
            disabled={!tile.online}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            onFocus={() => unreadCount > 0 && markRead()}
          />
          <button type="button" className={styles.send} data-testid={`send-${n}`} disabled={!canSend} onClick={send}>
            Send
          </button>
        </div>
      </div>
    </section>
  )
}

// A group holds up to 100 tiles (WS-343) and one status frame changes one tile, so the
// other 99 must not re-render: every prop above is stable between that tile's own updates.
export default memo(Tile)

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
