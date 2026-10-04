# Bienvenidas de probadores · nombre visible

Fecha: 2026-10-03. Rama: `fix/founder-welcome-brand`, desde main `dac3f21`.
Estado: implementado y verificado localmente; no publicado.

## Alcance

Cierra únicamente la coherencia del nombre en las bienvenidas, pendiente en
ROADMAP bajo el recorrido de incorporación de probadores. Usa Proper V1,
marca de trabajo aprobada; no constituye una nueva decisión de naming.

- Asunto, texto, encabezado, botón y firma de las nuevas bienvenidas dicen Proper.
- El envío automático y el enlace manual comparten `WELCOME_SUBJECT`.
- La vista previa existente recibe el mismo texto actualizado.
- No cambia diseño, colores, formulario, licencia ni alcance de beneficios.
- El enlace técnico sigue siendo `https://spool-vault.vercel.app/`.
- El remitente se conserva exactamente como se recibe de la configuración:
  si su nombre visible todavía dice Spool Vault, seguirá así hasta otro bloque.
- Los envíos ya preparados conservan su contenido congelado, incluso la marca
  anterior. No se reescriben ni reenvían; se preserva la idempotencia.

## Archivos del bloque

- `lib/tester-welcome.ts`
- `components/account-community.tsx` (solo importación y asunto del enlace manual)
- `tests/tester-welcome.test.cjs`
- Este documento.

## Verificación

- `node --test tests/tester-welcome.test.cjs`: 7 pruebas aprobadas.
  Incluyen nombre contra los tokens existentes, texto/HTML, enlace y remitente
  conservados, licencia, escape de datos y conexión del asunto manual.
  Las regresiones existentes comprueban autorización, reintentos y contenido
  congelado con servicios simulados.
- `npm run build`: aprobado, incluido TypeScript. El primer intento quedó
  bloqueado por la descarga de Google Fonts; el segundo, con acceso de red,
  compiló sin cambiar configuración.
- `git diff --check`: aprobado.
- Sin correos reales, escrituras de inventario ni cambios de infraestructura.
- No se realizó prueba de entrega en un cliente de correo real.

## Continuidad y límites

No requiere migraciones ni integración con FIN-01A o perfiles de impresión.
No se tocaron sus archivos reservados, los documentos compartidos de seguimiento
ni la infraestructura de agentes. Perfiles permanece en `497dd93`.

Publicación pendiente de autorización. Remitente/Reply-To, SMTP de autenticación,
entregabilidad y recorrido real de activación siguen siendo tareas separadas.
No declarar la beta validada por estas pruebas locales.
