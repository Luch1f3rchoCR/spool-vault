# Saldo actual en CRC y USD · 2026-10-25

Decisión del fundador: mostrar el material que queda, a costo de compra y con la tasa histórica de cada adquisición. Alcance: filamentos e insumos comprados; el total histórico comprado queda pendiente. No es una valoración a precios actuales ni una conversión al tipo de cambio de hoy.

## Cálculo y datos

- Filamentos: reutiliza `filament_inventory_valuation`, excluye archivados y conserva su base de costo landed/legado y sus estados de conciliación. Un costo declarado de cero o saldo agotado vale cero en ambas monedas sin inventar una tasa.
- Insumos: cada entrada positiva se convierte con el snapshot BCCR de su moneda y fecha real de adquisición. Los retiros descuentan proporcionalmente el costo promedio histórico acumulado en cada moneda. Cuando el saldo llega a cero, una reposición comienza un ciclo independiente; fechas/tasas de stock completamente consumido no bloquean el saldo nuevo.
- El saldo nativo sigue siendo el del ledger existente; no se reescriben entradas, compras, consumos ni costos congelados de producción. Un grupo de movimientos de fecha/hora idéntica que mezcla entradas y retiros no tiene un orden comprobable: su conversión se marca incompleta. No se desempata al azar por UUID. Los movimientos gratuitos valen cero.
- `inventory_value_summary()` es STABLE, invoker y restringida a authenticated: lee ambas clases de activos en una misma instantánea de base de datos. No consulta BCCR ni escribe al abrir el dashboard. Los importes pendientes se excluyen del subtotal y nunca se sustituyen por cero.
- Las entradas nuevas de insumos piden fecha de compra/adquisición y la conservan dentro del payload inmutable. El servidor valida las fechas suministradas; clientes e intentos antiguos sin esa clave siguen siendo compatibles.
- Los insumos antiguos no tenían fecha real de compra. `supply_purchase_dates` agrega una confirmación inmutable por entrada, con dueño y clave de reintento; no presupone que registro y compra ocurrieron el mismo día. Este flujo completa fechas ausentes una sola vez; corregir fechas ya declaradas requiere un bloque posterior de correcciones auditadas.
- El endpoint BCCR existente acepta también fechas/monedas pendientes de insumos del usuario verificado. Conserva validación de sesión, reutilización de snapshots, indicador/fecha exactos y claves exclusivamente en servidor. No consulta fechas arbitrarias ni usa tasas actuales como reemplazo.
- La exportación propia incluye anotaciones de fecha y snapshots BCCR, además de los datos anteriores.

## Presentación y recuperación

Dos tarjetas contiguas en Inicio e Inventario: CRC y USD, con desglose Filamentos/Insumos. Estados de carga, sin sesión, error y subtotal parcial explícitos. La preferencia de moneda base no altera este par. El detalle permite completar fechas y consultar una tasa pendiente por vez; no hace consultas masivas automáticas. Un intento de fecha se conserva en la pestaña antes del envío y se recupera con la misma clave tras una respuesta perdida/recarga. Las operaciones bloquean doble envío y cierre; las esperas de sesión/red están limitadas a 30 segundos. Al cambiar cuenta o inventario se descartan los valores anteriores; cerrar el reporte vuelve a leer el resumen.

## Verificación y despliegue

26 pruebas unitarias/servidor: totales, parciales, cero real, respuesta de otra cuenta, cancelación, endpoint sin sesión, solicitudes ajenas/arbitrarias y reutilización. PostgreSQL 17 sin red: esquema desde cero, rollback de migración, tasas distintas en varias entradas con consumos intermedios, ciclo agotado/reposición, datos antiguos sin fecha, anotación idempotente, rechazo de payload cambiado, inmutabilidad, RLS, orden ambiguo, costo cero, exportación y regresiones anteriores.

Navegador con servicios simulados a 320/390/1280 px: resumen conjunto, parcial/completo, fecha con respuesta perdida y recarga, tasa fallida/reintento, actualización y error de lectura, teclado/bloqueo y responsive. Regresiones del reporte financiero y catálogo/entradas de insumos, incluido el reintento de un payload antiguo intacto. Capturas temporales: `node_modules/.tools/inventory-values/`. TypeScript, build y `git diff --check`.

Migración local: `20261025175856_inventory_value_summary.sql`. Aplicarla antes de publicar interfaz/endpoint; el frontend anterior sigue siendo compatible. Registrar versión remota y despliegue exacto en el PR y en `supabase/README.md`. No se han creado compras ni insumos de prueba en cuentas reales; los ensayos de navegador autenticado usan proveedores simulados. El humo público sin sesión no demuestra una consulta BCCR real autenticada.

Agentes/skills intactos. `ROADMAP.md` se conserva por el solapamiento con Marketing/PR #45.

Supabase aplicado: versión remota `20261025182036` (`inventory_value_summary`), equivalente al archivo local `20261025175856`. Verificación estructural y asesores sin nuevos hallazgos de seguridad. Publicación de la interfaz y humo público: [PR #54](https://github.com/Luch1f3rchoCR/spool-vault/pull/54).
