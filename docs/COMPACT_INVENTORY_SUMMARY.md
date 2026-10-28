# Saldo de inventario · Presentación compacta

Solicitud: reducir el bloque y subirlo, conservando los saldos CRC/USD, Actualizar saldo y Ver desglose. Mantener la tasa histórica y el costo restante de filamentos e insumos.

## Implementado y verificado, pendiente de publicación

- Un resumen horizontal en escritorio, con importes en ambas monedas y botones al lado; adaptación móvil sin desbordamiento. El detalle por activo continúa en el modal existente, sin repetirlo dentro de tarjetas anidadas.
- Cada moneda distingue `Total a costo histórico` de `Parcial · N sin valorar`. El aviso conserva que los pendientes no se cuentan como cero. No se inventan tasas ni se suman monedas diferentes.
- Inicio: resumen ubicado después del saludo y antes de las métricas de módulos.
- Inventario: resumen ubicado después del título y antes de las estadísticas, una sola instancia y mismo orden visual, DOM y teclado.
- Sin cambios a hooks de carga, funciones financieras, RPC, datos, reintentos, Supabase, contratos ni navegación global. La preferencia de moneda existente no cambia.

## Integración de ubicación en Inventario · 2026-10-28

El fundador autorizó expresamente el ajuste puntual en `app/page.tsx`, también tocado por PR #55. Se mueve únicamente la instancia InventoryValueCards a después del encabezado hero, antes de las estadísticas. El placeholder QR y todos los cambios de URL permanecen fuera de este diff; las secciones son independientes. No se usa reordenamiento por CSS/DOM ni se duplican instancias para eludir una reserva.

La ubicación solicitada está integrada en la rama del PR #57; su publicación sigue pendiente. La autorización corresponde al cambio de ubicación y no autoriza merge/deploy de este PR ni del PR #55.

PR #56 de compras modifica globals.css: este bloque usa solo el módulo CSS propio. PR #45 mantiene documentación compartida reservada; no se modifican ROADMAP, STATUS, WORKLOG, AGENTS, skills ni infraestructura.

## Verificación

- `node --test tests/inventory-values.test.cjs`: 3/3 en el tramo de presentación; funciones financieras intactas desde esa prueba. `npx tsc --noEmit`, `git diff --check`, revisión React del diff y build final de integración aprobados (una ejecución de build en este tramo).
- `tests/inventory-values.browser.cjs` existente ampliado: 320/390/1280 px; dos monedas, parcial/completo, altura máxima dirigida, orden antes de métricas en Inicio y en Inventario (visual/DOM/teclado), instancia única, desglose, recuperación de fecha tras recarga, reintento BCCR, fallo de lectura después de escritura confirmada, actualización y modo demo sin conversiones inventadas.
- Datos ficticios y solicitudes simuladas; sin correos, consultas BCCR reales ni escrituras alojadas. Capturas revisadas en `node_modules/.tools/inventory-values/` (ignoradas por Git).
- En la captura del fundador, CRC tenía 5 registros sin valorar y USD 24. Son subtotales distintos por datos históricos pendientes; este cambio visual no completa esos datos ni afirma que los importes sean totales completos.

Rama `feat/compact-inventory-summary`, base main `c5894ffa1fcfce22eb5d9ecbeaf986280a4ac5a3`. PR #57 listo para revisión del alcance solicitado; implementación no equivale a publicación. Los datos históricos incompletos requieren completar su información y no quedan resueltos por este ajuste de presentación.
