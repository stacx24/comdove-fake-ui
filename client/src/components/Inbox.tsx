// WhatsApp-style view of a group: the customer numbers on the left, the chosen number's
// conversation on the right. With 100 tiles (WS-343) the grid cannot show who wrote to whom,
// so every incoming bubble here names the business number it came from.
//
// Two extra pieces on top of that (by request):
//  - a switcher strip across the top lists every group, so clicking one jumps the WHOLE
//    inbox to that business's own customers, without going back to the Groups screen.
//  - clicking a customer's avatar (in the list, or in the open chat) opens a contact-info
//    panel: the full number, online state, which businesses it has messaged, and counts.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { data } from '../data'
import { businessLabel, hhmm, plus } from '../lib/format'
import { lastSender, peers, unread, unreadMessages, type UiTile } from '../session/reducer'
import type { TileActions } from '../session/useGroupSession'
import type { AutoReplyConfig, BusinessNumber, Group } from '../types'
import AutoReplyPopover from './AutoReplyPopover'
import Bubble from './Bubble'
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

const NEAR_BOTTOM_PX = 40
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
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [infoFor, setInfoFor] = useState<string | null>(null)

  // Busiest chats first, like a real inbox; numbers with no messages keep their tile order.
  const ordered = useMemo(() => {
    const withTime = tiles.map((t, i) => ({ t, i, at: lastMessage(t)?.timestamp ?? 0 }))
    withTime.sort((a, b) => (b.at !== a.at ? b.at - a.at : a.i - b.i))
    return withTime.map((x) => x.t)
  }, [tiles])

  const filtered = useMemo(() => {
    const q = search.trim()
    if (!q) return ordered
    return ordered.filter((t) => t.number.includes(q))
  }, [ordered, search])

  // Keep a selection even as the list reorders or the group reloads.
  const current = (selected && tiles.find((t) => t.number === selected)) || filtered[0] || null
  const infoTile = infoFor ? tiles.find((t) => t.number === infoFor) ?? null : null

  const openChat = (number: string) => {
    setSelected(number)
    const tile = tiles.find((t) => t.number === number)
    if (tile) markRead(tile, actions)
  }

  const openInfo = (number: string) => {
    openChat(number)
    setInfoFor(number)
  }

  return (
    <div className={styles.inbox} data-testid="inbox">
      <GroupSwitcher current={currentGroup} onSwitch={onSwitchGroup} />

      <div className={styles.body}>
        <aside className={styles.list}>
          <div className={styles.search}>
            <input
              className={styles.searchInput}
              data-testid="inbox-search"
              placeholder={`Search ${tiles.length} numbers…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className={styles.rows}>
            {filtered.length === 0 && <div className={styles.emptyList}>No number matches “{search}”.</div>}
            {filtered.map((tile) => (
              <ChatRow
                key={tile.number}
                tile={tile}
                businessNumbers={businessNumbers}
                active={current?.number === tile.number}
                onOpen={() => openChat(tile.number)}
                onAvatarClick={() => openInfo(tile.number)}
              />
            ))}
          </div>
        </aside>

        {current ? (
          <Conversation
            key={current.number}
            tile={current}
            businessNumbers={businessNumbers}
            actions={actions}
            autoReply={autoReply[current.number]}
            paused={!!paused[current.number]}
            onAvatarClick={() => setInfoFor(current.number)}
          />
        ) : (
          <div className={styles.placeholder}>Pick a number to see its messages.</div>
        )}

        {infoTile && (
          <ContactInfo tile={infoTile} businessNumbers={businessNumbers} onClose={() => setInfoFor(null)} />
        )}
      </div>
    </div>
  )
}

function markRead(tile: UiTile, actions: TileActions): void {
  const from = new Set(unreadMessages(tile).map((m) => m.from))
  for (const peer of from) actions.markRead(tile.number, peer)
}

// Every group as a tab: clicking one is a full jump to that business's own customers
// (react-router remounts the session, same as picking it from ← Groups).
function GroupSwitcher({ current, onSwitch }: { current: string; onSwitch(groupId: string): void }) {
  const [groups, setGroups] = useState<Group[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () => data.listGroups().then((list) => !cancelled && setGroups(list), () => {})
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

function ChatRow({
  tile,
  businessNumbers,
  active,
  onOpen,
  onAvatarClick,
}: {
  tile: UiTile
  businessNumbers: BusinessNumber[]
  active: boolean
  onOpen(): void
  onAvatarClick(): void
}) {
  const last = lastMessage(tile)
  const unreadCount = unread(tile)
  // Who sent this row's last message: the admin/business side is the visible identity here.
  // The client number is hidden until the profile icon is clicked (Contact info).
  const admin = peers(tile)[0]
  const heading = admin ? businessLabel(admin, businessNumbers) ?? plus(admin) : 'No business yet'

  return (
    <button
      type="button"
      className={`${styles.row} ${active ? styles.rowActive : ''}`}
      data-testid={`inbox-row-${tile.number}`}
      onClick={onOpen}
    >
      <Avatar
        number={tile.number}
        online={tile.online}
        testId={`inbox-avatar-${tile.number}`}
        onClick={onAvatarClick}
      />
      <span className={styles.rowBody}>
        <span className={styles.rowTop}>
          <span className={styles.rowNumber}>{heading}</span>
          {last && <span className={`${styles.rowTime} mono`}>{hhmm(last.timestamp)}</span>}
        </span>
        <span className={styles.rowBottom}>
          <span className={styles.preview}>
            {last ? last.body : <span className={styles.previewEmpty}>No messages yet</span>}
          </span>
          {unreadCount > 0 && (
            <span className={`${styles.badge} mono`} data-testid={`inbox-unread-${tile.number}`}>
              {unreadCount}
            </span>
          )}
          {tile.queued.length > 0 && <span className={styles.queued}>{tile.queued.length} queued</span>}
        </span>
      </span>
    </button>
  )
}

// A clickable avatar that never triggers the row/header it sits in (stopPropagation), so
// it can open contact info while the rest of the row still opens the chat as before.
function Avatar({
  number,
  online,
  testId,
  onClick,
}: {
  number: string
  online: boolean
  testId: string
  onClick(): void
}) {
  const fire = (e: { stopPropagation(): void }) => {
    e.stopPropagation()
    onClick()
  }
  const onKey = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fire(e)
    }
  }
  return (
    <span
      className={`${styles.avatar} ${online ? styles.avatarOnline : ''}`}
      data-testid={testId}
      role="button"
      tabIndex={0}
      title="Contact info"
      onClick={fire}
      onKeyDown={onKey}
    >
      {number.slice(-2)}
    </span>
  )
}

function Conversation({
  tile,
  businessNumbers,
  actions,
  autoReply,
  paused,
  onAvatarClick,
}: {
  tile: UiTile
  businessNumbers: BusinessNumber[]
  actions: TileActions
  autoReply: AutoReplyConfig
  paused: boolean
  onAvatarClick(): void
}) {
  const n = tile.number
  const tilePeers = peers(tile)
  const target = lastSender(tile) ?? tilePeers[0] ?? businessNumbers[0]?.display_number
  const label = (number: string) => businessLabel(number, businessNumbers) ?? plus(number)

  // The admin/business side is the visible identity in the heading; the client number stays
  // hidden until the profile icon is clicked (Contact info shows it in full).
  const lastAdmin = tilePeers[0]
  const heading = lastAdmin ? label(lastAdmin) : 'No business yet'
  const otherPeers = tilePeers.filter((p) => p !== lastAdmin)

  const [draft, setDraft] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const gearRef = useRef<HTMLButtonElement>(null)

  const send = () => {
    const body = draft.trim()
    if (!body || !tile.online || !target) return
    actions.send(n, target, body)
    setDraft('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') send()
  }

  // Opening a chat marks it read (FR-06), and new messages keep it read while it is open.
  useEffect(() => {
    if (unread(tile) > 0) markRead(tile, actions)
  }, [tile, actions])

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
    <section className={styles.chatPane} data-testid={`inbox-chat-${n}`}>
      <header className={styles.chatHeader}>
        <Avatar number={n} online={tile.online} testId={`inbox-chat-avatar-${n}`} onClick={onAvatarClick} />
        <div className={styles.chatWho}>
          <div className={styles.chatNumber}>{heading}</div>
          <div className={styles.chatSub}>
            {tile.history.length === 0
              ? 'no messages yet — click the profile icon for the customer number'
              : otherPeers.length > 0
                ? `also talked to ${otherPeers.map(label).join(', ')}`
                : 'click the profile icon for the customer number'}
          </div>
        </div>
        <button
          type="button"
          className={styles.presence}
          data-testid={`inbox-presence-${n}`}
          title={tile.online ? 'Online — click to go offline' : 'Offline — click to go online'}
          aria-pressed={tile.online}
          onClick={() => actions.setPresence(n, !tile.online)}
        >
          <span className={`${styles.presenceDot} ${tile.online ? styles.presenceOn : ''}`} />
          {tile.online ? 'online' : 'offline'}
        </button>
        <button
          ref={gearRef}
          type="button"
          className={`${styles.gear} ${autoReply.mode !== 'manual' ? styles.gearAuto : ''}`}
          data-testid={`inbox-autoreply-${n}`}
          title="Auto-reply mode"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((o) => !o)}
        >
          ⚙ {autoReply.mode}
        </button>
        {settingsOpen && (
          <AutoReplyPopover
            number={n}
            config={autoReply}
            onChange={(c) => actions.setAutoReply(n, c)}
            onClose={() => setSettingsOpen(false)}
            anchor={gearRef}
          />
        )}
      </header>

      <div ref={chatRef} className={styles.messages} data-testid={`inbox-messages-${n}`} onScroll={onScroll}>
        {tile.history.length === 0 ? (
          <div className={styles.emptyChat}>No messages yet</div>
        ) : (
          tile.history.map((m) => (
            // Always name the business number here: that is what the grid could not show.
            <Bubble key={m.wamid} m={m} own={m.from === n} sender={m.from === n ? null : label(m.from)} onRetry={actions.retry} />
          ))
        )}
      </div>

      {paused && <div className={styles.paused}>Auto-reply paused (loop guard)</div>}

      <div className={styles.composer}>
        <input
          className={styles.input}
          data-testid={`inbox-input-${n}`}
          placeholder={tile.online ? 'Message as customer…' : 'Offline — turn the number online to reply'}
          value={draft}
          disabled={!tile.online}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
        />
        <button
          type="button"
          className={styles.send}
          data-testid={`inbox-send-${n}`}
          disabled={!tile.online || !target}
          onClick={send}
        >
          Send{target ? ` → ${label(target)}` : ''}
        </button>
      </div>
    </section>
  )
}

// Slides over the right side of the chat pane, like tapping a contact's name/photo in
// WhatsApp — the full number, online state, every business it has talked to, and counts.
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
        <button type="button" className={styles.infoClose} data-testid="contact-info-close" aria-label="Close" onClick={onClose}>
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
