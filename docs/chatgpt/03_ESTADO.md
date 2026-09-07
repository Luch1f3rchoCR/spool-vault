# Estado y siguiente trabajo
Corte: 2026-09-07. Última versión de aplicación verificada en este corte: 96ed8dc (PR #20).

## Evidencia reciente
- Panel lateral compilado y probado con administrador/probador en 320, 390 y 1280 px.
- Producción HTTP 200, recursos nuevos presentes, acceso abre, endpoint administrativo rechaza peticiones anónimas.
- Borradores al regresar, foco de teclado y bloqueo durante operaciones comprobados con pruebas simuladas.
- El fundador aprobó visualmente la navegación nueva.
- El fundador se envió una bienvenida real: llegó a Gmail, a spam, con remitente hello@stonecollective.dev y diseño aprobado.
- Esto confirma una recepción, no entregabilidad general ni llegada a bandeja principal.

## Prioridades propuestas
| Orden | Resultado | Criterio de cierre |
| --- | --- | --- |
| 1 | Proyecto propio y contexto portátil | Fuentes disponibles, seis chats y prueba de continuidad |
| 2 | Marca mínima coherente | Arquitectura, voz y dirección visual aprobadas antes de producir activos |
| 3 | Incorporación confiable | Enlace y activación probados; correo de acceso revisado aparte |
| 4 | Piloto pequeño | Invitaciones consentidas, tareas claras y registro de hallazgos |
| 5 | Validación de cliente y negocio | Entrevistas documentadas y comparación de hipótesis con evidencia |

Orden propuesto, no compromiso de fechas ni de gasto.

## Riesgos y pendientes
- El fundador aportará contexto de Stone Collective CR y artes en borrador. Revisarlos antes de definir identidad final y relación de marcas.
- Bienvenida en spam. Revisar autenticación/alineación del remitente y evidencia del proveedor; la captura sola no identifica la causa.
- Supabase Auth: SMTP propio y límites del correo de acceso pendientes por separado.
- Buzón/reenvío/Reply-To para hello no confirmado.
- QR y PWA requieren terminar validación en iPhone y Android reales.
- No vender lectura universal NFC ni automatización de Bambu/AMS.
- No hay workspaces multiusuario ni planes cobrables publicados.
- Exportación JSON disponible; restauración automática y eliminación de cuenta no confirmadas como implementadas.
- La comparación de proveedores y conector local AMS siguen como expansión futura.
- Revisar permisos, respaldos, privacidad y condiciones antes de ampliar el piloto o comercializar.

## Fuente de verdad
ROADMAP.md detalla implementación; ATOMICITY_AUDIT.md detalla contratos de datos.
Un checklist agregado puede ir detrás de sus tareas hijas. Verificar código/pruebas antes de afirmar que una fase completa está cerrada.
No marcar una hipótesis comercial como implementada por estar descrita en PRODUCT_EXPANSION_PLAN.md.
