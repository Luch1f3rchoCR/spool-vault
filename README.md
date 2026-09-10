# Spool Vault

Estado al 9 de septiembre: impresoras, primer ingreso de probadores y correcciones de costos **publicados** mediante PR #23 (`a431c42`), con ambas migraciones aplicadas. Pruebas locales y humo de producción aprobados; pendiente el primer ingreso real por correo. Ver PROJECT_CONTEXT.md para continuar.

Navegación de inventario: **+ Agregar** reúne nuevo filamento, crear spool, asignar spool y acceso a Mis spools. En **Compras**, cada orden agrupada se muestra como tarjeta y **Ver líneas de compra** abre productos, cargos y pago registrado. Los importes históricos se muestran con sus monedas y decimales; estas tarjetas no generan facturas fiscales.

Prueba de esta navegación: `node tests/add-purchase-navigation.browser.cjs` con Playwright disponible y la app local en el puerto 3100 (configurable con `TEST_BASE_URL`). Usa datos aislados de prueba y comprueba 320, 390 y 1280 px.

MVP móvil para administrar rollos de filamento de impresión 3D.

Para retomar desde otra tarea, PC o Mac, comenzar por [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md): decisiones recientes, estado real, nuevas ideas y mapa de documentación.

El paquete de continuidad para organizar el proyecto propio de ChatGPT, marca, clientes y negocio está en [docs/chatgpt/00_EMPEZAR_AQUI.md](./docs/chatgpt/00_EMPEZAR_AQUI.md). Es una instantánea sin secretos; no reemplaza el código ni sincroniza automáticamente los chats.

Incluye:

- dashboard de rollos, gramos disponibles, materiales y rollos bajos;
- inventario con marca, línea, material, color, HEX, peso, estado, ubicación, compra, precio, secado, foto y link;
- edición de la ficha del filamento en un modal, conservando intacto el histórico de compras y mediciones;
- filtros por búsqueda, marca, material y lista de compra;
- registro de consumo por proyecto que descuenta gramos del rollo;
- ajuste manual de gramos disponibles para corregir pesajes o recargas;
- compras por proveedor con precio histórico inmutable y correcciones trazables;
- registro atómico de compras omitidas para rollos creados sin precio;
- órdenes de compra con partidas, envío/express, otros cargos, prorrateo y confianza del costo;
- perfil con moneda base CRC, datos opcionales de facturación y tarifas productivas configurables;
- impresoras propias con marca, modelo, boquilla, ubicación, potencia, costo por hora y estado activo;
- pago real por orden con moneda, tipo de cambio, fecha, clase y fuente congelados;
- modal para corregir proveedor, fecha, presentación, precio, spool y moneda sin borrar el registro original;
- separación entre precio total, costo reutilizable del spool y costo consumible por gramo;
- inventario de spools numerados, vacíos y en uso;
- edición, asignación, liberación, inactivación y reactivación de spools;
- actualización rápida por balanza usando peso total menos tara;
- catálogo de tipos de spool con tara verificada/estimada y componentes separados;
- historial inmutable de pesajes con reintentos seguros;
- costo de cada consumo calculado con el rollo realmente utilizado;
- proyectos con recetas reutilizables, archivos STL/3MF privados, tiempos, filamentos e insumos adicionales;
- corridas de producción con impresora elegida, consumo real, electricidad, máquina, mano de obra, fallos, costos congelados, venta opcional y descuento atómico de todos los rollos;
- reporte de saldo por moneda, con valor restante, costos incompletos y exportación CSV;
- QR por rollo;
- lectura/escritura NFC con Web NFC cuando el celular/navegador lo soporte;
- modo demo local si Supabase todavía no está configurado.

El estado de implementación y los próximos bloques están en [`ROADMAP.md`](./ROADMAP.md). La estrategia de market de proveedores, integración AMS y proyectos/producción está en [`PRODUCT_EXPANSION_PLAN.md`](./PRODUCT_EXPANSION_PLAN.md).

El programa de probadores, las licencias gratuitas de por vida, los formularios privados y las decisiones de correo están en [`TESTER_PROGRAM.md`](./TESTER_PROGRAM.md). La guía paso a paso y el punto actual de configuración de Resend/GoDaddy están en [`RESEND_SETUP.md`](./RESEND_SETUP.md). Estos documentos forman parte del repositorio para retomar el trabajo desde la PC o la Mac.

## NFC

El MVP escribe una URL del rollo en etiquetas NFC. Web NFC funciona principalmente en Chrome para Android. Si el dispositivo no lo soporta, el QR queda como respaldo.

## Supabase

El esquema está en `supabase/schema.sql`. Está preparado con RLS y grants explícitos para que el inventario sea consultable después por ChatGPT mediante Supabase, sin hacer públicas las tablas para usuarios anónimos.

Para Vercel, configurá estas variables en Production y Preview:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`

También se acepta `NEXT_PUBLIC_SUPABASE_ANON_KEY` o `SUPABASE_ANON_KEY` como llave pública. Si cambiás variables en Vercel, hacé un redeploy porque los valores públicos de Next.js se congelan durante el build.

En Supabase Auth, agregá los dominios reales de la app en Redirect URLs. Para probar desde celular no sirve `localhost`; usá el dominio de Vercel y permití el preview con un patrón como `https://*-tu-equipo.vercel.app/**`.
