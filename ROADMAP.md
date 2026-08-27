# Checklist de Spool Vault

Este archivo refleja lo que existe en el producto, no solamente ideas futuras.

## MVP operativo

- [x] Inventario real conectado a Supabase con autenticación y RLS.
- [x] Alta de filamentos con marca, material, línea, color, compra y costos.
- [x] Historial de compras y precios por rollo.
- [x] Registro de consumo con costo calculado y descuento de inventario.
- [x] QR y respaldo NFC cuando el navegador lo permite.
- [x] Separación entre filamento y spool físico reutilizable.
- [x] Registro, edición, asignación y liberación de spools.
- [x] Inactivación y reactivación de spools sin eliminar su historial.
- [x] Operaciones atómicas en Supabase para evitar estados cruzados.
- [x] Estados claros para inventario real, local, demo y error de conexión.

## Experiencia móvil y PWA

- [x] Navegación inferior móvil.
- [x] Accesos rápidos a inventario, pesaje y cuenta.
- [x] Manifest, service worker e instalación como PWA.
- [x] Icono y favicon propios de Spool Vault.
- [x] Login compacto en la franja superior.
- [x] Base de perfil y membresía futura.
- [ ] Prueba final de instalación en iPhone y Android reales.
- [ ] Splash e iconos PNG optimizados para cada plataforma.

## Peso y tara

- [x] Tara configurable por spool.
- [x] Pesaje rápido: peso total menos tara.
- [x] Vista previa del filamento calculado antes de guardar.
- [x] Referencia Bambu Lab de 254 g editable (213 g de spool + 41 g de cartón/NFC).
- [x] Ajuste manual disponible para casos especiales.
- [ ] Guardar por separado peso del spool y peso del cartón/NFC.
- [ ] Registrar historial de pesajes y margen de variación de la balanza.
- [ ] Marcar explícitamente rollos incorporados con saldo inicial.

## Siguiente bloque recomendado

- [ ] Completar branding: “by Stone Collective Dev”, About y Open Graph.
- [ ] Diseñar e implementar la calculadora de costo de impresión.
- [ ] Agregar parámetros configurables de electricidad, máquina, fallos y mano de obra.
- [ ] Crear proyectos/impresiones y asociar consumos reales.
- [ ] Agregar impresoras y costo por hora.

## Antes de comercializar

- [ ] Diseñar workspaces, miembros, roles y aislamiento por workspace.
- [ ] Migrar el inventario personal existente a un workspace sin perder datos.
- [ ] Revisar los avisos pendientes del asesor de seguridad de Supabase.
- [ ] Activar protección contra contraseñas filtradas si se incorpora login con contraseña.
- [ ] Definir planes y límites antes de integrar una pasarela de pago.
- [ ] Implementar respaldos, exportación y eliminación de cuenta.
