// The client tab, laid out like WhatsApp Web: a narrow sidebar on the left, the open
// conversation filling the rest.
//
//   sidebar  = the group's customer numbers → pick one → that phone's own chats
//   pane     = a splash until a chat is open, then the conversation
//
// It is the CUSTOMER's point of view: which phone am I, and what does it see?
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { data } from '../data'
import { GROUP_CHAT } from '../lib/chats'
import { businessLabel, hhmm, plus } from '../lib/format'
import { peers, unread, unreadMessages, type UiTile } from '../session/reducer'
import type { TileActions } from '../session/useGroupSession'
import type { AutoReplyConfig, BusinessNumber, Group } from '../types'
import { PhoneChat, PhoneChatList } from './PhoneView'
import styles from './Inbox.module.css'

export interface InboxProps {
  tiles: UiTile[]
  businessNumbers: BusinessNumber[]
  actions: TileActions
  autoReply: Record<string, AutoReplyConfig>
  paused: Record<string, boolean>
  currentGroup: string
  onSwitchGroup(groupId: string): void
}

const GROUPS_REFRESH_MS = 5000
const lastMessage = (tile: UiTile) => tile.history[tile.history.length - 1]

export default function Inbox({
  tiles,
  businessNumbers,
  actions,
  autoReply,
  paused,
  currentGroup,
  onSwitchGroup,
}: InboxProps) {
  /** The phone whose chats are open; null = the number list. */
  const [phone, setPhone] = useState<string | null>(null)
  /** Which of that phone's chats is open: the group, or a business number. */
  const [openChat, setOpenChat] = useState<string>(GROUP_CHAT)
  const [search, setSearch] = useState('')
  const [infoFor, setInfoFor] = useState<string | null>(null)

  // Busiest first, like a real inbox; numbers with no messages keep their tile order.
  const ordered = useMemo(() => {
    const withTime = tiles.map((t, i) => ({ t, i, at: lastMessage(t)?.timestamp ?? 0 }))
    withTime.sort((a, b) => (b.at !== a.at ? b.at - a.at : a.i - b.i))
    return withTime.map((x) => x.t)
  }, [tiles])

  const filtered = useMemo(() => {
    const q = search.trim()
    return q ? ordered.filter((t) => t.number.includes(q)) : ordered
  }, [ordered, search])

  const openTile = phone ? tiles.find((t) => t.number === phone) ?? null : null
  const infoTile = infoFor ? tiles.find((t) => t.number === infoFor) ?? null : null

  /** Opening a phone lands on its most recent business chat, else the group. */
  const pickPhone = (number: string) => {
    const tile = tiles.find((t) => t.number === number)
    const first = tile ? peers(tile)[0] : undefined
    setPhone(number)
    setOpenChat(first ?? GROUP_CHAT)
    if (tile && first) actions.markRead(number, first)
  }

  // ---- Keyboard: ↑/↓ through the numbers, Enter to open, Esc to go back ----
  const [cursorAt, setCursor] = useState(0)
  const rowsRef = useRef<HTMLDivElement>(null)
  // Clamped as it is read, so a shrinking list (search, reordering) can't strand it.
  const cursor = Math.min(cursorAt, Math.max(filtered.length - 1, 0))

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        // The contact-info panel closes itself first.
        if (infoFor) return
        if (phone) setPhone(null)
        else if (search) setSearch('')
        return
      }
      // Only the number list is navigable; inside a phone the keys belong to the composer.
      if (phone || filtered.length === 0) return

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const next = e.key === 'ArrowDown' ? cursor + 1 : cursor - 1
        const clamped = Math.max(0, Math.min(next, filtered.length - 1))
        rowsRef.current?.children[clamped]?.scrollIntoView({ block: 'nearest' })
        setCursor(clamped)
      } else if (e.key === 'Enter') {
        const tile = filtered[cursor]
        if (tile) {
          e.preventDefault()
          pickPhone(tile.number)
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  return (
    <div className={styles.inbox} data-testid="inbox">
      <GroupSwitcher current={currentGroup} onSwitch={onSwitchGroup} />

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          {openTile ? (
            <PhoneChatList
              key={openTile.number}
              tile={openTile}
              tiles={tiles}
              groupName={currentGroup}
              businessNumbers={businessNumbers}
              openChat={openChat}
              actions={actions}
              autoReply={autoReply[openTile.number]}
              onOpenChat={setOpenChat}
              onBack={() => setPhone(null)}
              onAvatarClick={() => setInfoFor(openTile.number)}
            />
          ) : (
            <>
              <div className={styles.search}>
                <input
                  className={styles.searchInput}
                  data-testid="inbox-search"
                  placeholder={`Search ${tiles.length} numbers…`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className={styles.rows} ref={rowsRef}>
                {filtered.length === 0 && <div className={styles.emptyList}>No number matches “{search}”.</div>}
                {filtered.map((tile, i) => (
                  <NumberRow
                    key={tile.number}
                    tile={tile}
                    businessNumbers={businessNumbers}
                    cursor={i === cursor}
                    onOpen={() => pickPhone(tile.number)}
                    onAvatarClick={() => setInfoFor(tile.number)}
                  />
                ))}
              </div>
              <div className={styles.keyHint}>↑ ↓ to move · Enter to open · Esc to go back</div>
            </>
          )}
        </aside>

        <main className={styles.pane}>
          {openTile ? (
            <PhoneChat
              tile={openTile}
              tiles={tiles}
              groupName={currentGroup}
              businessNumbers={businessNumbers}
              openChat={openChat}
              actions={actions}
              paused={!!paused[openTile.number]}
            />
          ) : (
            <div className={styles.splash} data-testid="inbox-splash">
              <div className={styles.splashMark}>💬</div>
              <div className={styles.splashTitle}>Pick a number</div>
              <p className={styles.splashText}>
                Choose one of this group&rsquo;s {tiles.length} numbers to open its chats — the group it belongs to,
                and a chat with every business number.
              </p>
            </div>
          )}
        </main>

        {infoTile && (
          <ContactInfo tile={infoTile} businessNumbers={businessNumbers} onClose={() => setInfoFor(null)} />
        )}
      </div>
    </div>
  )
}

// Every group as a tab: clicking one jumps to that business's own customers (react-router
// remounts the session, same as picking it from ← Groups).
function GroupSwitcher({ current, onSwitch }: { current: string; onSwitch(groupId: string): void }) {
  const [groups, setGroups] = useState<Group[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () =>
      data.listGroups().then(
        (list) => !cancelled && setGroups(list),
        () => {},
      )
    load()
    const timer = setInterval(load, GROUPS_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  if (!groups || groups.length < 2) return null // nothing to switch to

  return (
    <div className={styles.switcher} data-testid="group-switcher">
      {groups.map((g) => {
        const active = g.id === current
        const locked = g.status === 'locked' && !active
        return (
          <button
            key={g.id}
            type="button"
            className={`${styles.switcherTab} ${active ? styles.switcherTabActive : ''}`}
            data-testid={`switch-group-${g.id}`}
            disabled={locked}
            title={locked ? `${g.name} is open in another session` : `Switch to ${g.name}`}
            onClick={() => !active && onSwitch(g.id)}
          >
            {g.name}
            {locked && <span className={styles.switcherLock}>🔒</span>}
          </button>
        )
      })}
    </div>
  )
}

/** One customer number in the picker: open it to see that phone's chats. */
function NumberRow({
  tile,
  businessNumbers,
  cursor,
  onOpen,
  onAvatarClick,
}: {
  tile: UiTile
  businessNumbers: BusinessNumber[]
  /** Highlighted by the keyboard cursor. */
  cursor: boolean
  onOpen(): void
  onAvatarClick(): void
}) {
  const last = lastMessage(tile)
  const unreadCount = unread(tile)
  const from = last && last.from !== tile.number ? businessLabel(last.from, businessNumbers) ?? plus(last.from) : null

  const avatarKey = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      onAvatarClick()
    }
  }

  return (
    <button
      type="button"
      className={`${styles.row} ${cursor ? styles.rowCursor : ''}`}
      data-testid={`inbox-row-${tile.number}`}
      onClick={onOpen}
    >
      <span
        className={`${styles.avatar} ${tile.online ? styles.avatarOnline : ''}`}
        data-testid={`inbox-avatar-${tile.number}`}
        role="button"
        tabIndex={0}
        title="Contact info"
        onClick={(e) => {
          e.stopPropagation()
          onAvatarClick()
        }}
        onKeyDown={avatarKey}
      >
        {tile.number.slice(-2)}
      </span>
      <span className={styles.rowBody}>
        <span className={styles.rowTop}>
          <span className={`${styles.rowNumber} mono`}>{plus(tile.number)}</span>
          {last && <span className={`${styles.rowTime} mono`}>{hhmm(last.timestamp)}</span>}
        </span>
        <span className={styles.rowBottom}>
          <span className={styles.preview}>
            {last ? (
              <>
                {from && <span className={styles.previewFrom}>{from}: </span>}
                {last.body}
              </>
            ) : (
              <span className={styles.previewEmpty}>No messages yet</span>
            )}
          </span>
          {unreadCount > 0 && (
            <span className={`${styles.badge} mono`} data-testid={`inbox-unread-${tile.number}`}>
              {unreadCount}
            </span>
          )}
          {tile.queued.length > 0 && <span className={styles.queued}>{tile.queued.length}</span>}
        </span>
      </span>
    </button>
  )
}

// Slides in from the right, like tapping a contact's photo in WhatsApp.
function ContactInfo({
  tile,
  businessNumbers,
  onClose,
}: {
  tile: UiTile
  businessNumbers: BusinessNumber[]
  onClose(): void
}) {
  const n = tile.number
  const label = (number: string) => businessLabel(number, businessNumbers) ?? plus(number)
  const tilePeers = peers(tile)
  const unreadByPeer = (peer: string) => unreadMessages(tile).filter((m) => m.from === peer).length

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <aside className={styles.info} role="dialog" aria-label="Contact info" data-testid={`contact-info-${n}`}>
      <div className={styles.infoHeader}>
        <span className={styles.infoTitle}>Contact info</span>
        <button
          type="button"
          className={styles.infoClose}
          data-testid="contact-info-close"
          aria-label="Close"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div className={styles.infoBody}>
        <span className={`${styles.avatarLarge} ${tile.online ? styles.avatarOnline : ''}`} aria-hidden="true">
          {n.slice(-2)}
        </span>
        <div className={`${styles.infoNumber} mono`}>{plus(n)}</div>
        <div className={styles.infoStatus}>{tile.online ? 'Online' : 'Offline'}</div>

        <div className={styles.infoSection}>
          <div className={styles.infoLabel}>Messaged by</div>
          {tilePeers.length === 0 ? (
            <div className={styles.infoEmpty}>No business has messaged this number yet.</div>
          ) : (
            tilePeers.map((peer) => {
              const peerUnread = unreadByPeer(peer)
              return (
                <div key={peer} className={styles.infoRow} data-testid={`contact-info-peer-${peer}`}>
                  <span className={styles.infoRowLabel}>{label(peer)}</span>
                  {peerUnread > 0 && <span className={`${styles.badge} mono`}>{peerUnread}</span>}
                </div>
              )
            })
          )}
        </div>

        <div className={styles.infoSection}>
          <div className={styles.infoRow}>
            <span className={styles.infoRowLabel}>Messages</span>
            <span className="mono">{tile.history.length}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoRowLabel}>Queued</span>
            <span className="mono">{tile.queued.length}</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
