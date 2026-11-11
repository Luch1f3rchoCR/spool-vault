# Entrada al piloto de Proper

## Evidencia histórica · 6 de octubre de 2026

Founder HQ recibió de Clientes & Piloto evidencia de un onboarding real completado. El 10 de noviembre se verificó en producción, mediante una consulta agregada con fecha local de Costa Rica, que hubo un registro de primer ingreso completado, una membresía activa, un correo confirmado y una bienvenida aceptada por el proveedor para esa misma cuenta. La aceptación del proveedor no acredita ubicación en la bandeja. Se omiten datos de la cuenta. La evidencia es histórica y la prueba en el dominio definitivo se registra por separado.

Print Izards tiene CONDITIONAL GO para contacto humano inmediato y NO-GO temporal para invitación formal mientras se cierran los P0.

## Dominio y prueba controlada

- Vercel sirve Proper por HTTPS en `properformakers.com`. GoDaddy publica el registro A `216.198.79.1` y ambos aliases de Vercel responden.
- Supabase Auth usa `https://properformakers.com/` como Site URL. Se comprobó después de recargar la configuración y se conservaron las cuatro redirecciones permitidas, incluidos ambos aliases de Vercel y localhost.
- Producción usa `Proper <hello@stonecollective.dev>` como remitente de bienvenida mediante Resend. El remitente visible y la llegada a Recibidos de Gmail se comprobaron con la cuenta de prueba.
- Purelymail verificó el dominio en la cuenta de Stone Collective. GoDaddy publica el TXT de propiedad y el MX `50 mailserver.purelymail.com.`. Founder HQ eligió `hola@properformakers.com` como buzón de contacto general y para probadores. El buzón figura en Users de Purelymail. El 11 de noviembre el titular confirmó el envío desde Gmail y la recepción en Webmail de Purelymail del correo de prueba enviado el día anterior. La prueba de acceso puede usar el Gmail autorizado por el titular.
### Prueba controlada · 11 de noviembre de 2026 (Costa Rica)

| Paso | Resultado |
| --- | --- |
| Reserva y bienvenida, 6:19 a. m. | Cuenta interna nueva autorizada. La bienvenida llegó a Recibidos de Gmail como `Proper <hello@stonecollective.dev>`. Su botón todavía apuntaba al alias de Vercel vigente al momento del envío. |
| Primer acceso, desde las 6:19 a. m. | La app solicitó el enlace desde el dominio oficial. Llegó el correo de confirmación y su enlace devolvió a `https://properformakers.com/`. |
| Cuestionario y activación | El formulario apareció en el primer ingreso. Se guardó y la app mostró el acceso activo. Supabase confirmó correo verificado, cuestionario completado, membresía activa y bienvenida aceptada. |
| Logout, promoción de Site URL y reingreso, desde las 6:23 a. m. | El cierre devolvió a la vista pública. Tras guardar y comprobar el nuevo Site URL, llegó un segundo correo con el enlace de acceso. Volvió al dominio oficial con la cuenta autenticada y sin repetir el cuestionario. |

**E2E PASS** para acceso y activación. El PR #86 lleva el botón y el enlace de futuras bienvenidas al dominio oficial. Queda pendiente desplegarlo y comprobar un correo generado por esa versión. El cambio de Site URL ya está aplicado. Print Izards permanece en NO-GO para invitación formal hasta que Founder HQ y Clientes & Piloto resuelvan Founder Personal y se verifique la bienvenida en el dominio final. No se contactó al candidato desde Desarrollo.

## Founder Personal · decisión pendiente de HQ y 02

La reserva crea una fila en `tester_memberships` con `plan_code = 'founder_personal_v1'` y `granted_at` en la reserva. El registro se vincula al usuario de correo verificado en `private.complete_tester_first_visit`, que guarda respuestas e impresoras y fija `activated_at` en la misma transacción. Desde ese momento `private.claim_tester_membership` puede devolver la membresía activa. La bienvenida hoy anuncia la licencia desde el inicio.

Cambio mínimo propuesto: mantener `activated_at` como señal de acceso y cuestionario completado, y agregar un marcador separado de otorgamiento Founder. Una operación administrativa idempotente, restringida a `app_admins`, registraría el otorgamiento una vez que HQ/02 confirme el criterio de piloto completado. La lectura y los textos de perfil, administración y bienvenida reflejarían el marcador de otorgamiento. `granted_at` histórico conserva su significado técnico de reserva.

Riesgos a validar: membresías activas históricas, confirmaciones simultáneas, reintentos y coherencia del lenguaje en correos y perfil. Antes de migrar se necesita una decisión explícita sobre el criterio de cierre y el tratamiento de licencias ya otorgadas. La propuesta no modifica datos ni política.
