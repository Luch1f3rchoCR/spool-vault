// Proper: read-only bench diagnostic for a classic ESP32 and an RC522 over SPI.
// This is serial-monitor output, not the app's future reader protocol.
#include <Arduino.h>
#include <SPI.h>
#include <MFRC522.h>

#if !defined(ARDUINO_ARCH_ESP32) || !defined(CONFIG_IDF_TARGET_ESP32)
#error "Select a classic ESP32 target (ESP32 Dev Module), not S2/S3/C3."
#endif

constexpr uint8_t kSck = 18;
constexpr uint8_t kMiso = 19;
constexpr uint8_t kMosi = 23;
constexpr uint8_t kSelect = 21;  // RC522 SDA/SS is chip select in SPI mode.
constexpr uint8_t kReset = 22;
MFRC522 reader(kSelect, kReset);
bool readerReady = false;

void printHexByte(byte value) {
  if (value < 0x10) Serial.print('0');
  Serial.print(value, HEX);
}

void inspectType2Header() {
  byte buffer[18];
  byte size = sizeof(buffer);
  const MFRC522::StatusCode status = reader.MIFARE_Read(0, buffer, &size);
  if (status != MFRC522::STATUS_OK) {
    Serial.print("No se pudo leer la cabecera: ");
    Serial.println(reader.GetStatusCodeName(status));
    return;
  }
  if (size < 16) {
    Serial.println("Cabecera incompleta; no se interpreta capacidad.");
    return;
  }
  Serial.print("Pagina 3 / Capability Container: ");
  for (byte i = 12; i < 16; ++i) {
    printHexByte(buffer[i]);
    Serial.print(i == 15 ? '\n' : ' ');
  }
  if (buffer[12] == 0xE1) {
    Serial.print("Cabecera NDEF Type 2 reconocida. Bytes anunciados por CC: ");
    Serial.println(static_cast<unsigned int>(buffer[14]) * 8U);
    Serial.println("No confirma modelo, contenido NDEF completo ni permiso de escritura.");
  } else {
    Serial.println("No hay cabecera NDEF Type 2 reconocida; no se modifica la etiqueta.");
  }
}

void setup() {
  Serial.begin(115200);
  delay(250);
  Serial.println("\nProper | RC522 diagnostic v0.1 | SOLO LECTURA");
  Serial.println("SPI: SCK=18 MISO=19 MOSI=23 SDA/SS=21 RST=22. RC522 a 3V3.");
  SPI.begin(kSck, kMiso, kMosi, kSelect);
  reader.PCD_Init();
  delay(10);
  const byte version = reader.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.print("Registro de version del lector: 0x");
  printHexByte(version);
  Serial.println();
  readerReady = version != 0x00 && version != 0xFF;
  if (!readerReady) {
    Serial.println("Sin comunicacion fiable. Desconecta USB, revisa alimentacion/cables y reinicia.");
    return;
  }
  Serial.println("Acerca un solo sticker y mantenlo quieto durante la lectura.");
  Serial.println("El UID no es una credencial. Este programa no se conecta a Proper.");
}

void loop() {
  if (!readerReady || !reader.PICC_IsNewCardPresent()) {
    delay(50);
    return;
  }
  if (!reader.PICC_ReadCardSerial()) {
    Serial.println("No se pudo seleccionar la etiqueta. Retirala y vuelve a acercarla.");
    delay(200);
    return;
  }
  Serial.print("\nUID: ");
  for (byte i = 0; i < reader.uid.size; ++i) {
    if (i) Serial.print(':');
    printHexByte(reader.uid.uidByte[i]);
  }
  Serial.print("\nSAK: 0x");
  printHexByte(reader.uid.sak);
  const MFRC522::PICC_Type type = reader.PICC_GetType(reader.uid.sak);
  Serial.print("\nFamilia reportada: ");
  Serial.println(reader.PICC_GetTypeName(type));
  if (type == MFRC522::PICC_TYPE_MIFARE_UL) inspectType2Header();
  else Serial.println("Solo identificacion: este diagnostico no lee memoria de esa familia.");
  reader.PICC_HaltA();
  reader.PCD_StopCrypto1();
  Serial.println("Retira el sticker antes de volver a probar.");
  delay(100);
}
