import { asc, and, eq, isNull, sql } from 'drizzle-orm'
import { getDB, tables } from '../../db/index'
import type { ProductBaseType, ProductType } from '../../types/product'

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

export async function loadProductsPage(
  page: number,
  namePattern?: string,
): Promise<{ products: ProductType[]; hasMore: boolean }> {
  const dbProducts = await getDB()
    .select()
    .from(tables.products)
    .where(namePattern === undefined
      ? undefined
      : sql`${tables.products.name} like ${namePattern} escape '\\'`)
    .orderBy(asc(tables.products.name))
    // Over-fetch one row instead of running `count(*)`: a full extra row means
    // another page exists (on page 1 that is exactly `total > PER_PAGE`).
    .limit(PER_PAGE + 1)
    .offset((page - 1) * PER_PAGE)
  const hasMore = dbProducts.length > PER_PAGE
  return {
    products: (hasMore ? dbProducts.slice(0, PER_PAGE) : dbProducts).map(toProduct),
    hasMore,
  }
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

/** The validated fields both HTTP routes and the agent routes write (validateProduct output). */
export type ProductInput = Pick<ProductBaseType, 'productName' | 'description' | 'price'>

/** Insert a new product. Throws on constraint violations (e.g. duplicate name) —
 *  handlers turn that into their own error presentation. */
export async function createProduct(input: ProductInput, createdBy: string): Promise<DBProduct | undefined> {
  const [row] = await getDB()
    .insert(tables.products)
    .values({
      name: input.productName,
      description: input.description,
      price: priceToCents(input.price),
      createdBy,
    })
    .returning()
  return row as DBProduct | undefined
}

/**
 * Update a product's fields. `verifyModifiedAt` implements optimistic concurrency:
 * `undefined` (used by agent calls) skips the check, `null` requires the row to
 * never have been modified, a Date requires it to still carry exactly that
 * modification timestamp. Returns the updated rows; an empty array means the
 * product id does not exist (or was changed concurrently in verify mode).
 */
export async function updateProduct(
  id: number,
  input: ProductInput,
  modifiedBy: string,
  verifyModifiedAt?: Date | null,
): Promise<DBProduct[]> {
  const conditions = [eq(tables.products.id, id)]
  if (verifyModifiedAt !== undefined) {
    conditions.push(verifyModifiedAt === null
      ? isNull(tables.products.modifiedAt)
      : eq(tables.products.modifiedAt, verifyModifiedAt))
  }
  const rows = await getDB()
    .update(tables.products)
    .set({
      name: input.productName,
      description: input.description,
      price: priceToCents(input.price),
      modifiedBy,
      modifiedAt: new Date(),
    })
    .where(conditions.length === 1 ? conditions[0] : and(...conditions))
    .returning()
  return rows as DBProduct[]
}

/** Delete by id; deleting an already-missing id is a no-op. */
export async function deleteProduct(id: number): Promise<void> {
  await getDB().delete(tables.products).where(eq(tables.products.id, id))
}
