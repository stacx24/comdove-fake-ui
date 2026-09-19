// Reset confirm (plan §3.5, PRD FR-12). POST /api/reset {keep_numbers}.
import { useEffect, useState } from 'react'
import { api } from '../../api'

interface Props {
  onClose: () => void
  onDone: () => void
}

export default function ResetDialog({ onClose, onDone }: Props) {
  const [keepNumbers, setKeepNumbers] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await api.reset(keepNumbers)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed.')
      setBusy(false)
    }
  }

  return (
    <div className="backdrop" onClick={() => !busy && onClose()}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-title"
        data-testid="reset-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-title" id="reset-title">Reset mock server?</div>
        <div style={{ color: 'var(--muted)', lineHeight: 1.45 }}>
          Wipes all messages and offline queues. Comdove's database is untouched.
        </div>

        <label className="checkbox">
          <input
            type="checkbox"
            data-testid="reset-keep"
            checked={keepNumbers}
            onChange={(e) => setKeepNumbers(e.target.checked)}
          />
          <span>Keep numbers and groups</span>
        </label>

        {error && (
          <div className="msg-error" role="alert" data-testid="reset-error">
            {error}
          </div>
        )}

        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" data-testid="reset-cancel" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" data-testid="reset-confirm" onClick={confirm} disabled={busy} autoFocus>
            {busy ? 'Resetting…' : 'Reset'}
          </button>
        </div>
      </div>
    </div>
  )
}
