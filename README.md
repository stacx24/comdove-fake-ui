# Comdove WhatsApp Mock — Frontend

Browser UI for the Comdove mock WhatsApp server: the **client grid** (testers act as customers, one tile per number) and the **admin** page.
Spec: *Comdove WhatsApp Mock Server — Hackathon PRD* and *Comdove Mock Server — API Tech Spec*.

## Stack
React + Vite + TypeScript, React Router, native WebSocket.

## Run
```bash
cd client
npm install
cp .env.example .env   # MOCK_SERVER_URL, default http://localhost:4020
npm run dev            # http://localhost:5173
```
The dev server proxies `/api` and `/ws` to the mock server, so no server address is hardcoded.

## Structure
```
client/src/
  pages/Launch.tsx       /client            group list, free/locked
  pages/ClientGrid.tsx   /client?group=x    tile grid for one group
  pages/Admin.tsx        /admin             numbers, live log, reset
  components/Tile.tsx    one customer number
  api.ts                 control API calls
  ws.ts                  WebSocket connection
  types.ts               message shapes from the spec
```

## Branches
- `main` — base setup
- `client` — client grid work
- `admin` — admin page work

## Rules (PRD §8)
- `data-testid` on every interactive element.
- Groups must be URL-addressable: `/client?group=alpha`.
- The UI calls only the control API; no behaviour exists only behind a button.

## Control API (no auth)
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/business-numbers` | `{display_number, label}` | `{phone_number_id, token}` |
| GET | `/api/business-numbers` | – | list |
| POST | `/api/groups` | `{name, numbers[≤10]}` | group |
| GET | `/api/groups` | – | list with free/locked |
| POST | `/api/presence` | `{number, online}` | 200 |
| POST | `/api/inject` | `{from, to, body}` | `{wamid}` |
| GET | `/api/log?limit=100` | – | messages with status timeline |
| POST | `/api/reset` | `{keep_numbers}` | 200 |

## WebSocket events (`/ws`, one socket per group)
**Client → server**
| type | payload |
|---|---|
| `group.claim` | `{group}` |
| `message.send` | `{from, to, body}` |
| `tile.presence` | `{number, online}` |
| `chat.read` | `{number, peer}` |

**Server → client**
| type | payload |
|---|---|
| `group.claimed` | `{group, tiles: [{number, online, history, queued}]}` |
| `group.locked` | `{group, since}` |
| `message.new` | `{to, message}` |
| `queue.flush` | `{number, messages[]}` |
| `message.status` | `{wamid, status}` |
