import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { CLICKS, SIDES, STATUSES, THROW_TYPES, UTILITY_TYPES } from './types.ts'

export class ValidationError extends Error {
  readonly issues: { path: string; message: string }[]
  constructor(issues: z.core.$ZodIssue[]) {
    super('Validation failed')
    this.issues = issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
  }
}

export async function readJson<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    throw new HTTPException(400, { message: 'Request body must be valid JSON' })
  }
  const result = schema.safeParse(raw)
  if (!result.success) throw new ValidationError(result.error.issues)
  return result.data
}

export function readQuery<T extends z.ZodType>(c: Context, schema: T): z.infer<T> {
  const result = schema.safeParse(c.req.query())
  if (!result.success) throw new ValidationError(result.error.issues)
  return result.data
}

const text = (max: number) => z.string().trim().min(1).max(max)
const point = z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) })

export const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Use letters, numbers, dots, dashes and underscores only'),
  password: z.string().min(8).max(200),
})

export const lineupInputSchema = z.object({
  map: text(40),
  title: z.string().trim().min(3).max(80),
  type: z.enum(UTILITY_TYPES),
  side: z.enum(SIDES),
  throw: z.enum(THROW_TYPES),
  click: z.enum(CLICKS),
  from: text(60),
  to: text(60),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  steps: z.array(text(300)).min(1).max(10),
  origin: point,
  landing: point,
  tickrateSafe: z.boolean().default(true),
  mediaUrl: z
    .string()
    .trim()
    .max(500)
    .regex(/^https:\/\/\S+$/, 'Must be an https:// URL')
    .nullable()
    .optional(),
})
export type LineupInput = z.infer<typeof lineupInputSchema>

export const lineupPatchSchema = lineupInputSchema.partial()
export type LineupPatch = z.infer<typeof lineupPatchSchema>

export const lineupQuerySchema = z.object({
  map: z.string().max(40).optional(),
  type: z.enum(UTILITY_TYPES).optional(),
  side: z.enum(SIDES).optional(),
  throw: z.enum(THROW_TYPES).optional(),
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
})

export const statusSchema = z.object({ status: z.enum(STATUSES) })

export const savedSyncSchema = z.object({ ids: z.array(z.string().max(120)).max(500) })
