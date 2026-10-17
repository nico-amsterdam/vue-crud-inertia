import type { InertiaVariables } from '@sneakylenny/inertia-hono'

export type AppEnv = {
  Variables: InertiaVariables & { lang: string }
  Bindings: {
    ASSETS?: { fetch: typeof fetch }
  }
}
