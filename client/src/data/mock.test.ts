import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServerEvent, TileState } from '../types'
import { mockSource } from './mock'
import { businessNumbers, groups, OTP, SALES, SUPPORT, tilesByGroup } from './mockData'

const BUSINESS = new Set(businessNumbers.map((b) => b.display_number))
const tile = (group: string, suffix: string) =>
  tilesByGroup[group].find((t) => t.number.endsWith(suffix)) as TileState
const incoming = (t: TileState) => t.history.filter((m) => m.to === t.number)
const peers = (t: TileState) => new Set(incoming(t).map((m) => m.from))

function setSearch(search: string) {
  vi.stubGlobal('location', { search })
}

beforeEach(() => setSearch(''))
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('mock data shape', () => {
  it('has the four groups, with beta locked', () => {
    expect(groups.map((g) => [g.id, g.name, g.count, g.status])).toEqual([
      ['alpha', 'alpha', 8, 'free'],
      ['beta', 'beta', 10, 'locked'],
      ['gamma', 'gamma', 5, 'free'],
      ['load-test', 'load-test', 10, 'free'],
    ])
    expect(groups[1].locked_since).toBeGreaterThan(1e12) // milliseconds, like the server
  })

  it('has one tile per group number', () => {
    for (const g of groups) expect(tilesByGroup[g.id]).toHaveLength(g.count)
  })

  it('only has messages between the tile and a business number', () => {
    for (const tiles of Object.values(tilesByGroup)) {
      for (const t of tiles) {
        for (const m of [...t.history, ...t.queued]) {
          const pair = [m.from, m.to]
          expect(pair).toContain(t.number)
          expect(BUSINESS.has(m.from) || BUSINESS.has(m.to)).toBe(true)
          expect(m.wamid).toMatch(/^wamid\.MOCK-/)
        }
      }
    }
  })

  it('keeps each history in time order and wamids unique', () => {
    const seen = new Set<string>()
    for (const tiles of Object.values(tilesByGroup)) {
      for (const t of tiles) {
        const times = t.history.map((m) => m.timestamp)
        expect(times).toEqual([...times].sort((a, b) => a - b))
        for (const m of [...t.history, ...t.queued]) {
          expect(seen.has(m.wamid)).toBe(false)
          seen.add(m.wamid)
        }
      }
    }
  })
})

describe('alpha covers every tile state', () => {
  it('…210: unread badge (last Comdove message delivered)', () => {
    const t = tile('alpha', '210')
    expect(incoming(t).filter((m) => m.status !== 'read')).toHaveLength(1)
  })

  it('…211: all three ticks', () => {
    expect(incoming(tile('alpha', '211')).map((m) => m.status)).toEqual(['read', 'delivered', 'sent'])
  })

  it('…212: offline with 2 queued', () => {
    const t = tile('alpha', '212')
    expect(t.online).toBe(false)
    expect(t.queued).toHaveLength(2)
    expect(t.queued.every((m) => m.status === 'queued')).toBe(true)
  })

  it('…213: a single message', () => {
    expect(tile('alpha', '213').history).toHaveLength(1)
  })

  it('…214: two business numbers, Support wrote last', () => {
    const t = tile('alpha', '214')
    expect(peers(t)).toEqual(new Set([SALES, SUPPORT]))
    expect(incoming(t).at(-1)?.from).toBe(SUPPORT)
  })

  it('…215: offline, nothing queued', () => {
    const t = tile('alpha', '215')
    expect([t.online, t.queued.length]).toEqual([false, 0])
    expect(peers(t)).toEqual(new Set([OTP]))
  })

  it('…216: empty', () => {
    expect(tile('alpha', '216').history).toHaveLength(0)
  })

  it("…217: the customer's own message marked read by Comdove", () => {
    const t = tile('alpha', '217')
    const own = t.history.filter((m) => m.from === t.number)
    expect(own.map((m) => m.status)).toEqual(['read'])
  })

  it('header counts: 6 of 8 online, 2 queued', () => {
    const tiles = tilesByGroup.alpha
    expect(tiles.filter((t) => t.online)).toHaveLength(6)
    expect(tiles.reduce((n, t) => n + t.queued.length, 0)).toBe(2)
  })

  it('load-test: every chat is long enough to scroll', () => {
    expect(tilesByGroup['load-test'].every((t) => t.history.length >= 15)).toBe(true)
  })
})

describe('mockSource', () => {
  it('lists groups and business numbers', async () => {
    expect(await mockSource.listGroups()).toHaveLength(4)
    expect(await mockSource.listBusinessNumbers()).toHaveLength(3)
  })

  it('returns copies, so callers cannot change the mock data', async () => {
    const list = await mockSource.listGroups()
    list[0].name = 'changed'
    expect(groups[0].name).toBe('alpha')
  })

  it('?mock=empty returns no groups', async () => {
    setSearch('?mock=empty')
    expect(await mockSource.listGroups()).toEqual([])
  })

  it('?mock=error rejects', async () => {
    setSearch('?mock=error')
    await expect(mockSource.listGroups()).rejects.toThrow('Mock server unreachable')
  })

  it('?mock=slow resolves after 1.5s', async () => {
    vi.useFakeTimers()
    setSearch('?mock=slow')
    let done = false
    void mockSource.listGroups().then(() => (done = true))
    await vi.advanceTimersByTimeAsync(1499)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(done).toBe(true)
  })
})

describe('mockSource.connectGroup', () => {
  function connect(group: string) {
    vi.useFakeTimers()
    const events: ServerEvent[] = []
    const states: string[] = []
    const conn = mockSource.connectGroup(group, {
      onEvent: (e) => events.push(e),
      onState: (s) => states.push(s),
    })
    return { conn, events, states }
  }

  it('reports mock state and sends one snapshot, then nothing', () => {
    const { events, states } = connect('alpha')
    vi.advanceTimersByTime(60_000)
    expect(states).toEqual(['mock'])
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('group.claimed')
    if (events[0].type === 'group.claimed') expect(events[0].tiles).toHaveLength(8)
  })

  it('refuses a locked group', () => {
    const { events } = connect('beta')
    vi.advanceTimersByTime(0)
    expect(events.map((e) => e.type)).toEqual(['group.locked'])
  })

  it('sends nothing for an unknown group', () => {
    const { events } = connect('nope')
    vi.advanceTimersByTime(60_000)
    expect(events).toEqual([])
  })

  it('sends nothing if closed straight away (StrictMode first mount)', () => {
    const { conn, events } = connect('alpha')
    conn.close()
    vi.advanceTimersByTime(60_000)
    expect(events).toEqual([])
  })

  it('accepts sends without doing anything', () => {
    const { conn, events } = connect('alpha')
    vi.advanceTimersByTime(0)
    expect(conn.send({ type: 'message.send', from: '1', to: '2', body: 'hi' })).toBe(true)
    vi.advanceTimersByTime(60_000)
    expect(events).toHaveLength(1)
  })
})
