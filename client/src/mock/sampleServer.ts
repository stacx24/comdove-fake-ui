// In-browser stand-in for the mock server's control API (VITE_DATA_SOURCE=sample).
// Keeps changes in memory until the page is reloaded, and fails with the same
// { error: { message } } messages the real server would send (Tech Spec §6).
import type { BusinessNumber, Group, LogEntry } from '../types'
import { checkGroupName, checkGroupNumbers, checkPhone } from '../validation'
import { sampleBusinessNumbers, sampleGroups, sampleLog } from './sampleData'

let businessNumbers: BusinessNumber[] = structuredClone(sampleBusinessNumbers)
let groups: Group[] = structuredClone(sampleGroups)
let log: LogEntry[] = structuredClone(sampleLog)

export class SampleError extends Error {}

const fail = (message: string): never => {
  throw new SampleError(message)
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
    if (isKnownNumber(display_number)) fail(`${display_number} is already registered.`)

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

  listGroups: () => later(groups),

  createGroup(name: string, numbers: string[]) {
    const error = checkGroupName(name) ?? checkGroupNumbers(numbers)
    if (error) fail(error)
    if (groups.some((g) => g.name === name)) fail(`Group "${name}" already exists.`)
    const taken = numbers.find(isKnownNumber)
    if (taken) fail(`${taken} is already registered.`)

    const created: Group = { name, numbers, locked: false }
    groups = [...groups, created]
    return later(created)
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
