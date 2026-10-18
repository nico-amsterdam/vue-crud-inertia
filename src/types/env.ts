import type { InertiaVariables } from '@sneakylenny/inertia-hono'
import type { UserType } from '../routes/auth/common'

export type AppEnv = {
  Variables: InertiaVariables & {
    lang: string
    /** Signed-in user, set by the auth `requireAuth` middleware. */
    authUser?: UserType
    /** CSRF token from the session cookie, set by the auth `requireAuth` middleware. */
    csrfToken?: string
  }
  Bindings: {
    ASSETS?: { fetch: typeof fetch }
  }
}
