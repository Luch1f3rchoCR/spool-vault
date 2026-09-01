# Checklist de Spool Vault

Este archivo refleja lo que existe en el producto, no solamente ideas futuras.

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
- [x] Fallback manual si cámara o permisos fallan.
- [ ] Validar flujo QR -> ficha -> Pesar en iPhone y Android reales.
- [ ] Prueba final de instalación en iPhone y Android reales.
- [ ] Splash e iconos PNG optimizados para cada plataforma.

## Peso y tara

- [x] Tara configurable por spool.
- [x] Pesaje rápido: peso total menos tara.
- [x] Acceso móvil de un toque para pesar sin buscar el formulario dentro del detalle.
- [x] Vista previa del filamento calculado antes de guardar.
- [x] Referencia Bambu Lab de 254 g editable (213 g de spool + 41 g de cartón/NFC).
- [x] Ajuste manual disponible para casos especiales.
- [x] Guardar por separado peso del spool y peso del cartón/NFC.
- [ ] Registrar historial de pesajes y margen de variación de la balanza.
- [ ] Marcar explícitamente rollos incorporados con saldo inicial.

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

- [ ] Derivar estados por gramos y porcentaje: disponible, bajo, casi agotado, residual y agotado.
- [ ] Preparar umbrales configurables por usuario.
- [ ] Separar valor de compra original de valor consumible restante.
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

- [ ] Completar branding: “by Stone Collective Dev”, About y Open Graph.
- [ ] Diseñar e implementar la calculadora de costo de impresión.
- [ ] Agregar parámetros configurables de electricidad, máquina, fallos y mano de obra.
- [ ] Crear proyectos/impresiones y asociar consumos reales.
- [ ] Agregar impresoras y costo por hora.

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

- [ ] Registrar impresoras, modelo, boquilla, ubicación y costo por hora.
- [ ] Diseñar un conector local seguro para la P1S; nunca guardar la clave LAN ni credenciales Bambu en texto plano en Supabase.
- [ ] Implementar primero sincronización de solo lectura: estado de impresión, archivo/tarea, tiempo y bandejas AMS.
- [ ] Mapear cada bandeja AMS a un rollo real de Spool Vault, incluyendo filamentos sin RFID o recargas.
- [ ] Conciliar el consumo reportado por el trabajo con el saldo del rollo sin descontar dos veces.
- [ ] Mantener el pesaje como fuente de verdad cuando el remanente del AMS sea desconocido o estimado.
- [ ] Posponer comandos de control y escritura del AMS hasta validar compatibilidad, permisos y cambios de firmware.

## Proyectos, producción y utilidad

- [ ] Crear proyectos con nombre, versiones, archivos STL/3MF privados, imagen, licencia y notas.
- [ ] Definir una receta por proyecto: filamentos, colores, gramos previstos, tiempo y cantidad de piezas.
- [ ] Registrar insumos adicionales como imanes, pines, tornillos, luces, pintura y empaque con cantidad y costo.
- [ ] Validar existencias antes de imprimir y sugerir ofertas del market cuando falte material.
- [ ] Crear corridas de producción con fecha, impresora, cantidad, resultado, duración y desperdicio.
- [ ] Asociar cada consumo real al rollo utilizado y descontarlo atómicamente al cerrar la corrida.
- [ ] Congelar en la corrida los costos de material, extras, electricidad, máquina, mano de obra y fallos.
- [ ] Permitir precio de venta, comisiones, envío e impuestos para calcular utilidad y margen sin falsa precisión.
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
