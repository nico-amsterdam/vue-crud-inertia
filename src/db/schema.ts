import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from "drizzle-orm";

export const products = sqliteTable('products', {
  id: integer('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description').notNull(),
  price: integer('price'),
  createdBy: text('created_by').notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  modifiedBy: text('modified_by'),
  modifiedAt: integer("modified_at", { mode: "timestamp_ms" })
})

export const appState = sqliteTable('app_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
})

export const pairingCodes = sqliteTable('pairing_codes', {
  code: text('code').primaryKey(),
  login: text('login').notNull(),
  session_id: text('session_id').notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  // Last time the paired *browser session* polled an /agent endpoint.
  // Refreshed at most once per minute by the browser poller; agent requests
  // are refused once this is older than five minutes. Never touched by
  // agent requests themselves — the agent cannot keep itself alive.
  lastAccessedAt: integer("last_accessed_at", { mode: "timestamp_ms" }),
})