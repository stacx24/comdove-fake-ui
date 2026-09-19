// Admin: number registration, groups, live message log, reset (plan: docs/admin-ui-plan.md).
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import CreateGroupForm from '../components/admin/CreateGroupForm'
import MessageLog from '../components/admin/MessageLog'
import NumbersTable from '../components/admin/NumbersTable'
import RegisterNumberForm from '../components/admin/RegisterNumberForm'
import ResetDialog from '../components/admin/ResetDialog'
import type { BusinessNumber, Group } from '../types'

export default function Admin() {
  const [businessNumbers, setBusinessNumbers] = useState<BusinessNumber[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [logKey, setLogKey] = useState(0)
  const [resetOpen, setResetOpen] = useState(false)

  const loadNumbers = useCallback(async () => {
    try {
      const [numbers, groupList] = await Promise.all([api.listBusinessNumbers(), api.listGroups()])
      setBusinessNumbers(numbers)
      setGroups(groupList)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load numbers.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNumbers()
  }, [loadNumbers])

  const isKnownNumber = (number: string) =>
    businessNumbers.some((b) => b.display_number === number) || groups.some((g) => g.numbers.includes(number))
  const groupExists = (name: string) => groups.some((g) => g.name === name)

  function afterReset() {
    setResetOpen(false)
    loadNumbers()
    setLogKey((k) => k + 1)
  }

  return (
    <main className="admin" data-testid="admin-page">
      <div className="admin-top">
        <div className="admin-forms">
          <RegisterNumberForm isKnownNumber={isKnownNumber} onRegistered={loadNumbers} />
          <CreateGroupForm groupExists={groupExists} isKnownNumber={isKnownNumber} onCreated={loadNumbers} />
        </div>
        <NumbersTable businessNumbers={businessNumbers} groups={groups} loading={loading} error={error} />
      </div>

      <MessageLog refreshKey={logKey} onResetClick={() => setResetOpen(true)} />

      {resetOpen && <ResetDialog onClose={() => setResetOpen(false)} onDone={afterReset} />}
    </main>
  )
}
