# Auditoría de atomicidad y UX de Spool Vault

Fecha de revisión: 29 de agosto de 2026.

## Qué significa “atómica” en Spool Vault

Una acción es atómica cuando todos sus cambios se confirman juntos o ninguno se guarda. También debe ser idempotente: si el navegador reintenta la misma solicitud, no puede duplicar el resultado.

Ejemplo: al agregar un rollo con proveedor y precio, el resultado correcto es que se guarden las tres piezas o que no se guarde ninguna. No debe existir un estado permanente de “rollo guardado, historial pendiente”.

## Resultado de la revisión actual

| Flujo | Estado actual | Riesgo | Acción recomendada |
| --- | --- | --- | --- |
| Asignar spool a rollo | Atómico | Bajo | Mantener la función transaccional y sus bloqueos de filas. |
| Liberar spool | Atómico | Bajo | Mantener la función transaccional. |
| Inactivar/reactivar spool | Atómico | Bajo | Mantener la función transaccional y validaciones. |
| Consistencia entre rollo y spool | Invariante diferida en base de datos | Bajo | La transacción solo se confirma si un spool `in_use` pertenece exactamente a un rollo y todo rollo asignado apunta a un spool `in_use`. |
| Registrar consumo y descontar gramos | Atómico e idempotente | Bajo | Mantener la función transaccional y probar reintentos en cada cambio del flujo. |
| Agregar spool vacío | Atómico e idempotente | Bajo | Mantener `create_spool` como único punto de escritura y conservar la clave durante reintentos. |
| Editar spool | Atómico e idempotente | Bajo | Mantener `update_spool`, bloqueo de fila y estado pendiente. |
| Agregar rollo, proveedor e historial de compra | Atómico e idempotente | Bajo | Mantener la función `create_roll_with_purchase` como único punto de escritura del formulario. |
| Editar ficha del filamento | Atómico e idempotente | Bajo | Mantener `update_filament_roll`; no reescribir compras, consumos ni pesajes desde este modal. |
| Corregir proveedor, fecha o costo de una compra | Atómico, trazable e idempotente | Bajo | Mantener `correct_purchase`, la revisión append-only y la sincronización del costo vigente del rollo. |
| Guardar pesaje e historial | Atómico e idempotente | Bajo | Mantener `record_roll_weight`; cada evento congela tara, tipo, fuente y confianza. |
| Derivar estado del rollo | Regla central en base de datos | Bajo | `Nuevo`, `Abierto`, `Bajo` y `Agotado` se recalculan desde pesos y umbral; `Archivado` continúa siendo explícito. |
| Cargar dashboard desde varias tablas | Lecturas separadas | Bajo hoy | Para reportes financieros, usar una vista o función que produzca una lectura consistente. |

La revisión de producción no encontró compras huérfanas, rollos con precio sin historial esperado ni spools en uso sin su rollo correspondiente. La primera corrección atómica fue aplicada sin modificar los registros reales existentes y verificada con operaciones temporales dentro de una transacción revertida.

Desde el 29 de agosto, la base también valida la relación rollo-spool al confirmar cada transacción. Las funciones pueden cambiar ambas tablas juntas, pero una escritura parcial se rechaza. Un índice único impide reutilizar el mismo spool físico en otra ficha, incluso si una de las fichas está archivada; además, el cliente autenticado ya no puede borrar directamente rollos o spools.

La misma revisión centralizó el estado operativo del rollo. Se corrigieron diez etiquetas antiguas de `new` a `open` sin cambiar sus gramos, compras, consumos ni pesajes. Desde entonces, cualquier modificación de peso, peso inicial o umbral pasa por un trigger y los límites físicos también están protegidos por una restricción de tabla.

## Riesgos transversales

### Doble clic, reintento y pérdida de conexión

Una transacción evita datos parciales, pero no evita por sí sola que la misma acción se ejecute dos veces. Las altas, compras, consumos y pesajes deben enviar una clave estable de idempotencia. La interfaz debe desactivar el botón mientras espera.

Si la conexión se corta, la aplicación debe consultar el resultado por esa clave antes de volver a crear el registro.

### Historial inmutable

Los registros históricos deben conservar los valores usados en el momento de la acción:

- tara aplicada al pesaje;
- tipo y confianza de la tara;
- precio y moneda originales;
- costo realmente pagado;
- tipo de cambio histórico;
- express asignado y método de prorrateo;
- fuente y confianza del dato.

Editar un tipo de spool, un HEX o un tipo de cambio no debe recalcular silenciosamente el pasado.

### Invariantes de base de datos

La base debe impedir que un cliente o una actualización futura pueda:

- asignar el mismo spool activo a dos rollos;
- marcar un spool como vacío mientras sigue asignado;
- asociar un `spool_id` a un rollo sin actualizar el estado del spool;
- guardar gramos negativos;
- guardar una moneda sin el monto correspondiente;
- sumar monedas distintas como si fueran equivalentes;
- modificar o eliminar historia financiera sin dejar trazabilidad.

## Contrato de UX para operaciones críticas

Cada acción crítica tendrá cuatro estados visibles:

1. **Lista:** el formulario puede enviarse.
2. **Guardando:** botón bloqueado y progreso visible.
3. **Confirmada:** todos los cambios se guardaron y la UI muestra el resultado final.
4. **No confirmada:** no se afirma éxito; la app comprueba la clave de operación antes de permitir reintentar.

Mensajes recomendados:

- Éxito: “Rollo y compra guardados correctamente”.
- Reversión: “No se guardó ningún cambio. Podés intentarlo de nuevo”.
- Resultado incierto: “Estamos comprobando si se guardó. No cerrés esta ventana todavía”.
- Reintento ya aplicado: “Esta operación ya estaba guardada; recuperamos su resultado”.

## Plan incremental

### Fase 0 — Cerrar los riesgos actuales

1. [Completado] Crear una operación atómica e idempotente para proveedor + rollo + historial de compra.
2. [Completado] Incorporar idempotencia en consumos y altas.
3. [Completado] Agregar estados pendientes y protección contra doble envío en esos flujos.
4. [Completado] Cerrar permisos innecesarios de funciones internas y agregar índices de relaciones.
5. [Completado] Probar RLS, reversión completa, reintentos y compilación.
6. [Completado] Extender el mismo contrato al catálogo de spools y al historial de pesajes.
7. [Completado] Proteger en base de datos la consistencia entre `filament_rolls.spool_id` y `spools.status`.
8. [Completado] Derivar el estado operativo del rollo desde sus pesos y umbral en un único punto de la base.

### Fase 1 — Tara y pesajes históricos

1. [Completado] Crear catálogo reutilizable de tipos de spool.
2. [Completado] Mantener `tare_weight_g` actual durante la transición.
3. [Completado] Crear historial de pesajes con tara y confianza congeladas por evento.
4. [Completado] Guardar pesaje + saldo resultante en una sola transacción idempotente.

### Fase 2 — Compras y multimoneda

1. Crear encabezados de compra y partidas sin eliminar `purchase_history`.
2. Agregar express, otros cargos, prorrateo y confianza del costo.
3. Conservar moneda original, moneda pagada y conversión histórica.
4. Migrar datos existentes con valores incompletos o estimados explícitos, sin inventar facturas.
5. [Completado] Permitir correcciones append-only del registro actual mientras se diseña el modelo de órdenes y partidas.

### Fase 3 — Color, perfil y reportes

1. Agregar procedencia del HEX.
2. Configurar CRC como moneda base inicial del perfil.
3. Derivar estados por gramos y porcentaje.
4. Crear el reporte de saldo con valores originales y convertidos separados.

## Criterio de terminación por fase

Una fase solo se marca completa cuando incluye migración aditiva, políticas RLS, pruebas de éxito y reversión, compilación del proyecto, validación local y prueba de humo en producción.
