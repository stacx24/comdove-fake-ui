// One group's live session: checks the group, connects, folds events into state, exposes tile actions.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { LoopGuard, planReplies } from '../autoreply/engine'
import { loadConfig, saveConfig } from '../autoreply/storage'
import { data, type GroupConnection } from '../data'
import type { AutoReplyConfig, BusinessNumber, ServerEvent } from '../types'
import { initialState, reducer, type SessionState, type UiMessage } from './reducer'

/** Result of looking the group up before connecting. */
export type GroupCheck = 'checking' | 'ok' | 'not-found' | 'error'

export interface TileActions {
  send(from: string, to: string, body: string): void
  /** Re-sends a message shown as "Not sent". */
  retry(message: UiMessage): void
  setPresence(number: string, online: boolean): void
  markRead(number: string, peer: string): void
  /** Saves a tile's auto-reply settings (in this browser) and applies them at once. */
  setAutoReply(number: string, config: AutoReplyConfig): void
}

export interface GroupSession {
  state: SessionState
  check: GroupCheck
  checkError: string | null
  businessNumbers: BusinessNumber[]
  /** Auto-reply settings per tile number. */
  autoReply: Record<string, AutoReplyConfig>
  /** Tiles whose auto-reply hit the loop guard. */
  paused: Record<string, boolean>
  actions: TileActions
  recheck(): void
}

const nowSeconds = () => Math.floor(Date.now() / 1000)
const newLocalId = () => crypto.randomUUID()

export function useGroupSession(group: string): GroupSession {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [check, setCheck] = useState<GroupCheck>('checking')
  const [checkError, setCheckError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [businessNumbers, setBusinessNumbers] = useState<BusinessNumber[]>([])

  const conn = useRef<GroupConnection | null>(null)

  // Auto-reply: settings per tile (saved ones overlaid by changes made in this session).
  const [overrides, setOverrides] = useState<Record<string, AutoReplyConfig>>({})
  const [paused, setPaused] = useState<Record<string, boolean>>({})
  const autoReply = useMemo(
    () => Object.fromEntries(state.order.map((n) => [n, overrides[n] ?? loadConfig(n)])),
    [state.order, overrides],
  )

  // Latest values for the event handler, which lives as long as the connection.
  const stateRef = useRef(state)
  const autoReplyRef = useRef(autoReply)
  useEffect(() => {
    stateRef.current = state
    autoReplyRef.current = autoReply
  })
  const guard = useRef(new LoopGuard())
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  const send = useCallback((from: string, to: string, body: string) => {
    const sent = conn.current?.send({ type: 'message.send', from, to, body }) ?? false
    dispatch({ type: 'local.send', localId: newLocalId(), from, to, body, timestamp: nowSeconds(), sent })
  }, [])

  // Every server event: plan auto-replies against the state *before* it, then apply it.
  const handleEvent = useCallback(
    (event: ServerEvent) => {
      const current = stateRef.current
      const { replies, paused: blocked } = planReplies(event, {
        config: (n) => autoReplyRef.current[n] ?? loadConfig(n),
        isOnline: (n) => !!current.tiles[n]?.online,
        seen: (n, wamid) => !!current.tiles[n]?.history.some((m) => m.wamid === wamid),
        guard: guard.current,
        now: Date.now(),
      })
      dispatch(event)

      for (const r of replies) {
        const timer = setTimeout(() => {
          timers.current.delete(timer)
          // The tile may have gone offline during the delay.
          if (stateRef.current.tiles[r.from]?.online) send(r.from, r.to, r.body)
        }, r.delayMs)
        timers.current.add(timer)
      }
      if (blocked.length || replies.length) {
        setPaused((p) => {
          const next = { ...p }
          for (const r of replies) delete next[r.from]
          for (const n of blocked) next[n] = true
          return next
        })
      }
    },
    [send],
  )

  // Look the group up first: the protocol has no "no such group" event, and a locked group
  // should go straight back to the launch page without claiming anything.
  useEffect(() => {
    let cancelled = false
    let connection: GroupConnection | null = null

    data.listGroups().then(
      (groups) => {
        if (cancelled) return
        const found = groups.find((g) => g.name === group)
        if (!found) return setCheck('not-found')
        setCheck('ok')
        if (found.locked) {
          dispatch({ type: 'group.locked', group, since: found.since ?? 0 })
          return
        }
        connection = data.connectGroup(group, {
          onEvent: handleEvent,
          onState: (s) => dispatch({ type: 'local.connection', state: s }),
        })
        conn.current = connection
      },
      (err: unknown) => {
        if (cancelled) return
        setCheck('error')
        setCheckError(err instanceof Error ? err.message : String(err))
      },
    )

    return () => {
      cancelled = true
      connection?.close() // releases the group lock
      if (conn.current === connection) conn.current = null
    }
  }, [group, attempt, handleEvent])

  // Pending auto-replies die with the page.
  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach(clearTimeout)
      pending.clear()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    data.listBusinessNumbers().then(
      (list) => !cancelled && setBusinessNumbers(list),
      () => {}, // labels fall back to raw numbers
    )
    return () => {
      cancelled = true
    }
  }, [])

  const retry = useCallback((m: UiMessage) => {
    if (!m.localId) return
    const sent = conn.current?.send({ type: 'message.send', from: m.from, to: m.to, body: m.body }) ?? false
    dispatch({ type: 'local.retry', localId: m.localId, sent })
  }, [])

  const setPresence = useCallback((number: string, online: boolean) => {
    dispatch({ type: 'local.presence', number, online })
    conn.current?.send({ type: 'tile.presence', number, online })
  }, [])

  const markRead = useCallback((number: string, peer: string) => {
    dispatch({ type: 'local.read', number, peer })
    conn.current?.send({ type: 'chat.read', number, peer })
  }, [])

  const setAutoReply = useCallback((number: string, config: AutoReplyConfig) => {
    saveConfig(number, config)
    setOverrides((o) => ({ ...o, [number]: config }))
    setPaused((p) => {
      if (!p[number]) return p
      const next = { ...p }
      delete next[number]
      return next
    })
  }, [])

  const actions = useMemo<TileActions>(
    () => ({ send, retry, setPresence, markRead, setAutoReply }),
    [send, retry, setPresence, markRead, setAutoReply],
  )

  // Starts a fresh group lookup (the Retry button after a failed check).
  const recheck = useCallback(() => {
    setCheck('checking')
    setCheckError(null)
    setAttempt((n) => n + 1)
  }, [])

  return { state, check, checkError, businessNumbers, autoReply, paused, actions, recheck }
}
