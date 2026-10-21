# Project Ledger · estado actual

Actualizado: 2026-10-21  
Frentes sincronizados en el Project Ledger: **Marca e Identidad**; **Clientes y Piloto**.

Este archivo inicia la capa administrativa común del Project Ledger sin reemplazar los documentos técnicos existentes.

## Fuentes de verdad

- Estado transversal y continuidad técnica: [../PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md)
- Roadmap detallado del producto: [../ROADMAP.md](../ROADMAP.md)
- Estado vigente de marca: [BRAND_STATUS.md](./BRAND_STATUS.md)
- Identidad Proper V1: [brand/proper-v1/09_PROPER_BRAND_V1.md](./brand/proper-v1/09_PROPER_BRAND_V1.md)
- Implementación Proper V1: [brand/proper-v1/IMPLEMENTATION.md](./brand/proper-v1/IMPLEMENTATION.md)
- Decisiones formales: [decisions/](./decisions/)
- Handoffs formales: [handoffs/](./handoffs/)
- Hitos administrativos: [WORKLOG.md](./WORKLOG.md)

## Marca e Identidad · CONFIRMADO ACTUAL

- **Proper** es la working brand aprobada para producto y presencia pública, pendiente de clearance legal/comercial especializado.
- Wordmark aprobado: **Proper.**, con punto Proper Clay.
- App icon aprobado: fondo Ink, P blanca/Paper y punto Proper Clay.
- Tagline exacto: **Everything behind your prints.**
- Promesa exacta: **Simple para empezar. Potente para crecer.**
- Posicionamiento: herramienta maker moderna que acompaña desde inventario personal hasta una operación de producción completa, sin sentirse como un ERP.
- Personalidad: amable, firme, moderna, clara y maker.
- Stone Collective funciona como endorsement secundario; no domina ni se fusiona con Proper.
- La marca visible puede usar Proper, pero repo, URL, Supabase, Vercel, remitentes e identificadores técnicos heredados no se renombran sin una decisión separada.
- El paquete Proper V1 y su integración existen en el repo; los assets derivados no sustituyen las referencias visuales aprobadas si aparece una discrepancia geométrica.

## Social · estado actual

- Instagram: `@properformakers`.
- Nombre visible informado por Marketing: **Proper · 3D Print Management**.
- Descriptor contextual: **3D Print Management for Makers**.
- `properformakers` es namespace digital, no nombre ni logo.
- Se produjo un **Proper Social Kit V1** a partir del Asset Pack; en este ledger no consta una aprobación explícita posterior del kit completo ni su incorporación al repositorio, por lo que se mantiene como entregable **pendiente de cierre**.

## Pendientes del frente

- Clearance legal/comercial de Proper.
- Incorporar al proyecto el SVG oficial de Stone Collective antes de usar el endorsement visual definitivo.
- Cerrar aprobación/ingesta durable del Social Kit V1 y su handoff final a Marketing.
- Mantener cualquier migración de identificadores técnicos fuera del alcance de Marca hasta una decisión específica.


## Clientes y Piloto · CONFIRMADO ACTUAL

- **Cliente meta estratégico provisional:** **maker emprendedor / profesional independiente de impresión 3D**. Está definido como dirección estratégica, **no validado comercialmente**.
- **Cliente secundario:** maker serio / hobby avanzado.
- **Expansión futura:** microempresa / taller; debe influir en decisiones estructurales futuras sin convertir hoy Proper en un ERP.
- Escalera de crecimiento: **hobby casual → maker serio → side business → profesional independiente → microempresa → taller/equipo**.
- Primer beta estructurado: **usuarios finales individuales**, no licencias empresariales.
- Cohorte aprobada: **8 testers activos + 2 suplentes**, durante **14 días**.
- Recompensa: **Proper Founder Personal**, gratuita y lifetime para el alcance personal incluido, después de completar razonablemente el piloto.
- Founder Personal no incluye enterprise, workspaces, miembros, futuros servicios externos ni todos los futuros planes.
- No se exige reseña positiva, publicación ni recomendación.
- Reclutamiento: priorizar candidatos directos; complementar con comunidades especializadas y redes propias de Proper. Marketing atrae/comunica; Clientes/Piloto selecciona.
- El primer recorrido real invitación → correo → login → cuestionario → estado final sigue sin evidencia end-to-end de cierre en el repo; no ampliar invitaciones antes de cerrarlo.

### Antecedente confirmado

- El plan inicial comparaba aficionado, creador que vende y taller sin validar ninguno.
- PR #23 publicó primer ingreso e implementación de `founder_personal_v1`.
- La implementación actual activa la membresía durante el primer ingreso elegible.
- La primera bienvenida real llegó a Gmail/spam el 7 de septiembre; no probó el recorrido completo.
- El alcance histórico de `founder_personal_v1` ya era personal, gratuito, sin vencimiento y excluía futuros servicios/planes adicionales.

### Preferencia de trabajo

- Investigar comportamientos y workarounds reales; evitar preguntas inducidas del tipo “¿te gustaría una app que…?”.
- Registrar fricción, abandono y comentarios negativos, no solo elogios.
- Separar observación, evidencia, interpretación y siguiente prueba.
- No confundir buen beta tester con comprador potencial.
- No reclutar solo amigos ni personas atraídas por el beneficio lifetime.

### Explorado / propuesto, no aprobado como resultado

- Edad, profesión, número de impresoras/rollos y hábitos digitales del buyer persona son hipótesis orientativas que requieren validación.
- Pool previo de 15–20 prospectos y thresholds cuantitativos exactos de éxito siguen como propuestas operativas.
- Maker Faire San José 2027 es una oportunidad explorada de Marketing/visibilidad, no un compromiso aprobado desde este frente.

### Pendientes / bloqueos

1. Confirmar end-to-end el primer invitado real.
2. Resolver el desalineamiento **política vs. implementación**: la política otorga Founder Personal tras completar el piloto; la implementación actual lo activa en primer ingreso.
3. Cerrar criterios verificables de “completó razonablemente el piloto”.
4. Construir y poblar la hoja de candidatos fuera del Ledger con los datos personales necesarios.
5. Ejecutar la cohorte 8 + 2 y validar/corregir el cliente meta con evidencia real.
6. Estudiar disposición de pago después; mantener discovery enterprise separado del Founder Personal.

### Coordinación transversal

- Marketing: el fundador informó que las redes de Proper ya existen y se trabaja en las primeras publicaciones. Para beta, Marketing apoya adquisición/comunicación; 02 conserva selección.
- Desarrollo: ver handoff de alineación de Founder antes de escalar invitaciones.
- Naming: 02 usa Proper conforme al sistema vigente del repo; la autoridad de naming/clearance sigue en Marca e Identidad y no se redefine desde este frente.
