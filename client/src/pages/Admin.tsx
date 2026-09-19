// Admin: number registration, groups, live message log, reset (plan: docs/admin-ui-plan.md).
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import CreateGroupForm from '../components/admin/CreateGroupForm'
import DeleteDialog, { type DeleteTarget } from '../components/admin/DeleteDialog'
import MessageLog from '../components/admin/MessageLog'
import NumbersTable from '../components/admin/NumbersTable'
import RegisterNumberForm from '../components/admin/RegisterNumberForm'
import ResetDialog from '../components/admin/ResetDialog'
import type { BusinessNumber, Customer, Group } from '../types'

export default function Admin() {
  const [businessNumbers, setBusinessNumbers] = useState<BusinessNumber[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [logKey, setLogKey] = useState(0)
  const [resetOpen, setResetOpen] = useState(false)
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null)

  const loadNumbers = useCallback(async () => {
    try {
      const [numbers, customerList, groupList] = await Promise.all([
        api.listBusinessNumbers(),
        api.listCustomers(),
        api.listGroups(),
      ])
      setBusinessNumbers(numbers)
      setCustomers(customerList)
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
    businessNumbers.some((b) => b.display_number === number) || customers.some((c) => c.number === number)
  const groupExists = (name: string) => groups.some((g) => g.name === name)

  function afterReset() {
    setResetOpen(false)
    loadNumbers()
    setLogKey((k) => k + 1)
  }

  function afterDelete() {
    setDeleting(null)
    loadNumbers()
  }

  return (
    <main className="admin" data-testid="admin-page">
      <div className="admin-top">
        <div className="admin-forms">
          <RegisterNumberForm isKnownNumber={isKnownNumber} onRegistered={loadNumbers} />
          <CreateGroupForm
            groups={groups}
            groupExists={groupExists}
            isKnownNumber={isKnownNumber}
            onCreated={loadNumbers}
            onDeleteGroup={(g) => setDeleting({ kind: 'group', id: g.id, name: g.name, count: g.count })}
          />
        </div>
        <NumbersTable
          businessNumbers={businessNumbers}
          customers={customers}
          loading={loading}
          error={error}
          onDeleteNumber={(b) =>
            setDeleting({ kind: 'number', phone_number_id: b.phone_number_id, number: b.display_number, label: b.label })
          }
        />
      </div>

      <MessageLog refreshKey={logKey} onResetClick={() => setResetOpen(true)} />

      {resetOpen && <ResetDialog onClose={() => setResetOpen(false)} onDone={afterReset} />}
      {deleting && <DeleteDialog target={deleting} onClose={() => setDeleting(null)} onDone={afterDelete} />}
    </main>
  )
}
