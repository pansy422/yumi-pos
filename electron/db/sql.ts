/**
 * Convenciones de fecha en la base (auditoría sep-2026).
 *
 * TODAS las columnas de fecha se guardan como ISO 8601 UTC con `T` y `Z`:
 * `2026-09-28T14:30:00.000Z`. Antes convivían dos formatos —`sales` usaba
 * ISO desde JS y el resto `datetime('now')` (`2026-09-28 14:30:00`, con
 * espacio)— y las comparaciones entre tablas fallaban en los bordes.
 *
 * - En JS: `nowIso()`.
 * - En SQL (defaults de tablas nuevas y `updated_at = ...`): `SQL_NOW`.
 * - Las columnas viejas se normalizaron en la migración 10 con
 *   `strftime('%Y-%m-%dT%H:%M:%fZ', col)`.
 *
 * Los rangos por día siguen usando `date(col, 'localtime')`, que acepta
 * ambos formatos, así que ninguna consulta de reportes cambia.
 */
export const SQL_NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"

export function nowIso(): string {
  return new Date().toISOString()
}

/** Expresión SQL que convierte una columna al formato ISO canónico. */
export function sqlToIso(col: string): string {
  return `strftime('%Y-%m-%dT%H:%M:%fZ', ${col})`
}
