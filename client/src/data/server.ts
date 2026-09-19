// DataSource backed by the real mock server: Control API over HTTP, group session over WebSocket.
import { api } from '../api'
import { sanitize } from '../autoreply/storage'
import { FATAL_ERROR_CODES, type AutoReplyConfig, type ServerAutoReply } from '../types'
import { connectGroup as openSocket } from '../ws'
import type { DataSource, GroupConnection, GroupHandlers } from './types'

const MAX_BACKOFF_MS = 10_000

// Sockets still closing, per group. A new claim waits for the old socket to close,
// otherwise React StrictMode's connect → close → connect in dev gets our own tab refused.
const closing = new Map<string, Promise<void>>()

function connectGroup(group: string, handlers: GroupHandlers): GroupConnection {
  let current: ReturnType<typeof openSocket> | null = null
  let stopped = false
  let attempt = 0
  let retryTimer: ReturnType<typeof setTimeout> | undefined

  const open = () => {
    if (stopped) return
    const conn = openSocket(group, (event) => {
      // The server refused the claim, or the group is gone: don't keep reconnecting into it.
      if (event.type === 'group.locked') stop()
      if (event.type === 'error' && (FATAL_ERROR_CODES as readonly string[]).includes(event.code)) stop()
      handlers.onEvent(event)
    })
    current = conn

    const closed = new Promise<void>((resolve) =>
      conn.socket.addEventListener('close', () => resolve(), { once: true }),
    )
    closing.set(group, closed)

    conn.socket.addEventListener('open', () => {
      attempt = 0
      handlers.onState('open')
    })
    conn.socket.addEventListener('close', () => {
      if (closing.get(group) === closed) closing.delete(group)
      if (current === conn) current = null
      if (stopped) {
        handlers.onState('closed')
        return
      }
      const delay = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS)
      attempt += 1
      handlers.onState('reconnecting')
      retryTimer = setTimeout(open, delay)
    })
  }

  const stop = () => {
    stopped = true
    clearTimeout(retryTimer)
    if (current) current.close()
    else handlers.onState('closed')
  }

  handlers.onState('connecting')
  const previous = closing.get(group)
  if (previous) void previous.then(open)
  else open()

  return {
    send(event) {
      if (!current || current.socket.readyState !== WebSocket.OPEN) return false
      current.send(event)
      return true
    },
    close: stop,
  }
}

// Auto-reply field names differ: ours `delayMs` / `keywords[{contains, reply}]`,
// the server's `delay_ms` / `rules[{keyword, reply}]` (UI-API-GUIDE.md §3b).
export function fromServerAutoReply(value: ServerAutoReply): AutoReplyConfig {
  return sanitize({
    mode: value.mode,
    delayMs: value.delay_ms,
    keywords: (value.rules ?? []).map((r) => ({ contains: r.keyword, reply: r.reply })),
  })
}

export function toServerAutoReply(config: AutoReplyConfig): ServerAutoReply {
  return {
    mode: config.mode,
    delay_ms: config.delayMs,
    // Rows still being typed (no keyword yet) stay in the panel but aren't sent.
    rules: config.keywords.filter((k) => k.contains.trim()).map((k) => ({ keyword: k.contains.trim(), reply: k.reply })),
  }
}

export const serverSource: DataSource = {
  listGroups: api.listGroups,
  listBusinessNumbers: api.listBusinessNumbers,
  connectGroup,
  autoReplyOnServer: true,
  getAutoReply: async (number) => fromServerAutoReply(await api.getAutoReply(number)),
  saveAutoReply: async (number, config) => {
    await api.putAutoReply(number, toServerAutoReply(config))
  },
}
