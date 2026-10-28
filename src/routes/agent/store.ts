import { and, eq, gt } from 'drizzle-orm'
import { getDB, tables } from '../../db/index'

/** Browser polls /agent/navigate every 2s; the heartbeat is persisted at most once per minute. */
export const AGENT_HEARTBEAT_INTERVAL_MS = 60_000

/** Agents are refused when the paired browser has not polled for 5 minutes. */
export const AGENT_IDLE_TIMEOUT_MS = 5 * 60_000

/** Row shape returned by getPairing. */
export type PairingRow = {
  code: string
  login: string
  lastAccessedAt: Date | null
}

/** Look up a pairing row by its code (= a browser session id). */
export async function getPairing(code: string): Promise<PairingRow | undefined> {
  const rows = await getDB().select().from(tables.pairingCodes).where(eq(tables.pairingCodes.code, code)).limit(1)
  const row = rows[0]
  if (!row) return undefined
  return {
    code: row.code,
    login: row.login,
    lastAccessedAt: row.lastAccessedAt ?? null,
  }
}

/** Create or refresh a pairing row (user action from the browser). */
export async function upsertPairing(code: string, login: string, now: Date = new Date()): Promise<void> {
  await getDB().insert(tables.pairingCodes).values({ code, login, lastAccessedAt: now })
    .onConflictDoUpdate({ target: tables.pairingCodes.code, set: { login, lastAccessedAt: now } })
}

/** Remove a pairing row (browser "stop pairing" or logout). */
export async function removePairing(code: string): Promise<void> {
  await getDB().delete(tables.pairingCodes).where(eq(tables.pairingCodes.code, code))
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

/** Read a per-user app-state value. */
export async function getState(login: string, key: string): Promise<any | null> {
  const k = `${key}:${login}`
  const rows = await getDB().select().from(tables.appState).where(eq(tables.appState.key, k)).limit(1)
  if (!rows.length) return null
  try { return JSON.parse((rows[0] as any).value) } catch { return null }
}

/** Write a per-user app-state value. */
export async function setState(login: string, key: string, value: any): Promise<void> {
  const k = `${key}:${login}`
  const v = JSON.stringify(value)
  await getDB().insert(tables.appState).values({ key: k, value: v })
    .onConflictDoUpdate({ target: tables.appState.key, set: { value: v, updatedAt: new Date() } })
}
