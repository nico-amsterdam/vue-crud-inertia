---
name: agent-cli
description: Drive this app's UI/data as an external agent via scripts/agent-cli.ts (Bun script, pairing-code auth, 5-minute keep-alive window). Use when the user asks to control the app remotely, inspect screens/data, navigate it to a URL, or create/edit/delete products from an agent.
---

# agent-cli — controlling the app as an external agent

Run everything with **Bun** from the project root: `bun scripts/agent-cli.ts <command>`.

The CLI talks to the Hono API under `/agent/*` on the running app (wrangler dev serves it on `http://localhost:8787`). Requests are authenticated with a **pairing code only — never a cookie**.

## Pairing: how to get a code (requires a human)

A pairing code is coupled to one specific logged-in browser session. You **cannot** obtain it yourself:

1. The user logs into the app (OAuth) in their browser.
2. In the app header the user clicks **"Start AI agent pairing"**, then **Copy**, and gives you the code (e.g. `tyzg2quju7i2tspugy94psq6`).
3. Save it and use it for every call:

```bash
bun scripts/agent-cli.ts login --pairing-code <code>
# other application instance / port:
bun scripts/agent-cli.ts login --pairing-code <code> --base-url http://localhost:8999
# or via env: AGENT_BASE_URL=http://localhost:8999 bun scripts/agent-cli.ts ...
```

Mouse-less/bot-only flow is impossible: `POST /agent/pairing/create` is rejected for agent callers (401) — it only works from the logged-in browser. If you get 401 on any command with a saved code, ask the user for a fresh code; do not retry with curl-hacks.

## Keep-alive: the 5-minute browser heartbeat

- While the pairing was created, the browser polls `/agent` endpoints every 2 s; the server persists that heartbeat at most once per minute (`pairing_codes.last_accessed_at`).
- **If the browser tab is closed, or pairing was "removed" in the UI, and no poll happened for 5 minutes, every agent request returns `401 {"error":"Pairing window expired: …"}`.**
- You cannot refresh the heartbeat yourself — agent requests never update the timestamp (by design). Recovery is always: user clicks "Start AI agent pairing" in the browser again and you re-login with the new code.
- So: prefer batched work inside one window; ask for a fresh code before long idle stretches.

## Commands

```
login    --pairing-code <code> [--base-url <url>]   # save to .agent-session.json (gitignored repo root); a GET /agent/screen probe verifies the code and URL — 401 removes the saved file
logout                                              # remove the saved pairing code
screen                                              # GET  /agent/screen  — current screen name + params + route
screens                                             # GET  /agent/screens — screen registry (route + context keys)
data                                                # GET  /agent/data    — row data for the current screen
form                                                # GET  /agent/form    — the browser's last new/edit form submission: values + the errors the UI showed
navigate <screen> [paramsJson]                      # POST /agent/navigate — browser will Inertia-visit that route
create    '<productJson>'                           # POST /agent/products
edit <id>  '<productJson>'                          # PATCH /agent/products/:id — FULL replacement: send name, description AND price every time
delete <id>                                         # DELETE /agent/products/:id
```

Known screens (`browser polls GET /agent/navigate` and follows them): `products`, `products/new`, `products/edit` (param `id`), `products/delete` (param `id`).

## Product payload

Field names are camelCase. `price` is stored as cents server-side and accepts **either** a decimal string `'12.50'` (what the UI form sends — the reference format) **or** a JSON number `12.99`; both go through the same rules as `src/routes/products/validation.ts`: non-negative, at most 2 decimal places, at most 1,000,000. `0`, omitting the field and `""` all mean "no price" (`null`); booleans/arrays/objects are rejected. `data` and `form` return `price` as a **number**:

```bash
bun scripts/agent-cli.ts create '{"productName":"Widget","description":"A widget","price":"12.50"}'
bun scripts/agent-cli.ts edit 7 '{"productName":"Widget 2","description":"Better","price":9.99}'
bun scripts/agent-cli.ts delete 7
```

`edit` is a **complete replacement, not a partial merge**: PATCH here means "send the full valid product". Omitted fields are applied as their empty defaults (`description` → `""`, `price` → cleared) — the "missing = keep current value" merge-patch convention does **not** apply. Safe pattern: call `data` (or `GET` the list) first and send back the row you fetched with your one field changed.

Validation failures return `400 {"errors": {...}}` before reaching SQLite conflicts; duplicate names return `409 {"error":"Name exists"}`.

## The form the user last submitted (`form`)

`GET /agent/form` (`form` in the CLI) returns the browser session's **last new/edit submission** as captured server-side in `app_state`: `{ screen: 'products/new' | 'products/edit', id, values, errors, succeeded, at }`. `values` are the fields the client sent; `errors` are the translated per-field errors the UI rendered (or `null` when it succeeded). Use it to see why the user's own Create/Edit attempt failed, or to verify what they typed before you act — it is `null` until the user submits a form at least once. Only browser form submissions are stored there; the agent's own `product_create`/`product_edit` calls return their errors inline and do not touch it.

## Conventions and gotchas

- The CLI exits non-zero with `status, body` on any error; script around that, and treat a 401 "pairing window expired" as "ask the user to re-pair".
- `.agent-session.json` lives in the repo root — never commit nor echo its contents on a shared machine; `logout` deletes it.
- Deleting the browser session (logout link), removing the pairing in the UI, or the paired user logging out invalidates the code immediately (row deleted server-side).
- The CLI never sends CSRF tokens — none needed for pairing-code requests. If you see `403 Invalid CSRF token`, you bypassed the CLI and sent the browser's cookie instead: don't.
- To find out where the user currently is (screen + id) call `screen` first; `data` returns the same screen's dataset (product or product list, `null` for screens without data).
- After `navigate`, the change happens in the user's browser asynchronously (Inertia visit via the 2 s poll). Poll `screen` until it reflects the target before assuming success (a couple of seconds is usually enough).
