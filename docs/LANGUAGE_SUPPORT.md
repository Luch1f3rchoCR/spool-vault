# Idioma de la app · checklist pendiente

Solicitud reafirmada por el fundador el 29 de octubre de 2026. Desarrolla el pendiente existente de «Multimoneda y perfil» en `ROADMAP.md`; no es una función implementada ni publicada.

## Resultado esperado

La persona puede elegir el idioma de la interfaz y conservar su elección. Cambian los textos y su presentación, sin alterar inventario, costos históricos, monedas, archivos o nombres ingresados por el usuario.

## Checklist de implementación

- [ ] Confirmar los idiomas y variantes regionales iniciales. No dar inglés u otro idioma por aprobado todavía.
- [ ] Definir comportamiento inicial, fallback y persistencia para cuenta autenticada y modo local/demo, conservando la interfaz española durante la transición.
- [ ] Reutilizar Perfil / Configuración para la elección de idioma, sin duplicar preferencias ni asociar automáticamente una moneda al idioma.
- [ ] Preparar recursos de traducción y pasar los textos por módulos acotados; conservar marca, navegación y contratos de los formularios aprobados.
- [ ] Incluir etiquetas, botones, ayudas, estados vacíos, confirmaciones, progreso, errores y textos de accesibilidad. Mantener códigos de error identificables sin exponer detalles internos.
- [ ] Adaptar fechas, números, cantidades y presentación de importes. Preservar monedas, unidades y significado de fechas/horas; cambiar idioma no convierte dinero.
- [ ] Verificar la entrada de decimales según la presentación elegida, sin reinterpretar o reescribir valores históricos, fechas de compra o cantidades guardadas.
- [ ] Revisar textos y plurales con personas que dominen cada idioma; definir cómo se informa una traducción faltante.
- [ ] Probar persistencia/fallback, teclado, lectores de pantalla y textos largos en 320/390 px y escritorio.
- [ ] Publicar por bloques verificados y registrar los módulos/idiomas disponibles; no anunciar toda la app traducida antes de completar el alcance aprobado.

## Decisiones pendientes y límites

Idiomas iniciales, fallback final y almacenamiento de la preferencia requieren definición antes de implementar. Esta tarea documental no añade selector, dependencias, esquema, traducciones parciales o migraciones.

No traducir automáticamente nombres de filamentos, proyectos, proveedores, notas o archivos del usuario. Correos y PDF/exportaciones requieren una decisión explícita sobre su idioma al abordar cada canal; no asumir que cambiar la interfaz los modifica.

`ROADMAP.md` permanece reservado por el PR #45 de Marketing. Este checklist mantiene la continuidad sin tocar sus archivos; integrar su referencia al roadmap cuando ese frente se libere.
