// Per-tile auto-reply settings, kept in this browser (localStorage). Never throws:
// private windows and blocked storage fall back to the defaults.
import type { AutoReplyConfig, AutoReplyMode } from '../types'
import { DEFAULT_CONFIG, MAX_DELAY_MS } from './engine'

const MODES: AutoReplyMode[] = ['manual', 'echo', 'keyword']
const key = (number: string) => `comdove-mock:autoreply:${number}`

/** Anything read back is checked, so a hand-edited or old value can't break the tile. */
export function sanitize(value: unknown): AutoReplyConfig {
  const v = (value ?? {}) as Partial<AutoReplyConfig>
  const mode = MODES.includes(v.mode as AutoReplyMode) ? (v.mode as AutoReplyMode) : DEFAULT_CONFIG.mode
  const delay = Number(v.delayMs)
  const delayMs = Number.isFinite(delay) ? Math.min(Math.max(Math.round(delay), 0), MAX_DELAY_MS) : DEFAULT_CONFIG.delayMs
  const keywords = Array.isArray(v.keywords)
    ? v.keywords
        .filter((k) => k && typeof k === 'object')
        .map((k) => ({ contains: String(k.contains ?? ''), reply: String(k.reply ?? '') }))
    : []
  return { mode, delayMs, keywords }
}

export function loadConfig(number: string): AutoReplyConfig {
  try {
    const raw = localStorage.getItem(key(number))
    return raw ? sanitize(JSON.parse(raw)) : { ...DEFAULT_CONFIG, keywords: [] }
  } catch {
    return { ...DEFAULT_CONFIG, keywords: [] }
  }
}

export function saveConfig(number: string, config: AutoReplyConfig): void {
  try {
    localStorage.setItem(key(number), JSON.stringify(config))
  } catch {
    // Storage unavailable: the setting still applies for this page view.
  }
}
