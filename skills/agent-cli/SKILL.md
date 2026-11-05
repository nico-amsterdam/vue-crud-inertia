---
name: agent-cli
description: Drive this app's UI/data as an external agent via scripts/agent-cli.ts (Bun) or scripts/agent-cli.py (Python 3.10+, stdlib only) — pairing-code auth, 5-minute keep-alive window. Use when the user asks to control the app remotely, inspect screens/data, navigate it to a URL, or create/edit/delete products from an agent.
---

# agent-cli — controlling the app as an external agent

Run everything from the project root with **either** runner — they implement the same commands and share `.agent-session.json`, so you can log in with one and call with the other:

```bash
bun scripts/agent-cli.ts <command>      # Bun
python3 scripts/agent-cli.py <command>  # Python 3.10+, stdlib only (argparse/urllib)
```

The examples below use the Bun one; substitute `python3 scripts/agent-cli.py` everywhere.

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
product_list [--q <namePrefix>] [--page <n>]        # GET  /agent/products — one page of products (100 per page), name-prefix filter, agent twin of /products/findbyname
product_create  '<productJson>'                     # POST /agent/products
product_update <id> '<productJson>'                   # PATCH /agent/products/:id — FULL replacement: send name, description AND price every time
product_delete <id>                                 # DELETE /agent/products/:id
```

Known screens (`browser polls GET /agent/navigate` and follows them): `products`, `products/new`, `products/edit` (param `id`), `products/delete` (param `id`). `products` always visits the plain `/products` list — `q`/`page` params on the navigate command are not used by the browser (use `product_list` for filtered agent-side reads).

## Product payload

```bash
bun scripts/agent-cli.ts product_create '{"productName":"Widget","description":"A widget","price":"12.50"}'
bun scripts/agent-cli.ts product_update 7 '{"productName":"Widget 2","description":"Better","price":9.99}'
bun scripts/agent-cli.ts product_delete 7
```

## Listing products (`product_list`)

`GET /agent/products` accepts `q` (name prefix) and `page` (1-based) — the agent twin of the UI's `/products/findbyname`:

```bash
bun scripts/agent-cli.ts product_list                          # first page, unfiltered
bun scripts/agent-cli.ts product_list --q 'Pro'                # names starting with "Pro"
bun scripts/agent-cli.ts product_list --q 'Pro' --page 2       # second page of that filter
```

It returns `{ q, page, products, hasMore }` where `products` are name-sorted products (100 per page, `PER_PAGE` in `src/routes/products/store.ts`). `q` matches the **starting letters** of the product name (SQL `LIKE …%`, case-insensitive ASCII) — this is a prefix filter, not a substring search, and unlike the small client-side list there is no description/price matching. `q` is clamped to the maximum name length; an empty `q` is the unfiltered list. When `hasMore: true`, fetch the next page with `--page <n+1>`; once `hasMore` is `false` you have seen everything matching `q`.

Both runners accept `--q`/`--page` the same way (`python3 scripts/agent-cli.py product_list --q 'Pro' --page 2`).

`edit` is a **complete replacement, not a partial merge**: PATCH here means "send the full valid product". Omitted fields are applied as their empty defaults (`description` → `""`, `price` → cleared) — the "missing = keep current value" merge-patch convention does **not** apply. Safe pattern: call `data` (or `GET` the list) first and send back the row you fetched with your one field changed.

Validation failures return `400 {"errors": {...}}` before reaching SQLite conflicts; duplicate names return `409 {"error":"Name exists"}`.

## The form the user last submitted (`form`)

`GET /agent/form` (`form` in the CLI) returns the browser session's **last new/edit submission** as captured server-side in `app_state`: `{ screen: 'products/new' | 'products/edit', id, values, errors, succeeded, at }`. `values` are the fields the client sent; `errors` are the translated per-field errors the UI rendered (or `null` when it succeeded). Use it to see why the user's own Create/Edit attempt failed, or to verify what they typed before you act — it is `null` until the user submits a form at least once. Only browser form submissions are stored there; the agent's own `product_create`/`product_update` calls return their errors inline and do not touch it.

## Conventions and gotchas

- `AGENT_DISABLED=1` (server env) switches the whole agent feature off: every `/agent/*` endpoint answers `404` and the UI hides its pairing section. If every call suddenly 404s, that flag is set — ask the user, don't retry.
- `AGENT_ENABLED` (server env) is a comma-separated capability allow-list: unset means everything is allowed; if it is set and does not list `products`, the product commands (`product_list`, `product_create`, `product_update`, `product_delete`) answer `403 {"error":"Agent capability 'products' is not in AGENT_ENABLED"}` while `screen`/`data`/`form`/`navigate` keep working — ask the user to add `products` to `AGENT_ENABLED`.
- The CLI exits non-zero with `status, body` on any error; script around that, and treat a 401 "pairing window expired" as "ask the user to re-pair".
- `.agent-session.json` lives in the repo root — never commit nor echo its contents on a shared machine; `logout` deletes it.
- Deleting the browser session (logout link), removing the pairing in the UI, or the paired user logging out invalidates the code immediately (row deleted server-side).
- The CLI never sends CSRF tokens — none needed for pairing-code requests. If you see `403 Invalid CSRF token`, you bypassed the CLI and sent the browser's cookie instead: don't.
- To find out where the user currently is (screen + id) call `screen` first; `data` returns the same screen's dataset (product or product list, `null` for screens without data).
- On the `products` list screen, `params` mirror what the user is looking at: the browser's visits to `/products/findbyname` and its "load more" scrolls sync `q` (name prefix) and `page` into the server state, and `data` serves that filtered page — not just page 1. A plain `/products` load resets `q` to `""` and `page` to its value rather than leaving a stale filter behind.
- After `navigate`, the change happens in the user's browser asynchronously (Inertia visit via the 2 s poll). Poll `screen` until it reflects the target before assuming success (a couple of seconds is usually enough).
- To refresh the screen you are already on, navigate to it again (e.g. `navigate products`).