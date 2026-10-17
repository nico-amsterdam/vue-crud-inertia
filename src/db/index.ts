import Container from 'typedi'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from './schema'

/*
 * Variables
 */

export const tables = schema

/*
 * Functions
 */

export function getDB() {
    return Container.get<DrizzleD1Database<typeof import('../db/schema')>>('DrizzleDB')
}
