# Project starter: Inertia + Vue with Hono on Cloudflare

## Features

- ⛅ **Cloud**: Deploy to Cloudflare without any hassle
- 🔐 **Authentication**: Login with Google or GitHub. Easy setup instructions
- ⚡ **Inertia**: Server-driven pages with smooth client-side navigation
- ✨ **Modern user interface**: Vue 3 single-page app served by the Hono backend
- 🧩 **Lightweight web framework**: Hono is tiny, has built-in middleware and clean APIs
- ↻  **Live reload**: Changes in the code are immediately visible in the browser during development
- 💾 **Database**: Drizzle ORM with SQLite
- 🔄 **Migrations**: Database migration system
- ✅ **Testing**: 70+ unit tests. Run by Bun's speedy test runner
- 🧠 **Type Safety**: Full TypeScript support. Enables IDE intelliSense and real-time error checking
- ☎  **Mobile compatible**: Responsive web design. Manifest enables 'Add to Home Screen'
- 🕶 **Accessible**: Follows WCAG and WAI-ARIA standards for accessibility
- 🌐 **Internationalization**: Switch between English, German, Spanish and French
- 🎨 **Self-hosted icons**: Iconify (tabler) icons pruned and bundled — no CDN needed
- 🛡️ **Security**: Content security policy with nonces, signed cookies, fetch metadata checks, CSRF, rate limiting
- 🚀 **Ready to launch**: Skip the scaffolding. Get straight to implementing your business ideas

## Wireframe

```text
+-------------------------------------------------------------+
| Vue CRUD Inertia       ☼☽      [User] [Sign Out] [Lang ▼]   |
+-------------------------------------------------------------+
| [+ Add product]                                 [↻ Refresh] |
| Search: [_________________________] (updates as you type)   |
+-------------------------------------------------------------+
| Name       | Description |     Price | Actions              |
|------------|-------------|-----------|----------------------|
| product2   | 2nd         |  102.78 € | [Edit] [Delete]      |
| product3   | 3rd         |    5.09 € | [Edit] [Delete]      |
| product4   | 4th         | 9000.22 € | [Edit] [Delete]      |
| product5   | 5th         |   55.55 € | [Edit] [Delete]      |
| product6   | 6th         |    2.99 € | [Edit] [Delete]      |
+-------------------------------------------------------------+
```

## About this project

Rebuild of this [Vue CRUD Nuxt application](https://github.com/nico-amsterdam/vue-crud-nuxt) with [Inertia](https://inertiajs.com/), [Vue 3](https://vuejs.org/), [Hono](https://hono.dev/) and [Bun](https://bun.com/), with the option to deploy it on Cloudflare, so everything can run on the edge in the cloud.

There is a demo on https://vue-inertia-crud.nico-amsterdam.workers.dev/. Login with your Google or GitHub account.

The server-side rendered sibling of this project is [bun-htmx-crud](https://github.com/nico-amsterdam/bun-htmx-crud) (HTMX + Elysia). This project keeps the same features and security model, but with a Vue 3 client. Advantages of this project are the Vue ecosystem, and it is also easier to add custom (reactive) client-side code.

Inertia sits between the router and the frontend: the server stays in charge of routes and data, and ships page props to Vue components. You get single-page app navigation without building and maintaining a separate JSON API.

You can use this project as a starter for your Inertia application with authentication.
Git clone this repository, or download the source from GitHub.

[SQLite](https://www.sqlite.org/index.html) is the central database. More specifically [Cloudflare D1](https://developers.cloudflare.com/d1/worker-api/d1-database/).
D1 is a managed database with automatic backups (Time Travel).
It is great for most CRUD applications. There are a few limitations; D1 has a maximum size of 10 GB per instance (5 GB in the free plan) and it doesn't support transactions with multiple steps, though it does support atomic batch operations.

## Directory structure

```text
├── e2e/                   # Playwright end-to-end tests
├── migrations/            # database migrations (generated per deployment, not committed here)
├── public/                # public assets
│   ├── css/               # stylesheets
│   ├── images/            # images
│   ├── privacy.html       # also served at /privacy (redirect)
│   └── terms.html         # also served at /terms (redirect)
├── scripts/               # code generators (icons, Vite manifest module)
├── src/                   # source code
│   ├── db/                # database schema and client
│   ├── generated/         # generated files (Vite manifest module, pruned icon set)
│   ├── i18n/              # internationalization
│   ├── inertia/           # client-side Vue application
│   │   ├── components/    # reusable Vue components
│   │   ├── composables/   # reusable functions
│   │   ├── layouts/       # top section of the Vue pages used in main.ts
│   │   └── pages/         # Inertia page components
│   │       └── products/  # example CRUD feature (replace with your domain)
│   ├── lib/               # security and url helpers
│   ├── middleware/        # middleware like for example rate limiting
│   ├── routes/            # server-side routes
│   │   ├── auth/          # OAuth authentication (Google/GitHub), session, CSRF
│   │   └── products/      # example CRUD feature (replace with your domain)
│   ├── types/             # TypeScript types
│   └── server.ts          # Hono app: middleware, Content Security Policy, Inertia share
└── tests/                 # subfolders in tests follow the src/ structure
```

## Getting Started
- install [Git](https://github.com/git-guides/install-git)
- install [Bun](https://bun.com) package manager and test runner.
- install [Node](https://nodejs.org/en/download). I recommend using nvm for the installation of Node.
  Node is needed in this project, because Cloudflare's miniflare does not run on the Bun runtime.
- [Create a GitHub project with this template](https://github.com/nico-amsterdam/vue-crud-inertia/generate) and get the project without git history.
Or download, clone or fork the source code
```bash
git clone https://github.com/nico-amsterdam/vue-crud-inertia.git
```

- run:

```bash
cd vue-crud-inertia
bun install
cp .env.example .env
cp wrangler.jsonc.example wrangler.jsonc
bun migrate:create
bun migrate:dev
bun update:types
```

`bun install` runs the `prepare` script, which generates the Vite manifest module and the
pruned icon set in `src/generated/`. If those files are missing (for example after deleting
`src/generated/`), run `bun generate` before `bun test` or `bun typecheck`.

`bun migrate:create` generates your initial migration from `src/db/schema.ts`.
`bun migrate:dev` applies it to the local database. 
Commit both `migrations/` and your `wrangler.jsonc` in your own repository. 
After changing `src/db/schema.ts`, run `bun migrate:create` again and commit the generated migration.

## Setup Google and GitHub authentication

[Setup Google](https://github.com/nico-amsterdam/bun-htmx-crud/blob/main/auth-setup-google.md)

[Setup GitHub](https://github.com/nico-amsterdam/bun-htmx-crud/blob/main/auth-setup-github.md)

In .env set your GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET

In .env set your GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET

The callback / redirect uri is `<origin>/auth/github` for GitHub and `<origin>/auth/google` for Google.
The origin is derived from the request automatically (see `src/lib/url.ts`), so add both your local
development origin (typically http://localhost:8787) and your production origin to the OAuth app.

## Development

To start the development server run:
```bash
bun dev
```

Open the link shown in your terminal (typically http://localhost:8787) in your browser to see the result.
Vite runs on port 5173 and serves the Vue modules; the Hono server on port 8787 renders the pages.

Tip: set `AUTH_DISABLED=1` in .env to skip login for local testing. Every request then runs as a
fixed `dev:local` user. This bypass is ignored when NODE_ENV is production.

To run type checking in watch mode (auto-reloads on file changes):
```bash
bun typecheck:watch
```

`bun preview` runs the production bundle locally (`NODE_ENV=production`), so it needs a
`INERTIA_FLASH_SECRET` of at least 32 characters in `.env` (or the environment). `bun dev`
uses development fallbacks and does not.

## Deploy to Cloudflare

In the wrangler.jsonc set your GITHUB_CLIENT_ID and GOOGLE_CLIENT_ID

In .env set your Cloudflare account id. This is a hex string of 32 chars,
which can be seen in the url of https://dash.cloudflare.com/ when logged in.

The session and flash secrets are Worker secrets, not `.env` values. Each must be a
random string of at least 32 characters. In production the app refuses to start if
either secret is missing, still a placeholder from `.env.example`, or shorter than
32 characters. Generate one with `openssl rand -base64 48`. Local development falls
back to development-only secrets, so `bun dev` works without this setup (but
`bun preview` and deploys do not). The secrets are set after the first deploy,
in the block below.

To deploy to cloudflare:
```bash
bun wrangler login   # login on your Cloudflare account
bun create:db        # interactive: use DB as binding
```

Copy the database_id from the `bun create:db` output into the `database_id` field of
your `wrangler.jsonc`, and set `DB_ID` in the .env file to the same value.

Remove old bindings from wrangler.jsonc, such that only one DB binding remains.

```bash
bun migrate
bun secret:google
bun secret:github
bun secret:session
bun secret:flash
bun deploy:app
```

Open the shown link by the deploy:app command in your browser to see the result.

On the first deploy the Worker refuses to start until the session and flash secrets are
set; running the `secret:*` commands above creates a new deployment with them.

## OAuth2 (or OpenID connect) security

- OpenID connect (OIDC) is a very thin layer around OAuth2
- This application uses signed session cookies; the cookies can be read with the browser devtools, but modifying them to login as a different user will not succeed, because they are digitally signed.
- The session cookies are bound to the user agent and IP address of the visitor (normalized), so a stolen cookie does not work from another context.
- The session cookies have a session id. The session id is currently not used, because the server doesn't keep session information. As a result, the sessions do not timeout.
- Although they are session cookies, most browsers by default do not delete session cookies when the tab or the browser is closed. In principle the window.unload event could be used clean up the session cookies, but with OAuth2 this doesn't provide more security; see next bullet point
- Google/GitHub OAuth2 can be used as an identity provider (what I like), but it also provides single sign on (what I don't like). There is no good way to only log out of the application, and expect that they must enter credentials again on relogin. I could do a Federated/Single Logout, but that means for example for the Google users that they will need to relogin for Gmail and other google services. The SSO sessions are long lasting sessions.
- I have configured the login url to always prompt for consent (so it does not automatically redirect back when there is still a valid SSO session and permissions where already granted by the user), but it is very easy to remove this from the url.

## Tips

- Run `bun logtail` to view the log of the application running on Cloudflare
- Run `bun studio:db` to view the production database with Drizzle Studio. Needs the Cloudflare environment settings in the .env file. Create the Cloudflare token with the following additional account permission: D1:Edit
- The content of the local database can be quickly viewed with `bun dbcat:db:dev`
- Automatically replicate your database around the world to improve global latency for read actions. Enable read replication for the database in the [Cloudflare dashboard](https://dash.cloudflare.com/)
- If you define a CLOUDFLARE_API_TOKEN environment variable in the .env file, wrangler will automatically use this token (instead of `wrangler login`). Make sure that the token has enough permissions
- Icons: the tabler icon set is pruned to the icons the app uses (`src/generated/tabler-icons.json`). The generators scan `src/` for `icon="tabler:…"`, so adding a new icon name in a Vue component is enough; run `bun generate:icons` (the build does this automatically) to update the collection. Icons are rendered offline through `@iconify/vue/offline`, so no requests go to the Iconify API.
- Use only Bun for installing packages (`bun install`). Mixing package managers (for example pnpm and bun) creates duplicate package copies in node_modules; with two Vue runtimes this shows up as `Missing ref owner context` warnings and broken reactivity. If it happens anyway: `rm -rf node_modules && bun install`.
- Stale Vite dependency cache after upgrading packages: `rm -rf node_modules/.vite` and restart `bun dev`.

## Available Scripts

| Script | Description |
|--------|-------------|
| `bun update:types` | Generate TypeScript types from your Cloudflare Worker configuration |
| `bun generate` | Generate the Vite manifest module and the pruned icon set |
| `bun generate:icons` | Prune the tabler icon set down to the icons used in the app |
| `bun generate:manifest` | Generate the Vite asset manifest module used by the server |
| `bun run build` | Build client and server for production (icons, vite build, manifest) |
| `bun typecheck` | Run TypeScript type checking without emitting files |
| `bun typecheck:watch` | Run TypeScript type checking in watch mode |
| `bun create:db` | Create a new Cloudflare D1 database |
| `bun migrate:create` | Generate database migration files using Drizzle Kit |
| `bun migrate:dev` | Apply database migrations to local development database |
| `bun migrate` | Apply database migrations to remote production database |
| `bun test:db:dev` | Test local development database connection and query products table |
| `bun test:db` | Test remote production database connection and query products table |
| `bun test` | Run tests |
| `bun test --coverage` | Print out a test coverage report to the console |
| `bun test --watch` | Watch changes and re-run tests |
| `bun e2e` | Run end-to-end tests. First start `bun dev` with `AUTH_DISABLED="1"` in the .env file |
| `bun dev` | Build once, then start local dev servers with hot reload (Vite + wrangler) |
| `bun preview` | Build and run the production bundle locally with wrangler |
| `bun deploy:app` | Deploy application to Cloudflare Workers |
| `bun secret:github` | Set GitHub OAuth client secret in Cloudflare environment |
| `bun secret:google` | Set Google OAuth client secret in Cloudflare environment |
| `bun secret:session` | Set the session-cookie signing secret in Cloudflare environment |
| `bun secret:flash` | Set the Inertia flash-cookie signing secret in Cloudflare environment |
| `bun logtail` | Stream real-time logs from deployed Cloudflare Worker |
| `bun rollback:app` | Rollback to previous deployment version |
| `bun delete:app` | Delete the deployed Cloudflare Worker |
| `bun databases` | List all Cloudflare D1 databases |
| `bun studio:db` | Open Drizzle Studio for production database management |
| `bun studio:db:dev` | Open Drizzle Studio for local development database |
| `bun introspect:db` | Introspect database schema using Drizzle Kit |
| `bun dbcat:db:dev` | View local development database content using dbcat CLI tool |

## Troubleshooting

### Database Reconnection

If the remote database is deleted (`bun wrangler d1 delete inertia-crud`) and recreated, you may encounter errors like:
```
Error: 7500: You do not have permission to perform this operation
```

To fix, reconnect the worker with the correct database in the [Cloudflare dashboard](https://dash.cloudflare.com/):
1. Go to Workers & Pages → vue-inertia-crud → Bindings
2. In the table with types, click the edit button for the D1 Database
3. Reconnect the worker with the correct database

### Common Errors

- **Migration failures**: Ensure `DB_ID` in `.env` matches the database_id in `wrangler.jsonc`
- **Auth errors**: Verify OAuth secrets are set with `bun secret:google` and `bun secret:github`
- **Type errors**: Run `bun typecheck` to identify type issues before deployment
- **`Invalid CSRF token` on save**: State-changing visits send the `x-csrf-token` header from the `csrfToken` Inertia prop. A browser tab that was open across a server restart can hold a stale token; hard-reload the page and try again
- **`Missing ref owner context` Vue warnings, or broken reactivity**: Usually two copies of Vue in node_modules from mixing package managers. Reinstall with `bun install` only (see Tips)
- **Duplicate packages or odd Vite errors after upgrading**: Clear the Vite dependency cache with `rm -rf node_modules/.vite` and restart `bun dev`
