# Spool Vault: contexto para continuar

Actualizado: 2026-09-09. Este es el punto de entrada del repositorio; los documentos enlazados contienen el detalle de cada área.

## Bloque publicado · 9 de septiembre

Último cambio funcional: PR #23, merge `a431c42449ddd24edbef594c2236655b43f12223`, publicado en Vercel Production. Incluye impresoras en Perfil, cuestionario único de primer ingreso y correcciones de costos. Supabase confirmó `printer_cost_safety` (20260909203554) y `tester_first_visit` (20260909203604). Compilación, navegador simulado y pruebas SQL locales aprobadas. Humo de producción sin sesión: proyectos e impresoras disponibles, sin errores de consola; esto no equivale a una activación real.

Prioridad: el fundador puede enviar la primera invitación controlada y comprobar correo, enlace, cuestionario y activación. Todavía no se confirmó ese recorrido real; esperar su resultado antes de invitar al resto del grupo de 8–10. No se enviaron correos durante la publicación. Siguiente bloque de desarrollo: crear filamentos desde órdenes, con confirmación atómica e idempotente.

## Qué estamos construyendo

Una app web móvil para saber qué filamentos hay, cuánto queda y qué se consume al imprimir. Nació del uso personal de filamentos Bambu Lab y genéricos de Pritonic; ahora avanza hacia un piloto pequeño con usuarios externos.

El producto existente incluye inventario, búsquedas, compras y correcciones históricas, spools reutilizables, pesajes, consumos, QR, respaldo NFC condicionado al dispositivo, proyectos y corridas con costos congelados. Los datos autenticados están aislados por usuario; demo y local se distinguen de la cuenta sincronizada.

No reiniciar el MVP. No prometer NFC universal, lectura automática de etiquetas propietarias Bambu, integración AMS, workspaces compartidos ni market como prestaciones ya publicadas.

## Decisiones y evidencia reciente

| Tema | Estado confirmado | Pendiente |
| --- | --- | --- |
| Infraestructura | Next.js, Supabase y Vercel; mismo repositorio | Mantener continuidad entre PC y Mac sin duplicar backend |
| Dirección pública | https://spool-vault.vercel.app/ | No reemplazarla por una URL de preview para probar en celular |
| Tu espacio | Panel lateral en escritorio y pantalla completa móvil, con vistas separadas; aprobado por el fundador | Conservar esta navegación en nuevos módulos |
| Probadores | Administración privada y licencia personal Probador fundador · gratis de por vida | Reclutar el grupo pequeño y validar uso real |
| Aportes y datos | Ideas/errores con seguimiento y exportación JSON de la cuenta | Restauración automática y eliminación de cuenta no cerradas |
| Bienvenida | Primera recepción real confirmada en Gmail/spam; diseño y remitente aprobados | Probar enlace y activación; investigar filtrado a spam |
| Remitente | Spool Vault <hello@stonecollective.dev>, mediante Resend | Buzón, reenvío o Reply-To no confirmados |
| Inicio de sesión | Flujo distinto de la bienvenida | Configurar/probar SMTP de Supabase Auth y resolver sus límites |
| Marca | Se solicita trabajar la identidad ahora | Recibir contexto de Stone Collective CR y sus artes en borrador |
| Organización | Paquete de nueve documentos y arranques para seis chats preparado | Crear el proyecto privado de ChatGPT, cargar fuentes y trasladar contexto |

El registro anterior de PR #20 queda como antecedente; el corte funcional vigente es PR #23. Los commits posteriores que solo actualicen documentación no representan nuevas funciones.

## Alcance de la licencia

`founder_personal_v1` cubre inventario, compras, pesajes, etiquetas y proyectos personales de esta versión, sin vencimiento ni cobros recurrentes. No cubre servicios externos ni todos los planes futuros. La recompensa busca ayuda para depurar errores y aportar ideas, no reseñas positivas obligatorias.

No hay precios comerciales aprobados, ingresos validados ni contratos de proveedores documentados.

## Nuevas líneas de trabajo

1. **Dirección:** prioridades, evidencia, decisiones y seguimiento del piloto.
2. **Marca:** revisar Stone Collective CR, propósito y artes existentes antes de definir relación con Spool Vault, logo, voz y sistema visual.
3. **Clientes:** investigar problemas reales y contrastar segmentos; no confundir al fundador con todo el mercado.
4. **Marketing:** mensajes y demostraciones de funciones reales; no publicar campañas ni gastar sin aprobación.
5. **Negocio:** comparar modelos y costos, validar disposición de pago y respetar la licencia fundadora.
6. **Desarrollo y QA:** mantener el producto existente, cerrar incorporación/correo y registrar hallazgos del piloto.

Estos frentes están solicitados; sus resultados todavía no existen. Spool Vault como producto con firma secundaria Stone Collective sigue siendo una propuesta, no una arquitectura final aprobada. No asumir que Stone Collective, Stone Collective CR y Stone Collective Dev son nombres intercambiables.

## Orden de continuación propuesto

Primero incorporar contexto y artes de la marca y completar el traslado de fuentes. En paralelo, cerrar la prueba de enlace/activación y revisar correo. Luego ejecutar un piloto pequeño que alimente marca, cliente ideal y negocio. Market de proveedores y conector local AMS continúan en la agenda futura, sin desplazar los pendientes de confiabilidad del piloto.

## Dónde leer

| Necesidad | Fuente |
| --- | --- |
| Implementación y checklist | [ROADMAP.md](./ROADMAP.md) |
| Integridad y pruebas de datos | [ATOMICITY_AUDIT.md](./ATOMICITY_AUDIT.md) |
| Licencias, administración y participantes | [TESTER_PROGRAM.md](./TESTER_PROGRAM.md) |
| Correo, evidencia y pendientes | [RESEND_SETUP.md](./RESEND_SETUP.md) |
| Market, AMS y expansión | [PRODUCT_EXPANSION_PLAN.md](./PRODUCT_EXPANSION_PLAN.md) |
| Preparar el proyecto y los chats | [docs/chatgpt/00_EMPEZAR_AQUI.md](./docs/chatgpt/00_EMPEZAR_AQUI.md) |
| Brief de marca pendiente de materiales | [docs/chatgpt/04_MARCA.md](./docs/chatgpt/04_MARCA.md) |
| Decisiones y propuestas | [docs/chatgpt/08_DECISIONES.md](./docs/chatgpt/08_DECISIONES.md) |

## Cómo mantener el contexto

Al cerrar un bloque, actualizar la fuente de su área, el roadmap si cambia el estado del producto y este resumen si cambia una decisión relevante. Registrar fecha y evidencia; no convertir una propuesta en un logro.

El fundador solicitó guardar también estas ideas y contexto en la documentación de GitHub. Esa autorización no incluye secretos, inventarios personales, datos de probadores ni artes de terceros sin permiso.

Los adjuntos de ChatGPT y el ZIP preparado son instantáneas: volver a generar o reemplazar los archivos modificados al migrar. No afirmar que el nuevo proyecto o sus chats existen hasta comprobarlo. El código y la infraestructura permanecen donde están; este traslado es de contexto.
