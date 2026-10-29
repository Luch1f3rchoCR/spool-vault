# Acceso al historial de producción

Bloque del 28 de octubre de 2026, rama `feat/production-history-access`, desde main `2a46305bacca9c7f97ff1ddfb39c7b04600979f5` (PR #58 publicado).

## Problema y alcance

El desglose histórico se podía abrir para dos impresiones por ficha y ocho en «Producción reciente». Los registros más antiguos podían estar cargados en la app, pero no se ofrecía una forma de consultar sus costos desde Proyectos.

Se reemplaza esa sección por «Historial de producción», inicialmente con ocho filas y un botón «Ver más impresiones» que añade hasta ocho por acción. El contador indica las impresiones **cargadas**, sin prometer que se haya paginado toda la base de datos. Se usa el mismo orden de fecha de impresión/creación del padre, las mismas colecciones y el mismo componente de desglose de PR #58.

Los detalles abiertos se conservan al añadir filas. El foco pasa al resumen del primer registro añadido y Tab continúa por las nuevas filas dentro del modal. El botón desaparece al mostrar todos los registros cargados. La ficha de proyecto mantiene dos impresiones resumidas; los registros adicionales se consultan en el historial, incluso sin proyecto vigente.

No cambia tarifas, importes, inventario, persistencia, contratos compartidos, consultas o RPC. No añade filtros, exportaciones ni paginación de servidor. PR #55 y documentación reservada por Marketing permanecen intactos.

## Verificación

- `npx tsc --noEmit`, revisión del diff y `git diff --check`.
- Build aprobado. Primer intento falló al descargar las fuentes existentes de Google por restricciones de red; se repitió con acceso de red, sin cambios en fuentes ni configuración.
- Smoke local a 320/390/1280 px con 19 impresiones ficticias: 8 → 16 → 19, contador/botón, registro más antiguo accesible, sin pérdida/duplicación, conservación de detalles abiertos/cerrados, foco, Enter y Tab, y ajuste horizontal.
- Regresión del desglose de PR #58 con tres impresiones: monedas separadas, datos históricos frente a tarifas actuales, cero/costo faltante y registro sin proyecto vigente.
- Tráfico externo bloqueado; sin escrituras ni correos ni errores de página. Scripts temporales: `/private/tmp/proper-production-history-smoke.cjs` y `/private/tmp/proper-cost-breakdown-smoke.cjs`. Capturas: `/private/tmp/proper-production-history-{320,390,1280}.png`. No se añade una suite permanente para este bloque de presentación.

## Entrega

Implementado y verificado localmente; rama/commit respaldados mediante PR borrador. Pendiente revisión/publicación. Sin migraciones o configuración externa requerida.
