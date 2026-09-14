# Diseño aprobado → desarrollo → publicación

Actualizado: 2026-09-13. Fuente compartida para no reconstruir el contexto entre chats.

Naming y arquitectura de marca vigentes: [BRAND_STATUS.md](./BRAND_STATUS.md). Sin nombre comercial final; Proper, Meld, Strata y Spool Vault no son candidatos activos. Mantener posicionamiento y firma secundaria aprobados sin renombrar infraestructura.

## Cómo trabajar sin perder continuidad

- Chat de diseño: explorar y aprobar propuestas. Entregar solo el cambio aprobado, pantalla, comportamiento y referencia visual, no toda la conversación.
- Tarea de desarrollo: leer este archivo y `PROJECT_CONTEXT.md`, implementar bloques pequeños, probar y registrar PR/commit y publicación.
- Cada traspaso debe indicar: **ID del bloque, decisión aprobada, qué cambia, qué no cambia y dudas pendientes**.
- Un mockup aprobado no significa código implementado. Un PR no significa desplegado. Registrar cada estado por separado.
- No afirmar diferencias de cobro entre chats; depende del producto y plan del usuario.

## Decisiones aprobadas

| ID | Alcance | Estado |
| --- | --- | --- |
| UI-01 | Diseño claro cálido suave, superficies blancas, verde, mejor jerarquía y navegación Inventario / Compras / Proyectos. Nombre comercial final pendiente. | Aprobado visualmente; implementación integral pendiente |
| UI-02 | Compras como encabezados resumidos y líneas en modal. | Diseño aprobado; el producto ya tiene tarjetas/detalle, falta adaptar estilo aprobado |
| UI-03 | Proyectos centrados en imprimir y guardar. Cotizar es opcional y secundario, nunca requisito para imprimir. | Primer bloque implementado y probado localmente; publicación pendiente |
| UI-04 | Cambiar colores para una impresión sin modificar la receta original; guardar una combinación reutilizable opcionalmente. | Cambio de rollo en corrida ya existente; variante independiente implementada y probada localmente; publicación pendiente |
| UI-05 | Desglose de materia prima, insumos, mano de obra, electricidad, máquina, acabados, empaque y otros gastos. No duplicar luz/mano de obra dentro de máquina. | Diseño aprobado; comparar modelo existente antes de ampliar rubros |
| UI-06 | Cotización con varios proyectos/versiones, colores, cantidad y precios; vista de cliente sin costos internos. Historial de versiones enviadas. | Primer mockup aprobado con UI-03 como corrección; módulo real pendiente |

## Bloque actual: UI-03 / UI-04 · variantes

- Mantener **Registrar impresión** como acción principal: registra una impresión realizada; no envía trabajos a la impresora.
- Agregar **Guardar variante**, con nombre, versión, licencia, tiempo, receta e insumos precargados y editables.
- Guardar una variante crea un proyecto independiente mediante `create_print_project`; no modifica la receta fuente, corridas ni inventario. No hay agrupación padre/hijo en esta primera entrega.
- Un rollo eliminado o archivado requiere elegir reemplazo; no sustituirlo silenciosamente.
- El archivo STL/3MF no se copia ni se comparte implícitamente. Se avisa y se permite adjuntar uno nuevo.
- No habilitar botones de cotización sin persistencia real. No añadir una conexión con la impresora ficticia.
- Actualizar una receta existente y conservar una relación formal entre variantes requieren un bloque posterior.

### Criterios de aceptación

- Cancelar no escribe; confirmar crea una sola receta y vuelve a la lista tras respuesta confirmada.
- Conserva el proyecto fuente, inventario y datos históricos.
- Conserva tiempos, insumos, notas de insumos, moneda y licencia; cambiar color es una elección explícita.
- Verificar guardado, recarga, cancelación y diseño en móvil/escritorio.
- Pruebas, compilación y publicación se registran con evidencia, no por inferencia.

## Pendientes del flujo comercial

Descuentos, impuestos, envío, condiciones, emisión, aceptación/rechazo/vencimiento, versiones y conversión a pedido. Cotizar o aceptar no consume inventario. La producción registra el consumo real por separado. Integración AMS y envío directo a impresora continúan fuera del alcance actual.

## Evidencia del primer bloque

- `npm run build`: aprobado (Next.js y TypeScript).
- `node --test tests/project-variant.test.cjs`: 4 pruebas aprobadas (metadatos y costos, independencia de borradores, rollos faltantes/archivados, nombre máximo y valores nulos).
- Navegador sobre compilación local sin configuración de Supabase: crear receta, guardar variante con otro color, recargar, comprobar original intacto, cancelar sin crear, registrar impresión con el rollo de la variante seleccionado.
- Saldo de muestra conservado en 1475 g; cero corridas creadas. Ningún dato de producción modificado.
- Sin desbordamiento del modal en 320, 390 y 1280 px; consola sin errores. Verificada jerarquía Registrar impresión / Guardar variante en móvil.
- No se ensayó una nueva escritura autenticada en Supabase: se reutiliza la operación existente, sin cambiar su contrato ni el esquema. No afirmar publicación hasta comprobar el despliegue.
