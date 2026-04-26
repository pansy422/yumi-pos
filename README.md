# Yumi POS

Software de punto de venta para minimarket. Funciona 100% offline en Windows con base de datos local SQLite. Ideal para usar con lector de código de barras, impresora térmica y cajón de dinero.

## Características

- **Modo pistoleo de stock**: pasa el código de barras por el lector y el sistema crea/incrementa el producto al instante.
- **Pantalla de venta** con escáner siempre activo, búsqueda manual, atajos de teclado y modal de cobro con cálculo de vuelto.
- **Apertura y cierre de caja** con cálculo automático del efectivo esperado y la diferencia.
- **Impresión térmica** ESC/POS con apertura automática del cajón de dinero al cobrar en efectivo.
- **Reportes diarios y por rango**: ingresos, ganancia, productos top, breakdown por método de pago.
- **Respaldo manual** de la base de datos (un solo clic, exporta archivo `.db`).

## Compilar el `.exe` (sin necesidad de tener Node.js instalado)

Como no hay terminal local, se usa **GitHub Actions** para compilar automáticamente.

### Pasos primera vez

1. Crear un repositorio nuevo en GitHub (puede llamarse `yumi-pos`, privado).
2. Subir todo el contenido de esta carpeta al repositorio. Lo más fácil es usar `github.dev` (GitHub Web Editor):
   - Abrir el repo recién creado
   - Presionar la tecla `.` (punto) sobre la URL para abrir el editor web
   - Arrastrar y soltar todos los archivos del proyecto en la barra lateral izquierda
   - Hacer commit con el botón "Commit & Push"
3. Ir a la pestaña **Actions** del repo en GitHub.com.
4. Esperar a que termine el workflow "Build Yumi POS (Windows)" (toma ~5-8 minutos la primera vez).
5. Cuando termine en verde, hacer clic en el run y descargar el artifact `yumi-pos-windows` (es un `.zip` con el instalador).
6. Descomprimir el zip y ejecutar `Yumi POS-Setup-0.1.0.exe` en el PC del minimarket.

> Si solo quieres una versión portable sin instalación, también se incluye `Yumi POS-Portable-0.1.0.exe` en el mismo zip.

### Para futuras actualizaciones

Hacer cambios al código (en github.dev o donde sea), commit + push, y volver a la pestaña Actions para descargar el nuevo `.exe`.

### Crear un release oficial (opcional)

En GitHub, crear un tag `v0.1.0` (o el número que sea) y el workflow automáticamente generará un Release con el `.exe` listo para descargar. Útil para guardar versiones estables del software.

## Primer uso

Al abrir Yumi POS por primera vez:

1. **Configura los datos de tu local** en _Ajustes → Tienda_ (nombre, dirección, RUT, teléfono). Esto sale impreso en la cabecera de cada boleta.
2. **Configura la impresora** en _Ajustes → Impresora_:
   - Si ya está instalada en Windows, en "Tipo de conexión" elige `USB` y en "Interfaz USB" deja `printer:auto`.
   - Si no detecta la impresora, ve a la lista de "Impresoras detectadas en Windows" más abajo y haz clic en la tuya — el sistema autocompleta el campo.
   - Si la impresora es de red, elige `Red (IP)` y escribe `tcp://IP:9100`.
   - Activa "Imprimir boleta automáticamente" y "Abrir cajón de dinero".
   - Presiona "Imprimir prueba" para verificar que funciona.
3. **Abre la caja** en _Caja → Abrir caja_ con el monto inicial en efectivo (puede ser 0).
4. **Empieza a pistolear stock** desde _Inventario → Pistolear stock_:
   - Activa el modo pistoleo.
   - Pasa cada código de barras por el lector.
   - Si es un producto nuevo, te pedirá nombre y precios y lo crea al instante.
   - Si ya existe, le suma 1 al stock automáticamente.
   - Cuando termines, desactiva el modo y revisa la lista.

## Atajos de teclado

| Tecla     | Acción                                |
| --------- | ------------------------------------- |
| `F1`      | Ir a Vender (POS)                     |
| `F2`      | Ir a Inventario                       |
| `F3`      | Ir a Caja                             |
| `F4`      | Ir a Reportes                         |
| `F9`      | Ir a Ajustes                          |
| `F5`      | Cobrar (en pantalla POS)              |
| `Ctrl+B`  | Buscar producto manualmente (en POS)  |
| `ESC`     | Vaciar ticket actual (en POS)         |
| `Enter`   | Confirmar cobro en modal de pago      |

## Base de datos

Todos los datos se guardan en un archivo SQLite local: `%APPDATA%\Yumi POS\yumi-pos.db` (Windows). Hacer respaldos periódicos desde _Ajustes → Datos → Descargar respaldo_.

## Próximos pasos

- Sincronización con Supabase para ver el minimarket desde el panel web Azure Desk.
- Importación masiva de productos desde Excel.
- Soporte para múltiples cajas en la misma máquina.
- Notificaciones por WhatsApp (cierre de caja, stock bajo).

## Solución de problemas

**La impresora no responde al hacer prueba**

- Verifica que esté encendida y conectada al PC.
- En _Ajustes → Impresora_, en "Impresoras detectadas en Windows", haz clic sobre tu impresora — esto rellena el campo de interfaz con el nombre exacto.
- Si tienes el driver del fabricante instalado (Epson, Star, Bixolon), prueba con eso. Si no, instala el driver USB genérico para impresoras térmicas.

**El lector de código de barras no captura nada**

- Los lectores USB típicos actúan como teclado. Asegúrate de que la pistola esté en modo "USB HID Keyboard" (viene así de fábrica en el 99% de los casos).
- En la pantalla POS o en modo pistoleo de Inventario, prueba pasar un código sobre cualquier producto que tengas a mano. El sistema debería capturarlo automáticamente.
- Si no funciona, prueba escribiendo un código manualmente en la búsqueda — si eso funciona pero el escáner no, revisa la conexión USB del lector.

**Error "Base de datos no inicializada"**

- Cierra la aplicación y vuelve a abrirla.
- Si persiste, busca el archivo `%APPDATA%\Yumi POS\yumi-pos.db` y haz un respaldo antes de cualquier acción.

## Stack técnico

- Electron 33 + React 18 + TypeScript
- SQLite (better-sqlite3) — base de datos local
- Tailwind CSS 3 + shadcn/ui — interfaz
- Zustand — estado del carrito y sesión
- node-thermal-printer — impresión ESC/POS
- electron-builder — empaquetado Windows

---

Hecho para el minimarket de Rancagua. **Versión 0.1.0** (offline-first).
