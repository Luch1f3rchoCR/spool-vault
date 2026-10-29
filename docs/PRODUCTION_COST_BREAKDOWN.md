# Desglose histórico de producción · UI-05

Bloque del 28 de octubre de 2026, desde main `7d4fcfeb9f36f2ff114183a0158b7e35d402bbb4`, rama `feat/production-cost-breakdown`.

## Implementado

En Proyectos, cada impresión visible en la ficha y en «Producción reciente» ofrece «Ver desglose de costos». El detalle permanece cerrado inicialmente. Muestra los consumos guardados de filamento, insumos/extras y los importes congelados de electricidad, máquina, mano de obra y fallos. También muestra la impresora histórica si existe.

No usa el precio actual del rollo, el promedio actual de insumos ni las tarifas actuales del perfil. Cada línea conserva su moneda; no agrega conversiones ni cambia los totales/utilidad existentes. Los importes faltantes se indican como «Sin costo registrado»; un cero registrado sigue siendo cero. La ficha etiqueta como «Subtotal registrado» el resumen que ya se detectaba incompleto.

El detalle usa las mismas colecciones históricas que ya carga la app, sin consultas nuevas. Sigue disponible en Producción reciente aunque el proyecto ya no esté en la lista. Se conservan los límites actuales de dos impresiones por ficha y ocho en el historial reciente. No incluye edición financiera, nuevas categorías, cotizaciones ni exportaciones.

## Verificación

- `npx tsc --noEmit` y `git diff --check`.
- Compilación completa aprobada; se repitió después de corregir en la inspección visual la repetición de la sigla USD en los importes.
- Smoke local sobre la compilación en 320, 390 y 1280 px, con usuario/colecciones ficticios y tráfico externo bloqueado. Script temporal: `/private/tmp/proper-cost-breakdown-smoke.cjs`; no se añadió una suite permanente para esta presentación localizada.
- Apertura/cierre por Enter/Espacio, foco en el control, altura táctil mínima de 44 px y ausencia de desbordamiento horizontal.
- Importes históricos conocidos distintos de las tarifas actuales; CRC y USD separados; cero válido, costo faltante, operación ausente y registro sin proyecto vigente.
- Sin escrituras ni correos, cero errores de página. Capturas temporales: `/private/tmp/proper-cost-breakdown-{320,390,1280}.png`.

## Entrega

Implementado y probado localmente. Commit/rama respaldados mediante el PR del bloque; no equivale a publicación en producción. No requiere migraciones ni configuración externa. La documentación compartida reservada por Marketing y el PR #55 permanecen intactos.
