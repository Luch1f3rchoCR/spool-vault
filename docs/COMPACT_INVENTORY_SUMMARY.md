# Saldo de inventario · Presentación compacta

Solicitud: reducir el bloque y subirlo, conservando los saldos CRC/USD, Actualizar saldo y Ver desglose. Mantener la tasa histórica y el costo restante de filamentos e insumos.

## Implementado y verificado, pendiente de publicación

- Un resumen horizontal en escritorio, con importes en ambas monedas y botones al lado; adaptación móvil sin desbordamiento. El detalle por activo continúa en el modal existente, sin repetirlo dentro de tarjetas anidadas.
- Cada moneda distingue `Total a costo histórico` de `Parcial · N sin valorar`. El aviso conserva que los pendientes no se cuentan como cero. No se inventan tasas ni se suman monedas diferentes.
- Inicio: resumen ubicado después del saludo y antes de las métricas de módulos.
- Sin cambios a hooks de carga, funciones financieras, RPC, datos, reintentos, Supabase, contratos ni navegación global. La preferencia de moneda existente no cambia.

## Integración pendiente: ubicación en Inventario

Mover la instancia de InventoryValueCards situada después de las estadísticas a inmediatamente después del encabezado hero requiere `app/page.tsx`. El PR #55 de URL pública también toca ese archivo (placeholder QR en otra sección). Se informó el cruce y se solicitó autorización puntual conforme a la instrucción de no editar archivos compartidos con otro bloque abierto. **No se modificó app/page.tsx ni se usó reordenamiento visual por CSS/DOM para eludir esa reserva.**

Este bloque todavía no cumple la ubicación solicitada en Inventario. La vista ya recibe la presentación compacta mediante el componente compartido; falta solamente mover su instancia. Después de autorizar o cerrar PR #55: mover la instancia, comprobar orden visual y por teclado antes de estadísticas y evitar duplicados. Registrar la integración antes de promover este PR para publicación.

PR #56 de compras modifica globals.css: este bloque usa solo el módulo CSS propio. PR #45 mantiene documentación compartida reservada; no se modifican ROADMAP, STATUS, WORKLOG, AGENTS, skills ni infraestructura.

## Verificación

- `node --test tests/inventory-values.test.cjs`: 3/3; `npx tsc --noEmit`, `git diff --check`, revisión React del diff y un build completo aprobados.
- `tests/inventory-values.browser.cjs` existente ampliado: 320/390/1280 px; dos monedas, parcial/completo, altura máxima dirigida, orden antes de métricas en Inicio, desglose, recuperación de fecha tras recarga, reintento BCCR, fallo de lectura después de escritura confirmada, actualización y modo demo sin conversiones inventadas.
- Datos ficticios y solicitudes simuladas; sin correos, consultas BCCR reales ni escrituras alojadas. Capturas revisadas en `node_modules/.tools/inventory-values/` (ignoradas por Git).
- En la captura del fundador, CRC tenía 5 registros sin valorar y USD 24. Son subtotales distintos por datos históricos pendientes; este cambio visual no completa esos datos ni afirma que los importes sean totales completos.

Rama `feat/compact-inventory-summary`, base main `c5894ffa1fcfce22eb5d9ecbeaf986280a4ac5a3`. Borrador independiente para revisión, no publicación ni cierre de toda la solicitud.
