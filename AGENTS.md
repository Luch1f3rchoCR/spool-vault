# Spool Vault — guía de trabajo

Esta carpeta contiene la aplicación real de Spool Vault. Es un proyecto Next.js con Supabase y despliegue automático en Vercel.

## Antes de cambiar algo

1. Leer únicamente las secciones relevantes de `ROADMAP.md` y `ATOMICITY_AUDIT.md`.
2. Revisar el estado de Git y conservar cualquier cambio ajeno a la tarea.
3. Buscar primero con `rg`; no releer archivos completos cuando una búsqueda dirigida sea suficiente.
4. Usar una rama corta por bloque estable. No trabajar directamente en `main`.

## Contratos que no se pueden romper

- El inventario autenticado pertenece al usuario y está protegido con RLS.
- Los datos demo o locales nunca deben presentarse como inventario sincronizado.
- Las operaciones que modifican más de una tabla deben vivir en una función transaccional de Supabase.
- Reintentos del navegador no deben duplicar rollos, compras, consumos, spools, pesajes ni correcciones.
- Compras, correcciones, consumos y pesajes son históricos; no se reescriben ni eliminan desde el cliente.
- `filament_rolls.spool_id` y `spools.status` deben confirmar juntos una misma realidad física.
- El estado del rollo se deriva en la base desde peso inicial, disponible, umbral bajo y archivo explícito.
- Un spool físico solo puede pertenecer a una ficha de rollo a la vez, incluso si la ficha está archivada.
- No sumar monedas distintas ni recalcular silenciosamente costos o taras históricos.

## Supabase

- Proyecto de producción: `xbeqmfgiekcyoqevlypi`.
- Todo cambio de esquema va en una migración nueva y aditiva dentro de `supabase/migrations/`.
- No modificar una migración que ya fue aplicada; crear otra que avance o corrija.
- Validar la migración dentro de una transacción revertida antes de aplicarla cuando sea posible.
- Probar éxito, rechazo y reintento con datos temporales o transacciones que terminen en rollback.
- Después de DDL, revisar los asesores de seguridad y rendimiento.
- Nunca guardar claves privadas, tokens o secretos en el repositorio.

## Interfaz

- Mantener español claro, tono amigable y diseño móvil primero.
- Los modales deben cerrar únicamente después de una confirmación real.
- Durante una escritura crítica, bloquear el doble envío y mostrar el estado en curso.
- No afirmar éxito cuando el resultado sea incierto; recuperar por la clave de idempotencia.
- Conservar compatibilidad con el modo local/demo sin confundirlo con datos reales.

## Verificación y publicación

1. Ejecutar `npm run build` y `git diff --check`.
2. Añadir al commit solo las rutas del bloque actual; no usar `git add .` ni variantes globales.
3. Subir la rama y abrir un PR borrador contra `main`.
4. Revisar diff, comentarios y controles automáticos; fusionar únicamente cuando estén verdes.
5. Sincronizar la copia local con `main` y verificar el despliegue exacto de Vercel.
6. Hacer una prueba de humo en `https://spool-vault.vercel.app/` y comprobar la consola.
7. Aplicar cambios en Supabase solo cuando el bloque realmente los requiera.

## Uso eficiente del contexto

- Continuar desde el último commit y el checklist; no reconstruir decisiones ya documentadas.
- Agrupar comprobaciones de solo lectura independientes.
- Preferir cambios pequeños y terminados a ramas grandes con varios objetivos.
- Usar subagentes solo para trabajos realmente independientes, como auditorías separadas de seguridad, UX móvil o costos. Paralelizar puede acelerar, pero normalmente aumenta los tokens totales.
- Actualizar `ROADMAP.md` y `ATOMICITY_AUDIT.md` cuando una decisión material quede implementada.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
