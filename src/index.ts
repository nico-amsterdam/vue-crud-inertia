import Container from 'typedi'
import { drizzle } from 'drizzle-orm/d1'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { env } from 'cloudflare:workers'
import { app } from './server'
import type { AppEnv } from './types/env'
import * as schema from './db/schema'

/*
 * Bindings (env.DB) are not available while the module is initialized
 * (deploy validation runs the top-level code without bindings), so the
 * database must be created lazily on the first request.
 */
let db: DrizzleD1Database<typeof schema> | undefined

function initDB() {
    if (db) return db
    const cloudflareDB = env.DB.withSession() as unknown as D1Database
    db = drizzle(cloudflareDB, { schema, logger: false })
    Container.set('DrizzleDB', db)
    return db
}

const port = process.env.PORT ? Number(process.env.PORT) : 3000

export default {
  port,
  fetch: (request: Request, workerEnv: AppEnv, ctx: ExecutionContext) => {
    initDB()
    return app.fetch(request, workerEnv, ctx)
  },
}
