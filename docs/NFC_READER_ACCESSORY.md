# Accesorio lector NFC de Proper · alcance inicial

Fecha: 2026-10-30. Idea del fundador: accesorio opcional con lector NFC + ESP32, con diseño físico para WayForge y programación/integración dentro del desarrollo de Proper. Descriptor funcional, sin nombre comercial, precio o venta aprobados.

## Confirmado / existente

- Proper ya escribe y lee etiquetas NDEF mediante Web NFC donde el navegador/dispositivo lo permite: `writeNfcTag`, `scanNfcTag`, `payloadForRoll` en `app/page.tsx`.
- Las etiquetas actuales identifican el registro del rollo con una URL `/?roll=<id>` y pueden conservar un payload QR anterior. No confundir el rollo/lote con un spool físico reutilizable.
- No existe todavía firmware para el lector externo, conexión ESP32, producto físico probado o compatibilidad universal. NFC del teléfono y lector externo son dos vías distintas.
- Actualización del fundador: dispone de un lector marcado **RFID-RC522**, un ESP32 y stickers. El código informado para el ESP32 es «XX5R69»; no basta para identificar la variante/pinout. Tipo y capacidad de stickers desconocidos. La compatibilidad del montaje todavía no se ha probado; no se compraron componentes.
- El proyecto de destino indicado existe como «WayForge | Marca & Productos.». Este documento prepara el traspaso físico; no implica que se haya enviado o aceptado allí, ni define una relación comercial/de marca.

## Propuesta de prototipo

Flujo: sticker propio → módulo NFC → ESP32 → USB/serial → sesión de Proper en el navegador → ficha del rollo. Primera acción: identificar/abrir; pesar o registrar consumo requiere una acción explícita posterior del usuario. Acercar una etiqueta no debe descontar inventario ni cerrar impresiones.

Para empezar se propone USB/serial, con selección y permiso del usuario, usando un navegador con Web Serial disponible. Chrome documenta soporte de escritorio en Windows/macOS/Linux/ChromeOS; el transporte se debe probar con la placa y sistema reales. No prometer Safari, iPhone, Android por USB o funcionamiento sin una computadora en este prototipo. Mantener QR/Web NFC como alternativas según el dispositivo. Un puente local o Wi-Fi podría evaluarse después si hay necesidad validada; no introducirlo ahora.

El ESP32-S3 dispone de USB Serial/JTAG; otras placas pueden necesitar un puente USB-UART. No elegir pines, cableado o modo USB hasta conocer la placa exacta. No pedir claves Wi-Fi o credenciales cloud para este prototipo ni desactivar protecciones del navegador.

## Reparto de trabajo propuesto

| Área | Entregable |
| --- | --- |
| WayForge · diseño físico | Concepto de carcasa/base, zona de lectura, ergonomía, montaje, acceso al USB, visibilidad de indicadores y archivos editables + STL/3MF. |
| Desarrollo Proper · electrónica/prototipo | Validar placa, módulo lector, alimentación, niveles eléctricos e interfaces; definir señales y medidas que condicionan la carcasa. |
| Desarrollo Proper · firmware | Inicialización, lectura NDEF, indicación de estados, manejo de desconexión/error, filtrado de lecturas repetidas y versión del dispositivo/protocolo. |
| Desarrollo Proper · app | Conexión consentida, validación de mensajes, selección del rollo del usuario, estado/error/desconexión e interfaz español/inglés. |
| Fundador / producto | Probar el prototipo, aprobar diseño y BOM final, decidir precio, paquete, soporte y condiciones de uso. |

## Identidad de etiqueta y seguridad de datos

- Propuesta inicial: reutilizar la identidad de rollo/NDEF existente y conservar lectura de etiquetas antiguas. No navegar automáticamente a cualquier URL encontrada.
- Si la etiqueta debe quedarse fija en un spool reutilizable al cambiar de recarga, resolver su asociación con el rollo actual antes de vender ese flujo. El código del spool y la identidad histórica de una compra no son intercambiables.
- No usar UID/tag como autenticación. El lector no recibe secretos de cuenta ni credenciales de servidor. Leer un identificador no concede acceso a otra cuenta.
- La app valida tipo, tamaño y contenido del mensaje y resuelve el rollo dentro del inventario autorizado. Etiqueta desconocida, malformada o de otra cuenta debe mostrar un estado claro, sin crear datos automáticamente.
- Una etiqueta mantenida sobre la base produce una sola detección útil; retirarla y acercarla otra vez permite una nueva. Ningún evento de lectura debe ejecutar una escritura financiera/inventario por sí solo.
- El transporte deberá tener versión/encuadre y distinguir datos de logs de arranque. El contrato de mensajes se define junto con el hardware; este documento no inventa un contrato temporal.
- Prototipo inicial sobre etiquetas propias. No implica lectura de etiquetas Bambu protegidas, integración AMS ni control de impresoras.

## Selección de componentes y riesgo encontrado

1. Identificar la variante del ESP32 y su interfaz USB, además de alimentación/niveles de la placa.
2. Identificar los stickers: familia, NDEF, memoria y si están bloqueados. NTAG213/215/216 son Type 2, pero no se asume que los stickers existentes sean de esa familia.
3. Probar primero el RC522 existente. El chip MFRC522 admite ISO/IEC 14443 A/MIFARE y NTAG según NXP; eso hace viable evaluar etiquetas compatibles, sin confirmar todavía estos stickers o la calidad del módulo. Detectar UID es solo diagnóstico: hay que leer y decodificar NDEF para cubrir el flujo existente. No cambiar de lector antes de esa prueba.
4. Comprobar versiones de librería/SDK, licencias de distribución y vida comercial del componente antes de cerrar el BOM vendible.
5. No pedir otro lector todavía: se prioriza el RC522 que ya tiene el fundador. PN532 no es un BOM alternativo aprobado; NXP lo marca como no recomendado para diseños nuevos y propone PN7160. La electrónica del producto vendible se evalúa después del prototipo y la revisión de suministro/soporte.
6. Medir tamaño NDEF. El escritor actual emite URL + texto; en el caso por defecto puede duplicar la URL. Una URL del dominio público con UUID ocupa 77 bytes antes de codificación NDEF; dos copias son 154 bytes antes de compresión URI/cabeceras. No asumir que cualquier sticker admite ese mensaje. NTAG213 tiene 144 bytes de memoria de usuario. Medir el mensaje codificado y decidir una representación compatible sin romper etiquetas históricas.

## Checklist de avance

- [x] Confirmar disponibilidad de lector: el fundador tiene un RFID-RC522.
- [ ] Identificar variante/pinout del ESP32 y tipo/capacidad de stickers; falta una identificación legible de la placa. «XX5R69» se conserva como dato informado, no como modelo confirmado.
- [ ] Probar el RC522 existente y preparar solo la lista de faltantes que resulte necesaria; todavía no comprar otro módulo o congelar el diseño.
- [ ] Prueba de banco: alimentación/interfaz, detectar tag y leer su NDEF completo.
- [ ] Fijar formato compatible de etiquetas y contrato versionado ESP32 ↔ app.
- [ ] Programar firmware de lectura con repetición/desconexión/errores controlados.
- [ ] Integrar conexión/selección de rollo en Proper, manteniendo permisos y operaciones existentes.
- [ ] Probar repetición, etiqueta desconocida, mensaje truncado/grande, cancelación de permiso, puerto ocupado, reconexión y ausencia de hardware.
- [ ] Medir alcance/fiabilidad con carcasa y rollos reales, antes de aprobar piezas finales.
- [ ] Entregar medidas y BOM a WayForge; iterar prototipo físico y cerrar archivos de fabricación.
- [ ] Validar instalación, actualización/recuperación y documentación del kit en español/inglés.
- [ ] Definir costos completos, precio, contenido del paquete y soporte. No asumir que la licencia personal fundadora incluye hardware ni cambiar sus condiciones.

## Fuera de esta entrega

No se desarrolla o anuncia hardware funcional, no se flashea la placa, no se cambia la app/NFC existente, no hay compras, mensajes a otros chats, cambios de infraestructura o nuevos compromisos de membresía. La rama de idiomas y PR #62 se conservan separados. El accesorio no se vuelve requisito para usar Proper.

## Fuentes primarias verificadas el 2026-10-30

- [Chrome · Web NFC](https://developer.chrome.com/docs/capabilities/nfc): NDEF y alcance en Chrome para Android.
- [Chrome · Web Serial](https://developer.chrome.com/docs/capabilities/serial): permiso/gesto de usuario y plataformas de escritorio documentadas.
- [Espressif · USB Serial/JTAG en ESP32-S3](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-guides/usb-serial-jtag-console.html): depende del chip y placa concretos.
- [NXP · PN532](https://www.nxp.com/products/rfid-nfc/nfc-hf/nfc-readers/nfc-integrated-solution:PN5321A3HN): estado no recomendado para diseños nuevos.
- [NXP · NTAG213/215/216](https://www.nxp.com/products/NTAG213_215_216): estándares y memoria de usuario.

- [NXP · MFRC522, ficha técnica](https://www.nxp.com/docs/en/data-sheet/MFRC522.pdf): ISO/IEC 14443 A/MIFARE y NTAG; características eléctricas del chip.
- [Biblioteca MFRC522 · repositorio del mantenedor](https://github.com/miguelbalboa/rfid): acceso SPI y ejemplos de diagnóstico/lectura; revisar compatibilidad y versión antes de elegir firmware.
