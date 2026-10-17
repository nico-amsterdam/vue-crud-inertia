import Container from 'typedi'
import { drizzle } from 'drizzle-orm/d1'
import { env } from 'cloudflare:workers'
import { app } from './server'
import * as schema from './db/schema'

const db = drizzle(env.DB as any, { schema })
Container.set('DrizzleDB', db)

const port = process.env.PORT ? Number(process.env.PORT) : 3000

console.log(`Server: http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch.bind(app),
}
