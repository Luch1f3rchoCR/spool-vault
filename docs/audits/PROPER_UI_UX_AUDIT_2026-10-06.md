# Proper · Auditoría UI/UX

Fecha de cierre: 6 de octubre de 2026, Costa Rica. Base: `main` / `28e4a7d5864dad0439a79250b3282f266809e6a6`.

**Dictamen: refinamiento dirigido.** La marca y la navegación aprobada son una base válida. Los problemas principales son de jerarquía operativa, comportamiento de contenedores y consistencia, no de identidad. Ninguna recomendación de este informe está implementada ni aprobada automáticamente.

## Alcance y evidencia

Se inspeccionó la aplicación compilada en `http://127.0.0.1:3105/`, en escritorio amplio (1440 px) y móvil de 390 y 320 px. Se revisaron Inicio, Inventario, alta de filamento, Compras, alta de orden, Proyectos, alta de proyecto, Producción vacía, Spools, Reportes, acceso, perfil/configuración y el estado sin sesión de Insumos. Se abrieron formularios sin guardarlos y se probaron recorridos de teclado. Se contrastaron observaciones con los componentes reales.

La revisión local utiliza datos demo/locales y no una cuenta autenticada. No se modificó inventario real ni se enviaron correos. El humo final de producción confirmó título Proper, navegación lateral, contenido de Inicio y aviso de modo local; no aparecieron errores ni advertencias en la consola capturada de esa visita. Esto no sustituye una prueba autenticada.

Limitaciones: no se ejercitaron altas autenticadas de Insumos, administración/founder onboarding, proyectos poblados ni impresión con datos reales. No se certifican WCAG, lector de pantalla, zoom al 200 %, Safari/iPhone físico ni todos los estados de error y guardado. Los hallazgos de código están identificados como tales. Las capturas se inspeccionaron durante la sesión; no se adjuntan archivos de screenshots a este informe.

Se leyeron `AGENTS.md`, la skill `frontend-design`, `docs/BRAND_STATUS.md` y `docs/UI_DELIVERY.md`. La skill ayudó a cuestionar repetición de contenedores y decoración; no reemplazó decisiones de marca. No se cambiaron código, tokens, formularios ni infraestructura.

## 1. Qué funciona muy bien y conviene conservar

- **La estructura lateral aprobada.** Tu taller / Organización / Herramientas ordena un producto que está creciendo. Los accesos móviles y Más son una adaptación útil, no hace falta empezar otra navegación desde cero.
- **Marca cálida y contenida.** Warm Canvas, superficies blancas, verde funcional y el wordmark se sienten tranquilos y apropiados para acompañar una actividad maker sin parecer una consola industrial.
- **Información física del material.** Color, gramos, spool y confianza de la tara explican objetos reales del taller. Son más propios de Proper que cualquier ilustración decorativa.
- **Agregar reúne tareas concretas.** Nuevo filamento, Crear spool y Asignar spool forman un acceso comprensible. Mantener esa distinción evita confundir consumible y soporte reutilizable.
- **Tu espacio y ModalFrame tienen un patrón más consistente.** El panel de perfil conserva su orientación y el modal de nuevo filamento contiene el foco al tabular. Es una referencia interna para alinear excepciones.
- **Honestidad sobre los datos.** Avisos demo/local, costo incompleto y operaciones no disponibles evitan confundir una cifra con una confirmación real. Hay que ordenar su peso visual, no ocultar su significado.
- **Acciones vinculadas al trabajo.** Registrar impresión debe seguir siendo principal; variantes y cotización son secundarias. No sustituir esto por un embudo comercial obligatorio.

## 2. Problemas encontrados por pantalla/componente

Prioridades: P1 = obstáculo de acceso/operación; P2 = fricción frecuente; P3 = refinamiento.

| Prioridad | Pantalla / referencia | Evidencia | Recomendación y valor específico para Proper |
| --- | --- | --- | --- |
| P1 | Acceso · `app/globals.css:131`, `app/page.tsx:3454` | A 320 px, `#login-panel` mide 296 px pero empieza en x=-120 y termina en x=176. El encabezado envuelve el botón y el popover queda recortado a la izquierda. A 390 px comienza aproximadamente en x=-1. Reproducido localmente; contenido sin configuración, mismo contenedor de acceso. | Contener el panel dentro del viewport con márgenes seguros. La invitación de un beta tester no puede culminar en un acceso cortado en su teléfono. Confirmar también la variante configurada de producción. |
| P1 | Reportes · `components/inventory-report-modal.tsx:101` | Al abrir, el foco permanece en el botón Reportes de la navegación. Desde Descargar CSV, Tab sale del diálogo y termina en body. El componente declara diálogo modal pero no usa el manejo de foco del patrón común. | Alinear entrada, recorrido, cierre y devolución del foco con ModalFrame. La consulta de stock debe poder hacerse con teclado sin quedar detrás de una capa bloqueante. |
| P2 | Inventario · métricas y filtros en `app/page.tsx` | Siete métricas, encabezado, Agregar y avisos preceden los rollos. A 390×844 no aparece un rollo en la primera pantalla. El aviso demo aumenta el problema, pero no explica toda la altura. | Priorizar encontrar material y revisar saldo; relegar métricas secundarias. Proper se usa para localizar un color o pesar un rollo, no solo contemplar indicadores. |
| P2 | Nueva orden · `components/purchase-orders-modal.tsx:310`, `app/globals.css:797` | El formulario es un grid de dos columnas con un solo fieldset hijo. En escritorio ambos pasos quedan en la mitad izquierda y la derecha vacía. | Corregir esa distribución específica. Aprovechar el espacio para ingresar una compra con varias líneas reduce desplazamientos sin tocar su transacción ni su cálculo. |
| P2 | Spools · bloque modal en `app/page.tsx` | Crear/asignar conserva métricas y pestañas con bastante altura antes del primer campo; en 320 px las pestañas se reparten en filas. Asignar sin spools disponibles termina con controles deshabilitados. | Reservar el resumen para la lista y dar una salida contextual a Crear spool. Ayuda a completar la tarea física actual en vez de recorrer un panel administrativo. |
| P2 | Nuevo filamento / Nuevo proyecto | Muchos campos tienen idéntico peso visual. Se midieron aproximadamente 1711 px de contenido en alta de filamento y 1625 px en proyecto a 320 px. Proyecto añade avisos antes de los campos y duplica jerarquía de títulos. | Agrupar los campos existentes por tarea y distinguir opcionales. No eliminar datos ni inventar un nuevo flujo: primero identificar material/receta, después completar detalles. |
| P2 | Filtros y captura de consumo · `app/page.tsx`; búsqueda de Reportes | Los dos selectores de inventario se anuncian como Todos sin distinguir marca/material. Hay campos apoyados solo en placeholder en búsqueda/consumo. | Nombres accesibles y etiquetas persistentes. Disminuye ambigüedad cuando se comparan materiales o se registra consumo, aun sin usar lector de pantalla. |
| P2 | Reporte en móvil · `.report-table-wrap` | Tabla de alrededor de 1000 px dentro de unos 316 px. No desborda el documento, pero valores y proveedor quedan fuera de la primera vista y el desplazamiento no resulta evidente. | Mantener tabla completa en escritorio/CSV; en móvil priorizar identidad/saldo y acceso inequívoco al resto, con identificación persistente. Evita comparar el importe del rollo equivocado. |
| P2 | Proyectos vacío | Impresoras, Nuevo proyecto y Crear primer proyecto compiten como acciones verdes. | Una acción principal para empezar la receta, gestión de impresoras secundaria. La configuración no debería distraer de preparar una impresión. |
| P3 | Compras / Insumos vacíos | Compras explica compras históricas aunque un nuevo usuario no las tenga. Insumos sin sesión invita a agregar mientras el alta está deshabilitada y presenta varios avisos. | Mostrar el siguiente paso que sí se puede ejecutar: iniciar sesión o registrar primera compra. Un beta tester necesita orientación, no conocer la historia del sistema. |

## 3. Patrones genéricos o repetitivos a cuestionar

No es el color cálido lo que vuelve genérica la UI. Es la repetición de una misma estructura independientemente de la tarea:

- Cards dentro de cards, bordes, avisos en cajas y vacíos punteados compiten por separar todo. Reservar contenedores para unidades reales: rollo, compra, receta o transacción.
- Eyebrows en mayúsculas y encabezados duplicados repiten contexto ya visible. Conservarlos cuando aportan orientación, no como requisito decorativo de cada bloque.
- La misma pequeña raya Clay en modales produce coherencia, pero usada siempre no aporta significado. No aumentar terracota para resolver un problema de jerarquía.
- Inicio con cuatro contadores y actividad vacía se parece a un dashboard estándar. Puede sentirse más propio destacando acciones y señales ya existentes —material bajo, búsqueda de filamento, actividad real— sin inventar disponibilidad de máquinas ni conexión AMS.

## 4. Móvil y responsive

El problema más grave es el acceso recortado a 320 px. El segundo es el tiempo hasta encontrar contenido accionable: inventario y Spools gastan demasiado alto en resumen y avisos. El tercero es la consulta horizontal del reporte.

No se observó desbordamiento horizontal del documento en las demás vistas inspeccionadas. Eso no implica que todo sea usable: el recorte negativo del login no queda demostrado por una simple comparación de scrollWidth/clientWidth.

Los controles principales suelen tener buen tamaño. No se declara incumplimiento de accesibilidad por los chips de color pequeños sin medir también separación y excepciones. Se observaron fuentes de algunos campos cercanas a 12.48 px; su legibilidad merece revisión. El posible zoom automático de iOS no se reprodujo y queda como comprobación pendiente, no bug confirmado.

## 5. Navegación y jerarquía

Conservar el menú lateral, pero definir una regla consistente de **sección frente a tarea modal**. Inicio, Inventario y Producción viven en el área principal; Compras, Proyectos, Spools y Reportes abren capas que bloquean el menú. Costos lleva al panel de tarifas. La navegación promete destinos equivalentes que hoy se comportan distinto.

La mejora sería permitir cambiar de contexto sin cerrar repetidamente una capa. No exige aquí inventar rutas ni rehacer toda la arquitectura: requiere acordar el patrón antes de implementar. Costos también debe explicar si significa configurar tarifas o consultar costos calculados. Producción debe seguir diciendo que registra impresiones; no insinuar control remoto.

La tipografía DM Sans/Manrope es adecuada. El problema es de escala/peso: varias etiquetas pequeñas y negritas se parecen entre sí y los placeholders pueden confundirse con valores ya cargados. En los pesos, indicar gramos de forma consistente: Compras lo hace explícito, mientras algunos campos del alta de filamento omiten la unidad en la etiqueta.

## 6. Uso de marca: dónde Proper se siente propio

La combinación vigente es correcta y se conserva:

| Token aprobado | HEX | Papel actual |
| --- | --- | --- |
| Warm Canvas | #F8F4EB | Fondo cálido principal |
| Paper | #FFFFFF | Superficies |
| Proper Green | #23634B | Acciones y selección funcional |
| Ink | #192C24 | Texto fuerte |
| Muted | #58695E | Texto secundario |
| Soft Sage | #E8EFE5 | Apoyo suave |
| Line | #E1E5DA | Bordes |
| Surface | #F5F5F2 | Superficie neutra del sistema |
| Proper Clay | #C76F56 | Acento decorativo controlado |

Fuente: `app/brand/proper-brand-tokens.json` y `docs/UI_DELIVERY.md`. No se propone otra paleta, otra fuente ni dark mode. Esta revisión no certificó todos los pares de contraste; evitar usar Clay como texto pequeño o único indicador de estado sin medir el contraste del par concreto.

Proper se reconoce en el wordmark, la calidez, la serenidad del verde y el material identificado por color/peso. Se diluye en pantallas dominadas por cajas administrativas y avisos. La oportunidad es **hacer protagonista al objeto maker**, no decorar con herramientas, engranajes o texturas de taller. Conservar nombres, posicionamiento, tagline y descriptor. No recrear el endorsement Stone Collective mientras falta su SVG oficial.

## 7. Top 5 por impacto

1. **Cerrar acceso móvil y teclado de Reportes.** Criterio: login completo a 320/390 px; foco entra, se mantiene y regresa al cerrar. Protege el primer ingreso beta y el uso accesible de datos.
2. **Acercar los rollos y sus acciones en inventario móvil.** Criterio: encontrar un material requiere menos desplazamiento sin ocultar modo local ni cifras incompletas. Mejora el uso junto a la impresora/balanza.
3. **Arreglar distribución de Nueva orden y jerarquía de formularios/Spools.** Criterio: no desperdiciar media pantalla desktop, unidades explícitas y primer campo fácil de encontrar. Acelera registrar compras y materiales reales sin rehacer formularios.
4. **Uniformar expectativas de navegación y acción principal.** Criterio: secciones equivalentes se comportan de manera predecible; configurar impresoras/tarifas no compite con crear receta o registrar impresión. Conserva el menú ya aprobado y hace visible su valor.
5. **Reducir cajas/etiquetas redundantes y orientar estados vacíos con contenido maker real.** Criterio: cada contenedor separa una entidad o tarea; cada vacío ofrece una acción disponible. Da personalidad a Proper por su utilidad, no por un nuevo adorno.

## 8. Qué NO recomendaría cambiar

- Nombre Proper, posicionamiento, tagline, descriptor, logo ni arquitectura de marca.
- Warm Canvas / Paper / verdes / Clay ni las familias tipográficas aprobadas.
- La navegación lateral por una nueva propuesta visual global.
- Separación de filamento, spool, compras, insumos y producción real.
- Registrar impresión como acción principal y cotizar como secundaria.
- Contratos de historial, costos, monedas, RLS, atomicidad o idempotencia como parte de una pasada visual.
- Avisos de datos no sincronizados, incertidumbre de costo o riesgo de una operación: sí ordenar, no esconder.
- Todas las tablas por cards, ni todos los formularios por wizards. Cada representación debe responder a una tarea concreta.
- Ramas pendientes de moneda, perfiles o bienvenida: no duplicar soluciones que ya están respaldadas.

## 9. Recomendación de alcance

**Refinamiento dirigido**, no conservar todo sin crítica y tampoco una pasada visual integral. Recomiendo convertir los cinco puntos anteriores en bloques revisables, empezando por defectos concretos de acceso/foco; luego evaluar cambios de jerarquía con aprobación del fundador. Este informe no inicia ninguno.

## Hallazgos fuera de alcance visual

- **Monedas demo/local:** se observan resúmenes en CRC y muestras con costos USD. No interpretar un cero como valoración fiable de todas las monedas. FIN-01A / PR #33 ya aborda contratos financieros; no proponer conversión improvisada como arreglo visual.
- **Perfil demo → local:** el remontaje por cambio de `dataMode` puede reiniciar la vista/borrador y el aviso interno tras un primer guardado. Comportamiento previo documentado en la rama `feat/profile-currency-access`; no volver a implementarlo durante esta auditoría.
- **Insumos sin resultados:** por inspección de código, la condición de vacío depende de la lista original y puede dejar una búsqueda filtrada sin mensaje orientador. Pendiente reproducir con inventario autenticado.
- **Actividad reciente:** por inspección de código, el salto dirige al módulo, no necesariamente al registro individual. Evaluar como comportamiento, no prometer deep links existentes.
- **Feedback transaccional:** esta auditoría no confirma éxito/error/reintento de todas las escrituras porque no creó registros. Mantener las verificaciones específicas existentes y probar con datos controlados antes de ampliar beta.

## Verificaciones y estado final

- `npm run build`: aprobado durante esta revisión sobre la base indicada, incluida comprobación TypeScript.
- Inspección visual y DOM a 320, 390 y 1440 px; formularios abiertos sin guardar; teclado en ModalFrame, perfil y Reportes.
- Producción del commit base: despliegue GitHub/Vercel `6845307250`, estado `success`, creado el 4 de octubre de 2026.
- Producción al cierre: dominio viejo HTTP 200, Inicio renderiza, consola capturada sin errores/advertencias. No es una prueba de login/logout.
- No se modificó código ni se comenzó implementación. Pendiente revisión del fundador y validación autenticada de módulos no cubiertos.
