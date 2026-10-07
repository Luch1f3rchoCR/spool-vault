# Proper · Migración de URL pública

Estado al 2026-10-06 (Costa Rica): **inventario terminado; migración externa pendiente, sin cambios aplicados**.

Rama: `chore/proper-public-url`. Base: `main` actualizado a `28e4a7d5864dad0439a79250b3282f266809e6a6`. El worktree estaba limpio antes del bloque. Solo se añade este documento; no se cambian URLs ejecutables a un dominio que todavía no está validado.

## Objetivo y límites

- Producto público: Proper. URL deseada: `https://properformakers.vercel.app/`.
- Conservar repositorio, identificadores técnicos y proyecto Supabase existentes.
- Mantener inicialmente `https://spool-vault.vercel.app/` operativo.
- No merge, despliegue de código, envío de correos, cambio de secretos ni renombre del proyecto Vercel en este bloque.
- No modificar `.agents/`, `AGENTS.md`, `skills-lock.json`, `docs/specs/`, infraestructura de agentes/UI, FIN-01A ni ramas pendientes de perfiles, moneda o bienvenida.

## Comprobaciones confirmadas

| Elemento | Resultado |
| --- | --- |
| Main remoto | `28e4a7d5864dad0439a79250b3282f266809e6a6`, coincide con la base local |
| PR abierto | #33, `feat/fin-01-historical-fx`; archivos reservados |
| Producción | Deployment `6845307250`, SHA de main arriba, estado `success`, creado `2026-10-04T19:01:36Z` |
| URL de ese deployment | `https://spool-vault-o5p8v3yp9-luch1-f3rcho-s-projects.vercel.app` |
| Dominio viejo | HTTP 200; no redirige al nuevo. Navegador muestra Proper, Inicio, navegación y aviso de modo local |
| Dominio deseado | HTTP 404, `DEPLOYMENT_NOT_FOUND`. **No demuestra disponibilidad ni propiedad** |
| Consola del humo de producción | Sin errores ni advertencias capturados en esa visita; no representa todos los flujos |
| Sesión administrativa Vercel | Dashboard lleva a login; CLI sin credenciales disponibles en la revisión |
| Sesión administrativa Supabase | URL Configuration termina en sign-in; configuración efectiva no inspeccionada |

No se solicitó ni leyó el valor de credenciales. No hay nuevo dominio confirmado, alias agregado, redirect, cambio de Auth, variable de entorno, remitente ni configuración Resend.

## Inventario de dependencias

| Área / ubicación | Dependencia y tratamiento |
| --- | --- |
| `lib/tester-welcome.ts:3` | `APP_URL` hardcodeado al dominio viejo; alimenta correo de bienvenida. **Reservado por founder-welcome**. Actualizar solo tras liberar/integrar esa rama y validar destino. |
| `components/account-community.tsx:281` | Copiar enlace de la app usa el dominio viejo. **Reservado por founder-welcome**. No cambiar ahora. |
| `tests/tester-welcome.test.cjs` | Expectativas del URL de bienvenida; coordinar con el mismo bloque reservado. |
| `app/page.tsx:4050` | Placeholder del escáner con el enlace viejo. Archivo reservado por integración de perfiles. Es ejemplo visible, no motivo para renombrar masivamente el archivo. |
| `app/page.tsx`, QR/NFC | Enlaces generados usan el origen actual; payload guardado puede conservar el origen antiguo. No invalidar etiquetas físicas existentes; preservar `?roll=...`. |
| `lib/supabase.ts:64`, `app/page.tsx:3297` | `getAuthRedirectUrl()` usa normalmente `window.location.origin`; como alternativas usa configuración pública y localhost. `signInWithOtp` envía `emailRedirectTo`. No se requiere inventar una ruta nueva de callback. Validar exactamente lo que genera en ambos dominios. |
| `.env.example`, `lib/supabase.ts:10-11` | `NEXT_PUBLIC_SITE_URL` y `NEXT_PUBLIC_VERCEL_URL`; el ejemplo usa localhost. Valores efectivos de Production/Preview **desconocidos**. La excepción de siteUrl local puede preferir vercelUrl: revisar host público sin exponer secretos. Cambiar variables puede requerir un nuevo despliegue, no autorizado aquí. |
| Supabase Auth | Site URL, Redirect URLs y plantillas efectivas **pendientes de lectura administrativa**. Conservar los orígenes válidos actuales y permitir el nuevo únicamente después de verificar control del dominio. No añadir comodines amplios. |
| Invitaciones/testers | Las nuevas bienvenidas dependen de APP_URL; los correos ya enviados siguen conteniendo el enlace viejo. No reenviar ni reescribir registros idempotentes para simular migración. Probar activación con cuenta de prueba consentida. |
| Resend / SMTP | La URL del contenido es independiente del remitente `hello@stonecollective.dev`. No cambiar DNS de correo, sender, claves ni asumir que Resend de bienvenida configura Supabase SMTP. Plantillas de Auth pendientes de inspección. |
| `app/manifest.ts` | Proper ya visible; start_url e iconos relativos. Revisar instalación/PWA en el nuevo origen, sin renombrar identificadores por estética. |
| `app/layout.tsx` | Metadatos visibles Proper, referencias relativas; no se encontró una URL vieja absoluta que requiera reemplazo aquí. |
| `next.config.mjs` | No define redirect del dominio viejo. No introducirlo antes de validar acceso y efectos por origen. |
| `public/sw.js` y almacenamiento del navegador | Caché, almacenamiento local y sesiones están asociados al origen. Un alias nuevo no traslada automáticamente datos locales ni sesión. No forzar a usuarios con datos no sincronizados fuera del origen viejo. |
| Vercel | Dominios/alias, proyecto efectivo, Git y variables requieren revisión administrativa. No se verificó que agregar el subdominio deseado esté permitido ni disponible. No renombrar el proyecto para intentar eludir esa comprobación. |
| `RESEND_SETUP.md:8`, `TESTER_PROGRAM.md:50` | Instrucciones públicas activas se actualizarán cuando el nuevo destino exista y esté probado. La referencia histórica de TESTER_PROGRAM al PR #18 debe conservarse como historia. |
| `PROJECT_CONTEXT.md`, `docs/chatgpt/` | Referencias de continuidad y contexto: distinguir instrucciones actuales de evidencia histórica antes de actualizar. PROJECT_CONTEXT sigue reservado. |
| `AGENTS.md` | Referencia técnica al humo de producción; archivo reservado, coordinar actualización posterior. |
| Pruebas y referencias históricas | No sustituir globalmente `spool-vault`: URLs de GitHub, ejemplos, evidencias de releases, package name y claves de almacenamiento pueden conservarlo legítimamente. |

## Solapamientos y dependencias

La URL real de bienvenida y la acción de copiar enlace necesitan archivos de `fix/founder-welcome-brand`; el placeholder del escáner está en `app/page.tsx`, reservado por perfiles. No se crearon wrappers, contratos temporales ni tipos duplicados para esquivar estas reservas.

FIN-01A / PR #33 no recibe cambios. Tampoco se modifican `ROADMAP.md`, `ATOMICITY_AUDIT.md`, ejecutores compartidos, `lib/types.ts` o infraestructura de agentes/UI. Este documento no depende de mergear sus cambios para ser útil.

## Secuencia segura para retomar

1. El fundador inicia sesión administrativa en Vercel y Supabase, sin compartir credenciales en el chat. Leer proyecto, dominios, alias, Site URL, Redirect URLs y plantillas de Auth actuales. Anotar valores públicos previos para reversión, nunca secretos.
2. En Vercel verificar disponibilidad/control de `properformakers.vercel.app` y posibilidad de asociarlo al despliegue de producción existente. Si requiere renombrar el proyecto o un despliegue nuevo, detener y explicar consecuencias antes de actuar.
3. Agregar el alias/dominio al despliegue existente solo si es una operación comprobada y segura. Verificar TLS, HTTP 200, assets, nombre Proper y navegación. No promover el enlace todavía.
4. Añadir las URLs exactas requeridas del nuevo origen a Auth conservando las del viejo. Inspeccionar plantillas antes de modificar Site URL: algunas usan fallback y otras RedirectTo. No cambiar a ciegas una plantilla que afecte confirmaciones existentes.
5. Con una cuenta de prueba autorizada, comprobar solicitud de enlace, destino de correo, verificación/activación, login, logout y reingreso. No usar un correo real de un tester sin acuerdo ni registrar datos reales de inventario.
6. Cuando se liberen las ramas reservadas, actualizar enlaces públicos activos y sus pruebas. Hacer build, diff check y commit/push en bloque separado; **esperar autorización para merge/despliegue de repo**. Los nuevos NEXT_PUBLIC incorporados al bundle no se consideran aplicados sin despliegue.
7. Verificar QR `?roll=...`, enlaces existentes, perfil, navegación y PWA en ambos dominios. Avisar que sesiones/datos locales no se transportan solos.
8. Evaluar redirect permanente del viejo al nuevo solo después de resolver continuidad de Auth, enlaces con parámetros/fragmentos y datos locales. Por ahora **no recomendado**. Mantener el viejo activo es un resultado deliberado, no un fallo.

No se recomienda renombrar todavía el proyecto Vercel. Cambiar nombre técnico no es necesario para la identidad visible y no se han comprobado sus efectos sobre alias, integración Git y referencias existentes.

## Verificación ejecutada y pendiente

Comandos relevantes ejecutados durante el bloque, desde el clon existente:

```sh
npm run build
git status --short --branch
git log -1 --format='%H %s'
git worktree list
git diff --check
gh pr list --state open --json number,title,headRefName
git ls-remote origin refs/heads/main refs/heads/chore/proper-public-url
gh api repos/Luch1f3rchoCR/spool-vault/deployments/6845307250/statuses --jq '.[] | {state,environment_url,created_at}'
curl -I --max-time 20 https://properformakers.vercel.app/
curl -I --max-time 20 https://spool-vault.vercel.app/
```

Build/TypeScript aprobaron en la base indicada durante la revisión; no hay cambio de código posterior, solo este documento. Se revisaron referencias con `rg` y diff. El humo de navegador no escribió datos ni envió correo. La comprobación de dominio nuevo es un diagnóstico de 404, **no un smoke test aprobado**.

Pendientes: disponibilidad y alta real en Vercel, configuración Auth/plantillas/variables efectiva, pruebas autenticadas, nuevo dominio operativo y modificación coordinada de enlaces reservados. No afirmar migración terminada hasta completar estos puntos. El dominio viejo continúa activo sin redirect al nuevo.

Guías consultadas: [Supabase Auth Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Vercel: agregar un dominio](https://vercel.com/docs/domains/working-with-domains/add-a-domain) y changelog de Supabase. Son referencia para la configuración; no evidencia de que se haya aplicado.
