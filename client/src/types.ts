// Shapes shared with the mock server. Source: Comdove Mock Server — API Tech Spec §6, §7.

export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed'

export interface ChatMessage {
  wamid: string
  from: string
  to: string
  body: string
  status: MessageStatus
  timestamp: number // unix seconds, same as Meta
}

export interface BusinessNumber {
  phone_number_id: string
  display_number: string
  label: string
  token: string
}

export interface Group {
  name: string
  numbers: string[]
  locked: boolean
  since?: number
}

export interface StatusEvent {
  status: MessageStatus
  timestamp: number
}

export interface LogEntry extends ChatMessage {
  statuses: StatusEvent[]
  webhook?: { http_status?: number; attempts: number; ok: boolean }
}

export interface TileState {
  number: string
  online: boolean
  history: ChatMessage[]
  queued: ChatMessage[]
}

// ---- WebSocket protocol (Tech Spec §7) ----

export type ClientEvent =
  | { type: 'group.claim'; group: string }
  | { type: 'message.send'; from: string; to: string; body: string }
  | { type: 'tile.presence'; number: string; online: boolean }
  | { type: 'chat.read'; number: string; peer: string }

export type ServerEvent =
  | { type: 'group.claimed'; group: string; tiles: TileState[] }
  | { type: 'group.locked'; group: string; since: number }
  | { type: 'message.new'; to: string; message: ChatMessage }
  | { type: 'queue.flush'; number: string; messages: ChatMessage[] }
  | { type: 'message.status'; wamid: string; status: MessageStatus }

// ---- Auto-reply (PRD FR-10), kept in the browser per tile ----

export type AutoReplyMode = 'manual' | 'echo' | 'keyword'

export interface AutoReplyConfig {
  mode: AutoReplyMode
  delayMs: number
  keywords: { contains: string; reply: string }[]
}
