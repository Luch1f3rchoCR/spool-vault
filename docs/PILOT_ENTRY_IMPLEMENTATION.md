# Cierre técnico de la entrada al piloto

## Impacto previsto antes de la migración

- La invitación y el cuestionario siguen usando los RPC existentes. `activated_at` marca el inicio del piloto y conserva el acceso normal de la cuenta. Los 14 días cuentan desde ese momento. La app no cierra cuentas ni borra datos al terminar el plazo.
- Un campo nuevo `founder_granted_at` indica el otorgamiento definitivo y `founder_granted_by` registra el administrador que lo confirmó. Se conservan los beneficios de membresías históricas ya activadas usando su fecha de activación. Las reservas pendientes quedan sin beneficio. `granted_at`, `granted_by` y `plan_code` históricos conservan su función de reserva.
- Un administrador podrá confirmar el otorgamiento tras revisar la participación y una vez transcurridos 14 días. La base comprueba permisos y antigüedad, bloquea la fila y devuelve el mismo resultado en reintentos. El calendario por sí solo no otorga beneficios.
- El acceso a datos, el cuestionario transaccional, los permisos de inventario, la exportación existente y los registros de envío conservan sus contratos. No se reenvían bienvenidas ni se alteran los payloads congelados.
- Desplegar la UI antes de habilitar el siguiente ingreso de piloto, junto con la migración, y probar ambas versiones en ventana controlada. Una UI antigua interpreta `activated_at` como Founder. Si hay rollback de la UI, pausar las nuevas invitaciones del piloto y conservar los otorgamientos registrados.

## Correo

Usar la misma plantilla de acceso para confirmación inicial y magic link de reingreso. Conservar el enlace de verificación generado por Supabase, su caducidad y el retorno al origen permitido. El wordmark textual mantiene la marca visible con imágenes bloqueadas. La bienvenida explica el piloto con una motivación pública general, sin publicar las notas privadas de administración.

Verificar SMTP efectivo, dominio, Reply-To, seguimiento desactivado y entrega a una cuenta nueva antes de abrir el piloto. La prueba anterior en Gmail no acredita por sí sola entrega a destinatarios externos. No guardar credenciales, enlaces de acceso ni datos de la cuenta de prueba en este repositorio.

### Publicación y prueba final

1. En [SMTP Settings](https://supabase.com/dashboard/project/xbeqmfgiekcyoqevlypi/auth/smtp), configurar Resend para Auth. Nombre visible `Proper`, remitente `hello@stonecollective.dev`, host `smtp.resend.com`, puerto `465`, usuario `resend`. La clave dedicada con permiso de envío se ingresa en el panel. En Resend, comprobar que el dominio de envío esté verificado y que el seguimiento de clics y aperturas esté desactivado antes de enviar enlaces de un solo uso.
2. Aplicar `supabase/templates/proper-access.html` a **Confirm sign up** y **Magic link or OTP**, con asunto «Tu enlace para entrar a Proper». Registrar el valor previo de asunto/cuerpo para reversión. Conservar la caducidad, Site URL y destinos permitidos. La bienvenida de la app conserva el From de Resend y añade `Reply-To: hola@properformakers.com`. Para Auth, comprobar el Reply-To efectivo en Gmail. La plantilla muestra el buzón de contacto aun cuando SMTP no permita configurar Reply-To.
3. Verificar la migración con los datos de producción en una transacción revertida. Aplicarla con trazabilidad cuando esté listo el despliegue de app, revisar asesores y comprobar las membresías activas preservadas. Verificar la app publicada antes de reservar al siguiente participante.
4. Con una cuenta interna nueva autorizada, verificar invitación, llegada a Gmail, botón de bienvenida, primer correo de acceso, retorno al dominio oficial, cuestionario, piloto activo, cierre de sesión y reingreso. Comprobar que `founder_granted_at` siga vacío. Verificar en Gmail el remitente, Reply-To, CTA y el comportamiento de un enlace reutilizado y uno vencido. Registrar cliente móvil, modo oscuro e imágenes bloqueadas por separado del render HTML.
5. Si falla el envío, conservar el diagnóstico del proveedor sin registrar el enlace de acceso y revertir las plantillas o SMTP al valor previo según la causa. Mantener la invitación formal en NO-GO hasta completar las pruebas.

### Validación de esta rama

El panel de Supabase confirma que el SMTP predeterminado bloquea la personalización. Las plantillas están preparadas en el repositorio. En producción se encontraron tres membresías activadas y una reserva vigente. La migración conservará las tres membresías activadas y dejará la reserva sin otorgamiento.

Verificaciones locales: suite aislada de PostgreSQL (activación, rechazo a usuarios comunes, rechazo antes de 14 días y reintento idempotente), ocho pruebas de correo, build y pruebas de onboarding y perfil con servicios simulados. Render de ambas plantillas a 320, 390 y 760 px con recursos remotos bloqueados, incluido modo oscuro a 390 px. El render no reemplaza las pruebas de Gmail.

Quedan pendientes SMTP, aplicación de las plantillas y la migración, despliegue y prueba real con una cuenta nueva.
