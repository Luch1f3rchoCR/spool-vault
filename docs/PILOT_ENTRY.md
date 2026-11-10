# Entrada al piloto de Proper

## Evidencia histórica · 6 de octubre de 2026

Founder HQ recibió de Clientes & Piloto evidencia de un onboarding real completado. El 10 de noviembre se verificó en producción, mediante una consulta agregada con fecha local de Costa Rica, que hubo un registro de primer ingreso completado, una membresía activa, un correo confirmado y una bienvenida aceptada por el proveedor para esa misma cuenta. La aceptación del proveedor no acredita ubicación en la bandeja. Se omiten datos de la cuenta. La evidencia es histórica y la prueba en el dominio definitivo se registra por separado.

Print Izards tiene CONDITIONAL GO para contacto humano inmediato y NO-GO temporal para invitación formal mientras se cierran los P0.

## Dominio y prueba controlada

- Vercel aceptó y verificó `properformakers.com` en el proyecto existente de Proper. Los aliases de Vercel siguen disponibles. La zona autoritativa está en GoDaddy. Vercel reportó DNS externo sin configurar y recomendó el A `216.198.79.1` para el raíz. Validar el control de la zona, la propagación y HTTPS antes del cambio de Auth.
- Después de HTTPS, comprobar la URL de sitio, la lista de redirecciones y las plantillas de Auth. Agregar el origen exacto al listado conservando los orígenes vigentes. Validar el enlace en el dominio nuevo antes de promover la URL de sitio y cambiar enlaces de bienvenida. El remitente de bienvenida y el remitente de Auth se validan por separado.
- Bienvenida: se actualizó `WELCOME_EMAIL_FROM` de Production a `Proper <hello@stonecollective.dev>` manteniendo Resend y la dirección existentes. La recepción y el remitente observado en correo se verifican en la prueba controlada.
- Prueba con cuenta nueva autorizada por Founder HQ: reserva, correo de bienvenida, Auth, enlace de acceso, login, cuestionario, estado activo, logout y segundo login. Registrar hora, origen, resultado de cada paso y nombre visible del remitente. No guardar correos, enlaces de un solo uso ni tokens en el repositorio. No invitar al candidato desde Desarrollo.

## Founder Personal · decisión pendiente de HQ y 02

La reserva crea una fila en `tester_memberships` con `plan_code = 'founder_personal_v1'` y `granted_at` en la reserva. El registro se vincula al usuario de correo verificado en `private.complete_tester_first_visit`, que guarda respuestas e impresoras y fija `activated_at` en la misma transacción. Desde ese momento `private.claim_tester_membership` puede devolver la membresía activa. La bienvenida hoy anuncia la licencia desde el inicio.

Cambio mínimo propuesto: mantener `activated_at` como señal de acceso y cuestionario completado, y agregar un marcador separado de otorgamiento Founder. Una operación administrativa idempotente, restringida a `app_admins`, registraría el otorgamiento una vez que HQ/02 confirme el criterio de piloto completado. La lectura y los textos de perfil, administración y bienvenida reflejarían el marcador de otorgamiento. `granted_at` histórico conserva su significado técnico de reserva.

Riesgos a validar: membresías activas históricas, confirmaciones simultáneas, reintentos y coherencia del lenguaje en correos y perfil. Antes de migrar se necesita una decisión explícita sobre el criterio de cierre y el tratamiento de licencias ya otorgadas. La propuesta no modifica datos ni política.
