// In-browser stand-in for the mock server's control API (any VITE_DATA_SOURCE other than "server").
// Keeps changes in memory until the page is reloaded, and fails with the same
// { error: { message } } messages and status codes the real server sends (UI-API-GUIDE.md).
import type { BusinessNumber, Customer, Group, LogEntry } from '../types'
import { checkGroupName, checkGroupNumbers, checkPhone } from '../validation'
import { sampleBusinessNumbers, sampleGroups, sampleLog, type SampleGroup } from './sampleData'

let businessNumbers: BusinessNumber[] = structuredClone(sampleBusinessNumbers)
let groups: SampleGroup[] = structuredClone(sampleGroups)
let log: LogEntry[] = structuredClone(sampleLog)

export class SampleError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const fail = (message: string, status = 400): never => {
  throw new SampleError(message, status)
}

// Small delay so loading states behave like a real network call.
const later = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(structuredClone(value)), 150))

function isKnownNumber(number: string) {
  return businessNumbers.some((b) => b.display_number === number) || groups.some((g) => g.numbers.includes(number))
}

function randomHex(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length / 2))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export const sampleServer = {
  listBusinessNumbers: () => later(businessNumbers),

  registerBusinessNumber(display_number: string, label: string) {
    const error = checkPhone(display_number)
    if (error) fail(error)
    if (isKnownNumber(display_number)) fail(`${display_number} is already registered.`, 409)

    const next = Math.max(0, ...businessNumbers.map((b) => Number(b.phone_number_id.replace('MOCK-PN-', '')) || 0)) + 1
    const created: BusinessNumber = {
      display_number,
      label,
      phone_number_id: `MOCK-PN-${next}`,
      token: `mock_tok_${randomHex(12)}`,
    }
    businessNumbers = [...businessNumbers, created]
    return later({ phone_number_id: created.phone_number_id, token: created.token })
  },

  listGroups: () =>
    later(
      groups.map((g): Group => ({
        id: g.name,
        name: g.name,
        count: g.numbers.length,
        status: g.locked ? 'locked' : 'free',
        locked_since: g.locked && g.since ? g.since * 1000 : null,
      })),
    ),

  listCustomers: () =>
    later(
      groups.flatMap((g) =>
        g.numbers.map((number): Customer => ({
          number,
          label: g.name,
          group_id: g.name,
          online: true,
          effective_online: true,
          claim_status: g.locked ? 'locked' : 'free',
          reply_mode: 'manual',
          type: 'customer',
        })),
      ),
    ),

  createGroup(name: string, numbers: string[]) {
    const error = checkGroupName(name) ?? checkGroupNumbers(numbers)
    if (error) fail(error)
    if (groups.some((g) => g.name === name)) fail(`Group "${name}" already exists.`, 409)
    const taken = numbers.find(isKnownNumber)
    if (taken) fail(`${taken} is already registered.`, 409)

    const created: SampleGroup = { name, numbers, locked: false }
    groups = [...groups, created]
    return later({ id: name, name, numbers })
  },

  deleteBusinessNumber(phone_number_id: string) {
    if (!businessNumbers.some((b) => b.phone_number_id === phone_number_id)) fail(`No business number ${phone_number_id}.`, 404)
    businessNumbers = businessNumbers.filter((b) => b.phone_number_id !== phone_number_id)
    return later(undefined)
  },

  deleteGroup(id: string) {
    const group = groups.find((g) => g.name === id)
    if (!group) fail(`No group called "${id}".`, 404)
    if (group!.locked) fail(`Group "${id}" is open in a browser.`, 409)
    groups = groups.filter((g) => g.name !== id)
    return later(undefined)
  },

  log: (limit: number) => later(log.slice(0, limit)),

  reset(keep_numbers: boolean) {
    log = []
    if (!keep_numbers) {
      businessNumbers = []
      groups = []
    }
    return later(undefined)
  },
}
