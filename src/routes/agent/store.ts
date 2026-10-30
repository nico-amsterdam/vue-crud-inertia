import { and, eq, gt, lt } from 'drizzle-orm'
import { getDB, tables } from '../../db/index'

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
}

/** Look up a pairing row by code or sessionId. */
export async function getPairing(identifier: string): Promise<PairingRow | undefined> {
  // Try by code first, then by session_id
  let row = await getDB().select().from(tables.pairingCodes).where(eq(tables.pairingCodes.code, identifier)).limit(1)
  if (row[0]) return { code: row[0].code, login: row[0].login, session_id: row[0].session_id, lastAccessedAt: row[0].lastAccessedAt ?? null }
  row = await getDB().select().from(tables.pairingCodes).where(eq(tables.pairingCodes.session_id, identifier)).limit(1)
  if (row[0]) return { code: row[0].code, login: row[0].login, session_id: row[0].session_id, lastAccessedAt: row[0].lastAccessedAt ?? null }
  return undefined
}

/** Create or refresh a pairing row (user action from the browser). */
export async function upsertPairing(code: string, login: string, now: Date = new Date()): Promise<void> {
  // code is now the random pairing code (primary key), session_id is separate
  await getDB().insert(tables.pairingCodes).values({ code, login, session_id: code, lastAccessedAt: now })
    .onConflictDoUpdate({ target: tables.pairingCodes.code, set: { login, session_id: code, lastAccessedAt: now } })
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
export async function touchPairing(code: string): Promise<void> {
  const since = new Date(Date.now() - AGENT_HEARTBEAT_INTERVAL_MS)
  const fresh = await getDB().select({ code: tables.pairingCodes.code })
    .from(tables.pairingCodes)
    .where(and(eq(tables.pairingCodes.code, code), gt(tables.pairingCodes.lastAccessedAt, since)))
    .limit(1)
  if (fresh.length) return
  await getDB().update(tables.pairingCodes).set({ lastAccessedAt: new Date() }).where(eq(tables.pairingCodes.code, code))
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
