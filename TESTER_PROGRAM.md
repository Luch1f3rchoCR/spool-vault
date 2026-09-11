# Programa de probadores fundadores

El panel vive en Perfil / Tu espacio / Grupo de pruebas y solo aparece a las cuentas de `app_admins`. Los probadores comunes no pueden invitar, asignar licencias ni leer aportes ajenos. La administración no da acceso a sus inventarios.

Tu espacio abre un panel lateral en computadora y ocupa la pantalla en celular. El menú se reemplaza por la vista elegida, sin desplegar formularios debajo. La flecha vuelve al menú y conserva los borradores mientras el panel siga abierto. Escape vuelve al menú desde una sección y cierra desde el inicio; la X cierra el panel. El encabezado permanece visible al desplazar el contenido y la navegación se bloquea durante un guardado o envío.

## Estado para retomar · 9 de septiembre de 2026

### Primer ingreso publicado · PR #23

El primer ingreso está publicado en Vercel Production (`a431c42`), con las dos migraciones nuevas aplicadas:

1. Administración registra nombre, correo, motivo de invitación y pruebas previstas. Las notas son solo administrativas.
2. La bienvenida dirige a la app; no contiene un token de autenticación.
3. La persona solicita su enlace seguro con el mismo correo de la invitación y lo verifica.
4. Solo si tiene una invitación pendiente, completa nombre, país opcional, experiencia, uso hobby/profesional/ambos, propósito, dispositivo y una lista de impresoras (puede ser vacía).
5. Guardar respuestas, crear las impresoras y activar la membresía debe confirmar como una sola transacción. Repetir la solicitud no crea impresoras adicionales.
6. En ingresos siguientes no se pide nuevamente. Las cuentas ya activas conservan su acceso sin encuesta retroactiva.
7. Perfil → Mis impresoras administra el equipo actual; las respuestas iniciales permanecen como registro del ingreso.

No se solicita contraseña LAN, API key ni conexión automática a impresoras. La futura integración deberá usar estas mismas fichas, con identificación de eventos y prevención de consumo duplicado.

**Listo para la primera invitación controlada:** migraciones aplicadas, asesores revisados, PR fusionado y despliegue exacto confirmado. Se verificó la corrección del doble descuento sin alterar saldos históricos. Realizar el alta real con el primer invitado antes de enviar invitaciones al resto; todavía no se confirmó su activación ni la entrega de ambos correos. No se enviaron mensajes durante esta publicación.

La información histórica de correo que sigue no confirma el recorrido real del nuevo formulario.

Verificación del 9 de septiembre: compilación aprobada; recorridos simulados de primer ingreso y Perfil aprobados en 320/390/1280 px, incluyendo respuesta perdida, varias impresoras, borrador conservado, inactivación y recarga sin repetir cuestionario. Regresión de administración y aportes aprobada en cuatro escenarios; cinco pruebas de bienvenida/endpoint aprobadas sin enviar correos. También pasaron las pruebas SQL de primer ingreso y costos, junto con la regresión previa de licencias y bienvenida. Humo sin sesión en producción: proyectos e impresoras disponibles, consola sin errores. Pendiente: invitación real de punta a punta.

Laboratorio local: contenedor descartable PostgreSQL 17, sin red ni puertos y sin datos reales. tests/local-database.cjs verifica que sea el contenedor etiquetado y esté vacío; instala contratos mínimos de Auth/Storage para pruebas SQL, aplica todo el esquema y ejecuta las regresiones. Quedaron cero usuarios de prueba al finalizar. Esto NO prueba SMTP, verificación por correo, Storage HTTP ni PostgREST. No se repitió la prueba SQL bloqueada en producción.

- Implementación publicada en `https://spool-vault.vercel.app/`, PR #18, commit de producción `3dc9d5d`.
- Migraciones de licencias y bienvenidas aplicadas. Cuenta del propietario habilitada como administradora; los identificadores de acceso permanecen en la base, no en este documento.
- El propietario confirmó dominio Verified y mostró la carga de variables en Vercel Production y el redeploy Ready de `cc30c41`. Las credenciales efectivas no fueron inspeccionadas; posteriormente confirmó la primera recepción real en spam.
- Remitente elegido: `Spool Vault <hello@stonecollective.dev>`; dominio registrado en GoDaddy, sin necesidad de alojamiento web.
- Próximo paso: probar enlace/activación y revisar entrega a spam. Seguir el paso 4 de [RESEND_SETUP.md](./RESEND_SETUP.md).
- Primera bienvenida real recibida por el fundador en Gmail, dentro de spam, el 7 de septiembre. Remitente y diseño confirmados por captura. No equivale a entregabilidad general ni confirma la activación de esa prueba.

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
- `node tests/tester-first-visit.browser.cjs`: primera visita, varias impresoras, respuesta perdida, edición desde Perfil y recarga sin repetir formulario; servicios simulados. Para aislar las pruebas locales, compilar con las tres variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` vacías solo en ese proceso; no editar `.env.local`. Las pruebas suministran configuración ficticia.
- Los archivos en `supabase/tests/` crean datos temporales y terminan en rollback. Probar con las dos migraciones aplicadas.
- `npm run build` y `git diff --check` antes de publicar.

Referencias: [Vercel y correo](https://vercel.com/kb/guide/sending-emails-from-an-application-on-vercel), [Resend con GoDaddy](https://resend.com/docs/knowledge-base/godaddy), [idempotencia](https://resend.com/docs/dashboard/emails/idempotency-keys).
