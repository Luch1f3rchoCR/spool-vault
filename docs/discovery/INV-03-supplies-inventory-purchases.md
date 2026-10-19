# INV-03 · Insumos + Inventario + Compras

Estado: discovery documental cerrado con límites de validación explícitos; no spec READY ni autorización de implementación.
Actualización de decisiones: 19 de octubre de 2026, a partir de las respuestas del fundador. La evidencia AS-IS se conserva; las decisiones siguientes describen el producto deseado, no funciones ya publicadas.
Base inicial y capturas: `147f82f4c3d337d94d1febf2f56b709ff321448a`, 7 de octubre de 2026.
Cierre: 18 de octubre de 2026, sobre `main` actualizado `1cdd73d631837f85c5bedaac574751f177723b5f`. Entre ambas bases solo cambió `AGENTS.md`; no cambió el código de los flujos analizados.
Rama de cierre: `docs/inv03-discovery-close`. Se conserva el informe y la baseline que estaban sin seguimiento; no se modifican otros bloques.

## Aclaración del fundador

Los insumos también deben poder ingresar individualmente en Compras, igual que los filamentos. La futura propuesta debe cubrir una orden de una sola línea de insumo, solo insumos y mezcla con filamentos; no obligar a acompañarlos con un filamento. “Individual” no limita la cantidad a una unidad ni implica una ficha por cada imán.

No se implementa producto, UI, schema, marca ni arquitectura en este bloque. No PR, merge ni deploy. Solo informe y baseline si es accesible. Archivos reservados y ramas activas no se modifican.

## Confirmado hasta ahora (código de la base indicada)

- `components/supplies-modal.tsx`: lista, búsqueda, Nuevo insumo, Entrada / ajuste e Historial. Usa ModalFrame. No ofrece edición de nombre/categoría/unidad de una ficha existente.
- `lib/supplies.ts` y migración `20260928030951_supply_stock_projects.sql`: catálogo genérico `supplies`, movimientos `supply_movements` y vista `supply_stock`; no una tabla distinta por tipo de objeto.
- Las entradas de Insumos requieren sesión, cantidad positiva y motivo. “Entrada / compra” no equivale a crear una orden en Compras.
- `PurchaseOrderItem` exige `purchase_history_id` y campos específicos de filamentos. No tiene `supply_id` ni discriminador genérico de tipo.
- `create_purchase_order_v3` admite `purchase_ids` y `new_rolls`, llama a operaciones de rollo y orden dentro de una transacción. Una línea nueva representa un rollo físico. No existe destino de insumos en este contrato.
- Crear/vincular un insumo desde una orden y alimentar su stock requiere una futura decisión/contrato; no basta agregar otra opción visual.

## Conclusión ejecutiva

El catálogo de insumos genéricos y su stock ya existen. El hueco principal es la conexión con Compras, no la falta de una entidad por cada objeto. Hoy una orden solo contiene compras de filamentos; una entrada de insumo es un movimiento independiente, sin vínculo estructurado a una orden, partida o pago.

La futura INV-03 necesita un contrato de compra que soporte destinos distintos, conservando las mecánicas especializadas: rollos físicos para filamento y cantidades acumuladas para insumos. No se propone aquí una tabla, discriminador o RPC definitivo.

## AS-IS: recorrido y evidencia

| Acción | Comportamiento actual confirmado | Fuente |
| --- | --- | --- |
| Abrir Insumos | Acceso independiente en navegación; abre `SuppliesModal`. Sin sesión, lista vacía, aviso y alta deshabilitada. | `app/page.tsx`, baseline |
| Inventario → Agregar | Nuevo filamento, crear spool, asignar spool y administrar spools; no incluye Nuevo insumo. | `components/add-actions-modal.tsx` |
| Crear insumo | Nombre, categoría, unidad libre, moneda, cantidad positiva, costo unitario y motivo. Crea ficha y entrada conjuntamente. | `components/supplies-modal.tsx`, `record_supply_movement` |
| Editar ficha | No hay edición de nombre, categoría o unidad en el modal. “Entrada / ajuste” modifica existencias, no la ficha. | `components/supplies-modal.tsx` |
| Entrada / ajuste | Entrada positiva; ajuste con cantidad positiva o negativa y motivo. Un retiro toma el costo promedio vigente; se rechaza saldo negativo. | Modal y trigger `validate_supply_movement` |
| Historial | Muestra movimientos del insumo, cantidad, tipo, motivo, fecha y costo por unidad. No muestra una orden asociada. | `components/supplies-modal.tsx` |
| Compra solo filamentos | Nueva orden permite crear rollos o agrupar compras existentes compatibles por proveedor/moneda. Confirmar guarda la operación completa. | `components/purchase-orders-modal.tsx`, `create_purchase_order_v3` |
| Compra solo insumos / mixta | No disponible en el formulario ni en el contrato de la orden. Tampoco hay compra de una sola línea de insumo. | `PurchaseOrderValues`, `PurchaseOrderItem`, RPC v3 |
| Proyecto con insumos | Selector de insumo existente o extra manual. Guardar receta no descuenta; registrar producción descuenta los insumos vinculados y congela costos. | `components/projects-modal.tsx`, migración de insumos |

### Trazabilidad de cada ruta actual

- **Filamento nuevo:** borrador de orden → `new_rolls` → `create_purchase_order_v3` → `create_roll_with_purchase` crea rollo e historial → `create_purchase_order_v2` agrupa partidas y pago opcional → resultado confirmado actualiza la UI. Una línea equivale a un rollo físico; no crea/asigna un spool físico.
- **Compra de filamento existente:** `purchase_ids` → orden/partida → compra histórica ya existente y su rollo. Agruparla no vuelve a ingresar gramos ni crea otro rollo.
- **Insumo:** `SupplyValues` → `record_supply_movement` → ficha nueva o `supply_id` existente → movimiento → `supply_stock` deriva cantidad/costo. No pasa por `purchase_orders`, `purchase_order_items` ni `purchase_history`.
- **Producción:** componente con `supply_id` → trigger de consumo → movimiento negativo y costo congelado en corrida; participa en la misma transacción del cierre de producción. Extras manuales sin `supply_id` no descuentan stock.

## Modelo y contratos actuales

| Área | Existe | Límite relevante para INV-03 |
| --- | --- | --- |
| Catálogo | `supplies`: nombre, categoría, unidad, moneda y propietario | Sin stock mínimo, archivo ni edición expuestos en este flujo. Sin proveedor estructurado en la ficha. |
| Clasificación | Imanes, Pines, Tornillos, Electrónica, Pintura, Empaque, Otros | Correas, rodamientos, cables, adhesivos, etc. pueden ser nombres de insumos; no exigen tablas distintas. |
| Unidad | Texto libre de 1–30 caracteres; valor inicial “unidad” | Acepta metro, gramo, kilogramo, ml o litro como texto, pero no normaliza equivalencias ni convierte unidades. |
| Cantidad | `numeric(16,3)`, movimiento distinto de cero; UI con paso 0.001 | Admite fracciones incluso para “unidad”. No hay regla por tipo de unidad. |
| Saldo | `supply_stock`, suma de movimientos; costo medio = valor restante / cantidad | No es un campo de saldo editable. El costo mostrado es 0 cuando no hay existencias. |
| Movimientos | `receipt`, `adjustment`, `production`; costo, motivo, solicitud y corrida opcional | Sin `order_id`, partida o historial de compra de insumos. Motivo/proveedor/referencia es texto libre. |
| Orden y partida | `purchase_orders` y `purchase_order_items` | Partida exige `purchase_history_id` único y atributos de filamento; no tiene destino de insumo. |
| Pago | Pago separado y congelado con moneda/tipo de cambio | No convertir silenciosamente el costo de un insumo cuya ficha tiene otra moneda. |
| Idempotencia | Solicitudes por usuario, payload comparado y locks transaccionales | La futura orden mixta debe abarcar todos los destinos con una única confirmación. |

La tabla de catálogo permite representar una ficha sin movimientos, pero **el formulario y RPC actuales no ofrecen crear solo ficha con saldo 0**: requieren una entrada positiva. No confundir posibilidad estructural con función disponible.

### Costos, cargos e historial

- Orden actual: subtotal de productos + envío + otros cargos. No hay un cálculo fiscal separado de impuestos en el formulario inspeccionado; no presentar “otros cargos” como motor tributario.
- Repartos actuales: `per_unit` divide entre partidas/rollos; `by_value` según valor; `manual` por partida. El redondeo residual se ajusta en la última partida y la suma asignada debe coincidir con los cargos de cabecera.
- `landed_total` incluye producto y cargos; `filament_landed_cost` excluye el costo del spool del consumible. El spool no se suma dos veces.
- Insumos: entradas recalculan promedio ponderado; salidas usan el promedio vigente. Producción congela su costo y no lo recalcula al reponer stock.
- No existe vínculo que añada automáticamente el envío de una orden al costo de un insumo. Introducir un costo manual en “Entrada / compra” no prueba que ese movimiento tenga factura u orden.
- Las correcciones de compras de filamentos existentes son trazables según el contrato del repositorio. Eso **no** resuelve por sí solo una futura corrección de compra de insumos ya consumidos. No reutilizarla a ciegas.

## Riesgos y garantías: evidencia vs inferencia

**Confirmado por código, no por una ejecución nueva contra producción:**

- Ficha nueva + entrada de insumo se ejecutan en un RPC; un rechazo revierte ambas. Orden de filamentos nuevos + historial + partidas + pago se compone dentro de una transacción.
- Una orden mixta no existe hoy. No se encontró un flujo actual que guarde primero esa orden y luego sus insumos: falta el flujo completo, no es un fallo parcial observado.
- Insumos y movimientos tienen RLS por propietario, relación compuesta de dueño, permisos de lectura/inserción para autenticados y vista `security_invoker`. No hay permiso de edición/borrado para esos clientes en la migración inspeccionada.
- El trigger serializa movimientos por insumo y comprueba saldo incluso en inserciones directas. Producción bloquea insumos en orden estable. Las solicitudes repetidas recuperan el resultado; payload diferente se rechaza.
- El modal guarda la solicitud pendiente en `sessionStorage`, bloquea edición/cierre durante incertidumbre y ofrece reintentar. `saveSupply` solo actualiza el estado tras confirmación.

**Inferencias para la futura spec, no decisiones aprobadas:**

- Encadenar desde el navegador “crear orden” y “registrar insumo” en llamadas independientes introduciría riesgo de éxito parcial. La operación mixta debe definirse y verificarse del lado transaccional.
- “Por unidad” es ambiguo con dos rollos y 50 imanes: hoy significa por partida de rollo, no por cada objeto. No extender esa regla sin nombrarla y aprobarla.
- Mezclar moneda de compra y moneda fija del insumo requiere una política explícita; no sumar ni promediar monedas distintas.
- Una corrección de costo tras consumir stock necesita definir el efecto sobre saldo remanente y ajustes, manteniendo inmutables las corridas anteriores.

**Límite local/demo:** Compras tiene una rama local que crea rollos/orden en el estado del dispositivo. No ofrece garantías transaccionales de Postgres. Insumos exige sesión; los extras manuales de proyectos siguen disponibles sin control de stock. INV-03 no debe simular sincronización ni borrar esta distinción.

## UX: problemas de flujo confirmados, sin rediseño

- “Tu inventario” muestra filamentos, mientras Insumos está separado; Agregar no permite dar de alta un insumo. La integración propuesta debe resolver acceso y orientación, no rehacer la sidebar.
- “Entrada / compra” puede parecer una compra formal aunque solo registre stock. La futura UX debe distinguir entrada inicial, compra y ajuste.
- Alta obliga a entrada positiva: no cubre ficha vacía para preparar una receta o futura compra.
- Compras usa textos y campos exclusivos de rollos (“Filamento nuevo”, color, gramos, costo de spool); no basta cambiarles el título para soportar insumos.
- La búsqueda de insumos filtra nombre/categoría, pero el vacío depende del total del catálogo: con existencias y cero coincidencias no se muestra un mensaje específico de búsqueda sin resultados.
- Conservar `ModalFrame`: título enfocado al cambiar de vista, Tab contenido, devolución de foco y cierre bloqueado durante operaciones. No sustituirlo por formularios sueltos.
- En 320 px, la captura de Nueva orden muestra una secuencia vertical larga con scroll interior. En 390 px, Insumos sin sesión combina explicación, bloqueo y vacío de alta. Son baseline observable, no prueba de un bug de overflow ni de la usabilidad del alta autenticada.
- Reutilizar el patrón de acciones de Agregar y el detalle de líneas en Compras sin mezclar filamento, insumo y spool como si fueran lo mismo.

## Propuesta de alcance para la futura spec (no implementación aprobada)

### MUST

1. Acceso coherente a alta de filamento e insumo desde Inventario, conservando las funciones de spools y navegación aprobada.
2. Orden de una sola línea de insumo, de varios insumos, solo filamentos o mixta; sin exigir un filamento para comprar insumos.
3. Separar la creación de la ficha mediante un botón, como los spools, de la alimentación de existencias individual o por compra. Resolver en la spec si esa creación también puede abrirse dentro de Compras. No aumentar stock al agrupar una compra que ya lo ingresó.
4. La ficha incluye nombre, categoría, etiquetas, unidad de medida seleccionable y descripción. Diferenciar cantidad comprada, unidad y precio unitario para no confundir paquete con pieza.
5. Enlazar cada partida con su destino y movimiento/historial, conservando proveedor, fecha, moneda, cargos y costo recibido. Definir el contrato antes de crear tipos o tablas.
6. Confirmación atómica, reintentos seguros, aislamiento por usuario, concurrencia y rechazo íntegro si cualquier partida falla.
7. Política aprobada de prorrateo y corrección; historial inmutable y costos de producción anteriores congelados.
8. Mensajes y estados claros en móvil, sesión real y demo; cantidades/costos visibles antes de confirmar. Alinear las vistas de Insumos con los patrones visuales existentes de Compras, conforme al alcance visual aprobado abajo.

### OUT OF SCOPE propuesto

Market/API de proveedores, checkout externo, impuestos automáticos, múltiples almacenes, serialización/lotes complejos, conversión automática de unidades, integración AMS, inventario de productos impresos terminados, reposición automática, BOM nueva, migración a workspaces y rediseño global. La receta actual solo necesita conservar su vínculo con insumos; no se rediseña producción.

### Decisiones confirmadas por el fundador · 19 de octubre de 2026

1. **Ficha y existencias son acciones distintas.** Crear el insumo con un botón, siguiendo el patrón de creación de spools. Campos solicitados: nombre, categoría, etiquetas, unidad de medida y un área de descripción. Las existencias pueden alimentarse de forma individual/directa o mediante Compras, siguiendo la experiencia de filamentos. No interpretar “individual” como una única pieza. No se aprobó todavía una obligación de registrar compra al crear la ficha.
2. **Unidad elegida al crear.** Usar un select de tipos de unidad, no solamente texto libre. El fundador no confirmó aún reglas de fracciones: la diferencia propuesta es contar piezas (p. ej., 20 imanes) o medir material (p. ej., 1,5 metros de cable).
3. **Tres métodos de distribución del envío aprobados.** Por valor preseleccionado; partes iguales por línea; porcentaje personalizado que sume 100%. Una línea con 50 imanes cuenta como una línea en el reparto igualitario. Mostrar importe asignado y costo final antes de confirmar; conservar método e importes con la compra. No incluir reparto por peso en este bloque. El contrato actual de reparto manual por importes no se debe confundir con el nuevo ingreso por porcentajes ni cambiar retrospectivamente.
4. **Compras multimoneda, sin restringirlas a la moneda de la ficha.** Los insumos deben participar coherentemente en valoración/presupuesto del inventario, cotizaciones y total de inversión del taller, con el mismo criterio de producto solicitado para filamentos y resinas. Esto expresa dirección funcional: no confirma que todos esos módulos, ni el soporte de resinas, estén implementados. Conservar moneda/monto original y una conversión explícita trazable; no sumar monedas distintas ni recalcular silenciosamente históricos. La integración depende del contrato financiero, incluido FIN-01A.
5. **Compras, variación de precios y correcciones visibles.** Se necesita consultar el historial de compras, cómo varían los precios y corregir compras anteriores con trazabilidad. El mismo requisito debe comprobarse para filamentos; no se da por terminada toda la experiencia solo porque existan registros históricos. No borrar originales ni modificar silenciosamente costos de producción ya confirmados.

### Reglas propuestas que aún requieren cierre

- **Creación y entrada directa:** propuesta de ficha inicial con stock 0 y acción posterior para ingresar existencias. Confirmar si habrá acceso a “Crear insumo” dentro de Compras y cómo registrar costo conocido/desconocido de existencias previas sin inventar una factura. Etiquetas y descripción son nuevos requisitos; formato y obligatoriedad se definirán en la spec, no con contratos temporales.
- **Unidades y precisión:** propuesta de unidades, metros, gramos, kilogramos, mililitros y litros, más “otra”. Piezas enteras y materiales medibles con decimales es una recomendación, no aprobación recibida. No cambiar unidad de una ficha con historial ni introducir conversiones automáticas sin una regla explícita.
- **Detalles técnicos del reparto aprobado:** por valor calcula `importe de la línea / subtotal de productos × 100`, sobre el total de la línea, no la cantidad de objetos. Ejemplo: filamento de ₡20.000 e imanes de ₡5.000 representan 80% y 20%; con envío de ₡3.000 se asignan ₡2.400 y ₡600. La spec debe definir precisión de porcentajes y redondeo conservando exactamente el envío original. Si el subtotal es cero y hay envío, propuesta: pedir elegir partes iguales o porcentajes personalizados; nunca dividir por cero ni cambiar el método silenciosamente. También queda por precisar si otros cargos comparten el mismo reparto; no inferirlo de la aprobación específica del envío.
- **Valoración e inversión:** distinguir valor de existencias actuales, compras/inversión acumulada y costos consumidos. No sumarlos entre sí como si fueran montos independientes. Cotizar no consume stock ni debe volver a cargar un envío ya incluido en el costo. La moneda de presentación y los snapshots aplicables se cierran con el bloque financiero; no se amplían reportes/cotizaciones en este discovery.
- **Correcciones con consumo previo:** falta concretar qué correcciones de precio/cantidad estarán disponibles y cómo afectan el valor restante cuando ya se consumió una parte. Recomendación: revisión trazable con motivo y registro original conservado, sin stock negativo ni reescritura de corridas. Devoluciones comerciales completas no se consideran aprobadas por esta respuesta.

### Alcance visual aprobado · Insumos

El fundador identifica diferencias visuales entre estos modales y el resto de la app, citando Pedidos/Compras como referencia favorable. Para INV-03 se toma el componente existente de Compras como referencia verificable; la mención de Pedidos no acredita por sí sola que ese módulo esté implementado.

- Armonizar las vistas de lista, creación de ficha, entrada/ajuste e historial de Insumos con la jerarquía, espaciado, agrupación de campos, acciones y estados del producto existente.
- Reutilizar `ModalFrame`, tokens y componentes vigentes. No cambiar nombre, paleta, tipografía, sidebar ni rediseñar Compras para acomodar Insumos.
- El selector de distribución del envío y su resumen deben pertenecer visualmente al formulario de Compras, no crear otro estilo de modal.
- Mantener etiquetas claras, acciones principales/secundarias consistentes y confirmaciones/errores dentro del flujo. Preservar foco, teclado, bloqueos y borradores durante operaciones.
- Verificar las vistas afectadas en móvil y escritorio, incluyendo 320/390 px, cuando exista implementación. No crear una nueva propuesta de marca ni repetir mockups generales.

Esta aprobación suma consistencia visual al bloque; no elimina la coordinación de archivos compartidos ni aprueba contratos financieros pendientes. No hay cambio visual implementado en esta actualización documental.

### Secuencia propuesta, no autorización de implementación

1. Definir la ficha y las acciones de entrada directa/compra, conservando la UI aprobada.
2. Cerrar contratos de órdenes solo de insumos y mixtas, porcentajes, moneda e idempotencia; coordinar archivos compartidos antes de editar.
3. Resolver la experiencia de historial/precios/correcciones y sus efectos contables; verificar paridad con filamentos.
4. Integrar los resultados con valoración del taller y cotizaciones en bloques explícitos, sin presentar esos módulos como ya completados.

Ya está confirmado y no requiere volver a preguntarse: “otras piezas” son compradas, no impresas terminadas; los insumos pueden comprarse sin filamentos; pueden aumentar una misma ficha, no crear una por imán.

## Archivos probables de implementación futura y solapamientos

- UI: `components/add-actions-modal.tsx`, `components/supplies-modal.tsx`, `components/purchase-orders-modal.tsx` y coordinación en `app/page.tsx`. `components/projects-modal.tsx` solo si el contrato aprobado afecta su selector; no asumir refactor.
- Contratos/helpers: `lib/supplies.ts`, `lib/types.ts` y construcción local de orden en `app/page.tsx`.
- Datos: migración **nueva y aditiva**, sin modificar `20260829183000_purchase_orders.sql`, `20260910135214_purchase_order_new_filaments.sql` ni `20260928030951_supply_stock_projects.sql`. Su nombre y diseño no se deciden en discovery.
- Pruebas existentes para ampliar según riesgo: `tests/supplies.test.cjs`, `tests/supply-concurrency.cjs`, `tests/order-new-filaments.browser.cjs`, `tests/add-purchase-navigation.browser.cjs`; pruebas SQL dirigidas de órdenes mixtas cuando exista contrato.
- Documentación después de aprobación/implementación: spec correspondiente, secciones relevantes de ROADMAP/ATOMICITY y punto de continuidad. No se modifican aquí.

PR #33 sigue activo y modifica `lib/types.ts`, documentación financiera y ejecutor SQL compartido. La futura integración necesita coordinar esos archivos. PR #38 sigue activo en Perfil; no se modifica. Tampoco se toca la integración estacionada de perfiles de impresión ni la infraestructura de agentes. Este cierre solo escribe este informe y conserva sus imágenes.

## Baseline visual conservada

Capturas existentes del 7 de octubre, sin sesión y con datos demo; no representan una prueba nueva ni el estado autenticado de producción. Resoluciones registradas: 1440, 390 y 320 px. Carpeta: `assets/inv-03-2026-10-07/`.

| Vista | 1440 px | 390 px | 320 px |
| --- | --- | --- | --- |
| Inventario | [Ver](assets/inv-03-2026-10-07/inventario-1440.jpg) | [Ver](assets/inv-03-2026-10-07/inventario-390.jpg) | [Ver](assets/inv-03-2026-10-07/inventario-320.jpg) |
| Agregar | [Ver](assets/inv-03-2026-10-07/inventario-agregar-1440.jpg) | [Ver](assets/inv-03-2026-10-07/inventario-agregar-390.jpg) | [Ver](assets/inv-03-2026-10-07/inventario-agregar-320.jpg) |
| Insumos sin sesión | [Ver](assets/inv-03-2026-10-07/insumos-sin-sesion-1440.jpg) | [Ver](assets/inv-03-2026-10-07/insumos-sin-sesion-390.jpg) | [Ver](assets/inv-03-2026-10-07/insumos-sin-sesion-320.jpg) |
| Nuevo filamento | [Ver](assets/inv-03-2026-10-07/nuevo-filamento-1440.jpg) | [Ver](assets/inv-03-2026-10-07/nuevo-filamento-390.jpg) | [Ver](assets/inv-03-2026-10-07/nuevo-filamento-320.jpg) |
| Compras | [Ver](assets/inv-03-2026-10-07/compras-1440.jpg) | [Ver](assets/inv-03-2026-10-07/compras-390.jpg) | [Ver](assets/inv-03-2026-10-07/compras-320.jpg) |
| Nueva orden | [Ver](assets/inv-03-2026-10-07/nueva-orden-1440.jpg) | [Ver](assets/inv-03-2026-10-07/nueva-orden-390.jpg) | [Ver](assets/inv-03-2026-10-07/nueva-orden-320.jpg) |
| Orden: filamento nuevo | [Ver](assets/inv-03-2026-10-07/orden-filamento-nuevo-1440.jpg) | [Ver](assets/inv-03-2026-10-07/orden-filamento-nuevo-390.jpg) | [Ver](assets/inv-03-2026-10-07/orden-filamento-nuevo-320.jpg) |

## Verificación y límites del cierre

- Lectura dirigida de componentes, tipos, handlers y migraciones citados; contraste con la sección de insumos y órdenes de `ATOMICITY_AUDIT.md`. Sin auditoría global.
- Revisión visual de muestras conservadas: Inventario 1440, Nueva orden 320 e Insumos sin sesión 390. Sin recapturar ni repetir el recorrido anterior.
- Se comprueba existencia de las 21 imágenes enlazadas y whitespace del diff antes del commit.
- No se ejecuta build, nueva suite browser ni SQL: solo se documenta. Las pruebas SQL históricas descritas en ATOMICITY no se presentan como ejecutadas nuevamente.
- **Sin validación autenticada nueva:** alta, ajuste, historial y producción se describen por código. No se accedió a datos privados, enviaron correos ni hicieron escrituras en Supabase.
- Estado de migraciones y publicación de insumos en producción: no confirmado en este bloque; el punto de continuidad conserva esa deuda. No declarar listo para beta por existencia del código.

## Siguiente paso acotado

Cerrar las reglas pendientes (precisión/redondeo, unidades, entrada directa y correcciones con consumo), resolver el solapamiento FIN-01A y convertir la dirección funcional y visual confirmada en una spec de implementación. Los tres métodos de envío y su opción por defecto ya están aprobados; no volver a preguntarlos. El discovery queda respaldado sin PR, merge ni deploy manual, conforme al encargo original. No empezar la integración mixta con contratos temporales.
