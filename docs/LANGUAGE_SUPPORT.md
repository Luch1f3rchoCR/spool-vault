# Idioma de la app · checklist pendiente

Solicitud reafirmada por el fundador el 29 de octubre de 2026. Español e inglés confirmados ese día; el 30 se confirmó que también deben traducirse las explicaciones y que monedas/tasas deben entenderse fuera de Costa Rica. Desarrolla el pendiente existente de «Multimoneda y perfil» en `ROADMAP.md`. El selector y la traducción global todavía no están implementados ni publicados.

## Resultado esperado

La persona puede elegir el idioma de la interfaz y conservar su elección. Cambian los textos y su presentación, sin alterar inventario, costos históricos, monedas, archivos o nombres ingresados por el usuario.

## Checklist de implementación

- [x] Confirmar idiomas iniciales: español (`es`) e inglés (`en`).
- [ ] Definir variantes regionales del usuario; la base conserva `es-CR` para la presentación española actual y usa `en` para inglés, sin inferir moneda o país.
- [ ] Definir comportamiento inicial, fallback y persistencia para cuenta autenticada y modo local/demo, conservando la interfaz española durante la transición.
- [ ] Reutilizar Perfil / Configuración para la elección de idioma, sin duplicar preferencias ni asociar automáticamente una moneda al idioma.
- [x] Preparar catálogo tipado español/inglés y formatos comunes con moneda ISO explícita; comprobaciones de integridad y parámetros.
- [ ] Migrar los módulos restantes; conservar marca, navegación y contratos de formularios. Impresoras, navegación, Inicio, resumen de Producción y formularios de Perfil/cuenta personal están preparados en ambos idiomas, sin selector global todavía.
- [ ] Incluir etiquetas, botones, ayudas, estados vacíos, confirmaciones, progreso, errores y textos de accesibilidad. Mantener códigos de error identificables sin exponer detalles internos.
- [ ] Adaptar fechas, números, cantidades y presentación de importes. Preservar monedas, unidades y significado de fechas/horas; cambiar idioma no convierte dinero.
- [ ] Verificar la entrada de decimales según la presentación elegida, sin reinterpretar o reescribir valores históricos, fechas de compra o cantidades guardadas.
- [ ] Revisar textos y plurales con personas que dominen cada idioma; definir cómo se informa una traducción faltante.
- [ ] Probar persistencia/fallback, teclado, lectores de pantalla y textos largos en 320/390 px y escritorio.
- [ ] Publicar por bloques verificados y registrar los módulos/idiomas disponibles; no anunciar toda la app traducida antes de completar el alcance aprobado.

## Decisiones pendientes y límites

Los idiomas iniciales ya están confirmados. Fallback final y almacenamiento de la preferencia siguen pendientes. No se añade un selector que active inglés mientras falten pantallas o ayudas por traducir.

No traducir automáticamente nombres de filamentos, proyectos, proveedores, notas o archivos del usuario. Correos y PDF/exportaciones requieren una decisión explícita sobre su idioma al abordar cada canal; no asumir que cambiar la interfaz los modifica.

`ROADMAP.md` permanece reservado por el PR #45 de Marketing. Este checklist mantiene la continuidad sin tocar sus archivos; integrar su referencia al roadmap cuando ese frente se libere.

## Primer bloque de implementación · 2026-10-30

Rama `feat/i18n-printer-foundation`, desde main `118d151`. `lib/i18n.ts` contiene el contrato común `AppLanguage`, el catálogo inicial, interpolación de texto sin HTML ni fallback silencioso entre idiomas, formatos de números/importes y presentación de pares cambiarios. La preferencia inválida se resuelve a español; no hay autodetección o persistencia nueva.

`PrinterManager` acepta el idioma del llamador y mantiene español por defecto. Se traducen lista, formulario, etiquetas, estados, placeholders, ayudas, mensajes de campos y ejemplo completo. Los nombres/notas del usuario se conservan. Los importes se muestran con código ISO, las opciones explican «CRC — Costa Rican colón» en inglés y el ejemplo local identifica explícitamente su moneda. No se modifican valores enviados, validaciones, cálculos o guardado.

El helper de tasa solo presenta el par y dirección, por ejemplo `1 USD = 465 CRC`; no obtiene tasas ni convierte dinero. Fecha, fuente y carácter estimado/confirmado deben acompañarlo al integrar las pantallas de conversión. Fechas, errores del servidor, mensajes de resultado y validación nativa del navegador no se dan por traducidos globalmente en este bloque.

Verificación: ocho pruebas unitarias en `tests/i18n.test.cjs` (catálogos completos, mismos parámetros, faltantes detectados, datos literales, código/moneda conservados, dirección de tasas y rechazo de valores inválidos), TypeScript, revisión del diff, `git diff --check` y un build. Fixture de navegador del componente real con React/SWC instalados, sin ruta nueva en la app: español e inglés en 320/390/1280 px; ayudas, guía por teclado, datos del usuario conservados, valores enviados y ajuste horizontal. Regresión del flujo español en Perfil/Proyectos con respuestas simuladas en los mismos tamaños. Sin conexiones/escrituras reales, correos o cambios de cuenta.

Scripts temporales: `/private/tmp/proper-printer-i18n-smoke.cjs` y `/private/tmp/proper-printer-i18n-regression.cjs`; evidencia `/private/tmp/proper-printer-{es,en}-{320,390,1280}.png`. La captura inglesa es una prueba aislada del componente, no una app ya traducida. El bloque se entrega en PR borrador para revisión, sin merge o publicación automática.

Siguiente integración: preferencia de idioma de cuenta/local y estado común; completar navegación, módulos, ayudas, resultados y errores antes de ofrecer inglés al usuario. El fundador autorizó expresamente tocar `app/page.tsx` y `components/account-community.tsx` para idiomas el 30 de octubre, conservando los cambios de enlaces y sin fusionar PR #55. Esta primera entrega no toca esos archivos, esquema, Supabase, agentes o documentación reservada por Marketing.


## Continuación del mismo PR #62 · navegación e Inicio

Se prepararon `AppNavigation`, `MobileNavigation`, `WorkspaceDashboard` y `ProductionOverview` para recibir el idioma, conservando español por defecto, los identificadores de secciones, destinos y callbacks. Incluye menús/etiquetas accesibles, saludo, tarjetas, actividad, estados vacíos, estados de impresión y singular/plural. Los nombres de personas, proveedores, proyectos y colores del usuario no se traducen. Sin cambios de CSS, marca o arquitectura de navegación.

`formatDate` distingue día calendario de instante: un `YYYY-MM-DD` conserva el día escrito, mientras un timestamp respeta la zona horaria del visor. Las fechas inválidas permanecen sin valor y se etiquetan en el idioma del módulo; no se normalizan o reescriben registros. Solo cambia presentación, no ordenación, cálculos o persistencia.

Verificación de este tramo: 12 pruebas unitarias acumuladas, TypeScript, diff y una compilación completa. Fixture con componentes reales en español/inglés × 320/390/1280 px, usando fuentes del build: etiquetas, estados vacíos/plurales, teclado/destinos, nombres conservados, día calendario y ausencia de mutación/desbordamiento. Regresión existente `tests/add-purchase-navigation.browser.cjs` aprobada sobre el build final en 320/390/1280 px. Tráfico externo bloqueado, datos ficticios y sin escrituras reales ni errores de página. Script temporal `/private/tmp/proper-workspace-i18n-smoke.cjs`, evidencia `/private/tmp/proper-workspace-{es,en}-{320,390,1280}.png`.

Límites: no se ofrece todavía selector o preferencia persistida; los llamadores de la app siguen usando español por defecto. El contenido financiero que llega como `inventoryValue`, encabezados externos, modales, mensajes de guardado/servidor y módulos restantes deben integrar sus propias traducciones antes de habilitar inglés global. No confundir la captura aislada de componentes con una app ya traducida. Este avance se respalda en el mismo PR #62; no crea otro PR ni publica cambios automáticamente. La integración específica de `app/page.tsx`/`account-community.tsx` ya está autorizada y continúa pendiente, preservando PR #55.


## Continuación · Perfil y tarifas · 2026-10-31

La base anterior se publicó en PR #62. El lote #45/#55/#62/#63/#64 quedó en main `3782c0d`, Vercel Production READY `dpl_7WTyErAKxF3dimPYLa3FAp9NidYv`; ambos alias públicos siguen activos, sin redirect. Las antiguas reservas de Marketing y URL quedan liberadas. No se instaló firmware en hardware.

`feat/i18n-profile-panel` prepara el encabezado/controles del panel, sus entradas a moneda/impresoras/tarifas, moneda y facturación y tarifas de impresión. Incluye explicaciones, placeholders, confirmación de guardado y accesibilidad; transmite el idioma al `PrinterManager` ya bilingüe. Español continúa por defecto. Los datos introducidos, monedas guardadas, borradores, restricciones, foco, callbacks y persistencia se conservan. La selección de moneda no convierte valores y la moneda de costos sigue siendo independiente de la base.

`AccountCommunity` conserva sus textos existentes con `lang="es"` explícito en su contenedor actual, sin wrappers o cambios de layout. Membresía, invitaciones, exportación, feedback, términos guardados y mensajes de servidor/guardado externos aún no están traducidos. Las validaciones nativas dependen del idioma del navegador. No habilitar todavía un selector global ni anunciar Perfil completo en inglés. La integración de preferencia/estado en `app/page.tsx` y `account-community.tsx` continúa pendiente; no se introdujo una preferencia o persistencia alternativa.

Verificación de este tramo: 12 pruebas de catálogo existentes, TypeScript, `git diff --check` y una compilación final. Regresión existente `tests/profile-currency-access.browser.cjs` aprobada en 320/390/1280 px (acceso, foco, borradores, CRC/USD/EUR, recarga y moneda de costos independiente). Fixture temporal de componentes reales en ES/EN × 320/390/1280 px, con fuentes DM Sans/Manrope del build: textos/ayudas, moneda explícita, datos originales, navegación y borradores, guardado rechazado/confirmado, tarifa cero, transmisión de idioma a impresoras y ajuste horizontal; sin errores de página. No se agregó una suite dedicada al repositorio. Script `/private/tmp/proper-profile-i18n-smoke.cjs`, capturas `/private/tmp/proper-profile-{es,en}-{320,390,1280}.png`. Tráfico externo bloqueado, callbacks simulados y sin cuentas, correos o escrituras reales.

Observación fuera del bloque: en el fixture, al abrir un formulario nuevo de impresora se puede perder el foco al desaparecer su botón de origen. La prueba de Escape enfoca explícitamente un campo del panel antes de comprobar la navegación; no certifica foco automático al crear una impresora. No se modificó ese comportamiento previo ni se verificó en producción.


## Continuación · Cuenta personal, aportes y respaldo · 2026-10-31

PR #65 publicado: main `e9efa8b`, Vercel Production READY `dpl_BisKbVGQgDTri4E5yK72PQ9GTswP`. Árbol idéntico al probado antes de fusionar; sin repetir build. Ambos dominios y manifests responden HTTPS 200 y apuntan al deployment verificado, sin redirect. No se repitió login/logout ni humo interactivo de producción; el navegador no estaba disponible.

`feat/i18n-account-personal` transmite el idioma de Perfil a `AccountCommunity`, manteniendo español por defecto. Prepara licencia/membresía personal, navegación a aportes y datos, formulario/listado de aportes, estados, fechas, explicaciones y confirmación de descarga JSON. Los mensajes propios usan claves de presentación en estado: cambiar idioma actualiza un error o confirmación visible sin recargar membresía ni repetir solicitudes. Se conserva request ID, bloqueo de doble envío, borradores, payloads, esquema/formato/nombre de archivo del respaldo y permisos existentes.

Los textos de usuarios y respuestas administrativas permanecen originales. Fechas/estados inválidos se etiquetan como no disponibles sin modificar registros. Los términos aprobados se muestran literalmente en español, con aviso explicativo en inglés; no se emite una nueva versión jurídica. Mensajes originales externos/administrativos se conservan identificados como originales, sin inventar su traducción ni su idioma. Administración, invitaciones y correos continúan en español y sus superficies declaran ese idioma. No se envían correos ni se alteran términos, membresías o configuración por cambiar idioma.

El selector/persistencia global, traducción de administración y mensajes externos y módulos restantes siguen pendientes; no anunciar toda la app en inglés. No se tocaron `app/page.tsx`, Supabase, agentes, cálculos o navegación global.

Verificación: 19 pruebas existentes de catálogo/formatos y bienvenidas, TypeScript, diff check y una compilación final de este bloque. Fixture temporal de componentes reales ES/EN × 320/390/1280 px con fuentes del build: términos y aportes originales, errores/estados/fechas traducidos, cambio de idioma sin reconsulta, respuesta perdida/reintento con el mismo ID, doble envío bloqueado, confirmación/limpieza de formulario, JSON sin cambios y ajuste horizontal. Script `/private/tmp/proper-account-i18n-smoke.cjs`; capturas `/private/tmp/proper-account-{es,en}-{320,390,1280}.png`. Sin suite nueva de browser en el repositorio ni tráfico externo real.

La regresión existente `tests/account-community.browser.cjs` también aprobó sus cinco escenarios: administrador 390 px, probador 390/320 px y administrador 1280/320 px, incluyendo reserva incierta, reintento, exportación, seguimiento, permisos y bienvenida aceptada/sin confirmar mediante respuestas simuladas. Sin correos ni escrituras reales.
