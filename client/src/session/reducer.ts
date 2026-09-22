// Group session state. The only place it changes: server events and local actions, pure.
// The mock data and the real server look the same from here.
import type { ConnectionState } from '../data'
import type { ChatMessage, MessageStatus, ServerEvent } from '../types'

export interface UiMessage extends ChatMessage {
  /** Set on messages typed in this tab until the server knows them. */
  localId?: string
  /** 'failed' = could not be sent (socket not open); the tile offers Retry. */
  pending?: 'failed'
}

export interface UiTile {
  number: string
  online: boolean
  history: UiMessage[]
  queued: ChatMessage[]
}

/** A server `error` the tester should see (API Reference, WebSocket error codes). */
export interface ServerNotice {
  code: string
  message: string
}

export interface SessionState {
  /** locked = claim refused; deleted = the group was removed; not-found = no such group. */
  phase: 'connecting' | 'ready' | 'locked' | 'deleted' | 'not-found'
  lockedSince?: number
  notice?: ServerNotice
  order: string[]
  tiles: Record<string, UiTile>
  connection: ConnectionState
}

export type Action =
  | ServerEvent
  | {
      type: 'local.send'
      localId: string
      from: string
      to: string
      body: string
      timestamp: number
      sent: boolean
    }
  | { type: 'local.retry'; localId: string; sent: boolean }
  | { type: 'local.presence'; number: string; online: boolean }
  | { type: 'local.read'; number: string; peer: string }
  | { type: 'local.connection'; state: ConnectionState }
  | { type: 'local.notice'; notice: ServerNotice | null }

export const initialState: SessionState = {
  phase: 'connecting',
  order: [],
  tiles: {},
  connection: 'connecting',
}

// Statuses only move up. `read` may arrive with no `delivered` before it (Tech Spec §5).
const RANK: Record<MessageStatus, number> = { queued: 0, sent: 1, failed: 1, delivered: 2, read: 3 }

function raise(current: MessageStatus, next: MessageStatus): MessageStatus {
  if (next === 'failed') return current === 'queued' || current === 'sent' ? 'failed' : current
  return RANK[next] > RANK[current] ? next : current
}

function withTile(state: SessionState, number: string, change: (tile: UiTile) => UiTile): SessionState {
  const tile = state.tiles[number]
  if (!tile) return state
  return { ...state, tiles: { ...state.tiles, [number]: change(tile) } }
}

function appendNew(history: UiMessage[], messages: ChatMessage[]): UiMessage[] {
  const known = new Set(history.map((m) => m.wamid))
  const fresh = messages.filter((m) => !known.has(m.wamid) && known.add(m.wamid))
  return fresh.length ? [...history, ...fresh] : history
}

// A real message.new that echoes a still-optimistic bubble this tab sent (same from/to/body)
// adopts the server wamid in place — no duplicate. Otherwise append, deduped by wamid.
function mergeIncoming(history: UiMessage[], incoming: ChatMessage): UiMessage[] {
  const i = history.findIndex(
    (m) => m.localId !== undefined && m.from === incoming.from && m.to === incoming.to && m.body === incoming.body,
  )
  if (i === -1) return appendNew(history, [incoming])
  const merged: UiMessage = { ...history[i], wamid: incoming.wamid, status: raise(history[i].status, incoming.status) }
  delete merged.localId
  delete merged.pending
  const next = [...history]
  next[i] = merged
  return next
}

export function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case 'group.claimed': {
      // A reconnect re-sends the full state: replace, don't merge.
      const tiles: Record<string, UiTile> = {}
      for (const t of action.tiles) tiles[t.number] = { ...t }
      return { ...state, phase: 'ready', order: action.tiles.map((t) => t.number), tiles }
    }

    case 'group.locked':
      return { ...state, phase: 'locked', lockedSince: action.since }

    case 'message.new':
      // Route by the tile the server addressed (`number`), falling back to `to`. Inbound frames
      // (tile reply, auto-reply) set to=<business>, so keying on `to` alone would drop them.
      return withTile(state, action.number ?? action.to, (tile) => ({
        ...tile,
        history: mergeIncoming(tile.history, action.message),
      }))

    case 'queue.flush':
      return withTile(state, action.number, (tile) => ({
        ...tile,
        history: appendNew(tile.history, action.messages),
        queued: [],
      }))

    case 'message.status': {
      let changed = false
      const update = <M extends ChatMessage>(m: M): M => {
        if (m.wamid !== action.wamid) return m
        const status = raise(m.status, action.status)
        if (status === m.status) return m
        changed = true
        return { ...m, status }
      }
      const tiles: Record<string, UiTile> = {}
      for (const [n, t] of Object.entries(state.tiles)) {
        tiles[n] = { ...t, history: t.history.map(update), queued: t.queued.map(update) }
      }
      return changed ? { ...state, tiles } : state
    }

    case 'local.send':
      return withTile(state, action.from, (tile) => ({
        ...tile,
        history: [
          ...tile.history,
          {
            wamid: `local.${action.localId}`,
            localId: action.localId,
            from: action.from,
            to: action.to,
            body: action.body,
            status: 'sent',
            timestamp: action.timestamp,
            ...(action.sent ? {} : { pending: 'failed' as const }),
          },
        ],
      }))

    case 'local.retry': {
      if (!action.sent) return state
      const owner = Object.values(state.tiles).find((t) => t.history.some((m) => m.localId === action.localId))
      if (!owner) return state
      return withTile(state, owner.number, (tile) => ({
        ...tile,
        history: tile.history.map((m) => {
          if (m.localId !== action.localId) return m
          const rest = { ...m }
          delete rest.pending
          return rest
        }),
      }))
    }

    case 'local.presence':
      return withTile(state, action.number, (tile) =>
        tile.online === action.online ? tile : { ...tile, online: action.online },
      )

    case 'local.read':
      // Clears the badge at once. On the server, chat.read makes it real; ranking keeps it read.
      return withTile(state, action.number, (tile) => ({
        ...tile,
        history: tile.history.map((m) =>
          m.from === action.peer && m.to === tile.number && m.status !== 'read' ? { ...m, status: 'read' } : m,
        ),
      }))

    case 'local.connection':
      return state.connection === action.state ? state : { ...state, connection: action.state }

    // The server's echo of a presence change: what it actually accepted wins.
    case 'tile.presence':
      return withTile(state, action.number, (tile) =>
        tile.online === action.online ? tile : { ...tile, online: action.online },
      )

    // Auto-reply settings live outside the reducer (useGroupSession).
    case 'tile.autoreply':
      return state

    case 'error':
      if (action.code === 'already_claimed') return { ...state, phase: 'locked' }
      if (action.code === 'group_deleted') return { ...state, phase: 'deleted' }
      if (action.code === 'unknown_group') return { ...state, phase: 'not-found' }
      return { ...state, notice: { code: action.code, message: action.message } }

    case 'local.notice':
      if (action.notice) return { ...state, notice: action.notice }
      if (!state.notice) return state
      return { ...state, notice: undefined }
  }
}

// ---- Selectors: derived, never stored ----

/** Messages from Comdove to this tile that are not read yet. */
export const unreadMessages = (tile: UiTile) =>
  tile.history.filter((m) => m.to === tile.number && m.status !== 'read')

export const unread = (tile: UiTile) => unreadMessages(tile).length

/** Business numbers this tile has talked to, most recent first. */
export function peers(tile: UiTile): string[] {
  const seen: string[] = []
  for (let i = tile.history.length - 1; i >= 0; i--) {
    const m = tile.history[i]
    const peer = m.from === tile.number ? m.to : m.from
    if (!seen.includes(peer)) seen.push(peer)
  }
  return seen
}

/** The business number that wrote to this tile most recently: the default reply target. */
export function lastSender(tile: UiTile): string | undefined {
  for (let i = tile.history.length - 1; i >= 0; i--) {
    if (tile.history[i].to === tile.number) return tile.history[i].from
  }
  return undefined
}

export const onlineCount = (state: SessionState) =>
  state.order.filter((n) => state.tiles[n]?.online).length

export const totalQueued = (state: SessionState) =>
  state.order.reduce((sum, n) => sum + (state.tiles[n]?.queued.length ?? 0), 0)
