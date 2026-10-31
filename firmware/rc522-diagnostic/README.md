# Diagnóstico RC522 + ESP32 clásico

Primera prueba de banco para el módulo HW-126/RFID-RC522 fotografiado por el fundador, con pines `SDA SCK MOSI MISO IRQ GND RST 3.3V`. El ESP32 fotografiado tiene GPIO18/19/23/21/22 visibles; esto no identifica su fabricante o revisión exacta. El programa usa un objetivo ESP32 clásico y rechaza S2/S3/C3.

## Cableado

Con el USB desconectado, conectar **por nombre**, no por posición en una foto:

| RC522 | Placa ESP32 |
| --- | --- |
| 3.3V | 3V3 |
| GND | GND |
| SCK | G18 / GPIO18 |
| MISO | G19 / GPIO19 |
| MOSI | G23 / GPIO23 |
| SDA / SS | G21 / GPIO21 |
| RST | G22 / GPIO22 |
| IRQ | Sin conectar |

El pin SDA de este módulo es selección SPI (`SS/CS`) en este montaje. **Alimentar el RC522 desde 3V3, no desde 5V/VIN.** El ESP32 se alimenta por su USB; no agregar otra fuente al mismo tiempo. Verificar que no haya puentes de soldadura, usar cables cortos y contactos firmes. Si los pads del RC522 no tienen un header soldado, hace falta soldarlo o usar un contacto de prueba adecuado: no basta apoyar cables sobre los agujeros.

## Cargar y probar con Arduino IDE

1. Instalar soporte **esp32 by Espressif Systems, versión 3.3.12**, usando su [índice estable oficial](https://espressif.github.io/arduino-esp32/package_esp32_index.json).
2. Instalar **MFRC522 by GithubCommunity, versión 1.4.12**, desde Library Manager. Se usa su API acotada para diagnóstico; no se ha decidido el stack del producto comercial.
3. Abrir `rc522-diagnostic.ino` y seleccionar **ESP32 Dev Module** (ESP32 clásico) y el puerto de la placa.
4. Compilar y subir. Subir reemplaza el programa que tenga actualmente el ESP32. Esta entrega no flashea ningún dispositivo automáticamente.
5. Abrir Serial Monitor a **115200 baudios**. Acercar un solo sticker y retirarlo entre lecturas.

## Qué muestra

- Registro de versión del lector. `0x00`/`0xFF` se consideran falta de comunicación fiable; revisar alimentación/cables con USB desconectado y luego reiniciar. Otro valor no certifica autenticidad o funcionamiento RF del módulo.
- UID, SAK y familia que informa la biblioteca. Esto no determina por sí solo el modelo exacto NTAG213/215/216.
- Solo para la familia Ultralight/NTAG detectada: lectura de las primeras cuatro páginas y presentación del Capability Container. Si contiene `0xE1`, se muestran los bytes anunciados por la cabecera; no se afirma memoria física exacta, contenido NDEF completo o posibilidad de escritura.
- Para otras familias no se intenta leer su memoria o autenticar con claves.

No formatea, escribe, bloquea o borra etiquetas; no usa Wi-Fi/Bluetooth, credenciales, servicios cloud o inventario. El UID no se usa como autenticación. El texto del monitor es diagnóstico, no un contrato provisional de integración con Proper. La lectura completa de NDEF y la conexión a la app son bloques posteriores.

Si no detecta un sticker, probar otro de los propios y acercarlo a la antena. Aún no se conoce el tipo de los stickers y no se garantiza compatibilidad con todas las etiquetas RFID. No usar el resultado para inferir lectura de RFID Bambu protegido.

## Estado de verificación

Compilación para `esp32:esp32:esp32` aprobada el 30 de octubre de 2026 con Arduino CLI **1.5.1**, Arduino-ESP32 **3.3.12** y MFRC522 **1.4.12**. Resultado: 281.744 bytes de programa (21 %) y 22.236 bytes de RAM global (6 %). Un solo build de firmware; no se compiló la aplicación Next.js.

Se revisaron lectura de cabecera, límites del buffer, rutas de error, correspondencia entre pines del programa/tabla y ausencia de llamadas de escritura o red; `git diff --check` aprobado. Herramientas descargadas de las fuentes oficiales en un entorno temporal separado; checksum de Arduino CLI verificado y scripts posteriores de instalación de plataforma omitidos. No se modificaron configuraciones Arduino globales.

La prueba física, el puerto/driver USB y la compatibilidad de los stickers requieren el equipo real; no se dan por aprobados por una compilación. No se conectó o flasheó ninguna placa ni se modificó Proper o su inventario.

Con esas versiones instaladas, la comprobación se reproduce con:

```sh
arduino-cli compile --fqbn esp32:esp32:esp32 firmware/rc522-diagnostic
```

Entrega en rama `feat/rc522-diagnostic`, desde main `118d151`, con PR borrador. El alcance/brief físico del PR #63 e idiomas/PR #62 permanecen separados.

## Fuentes primarias

- [Espressif · ESP32-DevKitC, referencia de GPIO/alimentación](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html). Se usan nombres GPIO, sin afirmar que la placa del fundador sea esa revisión oficial.
- [NXP · MFRC522](https://www.nxp.com/docs/en/data-sheet/MFRC522.pdf).
- [Biblioteca MFRC522 · API y ejemplo del mantenedor](https://github.com/miguelbalboa/rfid).
- [Espressif · instalar Arduino-ESP32](https://docs.espressif.com/projects/arduino-esp32/en/latest/installing.html).
