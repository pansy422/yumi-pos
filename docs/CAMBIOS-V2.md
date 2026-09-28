# Yumi POS — Especificación de cambios v2

**Fecha:** 28-sep-2026
**Origen:** auditoría de septiembre 2026 sobre `yumi-pos.db` (db_version 9), 30 respaldos diarios y cartola BCI.
**Objetivo:** que el sistema permita cuadrar plata, efectivo e inventario sin reconstruir nada a mano.

---

## 0. Contexto: qué falló en septiembre

| Problema | Efecto | Evidencia |
|---|---|---|
| Pantalla Inventario carga solo 1.000 productos y calcula los totales sobre esa lista | "Valor inventario" muestra $6,2M cuando el real es $7,3M; "Sin stock" muestra 70 cuando son 91 | 1.187 productos activos; los 187 que quedan fuera (t–z) valen $1,05M |
| No existe registro de compras | No se sabe cuánto se pagó a proveedores ni por qué; hubo que reconstruirlo desde la cartola y los cierres de caja | Pagado ≈ $6,5M vs ingresado al sistema $5,49M |
| No existe historial de movimientos de stock | Solo se ve el stock actual; entradas, ajustes y mermas se reconstruyeron comparando respaldos diarios | $367.299 de stock bajado a mano sin venta y $60.321 eliminado con productos |
| Salidas de efectivo sin registro | La caja abre en $0 cada día; todo el efectivo se retira sin destino (solo se registra el pan) | $3,63M salieron del cajón; $158.000 con registro |
| Cierre de caja sin detalle obligatorio | Diferencias sin explicación; boletas marcadas "efectivo" que fueron débito | Notas del 15, 19 y 20-sep: $35.360 |
| Productos con stock se pueden borrar | El stock desaparece del inventario sin rastro | 30+ productos eliminados en septiembre |
| Un solo usuario | Nada tiene responsable | `users` tiene 1 registro |
| Formato de fechas mezclado | `sales.completed_at` es ISO con `T` y `Z`; `cash_sessions`, `cash_movements`, `products` usan `datetime('now')` con espacio; las comparaciones entre tablas fallan | Consultas por rango dan resultados distintos según la tabla |

---

## 1. Inventario

### Cambios
- Eliminar el selector de categorías de la pantalla. La categoría sigue existiendo en la ficha del producto y en reportes, pero no como filtro de la lista.
- Lista de todos los productos activos, ordenada por nombre, **sin tope**. Carga por páginas o desplazamiento progresivo (50–100 filas por bloque).
- Un buscador único: nombre, código de barras o SKU. Busca en la base, no en la lista cargada.
- Pestañas Activos / Inactivos / Todos se mantienen.
- Tarjetas superiores calculadas con consultas sobre la tabla completa:

```sql
-- productos activos
SELECT COUNT(*) FROM products WHERE archived = 0;
-- valor inventario a costo
SELECT SUM(CASE WHEN is_weight = 1 THEN stock * cost / 1000.0 ELSE stock * cost END)
FROM products WHERE archived = 0;
-- sin stock
SELECT COUNT(*) FROM products WHERE archived = 0 AND stock <= 0;
```

- Productos por peso: `stock` está en gramos y `cost`/`price` por kilo; todo cálculo de valor usa `/ 1000.0`.

### Reglas nuevas
- **No se puede eliminar un producto con stock ≠ 0.** Solo archivar. Para eliminar, primero hay que dar de baja el stock por la zona de mermas (sección 3).
- Editar el stock directamente desde la ficha queda restringido: cualquier cambio manual pide motivo y queda en `stock_movements` (sección 6).

---

## 2. Compras (zona nueva)

Registro simple de lo que se paga a proveedores. **No liga productos ni toca el stock**; el ingreso de stock sigue siendo el actual.

### Tabla `purchases`
| Campo | Tipo | Nota |
|---|---|---|
| id | INTEGER PK | |
| purchased_at | TEXT ISO | fecha de la compra |
| supplier | TEXT | nombre libre; autocompletar con los ya usados |
| amount | INTEGER | monto pagado |
| payment_method | TEXT | `efectivo` / `transferencia` / `debito` / `credito` |
| note | TEXT | opcional |
| receipt_path | TEXT | foto de boleta, opcional |
| user_id | INTEGER FK users | quién registró |
| created_at | TEXT ISO | |

### Pantalla
- Formulario rápido: fecha (hoy por defecto), proveedor, monto, medio de pago, nota, foto.
- Lista del mes con filtro por proveedor y por medio de pago; total del mes y **total por proveedor**.
- Si `payment_method = 'efectivo'`, se genera automáticamente una salida del fondo de efectivo (sección 4) ligada a la compra.

---

## 3. Vencidos y mermas (zona nueva)

Reemplaza el "bajar stock a mano".

### Tabla `stock_writeoffs`
| Campo | Tipo | Nota |
|---|---|---|
| id | INTEGER PK | |
| product_id | INTEGER FK products | |
| qty | REAL | unidades, o gramos si es por peso |
| reason | TEXT | `vencido` / `dañado` / `consumo` / `robo` / `conteo` / `otro` |
| cost_snapshot | INTEGER | costo al momento de la baja |
| note | TEXT | |
| user_id | INTEGER FK users | |
| created_at | TEXT ISO | |

### Pantalla
- Buscar producto (o pistolear), cantidad, motivo, nota. Al guardar: baja el stock y registra movimiento en `stock_movements` tipo `writeoff`.
- Reporte mensual: total de mermas a costo, por motivo y por producto.

---

## 4. Efectivo

### Fondo de efectivo
Saldo vivo del efectivo del negocio **fuera del cajón**. Sube con retiros de caja hacia el fondo; baja con pagos en efectivo. Siempre visible en la pantalla de Caja.

### Tabla `cash_fund_movements`
| Campo | Tipo | Nota |
|---|---|---|
| id | INTEGER PK | |
| kind | TEXT | `in_from_register` / `out_supplier` / `out_expense` / `out_owner` / `out_transfer_swap` / `adjustment` |
| amount | INTEGER | positivo entra, negativo sale |
| reason | TEXT | obligatorio |
| counterparty | TEXT | a quién (proveedor, persona) |
| purchase_id | INTEGER FK purchases | si es pago de compra |
| cash_session_id | INTEGER FK cash_sessions | si viene de un cierre |
| user_id | INTEGER FK users | |
| created_at | TEXT ISO | |

### Salidas del cajón durante el día
- `cash_movements` con `kind = 'withdraw'` pasa a exigir `reason` y `counterparty` (hoy `note` es opcional). Sin motivo no se guarda.

### Cierre de caja (bloqueado)
No se puede cerrar la sesión sin completar, en este orden:
1. **Contado**: efectivo físico en el cajón.
2. **Queda en cajón** para mañana (fondo fijo, configurable en settings, p. ej. $30.000).
3. **Se retira**: el resto, repartido en uno o más destinos: `fondo` / `proveedor` (nombre) / `dueño` / `otro` (motivo). La suma de destinos debe ser igual a contado − queda.
4. **Diferencia** (contado − esperado): si ≠ 0, explicación obligatoria.
5. Al confirmar: se crean los `cash_fund_movements` correspondientes y la apertura del día siguiente se llena automáticamente con "queda en cajón".

### Conteo del fondo
- Acción "Contar fondo": se ingresa lo que hay físicamente; el sistema muestra la diferencia contra el saldo calculado y el historial de movimientos desde el último conteo. Registra un `adjustment` si el usuario confirma la diferencia.

---

## 5. Cuadre de los lunes

### Regla
Al abrir caja un lunes, si la semana anterior (lunes a domingo) no tiene cuadre confirmado, la pantalla de venta se bloquea hasta hacerlo (usuario admin).

### Entradas manuales
- Efectivo contado en el fondo.
- Saldo del banco al domingo, o carga de cartola CSV (BCI: fecha, descripción, cargo, abono, saldo).

### Pantalla del cuadre (semana)
1. **Ventas** por medio de pago (efectivo, débito, crédito, transferencia). Fuente: `sales` + `sale_payments`.
2. **Compras** por medio de pago y por proveedor. Fuente: `purchases`.
3. **Efectivo**: ventas en efectivo − retiros − salidas del fondo por motivo = esperado; vs contado; diferencia.
4. **Tarjetas**: ventas débito+crédito por día vs abonos de la cartola (abono del día D corresponde a ventas de D−1 hábil; lunes agrupa vie–dom). Marcar días que no calzan más de 3%.
5. **Transferencias**: ventas por transferencia vs transferencias recibidas en cartola. Listar las no recibidas.
6. **Inventario**: valor inicial + entradas − vendido a costo − mermas − ajustes = final calculado, vs final real; diferencia.
7. **Diferencias**: cada una con campo de explicación o marca "pendiente" (se arrastra a la semana siguiente).
8. Confirmar → se guarda en `weekly_reconciliations` (json con todos los valores) y queda en historial consultable.

---

## 6. Historial de stock

### Tabla `stock_movements`
| Campo | Tipo | Nota |
|---|---|---|
| id | INTEGER PK | |
| product_id | INTEGER FK products | |
| kind | TEXT | `sale` / `return` / `entry` / `writeoff` / `manual` / `archive` |
| qty | REAL | signo según movimiento |
| stock_after | REAL | stock resultante |
| cost_snapshot | INTEGER | |
| reason | TEXT | obligatorio en `manual` |
| ref_table / ref_id | TEXT / INTEGER | venta, baja, etc. |
| user_id | INTEGER FK users | |
| created_at | TEXT ISO | |

- Toda modificación de `products.stock` pasa por una única función que escribe aquí. Ventas, devoluciones, ingresos, mermas y ediciones manuales incluidas.
- Con esto el cuadre de inventario de los lunes es exacto y ya no depende de comparar respaldos.

---

## 7. Menores

- **Usuarios**: al menos admin y cajero con clave; `cashier_id` obligatorio en ventas, retiros, compras, mermas y cierres.
- **Medio de pago al cobrar**: sin valor por defecto; el cajero debe elegirlo. Para efectivo, pedir monto recibido (ya existe `cash_received`) y mostrar vuelto.
- **Venta con stock 0**: aviso visible al agregar el producto (no bloquear la venta). El movimiento queda registrado igual, con `stock_after` negativo permitido en `stock_movements` aunque `products.stock` se mantenga en 0, para que se vea cuánto se vendió sin stock.
- **Fechas**: unificar todas las columnas de fecha a ISO 8601 UTC con `T` y `Z` (`2026-09-28T14:30:00.000Z`). Migración para `products`, `cash_sessions`, `cash_movements`, `categories`, `users`. Mostrar siempre en hora de Chile.
- **Respaldos**: mantener los 30 diarios; agregar respaldo automático antes de cada migración.

---

## 8. Migración

Nueva `db_version = 10`:
1. Crear `purchases`, `stock_writeoffs`, `cash_fund_movements`, `stock_movements`, `weekly_reconciliations`.
2. Agregar `reason` y `counterparty` a `cash_movements`; `register_float` a `cash_sessions`.
3. Normalizar fechas.
4. Settings nuevos: `cash.register_float` (fondo fijo del cajón), `reconciliation.weekday` (1 = lunes).
5. Semilla: un movimiento inicial en `cash_fund_movements` tipo `adjustment` con el efectivo real que haya el día del despliegue.

---

## 9. Orden de implementación

1. Inventario sin tope + totales globales (bug, 1 día).
2. Fechas unificadas + `stock_movements` (base para todo lo demás).
3. Efectivo: fondo, salidas con motivo, cierre bloqueado.
4. Compras.
5. Vencidos / mermas.
6. Usuarios.
7. Cuadre de los lunes.
