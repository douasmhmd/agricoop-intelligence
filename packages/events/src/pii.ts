/*
 * Personal data guard (Law 09-08 / CNDP). Event payloads must never contain client_pii fields
 * or any other personal identifier. Payloads reference IDs (client_id, produit_id, lot_id...),
 * non-personal client attributes (type_client, ville) and amounts only.
 *
 * `nom` is forbidden as a key even for products and cooperatives: payloads carry IDs and codes,
 * never display names, so a person's name can never slip through under a generic key.
 */
export const PII_KEYS: ReadonlySet<string> = new Set([
  // client_pii columns
  'nom',
  'telephone',
  'email',
  'adresse',
  // common aliases
  'name',
  'prenom',
  'first_name',
  'last_name',
  'full_name',
  'phone',
  'mobile',
  'address',
  'ip',
  'ip_address',
  'user_agent',
  // identity-provider identifiers (pseudonymous, operational plane only)
  'idp_subject',
  'sub',
  'username',
]);

/** Returns the JSON paths of every PII key found in `value` (recursively). */
export function findPiiKeys(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => findPiiKeys(item, `${path}[${i}]`));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
      const childPath = `${path}.${key}`;
      const own = PII_KEYS.has(key.toLowerCase()) ? [childPath] : [];
      return [...own, ...findPiiKeys(child, childPath)];
    });
  }
  return [];
}

export class PiiInPayloadError extends Error {
  constructor(readonly paths: string[]) {
    // Only paths are reported, never the values.
    super(`Event payload contains personal data keys: ${paths.join(', ')}`);
    this.name = 'PiiInPayloadError';
  }
}

export function assertNoPii(payload: unknown): void {
  const paths = findPiiKeys(payload);
  if (paths.length > 0) throw new PiiInPayloadError(paths);
}
