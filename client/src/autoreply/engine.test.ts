import { describe, expect, it } from 'vitest'
import type { AutoReplyConfig, ChatMessage, ServerEvent } from '../types'
import { DEFAULT_CONFIG, LoopGuard, decideReply, planReplies, type PlanContext } from './engine'

const TILE = '919876543210'
const SALES = '918888800001'
const SUPPORT = '918888800002'

let seq = 0
const msg = (from: string, to: string, body: string): ChatMessage => ({
  wamid: `w${++seq}`,
  from,
  to,
  body,
  status: 'delivered',
  timestamp: 1,
})
const cfg = (patch: Partial<AutoReplyConfig>): AutoReplyConfig => ({ ...DEFAULT_CONFIG, keywords: [], ...patch })

describe('decideReply', () => {
  it('manual never replies', () => {
    expect(decideReply(cfg({ mode: 'manual' }), msg(SALES, TILE, 'hi'), TILE)).toBeNull()
  })

  it('echo sends the same text back', () => {
    expect(decideReply(cfg({ mode: 'echo' }), msg(SALES, TILE, 'hello there'), TILE)).toBe('hello there')
  })

  it('keyword uses the first matching rule, case-insensitive', () => {
    const c = cfg({
      mode: 'keyword',
      keywords: [
        { contains: 'how much', reply: '₹499' },
        { contains: 'much', reply: 'second rule' },
      ],
    })
    expect(decideReply(c, msg(SALES, TILE, 'HOW MUCH is it?'), TILE)).toBe('₹499')
  })

  it('keyword with no match does not reply', () => {
    const c = cfg({ mode: 'keyword', keywords: [{ contains: 'price', reply: '₹499' }] })
    expect(decideReply(c, msg(SALES, TILE, 'hello'), TILE)).toBeNull()
  })

  it('keyword ignores empty "contains" rules', () => {
    const c = cfg({ mode: 'keyword', keywords: [{ contains: '  ', reply: 'always' }] })
    expect(decideReply(c, msg(SALES, TILE, 'anything'), TILE)).toBeNull()
  })

  it('never answers the tile’s own messages or messages to another tile', () => {
    const c = cfg({ mode: 'echo' })
    expect(decideReply(c, msg(TILE, SALES, 'mine'), TILE)).toBeNull()
    expect(decideReply(c, msg(SALES, '919876543299', 'not for me'), TILE)).toBeNull()
  })
})

describe('LoopGuard', () => {
  it('allows 5 replies per tile/peer per 60s, then blocks', () => {
    const g = new LoopGuard()
    for (let i = 0; i < 5; i++) expect(g.allow(TILE, SALES, 1000 + i)).toBe(true)
    expect(g.allow(TILE, SALES, 1010)).toBe(false)
  })

  it('counts each peer separately', () => {
    const g = new LoopGuard(1)
    expect(g.allow(TILE, SALES, 0)).toBe(true)
    expect(g.allow(TILE, SUPPORT, 0)).toBe(true)
    expect(g.allow(TILE, SALES, 0)).toBe(false)
  })

  it('allows again once the window has passed', () => {
    const g = new LoopGuard(2, 60_000)
    g.allow(TILE, SALES, 0)
    g.allow(TILE, SALES, 1)
    expect(g.allow(TILE, SALES, 59_999)).toBe(false)
    expect(g.allow(TILE, SALES, 60_001)).toBe(true)
  })
})

describe('planReplies', () => {
  const ctx = (patch: Partial<PlanContext> = {}): PlanContext => ({
    config: () => cfg({ mode: 'echo', delayMs: 500 }),
    isOnline: () => true,
    seen: () => false,
    guard: new LoopGuard(),
    now: 0,
    ...patch,
  })

  it('message.new → one reply back to the sender after the delay', () => {
    const e: ServerEvent = { type: 'message.new', to: TILE, message: msg(SALES, TILE, 'hi') }
    expect(planReplies(e, ctx()).replies).toEqual([{ from: TILE, to: SALES, body: 'hi', delayMs: 500 }])
  })

  it('queue.flush → one reply per message, in order, each after its own delay', () => {
    const e: ServerEvent = {
      type: 'queue.flush',
      number: TILE,
      messages: [msg(SALES, TILE, 'one'), msg(SALES, TILE, 'two'), msg(SUPPORT, TILE, 'three')],
    }
    expect(planReplies(e, ctx()).replies).toEqual([
      { from: TILE, to: SALES, body: 'one', delayMs: 500 },
      { from: TILE, to: SALES, body: 'two', delayMs: 1000 },
      { from: TILE, to: SUPPORT, body: 'three', delayMs: 1500 },
    ])
  })

  it('no reply while the tile is offline', () => {
    const e: ServerEvent = { type: 'message.new', to: TILE, message: msg(SALES, TILE, 'hi') }
    expect(planReplies(e, ctx({ isOnline: () => false })).replies).toEqual([])
  })

  it('no reply to a message the tile already has (duplicate event)', () => {
    const e: ServerEvent = { type: 'message.new', to: TILE, message: msg(SALES, TILE, 'hi') }
    expect(planReplies(e, ctx({ seen: () => true })).replies).toEqual([])
  })

  it('manual tiles plan nothing', () => {
    const e: ServerEvent = { type: 'message.new', to: TILE, message: msg(SALES, TILE, 'hi') }
    expect(planReplies(e, ctx({ config: () => cfg({ mode: 'manual' }) })).replies).toEqual([])
  })

  it('past the loop cap: no reply, and the tile is reported paused', () => {
    const guard = new LoopGuard(1)
    const first = planReplies({ type: 'message.new', to: TILE, message: msg(SALES, TILE, 'a') }, ctx({ guard }))
    const second = planReplies({ type: 'message.new', to: TILE, message: msg(SALES, TILE, 'b') }, ctx({ guard }))
    expect(first.replies).toHaveLength(1)
    expect(second).toEqual({ replies: [], paused: [TILE] })
  })

  it('other events plan nothing', () => {
    expect(planReplies({ type: 'message.status', wamid: 'w', status: 'read' }, ctx()).replies).toEqual([])
  })
})
