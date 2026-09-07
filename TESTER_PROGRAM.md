# Programa de probadores fundadores

El panel vive en Perfil / Tu espacio / Grupo de pruebas y solo aparece a las cuentas de `app_admins`. Los probadores comunes no pueden invitar, asignar licencias ni leer aportes ajenos. La administración no da acceso a sus inventarios.

## Estado para retomar · 7 de septiembre de 2026

- Implementación publicada en `https://spool-vault.vercel.app/`, PR #18, commit de producción `3dc9d5d`.
- Migraciones de licencias y bienvenidas aplicadas. Cuenta del propietario habilitada como administradora; los identificadores de acceso permanecen en la base, no en este documento.
- El propietario confirmó cuenta creada, dominio Verified y API key creada en Resend. Falta configurar las variables de Vercel y probar una entrega real.
- Remitente elegido: `Spool Vault <hello@stonecollective.dev>`; dominio registrado en GoDaddy, sin necesidad de alojamiento web.
- Próximo paso: conectar las variables privadas de correo en Vercel. Seguir el paso 3 de [RESEND_SETUP.md](./RESEND_SETUP.md).
- La última comprobación encontró cero invitaciones y cero envíos reales. La recepción real sigue pendiente.

Actualizar este estado y el checklist de correo al completar cada paso. No marcar un envío como entregado únicamente porque el proveedor lo aceptó.

## Licencia

`founder_personal_v1` representa acceso personal gratuito y sin vencimiento al inventario, compras, pesajes, etiquetas y proyectos de esta versión. No tiene renovación ni cobros recurrentes. El beneficio se vincula al usuario cuando abre Tu espacio con su correo verificado. Servicios externos y futuros planes adicionales quedan fuera de esta versión del beneficio. No se modifican los planes de cuentas existentes.

## Invitación

1. El administrador registra nombre, correo y datos opcionales del probador.
2. Se guardan juntos la licencia reservada y una bienvenida pendiente. Repetir el mismo correo recupera el alta original sin cambiar datos ni crear otra licencia.
3. Con correo configurado, puede enviar la bienvenida al guardar o desde el registro del probador.
4. Sin correo configurado, puede abrir el mensaje listo en su programa de correo. Esta acción no se marca como envío automático confirmado.
5. La bienvenida enlaza a `https://spool-vault.vercel.app/`; no lleva contraseñas ni tokens de acceso. El destinatario inicia sesión con el correo registrado.

## Remitente acordado

`Spool Vault <hello@stonecollective.dev>`.

El dominio está registrado en GoDaddy. No necesita alojamiento web para autenticar el correo. La web continúa en Vercel con su dirección actual.

Para activar el envío automático:

1. Crear o conectar una cuenta de Resend y agregar `stonecollective.dev` como dominio de envío.
2. Agregar en GoDaddy los registros exactos generados por Resend o usar su configuración automática de GoDaddy. No reemplazar registros de correo existentes del dominio sin revisar su propósito.
3. Confirmar que Resend indica dominio verificado. No se configura recepción de correo como parte de este bloque; un buzón o reenvío para `hello` es una configuración aparte.
4. Configurar en el servidor de Vercel `RESEND_API_KEY`, `WELCOME_EMAIL_FROM` y `SUPABASE_SECRET_KEY` (también se admite la clave antigua `SUPABASE_SERVICE_ROLE_KEY`). Ninguno lleva prefijo `NEXT_PUBLIC_` ni se guarda en Git.
5. Publicar/reiniciar el despliegue para cargar los secretos y hacer una invitación de prueba a una dirección autorizada.

El estado "aceptada para envío" confirma que Resend aceptó el mensaje; no asegura entrega. Si un intento permanece incierto más de 23 horas, revisar el registro del proveedor antes de intervenir. No se genera automáticamente otra bienvenida con otra clave. Los correos de acceso de Supabase todavía requieren configurar su SMTP por separado.

## Verificación

- `node --experimental-strip-types --test tests/tester-welcome.test.cjs`: plantilla, deduplicación y permisos del endpoint con proveedores simulados; no envía correos reales.
- `node tests/account-community.browser.cjs`: pruebas de navegador con Playwright disponible; admite `TEST_BROWSER_CHANNEL=msedge` y `TEST_BASE_URL`. Simula cuentas, invitaciones, respuestas perdidas y respaldo en móvil y escritorio.
- Los archivos en `supabase/tests/` crean datos temporales y terminan en rollback. Probar con las dos migraciones aplicadas.
- `npm run build` y `git diff --check` antes de publicar.

Referencias: [Vercel y correo](https://vercel.com/kb/guide/sending-emails-from-an-application-on-vercel), [Resend con GoDaddy](https://resend.com/docs/knowledge-base/godaddy), [idempotencia](https://resend.com/docs/dashboard/emails/idempotency-keys).
