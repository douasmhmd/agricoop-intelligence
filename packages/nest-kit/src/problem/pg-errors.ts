/*
 * Postgres error helpers. Drizzle wraps driver errors (DrizzleQueryError) and keeps the pg error in
 * `cause`; both shapes are handled.
 */

interface PgErrorLike {
  code?: string;
  constraint?: string;
}

function pgError(error: unknown): PgErrorLike | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current && typeof current === 'object'; depth++) {
    const candidate = current as PgErrorLike & { cause?: unknown };
    if (typeof candidate.code === 'string' && /^[0-9A-Z]{5}$/.test(candidate.code))
      return candidate;
    current = candidate.cause;
  }
  return undefined;
}

/** True for a unique violation (23505), optionally on a specific constraint name. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const pg = pgError(error);
  return pg?.code === '23505' && (constraint === undefined || pg.constraint === constraint);
}

/** True for a foreign-key violation (23503), optionally on a specific constraint name. */
export function isForeignKeyViolation(error: unknown, constraint?: string): boolean {
  const pg = pgError(error);
  return pg?.code === '23503' && (constraint === undefined || pg.constraint === constraint);
}
