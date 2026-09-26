# Proper · Contexto e insumos para desarrollo

## Leer en este orden

1. Este archivo.
2. `references/proper_brand_approved.png` y `references/proper_brand_handoff.png`: aprobación visual original.
3. `docs/09_PROPER_BRAND_V1.md`: decisiones, paleta y límites.
4. `tokens/proper-brand-tokens.css` y `.json`: colores y copy exacto.
5. `references/mockups/README.md`: referencias separadas de login, landing y otros usos.
6. `README.md`: inventario de assets; `lockups/STONE_SLOT.md`: pendiente de Stone.

## Qué está aprobado y qué es un derivado

La dirección aprobada es el wordmark Proper., app icon 02 con fondo verde oscuro, P blanca y punto Proper Clay, y Stone Collective como endorsement secundario. Tagline: **Everything behind your prints.** Promesa: **Simple para empezar. Potente para crecer.** Proper sigue como working brand pendiente de clearance legal/comercial.

Los tableros originales son la referencia visual aprobada. Los SVG y PNG del paquete son reconstrucciones y derivados de producción a partir de esos tableros; no son vectores originales suministrados por el diseñador ni tienen una aprobación posterior independiente. Si se observa una diferencia geométrica, contrastarla con el tablero y corregirla sin cambiar la dirección. No tomar PREVIEW.png como una nueva aprobación de marca.

Los HEX escritos en la paleta se usan como fuente cromática, aunque los mockups ilustrados muestran texturas y variaciones de naranja. No elegir colores nuevos con cuentagotas sobre fotografías.

## Assets para implementación

- Wordmark principal en fondo claro: `svg/wordmark/proper-wordmark-dark.svg`.
- Wordmark sobre fondo oscuro: `svg/wordmark/proper-wordmark-light.svg`.
- Icono principal: `svg/app-icon/proper-appicon-dark.svg`.
- PNG y favicons: directorios `png/` y `favicons/`.
- Stone: falta el SVG oficial; no extraer ni redibujar el wordmark de Stone del mockup. El recorte de endorsement es únicamente referencia de jerarquía.

## Interpretar los mockups

Login, landing, dashboard, móvil, tarjeta y taza están separados en `references/mockups/`. Son recortes exactos del tablero, a su resolución nativa. No son pantallas editables, diseños de alta resolución ni especificaciones completas de responsive, estados o interacciones.

Recrear la interfaz con componentes reales siguiendo la dirección aprobada; no usar la imagen completa del mockup como interfaz. El sitio aparece dentro de una fotografía de laptop. No hay un diseño independiente de página completa ni un fondo fotográfico separado con licencia documentada.

Conservar las funciones, navegación y flujos existentes. Los textos pequeños, datos de muestra, contactos, enlaces, precios, botones y funcionalidades ilustrados no prueban decisiones de producto o implementación. No añadir login social, planes, pedidos u otros módulos únicamente porque aparezcan dibujados. Resolver el detalle de cada pantalla según el alcance de desarrollo autorizado.

## Límites

No renombrar repositorio, URL, Supabase, Vercel, correos ni remitentes. No sobrescribir las fuentes sincronizadas. No confundir la aprobación visual con clearance legal/comercial ni con permiso de despliegue.

## Transferencia a otro chat

Si el chat tiene acceso a esta misma carpeta local, indicarle que lea este archivo: no hace falta subir el ZIP otra vez. Si trabaja en otro entorno, descomprimir el ZIP en su carpeta de trabajo y darle la ruta de este archivo. Si usa fuentes adjuntas de un proyecto sin acceso a la carpeta local, adjuntar el handoff, la guía, los tokens y los dos tableros; entregar además el paquete descomprimido al entorno donde se implementará. No asumir que adjuntar un ZIP vuelve visibles automáticamente todos sus archivos.
