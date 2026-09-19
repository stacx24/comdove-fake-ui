# Admin UI — Plan

Branch: `feature/admin-ui` · Page: `/admin` · Folder: `client/`

Sources:
- *Comdove WhatsApp Mock Server — Hackathon PRD* (FR-01, FR-11, FR-12, FR-13, FR-15)
- *Comdove Mock Server — API Tech Spec* (§6 Control API)
- Design: *Comdove Mock UI* (claude.ai/design), Admin screen

Status: **plan only, nothing built yet.**

---

## 1. What the Admin page is for

The admin page is where the person running a test **sets up the mock** and **watches the traffic**.
The Client page is where testers act as customers. It is a separate task on `feature/client-ui`.

| Section | Why we need it |
|---|---|
| Register business number | Gives Comdove a company number to send from, with an ID and a fake token to put in Comdove's settings |
| Create group *(new, not in the design)* | Registers customer numbers in groups of up to 10. Without a group, the Client side has nothing to open, and Comdove can't message those numbers. |
| Registered numbers | One list of every business and customer number, with the token to copy and who has each group open |
| Live message log | Shows every message going sent → delivered → read and whether Comdove received the webhook. This is where Comdove bugs show up. |
| Reset | Clean start before each test run. Numbers and groups can be kept. |

---

## 2. Layout (from the design)

```
┌─ Top bar: [M] comdove-mock  localhost:4020   [Client /client] [Admin /admin]   ● webhook → localhost:3000/... ┐
├──────────────────────────────┬───────────────────────────────────────────────────────────────────────────┤
│ Register business number     │ Registered numbers                                            N total     │
│  Display number [        ]   │ Number | Label | phone_number_id | Token [copy] | Type | Claim            │
│  Label          [        ]   │ ...                                                                       │
│  [Register]                  │                                                                           │
├──────────────────────────────┤                                                                           │
│ Create group   (NEW)         │                                                                           │
│  Group name     [        ]   │                                                                           │
│  Customer numbers (≤10)      │                                                                           │
│  [                      ]    │                                                                           │
│  [Create group]              │                                                                           │
├──────────────────────────────┴───────────────────────────────────────────────────────────────────────────┤
│ Live message log   ● streaming · newest first                         GET /api/log?limit=100   [Reset]   │
│ Time | From | To | Text | sent delivered read | Webhook                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Look: dark background, gold accent (#E4B063), fonts Instrument Sans and JetBrains Mono, same as the design.

---

## 3. Sections in detail

### 3.0 Top bar
- Logo, `comdove-mock`, server address `localhost:4020`, and the **Client / Admin** buttons.
- Right side: "● webhook → localhost:3000/webhooks/whatsapp", as in the design.
- The server keeps the webhook address in its `.env` (`COMDOVE_WEBHOOK_URL`, Tech Spec §8), and **no server call returns it or the handshake result** yet (Tech Spec §5).
- **Now:** show the address from sample data (or our `.env`, `VITE_WEBHOOK_URL`) with a **grey** dot meaning "not checked".
- **After the server is set up:** read it from the server (see §10) and turn the dot green or red based on the handshake result.

### 3.1 Register business number
- Inputs: **display number** (digits only, 8–15 long) and **label** (e.g. "Sales").
- **No hard limit on the count.** PRD FR-01 says "5 to 10" business numbers. That's the target for the demo, not a rule, so the form won't block an 11th number.
- Click Register → server call `POST /api/business-numbers {display_number, label}` → gets back `{phone_number_id, token}`.
- After success: show the new ID and token, clear the form, and refresh the numbers table.
- Errors: empty or invalid number, or a number that's already registered. The message shows under the form.

### 3.2 Create group (new)
- Inputs: **group name** (lowercase letters, numbers and dashes, because it goes in the URL `/client?group=alpha`) and **customer numbers** (one per line or comma-separated).
- Checks before sending: 1 to 10 numbers, digits only, no duplicates, not already in another group, and a group name that isn't taken.
- Click Create → `POST /api/groups {name, numbers}` → refresh the numbers table.
- Same style as the Register card, placed under it.

### 3.3 Registered numbers table
- Data: `GET /api/business-numbers` (business) + `GET /api/groups` (customers come from the groups).
- Columns: Number, Label (the group name for customers), phone_number_id, Token + **Copy** button, Type (business in gold, customer in grey), Claim ("alpha · live" if that group is open in a browser, otherwise "free").
- Header shows the total count. The table scrolls when there are many rows (up to about 150).

### 3.4 Live message log
- Data: `GET /api/log?limit=100`, newest first.
- Columns: Time, From, To, Text, Status tags (**sent / delivered / read**, each lit once reached), Webhook.
- Webhook column:
  - green `200 · 84ms`: Comdove received it
  - orange `retry 2/3 · 500`: Comdove returned an error and the mock is retrying
  - grey `queued · tile offline`: waiting for the customer to come online
- Updates automatically: refreshes every 3 seconds for now (the spec has no admin WebSocket event yet).

### 3.5 Reset
- Red **Reset** button in the log header opens a confirm box: "Reset mock server?", with a **Keep numbers and groups** tick box (ticked by default).
- Confirm → `POST /api/reset {keep_numbers}` → refresh everything.
- **Address:** we use **`/api/reset`** from Tech Spec §6. PRD FR-12 writes it as `/reset`; the Spec is the source of truth for paths.

### 3.6 Server errors (all forms and Reset)
- Tech Spec §6: server-call errors come back as `{ "error": { "message": "..." } }` with a 4xx code.
- Every form shows **that exact message** under the button (e.g. "number already registered"), in red.
- If the server can't be reached: "Mock server not reachable at localhost:4020".
- Sample mode returns errors in the same shape, so the screens behave the same in both modes.

---

## 4. Fake data now, real server later

- All server calls live in **one file**: `client/src/api.ts`.
- Two modes, chosen in `.env` with `VITE_DATA_SOURCE`:
  - `sample` (default for now): returns the design's sample data. Register, Create group and Reset work in the browser's memory until the page is refreshed.
  - `server`: calls the real mock server through the Vite proxy (`/api` → `localhost:4020`).
- When the server is ready, only this file and the `.env` value change. The admin page stays as it is.

**To confirm with the server team:** the spec doesn't define the exact shape of a log row's webhook result (status code, attempts, time taken) or the "claim" info. We'll agree on it and write it in the README.

---

## 5. Files

| File | Contents |
|---|---|
| `src/pages/Admin.tsx` | Page layout, puts the sections together |
| `src/components/TopBar.tsx` | Top bar with Client / Admin navigation (shared with Client) |
| `src/components/admin/RegisterNumberForm.tsx` | 3.1 |
| `src/components/admin/CreateGroupForm.tsx` | 3.2 |
| `src/components/admin/NumbersTable.tsx` | 3.3 |
| `src/components/admin/MessageLog.tsx` | 3.4 |
| `src/components/admin/ResetDialog.tsx` | 3.5 |
| `src/api.ts` | Server calls + sample/server switch |
| `src/mock/sampleData.ts` | Sample numbers, groups, log |
| `src/types.ts` | Data shapes (add the webhook result shape) |
| `src/index.css` | Colours, fonts, shared styles |

---

## 6. Rules (PRD §8)

- `data-testid` on every button and input, using the design's names:
  `nav-admin`, `reg-number`, `reg-label`, `reg-submit`, `group-name`, `group-numbers`, `group-submit`, `number-row-{number}`, `copy-token-{number}`, `log-row`, `reset`, `reset-keep`, `reset-cancel`, `reset-confirm`.
- The admin page only talks to the server through `api.ts`. Nothing happens only on screen.

---

## 7. Steps

1. Styles: colours, fonts, top bar.
2. Data layer: `types.ts`, `sampleData.ts`, `api.ts` with the sample/server switch.
3. Register business number form.
4. Create group form.
5. Registered numbers table with copy token.
6. Live message log with the 3-second refresh.
7. Reset with confirm.
8. Check: build passes, click through every section in the browser, compare with the design.
9. Commit and push to `feature/admin-ui`. Merging to `main` is for the team to do.

---

## 8. How we'll know it's done

- [ ] Registering a number shows its ID and token and adds a row to the table
- [ ] Creating a group with 1–10 numbers adds customer rows; 11 numbers or a duplicate is refused with a clear message
- [ ] Token copy button works
- [ ] Log shows the status tags and webhook result like the design and refreshes by itself
- [ ] Reset clears the log; with "keep" ticked, numbers and groups stay
- [ ] Every button and input has a `data-testid`
- [ ] Switching `VITE_DATA_SOURCE=server` needs no change to the admin page
- [ ] Top bar shows the webhook address with a grey "not checked" dot
- [ ] Every form shows the server's error message in red; 11th business number is allowed
- [ ] Reset calls `/api/reset`

---

## 9. Not in this task

- Client pages (group list, tiles), on `feature/client-ui`
- The mock server itself
- Everything in §10 (done after the server is set up)

---

## 10. After the server is set up (ask the server team first)

| # | Item | Why | Source |
|---|---|---|---|
| 1 | **One webhook per status.** A message can have 3 webhook results (sent, delivered, read). Show the latest in the row and all attempts when the row is clicked. | Spec says "one webhook per transition" and "every attempt and outcome shows in the admin log" | Tech Spec §5 |
| 2 | **Live log over WebSocket** instead of the 3-second refresh | PRD says admin uses "HTTP + WebSocket for live log", but the Spec defines no admin WebSocket event | PRD §4 C5 vs Tech Spec §7 |
| 3 | **Server call for top bar info** (webhook address + handshake result), e.g. `GET /api/config` | Nothing returns them today | Tech Spec §5, §8 |
| 4 | **Delete numbers and groups** | PRD says "register/delete", Spec has no delete call | PRD §4 C5 vs Tech Spec §6 |
| 5 | **Show rejected Comdove sends** (401, 400, forced errors) in the log | Helps the "trigger one error case" demo step | PRD §10, Tech Spec §4 |
| 6 | **Test helper calls in admin** (inject message, set presence) | Spec lists them for automation; PRD doesn't need them in the UI | Tech Spec §6 |
| 7 | **Agree the exact shapes** of the log row webhook result and the group "claim" info, and write them in the README | The Spec doesn't define them | Tech Spec §6 |
| 8 | **Share the README contract** with the server repo | PRD expects one repo with both apps; ours is UI only | PRD §3, §10 |
