# Questions for the server team

From the frontend (`comdove-fake-ui`), 2026-09-19. The UI is built on fake data and switches to the
real mock server by setting `VITE_DATA_SOURCE=server` in `client/.env`. Before that switch works fully, we need
answers to the points below. Each one says what the spec says today, what the UI needs, and a suggestion.

Sources: *Hackathon PRD* and *API Tech Spec*. Frontend plans: [`admin-ui-plan.md`](admin-ui-plan.md),
[`superpowers/plans/2026-09-19-client-ui.md`](superpowers/plans/2026-09-19-client-ui.md).

## Must answer before the switch

### Q1. Message ID for a message a tile sends (client)
- **Spec today:** a tile sends `message.send {from, to, body}` (Tech Spec §7). The server never tells the tile the new
  message's `wamid`. Tech Spec §3 says Comdove's mark-as-read "marks the inbound message read in the tile".
- **Problem:** when `message.status {wamid, status: "read"}` arrives, the tile can't tell which of its own bubbles that
  is, so the blue ✓✓ only appears after the group is reopened.
- **Suggestion:** the tile adds its own id to the send, `message.send {from, to, body, client_id}`, and the server
  answers `message.accepted {client_id, wamid}`. Any equivalent works; we just need the pairing.

### Q2. How the built UI reaches the server (both)
- **Today:** in development, Vite forwards `/api` and `/ws` to `MOCK_SERVER_URL`. A built copy (`npm run build`) has no
  forwarding, so `/api` and `/ws` would hit whatever serves the files.
- **Options:** (a) the mock server also serves the built UI files from `client/dist` (one port, simplest);
  (b) a reverse proxy in front of both; (c) the UI calls the server's full address, which needs CORS on the server.
- **We suggest (a).**

### Q3. Shapes the spec leaves open (both)
Field names the UI already uses. Please confirm or tell us yours. They live in `client/src/types.ts`.

| Call | Spec | UI expects |
|---|---|---|
| `GET /api/groups` | "list with free/locked status" | `[{ name, numbers: string[], locked: boolean, since?: unix }]` |
| `GET /api/business-numbers` | "list" | `[{ phone_number_id, display_number, label, token }]` |
| `GET /api/log?limit=100` | "message list with status timelines and webhook outcomes" | `[{ wamid, from, to, body, status, timestamp, statuses: [{status, timestamp}], webhook?: { state: "ok" \| "retrying" \| "failed" \| "pending", http_status?, attempts, latency_ms?, note? } }]` |
| `group.claimed` tiles | `{number, online, history, queued}` | `history` and `queued` as message lists: `{ wamid, from, to, body, status, timestamp }` |

## Features the UI will add once the server supports them

| # | Feature | Spec today | Suggestion |
|---|---|---|---|
| Q4 | ✅ **Answered** (UI-API-GUIDE §2e: `webhooks[]` per kind with `attempts[]`). Still open: all `state` values, and how a queued message shows. **Webhook result per status.** Sent, delivered and read each send their own webhook (Tech Spec §5: "one webhook per transition"; "every attempt and outcome shows in the admin log") | One `webhook` per log row can't show three | Put the outcome on each entry in `statuses[]`, with every attempt |
| Q5 | **Live admin log** (PRD §4 C5: "HTTP + WebSocket for live log") | No admin event in Tech Spec §7 | A `log.update` event on `/ws` for admin, or keep the 3s refresh |
| Q6 | **Webhook address and handshake result** in the top bar (Tech Spec §5 handshake, §8 `COMDOVE_WEBHOOK_URL`) | No call returns them | `GET /api/config` → `{ webhook_url, handshake: { ok, http_status, checked_at } }` |
| Q7 | ✅ **Answered** (UI-API-GUIDE §2c). **Delete numbers and groups** (PRD §4 C5: "register/delete") | No delete call in Tech Spec §6 | `DELETE /api/business-numbers/{phone_number_id}`, `DELETE /api/groups/{name}` |
| Q8 | **Rejected Comdove sends in the log** (bad token, forced errors; PRD §10 demo) | Not said whether they're logged | Log them with `status: "failed"` and the Meta error code |
