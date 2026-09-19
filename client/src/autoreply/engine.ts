// Auto-reply (FR-10): decides whether a tile answers an incoming message, and what. Pure.
import type { AutoReplyConfig, ChatMessage, ServerEvent } from '../types'

export const DEFAULT_CONFIG: AutoReplyConfig = { mode: 'manual', delayMs: 800, keywords: [] }
export const MAX_DELAY_MS = 10_000

/** The reply text, or null for no reply. Only answers messages sent to this tile by someone else. */
export function decideReply(cfg: AutoReplyConfig, incoming: ChatMessage, tile: string): string | null {
  if (incoming.to !== tile || incoming.from === tile) return null
  switch (cfg.mode) {
    case 'manual':
      return null
    case 'echo':
      return incoming.body
    case 'keyword': {
      const body = incoming.body.toLowerCase()
      const rule = cfg.keywords.find((k) => k.contains.trim() && body.includes(k.contains.trim().toLowerCase()))
      return rule ? rule.reply : null
    }
  }
}

/**
 * Stops endless conversations, e.g. an echo tile talking to an echoing bot:
 * at most `max` auto-replies per tile/peer pair within `windowMs`.
 */
export class LoopGuard {
  private readonly sent = new Map<string, number[]>()
  private readonly max: number
  private readonly windowMs: number

  constructor(max = 5, windowMs = 60_000) {
    this.max = max
    this.windowMs = windowMs
  }

  /** Records a reply and returns true, or returns false if the pair is over its limit. */
  allow(tile: string, peer: string, now: number): boolean {
    const key = `${tile}>${peer}`
    const recent = (this.sent.get(key) ?? []).filter((t) => now - t < this.windowMs)
    if (recent.length >= this.max) {
      this.sent.set(key, recent)
      return false
    }
    recent.push(now)
    this.sent.set(key, recent)
    return true
  }
}

export interface PlannedReply {
  from: string
  to: string
  body: string
  delayMs: number
}

export interface PlanContext {
  config(tile: string): AutoReplyConfig
  isOnline(tile: string): boolean
  /** True if the tile already has this message: a duplicate event must not trigger a second reply. */
  seen(tile: string, wamid: string): boolean
  guard: LoopGuard
  now: number
}

/**
 * The replies a server event should trigger. A queue flush (several messages at once, e.g. after
 * reopening a group) gets one reply per message, in order, each after its own delay.
 */
export function planReplies(event: ServerEvent, ctx: PlanContext): { replies: PlannedReply[]; paused: string[] } {
  const incoming: { tile: string; message: ChatMessage }[] =
    event.type === 'message.new'
      ? [{ tile: event.to, message: event.message }]
      : event.type === 'queue.flush'
        ? event.messages.map((message) => ({ tile: event.number, message }))
        : []

  const replies: PlannedReply[] = []
  const paused = new Set<string>()
  const perTile = new Map<string, number>()

  for (const { tile, message } of incoming) {
    if (!ctx.isOnline(tile) || ctx.seen(tile, message.wamid)) continue
    const cfg = ctx.config(tile)
    const body = decideReply(cfg, message, tile)
    if (body === null) continue
    if (!ctx.guard.allow(tile, message.from, ctx.now)) {
      paused.add(tile)
      continue
    }
    const nth = (perTile.get(tile) ?? 0) + 1
    perTile.set(tile, nth)
    replies.push({ from: tile, to: message.from, body, delayMs: cfg.delayMs * nth })
  }
  return { replies, paused: [...paused] }
}
