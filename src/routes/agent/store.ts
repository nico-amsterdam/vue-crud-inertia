import { and, eq, gt, lt, or } from 'drizzle-orm'
import { getDB, tables } from '@/db/index'

/** Browser polls /agent/navigate every 2s; the heartbeat is persisted at most once per minute. */
export const AGENT_HEARTBEAT_INTERVAL_MS = 60_000

/** Agents are refused when the paired browser has not polled for 5 minutes. */
export const AGENT_IDLE_TIMEOUT_MS = 5 * 60_000

/** Row shape returned by getPairing. */
export type PairingRow = {
  code: string
  login: string
  session_id: string
  lastAccessedAt: Date | null
  ip: string | null
}

/** Look up a pairing row by code only. */
export async function getPairing(identifier: string): Promise<PairingRow | undefined> {
  const row = await getDB().select().from(tables.pairingCodes).where(eq(tables.pairingCodes.code, identifier)).limit(1)
  if (row[0]) return { code: row[0].code, login: row[0].login, session_id: row[0].session_id, lastAccessedAt: row[0].lastAccessedAt ?? null, ip: row[0].ip ?? null }
  return undefined
}

/** Look up a pairing row by the browser session id. */
export async function getPairingBySessionId(sessionId: string): Promise<PairingRow | undefined> {
  const row = await getDB().select().from(tables.pairingCodes).where(eq(tables.pairingCodes.session_id, sessionId)).limit(1)
  if (row[0]) return { code: row[0].code, login: row[0].login, session_id: row[0].session_id, lastAccessedAt: row[0].lastAccessedAt ?? null, ip: row[0].ip ?? null }
  return undefined
}

/** Bind a pairing code to the client IP of its first agent contact
 *  (agent-cli). Later agent requests must come from the same address. */
export async function setPairingIp(code: string, ip: string): Promise<void> {
  await getDB()
    .update(tables.pairingCodes)
    .set({ ip })
    .where(eq(tables.pairingCodes.code, code))
}

/** Create or refresh a pairing row (user action from the browser). */
export async function upsertPairing(
  code: string,
  login: string,
  sessionId: string,
  now: Date = new Date(),
): Promise<void> {
  // code is the random pairing code (primary key); session_id ties it to the browser session
  await getDB().insert(tables.pairingCodes).values({ code, login, session_id: sessionId, lastAccessedAt: now })
    .onConflictDoUpdate({ target: tables.pairingCodes.code, set: { login, session_id: sessionId, lastAccessedAt: now } })
}

/** Remove a pairing row by sessionId (browser "stop pairing" or logout). */
export async function removePairing(sessionId: string): Promise<void> {
  await getDB().delete(tables.pairingCodes).where(eq(tables.pairingCodes.session_id, sessionId))
}

/**
 * Refreshes `lastAccessedAt` of the pairing row belonging to the browser
 * session — the heartbeat that keeps agent access alive. Throttled: browsers
 * poll every 2 seconds, so the row is only written when older than one minute.
 * Deliberately only called for cookie requests: agent requests must never
 * refresh it themselves, otherwise an agent could keep itself alive without
 * the browser present.
 */
export async function touchPairing(identifier: string): Promise<void> {
  // Called with the browser session id (and, historically, occasionally with
  // the code itself). Match by code OR session_id — pairing/create rows have a
  // random code that differs from the session id.
  const byId = or(
    eq(tables.pairingCodes.code, identifier),
    eq(tables.pairingCodes.session_id, identifier),
  )
  const since = new Date(Date.now() - AGENT_HEARTBEAT_INTERVAL_MS)
  const fresh = await getDB().select({ code: tables.pairingCodes.code })
    .from(tables.pairingCodes)
    .where(and(byId, gt(tables.pairingCodes.lastAccessedAt, since)))
    .limit(1)
  if (fresh.length) return
  await getDB().update(tables.pairingCodes).set({ lastAccessedAt: new Date() }).where(byId)
}

/**
 * Removes app_state rows older than the given age in milliseconds.
 * Runs opportunistic cleanup so the D1 key‑value store does not grow
 * indefinitely with stale per‑session data.
 *
 * @param ageMs age threshold; rows with updated_at older than now - ageMs will be deleted.
 */
export async function cleanupAppState(ageMs: number): Promise<void> {
  const cutoff = new Date(Date.now() - ageMs)
  await getDB().delete(tables.appState).where(lt(tables.appState.updatedAt, cutoff))
}

/** Builds the per-session app-state key (`<key>:<sessionId>`) shared by the
 *  browser session and its paired agent (both resolve to the same session id). */
export function userStateKey(sessionId: string | undefined, key: string): string {
  return `${key}:${sessionId ?? 'anon'}`
}

/** Read a per-session app-state value (key already includes the session id prefix). */
export async function getState(key: string): Promise<any | null> {
  const rows = await getDB().select().from(tables.appState).where(eq(tables.appState.key, key)).limit(1)
  if (!rows.length) return null
  try { return JSON.parse((rows[0] as any).value) } catch { return null }
}

/** Write a per-session app-state value (key already includes the session id prefix). */
export async function setState(key: string, value: any): Promise<void> {
  const v = JSON.stringify(value)
  await getDB().insert(tables.appState).values({ key, value: v })
    .onConflictDoUpdate({ target: tables.appState.key, set: { value: v, updatedAt: new Date() } })
}
