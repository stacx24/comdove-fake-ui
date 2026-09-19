import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConnectionState } from './types'

// Minimal stand-in for the browser WebSocket, driven by hand from the tests.
class FakeSocket extends EventTarget {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 3
  static all: FakeSocket[] = []

  readyState = FakeSocket.CONNECTING
  sent: unknown[] = []
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  url: string

  constructor(url: string) {
    super()
    this.url = url
    FakeSocket.all.push(this)
  }
  send(data: string) {
    this.sent.push(JSON.parse(data))
  }
  close() {
    if (this.readyState === FakeSocket.CLOSED) return
    this.readyState = FakeSocket.CLOSED
    this.dispatchEvent(new Event('close'))
  }
  // test helpers
  serverOpens() {
    this.readyState = FakeSocket.OPEN
    this.onopen?.()
    this.dispatchEvent(new Event('open'))
  }
  serverSends(event: unknown) {
    this.onmessage?.({ data: JSON.stringify(event) })
  }
}

async function load() {
  vi.resetModules()
  return (await import('./server')).serverSource
}

function track() {
  const states: ConnectionState[] = []
  const events: unknown[] = []
  return { states, events, handlers: { onState: (s: ConnectionState) => states.push(s), onEvent: (e: unknown) => events.push(e) } }
}

beforeEach(() => {
  FakeSocket.all = []
  vi.stubGlobal('WebSocket', FakeSocket)
  vi.stubGlobal('location', { protocol: 'http:', host: 'localhost:5173' })
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('serverSource.connectGroup', () => {
  it('claims the group on open and reports connecting → open', async () => {
    const source = await load()
    const t = track()
    source.connectGroup('alpha', t.handlers)
    const socket = FakeSocket.all[0]
    expect(socket.url).toBe('ws://localhost:5173/ws')
    socket.serverOpens()
    expect(socket.sent).toEqual([{ type: 'group.claim', group: 'alpha' }])
    expect(t.states).toEqual(['connecting', 'open'])
  })

  it('passes server events through', async () => {
    const source = await load()
    const t = track()
    source.connectGroup('alpha', t.handlers)
    FakeSocket.all[0].serverOpens()
    FakeSocket.all[0].serverSends({ type: 'message.status', wamid: 'w1', status: 'read' })
    expect(t.events).toEqual([{ type: 'message.status', wamid: 'w1', status: 'read' }])
  })

  it('send returns false while the socket is not open, true once it is', async () => {
    const source = await load()
    const conn = source.connectGroup('alpha', track().handlers)
    const event = { type: 'tile.presence', number: '1', online: true } as const
    expect(conn.send(event)).toBe(false)
    FakeSocket.all[0].serverOpens()
    expect(conn.send(event)).toBe(true)
  })

  it('reconnects with backoff after an unexpected close', async () => {
    const source = await load()
    const t = track()
    source.connectGroup('alpha', t.handlers)
    FakeSocket.all[0].serverOpens()
    FakeSocket.all[0].close() // server dropped us
    expect(t.states.at(-1)).toBe('reconnecting')
    vi.advanceTimersByTime(999)
    expect(FakeSocket.all).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(FakeSocket.all).toHaveLength(2)
    FakeSocket.all[1].close() // second failure waits 2s
    vi.advanceTimersByTime(1999)
    expect(FakeSocket.all).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(FakeSocket.all).toHaveLength(3)
  })

  it('does not reconnect after an explicit close', async () => {
    const source = await load()
    const t = track()
    const conn = source.connectGroup('alpha', t.handlers)
    FakeSocket.all[0].serverOpens()
    conn.close()
    vi.advanceTimersByTime(30_000)
    expect(FakeSocket.all).toHaveLength(1)
    expect(t.states.at(-1)).toBe('closed')
  })

  it('stops reconnecting when the claim is refused', async () => {
    const source = await load()
    const t = track()
    source.connectGroup('alpha', t.handlers)
    FakeSocket.all[0].serverOpens()
    FakeSocket.all[0].serverSends({ type: 'group.locked', group: 'alpha', since: 1 })
    vi.advanceTimersByTime(30_000)
    expect(FakeSocket.all).toHaveLength(1)
    expect(t.events).toEqual([{ type: 'group.locked', group: 'alpha', since: 1 }])
  })

  it('waits for the previous socket of the same group to close before claiming again (StrictMode)', async () => {
    const source = await load()
    const first = source.connectGroup('alpha', track().handlers)
    FakeSocket.all[0].serverOpens()

    // StrictMode: close, then connect again straight away. Keep the old socket "closing".
    const old = FakeSocket.all[0]
    old.close = function () {
      this.readyState = FakeSocket.CLOSED // close event not delivered yet
    }
    first.close()
    source.connectGroup('alpha', track().handlers)
    await Promise.resolve()
    expect(FakeSocket.all).toHaveLength(1) // no second claim yet

    old.dispatchEvent(new Event('close'))
    await Promise.resolve()
    expect(FakeSocket.all).toHaveLength(2)
  })
})

describe('server errors on the socket', () => {
  for (const code of ['already_claimed', 'group_deleted', 'unknown_group']) {
    it(`stops reconnecting after ${code}`, async () => {
      const source = await load()
      const t = track()
      source.connectGroup('alpha', t.handlers)
      FakeSocket.all[0].serverOpens()
      FakeSocket.all[0].serverSends({ type: 'error', code, message: 'x' })
      FakeSocket.all[0].close()
      vi.advanceTimersByTime(30_000)
      expect(FakeSocket.all).toHaveLength(1)
      expect(t.events).toEqual([{ type: 'error', code, message: 'x' }])
    })
  }

  it('keeps reconnecting after a non-fatal error', async () => {
    const source = await load()
    source.connectGroup('alpha', track().handlers)
    FakeSocket.all[0].serverOpens()
    FakeSocket.all[0].serverSends({ type: 'error', code: 'tile_offline', message: 'x' })
    FakeSocket.all[0].close()
    vi.advanceTimersByTime(1000)
    expect(FakeSocket.all).toHaveLength(2)
  })
})

describe('auto-reply field mapping (UI-API-GUIDE §3b)', () => {
  it('maps the server shape to ours and back', async () => {
    vi.resetModules()
    const { fromServerAutoReply, toServerAutoReply } = await import('./server')
    const ours = fromServerAutoReply({ mode: 'keyword', delay_ms: 500, rules: [{ keyword: 'price', reply: 'It is 500' }] })
    expect(ours).toEqual({ mode: 'keyword', delayMs: 500, keywords: [{ contains: 'price', reply: 'It is 500' }] })
    expect(toServerAutoReply(ours)).toEqual({ mode: 'keyword', delay_ms: 500, rules: [{ keyword: 'price', reply: 'It is 500' }] })
  })

  it('does not send rules that have no keyword yet', async () => {
    vi.resetModules()
    const { toServerAutoReply } = await import('./server')
    const out = toServerAutoReply({ mode: 'keyword', delayMs: 0, keywords: [{ contains: ' ', reply: 'x' }, { contains: 'hi ', reply: 'hello' }] })
    expect(out.rules).toEqual([{ keyword: 'hi', reply: 'hello' }])
  })

  it('says the server runs auto-reply', async () => {
    const source = await load()
    expect(source.autoReplyOnServer).toBe(true)
  })
})

