# Fake WhatsApp Server — Testing Status & What's Left

**Date:** 21 Sep 2026
**Scope:** fake server (backend `comdove-fake-backend` + UI `comdove-fake-ui`)
**Reference:** the acceptance test = the **Demo Script** in the Hackathon PRD (§10)

> This lists what has been tested and what testing is still left, so anyone can finish the run.

---

## 1. Already tested — working ✅

| # | Test | Result |
|---|------|--------|
| 1 | Register a business number + create a group (Admin) | ✅ works |
| 2 | Point wat-backend at the mock via env (no code change) | ✅ works |
| 3 | Send from Comdove → customer: appears in tile, sent → delivered → read tracked | ✅ works |
| 4 | Reply from a tile (customer → Comdove): reaches Comdove | ✅ works |
| 5 | Live end-to-end vs the REAL wat-backend (both directions) | ✅ works |
| 6 | Chat direction: customer's own messages on the right (WhatsApp-style, PRD §7) | ✅ fixed + verified |
| 7 | Status behaviour: outbound has status, inbound has none (per FR-06/FR-07) | ✅ correct by design |
| 8 | Session lock: a 2nd browser tab on an open group is refused | ✅ works |
| 9 | Admin live log: every message with status + webhook result | ✅ works |
| 10 | Reset: messages clear, numbers/groups remain | ✅ works |
| 11 | Automated tests: backend 270 pass · UI 94 pass | ✅ green |

---

## 2. Testing still LEFT ⬜

These are Demo-Script steps not yet verified live end-to-end.

### Step 4 — Offline queue ⬜
- **What:** toggle a tile **offline** (grey dot) → send a message from Comdove to it → toggle **online** (green).
- **Expected:** the message is **queued** while offline, then **arrives in order** when the tile comes online; delivered fires.
- **Why it matters:** proves FR-05 (offline queue + flush).

### Step 5 — Close & reopen a group ⬜
- **What:** open a group, send 2–3 messages, **close the group tab**, then **reopen** it.
- **Expected:** the tile's **full chat history** comes back **plus** anything queued while closed; late delivered/read fire on reconnect (visible in the admin log).
- **Why it matters:** proves FR-17 + FR-18 (persistence + late statuses).

### Step 8 — Keyword auto-reply ⬜
- **What:** set a tile's auto-reply to **keyword** (e.g. "price" → "It is 500") via the gear, then send a matching message from Comdove.
- **Expected:** the tile **auto-replies** on its own → a short bot conversation.
- **Why it matters:** proves FR-10 (auto-reply).

### Step 9 — Bad token error ⬜
- **What:** send from Comdove using a **wrong token** (or force it).
- **Expected:** the mock returns Meta's **error JSON (code 190)** and Comdove handles it (shows the failure).
- **Why it matters:** proves FR-03 (real Meta error handling).

---

## 3. Known UI items to confirm (not blocking, but verify)

| Item | Note |
|------|------|
| Tile chat display (`+undefined` / `NaN:NaN`) | Fixed on branch `fix/tile-chat-message-shape` — verify once merged |
| Chat direction (own = right) | Fixed + verified; confirm it stays after merge |
| Ticks in the tile | Not required by the PRD (status chips live in the Admin log); current tick placement follows Comdove's outbound status — confirm this is acceptable with the team |
| Production serving of the built UI | Dev proxies `/api` + `/ws`; a built UI needs the mock to serve `client/dist` or a proxy — decision pending |

---

## 4. How to run the remaining tests (quick)

Have running: mock (`:4020`), UI (`:5173`, `VITE_DATA_SOURCE=server`), and — for real-Comdove tests — wat-backend (`:3000`, local DB).

- **Offline queue (Step 4):** in a tile, click the online dot to grey → send from Comdove (or `POST /api/inject` reversed) → click the dot green → watch it arrive.
- **Close/reopen (Step 5):** send a few, click "← Groups" (or close the tab), reopen the group → history + queued should appear.
- **Auto-reply (Step 8):** tile gear → keyword mode → add "price → It is 500" → send "what is the price?" from Comdove.
- **Bad token (Step 9):** send with a wrong bearer token to `POST /v23.0/{id}/messages`, or use the `X-Mock-Force-Error: 190` header.

---

## 5. Summary

- **Core is tested and working** (send/receive both ways, direction, status, lock, reset, live vs real Comdove).
- **4 demo steps left to verify live:** offline queue, close/reopen, auto-reply, bad-token error.
- After those 4 tick, the **full PRD demo script (§10) is complete**.
