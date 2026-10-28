# Compras · Borrador por líneas

Solicitud del fundador: mantener los campos y costos actuales, llenar un filamento a la vez e incluirlo en una línea compacta antes de guardar la compra completa. Corregir el espacio vacío del modal, sin rediseño global.

## Implementación

- `Agregar filamento` abre una vista del mismo ModalFrame con todos los campos existentes. `Incluir en la compra` agrega el rollo al borrador, no al inventario.
- Cada línea resume color, marca/línea, gramos, presentación y precio; permite editar o quitar. Editar conserva `line_id`; cancelar descarta solo esa edición y vuelve al borrador con foco en sus partidas.
- Proveedor y moneda se muestran en el encabezado de la orden. Agrupar compras anteriores queda en una sección secundaria, conservando compatibilidad de proveedor/moneda; quitar una de la selección no modifica el historial.
- La cuadrícula ahora está en el fieldset que contiene los dos pasos: escritorio usa ambas columnas y móvil una. Se mantienen tokens de Proper y controles táctiles de 44 px.
- `Guardar orden` conserva onCreate, payload, validaciones de cargos/pago y reintentos existentes. Solo esa operación registra los nuevos rollos y la compra; un resultado incierto conserva el borrador.
- No modifica cálculos, contratos compartidos, RPC, Supabase, migraciones, datos reales ni infraestructura de agentes. No incorpora guardado persistente del borrador al cerrar el modal o recargar.

## Identificación de rollos

El QR existente identifica el registro de cada rollo. El código SP pertenece al spool físico reutilizable y se muestra cuando está asignado; no debe tratarse como identificador permanente de una compra. Este bloque no añade códigos legibles nuevos a los rollos ni mezcla unidades del mismo color/precio.

## Verificación

- `npx tsc --noEmit`, `git diff --check`, revisión del diff y dos builds completos. El segundo corresponde al ajuste de foco por teclado de la sección de compras registradas, posterior al primer build.
- `tests/order-new-filaments.browser.cjs` ampliado, sin suite nueva: 320/390/1280 px, cuatro líneas sin formularios expandidos, validación, cancelación, edición, eliminación, cero escrituras antes de confirmar, agrupación compatible y rechazo de otra moneda, pérdida de respuesta/reintento idéntico y rechazo de payload cambiado, comprobante, inventario y recarga.
- `tests/add-purchase-navigation.browser.cjs`: 320/390/1280 px, navegación, spool, comprobantes, moneda y foco. Ambos scripts actualizan el ingreso a Inventario conforme al dashboard actual.
- Navegadores aislados, cuenta ficticia y respuestas simuladas; ninguna escritura alojada, correo ni inventario real. Capturas revisadas de móvil y escritorio en `node_modules/.tools/evidence/` (ignoradas por Git).

## Entrega y dependencias

Rama `feat/purchase-line-composer`, desde main `c5894ffa1fcfce22eb5d9ecbeaf986280a4ac5a3`. Implementación verificada para PR borrador; no equivale a publicación. No depende del PR #55 (URL pública), pendiente de autorización explícita de merge/deploy tras bloqueo automático. ROADMAP y documentación compartida de marketing permanecen reservados por PR #45; la continuidad de este bloque queda aquí.
