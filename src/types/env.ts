import type { InertiaVariables } from '@sneakylenny/inertia-hono'
import type { UserType } from '@/routes/auth/common'

export type AppEnv = {
  Variables: InertiaVariables & {
    lang: string
    /** Signed-in user, set by the auth `requireAuth` middleware. */
    authUser?: UserType
    /** CSRF token from the session cookie, set by the auth `requireAuth` middleware. */
    csrfToken?: string
    /** Session id that keys shared per-user state (`app_state` via `userStateKey`):
     *  the browser session id for cookie requests and the dev bypass, and the
     *  creating browser session id for paired agents (`pairing_codes.session_id`). */
    sessionId?: string
  }
  Bindings: {
    ASSETS?: { fetch: typeof fetch }
  }
}
