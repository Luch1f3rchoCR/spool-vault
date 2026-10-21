# Proper — Project Ledger · Estado

Actualizado: 2026-10-21

> Este archivo inicia el Project Ledger transversal. En esta sincronización solo se consolida el frente **02 · Clientes y Piloto**. No inferir aquí el estado de otros frentes; deben incorporar sus propios bloques cuando se sincronicen.
>
> Para implementación técnica existente, el checklist histórico sigue en [../ROADMAP.md](../ROADMAP.md) y el punto de continuidad técnica en [../PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md).

## 02 · Clientes y Piloto

### CONFIRMADO ACTUAL

- **Cliente meta estratégico provisional:** el centro de Proper es el **maker emprendedor / profesional independiente de impresión 3D**: imprime con frecuencia, maneja suficiente material/proyectos para necesitar control y puede vender o trabajar por encargo. Está definido como dirección estratégica, **no validado comercialmente**.
- **Cliente secundario:** maker serio / hobby avanzado. Debe poder usar Proper sin complejidad empresarial innecesaria.
- **Expansión futura:** microempresa / taller. Debe influir en decisiones estructurales futuras, pero no convertir hoy Proper en un ERP ni justificar promesas de multiusuario/enterprise.
- **Escalera de producto:** hobby casual → maker serio → side business → profesional independiente → microempresa → taller/equipo.
- **Primer beta estructurado:** programa para **usuarios finales individuales**, no licencias empresariales.
- **Cohorte objetivo:** 8 testers activos + 2 suplentes, con diversidad de experiencia, hardware y dispositivo.
- **Duración objetivo del piloto:** 14 días.
- **Recompensa aprobada:** **Proper Founder Personal**, gratuita y lifetime para el alcance personal incluido, como recompensa por completar razonablemente el piloto. No incluye licencia enterprise, workspaces, futuros servicios externos ni todos los futuros planes.
- La participación **no exige reseña positiva, publicación ni recomendación**.
- Reclutamiento: priorizar personas identificadas directamente; complementar con comunidades especializadas y redes propias de Proper. No optimizar por volumen de formularios sino por calidad de tester.
- La selección final, onboarding, tareas, feedback, criterios de cumplimiento y análisis pertenecen a Clientes/Piloto; Marketing atrae y comunica, pero no selecciona.
- El primer recorrido real de invitación → correo → login seguro → cuestionario → activación **sigue sin evidencia de cierre en el repo**. No ampliar invitaciones hasta cerrarlo.

### ANTECEDENTE CONFIRMADO

- El plan inicial comparaba tres segmentos sin validarlos: aficionado con varios rollos, creador que vende piezas y taller pequeño.
- El producto ya implementa administración privada de probadores, invitaciones, primer ingreso y `founder_personal_v1`.
- La implementación publicada por PR #23 activa actualmente la membresía durante el primer ingreso elegible.
- Una primera bienvenida real llegó a Gmail/spam el 7 de septiembre; eso no confirmó el recorrido completo posterior.
- El alcance histórico de `founder_personal_v1` ya era personal, gratuito, sin vencimiento y excluía servicios externos y futuros planes adicionales.

### PREFERENCIA DE TRABAJO

- Investigar comportamientos reales y workarounds actuales; evitar preguntas del tipo “¿te gustaría una app que…?”.
- Registrar también abandono, fricción y comentarios negativos.
- Separar observación, evidencia, interpretación y siguiente prueba.
- Un buen beta tester no equivale automáticamente a un comprador potencial.
- No reclutar solo amigos ni solo personas atraídas por “lifetime gratis”.
- Trabajar un experimento por vez y cerrar con evidencia, interpretación y siguiente prueba.

### EXPLORADO / PROPUESTO

- Edad, profesión, número de impresoras/rollos y hábitos digitales del buyer persona se han usado como hipótesis orientativas de diseño/marketing; todavía requieren validación.
- Un pool previo de 15–20 prospectos para elegir 8 + 2 es una propuesta de operación, no una métrica aprobada.
- Thresholds cuantitativos exactos de éxito del piloto todavía no están aprobados.
- Maker Faire San José 2027 se exploró como oportunidad de Marketing/visibilidad; no existe en este frente una participación ni deadline oficial aprobado.

### PENDIENTE / BLOQUEOS

1. Confirmar end-to-end el primer invitado real antes de ampliar la cohorte.
2. Resolver el **desalineamiento entre política y comportamiento técnico**: la política del beta otorga Founder Personal tras completar el piloto; la implementación actual activa `founder_personal_v1` durante el primer ingreso.
3. Cerrar criterios verificables de “completó razonablemente el piloto”.
4. Construir y poblar la hoja de candidatos sin guardar datos personales sensibles en el Ledger.
5. Reclutar, seleccionar y ejecutar la cohorte 8 + 2.
6. Validar o corregir el cliente meta con evidencia de uso real; después estudiar disposición de pago.
7. Mantener discovery enterprise separado del Founder Personal.

### COORDINACIÓN TRANSVERSAL

- Marketing: las redes de Proper ya existen y el fundador reportó que se trabaja en las primeras publicaciones. Para beta, Marketing debe comunicar/atraer; Clientes/Piloto decide selección.
- Desarrollo: debe revisar el handoff sobre el momento de otorgamiento de Founder Personal antes de escalar invitaciones.
- Marca/Dirección: este chat trata Proper como nombre comercial vigente según instrucción posterior del fundador. [BRAND_STATUS.md](./BRAND_STATUS.md) todavía conserva wording de “marca de trabajo” y clearance pendiente; no se modifica desde Clientes/Piloto. El clearance jurídico puede seguir pendiente aunque el nombre esté aprobado operativamente.
