# Changelog

## [Unreleased] — Auditoría pre-producción

### Bugs corregidos

- **CRÍTICO** — `sales:create` fallaba con `FOREIGN KEY constraint failed` al cobrar
  cualquier venta. Causa raíz: en `electron/db/sales.ts` la inserción en
  `sale_items` pasaba `it.id` (que es el `product_id`) como primer parámetro,
  cuando el primer parámetro debe ser `sale_id`. Resultado: la FK
  `sale_items.sale_id → sales(id)` se violaba siempre. Fix: pasar `saleId` como
  primer parámetro. Cubierto por `npm run test:smoke`.
- Validación de la sesión de caja ahora se hace **dentro** de la transacción
  (no antes), evitando race conditions con cierres concurrentes y garantizando
  que el `cash_session_id` que se guarda exista.
- El handler IPC `sales:create` loggea el payload (items, totales, método de
  pago) antes de invocar el servicio para diagnóstico futuro.
- Las ventas ahora **rechazan sobreventa**: si pides más unidades que el stock
  disponible, devuelve un error claro con detalle por producto.
- Las ventas rechazan productos archivados con un mensaje claro.

### Branding

- Eliminado el logo "Y" cuadrado del sidebar y del wizard de primer arranque.
- Eliminada la etiqueta "OFFLINE" debajo del nombre.
- Wordmark simplificado a texto: "Yumi" + "POS" en gradiente, fuente display.

### UI/UX — redundancias

- Wizard de primer arranque ya no tiene **dos** botones "Empezar". Se removió
  el botón duplicado del cuerpo de la pantalla de bienvenida; queda solo el
  del footer del diálogo.
- POS sidebar: removida la tarjeta de stats que duplicaba info ya visible
  (estado de caja, productos en ticket, unidades). El estado de caja ya está
  en el sidebar global y el conteo de unidades ya está en la cabecera del
  ticket.

### Manejo de errores

- Nueva función `humanize(err)` en el wrapper de IPC mapea errores técnicos
  a mensajes en español neutro:
  - `FOREIGN KEY constraint failed` → "No se pudo guardar: alguna referencia
    (caja, producto o venta) ya no existe…"
  - `UNIQUE constraint failed` → "Ya existe un registro con esos datos…"
  - `SQLITE_BUSY` → "La base de datos está ocupada. Vuelve a intentar…"
  - `ENOENT` / `EACCES` también traducidos.
- Todos los `ipcMain.handle` capturan errores, los loggean en `console.error`
  y propagan el mensaje humanizado al renderer.
- La impresión sigue siendo no-bloqueante: si la impresora falla al cobrar,
  la venta queda guardada y aparece un toast con el motivo.

### Responsive

- `Dialog` y `AlertDialog` ahora tienen `max-h: 90vh` con scroll interno.
  Modales largos ya no se salen de la pantalla en 1366×768.
- Tabla "Día a día" en Reportes envuelta en contenedor scrollable.
- Las tablas de Inventario y Ventas ya tenían scroll.

### Atajos de teclado

- `F1`–`F9` ahora funcionan **incluso con el foco en un input** (caso típico
  cuando el cajero está editando una cantidad). Antes se bloqueaban.
- `F5` (Cobrar) también funciona con foco en input.

### Backups

- `Descargar respaldo` ahora usa `db.backup()` nativo de SQLite, que hace
  un checkpoint del WAL y produce un archivo autocontenido. Antes copiaba
  `.db` + `.db-wal` por separado, lo que podía generar inconsistencias.
- Al restaurar, también se limpian `.db-wal` y `.db-shm` viejos para evitar
  mezcla con la base nueva.

### Tests

- Nuevo `npm run test:smoke` que ejecuta un test de integración del flujo
  crítico: crear producto → abrir caja → vender → verificar persistencia
  de `sale_items` con `sale_id` correcto, decremento de stock, inserción
  de `cash_movement`. También verifica el rechazo de sobreventa y la
  restauración de stock al anular.

### Para próxima versión

- Setup de un test runner (Vitest) con cobertura sistemática de los repos
  de DB; el smoke test actual es una verificación tipo "seguro" pero no
  reemplaza tests por unidad.
- Virtualización de tablas para inventarios > 5.000 productos.
- Boleta electrónica SII (integración con Bsale / OpenFactura / similar).
- Productos al peso (kilos / gramos).
- Pago dividido (parte efectivo, parte tarjeta).

---

## 0.1.0 — Versión inicial

Versión completa con: POS, inventario, caja, reportes, ventas, plantilla
de boleta, accesos rápidos, IVA, recargos por línea, importación CSV,
respaldos, integración con Epson TM-T20IIIL.
