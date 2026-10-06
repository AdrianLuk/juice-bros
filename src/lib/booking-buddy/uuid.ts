/**
 * The uuid shape every id and token in this schema has. Checked before a
 * value reaches Postgres, where a malformed uuid is a cast error rather than
 * "not found". Relative imports only (none), so `node --test` can load it.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
