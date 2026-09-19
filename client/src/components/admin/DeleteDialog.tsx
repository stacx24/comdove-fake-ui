// Delete confirm for a business number or a group (plan §11.2, UI-API-GUIDE.md §2c).
import { useEffect, useState } from 'react'
import { ApiError, api } from '../../api'

export type DeleteTarget =
  | { kind: 'number'; phone_number_id: string; number: string; label: string }
  | { kind: 'group'; id: string; name: string; count: number }

interface Props {
  target: DeleteTarget
  onClose: () => void
  onDone: () => void
}

export default function DeleteDialog({ target, onClose, onDone }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const isGroup = target.kind === 'group'
  const title = isGroup ? `Delete group ${target.name}?` : `Delete +${target.number}?`
  const detail = isGroup
    ? `Removes the group and its ${target.count} customer number${target.count === 1 ? '' : 's'}.`
    : `${target.label ? `${target.label}: ` : ''}Comdove can no longer send from this number.`

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      if (isGroup) await api.deleteGroup(target.id)
      else await api.deleteBusinessNumber(target.phone_number_id)
      onDone()
    } catch (err) {
      // 409 on a group = someone has it open in the client grid (UI-API-GUIDE.md §2c).
      if (isGroup && err instanceof ApiError && err.status === 409) {
        setError(`Group ${target.name} is open in a browser — close it first.`)
      } else {
        setError(err instanceof Error ? err.message : 'Delete failed.')
      }
      setBusy(false)
    }
  }

  return (
    <div className="backdrop" onClick={() => !busy && onClose()}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        data-testid="delete-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-title" id="delete-title">{title}</div>
        <div style={{ color: 'var(--muted)', lineHeight: 1.45 }}>{detail}</div>

        {error && (
          <div className="msg-error" role="alert" data-testid="delete-error">
            {error}
          </div>
        )}

        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" data-testid="delete-cancel" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" data-testid="delete-confirm" onClick={confirm} disabled={busy} autoFocus>
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
