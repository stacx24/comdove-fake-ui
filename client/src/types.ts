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

// GET /api/groups as the server sends it (UI-API-GUIDE.md §1, API Reference). `id` is what
// /client?group= and DELETE /api/groups/{id} use; `locked_since` is unix milliseconds.
export interface Group {
  id: string
  name: string
  count: number
  status: 'free' | 'locked'
  locked_since: number | null
}

// ---- Admin: shapes from the server team's UI-API-GUIDE.md (§2b, §2e) ----
// Times here are unix *milliseconds*, unlike ChatMessage.timestamp.

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
  wamid: string | null
  time: number
  // 'rejected' = a Meta send the mock refused (bad token, forced error): no timeline/webhooks.
  direction?: 'inbound' | 'outbound' | 'rejected'
  source?: string
  from?: string
  to?: string | null
  business?: { phone_number_id: string; label: string }
  group_id?: string | null
  body?: string | null
  status?: MessageStatus
  timeline?: TimelineEvent[]
  webhooks?: WebhookDelivery[]
  // Rejected-request fields (RejectedLogEntryDTO): the Meta error the mock returned.
  phone_number_id?: string
  http_status?: number
  code?: number
  subcode?: number | null
  forced?: boolean
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

// Extra fields marked "API Reference" come from the server team's reference (2026-09-19);
// they are optional until checked against the running server (client plan, mapping item 4).
export type ServerEvent =
  | {
      type: 'group.claimed'
      group: string
      tiles: (TileState & { unread?: number })[]
      business_numbers?: BusinessNumber[] // API Reference
    }
  | { type: 'group.locked'; group: string; since: number }
  | { type: 'message.new'; to: string; number?: string; message: ChatMessage }
  | { type: 'queue.flush'; number: string; messages: ChatMessage[] }
  | { type: 'message.status'; wamid: string; number?: string; status: MessageStatus; at?: number }
  // API Reference: the server echoes what it accepted, and reports problems as `error`.
  | { type: 'tile.presence'; number: string; online: boolean }
  | ({ type: 'tile.autoreply'; number: string } & ServerAutoReply)
  | { type: 'error'; code: string; message: string }

// Codes after which the session can't continue: don't reconnect into them.
export const FATAL_ERROR_CODES = ['already_claimed', 'group_deleted', 'unknown_group'] as const

// ---- Auto-reply (PRD FR-10) ----
// Mock mode keeps it in the browser; in server mode the server runs it (API Reference).

// The server's shape: GET/PUT /api/customers/{number}/auto-reply and the tile.autoreply event.
export interface ServerAutoReply {
  mode: AutoReplyMode
  delay_ms?: number
  rules?: { keyword: string; reply: string }[]
}

export type AutoReplyMode = 'manual' | 'echo' | 'keyword'

export interface AutoReplyConfig {
  mode: AutoReplyMode
  delayMs: number
  keywords: { contains: string; reply: string }[]
}
