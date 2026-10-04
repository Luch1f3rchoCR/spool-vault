# Acceso visible a moneda base

Fecha: 2026-10-04. Rama: `feat/profile-currency-access`.
Base: main `dac3f219d84740412b1a30bd839b1bc245f571fc`.

## Bloque terminado

Implementa el pendiente de ROADMAP: hacer más visible la selección de moneda
en Configuración sin duplicar la preferencia existente.

- Moneda y facturación es el primer acceso del panel, antes de membresía.
- Muestra la moneda del perfil confirmado, no la selección sin guardar.
- Si el borrador difiere, identifica explícitamente el cambio pendiente.
- Moneda base queda al principio del mismo formulario, con CRC/USD/EUR.
- La ayuda asociada al selector aclara que no se convierten compras ni
  reescriben históricos, y que las tarifas usan una moneda independiente.
- Conserva vistas separadas, foco al entrar/regresar, borradores, bloqueo
  durante operaciones y los mismos estilos. No hay rediseño transversal.

## Archivos

- `components/profile-panel.tsx`
- `tests/profile-currency-access.browser.cjs`
- Este documento.

No se modificaron persistencia, contratos, conversión, base de datos ni
infraestructura. Sin solapamiento con los archivos de PR #33/FIN-01A,
PR #34/agentes o las ramas respaldadas de bienvenida y perfiles.
ROADMAP, ATOMICITY_AUDIT y PROJECT_CONTEXT siguen intactos por reserva.

## Verificaciones

- `npm run build`: compilación y TypeScript aprobados.
- `node tests/profile-currency-access.browser.cjs`, con Playwright disponible
  mediante NODE_PATH: aprobado en 320, 390 y 1280 px.
- Pruebas: acceso visible sin desplazar, un solo acceso a moneda, teclado/foco,
  borrador conservado, moneda confirmada frente a pendiente, guardado y recarga
  de CRC/USD/EUR, conservación de facturación y moneda de costos independiente.
- Sin errores de página ni peticiones a servicios externos. Navegador aislado,
  inventario local vacío, sin cuenta real. No equivale a probar persistencia
  autenticada, cuyo código no se modificó.
- Capturas de prueba en `node_modules/.tools/profile-currency-access/`,
  ignoradas por Git. Inspección visual de inicio móvil/escritorio y formulario
  móvil; comprobación de ausencia de desbordamiento horizontal.
- `git diff --check`: aprobado.

Reproducción: compilar e iniciar la app en `127.0.0.1:3104`; ejecutar el archivo
dedicado con Playwright instalado/disponible. TEST_BASE_URL permite otro puerto
local; la prueba rechaza hosts externos y bloquea servicios remotos.

## Dependencias y hallazgo separado

Este acceso no requiere integración con FIN-01A ni perfiles de impresión.
Publicación y actualización del checklist compartido quedan para el cierre
coordinado; este tramo solo respalda una rama, sin merge ni despliegue solicitado.

Durante la prueba inicial desde demo se observó un comportamiento previo:
al guardar por primera vez, demo pasa a local y el panel se remonta por
`key={profile:${signedInUserId || dataMode}}` en `app/page.tsx`. Si se había
abierto desde Costos, vuelve a Tarifas y pierde el aviso interno de guardado,
aunque el aviso global confirma el guardado local. No se corrigió porque
`app/page.tsx` está reservado. La prueba final comienza directamente en local
para verificar este bloque sin mezclar aquella transición. Revisar esa
continuidad demo → local cuando se libere el archivo.
