import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG } from './engine'
import { loadConfig, sanitize, saveConfig } from './storage'

function memoryStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('auto-reply storage', () => {
  it('defaults to manual, 800ms, no keywords', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    expect(loadConfig('1')).toEqual(DEFAULT_CONFIG)
  })

  it('saves and loads per tile', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    const c = { mode: 'keyword' as const, delayMs: 1200, keywords: [{ contains: 'how much', reply: '₹499' }] }
    saveConfig('1', c)
    expect(loadConfig('1')).toEqual(c)
    expect(loadConfig('2')).toEqual(DEFAULT_CONFIG)
  })

  it('falls back to defaults when storage throws (private window)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(() => saveConfig('1', DEFAULT_CONFIG)).not.toThrow()
    expect(loadConfig('1')).toEqual(DEFAULT_CONFIG)
  })

  it('falls back to defaults on broken JSON', () => {
    const s = memoryStorage()
    s.setItem('comdove-mock:autoreply:1', '{not json')
    vi.stubGlobal('localStorage', s)
    expect(loadConfig('1')).toEqual(DEFAULT_CONFIG)
  })

  it('sanitize fixes bad values', () => {
    expect(sanitize({ mode: 'bogus', delayMs: 99_999, keywords: [{ contains: 1 }, null, 'x'] })).toEqual({
      mode: 'manual',
      delayMs: 10_000,
      keywords: [{ contains: '1', reply: '' }],
    })
    expect(sanitize({ mode: 'echo', delayMs: -5 }).delayMs).toBe(0)
    expect(sanitize(null)).toEqual(DEFAULT_CONFIG)
  })
})
