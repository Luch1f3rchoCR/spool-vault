# Correo de Spool Vault

## Decisiones confirmadas

- Servicio de envío automático: Resend. El propietario confirmó la creación de la cuenta el 7 de septiembre de 2026.
- Dominio: `stonecollective.dev`, registrado en GoDaddy.
- Remitente: `Spool Vault <hello@stonecollective.dev>`.
- La aplicación continúa en `https://spool-vault.vercel.app/`. No se requiere contratar hosting web para configurar el correo.
- Se verificará el dominio raíz para usar exactamente `hello@stonecollective.dev`. La propuesta anterior `hello@correo.stonecollective.dev` no es el remitente elegido.
- Primero se habilita envío. Recibir respuestas en `hello` mediante buzón o reenvío es una tarea separada.

## Checklist de configuración

- [x] Cuenta de Resend creada (confirmado por el propietario).
- [ ] Dominio agregado en Resend.
- [ ] Registros de envío configurados en GoDaddy.
- [ ] Resend muestra el dominio como Verified.
- [ ] Clave de Resend creada para la app y guardada directamente en Vercel.
- [ ] Remitente y clave privada de Supabase configurados en el servidor de Vercel.
- [ ] Nuevo despliegue de producción con las variables cargadas.
- [ ] Invitación de prueba autorizada: correo recibido y enlace probado.
- [ ] Correo de inicio de sesión de Supabase configurado y probado por separado.
- [ ] Decidir buzón, reenvío o Reply-To para las respuestas a `hello`.

Punto actual: entrar en Domains de Resend y agregar el dominio. Ningún estado posterior está confirmado todavía. Registrar aquí las confirmaciones, no las claves privadas.

## 1. Agregar el dominio

1. Abrir [Domains en Resend](https://resend.com/domains).
2. Pulsar Add Domain e introducir `stonecollective.dev`, sin protocolo, rutas ni dirección de correo.
3. Mantener la región predeterminada salvo una necesidad específica.
4. Agregar el dominio y abrir su configuración. Habilitar envío; dejar recepción desactivada por ahora.

## 2. Configurar GoDaddy

Si aparece Auto Configure, Resend permite autorizar la configuración de los registros mediante GoDaddy. Revisar que el dominio seleccionado sea `stonecollective.dev` y que los cambios correspondan al envío.

Para hacerlo manualmente:

1. Abrir la administración DNS de `stonecollective.dev` en GoDaddy.
2. Agregar los registros exactos de envío mostrados por Resend: DKIM y SPF, incluyendo el MX de retorno de envío cuando lo solicite.
3. Copiar tipo, nombre, valor y prioridad desde la pantalla de esa cuenta. No usar claves DKIM ni destinos de ejemplo tomados de la documentación.
4. GoDaddy agrega el dominio al nombre: si Resend muestra `resend._domainkey.stonecollective.dev`, el nombre relativo es `resend._domainkey`; si muestra `send.stonecollective.dev`, es `send`. Confirmar el nombre final para no duplicar el dominio.
5. Conservar los registros web y de correo existentes. Los registros de envío no requieren activar recepción ni reemplazar los MX del dominio raíz.
6. Volver a Resend, pulsar Verify DNS Records y esperar Verified. Si continúa pendiente, revisar los registros y su propagación antes de duplicarlos.

## 3. Conectar el envío automático

Después de verificar el dominio, crear una clave de Resend para Spool Vault con permiso de envío y alcance al dominio elegido cuando la interfaz lo permita. Guardarla directamente en la configuración de variables de Vercel; no compartirla en el chat ni incluirla en Git.

En el proyecto Spool Vault de Vercel, configurar para Production:

| Variable | Valor o propósito |
| --- | --- |
| `RESEND_API_KEY` | Clave privada de envío de Resend. |
| `WELCOME_EMAIL_FROM` | `Spool Vault <hello@stonecollective.dev>` |
| `SUPABASE_SECRET_KEY` | Clave privada del proyecto Supabase para el endpoint del servidor. También se admite `SUPABASE_SERVICE_ROLE_KEY` si se utiliza la clave anterior. |

No usar el prefijo `NEXT_PUBLIC_` en estas variables. La clave pública existente de Supabase no reemplaza la clave privada del servidor. No se necesitan secretos de producción en los previews para esta guía.

Hacer un nuevo despliegue de producción después de configurar las variables. La app comprueba la presencia de la configuración; esa comprobación no garantiza por sí sola que el dominio esté verificado ni que el proveedor acepte la clave.

## 4. Prueba real

1. Entrar como administrador en Tu espacio / Grupo de pruebas.
2. Usar una dirección de prueba autorizada. Revisar destinatario y vista previa antes de enviar.
3. Guardar el probador y enviar la bienvenida. Distinguir licencia reservada, aceptación por el servicio de correo y recepción real.
4. Confirmar recepción, remitente `hello@stonecollective.dev` y que el enlace abre la app de producción.
5. Iniciar sesión con el correo registrado y abrir Tu espacio para activar la licencia.
6. Registrar fecha y resultado sin copiar tokens, contenido privado o claves a la documentación.

Hasta configurar Resend, la alternativa Abrir bienvenida en mi correo prepara un mensaje en el programa de correo del administrador. No marca el mensaje como enviado automáticamente.

## 5. Correo de acceso y respuestas

Las bienvenidas de la app y los enlaces de acceso de Supabase son envíos distintos. Conectar Resend en Vercel no modifica el SMTP de Supabase ni elimina sus límites de correo predeterminado. Configurar y probar ese envío en un paso posterior.

Verificar el dominio para enviar como `hello` tampoco crea un buzón para leer respuestas. La recepción o un Reply-To se debe decidir y configurar por separado.

## Referencias

- [Resend: configuración de GoDaddy](https://resend.com/docs/knowledge-base/godaddy).
- [Resend: dominios verificados](https://resend.com/docs/dashboard/domains/introduction).
- [Resend: direcciones de remitente](https://resend.com/docs/knowledge-base/how-do-I-create-an-email-address-or-sender-in-resend).

La referencia del producto y sus permisos está en [TESTER_PROGRAM.md](./TESTER_PROGRAM.md). El avance global está en [ROADMAP.md](./ROADMAP.md).
