# Traspaso propuesto a WayForge · diseño físico de lector NFC

## Mensaje de arranque listo para compartir

Queremos preparar el diseño físico de un accesorio opcional para Proper: una base/lector NFC de escritorio con ESP32 y un módulo lector. Al acercar una etiqueta propia, el firmware enviaría su identificación al navegador para abrir la ficha del rollo en Proper. Identificar no debe registrar consumos o cambiar inventario.

El fundador propone desarrollar la carcasa y experiencia física en WayForge; la programación del ESP32 y la integración con Proper se mantienen en Desarrollo de Proper. Esta es una propuesta de colaboración, no un producto ya operativo ni un encargo enviado automáticamente.

El fundador confirmó que ya tiene un ESP32, un lector **RFID-RC522** y stickers. Se probará primero ese lector; faltan la variante/pinout del ESP32 y la identificación de los stickers. «XX5R69» es el código que informó, no un modelo confirmado. No fijar dimensiones, taladros, pines, alimentación, cableado o una compra hasta disponer de las piezas y medidas verificadas.

Buscamos una pieza sobria y fácil de usar en un taller maker, con zona de lectura evidente, acceso al conector, montaje estable y posibilidad de mantenimiento. Se pueden explorar conceptos iniciales; el alcance y la fiabilidad de lectura deben comprobarse con la carcasa real antes de aprobar geometría final. No cubrir la antena con piezas/metales sin validar su efecto en las pruebas.

Entregables propuestos:

- Conceptos y recomendaciones de forma/ergonomía con supuestos visibles.
- Diseño editable de carcasa/base, piezas de montaje, accesos y ubicación de indicadores, condicionado al BOM medido.
- STL/3MF y orientación/ensamble/tornillería/materiales sugeridos para prototipar.
- Registro de revisiones tras prueba de lectura, extracción del cable, estabilidad y acceso a actualización/recuperación.

El primer prototipo propuesto usa USB hacia una computadora con navegador compatible. Wi-Fi, batería, pantalla, balanza, AMS y lectura de etiquetas propietarias Bambu quedan fuera del alcance inicial. No crear logos o relaciones de marca nuevas; las decisiones comerciales y de identidad se revisan con el fundador.

Antes de cerrar el diseño físico, devolver a Desarrollo cualquier cambio que afecte antena, electrónica, conectores, alimentación o actualización del firmware. El nombre final, precio, empaques y condiciones de venta siguen por validar.

## Fuente técnica para el proyecto

Compartir también [alcance de Proper](../NFC_READER_ACCESSORY.md). El firmware, el protocolo y el soporte de navegadores deberán probarse; no prometer compatibilidad universal. Este archivo está listo para que el fundador lo lleve al proyecto «WayForge | Marca & Productos.»; no confirma que ya se haya creado un chat o enviado el encargo.
