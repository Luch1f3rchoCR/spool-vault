# Entrada al piloto de Proper

## Evidencia histórica · 6 de octubre de 2026

Founder HQ recibió de Clientes & Piloto evidencia de un onboarding real completado. El 10 de noviembre se verificó en producción, mediante una consulta agregada con fecha local de Costa Rica, que hubo un registro de primer ingreso completado, una membresía activa, un correo confirmado y una bienvenida aceptada por el proveedor para esa misma cuenta. La aceptación del proveedor no acredita ubicación en la bandeja. Se omiten datos de la cuenta. La evidencia es histórica y la prueba en el dominio definitivo se registra por separado.

Print Izards tiene CONDITIONAL GO para contacto humano inmediato y NO-GO temporal para invitación formal mientras se cierran los P0.

## Dominio y prueba controlada

- Vercel sirve Proper por HTTPS en `properformakers.com`. GoDaddy publica el registro A `216.198.79.1` y ambos aliases de Vercel responden.
- Supabase Auth permite el destino exacto `https://properformakers.com/` y conserva sus tres redirecciones anteriores. Site URL y los enlaces de bienvenida usan aún `https://properformakers.vercel.app/`. Antes de promover el nuevo destino, falta comprobar el enlace de acceso en el dominio oficial.
- Producción usa `Proper <hello@stonecollective.dev>` como remitente de bienvenida mediante Resend. La recepción y el remitente observado se verifican durante la prueba controlada.
- Purelymail verificó el dominio en la cuenta de Stone Collective. GoDaddy publica el TXT de propiedad y el MX `50 mailserver.purelymail.com.`. Founder HQ eligió `hola@properformakers.com` como buzón de contacto general y para probadores. El formulario está preparado en Safari y falta que el titular configure la contraseña y guarde el buzón. La prueba de acceso puede usar el Gmail autorizado por el titular.
- Prueba con cuenta nueva autorizada por Founder HQ: reserva, correo de bienvenida, Auth, enlace de acceso, login, cuestionario, estado activo, logout y segundo login. Registrar hora, origen, resultado de cada paso y nombre visible del remitente. No guardar correos, enlaces de un solo uso ni tokens en el repositorio. No invitar al candidato desde Desarrollo.

## Founder Personal · decisión pendiente de HQ y 02

La reserva crea una fila en `tester_memberships` con `plan_code = 'founder_personal_v1'` y `granted_at` en la reserva. El registro se vincula al usuario de correo verificado en `private.complete_tester_first_visit`, que guarda respuestas e impresoras y fija `activated_at` en la misma transacción. Desde ese momento `private.claim_tester_membership` puede devolver la membresía activa. La bienvenida hoy anuncia la licencia desde el inicio.

Cambio mínimo propuesto: mantener `activated_at` como señal de acceso y cuestionario completado, y agregar un marcador separado de otorgamiento Founder. Una operación administrativa idempotente, restringida a `app_admins`, registraría el otorgamiento una vez que HQ/02 confirme el criterio de piloto completado. La lectura y los textos de perfil, administración y bienvenida reflejarían el marcador de otorgamiento. `granted_at` histórico conserva su significado técnico de reserva.

Riesgos a validar: membresías activas históricas, confirmaciones simultáneas, reintentos y coherencia del lenguaje en correos y perfil. Antes de migrar se necesita una decisión explícita sobre el criterio de cierre y el tratamiento de licencias ya otorgadas. La propuesta no modifica datos ni política.
