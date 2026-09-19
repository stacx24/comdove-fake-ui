import { describe, expect, it } from 'vitest'
import type { ChatMessage, MessageStatus, TileState } from '../types'
import {
  initialState,
  lastSender,
  onlineCount,
  peers,
  reducer,
  totalQueued,
  unread,
  type Action,
  type SessionState,
} from './reducer'

const T1 = '919876543210'
const T2 = '919876543211'
const SALES = '918888800001'
const SUPPORT = '918888800002'

const msg = (wamid: string, from: string, to: string, status: MessageStatus = 'delivered', ts = 100): ChatMessage => ({
  wamid,
  from,
  to,
  body: wamid,
  status,
  timestamp: ts,
})

function claimed(tiles: TileState[]): SessionState {
  return reducer(initialState, { type: 'group.claimed', group: 'alpha', tiles })
}

const base = () =>
  claimed([
    { number: T1, online: true, history: [msg('w1', SALES, T1, 'delivered')], queued: [] },
    { number: T2, online: false, history: [], queued: [msg('q1', SALES, T2, 'queued'), msg('q2', SALES, T2, 'queued')] },
  ])

const run = (state: SessionState, ...actions: Action[]) => actions.reduce(reducer, state)
const find = (s: SessionState, number: string, wamid: string) =>
  s.tiles[number].history.find((m) => m.wamid === wamid)

describe('server events', () => {
  it('group.claimed → ready, tiles in server order', () => {
    const s = base()
    expect(s.phase).toBe('ready')
    expect(s.order).toEqual([T1, T2])
  })

  it('group.claimed replaces all tiles on reconnect', () => {
    const s = run(base(), {
      type: 'group.claimed',
      group: 'alpha',
      tiles: [{ number: T2, online: true, history: [], queued: [] }],
    })
    expect(s.order).toEqual([T2])
    expect(s.tiles[T1]).toBeUndefined()
  })

  it('group.locked → locked with since', () => {
    const s = reducer(initialState, { type: 'group.locked', group: 'alpha', since: 42 })
    expect([s.phase, s.lockedSince]).toEqual(['locked', 42])
  })

  it('message.new appends to the right tile', () => {
    const s = run(base(), { type: 'message.new', to: T1, message: msg('w2', SUPPORT, T1) })
    expect(s.tiles[T1].history.map((m) => m.wamid)).toEqual(['w1', 'w2'])
  })

  it('message.new ignores a duplicate wamid', () => {
    const s = run(base(), { type: 'message.new', to: T1, message: msg('w1', SALES, T1) })
    expect(s.tiles[T1].history).toHaveLength(1)
  })

  it('message.new for an unknown tile changes nothing', () => {
    const before = base()
    expect(reducer(before, { type: 'message.new', to: 'nobody', message: msg('x', SALES, 'nobody') })).toBe(before)
  })

  it('queue.flush appends in order, deduplicated, and clears the queue', () => {
    const s = run(base(), {
      type: 'queue.flush',
      number: T2,
      messages: [msg('q1', SALES, T2), msg('q2', SALES, T2), msg('q1', SALES, T2)],
    })
    expect(s.tiles[T2].history.map((m) => m.wamid)).toEqual(['q1', 'q2'])
    expect(s.tiles[T2].queued).toEqual([])
  })

  it('message.status moves a status up', () => {
    const s = run(base(), { type: 'message.status', wamid: 'w1', status: 'read' })
    expect(find(s, T1, 'w1')?.status).toBe('read')
  })

  it('message.status never moves a status down', () => {
    const s = run(
      base(),
      { type: 'message.status', wamid: 'w1', status: 'read' },
      { type: 'message.status', wamid: 'w1', status: 'delivered' },
      { type: 'message.status', wamid: 'w1', status: 'sent' },
    )
    expect(find(s, T1, 'w1')?.status).toBe('read')
  })

  it('message.status accepts read with no delivered before it', () => {
    const s0 = run(base(), { type: 'message.new', to: T1, message: msg('w3', SALES, T1, 'sent') })
    const s = run(s0, { type: 'message.status', wamid: 'w3', status: 'read' })
    expect(find(s, T1, 'w3')?.status).toBe('read')
  })

  it('message.status failed only replaces queued or sent', () => {
    const s0 = run(base(), { type: 'message.new', to: T1, message: msg('w3', SALES, T1, 'sent') })
    expect(find(run(s0, { type: 'message.status', wamid: 'w3', status: 'failed' }), T1, 'w3')?.status).toBe('failed')
    expect(find(run(base(), { type: 'message.status', wamid: 'w1', status: 'failed' }), T1, 'w1')?.status).toBe(
      'delivered',
    )
  })

  it('message.status also updates queued messages', () => {
    const s = run(base(), { type: 'message.status', wamid: 'q1', status: 'delivered' })
    expect(s.tiles[T2].queued[0].status).toBe('delivered')
  })

  it('message.status for an unknown wamid returns the same state', () => {
    const before = base()
    expect(reducer(before, { type: 'message.status', wamid: 'nope', status: 'read' })).toBe(before)
  })
})

describe('local actions', () => {
  const send = (sent: boolean): Action => ({
    type: 'local.send',
    localId: 'L1',
    from: T1,
    to: SALES,
    body: 'hello',
    timestamp: 500,
    sent,
  })

  it('local.send shows the message at once', () => {
    const s = run(base(), send(true))
    const last = s.tiles[T1].history.at(-1)
    expect(last).toMatchObject({ localId: 'L1', from: T1, to: SALES, body: 'hello', timestamp: 500 })
    expect(last?.pending).toBeUndefined()
  })

  it('local.send marks it failed when it could not be sent', () => {
    expect(run(base(), send(false)).tiles[T1].history.at(-1)?.pending).toBe('failed')
  })

  it('local.retry clears failed once sent', () => {
    const s = run(base(), send(false), { type: 'local.retry', localId: 'L1', sent: true })
    expect(s.tiles[T1].history.at(-1)?.pending).toBeUndefined()
  })

  it('local.retry that fails again keeps it failed', () => {
    const s = run(base(), send(false), { type: 'local.retry', localId: 'L1', sent: false })
    expect(s.tiles[T1].history.at(-1)?.pending).toBe('failed')
  })

  it('local.presence flips online', () => {
    const s = run(base(), { type: 'local.presence', number: T2, online: true })
    expect(s.tiles[T2].online).toBe(true)
  })

  it('local.read marks that peer’s incoming messages read, and only those', () => {
    const s0 = run(
      base(),
      { type: 'message.new', to: T1, message: msg('w2', SUPPORT, T1) },
      send(true),
    )
    const s = run(s0, { type: 'local.read', number: T1, peer: SALES })
    expect(find(s, T1, 'w1')?.status).toBe('read')
    expect(find(s, T1, 'w2')?.status).toBe('delivered') // Support, not Sales
    expect(s.tiles[T1].history.at(-1)?.status).toBe('sent') // own message untouched
  })

  it('a late server delivered does not undo local.read', () => {
    const s = run(
      base(),
      { type: 'local.read', number: T1, peer: SALES },
      { type: 'message.status', wamid: 'w1', status: 'delivered' },
    )
    expect(find(s, T1, 'w1')?.status).toBe('read')
  })

  it('local.connection sets the connection state', () => {
    expect(run(base(), { type: 'local.connection', state: 'mock' }).connection).toBe('mock')
  })
})

describe('selectors', () => {
  it('unread counts incoming messages not read', () => {
    const s = run(base(), { type: 'message.new', to: T1, message: msg('w2', SUPPORT, T1, 'sent') })
    expect(unread(s.tiles[T1])).toBe(2)
    expect(unread(run(s, { type: 'local.read', number: T1, peer: SALES }).tiles[T1])).toBe(1)
  })

  it('peers lists business numbers, most recent first', () => {
    const s = run(
      base(),
      { type: 'message.new', to: T1, message: msg('w2', SUPPORT, T1) },
      { type: 'local.send', localId: 'L1', from: T1, to: SALES, body: 'x', timestamp: 1, sent: true },
    )
    expect(peers(s.tiles[T1])).toEqual([SALES, SUPPORT])
  })

  it('lastSender is who wrote to the tile last, ignoring own messages', () => {
    const s = run(
      base(),
      { type: 'message.new', to: T1, message: msg('w2', SUPPORT, T1) },
      { type: 'local.send', localId: 'L1', from: T1, to: SALES, body: 'x', timestamp: 1, sent: true },
    )
    expect(lastSender(s.tiles[T1])).toBe(SUPPORT)
    expect(lastSender(s.tiles[T2])).toBeUndefined()
  })

  it('onlineCount and totalQueued', () => {
    const s = base()
    expect([onlineCount(s), totalQueued(s)]).toEqual([1, 2])
  })
})

describe('with the mock data', () => {
  it('alpha opens as 6/8 online, 2 queued', async () => {
    const { tilesByGroup } = await import('../data/mockData')
    const s = claimed(tilesByGroup.alpha)
    expect([onlineCount(s), s.order.length, totalQueued(s)]).toEqual([6, 8, 2])
  })
})
