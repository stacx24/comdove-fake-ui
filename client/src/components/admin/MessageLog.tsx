// Live message log (plan §3.4, PRD FR-11). GET /api/log?limit=100, refreshed every 3 s
// until the server offers a live admin feed (plan §10).
import { useEffect, useState } from 'react'
import { api } from '../../api'
import type { LogEntry, MessageStatus, WebhookOutcome } from '../../types'

const REFRESH_MS = 3000
const STEPS: MessageStatus[] = ['sent', 'delivered', 'read']

interface Props {
  refreshKey: number
  onResetClick: () => void
}

function formatTime(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleTimeString('en-GB', { hour12: false })
}

function webhookText(webhook: WebhookOutcome | undefined): { text: string; color: string } {
  if (!webhook) return { text: '—', color: 'var(--dim)' }
  switch (webhook.state) {
    case 'ok':
      return { text: `${webhook.http_status ?? 200}${webhook.latency_ms != null ? ` · ${webhook.latency_ms}ms` : ''}`, color: 'var(--green)' }
    case 'retrying':
      return { text: `retry ${webhook.attempts}/3${webhook.http_status ? ` · ${webhook.http_status}` : ''}`, color: 'var(--orange)' }
    case 'failed':
      return { text: `failed · ${webhook.http_status ?? 'timeout'}`, color: 'var(--orange)' }
    case 'pending':
      return { text: webhook.note ? `queued · ${webhook.note}` : 'pending', color: 'var(--dim)' }
  }
}

export default function MessageLog({ refreshKey, onResetClick }: Props) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const log = await api.log(100)
        if (cancelled) return
        setEntries([...log].sort((a, b) => b.timestamp - a.timestamp))
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the log.')
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }

    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [refreshKey])

  return (
    <section className="card log" data-testid="message-log">
      <div className="card-header">
        <div className="eyebrow">Live message log</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)' }} data-testid="log-state">
          <span className="dot dot-sm" style={{ background: error ? 'var(--red)' : 'var(--green)' }} />
          <span>{error ? 'not connected' : `streaming · newest first · every ${REFRESH_MS / 1000}s`}</span>
        </div>
        <div className="hint" style={{ marginLeft: 'auto', fontSize: 11 }}>GET /api/log?limit=100</div>
        <button type="button" className="btn btn-danger-outline" data-testid="reset" onClick={onResetClick}>
          Reset
        </button>
      </div>

      <div className="table-scroll" style={{ flex: 1 }}>
        <div className="row row-head log-row">
          <div>Time</div>
          <div>From</div>
          <div>To</div>
          <div>Text</div>
          <div>Status</div>
          <div>Webhook</div>
        </div>

        {entries.map((entry) => {
          const reached = STEPS.indexOf(entry.status)
          const hook = webhookText(entry.webhook)
          return (
            <div key={entry.wamid} className="row log-row" data-testid="log-row">
              <div className="cell-mono" style={{ color: 'var(--muted)' }}>{formatTime(entry.timestamp)}</div>
              <div className="cell-mono">{entry.from}</div>
              <div className="cell-mono">{entry.to}</div>
              <div className="cell-ellipsis" style={{ color: 'var(--text-2)' }} title={entry.body}>{entry.body}</div>
              <div className="chips">
                {STEPS.map((step, i) => (
                  <span key={step} className={`chip ${step}${i <= reached ? ' on' : ''}`}>{step}</span>
                ))}
              </div>
              <div className="cell-mono" style={{ color: hook.color }}>{hook.text}</div>
            </div>
          )
        })}

        {loaded && !error && entries.length === 0 && <div className="empty">No messages yet.</div>}
        {!loaded && <div className="empty">Loading…</div>}
        {error && (
          <div className="empty msg-error" role="alert" data-testid="log-error">
            {error}
          </div>
        )}
      </div>
    </section>
  )
}
