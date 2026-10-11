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

