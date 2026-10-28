/**
 * Centralised fetch helpers for the `/agent/*` endpoints. Every call uses
 * `credentials: 'include'` (so the browser's signed session cookie is sent) and
 * goes through the same URL/header shape, so the call sites stay readable.
 */

/** Create (or refresh) a pairing code for the current browser session. */
export async function createPairing(csrfToken: string | null | undefined): Promise<string | null> {
  const res = await fetch('/agent/pairing/create', {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRF-Token': csrfToken ?? '' },
  })
  if (!res.ok) return null
  const d = await res.json() as { code?: string | null }
  return d.code ?? null
}

/** Remove the pairing code for the current browser session. */
export async function removePairing(csrfToken: string | null | undefined): Promise<void> {
  await fetch('/agent/pairing/remove', {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'X-CSRF-Token': csrfToken ?? '' },
  })
}

/** Tell the server which screen the user is currently on (so the agent can read it). */
export async function syncScreen(csrfToken: string | null | undefined, screen: string): Promise<void> {
  await fetch('/agent/state', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken ?? '' },
    body: JSON.stringify({ navigation: { screen, params: {} } }),
  }).catch(() => {})
}

/** Poll for a navigate command pushed by the agent (returns null when none). */
export async function pollNavigate(): Promise<any | null> {
  try {
    const res = await fetch('/agent/navigate', { credentials: 'include' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
