# Proper Physical Reader · identidad y evolución offline

Fecha: 2026-10-31 (Costa Rica).

**Estado: propuesta de producto/arquitectura para revisión con el fundador y WayForge · Smart Workshop. No autoriza implementación ni amplía automáticamente V1.** No hay protocolo final, registro funcional de dispositivos, cola offline o sincronización implementados.

## Base vigente y reparto de responsabilidades

V1 conserva USB, computadora y Proper abierto/conectado. El lector informa; Proper interpreta dentro de la cuenta autorizada. No se acumulan lecturas para ejecutarlas inesperadamente al reconectar. Una lectura no registra consumos, pesajes, compras o cambios de inventario.

Existe un [diagnóstico de banco compilado para ESP32 clásico + RC522](../firmware/rc522-diagnostic/README.md), separado de la integración futura: UID/familia y cabecera de ciertos tags, sin lectura NDEF completa o conexión a Proper. No consta aquí una prueba física aprobada. El objetivo/pinout del diagnóstico no se traslada directamente a C3/S3.

Recomendación UX pendiente de validación: periférico USB sencillo con indicador físico, preferentemente RGB. OLED y buzzer son opcionales; confirmar/cancelar y elegir acciones vive en Proper. La pantalla podría mostrar información devuelta por la app, nunca un peso medido por un lector sin balanza. Mantener acceso de recuperación aunque no haya controles cotidianos.

Etiqueta conocida: abrir su ficha solo si no interrumpe un formulario con borrador; en ese caso ofrecer abrirla explícitamente. Desconocida/incompatible: explicar el resultado y ofrecer el flujo de preparar una etiqueta para un rollo existente o crear el rollo por el flujo normal, sin altas automáticas ni exposición de otras cuentas. Reutilizar identidad NDEF de rollo/lote y distinguirla de un spool reutilizable. No navegar a URLs arbitrarias.

## Clasificación propuesta

| Capacidad | Clasificación / condición |
| --- | --- |
| Identificador interno estable + código visible de unidad | Propuesto para V1; todavía sin implementar/aprobar su incorporación. |
| Identificación online | Alcance V1 de referencia; integración pendiente. |
| Store-and-forward persistente | V1.5 opcional/experimental, después de validar USB y una necesidad real. |
| Arranque autónomo sin preparar captura en Proper | V2 por evaluar. |
| Wi-Fi/API independiente del navegador | V2 por evaluar, sin compromiso de entrega. |
| Modificar inventario localmente | Fuera del alcance de este accesorio. |

## Requisitos funcionales de la propuesta V1.5

### 1. Habilitación y lecturas que conservar

Preparar en Proper una sesión de captura explícita y vincularla al dispositivo/destino autorizado. Si la app se desconecta, capturar solo mientras esa modalidad siga habilitada. Sin sesión preparada, mantener el comportamiento V1 y señalar desconexión.

Guardar lecturas completas compatibles con la identificación de Proper, aunque la coincidencia con un rollo accesible deba resolverse después. Conservar el contenido leído, no reconstruirlo desde el UID al sincronizar: una etiqueta puede reprogramarse. Las lecturas incompletas/incompatibles generan feedback, no una cola de volcados arbitrarios de tarjetas. El evento es una lectura reportada, no una prueba autenticada de presencia física.

### 2. Antigüedad, capacidad y reinicio

Hipótesis para validar: sesiones de hasta 24 horas. Esa duración no es una política de borrado. Conservar pendientes hasta ACK durable o descarte explícito; una antigüedad excesiva exige revisión, no eliminación silenciosa.

La cola debe ser acotada. Si se llena, avisar y detener nuevas capturas confirmadas sin sobrescribir pendientes. Después de reiniciar sin hora fiable, conservar la cola y exigir volver a habilitar captura. Una pérdida de energía impide nuevas lecturas, pero no debería destruir eventos previamente confirmados como guardados.

### 3. Lecturas repetidas y deduplicación

Una etiqueta sostenida sobre la antena produce una observación útil. Diez presentaciones separadas producen diez eventos diferentes; Proper puede agruparlos visualmente, sin convertirlos en diez rollos o movimientos.

Crear una vez un ID único por evento y persistirlo con su contenido antes de confirmar guardado. No derivarlo solo del reloj, UID o código humano. Mantenerlo en cada reintento.

Proper guarda una vez por identidad de dispositivo/evento. Mismo ID + mismo contenido devuelve el recibo original; mismo ID + contenido distinto se rechaza sin sobrescribir. El estado mutable de entrega no integra el contenido físico inmutable. No deduplicar eventos distintos solo porque comparten etiqueta. Los reenvíos son posibles; la recepción debe ser idempotente.

### 4. Tiempos y contenido mínimo

Separar hora estimada de captura, hora de recepción del servidor y orden local (arranque + secuencia/tiempo monotónico). La recepción del servidor no prueba cuándo ocurrió una lectura offline. Si no hay hora de captura fiable, conservarla desconocida, con su calidad/origen; no inventarla ni usar la de sincronización como sustituto.

Campos conceptuales, sin congelar nombres/tipos de un protocolo:

- Identificador interno del dispositivo y único del evento.
- Referencia opaca a sesión de captura/vinculación y versión de formato.
- Contenido de identificación leído, completo y acotado.
- Arranque, secuencia/tiempo monotónico y hora estimada/calidad cuando existan.
- Estado local de entrega e información de integridad/recuperación.

El código humano puede resolverse desde la identidad interna. No guardar credenciales de usuario o servidor. CRC/huellas de contenido ayudan a detectar diferencias; no autentican al dispositivo.

### 5. Envío, ACK y recuperación

Flujo tanto online como offline: **lectura → guardado local confirmado → envío → guardado durable en Proper → ACK → liberación local**.

Reconectar informa cuántos pendientes existen y propone sincronizarlos al confirmar el usuario. Proper los recibe en una bandeja de observaciones/revisión separada del inventario. No abrir fichas ni aplicar lecturas automáticamente.

Enviar bytes, recibirlos en JavaScript o devolver cualquier HTTP exitoso no autoriza a borrar. Si el navegador está abierto sin internet, conservar los pendientes hasta obtener el recibo del servidor.

El ACK identifica dispositivo, evento, contexto, huella del contenido y recibo/resultado durable. Solo se emite después del guardado. Un ACK perdido se recupera reenviando el evento y devolviendo el mismo recibo. Guardado para revisión puede ser válido aunque la etiqueta no encuentre un rollo. Recibido no equivale a interpretado o aplicado.

Persistir la confirmación local antes de recuperar espacio. Si un corte provoca reenvío de un evento ya recibido, Proper lo reconoce sin duplicarlo. Auth/contexto incorrectos no permiten borrar. Un rechazo no se trata como ACK de almacenamiento: requiere resolución explícita. No formatear automáticamente la cola ante errores de recuperación.

### 6. Identidad, contexto y provisionamiento

Código humano de prototipo propuesto: `PPR-PROT-001`; códigos comerciales posteriores podrían ser `PPR-000001`, etc. Separarlo del identificador interno estable asignado a la unidad. Registrar su correspondencia y conservarla en actualizaciones normales. No reutilizar IDs de eventos tras reinicios/reprovisionamiento.

Prototipo: registro manual controlado. Producto comercial: definir reclamación de unidad, por ejemplo código de activación de un solo uso y confirmación en Proper. Escribir un Device ID público no basta para reclamarla. MAC, UID e identificadores no son credenciales ni prueban hardware genuino.

El dispositivo no necesita la sesión del usuario, pero sí una referencia opaca al contexto autorizado. Esa referencia no concede acceso. Proper verifica la vinculación y permisos del destino; no importa una cola anterior en cualquier cuenta abierta al reconectar. Cambio de propietario/desvinculación/reset requiere sincronizar con el destino autorizado o descartar pendientes explícitamente.

Esta propuesta USB asume app/host de confianza. Autenticación criptográfica de hardware o ACK firmado verificable en MCU sería un requisito adicional, no una garantía actual.

### 7. Feedback físico

| Estado distinguible | Significado |
| --- | --- |
| Listo | Conexión y sesión preparadas. |
| Proper desconectado | Sin comunicación; no implica captura habilitada. |
| Captura pendiente habilitada | Puede guardar durante la interrupción. |
| Evento almacenado | Persistencia local confirmada; todavía pendiente de Proper. |
| Sincronizando | Envío/confirmación en curso. |
| Sincronizado | Todos los pendientes tienen ACK durable; no significa inventario actualizado. |
| Error / cola llena | Conservar pendientes; no confirmar nuevas capturas como guardadas. |

Definir colores/patrones con WayForge; no depender únicamente del color. OLED/controles no son obligatorios para una sesión preparada desde Proper. Arrancar autónomamente desde otra alimentación sin ese paso requiere revisar la interacción física de V2.

## Condiciones para escoger hardware y cerrar la propuesta

Preservar capacidad para identidad/contexto y cola no volátil acotada, margen de recuperación, detección de errores y actualización sin borrar pendientes silenciosamente. Objetivo provisional de dimensionamiento: 256 eventos de hasta 1 KiB por registro (256 KiB de datos), más metadatos/margen; validar tamaño real del NDEF/registro antes de fijar particiones, MCU o memoria externa. No es un requisito de fabricación aprobado.

ESP32-C3 sigue como candidato, sin obligar a S3, OLED, batería, memoria externa o RTC. Su reloj interno no mantiene continuidad a través de pérdida de alimentación; exigir fecha exacta después de esos cortes sí cambiaría el requisito de reloj. NVS no constituye por sí solo una cola transaccional: una escritura en curso puede perderse al cortar energía. Verificar el formato/commit y el feedback físico, sin prometer durabilidad solo por elegir una biblioteca.

Antes de aprobar implementación: validar caso de uso offline; política de captura/retención y límites; provisionamiento/destino autorizado; formato versionado y ACK; y pruebas de corte durante escritura/ACK/liberación, cola llena, reenvío con payload cambiado, cambio de cuenta, reloj desconocido y reconexión sin acciones inesperadas.

No se compran componentes, diseña PCB, modifica firmware/backend o cambia infraestructura con esta documentación. La identidad y condiciones comerciales de hardware tampoco quedan aprobadas.

## Referencias y continuidad

- [Alcance inicial y límites del lector](NFC_READER_ACCESSORY.md).
- [Handoff físico para WayForge](handoffs/2026-10-30-wayforge-nfc-reader.md).
- [Diagnóstico existente](../firmware/rc522-diagnostic/README.md).
- [Contratos de atomicidad/reintentos de Proper](../ATOMICITY_AUDIT.md); no implica que este flujo ya exista.
- [Chrome · Web Serial](https://developer.chrome.com/docs/capabilities/serial): permisos y navegador de la vía USB propuesta.
- [Espressif · reloj del C3](https://docs.espressif.com/projects/esp-idf/en/stable/esp32c3/api-reference/system/system_time.html).
- [Espressif · NVS](https://docs.espressif.com/projects/esp-idf/en/stable/esp32c3/api-reference/storage/nvs_flash.html).

Fuentes técnicas consultadas durante el análisis del 31 de octubre; sustentan límites, no aprobación de hardware o implementación.
