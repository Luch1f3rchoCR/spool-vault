# Proper — Feature Specs

Las specs convierten una decisión de producto en un contrato ejecutable por cualquier agente o desarrollador sin depender del historial del chat.

## Cuándo usar una spec

Crear una spec cuando el trabajo:

- agrega o cambia comportamiento visible del producto;
- afecta datos, persistencia, Supabase, RLS o migraciones;
- toca inventario, costos, producción o historial;
- cruza varios componentes o capas;
- contiene decisiones de UX o reglas de negocio que podrían interpretarse de más de una forma.

No hace falta una spec completa para:

- correcciones de texto;
- cambios visuales pequeños y localizados;
- documentación;
- mantenimiento mecánico;
- configuración sin cambio de comportamiento.

Si una tarea pequeña empieza a revelar decisiones nuevas, detenerse y convertirla en spec.

## Estados

`DRAFT` → idea todavía incompleta.

`GRILLING` → decisiones abiertas en proceso de resolución.

`READY` → decisiones cerradas, alcance claro y criterios de aceptación verificables. Puede ejecutarse.

`IN_PROGRESS` → un ejecutor está trabajando en ella.

`VERIFYING` → implementación terminada; falta demostrar que cumple la spec.

`DONE` → criterios de aceptación y verificación satisfechos.

No implementar una spec que siga en `DRAFT` o `GRILLING`.

## Flujo recomendado

1. Capturar el problema y objetivo.
2. Usar `grill-me` / `grilling` cuando existan decisiones abiertas relevantes.
3. Investigar hechos en el repo en vez de preguntarle al usuario lo que pueda comprobarse.
4. Cerrar alcance, fuera de alcance y decisiones.
5. Marcar la spec `READY`.
6. Asignarla a OpenCode, Work u otro ejecutor.
7. Implementar respetando `AGENTS.md` y los contratos del repo.
8. Verificar contra cada criterio de aceptación.
9. Marcar `DONE` únicamente con evidencia.

## Reglas

- La spec describe qué debe quedar cierto; no debe prescribir implementación innecesariamente.
- Una decisión explícitamente cerrada no se reabre silenciosamente durante la implementación.
- Si aparece una decisión material nueva, detener la implementación y actualizar la spec.
- Si una recomendación de una skill contradice la spec o un contrato del repo, prevalece el contrato de Proper.
- El ejecutor debe poder entender la tarea leyendo la spec y únicamente el contexto relevante indicado por `AGENTS.md`.
- Mantener las specs breves. Una feature normal debería caber aproximadamente en 1–2 páginas.

## Nombre de archivo

Preferir:

`<ID>-<nombre-corto>.md`

Ejemplos:

`FIN-01B-dashboard-dual-currency.md`

`INV-03-filament-print-profiles.md`

Una spec representa un bloque coherente y verificable, no una lista indefinida de trabajo.
