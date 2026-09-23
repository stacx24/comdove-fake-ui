// Live message log (plan §3.4, §11.1, PRD FR-11). GET /api/log?limit=<LOG_LIMIT>, refreshed every 3 s
// until the server's WebSocket admin feed is wired up (plan §10).
// Shape: UI-API-GUIDE.md §2e — times in milliseconds, one webhook per status with every attempt.
import { Fragment, useEffect, useState } from 'react'
import { api } from '../../api'
import type { LogEntry, MessageStatus, WebhookAttempt, WebhookDelivery } from '../../types'

const REFRESH_MS = 3000
// 5 businesses x 100 tiles is a 500-message run (WS-343); 100 rows would be a few seconds
// of history. The server clamps this at 1000.
const LOG_LIMIT = 500
const STEPS: MessageStatus[] = ['sent', 'delivered', 'read']
const MAX_RETRIES = 3 // Tech Spec §5: up to 3 retries after the first try

interface Props {
  refreshKey: number
  onResetClick: () => void
}

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString('en-GB', { hour12: false })
}

const isOk = (state: string) => state === 'ok'
const isFailing = (state: string) => state === 'retrying' || state === 'failed' || state === 'error'

// Row summary, as in the guide: the latest webhook's last attempt.
function webhookSummary(entry: LogEntry): { text: string; color: string } {
  // A rejected Meta send (bad token / forced error) has no webhooks — show the Meta error code.
  if (entry.direction === 'rejected') {
    const code = entry.code ?? entry.http_status
    return { text: code != null ? `error ${code}` : 'rejected', color: 'var(--red)' }
  }
  // How the server marks a queued message is still to confirm (server-team-questions.md Q4).
  if (entry.status === 'queued') return { text: 'queued · tile offline', color: 'var(--dim)' }

  const latest = (entry.webhooks ?? []).at(-1)
  const last = latest?.attempts.at(-1)
  if (!latest) return { text: '—', color: 'var(--dim)' }
  if (!last) return { text: latest.state, color: 'var(--dim)' }

  const code = last.http_status ?? 'timeout'
  if (isOk(latest.state)) {
    return { text: `${code}${last.duration_ms != null ? ` · ${last.duration_ms}ms` : ''}`, color: 'var(--green)' }
  }
  if (latest.state === 'failed') return { text: `failed · ${code}`, color: 'var(--orange)' }
  if (isFailing(latest.state)) return { text: `retry ${last.n - 1}/${MAX_RETRIES} · ${code}`, color: 'var(--orange)' }
  return { text: latest.state, color: 'var(--dim)' }
}

function attemptText(a: WebhookAttempt) {
  const code = a.http_status ?? 'timeout'
  const took = a.duration_ms != null ? ` · ${a.duration_ms}ms` : ''
  return `#${a.n} ${code}${took} · ${formatTime(a.at)}`
}

function attemptColor(a: WebhookAttempt) {
  return a.http_status && a.http_status >= 200 && a.http_status < 300 ? 'var(--green)' : 'var(--orange)'
}

function WebhookLine({ webhook }: { webhook: WebhookDelivery }) {
  return (
    <div className="log-detail-line">
      <span className="log-detail-kind">{webhook.kind}</span>
      {webhook.attempts.length === 0 && <span>{webhook.state}</span>}
      {webhook.attempts.map((a) => (
        <span key={a.n} style={{ color: attemptColor(a) }}>
          {attemptText(a)}
        </span>
      ))}
    </div>
  )
}

export default function MessageLog({ refreshKey, onResetClick }: Props) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const log = await api.log(LOG_LIMIT)
        if (cancelled) return
        setEntries([...log].sort((a, b) => b.time - a.time))
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

  const toggle = (wamid: string) => setOpen((current) => (current === wamid ? null : wamid))

  return (
    <section className="card log" data-testid="message-log">
      <div className="card-header">
        <div className="eyebrow">Live message log</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)' }} data-testid="log-state">
          <span className="dot dot-sm" style={{ background: error ? 'var(--red)' : 'var(--green)' }} />
          <span>{error ? 'not connected' : `streaming · newest first · every ${REFRESH_MS / 1000}s`}</span>
        </div>
        <div className="hint" style={{ marginLeft: 'auto', fontSize: 11 }}>GET /api/log?limit={LOG_LIMIT} · click a row for webhook attempts</div>
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
          const rejected = entry.direction === 'rejected'
          const timeline = entry.timeline ?? []
          const webhooks = entry.webhooks ?? []
          const rowId = entry.wamid ?? `rej-${entry.time}`
          const reached = new Map(timeline.map((t) => [t.status, t.at]))
          const hook = webhookSummary(entry)
          const isOpen = open === rowId
          return (
            <Fragment key={rowId}>
              <div
                className={`row log-row log-row-button${isOpen ? ' open' : ''}`}
                data-testid={`log-row-${rowId}`}
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                onClick={() => toggle(rowId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggle(rowId)
                  }
                }}
              >
                <div className="cell-mono" style={{ color: 'var(--muted)' }}>{formatTime(entry.time)}</div>
                <div className="cell-mono">{entry.from ?? entry.phone_number_id ?? '—'}</div>
                <div className="cell-mono">{entry.to ?? '—'}</div>
                <div className="cell-ellipsis" style={{ color: 'var(--text-2)' }} title={entry.body ?? ''}>{entry.body ?? '—'}</div>
                <div className="chips">
                  {rejected ? (
                    <span className="chip failed on" style={{ color: 'var(--red)' }}>rejected</span>
                  ) : (
                    STEPS.map((step) => (
                      <span key={step} className={`chip ${step}${reached.has(step) ? ' on' : ''}`}>{step}</span>
                    ))
                  )}
                </div>
                <div className="cell-mono" style={{ color: hook.color }}>{hook.text}</div>
              </div>

              {isOpen && (
                <div className="log-detail" data-testid={`log-detail-${rowId}`}>
                  {rejected ? (
                    <div className="log-detail-line">
                      <span className="log-detail-kind">rejected</span>
                      <span style={{ color: 'var(--red)' }}>
                        Meta error {entry.code ?? '—'}
                        {entry.subcode != null ? ` / ${entry.subcode}` : ''} · HTTP {entry.http_status ?? '—'}
                        {entry.forced ? ' · forced' : ''}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="log-detail-line">
                        <span className="log-detail-kind">timeline</span>
                        {timeline.length === 0 && <span>—</span>}
                        {timeline.map((t) => (
                          <span key={t.status}>
                            {t.status} {formatTime(t.at)}
                          </span>
                        ))}
                      </div>
                      {webhooks.length === 0 && (
                        <div className="log-detail-line">
                          <span className="log-detail-kind">webhooks</span>
                          <span>none yet</span>
                        </div>
                      )}
                      {webhooks.map((w, i) => (
                        <WebhookLine key={`${w.kind}-${i}`} webhook={w} />
                      ))}
                    </>
                  )}
                </div>
              )}
            </Fragment>
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
