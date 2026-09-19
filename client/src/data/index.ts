// Picks where the UI gets its data: static mock data (default) or the real mock server.
import { mockSource } from './mock'
import { serverSource } from './server'
import type { DataSource } from './types'

export const data: DataSource =
  import.meta.env.VITE_DATA_SOURCE === 'server' ? serverSource : mockSource

export type { ConnectionState, DataSource, GroupConnection, GroupHandlers } from './types'
