# Spool Vault: proyecto de producto
Actualizado: 2026-09-07. Paquete de continuidad, no una copia sincronizada del repositorio.

## Objetivo
Separar el desarrollo comercial de Spool Vault del proyecto personal Impresión 3D.
Organizar contexto, marca, investigación, negocio y producto sin reconstruir este chat.

## Qué se migra y qué no
- Migrar contexto de producto y conversaciones relevantes de Spool Vault.
- Mantener los chats de pintura, resina y hobby general en Impresión 3D.
- No cambiar hosting, dominio público, base de datos, cuentas ni repositorio.
- No trasladar secretos, inventario personal, datos de probadores ni archivos privados de impresión.
- No borrar el proyecto anterior ni mover carpetas locales automáticamente.
- Crear un proyecto de ChatGPT no conecta por sí mismo el repositorio ni las herramientas.

## Carga inicial
1. Crear un proyecto privado llamado Spool Vault. No invitar colaboradores todavía.
2. Usar 01_INSTRUCCIONES_PROYECTO.md como instrucciones del proyecto.
3. Agregar estos nueve documentos como fuentes. Para trabajar rápido, cada chat lee primero 02 y 03 y luego solo el archivo de su área.
4. Crear los seis chats definidos en 07_CHATS.md y usar su mensaje de arranque.
5. Mover manualmente los chats de Spool Vault mediante la opción disponible en ChatGPT; si un chat no admite traslado, conservarlo y aportar su resumen. No declarar la migración completa sin comprobarla.
6. En el chat de Desarrollo, vincular el repositorio existente y comprobar accesos a GitHub, Vercel y Supabase por separado.
7. Pedir al chat de Dirección que enumere decisiones confirmadas y pendientes antes de abrir nuevas iniciativas.

## Fuentes maestras
El código y los documentos operativos viven en https://github.com/Luch1f3rchoCR/spool-vault.
Producción: https://spool-vault.vercel.app/.
Los archivos ROADMAP.md, ATOMICITY_AUDIT.md, TESTER_PROGRAM.md, RESEND_SETUP.md y PRODUCT_EXPANSION_PLAN.md son las referencias técnicas maestras.
PROJECT_CONTEXT.md es el punto de entrada del repositorio y resume decisiones, evidencia y nuevas líneas de trabajo. Al preparar otra copia del paquete, contrastarla con ese archivo y el commit actual.
La carpeta docs/chatgpt contiene este paquete. Los documentos adjuntos en ChatGPT son una instantánea: actualizar los modificados después de cada bloque, no asumir sincronización automática.

## Continuidad PC y Mac
La ruta local depende del equipo. Abrir el clon existente, comprobar rama/commit y cambios locales antes de sincronizar.
No crear otro backend para trabajar desde Mac. Las credenciales se configuran de forma privada en cada entorno; nunca viajan en este paquete.
Si un chat no puede leer GitHub o los archivos, debe decirlo y trabajar con la fecha de la última instantánea, sin afirmar acceso en vivo.

## Estado de la migración
- [x] Contexto y mensajes iniciales preparados.
- [x] Primera recepción real de bienvenida documentada, en spam.
- [ ] Proyecto privado creado y URL registrada.
- [ ] Fuentes cargadas e instrucciones aplicadas.
- [ ] Chats creados dentro del proyecto.
- [ ] Historial relevante trasladado o resumido.
- [ ] Desarrollo reconectado al repositorio existente.
- [ ] Prueba de continuidad desde la Mac.

Guía oficial consultada: [Proyectos y chats](https://learn.chatgpt.com/es-419/docs/projects). Los proyectos agrupan chats, fuentes e instrucciones; una carpeta local no queda accesible automáticamente.
