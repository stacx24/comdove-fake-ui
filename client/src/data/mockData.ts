// Static mock data for building the UI without a server. Plain data only: nothing here changes on its own.
// Chosen so every state of every screen has something to show; see the plan, Task 3.
import type { BusinessNumber, ChatMessage, Group, MessageStatus, TileState } from '../types'

// Times are relative to page load so they always look current.
const NOW = Math.floor(Date.now() / 1000)
const ago = (minutes: number) => NOW - minutes * 60

let seq = 0
const wamid = () => `wamid.MOCK-${(++seq).toString(16).padStart(12, '0')}`

export const SALES = '918888800001'
export const SUPPORT = '918888800002'
export const OTP = '918888800003'

export const businessNumbers: BusinessNumber[] = [
  { display_number: SALES, label: 'Sales', phone_number_id: 'MOCK-PN-1', token: 'mock_tok_9f3a1c7e2b4d' },
  { display_number: SUPPORT, label: 'Support', phone_number_id: 'MOCK-PN-2', token: 'mock_tok_51e8d0aa73c9' },
  { display_number: OTP, label: 'OTP sender', phone_number_id: 'MOCK-PN-3', token: 'mock_tok_c204b7f61e05' },
]

// Comdove (a business number) → the tile's customer number. Carries ticks.
function comdove(from: string, to: string, body: string, minutesAgo: number, status: MessageStatus): ChatMessage {
  return { wamid: wamid(), from, to, body, status, timestamp: ago(minutesAgo) }
}

// The tile's customer → Comdove. Shows no tick unless Comdove has read it.
function customer(from: string, to: string, body: string, minutesAgo: number, status: MessageStatus = 'delivered'): ChatMessage {
  return { wamid: wamid(), from, to, body, status, timestamp: ago(minutesAgo) }
}

const range = (start: number, count: number) =>
  Array.from({ length: count }, (_, i) => String(start + i))

// ---------------------------------------------------------------------------
// alpha: the showcase group. One UI state per tile.
// ---------------------------------------------------------------------------
const A = range(919876543210, 8)

const alphaTiles: TileState[] = [
  {
    // Unread badge: the last Comdove message is delivered, not read.
    number: A[0],
    online: true,
    history: [
      customer(A[0], SALES, 'Hi, is my order #4821 shipped yet?', 34),
      comdove(SALES, A[0], 'Hello from Comdove — yes, it left the warehouse this morning.', 33, 'read'),
      customer(A[0], SALES, 'how much?', 31),
      comdove(SALES, A[0], 'Delivery is free on orders above ₹499.', 2, 'delivered'),
    ],
    queued: [],
  },
  {
    // All three ticks side by side: read, delivered, sent.
    number: A[1],
    online: true,
    history: [
      comdove(SALES, A[1], 'Your order #5102 is packed.', 48, 'read'),
      comdove(SALES, A[1], 'It has been handed to the courier.', 12, 'delivered'),
      comdove(SALES, A[1], 'Track it here: comdove.in/t/5102', 1, 'sent'),
    ],
    queued: [],
  },
  {
    // Offline with 2 queued: composer disabled.
    number: A[2],
    online: false,
    history: [comdove(SUPPORT, A[2], 'We received your return request.', 95, 'read')],
    queued: [
      comdove(SUPPORT, A[2], 'Your pickup is scheduled for tomorrow, 10am–1pm.', 20, 'queued'),
      comdove(SUPPORT, A[2], 'Please keep the original packaging ready.', 19, 'queued'),
    ],
  },
  {
    // A single message.
    number: A[3],
    online: true,
    history: [comdove(SALES, A[3], 'Your appointment is confirmed for Friday 4pm.', 63, 'read')],
    queued: [],
  },
  {
    // Two business numbers in one chat: peer labels and the Reply-to dropdown. Support wrote last.
    number: A[4],
    online: true,
    history: [
      comdove(SALES, A[4], 'Thanks for your order! It ships in 2 days.', 70, 'read'),
      customer(A[4], SALES, 'Can I change the delivery address?', 66),
      comdove(SUPPORT, A[4], 'Hi, this is Support — I can help with the address change.', 5, 'delivered'),
    ],
    queued: [],
  },
  {
    // Offline, nothing queued.
    number: A[5],
    online: false,
    history: [comdove(OTP, A[5], 'Your OTP is 448213. It expires in 10 minutes.', 120, 'read')],
    queued: [],
  },
  {
    // Empty: no history, so Reply-to is picked from the business list.
    number: A[6],
    online: true,
    history: [],
    queued: [],
  },
  {
    // The customer's own message read by Comdove (blue ✓✓ on the right), and a long message that wraps.
    number: A[7],
    online: true,
    history: [
      customer(
        A[7],
        SALES,
        'Hello, I would like to know more about the premium plan — does it include priority support, and how does billing work if I upgrade in the middle of a month?',
        15,
        'read',
      ),
      comdove(SALES, A[7], 'Thanks for reaching out, a specialist will reply shortly.', 14, 'read'),
    ],
    queued: [],
  },
]

// ---------------------------------------------------------------------------
// Filler groups
// ---------------------------------------------------------------------------
const B = range(919876543220, 10)
const G = range(919876543230, 5)
const L = range(919876543240, 10)

const simpleTile = (number: string, i: number): TileState => ({
  number,
  online: i % 4 !== 3,
  history: [
    customer(number, SUPPORT, 'Hi, I need help with my account.', 40 - i),
    comdove(SUPPORT, number, 'Sure — could you share your registered email?', 38 - i, i % 2 ? 'read' : 'delivered'),
  ],
  queued: [],
})

const LOAD_LINES: [biz: boolean, body: string][] = [
  [false, 'Hi there'],
  [true, 'Hello! How can we help you today?'],
  [false, 'I placed an order yesterday'],
  [true, 'Could you share the order number?'],
  [false, 'It is #7731'],
  [true, 'Thanks, checking now.'],
  [true, 'It is out for delivery today.'],
  [false, 'Great, what time?'],
  [true, 'Between 2pm and 6pm.'],
  [false, 'Can the courier call before coming?'],
  [true, 'Yes, we have added a note.'],
  [false, 'Thanks a lot'],
  [true, 'Anything else we can help with?'],
  [false, 'No, that is all'],
  [true, 'Have a nice day!'],
  [true, 'Please rate your experience: comdove.in/r/7731'],
]

// 16 messages per tile so every chat scrolls; the last Comdove message is unread.
const loadTile = (number: string, i: number): TileState => {
  const biz = [SALES, SUPPORT, OTP][i % 3]
  const last = LOAD_LINES.length - 1
  return {
    number,
    online: true,
    history: LOAD_LINES.map(([fromBiz, body], j) => {
      const minutesAgo = (last - j) * 3 + i
      return fromBiz
        ? comdove(biz, number, body, minutesAgo, j === last ? 'delivered' : 'read')
        : customer(number, biz, body, minutesAgo)
    }),
    queued: [],
  }
}

// Same shape as GET /api/groups: a count, not the members (those arrive in group.claimed).
const group = (name: string, members: string[], lockedMinutesAgo?: number): Group => ({
  id: name,
  name,
  count: members.length,
  status: lockedMinutesAgo === undefined ? 'free' : 'locked',
  locked_since: lockedMinutesAgo === undefined ? null : ago(lockedMinutesAgo) * 1000,
})

export const groups: Group[] = [
  group('alpha', A),
  group('beta', B, 12),
  group('gamma', G),
  group('load-test', L),
]

export const tilesByGroup: Record<string, TileState[]> = {
  alpha: alphaTiles,
  beta: B.map(simpleTile),
  gamma: G.map(simpleTile),
  'load-test': L.map(loadTile),
}
