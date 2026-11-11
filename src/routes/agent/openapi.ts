/**
 * OpenAPI metadata for the agent JSON API.
 *
 * Descriptors (DescribeRouteOptions) only document the endpoints — validation
 * stays with the hand-rolled helpers in products/validation.ts. The spec is
 * served by GET /agent/openapi.json (agent/index.ts), generated from the
 * describeRoute() middleware registered on the agent routes.
 */

import { z } from 'zod'
import { resolver } from 'hono-openapi'
import type { ContentWithResolver, DescribeRouteOptions } from 'hono-openapi'
import { AGENT_IDLE_TIMEOUT_MS } from './store'
import { MAX_NAME_LENGTH } from '@/routes/products/validation'
import { MAX_PRICE } from '@/routes/products/validation'

/*
 * Constants
 */

const JSON_CONTENT = 'application/json'

/*
 * Schemas
 */

/** A product as returned by the JSON API (`modifiedAt` is an ISO date string or null). */
export const ProductSchema = z.object({
  id: z.number().int().positive(),
  productName: z.string(),
  description: z.string(),
  price: z.number().nullable(),
  modifiedAt: z.string().nullable(),
})

/** The payload for product writes. `modifiedAt` is accepted but ignored — the
 *  agent PATCH is a full replacement without the optimistic-concurrency token
 *  the UI edit form uses. */
export const ProductPayloadSchema = z.object({
  productName: z.string().max(MAX_NAME_LENGTH),
  description: z.string().max(300).optional(),
  price: z.number().min(0).max(MAX_PRICE).nullable().optional(),
  modifiedAt: z.string().nullable().optional(),
})

/** Simple single-message error body (`{ error: '…' }`). */
export const ErrorSchema = z.object({ error: z.string() })

/** Per-field validation errors (`{ errors: { field: 'message' } }`). */
export const FieldErrorsSchema = z.object({ errors: z.record(z.string(), z.string()) })

/** The navigation state shared between the browser UI and the agent. */
export const NavigationSchema = z.object({
  screen: z.string(),
  params: z.record(z.string(), z.unknown()),
})

/** Current screen as reported by GET /screen. */
export const ScreenSchema = z.object({
  screen: z.string().nullable(),
  params: z.record(z.string(), z.unknown()),
  context: z.array(z.string()),
  route: z.string().nullable(),
})

/** Screen metadata as served by GET /screens. */
export const ScreenMetaSchema = z.object({
  route: z.string(),
  context: z.array(z.string()),
})

/** The navigate command produced by POST /navigate and consumed by GET /navigate. */
export const NavigateCommandSchema = z.object({
  screen: z.string(),
  params: z.record(z.string(), z.unknown()),
})

/** The browser's last new/edit form submission, captured by the products routes. */
export const LastSubmissionSchema = z.object({
  screen: z.string(),
  id: z.number().nullable(),
  values: z.unknown(),
  errors: z.record(z.string(), z.string()).nullable(),
  succeeded: z.boolean(),
  at: z.string(),
})

/** Response of GET /data: the screen's data payload (list, single product or null). */
export const ScreenDataSchema = z.object({
  screen: z.string(),
  data: z.union([ProductSchema, z.array(ProductSchema), z.null()]),
})

/** Response of GET /products: one page of the product list. */
export const ProductListSchema = z.object({
  q: z.string(),
  page: z.number().int(),
  products: z.array(ProductSchema),
  hasMore: z.boolean(),
})

/** Response of successful product writes. */
export const WriteSuccessSchema = z.object({
  ok: z.boolean(),
  product: ProductSchema,
})

/*
 * Helpers
 */

function json(schema: z.ZodType): ContentWithResolver {
  return { [JSON_CONTENT]: { schema: resolver(schema) } }
}

/** Adds the standard 401 (no/invalid/expired pairing code, IP mismatch) to a
 *  responses object. `AGENT_IDLE_TIMEOUT_MS` is the pairing keep-alive window. */
function withAuth(responses: DescribeRouteOptions['responses']): DescribeRouteOptions['responses'] {
  const idleMinutes = Math.round(AGENT_IDLE_TIMEOUT_MS / 60_000)
  return {
    ...responses,
    401: {
      description: `Not authenticated: missing or invalid pairing code, idle for more than ${idleMinutes} minutes, or request from a different IP`,
      content: json(ErrorSchema),
    },
  }
}

/** Standard "unknown screen" and "invalid body" errors for POST endpoints. */
const badRequest = (description: string) => ({
  description,
  content: json(ErrorSchema),
})

/*
 * Route descriptors
 */

export const screenRoute: DescribeRouteOptions = {
  description: 'Current navigation state: the active screen, its params and route metadata.',
  responses: withAuth({
    200: { description: 'Current screen state', content: json(ScreenSchema) },
  }),
}

export const navigatePostRoute: DescribeRouteOptions = {
  description: 'Navigate the paired browser UI to a screen (see GET /screens for valid names).',
  requestBody: {
    required: true,
    content: json(z.object({
      screen: z.string().describe('Screen name as listed by GET /screens'),
      params: z.record(z.string(), z.unknown()).optional().describe('Screen context (e.g. `{ id }` for edit/delete screens)'),
    })),
  },
  responses: withAuth({
    200: {
      description: 'Navigation command stored',
      content: json(z.object({ ok: z.boolean(), screen: z.string() })),
    },
    400: badRequest('Unknown screen'),
  }),
}

export const navigateGetRoute: DescribeRouteOptions = {
  description: 'Consume the pending navigate command (read-and-clear; null when none is pending).',
  responses: withAuth({
    200: { description: 'The pending command or null', content: json(NavigateCommandSchema.nullable()) },
  }),
}

export const statePostRoute: DescribeRouteOptions = {
  description: 'Sync the browser\'s navigation state (screen + params) into the shared app_state store.',
  requestBody: {
    content: json(z.object({
      navigation: NavigationSchema.partial().optional(),
    })),
  },
  responses: withAuth({
    200: { description: 'State stored', content: json(z.object({ ok: z.boolean() })) },
  }),
}

/** Pairing lifecycle is browser-UI-only: creating/removing pairing codes is
 *  intentionally not documented in the OpenAPI spec — agents authenticate
 *  with an existing `x-pairing-code` header. */

export const screensRoute: DescribeRouteOptions = {
  description: 'The screen registry: route templates and context keys per screen name.',
  responses: withAuth({
    200: { description: 'Screen registry', content: json(z.record(z.string(), ScreenMetaSchema)) },
  }),
}

export const formRoute: DescribeRouteOptions = {
  description: 'The browser\'s last new/edit form submission (values, shown errors, success flag).',
  responses: withAuth({
    200: { description: 'Last submission or null', content: json(LastSubmissionSchema.nullable()) },
  }),
}

export const dataRoute: DescribeRouteOptions = {
  description: 'The data payload behind the current screen: a product list page, a single product, or null.',
  responses: withAuth({
    200: { description: 'Screen data', content: json(ScreenDataSchema) },
  }),
}

export const productListRoute: DescribeRouteOptions = {
  description: 'One page of the product list, optionally filtered by name prefix (`q`, starting letters).',
  parameters: [
    {
      name: 'q',
      in: 'query',
      required: false,
      description: `Name prefix filter, clamped to ${MAX_NAME_LENGTH} characters (starting letters)`,
      schema: { type: 'string' },
    },
    {
      name: 'page',
      in: 'query',
      required: false,
      description: '1-based page number',
      schema: { type: 'integer', minimum: 1 },
    },
  ],
  responses: withAuth({
    200: { description: 'Product page', content: json(ProductListSchema) },
  }),
}

export const productCreateRoute: DescribeRouteOptions = {
  description: 'Create a product (name must be unique).',
  requestBody: {
    required: true,
    content: json(ProductPayloadSchema),
  },
  responses: withAuth({
    200: { description: 'Product created', content: json(WriteSuccessSchema) },
    400: {
      description: 'Malformed body or validation errors',
      content: json(z.union([ErrorSchema, FieldErrorsSchema])),
    },
    403: {
      description: "Capability 'products' is not in AGENT_ENABLED",
      content: json(ErrorSchema),
    },
    409: badRequest('A product with this name already exists'),
    500: badRequest('Write failed'),
  }),
}

export const productUpdateRoute: DescribeRouteOptions = {
  description: 'Replace a product. This is a COMPLETE replacement (not a partial merge): the full valid payload is required and omitted fields reset to their empty defaults.',
  requestBody: {
    required: true,
    content: json(ProductPayloadSchema),
  },
  responses: withAuth({
    200: { description: 'Product updated', content: json(WriteSuccessSchema) },
    400: {
      description: 'Malformed body or validation errors',
      content: json(z.union([ErrorSchema, FieldErrorsSchema])),
    },
    403: {
      description: "Capability 'products' is not in AGENT_ENABLED",
      content: json(ErrorSchema),
    },
    404: badRequest('Product not found'),
    409: badRequest('A product with this name already exists'),
    500: badRequest('Write failed'),
  }),
}

export const productDeleteRoute: DescribeRouteOptions = {
  description: 'Delete a product (idempotent: unknown ids still answer 200).',
  responses: withAuth({
    200: { description: 'Product deleted', content: json(z.object({ ok: z.boolean() })) },
    403: {
      description: "Capability 'products' is not in AGENT_ENABLED",
      content: json(ErrorSchema),
    },
  }),
}
