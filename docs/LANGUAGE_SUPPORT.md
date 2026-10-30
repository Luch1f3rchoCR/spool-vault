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
- [ ] Migrar los módulos restantes; conservar marca, navegación y contratos de formularios. Impresoras es el primer componente preparado en ambos idiomas, sin selector global todavía.
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
