// Registered numbers (plan §3.3, §11.3). Business numbers from GET /api/business-numbers,
// customer numbers from GET /api/customers (UI-API-GUIDE.md §2b).
import { useState } from 'react'
import type { BusinessNumber, Customer } from '../../types'

interface Props {
  businessNumbers: BusinessNumber[]
  customers: Customer[]
  loading: boolean
  error: string | null
  onDeleteNumber: (number: BusinessNumber) => void
}

interface NumberRow {
  number: string
  label: string
  pnid: string
  token: string | null
  type: 'business' | 'customer'
  claim: string
  live: boolean
  business?: BusinessNumber
}

function toRows(businessNumbers: BusinessNumber[], customers: Customer[]): NumberRow[] {
  const business = businessNumbers.map((b): NumberRow => ({
    number: b.display_number,
    label: b.label || '—',
    pnid: b.phone_number_id,
    token: b.token,
    type: 'business',
    claim: '—',
    live: false,
    business: b,
  }))
  const customerRows = customers.map((c): NumberRow => ({
    number: c.number,
    label: c.label || c.group_id,
    pnid: '—',
    token: null,
    type: 'customer',
    claim: c.claim_status === 'locked' ? `${c.group_id} · live` : 'free',
    live: c.claim_status === 'locked',
  }))
  return [...business, ...customerRows]
}

// navigator.clipboard only exists on https/localhost; fall back for office-LAN http.
async function copyText(text: string) {
  if (navigator.clipboard) return navigator.clipboard.writeText(text)
  const area = document.createElement('textarea')
  area.value = text
  document.body.appendChild(area)
  area.select()
  document.execCommand('copy')
  area.remove()
}

export default function NumbersTable({ businessNumbers, customers, loading, error, onDeleteNumber }: Props) {
  const [copied, setCopied] = useState<string | null>(null)
  const rows = toRows(businessNumbers, customers)

  async function copy(number: string, token: string) {
    await copyText(token)
    setCopied(number)
    setTimeout(() => setCopied((current) => (current === number ? null : current)), 1500)
  }

  return (
    <section className="card" data-testid="numbers-table">
      <div className="card-header">
        <div className="eyebrow">Registered numbers</div>
        <div className="mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--dim)' }} data-testid="numbers-total">
          {rows.length} total
        </div>
      </div>

      <div className="table-scroll numbers-body">
        <div className="row row-head numbers-row">
          <div>Number</div>
          <div>Label</div>
          <div>phone_number_id</div>
          <div>Token</div>
          <div>Type</div>
          <div>Claim</div>
        </div>

        {rows.map((row) => (
          <div key={row.number} className="row numbers-row" data-testid={`number-row-${row.number}`}>
            <div className="mono">+{row.number}</div>
            <div className="cell-ellipsis" style={{ color: 'var(--text-2)' }}>{row.label}</div>
            <div className="cell-mono" style={{ color: 'var(--muted)' }}>{row.pnid}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span className="cell-mono cell-ellipsis" style={{ color: 'var(--muted)' }}>{row.token ?? '—'}</span>
              {row.token && (
                <button
                  type="button"
                  className="btn-tiny"
                  data-testid={`copy-token-${row.number}`}
                  onClick={() => copy(row.number, row.token!)}
                >
                  {copied === row.number ? 'Copied' : 'Copy'}
                </button>
              )}
              {row.business && (
                <button
                  type="button"
                  className="btn-tiny btn-tiny-danger"
                  data-testid={`delete-number-${row.number}`}
                  onClick={() => onDeleteNumber(row.business!)}
                >
                  Delete
                </button>
              )}
            </div>
            <div>
              <span className="pill" style={{ color: row.type === 'business' ? 'var(--gold)' : 'var(--muted)' }}>
                {row.type}
              </span>
            </div>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: row.live ? 'var(--green)' : 'var(--subtle)' }}
            >
              <span className="dot dot-sm" style={{ background: 'currentColor' }} />
              <span>{row.claim}</span>
            </div>
          </div>
        ))}

        {!loading && !error && rows.length === 0 && <div className="empty">No numbers registered yet.</div>}
        {loading && rows.length === 0 && <div className="empty">Loading…</div>}
        {error && (
          <div className="empty msg-error" role="alert" data-testid="numbers-error">
            {error}
          </div>
        )}
      </div>
    </section>
  )
}
