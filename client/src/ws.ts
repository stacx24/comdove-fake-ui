// WebSocket connection to the mock server (Tech Spec §7). One socket per group.
import type { ChatMessage, ClientEvent, ServerEvent } from './types'

// --- Server → UI message shape adapter -------------------------------------
// The mock server sends chat messages as { wamid, peer, direction, body, status,
// created_at } (API Tech Spec §7 / fixtures/ws/*.json). The UI's ChatMessage uses
// { wamid, from, to, body, status, timestamp(seconds) }. Map at this boundary so
// the reducer/Tile keep working, sender shows (not "+undefined") and time is real
// (not "NaN:NaN"). `tile` = the customer number this chat belongs to.
interface RawServerMessage {
  wamid: string
  peer?: string
  direction?: 'inbound' | 'outbound'
  body: string
  status: ChatMessage['status']
  created_at?: number
  // if the server already sends UI-shaped fields, keep them
  from?: string
  to?: string
  timestamp?: number
}

function toChatMessage(raw: RawServerMessage, tile: string): ChatMessage {
  const inbound = raw.direction === 'inbound' // customer → Comdove
  const from = raw.from ?? (inbound ? tile : (raw.peer ?? ''))
  const to = raw.to ?? (inbound ? (raw.peer ?? '') : tile)
  // created_at is unix ms; ChatMessage.timestamp is unix seconds (hhmm ×1000).
  const timestamp =
    raw.timestamp ?? (raw.created_at != null ? Math.floor(raw.created_at / 1000) : 0)
  return { wamid: raw.wamid, from, to, body: raw.body, status: raw.status, timestamp }
}

// Normalize an incoming server event so every embedded message is a ChatMessage.
function adapt(event: any): ServerEvent {
  if (!event || typeof event !== 'object') return event
  switch (event.type) {
    case 'message.new': {
      const tile = event.number ?? event.to
      return { ...event, message: toChatMessage(event.message, tile) }
    }
    case 'queue.flush': {
      const tile = event.number
      return { ...event, messages: (event.messages ?? []).map((m: RawServerMessage) => toChatMessage(m, tile)) }
    }
    case 'group.claimed': {
      const tiles = (event.tiles ?? []).map((t: any) => ({
        ...t,
        history: (t.history ?? []).map((m: RawServerMessage) => toChatMessage(m, t.number)),
        queued: (t.queued ?? []).map((m: RawServerMessage) => toChatMessage(m, t.number)),
      }))
      return { ...event, tiles }
    }
    default:
      return event
  }
}

export function connectGroup(group: string, onEvent: (event: ServerEvent) => void) {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  const socket = new WebSocket(`${protocol}://${location.host}/ws`)

  const send = (event: ClientEvent) => socket.send(JSON.stringify(event))

  socket.onopen = () => send({ type: 'group.claim', group })
  socket.onmessage = (e) => onEvent(adapt(JSON.parse(e.data)))

  return { socket, send, close: () => socket.close() }
}
