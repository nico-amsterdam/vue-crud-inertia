import { asc, eq, sql } from 'drizzle-orm'
import { getDB, tables } from '../../db/index'
import type { ProductType } from '../../types/product'

/*
 * Database-backed product store
 */

export type DBProduct = typeof tables.products.$inferSelect

export const DEFAULT_USER = 'system'

/** Products per page. Above this list size the list is paginated with infinite scroll
 *  and filtering moves to the server (`/products/findbyname`). */
export const PER_PAGE = 100

export function toProduct(dbProduct: DBProduct): ProductType {
  return {
    id: dbProduct.id,
    productName: dbProduct.name,
    description: dbProduct.description,
    price: dbProduct.price === null ? null : dbProduct.price / 100,
    modifiedAt: dbProduct.modifiedAt ? new Date(dbProduct.modifiedAt).toISOString() : null,
  }
}

/** SQL LIKE pattern matching the starting letters of `q` (escaped, prefix only). */
export function namePrefixPattern(q: string): string {
  if (q === '') return '%'
  return `${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`
}

export async function countProducts(namePattern?: string): Promise<{ total: number; matched: number }> {
  const row = await getDB().get<{ total: number; matched: number | null }>(
    namePattern === undefined
      ? sql`select count(*) as total, count(*) as matched from ${tables.products}`
      : sql`
          select count(*) as total,
                 sum(case when ${tables.products.name} like ${namePattern} escape '\\' then 1 else 0 end) as matched
          from ${tables.products}
        `,
  )
  return { total: row?.total ?? 0, matched: row?.matched ?? 0 }
}

export async function loadProductsPage(page: number, namePattern?: string): Promise<ProductType[]> {
  const dbProducts = await getDB()
    .select()
    .from(tables.products)
    .where(namePattern === undefined
      ? undefined
      : sql`${tables.products.name} like ${namePattern} escape '\\'`)
    .orderBy(asc(tables.products.name))
    .limit(PER_PAGE)
    .offset((page - 1) * PER_PAGE)
  return dbProducts.map(toProduct)
}

export async function getProductById(id: number): Promise<DBProduct | undefined> {
  return getDB()
    .select()
    .from(tables.products)
    .where(eq(tables.products.id, id))
    .get()
}

export async function productNameExists(productName: string, excludeId?: number): Promise<boolean> {
  const existing = await getDB()
    .select()
    .from(tables.products)
    .where(eq(tables.products.name, productName))
    .get()
  if (!existing) return false
  return excludeId === undefined || existing.id !== excludeId
}

export function priceToCents(price: number | null): number | null {
  return price === null ? null : Math.round(price * 100)
}
