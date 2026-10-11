import Container from 'typedi'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import * as schema from './schema'

/*
 * Types
 */

export type ProductType = InferSelectModel<typeof schema.products>
export type AddProductType = InferInsertModel<typeof schema.products>
export type ModifyProductType = Omit<ProductType, 'createdBy' | 'createdAt'>
export type BaseProductType = Omit<ModifyProductType, 'modifiedBy'>

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
