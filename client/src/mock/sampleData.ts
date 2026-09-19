// Sample data used while the mock server is not ready (VITE_DATA_SOURCE=sample).
// Mirrors the "Comdove Mock UI" design.
import type { BusinessNumber, LogEntry, MessageStatus, WebhookDelivery } from '../types'

export const sampleBusinessNumbers: BusinessNumber[] = [
  { display_number: '918888800001', label: 'Sales', phone_number_id: 'MOCK-PN-1', token: 'mock_tok_9f3a1c7e2b4d' },
  { display_number: '918888800002', label: 'Support', phone_number_id: 'MOCK-PN-2', token: 'mock_tok_51e8d0aa73c9' },
  { display_number: '918888800003', label: 'OTP sender', phone_number_id: 'MOCK-PN-3', token: 'mock_tok_c204b7f61e05' },
]

const numbersFrom = (first: number, count: number) =>
  Array.from({ length: count }, (_, i) => String(first + i))

// The sample server keeps each group's members; GET /api/groups only returns the count.
export interface SampleGroup {
  name: string
  numbers: string[]
  locked: boolean
  since?: number // unix seconds
}

export const sampleGroups: SampleGroup[] = [
  { name: 'alpha', numbers: numbersFrom(919876543210, 8), locked: false },
  { name: 'beta', numbers: numbersFrom(919876543220, 10), locked: true, since: 1758270300 },
  { name: 'gamma', numbers: numbersFrom(919876543230, 5), locked: false },
  { name: 'load-test', numbers: numbersFrom(919876543240, 10), locked: false },
]

const STEPS: MessageStatus[] = ['sent', 'delivered', 'read']
const label = (pnid: string) => sampleBusinessNumbers.find((b) => b.phone_number_id === pnid)!.label
const at = (time: string) => new Date(`2026-09-19T${time}`).getTime()

// A webhook that worked first time, `ms` after `time`.
const ok = (kind: string, time: number, ms: number): WebhookDelivery => ({
  kind,
  state: 'ok',
  attempts: [{ n: 1, http_status: 200, duration_ms: ms, at: time + ms }],
})

interface EntryInput {
  id: number
  time: string
  direction: 'inbound' | 'outbound'
  from: string
  to: string
  pnid: string
  group: string
  body: string
  status: MessageStatus
  webhooks: (time: number) => WebhookDelivery[]
}

// Shape from the server team's UI-API-GUIDE.md §2e. Times are milliseconds.
function entry(e: EntryInput): LogEntry {
  const time = at(e.time)
  const reached = e.status === 'queued' ? ['sent' as const] : STEPS.slice(0, STEPS.indexOf(e.status) + 1)
  return {
    wamid: `wamid.MOCK-sample${e.id}`,
    time,
    direction: e.direction,
    source: e.direction === 'outbound' ? 'api' : 'tile',
    from: e.from,
    to: e.to,
    business: { phone_number_id: e.pnid, label: label(e.pnid) },
    group_id: e.group,
    body: e.body,
    status: e.status,
    timeline: reached.map((status, i) => ({ status, at: time + i * 4000 })),
    webhooks: e.webhooks(time),
  }
}

export const sampleLog: LogEntry[] = [
  entry({ id: 7, time: '10:04:31', direction: 'inbound', from: '919876543210', to: '918888800001', pnid: 'MOCK-PN-1', group: 'alpha',
    body: 'how much?', status: 'read',
    webhooks: (t) => [ok('message', t, 84)] }),
  entry({ id: 6, time: '10:04:02', direction: 'outbound', from: '918888800001', to: '919876543213', pnid: 'MOCK-PN-1', group: 'alpha',
    body: 'Your appointment is confirmed for Friday 4pm.', status: 'sent',
    webhooks: (t) => [ok('sent', t, 61)] }),
  entry({ id: 5, time: '10:03:48', direction: 'outbound', from: '918888800002', to: '919876543212', pnid: 'MOCK-PN-2', group: 'alpha',
    body: 'We received your return request.', status: 'queued',
    webhooks: (t) => [ok('sent', t, 58)] }),
  entry({ id: 4, time: '10:02:55', direction: 'outbound', from: '918888800001', to: '919876543210', pnid: 'MOCK-PN-1', group: 'alpha',
    body: 'Hello from Comdove — yes, it left the warehouse this morning.', status: 'read',
    webhooks: (t) => [ok('sent', t, 92), ok('delivered', t + 4000, 77), ok('read', t + 8000, 81)] }),
  entry({ id: 3, time: '10:02:10', direction: 'inbound', from: '919876543210', to: '918888800001', pnid: 'MOCK-PN-1', group: 'alpha',
    body: 'Hi, is my order #4821 shipped yet?', status: 'read',
    webhooks: (t) => [{
      kind: 'message',
      state: 'retrying',
      attempts: [
        { n: 1, http_status: 500, duration_ms: 212, at: t + 40 },
        { n: 2, http_status: 500, duration_ms: 198, at: t + 1250 },
        { n: 3, http_status: 500, duration_ms: 205, at: t + 6460 },
      ],
    }] }),
  entry({ id: 2, time: '09:58:07', direction: 'outbound', from: '918888800003', to: '919876543216', pnid: 'MOCK-PN-3', group: 'alpha',
    body: 'Your OTP is 448213', status: 'delivered',
    webhooks: (t) => [ok('sent', t, 70), ok('delivered', t + 4000, 64)] }),
  entry({ id: 1, time: '09:41:19', direction: 'outbound', from: '918888800001', to: '919876543217', pnid: 'MOCK-PN-1', group: 'alpha',
    body: 'Thanks for reaching out, a specialist will reply shortly.', status: 'delivered',
    webhooks: (t) => [ok('sent', t, 77), ok('delivered', t + 4000, 71)] }),
]
