import { render } from '@sneakylenny/inertia-hono'
import type { Context } from 'hono'

/**
 * Friendly error pages instead of Hono's plain "404 Not Found" / unstyled
 * 500 responses. Rendered as ordinary Inertia pages (component name + props),
 * so a direct URL load serves app-styled HTML and an Inertia XHR visit swaps
 * the page (component) in, exactly like a successful visit would.
 *
 * The Inertia renderer always answers 200, so the real status is forced here:
 * browsers, caches and crawlers then report the failure correctly. Protocol
 * responses (version mismatch, `x-inertia-location`, …) keep their own status
 * and pass through untouched. Handled statuses are never the user's fault —
 * the server already said why — so no error text is passed on.
 */
export async function errorPage(
  c: Context,
  component: 'errors/notfound' | 'errors/internalerror',
  status: number,
  props: Record<string, unknown> = {},
): Promise<Response> {
  const response = await render(c, component, props)
  if (response.status !== 200) return response
  return new Response(await response.text(), { status, headers: response.headers })
}

/** Rendered to `app.notFound`: every path without a route. */
export function renderNotFound(c: Context): Promise<Response> {
  return errorPage(c, 'errors/notfound', 404, { path: c.req.path })
}
