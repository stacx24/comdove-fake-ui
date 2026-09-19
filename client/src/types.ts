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

// ---- Admin: shapes from the server team's UI-API-GUIDE.md (§2b, §2e) ----
// Times here are unix *milliseconds*, unlike ChatMessage.timestamp.

// GET /api/groups as the server sends it (the client pages still use `Group`).
export interface GroupSummary {
  id: string
  name: string
  count: number
  status: 'free' | 'locked'
  locked_since: number | null
}

// GET /api/customers
export interface Customer {
  number: string
  label: string
  group_id: string
  online: boolean
  effective_online: boolean
  claim_status: 'free' | 'locked'
  reply_mode: string
  type: 'customer'
}

export interface TimelineEvent {
  status: MessageStatus
  at: number
}

export interface WebhookAttempt {
  n: number
  http_status?: number
  duration_ms?: number
  at: number
}

// One webhook per status the mock reported to Comdove (Tech Spec §5: "one webhook per transition").
// The guide only shows state "ok"; the full list is still to confirm (docs/server-team-questions.md Q4).
export interface WebhookDelivery {
  kind: string // "sent" | "delivered" | "read", or the inbound message webhook
  state: string // "ok", "retrying", "failed", "pending", ...
  attempts: WebhookAttempt[]
}

// GET /api/log?limit=100, newest first.
export interface LogEntry {
  wamid: string
  time: number
  direction?: 'inbound' | 'outbound'
  source?: string
  from: string
  to: string
  business?: { phone_number_id: string; label: string }
  group_id?: string | null
  body: string
  status: MessageStatus
  timeline: TimelineEvent[]
  webhooks: WebhookDelivery[]
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
