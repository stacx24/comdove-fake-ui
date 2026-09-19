// Tile grid for one group, opened via /client?group=name (FR-14).
import { useSearchParams } from 'react-router-dom'

export default function ClientGrid() {
  const [params] = useSearchParams()
  const group = params.get('group')

  return (
    <main data-testid="client-grid">
      <h1>Group: {group}</h1>
    </main>
  )
}
