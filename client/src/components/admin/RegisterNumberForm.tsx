// Register business number (plan §3.1, PRD FR-01). POST /api/business-numbers.
import { useState, type FormEvent } from 'react'
import { api } from '../../api'
import { checkPhone } from '../../validation'

interface Props {
  isKnownNumber: (number: string) => boolean
  onRegistered: () => void
}

export default function RegisterNumberForm({ isKnownNumber, onRegistered }: Props) {
  const [number, setNumber] = useState('')
  const [label, setLabel] = useState('')
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [wabaId, setWabaId] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ number: string; phone_number_id: string; token: string } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const display_number = number.trim()
    const problem = checkPhone(display_number) ?? (isKnownNumber(display_number) ? `${display_number} is already registered.` : null)
    setCreated(null)
    if (problem) {
      setError(problem)
      return
    }

    setBusy(true)
    setError(null)
    try {
      const result = await api.registerBusinessNumber(display_number, label.trim(), {
        phone_number_id: phoneNumberId.trim() || undefined,
        waba_id: wabaId.trim() || undefined,
        token: token.trim() || undefined,
      })
      setCreated({ number: display_number, ...result })
      setNumber('')
      setLabel('')
      setPhoneNumberId('')
      setWabaId('')
      setToken('')
      onRegistered()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card card-pad" onSubmit={submit} noValidate>
      <div className="eyebrow">Register business number</div>

      <div className="field">
        <label htmlFor="reg-number">Display number</label>
        <input
          id="reg-number"
          data-testid="reg-number"
          className="input mono"
          inputMode="numeric"
          placeholder="918888800004"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="reg-label">Label</label>
        <input
          id="reg-label"
          data-testid="reg-label"
          className="input"
          placeholder="Support line"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>

      <div className="hint" style={{ marginTop: 4 }}>
        Optional — fill these to match a number already registered in ComDove. Leave blank to auto-generate.
      </div>

      <div className="field">
        <label htmlFor="reg-pnid">phone_number_id</label>
        <input
          id="reg-pnid"
          data-testid="reg-pnid"
          className="input mono"
          placeholder="PHONE_DEMO_WS205"
          value={phoneNumberId}
          onChange={(e) => setPhoneNumberId(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="reg-waba">waba_id</label>
        <input
          id="reg-waba"
          data-testid="reg-waba"
          className="input mono"
          placeholder="WABA_DEMO_WS205"
          value={wabaId}
          onChange={(e) => setWabaId(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="reg-token">token</label>
        <input
          id="reg-token"
          data-testid="reg-token"
          className="input mono"
          placeholder="demo-token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </div>

      <button type="submit" data-testid="reg-submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Registering…' : 'Register'}
      </button>

      {error && (
        <div className="msg-error" data-testid="reg-error" role="alert">
          {error}
        </div>
      )}

      {created && (
        <div className="msg-success" data-testid="reg-success">
          Registered <span className="mono">+{created.number}</span>
          <br />
          phone_number_id <span className="mono" data-testid="reg-result-pnid">{created.phone_number_id}</span>
          <br />
          token <span className="mono" data-testid="reg-result-token">{created.token}</span>
        </div>
      )}

      <div className="hint">POST /api/business-numbers → {'{phone_number_id, token}'}</div>
    </form>
  )
}
