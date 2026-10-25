# Perfiles de impresión · tramo independiente

## Integración vigente · 2026-10-24

Rama `feat/print-profiles-integration`, desde main `cddd708`. FIN-01A ya está publicado y liberó la integración. El antecedente del 3 de octubre queda archivado abajo.

- Acceso «Perfiles de impresión» desde el detalle del filamento. Modal con múltiples configuraciones por rollo, creación, edición precargada e historial de las últimas 100 revisiones. Todas las revisiones permanecen en la base y en la exportación JSON.
- Contrato único en `lib/types.ts`, controles originales y presentación del modal de Insumos reutilizados. Los valores son declarados, nunca parámetros recomendados ni comandos enviados a impresoras. No hay refactor visual global.
- Cada edición agrega una fila inmutable en `filament_print_profiles`; `profile_id` conserva la identidad y `version` rechaza ediciones concurrentes obsoletas. Vista actual invoker; RLS/trigger validan propietario del rollo e impresora. No modifica compras, inventario ni corridas.
- RPC `save_filament_print_profile`: misma clave y contenido devuelve la revisión original; contenido cambiado se rechaza. El intento se conserva en `sessionStorage` por usuario/rollo antes del envío, incluso tras cerrar/recargar la pestaña. Errores inciertos congelan los valores para reintentar. Esperas de sesión/red limitadas a 30 segundos.
- Requiere sesión e inventario sincronizado; demo/local lo explica sin simular persistencia. Impresoras se administran desde Perfil.
- Migración CLI: `20261025021216_filament_print_profiles.sql`; incluye tabla/vista/RPC y revisiones en el respaldo existente. Aplicar base de datos antes de interfaz; no reaplicar por diferencias de timestamp remoto.
- Verificado: 8 pruebas unitarias; esquema completo y rollback de DDL, regresiones SQL y casos de éxito/rechazo/reintento/aislamiento/versiones/exportación en PostgreSQL 17 sin red; navegador simulado a 320/390/1280 px (respuesta perdida, recarga, edición, historial, foco, bloqueo y responsive); TypeScript y build. Evidencia visual no versionada: `node_modules/.tools/print-profiles/`.
- Sin correos ni perfiles de prueba en cuentas reales. El navegador autenticado usa servicios simulados; el humo público no demuestra un guardado autenticado real.
- Registrar publicación y versión remota de migración en el PR. Marketing/PR #45 y `ROADMAP.md` siguen reservados; agentes intactos. Migración de URL separada.

## Antecedente archivado · 2026-10-03

Fecha: 2026-10-03 · rama `feat/filament-print-profiles` · base `dac3f219d84740412b1a30bd839b1bc245f571fc`.

## Alcance implementado

- `components/filament-print-profile-fields.tsx`: grupo de controles reutilizable para crear una configuración. Reutiliza `FilamentRoll` y `PrinterProfile` de `lib/types.ts`, sin copiarlos ni alterarlos. Contexto del filamento, selección explícita de impresora activa, nombre, laminador/versión, diámetro de boquilla, temperaturas, multiplicador de flujo y notas.
- `lib/filament-print-profile-fields.ts`: metadatos de presentación y validadores por campo. Acepta coma o punto decimal; diferencia vacío de cero; rechaza negativos, valores no finitos, unidades incrustadas y formatos ambiguos. Diámetro y ratio deben ser positivos si se informan. No convierte porcentajes a ratios silenciosamente.
- `tests/filament-print-profile-fields.test.cjs`: cinco pruebas ejecutables directamente, sin modificar un ejecutor compartido.

El componente es un `fieldset`, no una pantalla ni un formulario de guardado. No tiene botón de éxito, ruta de prueba, almacenamiento paralelo, API, DTO de perfil ni simulación de persistencia. Sus nombres de controles son de presentación; no constituyen el contrato de una tabla/RPC. No incluye estilos nuevos: utiliza los controles y la cuadrícula existentes. No hay rediseño, valores precargados ni recomendaciones de temperatura. La validación numérica no certifica límites físicos de una impresora.

## Verificación realizada

```sh
node --test tests/filament-print-profile-fields.test.cjs
node_modules/.bin/tsc --ignoreConfig --noEmit --strict --jsx react-jsx --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck --lib ES2022,DOM components/filament-print-profile-fields.tsx lib/filament-print-profile-fields.ts
git diff --check
```

Resultado: cinco pruebas aprobadas y comprobación de tipos sin errores. No se ejecutó el runner SQL compartido ni se aplicaron migraciones. No se probó en navegador porque no hay ruta o integración de aplicación en este tramo. No afirmar que el módulo está disponible para usuarios ni que guarda perfiles.

## Integración detenida hasta liberar FIN-01A

1. Definir una sola vez el contrato persistente del perfil: identidad, pertenencia al usuario/filamento/impresora, campos opcionales y ciclo de creación/edición. Todavía no se definió un modelo alternativo en estos archivos.
2. Crear una migración aditiva independiente y sus pruebas SQL: aislamiento por usuario, referencias válidas y guardado idempotente. No reutilizar `drying_notes` ni otro campo como almacenamiento de perfiles.
3. Conectar lectura/guardado y apertura desde el detalle del filamento; envolver los controles en el modal/formulario existente. La edición/precarga se implementará con el contrato real, no mediante otro DTO provisional. Volver a validar en servidor; la validación del navegador no es autorización.
4. Mantener múltiples configuraciones por filamento/impresora sin afectar consumos, compras o costos históricos. No enviar ajustes a impresoras, importar formatos de laminadores ni añadir referencias a corridas de producción en este tramo.
5. Verificar el flujo autenticado completo antes de proponer publicación.

### Archivos existentes que necesitará tocar la integración

| Archivo | Motivo | Estado en este tramo |
| --- | --- | --- |
| `lib/types.ts` | Contrato persistente compartido del perfil, una vez definido | Reservado por FIN-01A; intacto |
| `app/page.tsx` | Abrir el modal desde el filamento, cargar perfiles y conectar operaciones confirmadas | No modificado; revalidar conflictos con auditoría frontend antes de editar |
| `tests/local-database.cjs` | Incorporar la nueva prueba SQL al ejecutor una vez liberado | Reservado por FIN-01A; intacto |
| `supabase/README.md` | Documentar migración/operaciones y orden de despliegue | Reservado por FIN-01A; intacto |
| `ROADMAP.md` | Actualizar el estado real del bloque | Reservado por FIN-01A; intacto |
| `ATOMICITY_AUDIT.md` | Registrar contratos de guardado, reintento y pruebas | Reservado por FIN-01A; intacto |
| `PROJECT_CONTEXT.md` | Registrar continuidad y evidencias al cerrar integración | No modificado |

Los nuevos archivos de migración, pruebas SQL y modal se crearán en el siguiente tramo. No se requiere cambiar configuración de pruebas, `package.json`, estilos globales, marca ni agentes para esta pieza. Si la integración revela otra dependencia compartida, reportarla antes de editarla.

## Entrega

Commit local únicamente. Sin push, PR, merge, cambios en Supabase o despliegue. Todos los archivos tocados por FIN-01A/PR #33 y todos los archivos de infraestructura de agentes permanecen intactos.
