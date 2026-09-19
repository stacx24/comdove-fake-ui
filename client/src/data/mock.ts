// DataSource backed by static mock data. No server behaviour: no timers, ticks, queues or locks.
// It hands the UI one snapshot per group; the UI's own local actions do the rest.
//
// For the launch page's other states, add ?mock=empty | error | slow to the URL.
import { businessNumbers, groups, tilesByGroup } from './mockData'
import type { DataSource } from './types'

type MockMode = 'empty' | 'error' | 'slow' | null

function mockMode(): MockMode {
  const mode = new URLSearchParams(location.search).get('mock')
  return mode === 'empty' || mode === 'error' || mode === 'slow' ? mode : null
}

const SLOW_MS = 1500

// Copies, so a caller changing what it gets back can never alter the mock data itself.
const copy = <T>(value: T): T => structuredClone(value)

function respond<T>(value: T): Promise<T> {
  const mode = mockMode()
  if (mode === 'error') return Promise.reject(new Error('Mock server unreachable'))
  if (mode === 'slow') return new Promise((resolve) => setTimeout(() => resolve(copy(value)), SLOW_MS))
  return Promise.resolve(copy(value))
}

export const mockSource: DataSource = {
  listGroups: () => respond(mockMode() === 'empty' ? [] : groups),
  listBusinessNumbers: () => respond(businessNumbers),

  connectGroup(group, handlers) {
    handlers.onState('mock')

    const found = groups.find((g) => g.name === group)
    const emit = () => {
      if (!found) return // unknown group: nothing arrives; the grid shows "not found"
      if (found.locked) {
        handlers.onEvent({ type: 'group.locked', group, since: found.since ?? 0 })
        return
      }
      handlers.onEvent({ type: 'group.claimed', group, tiles: copy(tilesByGroup[group] ?? []) })
    }

    // Deliver after the caller has its connection object, like a real socket would.
    const timer = setTimeout(emit, mockMode() === 'slow' ? SLOW_MS : 0)

    return {
      send: () => true,
      close: () => clearTimeout(timer),
    }
  },
}
