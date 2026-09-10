# Checklist de Spool Vault

Este archivo refleja lo que existe en el producto, no solamente ideas futuras.

El contexto transversal y las decisiones recientes se consultan en [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md). Las hipótesis de marca, clientes y negocio están separadas de las funciones implementadas.

## MVP operativo

- [x] Inventario real conectado a Supabase con autenticación y RLS.
- [x] Alta de filamentos con marca, material, línea, color, compra y costos.
- [x] Edición segura de la ficha del filamento sin reescribir compras, consumos ni pesajes históricos.
- [x] Historial de compras y precios por rollo.
- [x] Corrección trazable de compras desde modal, conservando el registro original.
- [x] Registro de consumo con costo calculado y descuento de inventario.
- [x] QR y respaldo NFC cuando el navegador lo permite.
- [x] Separación entre filamento y spool físico reutilizable.
- [x] Registro, edición, asignación y liberación de spools.
- [x] Inactivación y reactivación de spools sin eliminar su historial.
- [x] Operaciones atómicas para asignar, liberar, inactivar y reactivar spools.
- [x] Estados claros para inventario real, local, demo y error de conexión.
- [x] Datos demo visualmente marcados para que no parezcan inventario real.
- [x] Unificar + Agregar: nuevo filamento, crear spool y asignar spool; administración de spools desde el mismo acceso.
- [x] Separar creación, asignación e inventario de spools en vistas que conservan borradores mientras el modal está abierto.

## Integridad, atomicidad y UX segura

- [x] Auditar las escrituras actuales y separar operaciones atómicas de flujos de varios pasos.
- [x] Confirmar que el inventario real no contiene compras huérfanas, rollos sin historial esperado ni spools con estados cruzados.
- [x] Mantener consumo + descuento del rollo dentro de una sola transacción mediante trigger.
- [x] Crear rollo, resolver/crear proveedor y registrar compra en una sola función transaccional.
- [x] Agregar idempotencia a la creación de rollos/compras y al registro de consumos.
- [x] Extender idempotencia a altas/ediciones de spools y al historial de pesajes.
- [x] Bloquear temporalmente los botones de alta, consumo y peso, mostrando el estado en curso.
- [x] Eliminar los éxitos parciales del alta de rollos y recuperar operaciones cuyo resultado era incierto.
- [x] Guardar pesaje + actualización del saldo del rollo en una sola transacción.
- [x] Corregir una compra + actualizar el costo vigente del rollo en una sola transacción idempotente.
- [x] Impedir desde la base de datos que `filament_rolls.spool_id` y el estado del spool puedan quedar desincronizados.
- [x] Centralizar en la base de datos el estado derivado del rollo según gramos y umbral bajo.
- [x] Servir reportes financieros desde una vista consistente y protegida por RLS, evitando lecturas parciales entre varias tablas.
- [x] Revocar ejecución pública innecesaria de funciones internas y resolver esos avisos del asesor de seguridad.
- [x] Agregar índices faltantes para las relaciones de consumos, compras y proveedores.

## Experiencia móvil y PWA

- [x] Navegación inferior móvil.
- [x] Accesos rápidos a inventario, pesaje y cuenta.
- [x] Bandeja rápida de pesaje desde navegación móvil, con selección de rollo, tara y resultado previo.
- [x] Manifest, service worker e instalación como PWA.
- [x] Icono y favicon propios de Spool Vault.
- [x] Login compacto en la franja superior.
- [x] Base de perfil y membresía futura.
- [x] Escáner QR móvil desde la barra inferior para seleccionar rollo.
- [x] Decoder QR por canvas para iPhone cuando `BarcodeDetector` no existe.
- [x] Fallback manual si cámara o permisos fallan.
- [x] Acciones post-escaneo: ver ficha, pesar, registrar consumo y copiar link.
- [x] Crear rollo desde QR no registrado y vincular la etiqueta escaneada.
- [x] Reconocer etiquetas por payload guardado, no solamente por ID interno.
- [x] Copiar el contenido exacto de la etiqueta desde la ficha del rollo.
- [ ] Validar flujo QR -> ficha -> Pesar en iPhone y Android reales.
- [ ] Prueba final de instalación en iPhone y Android reales.
- [ ] Splash e iconos PNG optimizados para cada plataforma.

## Probadores fundadores

- [x] Licencia personal `founder_personal_v1`, gratuita, sin vencimiento y separada del perfil editable.
- [x] Administración privada por cuenta autorizada; sin acceso al inventario de otros usuarios.
- [x] Formulario de probadores con nombre, correo, país, impresoras, dispositivo, experiencia y enfoque de prueba.
- [x] Reserva atómica de licencia y registro de bienvenida; activación por correo verificado en Tu espacio.
- [x] Compartir ideas y errores, consultar estado y responder desde administración.
- [x] Mis datos: respaldo JSON consistente de la cuenta, sin truncar en 1.000 registros; no incluye archivos binarios ni restauración automática.
- [x] Vista previa de bienvenida y apertura en el correo del administrador como alternativa manual.
- [x] Envío automático preparado para Resend con remitente previsto `Spool Vault <hello@stonecollective.dev>`.
- [x] Pruebas de permisos, reintentos, errores de envío, exportación y pantalla móvil/escritorio.
- [x] Cuenta de Resend creada por el propietario (confirmado el 7 de septiembre de 2026).
- [x] `stonecollective.dev` figura Verified en Resend y API key creada (confirmado por el propietario).
- [x] Variables de correo cargadas por el propietario en Vercel Production y redeploy Ready confirmado por captura; valores privados no inspeccionados. Seguimiento de entrega en `RESEND_SETUP.md`.
- [x] Tu espacio como panel lateral, con vistas independientes para ideas, datos, probadores, facturación y tarifas; regreso al menú sin perder borradores durante la sesión del panel.
- [x] Implementar confirmación visible de invitaciones: limpiar el formulario solo tras éxito confirmado y enfocar la ficha guardada; conservar borrador ante respuesta incierta. Regresión simulada aprobada en 320/390/1280 px; publicación rastreable mediante el PR de `fix/invitation-confirmation`.
- [x] Confirmar recepción real de una bienvenida: el fundador la recibió en Gmail/spam el 7 de septiembre.
- [ ] Probar enlace/activación de esa bienvenida e investigar llegada a spam antes de ampliar invitaciones.
- [ ] Configurar correo de autenticación de Supabase para resolver los límites del remitente predeterminado.
- [ ] Confirmar alcance comercial definitivo del beneficio founder-v1 antes de ampliarlo.

## Peso y tara

- [x] Tara configurable por spool.
- [x] Pesaje rápido: peso total menos tara.
- [x] Acceso móvil de un toque para pesar sin buscar el formulario dentro del detalle.
- [x] Vista previa del filamento calculado antes de guardar.
- [x] Referencia Bambu Lab de 254 g editable (213 g de spool + 41 g de cartón/NFC).
- [x] Ajuste manual disponible para casos especiales.
- [x] Guardar por separado peso del spool y peso del cartón/NFC.
- [x] Registrar historial de pesajes y margen de variación de la balanza.
- [x] Marcar explícitamente rollos incorporados con saldo inicial.

## Catálogo de tipos de spool

- [x] Crear tipos de spool reutilizables con fabricante, modelo, material, fotografía y notas.
- [x] Separar peso del spool, insert/cartón/RFID/NFC y tara total.
- [x] Registrar fuente y confianza de la tara: Verificada, Estimada o Desconocida.
- [x] Incluir como referencias iniciales Bambu Lab 254 g verificada, Pritonic plástico 250 g estimada y Pritonic cartón 170 g estimada.
- [x] Asociar cada spool físico con un tipo de spool sin perder la tara manual actual.
- [x] Conservar en cada pesaje una copia de la tara utilizada; editar el catálogo solo afectará pesajes futuros.
- [ ] Ofrecer una recalculación histórica únicamente como acción explícita, nunca automática.

## Pesajes confiables

- [x] Registrar peso bruto de balanza, tara aplicada, filamento calculado y confianza.
- [x] Mostrar claramente que el peso bruto incluye spool e insert y no equivale a filamento disponible.
- [x] Crear historial de pesajes por rollo.
- [x] Aplicar límites seguros para evitar resultados negativos o superiores al peso inicial del rollo.

## Compras, proveedores y costos

- [x] Separar la compra/orden de sus productos mediante encabezado y partidas.
- [x] Mostrar compras agrupadas como tarjetas de encabezado y abrir sus líneas y cargos congelados en un modal de detalle.
- [x] Guardar envío/express y otros cargos en la compra, no directamente en el filamento.
- [x] Prorratear envío por unidad, por valor o manualmente; usar por unidad como valor inicial.
- [x] Marcar confianza del costo como Real, Estimado o Incompleto.
- [x] Permitir el supuesto histórico visible de ₡3.000 por orden y ₡1.000 por rollo cuando falte el express.
- [x] Mantener historial de proveedor y precio por compra, aunque el mismo filamento cambie de proveedor o costo.
- [x] Mantener el historial de compras inmutable desde el cliente.
- [x] Diseñar una corrección financiera trazable sin reescribir el registro original.
- [x] Permitir registrar una compra faltante para un rollo ya creado, sin inventar ni reescribir historial.
- [x] Exponer “Corregir compra” y “Registrar compra faltante” desde el detalle del filamento.
- [x] Marcar visiblemente los rollos cuyo costo está incompleto y guiarlos a su corrección.

## Multimoneda y perfil

- [x] Agregar moneda base al perfil; usar CRC como preferencia inicial.
- [x] Conservar monto y moneda originales, monto y moneda realmente pagados y su relación cambiaria.
- [x] Guardar tipo de cambio, fecha, fuente y clase: Real, Histórico, Actual, Manual o Estimado.
- [x] Dar prioridad al monto realmente pagado sobre una conversión calculada.
- [x] Evitar cualquier suma directa entre CRC y USD.
- [x] Mostrar totales separados por moneda o un total convertido claramente identificado.
- [x] Mantener fijo el costo histórico aunque cambie el tipo de cambio actual.

## Color y procedencia

- [ ] Guardar fuente del HEX como Oficial, Estimada o Personalizada.
- [ ] No presentar colores estimados desde fotografías como oficiales.
- [ ] Permitir corregir el HEX conservando su procedencia.

## Estados y valor de inventario

- [x] Derivar estados por gramos y porcentaje: disponible, bajo, casi agotado, residual y agotado.
- [ ] Preparar umbrales configurables por usuario.
- [x] Separar valor de compra original de valor consumible restante.
- [ ] Indicar conversiones estimadas, costos incompletos y nivel de confianza sin falsa precisión.

## Reportería

- [x] Crear el reporte “Saldo de filamentos” con inventario, tara, compra, proveedor, moneda, ubicación y etiquetas QR/NFC.
- [ ] Mostrar valores originales y convertidos como columnas separadas.
- [x] Preparar exportación CSV como primer formato, con protección contra fórmulas maliciosas.
- [ ] Agregar posteriormente exportación Excel y PDF.

## Migración segura del inventario existente

- [x] Implementar únicamente migraciones aditivas en las primeras fases.
- [x] No volver a insertar automáticamente el inventario usado como referencia durante el levantamiento.
- [x] Mantener compatibilidad temporal con `purchase_history`, `tare_weight_g` y los formularios actuales.
- [ ] Respaldar la tara y el costo utilizados históricamente antes de introducir catálogos o conversiones.
- [x] Probar políticas RLS y permisos de cada tabla y función nueva.
- [x] Ejecutar build, pruebas locales y humo en producción en cada fase cerrada.

## Orden incremental recomendado

- [x] Fase 0: cerrar permisos internos, índices, idempotencia y la creación atómica de rollo + compra.
- [x] Fase 1: catálogo de tipos de spool, pesajes históricos y tara congelada por medición.
- [x] Fase 2: compras con partidas, express prorrateado, confianza de costos y multimoneda.
- [ ] Fase 3: fuente HEX, moneda base, estados derivados y reporte de saldo.
- [ ] Fase 4: retomar experiencia de producto y módulos de crecimiento.

## Experiencia y módulos siguientes

- [ ] Revisar detalles de Stone Collective CR y artes en borrador que aportará el fundador; confirmar relación/nombre de marca antes de completar branding, About y Open Graph.
- [x] Preparar contexto portátil e instrucciones para proyecto propio de ChatGPT en `docs/chatgpt/`.
- [ ] Crear el proyecto privado Spool Vault, cargar fuentes y abrir chats de Dirección, Marca, Clientes, Marketing, Negocio y Desarrollo/QA.
- [ ] Aprobar brief de marca después de revisar Stone Collective CR y los artes aportados.
- [ ] Validar cliente inicial mediante entrevistas y tareas del piloto, sin dar los segmentos propuestos por confirmados.
- [ ] Comparar modelos de negocio y costos antes de fijar precios o integrar cobros.
- [ ] Preparar marketing basado en funciones reales y público validado, con aprobación previa a publicaciones o gasto.
- [ ] Diseñar e implementar la calculadora de costo de impresión.
- [x] Agregar parámetros configurables de electricidad, máquina, fallos y mano de obra.
- [x] Crear proyectos/impresiones y asociar consumos reales.
- [ ] Agregar impresoras y costo por hora. Implementación local; pendiente de validación de base y publicación.

Continuidad Mac · 9 de septiembre: trabajo recuperado en `feat/printer-profiles-safe`, sobre main `558a636` (PR #22). El respaldo anterior sigue en stash. Las migraciones `printer_cost_safety` y `tester_first_visit` son locales, NO aplicadas. No publicar esta rama hasta validar la base: se detectó un descuento duplicado entre la función de producción y el trigger de consumos; la corrección no modifica saldos históricos.

- [ ] Primer ingreso de probadores: cuestionario único tras verificar correo, con experiencia, hobby/profesional, uso y múltiples impresoras. Implementado localmente; falta validación de base y publicación.
- [ ] Separar motivo y enfoque de invitación (solo administración) de respuestas del invitado.
- [ ] Administrar las mismas impresoras desde Perfil → Mis impresoras; sin conexión ni consumo automático todavía.
- [ ] Completar un alta real de punta a punta con el primer invitado antes de convocar al resto.
- [x] Validar localmente desde cero las migraciones, permisos, reintentos y corrección del doble descuento, sin datos personales.
- [ ] Aplicar las migraciones nuevas y publicar el bloque de primer ingreso antes de enviar la primera invitación.
- [ ] Siguiente bloque solicitado: crear filamentos nuevos desde las líneas de una orden, además de vincular compras existentes. Confirmar orden, rollos, costos e historial juntos; reintentar sin duplicarlos ni sumar monedas distintas.

## Market de proveedores

- [ ] Separar los proveedores personales del usuario de los comercios publicados en el market.
- [ ] Crear un catálogo canónico para comparar la misma variante por marca, material, línea, color, peso y presentación con/sin spool.
- [ ] Mostrar “Dónde comprar” con precio, moneda, disponibilidad, entrega, retiro y fecha de actualización.
- [ ] Iniciar con enlaces referidos hacia el checkout del proveedor y seguimiento de clics respetuoso de la privacidad.
- [ ] Diseñar un portal o carga CSV/API para que cada proveedor mantenga precios y existencias sin depender de scraping.
- [ ] Definir ingresos iniciales por comisión referida, oportunidad enviada, plan de proveedor o posición patrocinada claramente identificada.
- [ ] Validar el piloto comercial con Pritonic, Maker Store y al menos otro proveedor costarricense.
- [ ] Evaluar checkout dentro de Spool Vault solamente después de resolver pagos, facturación, devoluciones, contracargos, reserva de inventario y soporte.

## Impresoras y AMS

- [ ] Registrar impresoras, modelo, boquilla, ubicación y costo por hora. Pendiente de publicar el bloque local.
- [ ] Diseñar un conector local seguro para la P1S; nunca guardar la clave LAN ni credenciales Bambu en texto plano en Supabase.
- [ ] Implementar primero sincronización de solo lectura: estado de impresión, archivo/tarea, tiempo y bandejas AMS.
- [ ] Mapear cada bandeja AMS a un rollo real de Spool Vault, incluyendo filamentos sin RFID o recargas.
- [ ] Conciliar el consumo reportado por el trabajo con el saldo del rollo sin descontar dos veces.
- [ ] Mantener el pesaje como fuente de verdad cuando el remanente del AMS sea desconocido o estimado.
- [ ] Posponer comandos de control y escritura del AMS hasta validar compatibilidad, permisos y cambios de firmware.

## Proyectos, producción y utilidad

- [x] Crear proyectos con nombre, versión, archivo STL/3MF privado, licencia y notas.
- [ ] Agregar imagen de portada por proyecto.
- [x] Definir una receta por proyecto con filamentos, colores, gramos previstos y tiempo.
- [x] Registrar insumos adicionales como imanes, pines, tornillos, luces, pintura y empaque con cantidad y costo.
- [x] Validar existencias antes de cerrar una impresión.
- [ ] Sugerir ofertas del market cuando falte material.
- [x] Crear corridas de producción con fecha, cantidad, resultado y duración.
- [ ] Incorporar la impresora utilizada y congelarla en cada corrida. Pendiente de validar y publicar.
- [ ] Registrar desperdicio separado del consumo útil.
- [x] Asociar cada consumo real al rollo utilizado y descontarlo atómicamente al cerrar la corrida.
- [x] Congelar en la corrida los costos de material y extras según el lote realmente usado.
- [x] Agregar electricidad, máquina, mano de obra y fallos al costo congelado.
- [x] Permitir precio de venta y utilidad básica sin mezclar monedas ni inventar costos incompletos.
- [ ] Incorporar comisiones, envío, impuestos y margen final.
- [ ] Dar recomendaciones accionables: precio insuficiente, inventario bajo, exceso de desperdicio y necesidad de reposición.

## Antes de comercializar

- [ ] Diseñar workspaces, miembros, roles y aislamiento por workspace.
- [ ] Migrar el inventario personal existente a un workspace sin perder datos.
- [ ] Revisar los avisos pendientes del asesor de seguridad de Supabase.
- [ ] Activar protección contra contraseñas filtradas si se incorpora login con contraseña.
- [ ] Definir planes y límites antes de integrar una pasarela de pago.
- [ ] Implementar respaldos, exportación y eliminación de cuenta.
- [ ] Definir términos para proveedores, política de anuncios y responsabilidad sobre precio/stock mostrado.
- [ ] Revisar con asesoría local facturación, protección al consumidor, privacidad y tratamiento de pagos antes de ofrecer checkout nativo.
