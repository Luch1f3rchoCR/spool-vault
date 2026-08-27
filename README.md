# Spool Vault

MVP móvil para administrar rollos de filamento de impresión 3D.

Incluye:

- dashboard de rollos, gramos disponibles, materiales y rollos bajos;
- inventario con marca, línea, material, color, HEX, peso, estado, ubicación, compra, precio, secado, foto y link;
- filtros por búsqueda, marca, material y lista de compra;
- registro de consumo por proyecto que descuenta gramos del rollo;
- ajuste manual de gramos disponibles para corregir pesajes o recargas;
- compras por proveedor con precio histórico inmutable;
- separación entre precio total, costo reutilizable del spool y costo consumible por gramo;
- inventario de spools numerados, vacíos y en uso;
- edición, asignación, liberación, inactivación y reactivación de spools;
- actualización rápida por balanza usando peso total menos tara;
- costo de cada consumo calculado con el rollo realmente utilizado;
- QR por rollo;
- lectura/escritura NFC con Web NFC cuando el celular/navegador lo soporte;
- modo demo local si Supabase todavía no está configurado.

El estado de implementación y los próximos bloques están en [`ROADMAP.md`](./ROADMAP.md).

## NFC

El MVP escribe una URL del rollo en etiquetas NFC. Web NFC funciona principalmente en Chrome para Android. Si el dispositivo no lo soporta, el QR queda como respaldo.

## Supabase

El esquema está en `supabase/schema.sql`. Está preparado con RLS y grants explícitos para que el inventario sea consultable después por ChatGPT mediante Supabase, sin hacer públicas las tablas para usuarios anónimos.
