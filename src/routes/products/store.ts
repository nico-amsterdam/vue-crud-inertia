import { asc, and, eq, isNull, sql } from 'drizzle-orm'
import { getDB, tables } from '@/db/index'
import type { ProductBaseType, ProductType } from '@/types/product'

/*
 * Database-backed product store
 */

type DBProduct = typeof tables.products.$inferSelect

export const DEFAULT_USER = 'system'

/** Products per page. Above this list size the list is paginated with infinite scroll
 *  and filtering moves to the server (`/products/findbyname`). */
const PER_PAGE = 100

export function toProduct(dbProduct: DBProduct): ProductType {
  return {
    id: dbProduct.id,
    productName: dbProduct.name,
    description: dbProduct.description,
    price: dbProduct.price === null ? null : dbProduct.price / 100,
    modifiedAt: dbProduct.modifiedAt ? new Date(dbProduct.modifiedAt) : null,
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

export function priceToCents(price: number | null): number | null {
  return price === null ? null : Math.round(price * 100)
}

/** The validated fields both HTTP routes and the agent routes write
 *  (validateProduct().data — without modifiedAt, which updateProduct stamps). */

/** Result of a product write. `ok: false` reasons:
 *  - `duplicate-name`: SQLite rejected the write because another product already
 *    has this name (UNIQUE constraint on products.name, caught here so the
 *    routes never see raw driver errors and a check-then-insert race window
 *    cannot exist).
 *  - `not-found` (updateProduct only): no row matched — the id does not exist,
 *    or the optimistic-concurrency condition in verify mode failed.
 *  - `write-failed`: the driver threw for some other reason. */
type CreateProductResult =
  | { ok: true; product: DBProduct }
  | { ok: false; reason: 'duplicate-name' | 'write-failed' }
type UpdateProductResult =
  | { ok: true; product: DBProduct }
  | { ok: false; reason: 'not-found' | 'duplicate-name' | 'write-failed' }

/** Drivers surface the constraint violation differently, so check both the
 *  cause (D1 includes the SQLite message verbatim) and the SQLite code. */
function isDuplicateProductNameError(e: unknown): boolean {
  const message = e instanceof Error ? String(e.cause) ?? e.message : String(e)
  return message.includes('UNIQUE constraint failed: products.name:')
    && message.includes('SQLITE_CONSTRAINT_UNIQUE')
}

/** Insert a new product. Duplicate names are detected via the UNIQUE constraint
 *  on products.name and reported as a `duplicate-name` failure instead of thrown. */
export async function createProduct(input: ProductBaseType, createdBy: string): Promise<CreateProductResult> {
  try {
    const [row] = await getDB()
      .insert(tables.products)
      .values({
        name: input.productName,
        description: input.description,
        price: priceToCents(input.price),
        createdBy,
      })
      .returning()
    return row ? { ok: true, product: row as DBProduct } : { ok: false, reason: 'write-failed' }
  } catch (e) {
    return isDuplicateProductNameError(e)
      ? { ok: false, reason: 'duplicate-name' }
      : { ok: false, reason: 'write-failed' }
  }
}

/**
 * Update a product's fields. `verifyModifiedAt` implements optimistic concurrency:
 * `undefined` (used by agent calls) skips the check, `null` requires the row to
 * never have been modified, a Date requires it to still carry exactly that
 * modification timestamp. No matching row → `not-found` (missing id, or changed
 * concurrently in verify mode); a duplicate name → `duplicate-name`.
 */
export async function updateProduct(
  id: number,
  input: ProductBaseType,
  modifiedBy: string,
  verifyModifiedAt?: Date | null,
): Promise<UpdateProductResult> {
  const conditions = [eq(tables.products.id, id)]
  if (verifyModifiedAt !== undefined) {
    conditions.push(verifyModifiedAt === null
      ? isNull(tables.products.modifiedAt)
      : eq(tables.products.modifiedAt, verifyModifiedAt))
  }
  try {
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
    return rows.length ? { ok: true, product: rows[0] as DBProduct } : { ok: false, reason: 'not-found' }
  } catch (e) {
    return isDuplicateProductNameError(e)
      ? { ok: false, reason: 'duplicate-name' }
      : { ok: false, reason: 'write-failed' }
  }
}

/** Delete by id; deleting an already-missing id is a no-op. */
export async function deleteProduct(id: number): Promise<void> {
  await getDB().delete(tables.products).where(eq(tables.products.id, id))
}
