// The ⚙ panel: a tile's auto-reply mode, delay and keyword table (FR-10). Changes apply at once.
import { useEffect, useRef, type RefObject } from 'react'
import { MAX_DELAY_MS } from '../autoreply/engine'
import type { AutoReplyConfig, AutoReplyMode } from '../types'
import styles from './AutoReplyPopover.module.css'

const MODES: AutoReplyMode[] = ['manual', 'echo', 'keyword']

interface Props {
  number: string
  config: AutoReplyConfig
  onChange(config: AutoReplyConfig): void
  onClose(): void
  /** The gear button: clicking it toggles the panel, so it doesn't count as "outside". */
  anchor: RefObject<HTMLElement | null>
}

export default function AutoReplyPopover({ number: n, config, onChange, onClose, anchor }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // Close on Escape or a click outside.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (!ref.current?.contains(target) && !anchor.current?.contains(target)) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [onClose, anchor])

  const set = (patch: Partial<AutoReplyConfig>) => onChange({ ...config, ...patch })
  const setRule = (i: number, patch: Partial<AutoReplyConfig['keywords'][number]>) =>
    set({ keywords: config.keywords.map((k, j) => (j === i ? { ...k, ...patch } : k)) })

  return (
    <div ref={ref} className={styles.popover} role="dialog" aria-label="Auto-reply" data-testid={`autoreply-panel-${n}`}>
      <div className={styles.title}>Auto-reply</div>

      <div className={styles.segments} role="radiogroup" aria-label="Mode">
        {MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={config.mode === mode}
            className={`${styles.segment} ${config.mode === mode ? styles.active : ''}`}
            data-testid={`autoreply-mode-${n}-${mode}`}
            onClick={() => set({ mode })}
          >
            {mode}
          </button>
        ))}
      </div>

      <label className={styles.field}>
        <span>Delay</span>
        <input
          type="number"
          min={0}
          max={MAX_DELAY_MS}
          step={100}
          className={`${styles.input} ${styles.delay} mono`}
          data-testid={`autoreply-delay-${n}`}
          value={config.delayMs}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (Number.isFinite(v)) set({ delayMs: Math.min(Math.max(Math.round(v), 0), MAX_DELAY_MS) })
          }}
        />
        <span>ms</span>
      </label>

      {config.mode === 'keyword' && (
        <div className={styles.rules}>
          {config.keywords.length > 0 && (
            <div className={styles.ruleHead}>
              <span>Contains</span>
              <span>Reply</span>
              <span />
            </div>
          )}
          {config.keywords.map((k, i) => (
            <div key={i} className={styles.rule}>
              <input
                className={styles.input}
                placeholder="how much"
                data-testid={`autoreply-contains-${n}-${i}`}
                value={k.contains}
                onChange={(e) => setRule(i, { contains: e.target.value })}
              />
              <input
                className={styles.input}
                placeholder="₹499"
                data-testid={`autoreply-reply-${n}-${i}`}
                value={k.reply}
                onChange={(e) => setRule(i, { reply: e.target.value })}
              />
              <button
                type="button"
                className={styles.remove}
                aria-label="Remove rule"
                data-testid={`autoreply-remove-${n}-${i}`}
                onClick={() => set({ keywords: config.keywords.filter((_, j) => j !== i) })}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className={styles.add}
            data-testid={`autoreply-add-rule-${n}`}
            onClick={() => set({ keywords: [...config.keywords, { contains: '', reply: '' }] })}
          >
            + Add rule
          </button>
          <div className={styles.hint}>First matching rule wins; matching ignores case.</div>
        </div>
      )}

      {config.mode === 'echo' && <div className={styles.hint}>Replies with the same text it receives.</div>}
    </div>
  )
}
