# Yumi POS

Software de punto de venta para minimarket. Funciona 100% offline en Windows con base de datos local SQLite. Diseñado para usar con lector de código de barras, impresora térmica y cajón de dinero.

Hecho para **Minimarket Entre Palmas** (Rancagua).

## Qué incluye

- **POS completo** con escáner siempre activo, búsqueda manual, atajos de teclado, modal de cobro con cálculo de vuelto y numpad táctil.
- **Acceso rápido** con 12 botones configurables para productos sin código de barras (pan, fruta suelta, cigarros sueltos…).
- **Tickets en espera**: si un cliente fue a buscar otra cosa, reservas su carrito con nombre y atiendes al siguiente. Persiste entre cierres del programa.
- **Multiplicador de cantidad** (× N): pones × 5 y la siguiente lectura agrega 5 unidades de una vez.
- **Recargo o descuento por línea** (ej. cigarro suelto: precio + $500).
- **Pistoleo de stock**: pasas el código por el lector y el sistema crea o incrementa el producto al instante. Si el código es desconocido, te ofrece crear nuevo o **vincular a un producto existente**.
- **Inventario** con filtros por categoría, búsqueda, alertas de stock crítico y archivado.
- **Importación CSV** con detección de columnas (acepta nombres en español).
- **Categorías** con autocompletado, renombre masivo y reportes por categoría.
- **Caja**: apertura con monto inicial, cierre con cuadre automático, retiros / depósitos / ajustes con motivo.
- **Z-report al cierre**: imprime un boletín con apertura, ventas por método, movimientos y diferencia.
- **Historial de ventas (F6)**: filtros por período / método / anuladas, búsqueda por número, detalle con vista previa de boleta, **reimprimir** y **anular** (restaura stock).
- **Reportes**: diario y por rango con sparklines, ingresos, ganancia, ticket promedio, top productos, breakdown por método de pago y por categoría.
- **Plantilla de boleta editable**: bloques reordenables (logo de tienda, RUT, fecha, ítems, totales, neto/IVA, vuelto, mensaje libre) con presets, import / export JSON y vista previa en vivo.
- **IVA configurable**: tasa (default 19%), modo inclusivo (precios ya incluyen IVA, formato boleta Chile) o exclusivo (formato factura).
- **Impresión térmica ESC/POS** con apertura automática del cajón de dinero, copia opcional para la tienda y soporte de Epson TM-T20IIIL (USB y red).
- **Respaldo manual** de la base de datos (un solo clic, exporta archivo `.db`).
- **Atajos de teclado** y overlay de ayuda con tecla `?`.

## Compilar el `.exe` (sin necesidad de tener Node.js instalado)

Como no hay terminal local, se usa **GitHub Actions** para compilar automáticamente.

### Pasos primera vez

1. Crear un repositorio nuevo en GitHub (privado o público), por ejemplo `yumi-pos`.
2. Subir todo el contenido del proyecto. Lo más fácil:
   - Abrir el repo recién creado.
   - Presionar `.` (punto) sobre la URL para abrir el editor web.
   - Arrastrar y soltar todos los archivos.
   - "Commit & Push".
3. Ir a la pestaña **Actions** del repo.
4. Esperar a que termine el workflow "Build Yumi POS (Windows)" (toma ~6-10 min la primera vez).
5. Cuando termine en verde, click en el run y descargar el artifact `yumi-pos-windows` (es un `.zip` con el instalador).
6. Descomprimir y ejecutar `Yumi POS-Setup-0.1.0.exe` en el PC del minimarket.

> Si solo quieres una versión portable sin instalación, también se incluye `Yumi POS-Portable-0.1.0.exe` en el mismo zip.

### Para futuras actualizaciones

Hacer cambios al código (en github.dev o donde sea), commit + push, y volver a Actions para descargar el nuevo `.exe`.

### Crear un release oficial (opcional)

En GitHub, crear un tag `v0.1.0` (o el número que sea) y el workflow generará un Release con el `.exe` listo para descargar. Útil para guardar versiones estables.

## Primer uso (wizard automático)

Al abrir Yumi POS por primera vez aparece un wizard de 4 pasos:

1. **Bienvenida**.
2. **Tienda**: nombre (default "Minimarket Entre Palmas"), RUT, teléfono, dirección. Todos opcionales — los que dejes vacíos no aparecen en la boleta.
3. **Impresora**: enciendes el switch, eliges de la lista o pones la IP, e imprimes una prueba.
4. **Caja**: ingresas el monto inicial en efectivo y el sistema abre tu primera sesión.

Después de eso ya estás vendiendo.

## Configurar la impresora Epson TM-T20IIIL

### Por red (recomendado para tu modelo "L" = LAN)

1. Conectar la impresora al router por cable Ethernet.
2. Mantener presionado el botón `FEED` y encender → sale un autotest con la **IP**.
3. Ajustes → Impresora → click en preset **"Epson TM-T20IIIL (Red)"**.
4. Reemplazar la IP de ejemplo por la real (ej. `tcp://192.168.1.45:9100`).
5. **Imprimir prueba** — debería salir una boleta de prueba.

### Por USB

1. Instalar el driver Epson Advanced Printer Driver (APD) en Windows.
2. Ajustes → Impresora → preset **"Epson TM-T20III/L (USB)"**.
3. Click en la impresora detectada con badge "Recomendada".
4. **Imprimir prueba**.

## Atajos de teclado

| Tecla     | Acción                                |
| --------- | ------------------------------------- |
| `F1`      | Ir a Vender (POS)                     |
| `F2`      | Ir a Inventario                       |
| `F3`      | Ir a Caja                             |
| `F4`      | Ir a Reportes                         |
| `F6`      | Ir a Ventas (historial)               |
| `F9`      | Ir a Ajustes                          |
| `F5`      | Cobrar (en pantalla POS)              |
| `Ctrl+B`  | Buscar producto manualmente (en POS)  |
| `ESC`     | Vaciar ticket actual (en POS)         |
| `Enter`   | Confirmar cobro en modal de pago      |
| `?`       | Ver overlay de atajos                 |

## Rutina diaria recomendada

**Al abrir el local:**
1. `F3` → **Abrir caja** con el monto inicial en efectivo.

**Durante el día:**
- Vender normal con `F1`.
- Si el cliente fue a buscar algo, **Reservar** ticket y atender al siguiente.
- Para abrir cajón sin venta (cambio de billete, etc.), botón **Cajón**.

**Al cerrar:**
1. `F3` → **Cerrar caja** → contar el efectivo → ingresar el monto contado.
2. Se imprime el **Z-report** automáticamente con el resumen del día.

**Una vez por semana:**
- Ajustes → Datos → **Descargar respaldo** y guardarlo en pendrive o nube.

## Base de datos

Todos los datos se guardan en un archivo SQLite local: `%APPDATA%\Yumi POS\yumi-pos.db` (Windows). Hacer respaldos periódicos desde _Ajustes → Datos → Descargar respaldo_.

## Solución de problemas

**La impresora no responde al hacer prueba**

- Verifica que esté encendida y conectada.
- Si es por red: comprueba que esté en la misma red que el PC, prueba hacer ping a la IP desde el PC.
- Si es por USB: en Ajustes → Impresora → Refrescar lista; haz click sobre tu impresora detectada.
- Asegúrate de tener el driver Epson APD instalado en Windows si usas USB.

**El lector de código de barras no captura nada**

- Los lectores USB típicos actúan como teclado (modo USB HID). Asegúrate de que la pistola esté en modo "USB HID Keyboard" (de fábrica en el 99% de los casos).
- En la pantalla POS o en modo pistoleo, prueba pasar un código sobre cualquier producto. El sistema captura automáticamente.
- Si no funciona, prueba escribir un código manualmente en la búsqueda — si eso funciona pero el escáner no, revisa la conexión USB del lector.

**Error "Base de datos no inicializada"**

- Cierra la aplicación y vuelve a abrirla.
- Si persiste, busca el archivo `%APPDATA%\Yumi POS\yumi-pos.db` y haz un respaldo antes de cualquier acción.

**SmartScreen bloquea el instalador**

- Click en "Más información" → "Ejecutar de todas formas". Es porque el `.exe` no está firmado digitalmente — normal para apps internas.

## Stack técnico

- Electron 33 + React 18 + TypeScript
- SQLite (better-sqlite3) — base de datos local
- Tailwind CSS 3 + shadcn/ui — interfaz
- Zustand — estado del carrito, sesión, tickets en espera y atajos rápidos
- node-thermal-printer + @thiagoelg/node-printer — impresión ESC/POS
- electron-builder — empaquetado Windows

## Limitaciones conocidas

- **No emite boletas SII**: lo que imprime es un comprobante interno. Para boleta electrónica autorizada por el SII Chile se necesita integrar con un proveedor (Bsale, OpenFactura, Defontana, Fynkar). Pendiente para una versión futura.
- **No soporta productos al peso** (queso por gramo, etc.).
- **Sin sincronización entre cajas**: la app es 100% local en un solo PC.
- **Sin firma digital del `.exe`**: SmartScreen alertará en cada instalación.

---

**Versión 0.1.0** — Hecho para Minimarket Entre Palmas, Rancagua.
