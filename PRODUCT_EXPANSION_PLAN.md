# Expansión de producto: market, AMS y producción

Fecha de decisión: 2026-08-30

Este documento convierte las ideas de crecimiento de Spool Vault en entregas pequeñas que se puedan validar sin comprometer la integridad del inventario ni asumir demasiado costo operativo.

## Decisiones principales

1. El primer market será un comparador de ofertas y un canal referido. El proveedor conserva el checkout, cobro, factura, entrega y soporte.
2. La compra y el costo histórico siguen siendo inmutables. Un dato incorrecto se corrige con un movimiento trazable; un dato omitido se completa con una compra faltante.
3. La primera integración con Bambu/AMS será local y de solo lectura. Spool Vault asociará las bandejas a rollos reales y conciliará trabajos, pero no controlará la máquina inicialmente.
4. Un proyecto describe la receta reusable. Una corrida de producción registra lo que realmente ocurrió y congela sus costos.
5. El costo de una corrida no será solo filamento: incluirá extras, máquina, electricidad, mano de obra, fallos, empaque, envío y comisiones cuando correspondan.

## 1. Incidencia de costos omitidos

### Caso real

El rollo Bambu Lab PLA Matte Ash Grey existe, pero no tiene precio, fecha de compra ni registro en el historial. La corrección actual funciona únicamente cuando ya existe una compra que corregir.

### Solución

Agregar en el detalle del filamento dos acciones contextuales:

- **Registrar compra faltante**: aparece cuando el rollo nunca tuvo compra.
- **Corregir compra**: abre la compra vigente cuando sí existe historial.

Registrar una compra faltante debe ejecutar una sola operación atómica e idempotente que:

1. valide que el rollo pertenece al usuario;
2. bloquee el rollo durante la operación;
3. cree el historial de compra con proveedor, fecha, presentación, moneda, precio, spool y confianza;
4. actualice el costo vigente del rollo;
5. no duplique la compra si la red reintenta la solicitud.

El formulario nunca debe inventar el precio. Ash Grey se completará cuando el usuario proporcione el monto y los demás datos reales.

## 2. Market de proveedores

### Experiencia inicial

El botón **Comprar** pasa a mostrar ofertas comparables para el filamento seleccionado:

- proveedor;
- presentación con spool o refill;
- precio y moneda;
- disponibilidad declarada;
- entrega o retiro;
- enlace de compra;
- fecha de última actualización.

El orden por defecto debe priorizar coincidencia exacta, disponibilidad y costo total. Una posición pagada puede existir, pero siempre debe decir **Patrocinado** y no alterar silenciosamente la recomendación.

### Modelo de negocio recomendado

La primera versión evita cobrar al consumidor dentro de Spool Vault. Opciones de ingreso, de menor a mayor compromiso:

1. comisión por venta atribuida mediante enlace o código;
2. pago por oportunidad calificada;
3. suscripción de proveedor por catálogo, métricas y alertas de demanda;
4. espacio patrocinado claramente identificado;
5. checkout nativo en una etapa posterior.

El checkout nativo solo tiene sentido después de validar volumen. Convertiría a Spool Vault en parte del flujo de pagos, devoluciones, contracargos, facturación, reserva de inventario y soporte.

### Operación del catálogo

No se debe depender de copiar páginas automáticamente. El orden recomendado es:

1. portal simple o archivo CSV mantenido por el proveedor;
2. API o feed programado cuando el comercio lo permita;
3. revisión manual para el piloto.

El catálogo debe separar el producto canónico de cada oferta. Así un mismo Bambu Lab PLA Matte Ash Grey puede tener varias tiendas, precios y fechas sin duplicar la identidad del filamento.

Entidades previstas:

- `marketplace_suppliers`: comercio y condiciones públicas;
- `catalog_products`: variante canónica;
- `supplier_offers`: precio, stock, URL y actualización;
- `offer_clicks`: atribución mínima y respetuosa de la privacidad;
- `marketplace_orders`: solo si se construye checkout nativo.

Los proveedores personales ya usados para registrar compras no deben mezclarse automáticamente con los comercios públicos.

## 3. Integración Bambu P1S y AMS

### Qué aporta

Una conexión local puede obtener estado de la impresora, trabajo activo y datos de las bandejas AMS. Eso permite mostrar qué color/material está en cada slot y asociarlo al rollo físico de Spool Vault.

### Límites importantes

- No existe una promesa de estabilidad suficiente para basar el núcleo del inventario en comandos no documentados.
- La compatibilidad puede cambiar con el firmware.
- El remanente puede no estar disponible para todas las combinaciones de impresora, AMS y filamento.
- Un refill o filamento de terceros puede requerir asociación manual.

### Arquitectura propuesta

El navegador desplegado en Vercel no debe conectarse por sí solo a la red privada ni enviar claves LAN a Supabase. Se necesita un pequeño conector local en la Mac, Raspberry Pi u otro equipo de confianza.

El conector:

1. guarda la IP, serie y clave LAN localmente y cifradas;
2. lee eventos de la impresora;
3. envía a Spool Vault únicamente el estado necesario;
4. usa identificadores de evento para impedir descuentos duplicados.

Entidades previstas:

- `printers`;
- `ams_units`;
- `ams_slots`;
- `printer_sync_events`;
- relación entre slot y `filament_rolls`.

La primera entrega será de solo lectura. El control de AMS, cambio de configuración o envío de impresiones se evaluará después de pruebas reales con la P1S y cada firmware soportado.

## 4. Proyectos y producción

### Proyecto o receta

Un proyecto guarda lo reusable:

- nombre, fotografía y notas;
- archivos STL/3MF y su versión;
- licencia y permiso de uso comercial;
- impresora/perfil recomendado;
- tiempo estimado;
- cuatro o más requisitos de filamento con gramos por color;
- insumos como imanes, pines, tornillos, luces, pintura o empaque.

Los archivos deben vivir en un bucket privado de Supabase Storage y abrirse mediante enlaces temporales. El 3MF puede conservar más contexto de preparación que un STL, por lo que ambos deben permitirse.

### Corrida de producción

La corrida registra un hecho concreto:

- fecha y cantidad producida;
- impresora y duración real;
- rollos exactos utilizados;
- gramos reales y desperdicio;
- insumos realmente consumidos;
- éxito, fallo o reimpresión;
- precio de venta opcional.

Cerrar una corrida debe ser una operación atómica: guardar el resultado, congelar costos, crear consumos y descontar inventario juntos. Un evento de impresora y un cierre manual no pueden descontar el mismo material dos veces.

### Fórmula de costo

`Costo total = filamento + insumos + máquina + electricidad + mano de obra + fallos + empaque + envío + comisiones`

`Utilidad = ingreso neto - costo total`

`Margen = utilidad / ingreso neto`

Cada componente debe mostrar si es real, estimado o incompleto. La app puede recomendar un precio mínimo o advertir una utilidad baja, pero nunca presentar una estimación como dato exacto.

## 5. Orden de entrega

### Entrega A — integridad inmediata

- [x] Registrar compra faltante y hacer visible la corrección desde el rollo.
- Completar Ash Grey mediante la interfaz cuando estén disponibles sus datos reales.

### Entrega B — proyectos mínimos

- Proyecto, receta de materiales y extras.
- Corrida manual de producción.
- Descuento atómico de rollos y costo/utilidad básicos.

### Entrega C — market piloto

- Catálogo y ofertas de Pritonic, Maker Store y un tercer proveedor.
- “Dónde comprar”, enlace referido y métricas.
- Sin pago dentro de Spool Vault.

### Entrega D — impresora y AMS

- Registro de P1S y conector local.
- Estado de impresión y lectura de slots.
- Mapeo slot-rollo y conciliación de una corrida.

### Entrega E — crecimiento comercial

- Portal de proveedores y feeds.
- Configuración avanzada de costos y producción.
- Evaluación de checkout nativo, membresías y planes.

## Señal de éxito del piloto

- Los usuarios encuentran una oferta disponible sin abandonar la búsqueda.
- Los proveedores pueden medir clics o ventas atribuidas.
- El cierre de una corrida explica el costo y descuenta inventario sin correcciones manuales.
- La integración AMS ahorra captura de datos sin convertirse en la única fuente de verdad.
