import { z } from 'zod';

/** UUID path/body parameter. */
export const uuid = z.uuid();

/** Cooperative code used in public URLs, e.g. COOP01. */
export const coopCode = z
  .string()
  .regex(/^[A-Z0-9_-]{2,32}$/, 'Code coopérative invalide')
  .describe('Cooperative code, e.g. COOP01');

/** ISO calendar date (DATE columns), e.g. 2026-11-11. */
export const isoDate = z.iso.date();

export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type Pagination = z.infer<typeof pagination>;

/** RFC 7807 problem details returned by every API error. */
export const problemDetails = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  errors: z
    .array(z.object({ path: z.string(), message: z.string() }))
    .optional()
    .describe('Validation errors, when status is 400'),
  code: z.string().optional().describe('Stable machine-readable error code'),
});
export type ProblemDetails = z.infer<typeof problemDetails>;
