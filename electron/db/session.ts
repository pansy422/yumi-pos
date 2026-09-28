/**
 * Usuario activo visto desde el proceso main.
 *
 * El renderer avisa quién inició sesión (`session:setUser`) y todo lo que
 * se escribe en la base y necesita responsable (movimientos de stock,
 * ediciones de producto, pistoleo) toma el id de acá cuando el handler
 * no lo recibe explícito. Las operaciones críticas (ventas, retiros,
 * compras, mermas, cierres) siguen recibiendo `cashier_id` explícito
 * desde la UI y además se validan en cada repo.
 */
let currentUserId: string | null = null

export function setCurrentUserId(id: string | null): void {
  currentUserId = id && String(id).trim() ? String(id) : null
}

export function getCurrentUserId(): string | null {
  return currentUserId
}
