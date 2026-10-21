# AGENTS.md

Guidance for AI assistants working with this codebase. This project is a **production-ready template** for authenticated CRUD apps on Cloudflare Workers: Hono on the server, Inertia + Vue 3 on the client. The products feature is an example—replace it with your own domain.

For the wireframe, full script table, deploy walkthrough and OAuth provider setup, see [README.md](README.md).

## Stack

- **Server**: [Hono](https://hono.dev/) on Cloudflare Workers (Bun for tooling)
- **Client**: [Inertia](https://inertiajs.com/) (`@inertiajs/vue3` v3) + Vue 3 + Vite
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM, injected via TypeDI (`Container.set('DrizzleDB', …)` in `src/index.ts`, read with `getDB()` in `src/db/index.ts`)
- **Auth**: OAuth2 (Google/GitHub) with signed session cookies, double-submit CSRF
- **Tests**: Bun test runner (`tests/`)

## Architecture

### Server request pipeline (`src/server.ts`)

Middleware runs in this order; keep new cross-cutting middleware in the right slot:

1. Static assets (`public/`, and `dist/` in production)
2. CSP + `Cache-Control: no-store` (per-request nonce, `strict-dynamic` in production, Vite origin allowed in dev)
3. Language (`?lang=xx` → cookie → `Accept-Language` → `en`)
4. Fetch-metadata check (`allowRequest` in `src/lib/security.ts` → `403`)
5. Inertia adapter (`@sneakylenny/inertia-hono`): `share()` exposes `locale`, `authUser`, `csrfToken`; `flashSecret` signs one-shot flash cookies
6. Routes: `/auth` (public), then `.use('/products/*', requireAuth, csrfProtect)` → `.route('/products', products)`

**Critical Hono gotcha**: `.use('/products', mw)` matches only the *exact* path `/products`. Subpaths (`/products/new`, `/products/:id`, …) skip the middleware. Always mount route protection with a trailing `/*`: `.use('/products/*', requireAuth, csrfProtect)`. `tests/routes/auth/auth.test.ts` guards this.

### Adding a feature

1. Create `src/routes/<feature>/` with `index.ts` (Hono router), `store.ts` (Drizzle queries), `validation.ts`
2. Register it in `src/server.ts`: `.use('/<feature>/*', requireAuth, csrfProtect)` then `.route('/<feature>', featureRouter)`
3. Add Vue pages in `src/inertia/pages/<feature>/` (`index`, `new`, `edit`, `delete` follow the products pattern)
4. Server side renders pages with `render(c, '<feature>/index', props)` from `@sneakylenny/inertia-hono`

### Inertia client (`src/inertia/`)

- `main.ts`: `createInertiaApp`, offline Iconify collection, layout default
- `layouts/VueCrud.vue`: shell with branding, dark-mode toggle, language switcher, auth menu (reads `usePage().props.authUser`)
- `pages/**/*.vue`: one component per page; the server sends the component name + props
- `composables/useSubmitting.ts`: `submit()` (tracks in-flight state) and `useCsrfHeaders()` — **every mutating visit (`router.post/patch/delete`) must spread `{ ...csrfHeaders.value }` into the visit options**
- `composables/useFlashSuccess.ts`: shows `flash.success` after redirects
- `composables/useLocale.ts`: client-side `t()` mirroring server translations
- `composables/useProductSearch.ts`: the product search value — kept at module scope (never in the URL), so it survives the page remount after cancel/save; when the server filters, the list re-applies it on mount with `router.get('/products/findbyname', { q }, { replace: true })`

Protocol notes:

- Page props arrive in `<script data-page="app" type="application/json">` (not a div attribute)
- Mutating requests must send header `x-csrf-token` = `page.props.csrfToken`; the server compares it to the token in the signed session (`csrfProtect` in `src/routes/auth/index.ts`)
- A `303` after a mutation is **not** a full page load: the XHR client follows it in the background and the final `GET` swaps the page in-app — but the page component remounts (`edit` → `index`), so page-local state is lost. Real full page loads only happen for plain `<a>` tags (logout), `window.location` writes (LanguageSwitcher), and `409` + `x-inertia-location` (the adapter's `external()`/`location()`)
- "Load more" on the product list is `<InfiniteScroll>` (from `@inertiajs/vue3`) with header `x-inertia-infinite-scroll-merge-intent` (`isLoadMoreRequest` in `src/routes/products/index.ts`)

## Auth & CSRF

- `src/routes/auth/common.ts`: signed `SESSION` cookie (httpOnly, SameSite=Lax, secure on HTTPS), bound to stripped user-agent + IP. Secret: `SESSION_SECRET`, resolved by `src/lib/secrets.ts` (dev fallback; production fails fast unless it is a random string of at least 32 characters)
- `src/routes/auth/index.ts`:
  - `requireAuth`: reads the session, sets `authUser` + `csrfToken` on the context. With `AUTH_DISABLED=1` (dev only, never in production) it bypasses login as fixed user `dev:local` / token `dev-csrf-token`. Inertia requests without a session get `409` + `X-Inertia-Location: /auth/login` so the client performs a real page visit instead of rendering the login HTML as an XHR error
  - `csrfProtect`: rejects `POST/PUT/PATCH/DELETE` without a matching `x-csrf-token` header (`403 Invalid CSRF token`)
  - Login page at `/auth/login` is plain server-rendered HTML (GET clears the session = logout)
- `src/routes/auth/github.ts` / `google.ts`: OAuth start + callback. State is an HMAC (`calcStateHmac`) over IP/UA/protocol; redirect URIs derive from the request origin (`src/lib/url.ts`): `<origin>/auth/github` and `<origin>/auth/google`

## Database

- Schema in `src/db/schema.ts` (Drizzle). Price is stored as **cents** (integer); convert with `priceToCents` / `toProduct` in `src/routes/products/store.ts`
- Optimistic concurrency on edit: `modifiedAt` timestamp is verified in the `PATCH` WHERE clause
- Migrations: `bun migrate:create` (generate), `bun migrate:dev` (local), `bun migrate` (production)

## Internationalization

- Languages: `en` (default), `de`, `es`, `fr` — `src/i18n/lang.ts`
- Server: `t(c, 'Key')` with `{0}` placeholders (`src/i18n/request.ts`, translations in `src/i18n/translations.ts`)
- Client: `useT()` from `src/inertia/composables/useLocale.ts` uses the same `translations.ts` table, so a new key only has to be added there (server and client share it)

## Icons

- Vue components import `Icon` from `@iconify/vue/offline` (the API client is excluded; CSP blocks the Iconify API)
- `src/generated/tabler-icons.json` is a pruned collection. The generator scans `src/` for `icon="tabler:…"`, so adding `<Icon icon="tabler:…" />` is enough; run `bun generate:icons` (the build runs it automatically) to update the collection
- `tests/scripts/icons.test.ts` fails if the collection and source drift apart

## Commands

```bash
bun dev            # build once, then Vite (5173) + wrangler (8787)
bun test           # run tests (bun test --watch / --coverage also work)
bun typecheck      # tsc --noEmit (also regenerates src/generated/*)
bun generate       # regenerate the Vite manifest module + pruned icon set
bun migrate:dev    # apply migrations to local D1
bun update:types   # regenerate worker-configuration.d.ts from wrangler.jsonc
bun preview        # build and run the production bundle locally
```

Full table in [README.md](README.md).

## What agents get wrong

- **Hono middleware paths**: `.use('/x', mw)` is exact-path only; use `.use('/x/*', mw)` or subroutes lose auth/CSRF silently
- **Forgetting the CSRF header**: a bare `router.post(url, data)` gets a 403. Use `useCsrfHeaders()` and spread `{ ...csrfHeaders.value }`
- **Rendering a page directly from POST/PATCH**: the Inertia page URL stays on the mutation endpoint, so a reload 404s. Use `back(c, { errors, flash: { old } }, { fallback })` (PRG) and read `flash.old` in the form, as `products/index.ts` does
- **`getSignedCookie` argument order**: it is `getSignedCookie(c, secret, name)` — the *reverse* of `setSignedCookie(c, name, value, secret, opts)`
- **`structuredClone` on Vue reactive proxies** throws `DataCloneError`; copy product props with a shallow spread (`{ ...props.product }`)
- **Mixing package managers**: install with Bun only. A pnpm/bun hybrid creates duplicate package trees and two Vue runtimes, which shows up as `Missing ref owner context` warnings and dead reactivity. If it happens: `rm -rf node_modules && bun install`
- **Stale Vite dep cache** after upgrading packages: `rm -rf node_modules/.vite`, restart `bun dev`
- **`usePage().props` shape**: `locale`, `authUser`, `csrfToken` are always shared; `errors` and `flash` appear on the request after a redirect. A stale browser tab can send an outdated CSRF token after a server restart—hard-reload
- **Environment**: wrangler dev loads `.env`; `AUTH_DISABLED` is ignored when `NODE_ENV=production`. Production also requires `SESSION_SECRET` and `INERTIA_FLASH_SECRET` (≥32 random characters) — see `src/lib/secrets.ts`
- **Worker types**: `worker-configuration.d.ts` is generated—run `bun update:types` after changing `wrangler.jsonc`, don't hand-edit it

## Testing

- `tests/routes/auth/auth.test.ts`: route protection (login redirects, Inertia 409s, CSRF 403s on POST/PATCH/DELETE subpaths) via `app.request(...)`
- `tests/routes/products/`: page clamping, validation, price/pattern helpers and PRG error redirects
- `tests/scripts/icons.test.ts`: icon collection drift
- `tests/middleware/rate-limit.test.ts`, `tests/i18n/`: middleware, language parsing and translations
- Tests import the real `src/server` Hono app; they never touch the network or D1 (handlers that need the DB are not reached in these tests)

## Using this template

1. Clone, `bun install` (runs `prepare` and generates `src/generated/*`), `cp .env.example .env`, `cp wrangler.jsonc.example wrangler.jsonc`, `bun migrate:dev`, `bun update:types`
2. Set OAuth client ids in `wrangler.jsonc` vars; set secrets with `bun secret:google` / `bun secret:github`
3. Set `SESSION_SECRET` and `INERTIA_FLASH_SECRET` as Worker secrets with `bun secret:session` / `bun secret:flash` (≥32 random characters; local dev has fallbacks, production fails fast)
4. Replace the products feature (routes, pages, schema) with your domain
5. Add icons with `<Icon icon="tabler:…" />`; `bun generate:icons` keeps the pruned collection in sync
