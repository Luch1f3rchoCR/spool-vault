# Handoff · 02 Clientes/Piloto → Producto/Desarrollo

**Fecha:** 2026-10-21  
**Tema:** alinear Proper Founder Personal con el programa beta aprobado

## Decisión de origen

Ver [DEC-2026-09-26-founder-personal-beta.md](../decisions/DEC-2026-09-26-founder-personal-beta.md).

La política vigente del programa es:

- beta personal de 14 días;
- recompensa **Proper Founder Personal lifetime** después de completar razonablemente el piloto;
- no enterprise;
- no obligación de reseña positiva.

## Comportamiento técnico actual

Según `TESTER_PROGRAM.md` y PR #23, la invitación elegible completa el cuestionario de primer ingreso y la membresía `founder_personal_v1` se activa dentro de ese flujo.

Por tanto:

**política aprobada ≠ comportamiento técnico actual.**

## Solicitud a Desarrollo

No implementar desde este handoff sin cerrar una spec.

Preparar una spec que defina:

1. cómo distinguir invitado beta, participante activo, piloto completado y Founder otorgado;
2. quién puede marcar el cumplimiento;
3. qué ocurre si alguien abandona;
4. cómo preservar idempotencia, autorización e historial;
5. cómo migrar/interpretar invitados ya existentes;
6. qué UI administrativa necesita el fundador;
7. qué copy ve el participante antes y después de completar;
8. cómo evitar revocar accidentalmente beneficios ya otorgados.

## Bloqueo adicional

El repo todavía no documenta un recorrido real end-to-end completado por el primer invitado. Mantener ese cierre como requisito antes de ampliar el lote.

## Fuera de alcance

- pricing;
- enterprise;
- workspaces;
- billing;
- reclutamiento de candidatos.
