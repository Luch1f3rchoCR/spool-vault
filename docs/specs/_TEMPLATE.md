# <ID> — <Nombre corto>

**Estado:** DRAFT
**Tipo:** Feature | Bug | Refactor | Infra
**Ejecutor:** Sin asignar

## Problema

¿Qué problema real existe hoy?

Describir el comportamiento o limitación actual sin proponer todavía una solución innecesariamente específica.

## Objetivo

¿Qué debe quedar cierto cuando esta spec esté terminada?

Una frase clara y comprobable.

## Contexto relevante

Leer únicamente lo necesario para esta tarea.

- `AGENTS.md`
- <archivo o sección relevante>
- <contrato relevante, si aplica>

## Decisiones cerradas

- <decisión ya tomada>
- <decisión ya tomada>

Estas decisiones no deben reabrirse durante la implementación salvo que aparezca evidencia nueva que haga imposible o incorrecto el contrato.

## Alcance

- <comportamiento incluido>
- <comportamiento incluido>

## Fuera de alcance

- <algo relacionado que explícitamente no se hará>
- <mejora futura que no pertenece a este bloque>

## Comportamiento / UX esperado

Describir únicamente lo necesario para eliminar ambigüedad.

- <caso principal>
- <estado vacío / error / loading si aplica>
- <responsive o accesibilidad si aplica>

## Datos, seguridad y contratos

Completar solo si aplica.

- Persistencia:
- RLS / autorización:
- Idempotencia:
- Historial / inmutabilidad:
- Monedas / costos:
- Migraciones:
- Compatibilidad local/demo:

Si no aplica, indicar `No aplica`.

## Criterios de aceptación

- [ ] <resultado observable y verificable>
- [ ] <resultado observable y verificable>
- [ ] <caso de error o borde relevante>
- [ ] No se rompe <contrato importante relacionado>

## Verificación requerida

El ejecutor debe registrar evidencia fresca antes de marcar `DONE`.

- [ ] Pruebas específicas del comportamiento
- [ ] Suite relevante del proyecto
- [ ] `npm run build`
- [ ] `git diff --check`
- [ ] Revisión manual/browser si la tarea tiene UI
- [ ] Verificación Supabase/RLS/migración si aplica

Agregar aquí cualquier comprobación específica de esta feature.

## Dependencias y bloqueos

- <PR, feature, migración o decisión necesaria>
- `Ninguno` si puede ejecutarse inmediatamente.

## Hallazgos fuera de alcance

Registrar aquí problemas encontrados durante la implementación que no pertenecen a esta spec.

No corregirlos silenciosamente.

## Evidencia de cierre

Completar durante `VERIFYING`.

- Rama:
- Commit:
- Pruebas ejecutadas:
- Resultado:
- PR:
- Notas:

## Preguntas abiertas

Las preguntas materiales deben resolverse antes de pasar a `READY`.

- <pregunta>

Si no quedan preguntas: `Ninguna`.
