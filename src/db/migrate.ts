import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'

(async () => {
  const sqlite = new Database('sqlite.db')
  const db = drizzle(sqlite) as unknown as BunSQLiteDatabase

  console.log('Starting migrations')

  migrate(db, { migrationsFolder: 'migrations' })

  console.log('Migrations complete.')
})();
