/**
 * Laravel's `$table->timestamps()` columns have no DB-level default — only
 * Eloquent sets them automatically. Since Node writes to these tables
 * directly via Knex, every insert into a `timestamps()`-backed table must
 * spread this in, or `created_at`/`updated_at` come back NULL.
 */
export function withTimestamps<T extends Record<string, unknown>>(row: T): T & { created_at: Date; updated_at: Date } {
  const now = new Date();
  return { ...row, created_at: now, updated_at: now };
}
