# Proper V1 · implementación y entrega

Corte: 2026-09-26. Autorización: paquete entregado por el fundador el 25; solicitud explícita de subir/publicar el 26. Este bloque no añade funciones, formularios ni infraestructura.

## Fuente y trazabilidad

- Fuente: `proper-asset-pack-v1`, entregado por el chat de Marca. Se conservan sin editar `00_HANDOFF_DESARROLLO.md`, `09_PROPER_BRAND_V1.md` y `MANIFEST.json` como referencias originales. Sus rutas relativas describen el **paquete completo de origen**, no esta selección de integración.
- `MANIFEST.json` inventaría el paquete completo. Solo se copiaron los assets necesarios a `public/brand/proper-v1/` y los tokens a `app/brand/`; las pruebas comparan sus SHA-256 byte por byte. `app/icon.svg` coincide con el icono principal entregado.
- Los vectores entregados son reconstrucciones incluidas en el paquete desde las láminas aprobadas, no archivos originales del diseñador ni variantes nuevas aprobadas por Desarrollo. No se redibujaron ni deformaron.
- No se reutilizó la fotografía del mockup como recurso independiente.

## Implementado

| Token exacto | HEX | Uso |
| --- | --- | --- |
| Proper Green | #23634B | Acciones primarias y selección |
| Ink | #192C24 | Texto principal y navegación móvil |
| Surface | #F5F5F2 | Superficie secundaria disponible |
| Paper | #FFFFFF | Tarjetas, controles y modales |
| Muted | #58695E | Texto secundario y ayudas |
| Soft Sage | #E8EFE5 | Selección, hover suave y apoyo |
| Line | #E1E5DA | Bordes y separadores |
| Warm Canvas | #F8F4EB | Fondo principal y cabeceras de modal |
| Clay | #C76F56 | Punto y detalles decorativos; no texto funcional |

- Wordmark oficial suministrado en header y firma reutilizable en acceso, primer ingreso y footer. Tagline y promesa literales del paquete.
- Favicon SVG/ICO/PNG, icono Apple y PWA Android 192/512 del paquete. Iconos con `purpose: any`: no se declara una variante maskable inexistente.
- Metadatos y etiquetas visibles de instalación dicen Proper; `start_url`, rutas, identidad de almacenamiento, service worker, repo, Vercel, Supabase y dominios no se migran. La instrucción de aplicar marca visible se distingue de renombrar identificadores internos.
- DM Sans/Manrope se mantienen: el paquete no define una nueva tipografía para la UI. No se reconstruye el wordmark con texto.
- Solo tema claro. Estados semánticos preexistentes, bloqueo de operaciones, foco, navegación por teclado y reduced-motion se conservan. No se afirma una auditoría WCAG integral.
- Solicitud adicional del 26 de septiembre: Elegoo en la lista compartida de marcas (alta, edición, órdenes y filtros), sin modificar registros anteriores. El inventario independiente de insumos confirmado ese día es el siguiente bloque funcional, no parte de esta entrega gráfica.

## Verificación

- Compilación Next.js/TypeScript aprobada.
- 12 pruebas: integridad de assets/tokens, copy/iconos/contraste, variantes de proyectos y bienvenida. Pares de texto Ink/Paper, Muted/Paper, Muted/Warm Canvas y Paper/Green superan 4.5:1.
- Navegador local: inventario, proyectos, apertura de registro de impresión y costos, compras/nueva orden. En móvil 320/390 px no se detecta desbordamiento horizontal del documento/modal; escritorio 1280 px revisado.
- Proyecto de QA creado **solo en almacenamiento local**, sin Supabase configurado; cero corridas cerradas, inventario de muestra conservado en 1475 g. No se enviaron correos ni se guardaron datos de producción.
- Primer ingreso: cambio de presentación únicamente; no se modificó su flujo/RPC. No equivale a una activación real ni a instalación PWA en iOS/Android.
- Publicación: autorizada; el PR de `feat/proper-brand-v1` debe registrar merge SHA, despliegue exacto de Vercel y humo de producción. No inferir publicación por una compilación local.

## Pendientes y límites para beta

1. Recibir SVG oficial de Stone Collective; se omite el endorsement visual hasta entonces, sin placeholder ni logo recreado.
2. Confirmar una invitación real: entrega del correo, enlace, acceso, cuestionario único, activación y posterior edición de impresoras. Verificar que el cuestionario no se repita. No ampliar el grupo basándose solo en pruebas locales.
3. Revisar en otro bloque marca visible de las plantillas de correo, remitente/Reply-To y entregabilidad. Los correos existentes no se cambiaron ni enviaron aquí. Autenticación y bienvenida son sistemas distintos.
4. Instalación PWA real y revisión jurídica/comercial de naming siguen pendientes; no afirmar que este bloque los resuelve.
5. Cotizaciones, navegación nueva y reestructuración de formularios siguen fuera de alcance; conservar aprobaciones anteriores sin prometer implementación.

## Proveedores y captación

Puede prepararse una conversación exploratoria sobre interés, catálogo, disponibilidad/precios, enlaces de compra y posibilidades de API o CSV. El piloto de referencia no exige API ni checkout propio; la compra integrada sigue siendo expansión futura. No prometer integración lista, ventas, comisiones o exclusividad sin acordarlo. No se contactó a proveedores ni se enviaron nuevas invitaciones en este bloque.
