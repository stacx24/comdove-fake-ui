// Create group (plan §3.2, PRD FR-15). Not in the design; styled like the Register card.
// POST /api/groups — the numbers become customer numbers on the server.
import { useState, type FormEvent } from 'react'
import { api } from '../../api'
import { checkGroupName, checkGroupNumbers, MAX_GROUP_SIZE, parseNumberList } from '../../validation'

interface Props {
  groupExists: (name: string) => boolean
  isKnownNumber: (number: string) => boolean
  onCreated: () => void
}

export default function CreateGroupForm({ groupExists, isKnownNumber, onCreated }: Props) {
  const [name, setName] = useState('')
  const [numbersText, setNumbersText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ name: string; count: number } | null>(null)

  const numbers = parseNumberList(numbersText)

  function check(groupName: string): string | null {
    const problem = checkGroupName(groupName) ?? checkGroupNumbers(numbers)
    if (problem) return problem
    if (groupExists(groupName)) return `Group "${groupName}" already exists.`
    const taken = numbers.find(isKnownNumber)
    if (taken) return `${taken} is already registered.`
    return null
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const groupName = name.trim()
    const problem = check(groupName)
    setCreated(null)
    if (problem) {
      setError(problem)
      return
    }

    setBusy(true)
    setError(null)
    try {
      await api.createGroup(groupName, numbers)
      setCreated({ name: groupName, count: numbers.length })
      setName('')
      setNumbersText('')
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card card-pad" onSubmit={submit} noValidate>
      <div className="eyebrow">Create client group</div>

      <div className="field">
        <label htmlFor="group-name">Group name</label>
        <input
          id="group-name"
          data-testid="group-name"
          className="input"
          placeholder="alpha"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="group-numbers" style={{ display: 'flex' }}>
          <span>Customer numbers</span>
          <span
            className="mono"
            data-testid="group-count"
            style={{ marginLeft: 'auto', color: numbers.length > MAX_GROUP_SIZE ? 'var(--red)' : 'var(--dim)' }}
          >
            {numbers.length}/{MAX_GROUP_SIZE}
          </span>
        </label>
        <textarea
          id="group-numbers"
          data-testid="group-numbers"
          className="input mono"
          placeholder={'919876543210\n919876543211'}
          value={numbersText}
          onChange={(e) => setNumbersText(e.target.value)}
        />
      </div>

      <button type="submit" data-testid="group-submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Creating…' : 'Create group'}
      </button>

      {error && (
        <div className="msg-error" data-testid="group-error" role="alert">
          {error}
        </div>
      )}

      {created && (
        <div className="msg-success" data-testid="group-success">
          Created <span className="mono">{created.name}</span> with {created.count} customer number
          {created.count === 1 ? '' : 's'} · opens at <span className="mono">/client?group={created.name}</span>
        </div>
      )}

      <div className="hint">POST /api/groups · one per line or comma-separated</div>
    </form>
  )
}
