// The one door the pages use for data. `mock` and `server` both implement it.
import type { BusinessNumber, ClientEvent, Group, ServerEvent } from '../types'

// `mock` = static mock data, no server behind it.
export type ConnectionState = 'mock' | 'connecting' | 'open' | 'reconnecting' | 'closed'

export interface GroupConnection {
  /** Returns false when the event could not be sent (socket not open). Nothing is queued. */
  send(event: ClientEvent): boolean
  /** Closes the connection for good; on the server this releases the group lock. */
  close(): void
}

export interface GroupHandlers {
  onEvent(event: ServerEvent): void
  onState(state: ConnectionState): void
}

export interface DataSource {
  listGroups(): Promise<Group[]>
  listBusinessNumbers(): Promise<BusinessNumber[]>
  connectGroup(group: string, handlers: GroupHandlers): GroupConnection
}
