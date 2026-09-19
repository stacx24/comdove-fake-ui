// Control API client (Tech Spec §6). No auth; errors come back as { error: { message } }.
import type { BusinessNumber, Group, LogEntry } from './types'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : undefined
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `${method} ${path} failed with ${res.status}`)
  }
  return data as T
}

export const api = {
  listBusinessNumbers: () => request<BusinessNumber[]>('GET', '/api/business-numbers'),
  registerBusinessNumber: (display_number: string, label: string) =>
    request<{ phone_number_id: string; token: string }>('POST', '/api/business-numbers', {
      display_number,
      label,
    }),

  listGroups: () => request<Group[]>('GET', '/api/groups'),
  createGroup: (name: string, numbers: string[]) =>
    request<Group>('POST', '/api/groups', { name, numbers }),

  setPresence: (number: string, online: boolean) =>
    request<void>('POST', '/api/presence', { number, online }),
  inject: (from: string, to: string, body: string) =>
    request<{ wamid: string }>('POST', '/api/inject', { from, to, body }),

  log: (limit = 100) => request<LogEntry[]>('GET', `/api/log?limit=${limit}`),
  reset: (keep_numbers = true) => request<void>('POST', '/api/reset', { keep_numbers }),
}
