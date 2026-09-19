// Sample data used while the mock server is not ready (VITE_DATA_SOURCE=sample).
// Mirrors the "Comdove Mock UI" design.
import type { BusinessNumber, Group, LogEntry, MessageStatus, WebhookOutcome } from '../types'

export const sampleBusinessNumbers: BusinessNumber[] = [
  { display_number: '918888800001', label: 'Sales', phone_number_id: 'MOCK-PN-1', token: 'mock_tok_9f3a1c7e2b4d' },
  { display_number: '918888800002', label: 'Support', phone_number_id: 'MOCK-PN-2', token: 'mock_tok_51e8d0aa73c9' },
  { display_number: '918888800003', label: 'OTP sender', phone_number_id: 'MOCK-PN-3', token: 'mock_tok_c204b7f61e05' },
]

const numbersFrom = (first: number, count: number) =>
  Array.from({ length: count }, (_, i) => String(first + i))

export const sampleGroups: Group[] = [
  { name: 'alpha', numbers: numbersFrom(919876543210, 8), locked: false },
  { name: 'beta', numbers: numbersFrom(919876543220, 10), locked: true, since: 1758270300 },
  { name: 'gamma', numbers: numbersFrom(919876543230, 5), locked: false },
  { name: 'load-test', numbers: numbersFrom(919876543240, 10), locked: false },
]

const STEPS: MessageStatus[] = ['sent', 'delivered', 'read']

function entry(
  id: number,
  time: string,
  from: string,
  to: string,
  body: string,
  status: MessageStatus,
  webhook: WebhookOutcome,
): LogEntry {
  const timestamp = Math.floor(new Date(`2026-09-19T${time}`).getTime() / 1000)
  const statuses = STEPS.slice(0, STEPS.indexOf(status) + 1).map((s, i) => ({ status: s, timestamp: timestamp + i * 4 }))
  return { wamid: `wamid.MOCK-sample${id}`, from, to, body, status, timestamp, statuses, webhook }
}

export const sampleLog: LogEntry[] = [
  entry(7, '10:04:31', '919876543210', '918888800001', 'how much?', 'read',
    { state: 'ok', http_status: 200, attempts: 1, latency_ms: 84 }),
  entry(6, '10:04:02', '918888800001', '919876543213', 'Your appointment is confirmed for Friday 4pm.', 'sent',
    { state: 'ok', http_status: 200, attempts: 1, latency_ms: 61 }),
  entry(5, '10:03:48', '918888800002', '919876543212', 'We received your return request.', 'sent',
    { state: 'pending', attempts: 0, note: 'tile offline' }),
  entry(4, '10:02:55', '918888800001', '919876543210', 'Hello from Comdove — yes, it left the warehouse this morning.', 'read',
    { state: 'ok', http_status: 200, attempts: 1, latency_ms: 92 }),
  entry(3, '10:02:10', '919876543210', '918888800001', 'Hi, is my order #4821 shipped yet?', 'read',
    { state: 'retrying', http_status: 500, attempts: 2 }),
  entry(2, '09:58:07', '918888800003', '919876543216', 'Your OTP is 448213', 'delivered',
    { state: 'ok', http_status: 200, attempts: 1, latency_ms: 70 }),
  entry(1, '09:41:19', '918888800001', '919876543217', 'Thanks for reaching out, a specialist will reply shortly.', 'delivered',
    { state: 'ok', http_status: 200, attempts: 1, latency_ms: 77 }),
]
