// Control API client (Tech Spec §6). The only place the UI talks to the mock server.
// VITE_DATA_SOURCE picks the backend: "sample" (built-in fake data, the default) or "server".
import { SampleError, sampleServer } from './mock/sampleServer'
import type { BusinessNumber, Customer, Group, LogEntry, ServerAutoReply } from './types'

export const dataSource = import.meta.env.VITE_DATA_SOURCE === 'server' ? 'server' : 'sample'

// The server keeps this in its own .env and does not expose it yet (plan §3.0).
export const webhookUrl = import.meta.env.VITE_WEBHOOK_URL || 'http://localhost:3000/webhooks/whatsapp'

// Every failure reaches the UI as an ApiError whose message can be shown as-is.
// `status` is the HTTP status (0 when the server can't be reached), e.g. 409 = conflict.
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status = 0) {
    super(message)
    this.status = status
  }
}

const unreachable = `Mock server not reachable at ${__MOCK_SERVER_URL__.replace(/^https?:\/\//, '')}.`

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(unreachable)
  }

  const text = await res.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : undefined
  } catch {
    data = undefined
  }

  if (!res.ok) {
    const message = (data as { error?: { message?: string } } | undefined)?.error?.message
    if (message) throw new ApiError(message, res.status)
    // The Vite proxy answers 5xx with no body when the server is down.
    throw new ApiError(res.status >= 500 ? unreachable : `${method} ${path} failed (${res.status}).`, res.status)
  }
  return data as T
}

async function sample<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (err) {
    throw err instanceof SampleError ? new ApiError(err.message, err.status) : err
  }
}

const serverApi = {
  listBusinessNumbers: () => request<BusinessNumber[]>('GET', '/api/business-numbers'),
  // overrides let the caller pin phone_number_id / waba_id / token so the mock matches a number
  // already registered in ComDove (ComDove-first order). Left blank, the server generates them.
  registerBusinessNumber: (
    display_number: string,
    label: string,
    overrides?: { phone_number_id?: string; waba_id?: string; token?: string },
  ) =>
    request<{ phone_number_id: string; token: string }>('POST', '/api/business-numbers', {
      display_number,
      label,
      ...(overrides?.phone_number_id ? { phone_number_id: overrides.phone_number_id } : {}),
      ...(overrides?.waba_id ? { waba_id: overrides.waba_id } : {}),
      ...(overrides?.token ? { token: overrides.token } : {}),
    }),
  listGroups: () => request<Group[]>('GET', '/api/groups'),
  listCustomers: () => request<Customer[]>('GET', '/api/customers'),
  createGroup: (name: string, numbers: string[]) =>
    request<{ id: string; name: string; numbers: string[] }>('POST', '/api/groups', { name, numbers }),
  deleteBusinessNumber: (phone_number_id: string) =>
    request<void>('DELETE', `/api/business-numbers/${encodeURIComponent(phone_number_id)}`),
  deleteGroup: (id: string) => request<void>('DELETE', `/api/groups/${encodeURIComponent(id)}`),
  setPresence: (number: string, online: boolean) => request<void>('POST', '/api/presence', { number, online }),
  inject: (from: string, to: string, body: string) => request<{ wamid: string }>('POST', '/api/inject', { from, to, body }),
  log: (limit = 100) => request<LogEntry[]>('GET', `/api/log?limit=${limit}`),
  reset: (keep_numbers = true) => request<void>('POST', '/api/reset', { keep_numbers }),
  // UI-API-GUIDE.md §3b: the ⚙ panel reads and saves a tile's auto-reply on the server.
  getAutoReply: (number: string) =>
    request<ServerAutoReply>('GET', `/api/customers/${encodeURIComponent(number)}/auto-reply`),
  putAutoReply: (number: string, config: ServerAutoReply) =>
    request<ServerAutoReply>('PUT', `/api/customers/${encodeURIComponent(number)}/auto-reply`, config),
}

const sampleApi: typeof serverApi = {
  listBusinessNumbers: () => sample(() => sampleServer.listBusinessNumbers()),
  registerBusinessNumber: (display_number, label, overrides) => sample(() => sampleServer.registerBusinessNumber(display_number, label, overrides)),
  listGroups: () => sample(() => sampleServer.listGroups()),
  listCustomers: () => sample(() => sampleServer.listCustomers()),
  createGroup: (name, numbers) => sample(() => sampleServer.createGroup(name, numbers)),
  deleteBusinessNumber: (phone_number_id) => sample(() => sampleServer.deleteBusinessNumber(phone_number_id)),
  deleteGroup: (id) => sample(() => sampleServer.deleteGroup(id)),
  setPresence: async () => {},
  inject: async () => {
    throw new ApiError('Inject needs the real mock server (VITE_DATA_SOURCE=server).')
  },
  log: (limit = 100) => sample(() => sampleServer.log(limit)),
  reset: (keep_numbers = true) => sample(() => sampleServer.reset(keep_numbers)),
  // Mock mode keeps auto-reply in the browser (data/mock.ts); these are never called there.
  getAutoReply: async () => ({ mode: 'manual', delay_ms: 800, rules: [] }),
  putAutoReply: async (_number, config) => config,
}

export const api = dataSource === 'server' ? serverApi : sampleApi
