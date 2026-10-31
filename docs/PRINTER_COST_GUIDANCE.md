# Ayudas de potencia y tarifa por impresora

Bloque del 28 de octubre de 2026, rama `feat/printer-cost-guidance`, desde main `d5bd0112f508d370fb507802b533706808e9746b` (PR #59 publicado). Surge de la dificultad del fundador para llenar los campos de su P1S en Perfil → Mis impresoras.

## Implementado

- Ayuda visible asociada con `aria-describedby` para potencia promedio, costo de máquina por hora y moneda.
- Potencia expresada como consumo medio durante la impresión, diferenciada de la potencia máxima de etiqueta; no se inventan especificaciones o mediciones de un modelo.
- Se muestra el valor de Perfil que se hereda al dejar vacío el campo; si la potencia de Perfil falta, se indica. La tarifa heredada permanece en la moneda de costos de Perfil.
- Diferencia explícita entre vacío (heredar) y cero (excluir el costo de máquina). Electricidad, filamento y mano de obra se mantienen separados del desgaste/mantenimiento.
- Ayuda desplegable por teclado con ejemplo ilustrativo: ₡300.000 / 3.000 horas = ₡100 por hora, antes de mantenimiento. No es una recomendación para P1S, no calcula tarifas, no rellena campos ni guarda datos.
- Se reutiliza el mismo formulario desde Perfil y Proyectos. Sin cambios en validaciones, callbacks, payload, preferencia monetaria, cálculos, historial o persistencia.

## Verificación

- TypeScript, revisión del diff, `git diff --check` y un build de producción aprobados.
- Smoke dirigido de la compilación en 320/390/1280 px, desde Perfil y desde Proyectos, con cuenta/impresora/respuestas ficticias y tráfico externo bloqueado.
- Se verifican ayudas enlazadas, apertura con Enter, ausencia de desbordamiento, potencia heredada presente/ausente, moneda propia frente a moneda de Perfil, ejemplo sin efectos y cancelación.
- Respuesta de guardado simulada: campos vacíos siguen enviando null; tarifa explícita 0 sigue enviando 0. Sin llamadas reales, correos o errores de página. El mock incluye la comprobación de membresía que Perfil ya ejecuta.
- Script temporal: `/private/tmp/proper-printer-guidance-smoke.cjs`. Capturas: `/private/tmp/proper-printer-guidance-{320,390,1280}.png`. No se añade una suite permanente para este cambio de ayuda/copy.

## Entrega

Rama respaldada mediante PR borrador; pendiente revisión/publicación de estas ayudas. El historial de PR #59 sí está publicado en `d5bd011`, Vercel production `dpl_GxET14fwuHeA357vUrT8qBrkxSqe`, READY; no confundir ambas entregas. No se modificó la documentación reservada por Marketing ni el PR #55.
