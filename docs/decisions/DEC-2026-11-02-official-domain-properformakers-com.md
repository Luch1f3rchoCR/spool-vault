# DEC-2026-11-02 · properformakers.com como dominio oficial

- **Estado:** ACCEPTED
- **Fecha:** 2026-11-02
- **Frente:** Dirección / Infraestructura pública
- **Aprobador:** Founder HQ

## Contexto

Proper ya utilizaba `https://properformakers.vercel.app/` como URL pública principal durante la transición desde `https://spool-vault.vercel.app/`. Esa transición dejó Supabase Auth preparado para conservar orígenes anteriores mientras se valida uno nuevo y confirmó que la autenticación usa el origen del navegador como destino principal.

Founder HQ adquirió `properformakers.com` por 2 años. El costo base confirmado es **US$30.98**, más la parte proporcional de impuestos/tarifas de la compra conjunta; esa porción adicional no se inventa ni se estima en esta decisión.

## Decisión

1. **`properformakers.com` es el dominio oficial de Proper.**
2. La marca comercial sigue siendo **Proper.**; `properformakers` es namespace/dominio, no reemplazo del nombre ni del wordmark.
3. El hosting continúa en **Vercel** dentro de la estrategia actual del portafolio.
4. No contratar **Vercel Pro** ni servicios adicionales por esta migración.
5. `https://properformakers.vercel.app/` puede mantenerse como URL técnica/secundaria durante la transición.
6. La migración debe ser **aditiva y controlada**: primero verificar dominio/TLS y permitir el nuevo origen en autenticación; solo después promoverlo como Site URL y actualizar enlaces públicos activos.
7. No retirar de inmediato `properformakers.vercel.app`, `spool-vault.vercel.app` ni localhost de las Redirect URLs mientras existan pruebas, enlaces históricos o flujos pendientes que dependan de ellos.
8. No redirigir permanentemente los dominios anteriores hasta validar autenticación, logout/reingreso, onboarding de founder/testers, parámetros `?roll=...`, PWA y continuidad por origen.
9. No renombrar el proyecto Vercel, repositorio, proyecto Supabase ni identificadores técnicos como efecto colateral de esta decisión.

## Consecuencias

- Debe agregarse `properformakers.com` al proyecto Vercel existente y completar la configuración DNS/TLS antes de usarlo en correos o Auth.
- Supabase Auth debe aceptar el origen exacto del nuevo dominio antes de convertirlo en Site URL principal.
- Los magic links/OTP deben probarse en el nuevo origen; las plantillas actuales usan `{{ .ConfirmationURL }}` y no requieren inventar un callback nuevo.
- `lib/tester-welcome.ts` y las pruebas relacionadas deberán cambiar de `properformakers.vercel.app` a `properformakers.com` únicamente después de validar el dominio.
- Los payloads QR/NFC generados con orígenes anteriores siguen siendo válidos y no deben reescribirse.
- Sesión, caché, service worker y almacenamiento local son específicos por origen; un custom domain no migra automáticamente estado del navegador.
- `NEXT_PUBLIC_SITE_URL` efectivo de Vercel debe inspeccionarse y, si se cambia, requiere un nuevo deployment para quedar embebido en el bundle.
- El dominio pasa a formar parte de los costos operativos reales de Proper. El costo adicional proporcional de impuestos/tarifas queda pendiente hasta conocer el dato exacto.

## Orden de migración aprobado

1. Verificar el proyecto Vercel correcto y agregar `properformakers.com`.
2. Configurar DNS requerido por Vercel sin tocar registros de correo ajenos a esta migración.
3. Confirmar TLS/HTTPS, HTTP 200, assets, manifest y navegación pública.
4. Añadir `https://properformakers.com/**` a Redirect URLs de Supabase conservando los orígenes vigentes.
5. Probar OTP/magic link en el nuevo origen antes de cambiar Site URL.
6. Cambiar Supabase Site URL a `https://properformakers.com/`.
7. Revisar/cambiar `NEXT_PUBLIC_SITE_URL` de Production si corresponde y redeployar.
8. Actualizar enlaces públicos activos (bienvenida/copy link/placeholders) y sus pruebas.
9. Verificar login, logout, reingreso, onboarding nuevo, inventario autenticado, QR con parámetros y PWA.
10. Mantener `properformakers.vercel.app` como secundario durante la observación; evaluar redirects en una decisión posterior.

## Riesgos

- Magic links rechazados si el nuevo origen no está permitido antes de usarlo.
- Enlaces de bienvenida que apunten al dominio nuevo antes de que DNS/TLS/Auth estén listos.
- Sesiones y datos locales que no aparezcan automáticamente al cambiar de origen.
- PWA/service worker instalados por separado por origen.
- Ruptura de QR o links con parámetros si se introduce un redirect incorrecto.
- Cambios accidentales en DNS de correo de Stone/Resend si la configuración del dominio no se limita a los registros requeridos por Vercel.
- Desalineamiento entre Site URL de Supabase, `NEXT_PUBLIC_SITE_URL` de Vercel y el origen real del navegador.

## Pendientes

- Ejecutar la configuración del custom domain en Vercel.
- Configurar/verificar DNS y TLS.
- Inspeccionar el valor efectivo de `NEXT_PUBLIC_SITE_URL` en Production sin exponer secretos.
- Ejecutar la batería de Auth/onboarding en `properformakers.com`.
- Actualizar código y documentación activa después de validar el dominio.
- Definir posteriormente si los dominios anteriores redirigen o permanecen como aliases secundarios.
- Registrar la parte exacta de impuestos/tarifas cuando HQ disponga de ese desglose.

## Referencias

- `docs/PROPER_PUBLIC_URL_MIGRATION.md`
- `docs/STATUS.md`
- `docs/ROADMAP.md`
- `docs/WORKLOG.md`
- `lib/supabase.ts`
- `lib/tester-welcome.ts`
- `RESEND_SETUP.md`
- `TESTER_PROGRAM.md`
