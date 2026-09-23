// One customer number's own WhatsApp, split into the two halves of the client screen:
//
//   PhoneChatList — the left sidebar: this phone, then the group it belongs to and a
//                   separate chat per business number.
//   PhoneChat     — the right pane: the open conversation.
//
// This is the CUSTOMER's point of view: you pick a number in the client tab and then see
// exactly what that phone would see.
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { GROUP_CHAT } from '../lib/chats'
import { businessLabel, dayKey, dayLabel, hhmm, plus } from '../lib/format'
import { peers, unreadMessages, type UiMessage, type UiTile } from '../session/reducer'
import type { TileActions } from '../session/useGroupSession'
import type { AutoReplyConfig, BusinessNumber } from '../types'
import AutoReplyPopover from './AutoReplyPopover'
import Bubble from './Bubble'
import styles from './PhoneView.module.css'

/** The group feed merges every tile's history; only the newest are rendered. */
const GROUP_FEED_LIMIT = 300
const NEAR_BOTTOM_PX = 40

/** True when this message is the first of a new calendar day, so a divider goes above it. */
function startsNewDay(m: UiMessage, previous: UiMessage | undefined): boolean {
  return !previous || dayKey(m.timestamp) !== dayKey(previous.timestamp)
}

/** The date pill WhatsApp floats between days. */
function DayDivider({ at }: { at: number }) {
  return (
    <div className={styles.dayDivider}>
      <span>{dayLabel(at)}</span>
    </div>
  )
}

/** The group feed is read-only, so its bubbles never offer Retry. */
const noRetry = () => {}

/** The chats a phone has: its group first, then every business (talked-to ones first). */
function chatsFor(tile: UiTile, businessNumbers: BusinessNumber[]): string[] {
  const talked = peers(tile)
  const rest = businessNumbers.map((b) => b.display_number).filter((b) => !talked.includes(b))
  return [...talked, ...rest]
}

// ---- Left sidebar: this phone and its chats --------------------------------------------

export function PhoneChatList({
  tile,
  tiles,
  groupName,
  businessNumbers,
  openChat,
  actions,
  autoReply,
  onOpenChat,
  onBack,
  onAvatarClick,
}: {
  tile: UiTile
  tiles: UiTile[]
  groupName: string
  businessNumbers: BusinessNumber[]
  openChat: string
  actions: TileActions
  autoReply: AutoReplyConfig
  onOpenChat(chat: string): void
  onBack(): void
  onAvatarClick(): void
}) {
  const n = tile.number
  const label = (number: string) => businessLabel(number, businessNumbers) ?? plus(number)
  const chats = useMemo(() => chatsFor(tile, businessNumbers), [tile, businessNumbers])

  const [settingsOpen, setSettingsOpen] = useState(false)
  const gearRef = useRef<HTMLButtonElement>(null)

  const openBusinessChat = (business: string) => {
    onOpenChat(business)
    if (unreadMessages(tile).some((m) => m.from === business)) actions.markRead(n, business)
  }

  return (
    <>
      <header className={styles.me}>
        <button type="button" className={styles.back} data-testid="phone-back" onClick={onBack} title="All numbers">
          ←
        </button>
        <span
          className={`${styles.avatar} ${tile.online ? styles.avatarOnline : ''}`}
          role="button"
          tabIndex={0}
          title="Contact info"
          data-testid={`phone-avatar-${n}`}
          onClick={onAvatarClick}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onAvatarClick()}
        >
          {n.slice(-2)}
        </span>
        <div className={styles.meWho}>
          <div className={styles.meTop}>
            <span className={`${styles.meNumber} mono`}>{plus(n)}</span>
            {/* This is the phone you are holding, as WhatsApp marks your own entry. */}
            <span className={styles.youTag}>You</span>
          </div>
          <div className={styles.meSub}>{tile.online ? 'online' : 'offline'}</div>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          data-testid={`phone-presence-${n}`}
          title={tile.online ? 'Go offline' : 'Go online'}
          aria-pressed={tile.online}
          onClick={() => actions.setPresence(n, !tile.online)}
        >
          <span className={`${styles.presenceDot} ${tile.online ? styles.presenceOn : ''}`} />
        </button>
        <button
          ref={gearRef}
          type="button"
          className={`${styles.iconButton} ${autoReply.mode !== 'manual' ? styles.iconButtonActive : ''}`}
          data-testid={`phone-autoreply-${n}`}
          title={`Auto-reply: ${autoReply.mode}`}
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((o) => !o)}
        >
          ⚙
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

      <div className={styles.chatList}>
        <GroupChatRow
          groupName={groupName}
          members={tiles.length}
          tiles={tiles}
          active={openChat === GROUP_CHAT}
          onOpen={() => onOpenChat(GROUP_CHAT)}
        />
        {chats.map((business) => (
          <BusinessChatRow
            key={business}
            tile={tile}
            business={business}
            label={label(business)}
            active={openChat === business}
            onOpen={() => openBusinessChat(business)}
          />
        ))}
      </div>
    </>
  )
}

// ---- Right pane: the open conversation --------------------------------------------------

export function PhoneChat({
  tile,
  tiles,
  groupName,
  businessNumbers,
  openChat,
  actions,
  paused,
}: {
  tile: UiTile
  tiles: UiTile[]
  groupName: string
  businessNumbers: BusinessNumber[]
  openChat: string
  actions: TileActions
  paused: boolean
}) {
  if (openChat === GROUP_CHAT) {
    return <GroupChat tile={tile} tiles={tiles} groupName={groupName} businessNumbers={businessNumbers} />
  }
  return (
    <BusinessChat
      key={openChat}
      tile={tile}
      business={openChat}
      label={businessLabel(openChat, businessNumbers) ?? plus(openChat)}
      actions={actions}
      paused={paused}
    />
  )
}

// ---- chat list rows ----------------------------------------------------------------------

function GroupChatRow({
  groupName,
  members,
  tiles,
  active,
  onOpen,
}: {
  groupName: string
  members: number
  tiles: UiTile[]
  active: boolean
  onOpen(): void
}) {
  // Cheap: only the last message of each tile, not the whole feed.
  const latest = useMemo(() => {
    let best: UiMessage | undefined
    for (const t of tiles) {
      const m = t.history[t.history.length - 1]
      if (m && (!best || m.timestamp > best.timestamp)) best = m
    }
    return best
  }, [tiles])

  return (
    <button
      type="button"
      className={`${styles.chatRow} ${active ? styles.chatRowActive : ''}`}
      data-testid="chat-row-group"
      onClick={onOpen}
    >
      <span className={`${styles.avatar} ${styles.avatarGroup}`} aria-hidden="true">
        👥
      </span>
      <span className={styles.chatBody}>
        <span className={styles.chatTop}>
          <span className={styles.chatName}>{groupName}</span>
          {latest && <span className={`${styles.chatTime} mono`}>{hhmm(latest.timestamp)}</span>}
        </span>
        <span className={styles.chatPreview}>
          {latest ? latest.body : <span className={styles.muted}>{members} participants</span>}
        </span>
      </span>
    </button>
  )
}

function BusinessChatRow({
  tile,
  business,
  label,
  active,
  onOpen,
}: {
  tile: UiTile
  business: string
  label: string
  active: boolean
  onOpen(): void
}) {
  const messages = tile.history.filter((m) => m.from === business || m.to === business)
  const last = messages[messages.length - 1]
  const unread = unreadMessages(tile).filter((m) => m.from === business).length

  return (
    <button
      type="button"
      className={`${styles.chatRow} ${active ? styles.chatRowActive : ''}`}
      data-testid={`chat-row-${business}`}
      onClick={onOpen}
    >
      <span className={`${styles.avatar} ${styles.avatarBusiness}`} aria-hidden="true">
        {label.slice(0, 1).toUpperCase()}
      </span>
      <span className={styles.chatBody}>
        <span className={styles.chatTop}>
          <span className={styles.chatName}>{label}</span>
          {last && <span className={`${styles.chatTime} mono`}>{hhmm(last.timestamp)}</span>}
        </span>
        <span className={styles.chatBottom}>
          <span className={styles.chatPreview}>
            {last ? last.body : <span className={styles.muted}>No messages yet</span>}
          </span>
          {unread > 0 && (
            <span className={`${styles.badge} mono`} data-testid={`chat-unread-${business}`}>
              {unread}
            </span>
          )}
        </span>
      </span>
    </button>
  )
}

// ---- the group chat (read-only feed of everything in this group) ---------------------------

function GroupChat({
  tile,
  tiles,
  groupName,
  businessNumbers,
}: {
  tile: UiTile
  tiles: UiTile[]
  groupName: string
  businessNumbers: BusinessNumber[]
}) {
  const me = tile.number
  const label = (number: string) => businessLabel(number, businessNumbers) ?? plus(number)

  const feed = useMemo(() => {
    const all: Array<{ m: UiMessage; customer: string }> = []
    for (const t of tiles) for (const m of t.history) all.push({ m, customer: t.number })
    all.sort((a, b) => a.m.timestamp - b.m.timestamp)
    return all.slice(-GROUP_FEED_LIMIT)
  }, [tiles])

  const participants = tiles.map((t) => plus(t.number))
  const shown = participants.slice(0, 4).join(', ')
  const more = participants.length - 4

  const { chatRef, onScroll } = usePinnedScroll(feed.length)

  return (
    <>
      <header className={styles.chatHeader}>
        <span className={`${styles.avatar} ${styles.avatarGroup}`} aria-hidden="true">
          👥
        </span>
        <div className={styles.chatWho}>
          <div className={styles.chatTitle}>{groupName}</div>
          <div className={`${styles.chatSub} mono`}>
            {shown}
            {more > 0 ? ` and ${more} more` : ''}
          </div>
        </div>
      </header>

      <div ref={chatRef} className={styles.messages} onScroll={onScroll} data-testid="group-messages">
        {feed.length === 0 ? (
          <div className={styles.empty}>No messages in this group yet</div>
        ) : (
          feed.map(({ m, customer }, i) => {
            const mine = m.from === me
            const fromBusiness = m.from !== customer
            // Who spoke, as WhatsApp shows above a group message.
            const sender = fromBusiness ? `${label(m.from)} → ${plus(customer)}` : plus(customer)
            const previous = feed[i - 1]?.m
            return (
              <Fragment key={`${customer}:${m.wamid}`}>
                {startsNewDay(m, previous) && <DayDivider at={m.timestamp} />}
                <Bubble m={m} own={mine} sender={mine ? null : sender} onRetry={noRetry} />
              </Fragment>
            )
          })
        )}
      </div>

      <div className={styles.groupNote}>Group view is read-only — open a business chat to send a message.</div>
    </>
  )
}

// ---- a 1-to-1 chat with one business number ------------------------------------------------

function BusinessChat({
  tile,
  business,
  label,
  actions,
  paused,
}: {
  tile: UiTile
  business: string
  label: string
  actions: TileActions
  paused: boolean
}) {
  const n = tile.number
  const messages = useMemo(
    () => tile.history.filter((m) => m.from === business || m.to === business),
    [tile.history, business],
  )
  const [draft, setDraft] = useState('')
  const { chatRef, onScroll } = usePinnedScroll(messages.length)

  // Captured as the chat opens, before the effect below marks everything read — WhatsApp
  // keeps the "N unread messages" line visible until you leave the chat.
  const [unreadMark] = useState(() => {
    const waiting = unreadMessages(tile).filter((m) => m.from === business)
    return waiting.length > 0 ? { wamid: waiting[0].wamid, count: waiting.length } : null
  })

  // An open chat stays read, as in WhatsApp: anything arriving now is marked at once.
  useEffect(() => {
    if (unreadMessages(tile).some((m) => m.from === business)) actions.markRead(n, business)
  }, [tile, business, actions, n])

  const send = () => {
    const body = draft.trim()
    if (!body || !tile.online) return
    actions.send(n, business, body)
    setDraft('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') send()
  }

  return (
    <>
      <header className={styles.chatHeader}>
        <span className={`${styles.avatar} ${styles.avatarBusiness}`} aria-hidden="true">
          {label.slice(0, 1).toUpperCase()}
        </span>
        <div className={styles.chatWho}>
          <div className={styles.chatTitle}>{label}</div>
          <div className={`${styles.chatSub} mono`}>{plus(business)}</div>
        </div>
      </header>

      <div
        ref={chatRef}
        className={styles.messages}
        onScroll={onScroll}
        data-testid={`business-messages-${business}`}
      >
        {messages.length === 0 ? (
          <div className={styles.empty}>No messages yet — say hello</div>
        ) : (
          messages.map((m, i) => (
            <Fragment key={m.wamid}>
              {startsNewDay(m, messages[i - 1]) && <DayDivider at={m.timestamp} />}
              {unreadMark?.wamid === m.wamid && (
                <div className={styles.unreadDivider} data-testid="unread-divider">
                  <span>
                    {unreadMark.count} unread message{unreadMark.count === 1 ? '' : 's'}
                  </span>
                </div>
              )}
              <Bubble m={m} own={m.from === n} sender={null} onRetry={actions.retry} />
            </Fragment>
          ))
        )}
      </div>

      {paused && <div className={styles.groupNote}>Auto-reply paused (loop guard)</div>}

      <div className={styles.composer}>
        <input
          className={styles.input}
          data-testid={`phone-input-${business}`}
          placeholder={tile.online ? 'Type a message' : 'Offline — turn this number online to send'}
          value={draft}
          disabled={!tile.online}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
        />
        <button
          type="button"
          className={styles.send}
          data-testid={`phone-send-${business}`}
          disabled={!tile.online}
          onClick={send}
        >
          Send
        </button>
      </div>
    </>
  )
}

/** Keeps a message list pinned to the newest, unless the tester scrolled up to read. */
function usePinnedScroll(count: number) {
  const chatRef = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  useLayoutEffect(() => {
    const el = chatRef.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [count])
  const onScroll = () => {
    const el = chatRef.current
    if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
  }
  return { chatRef, onScroll }
}
