# Proper — Project Ledger / STATUS

Actualizado: 2026-10-21.

Este archivo inicia la capa administrativa del Project Ledger. No reemplaza el estado técnico detallado de `PROJECT_CONTEXT.md` ni el checklist de implementación de `../ROADMAP.md`; los resume por frente a medida que cada chat completa su sincronización inicial.

## 04 · Modelo de negocio — estado sincronizado

### CONFIRMADO ACTUAL

- No hay precios comerciales aprobados, ingresos validados ni contratos de proveedores documentados.
- `founder_personal_v1` conserva su alcance personal, gratuito y sin vencimiento para la versión documentada; no incluye automáticamente todos los servicios o planes futuros.
- Proper debe validar el ecosistema de proveedores antes de construirlo. Marketplace, catálogo, checkout y venta integrada son visión futura, no funciones actuales.
- La primera fase de proveedores es descubrimiento: entender necesidades, validar interés real, propuesta de valor y modelo comercial antes de integrar catálogos o procesar ventas.
- Alcance inicial de descubrimiento: cohorte pequeña de 3–8 proveedores accesibles en Costa Rica, con diversidad suficiente para aprender y posibilidad de escalar el modelo a otros mercados.
- La experiencia del maker sigue siendo el centro; una eventual capa comercial no debe convertir Proper en una interfaz dominada por publicidad.
- No se fija todavía comisión, suscripción, lead fee, afiliación, pricing público ni pasarela de pago.

### ANTECEDENTE CONFIRMADO

- El plan del 2026-08-30 fijó comparador de ofertas + canal referido como primer market con checkout del proveedor.
- El 2026-09-26 el fundador reabrió esa elección y ordenó validar alternativas antes de construir. Ver `docs/decisions/DEC-2026-09-26-provider-ecosystem-validation.md`.
- El producto ya soporta compras, proveedores personales, inventario, proyectos, producción y costos; esto no equivale a un marketplace ni a relaciones comerciales con proveedores.

### PREFERENCIA DE TRABAJO

- Separar HECHO / HIPÓTESIS / PROPUESTA / DECISIÓN.
- Distinguir funciones disponibles, funciones futuras y pruebas manuales.
- No usar entusiasmo o interés educado como validación comercial.
- Trabajar una decisión por vez y no integrar pagos ni fijar precios públicos antes de la evidencia correspondiente.

### EXPLORADO / PROPUESTO

Sin aprobación como modelo final:

- reposición contextual / referral con checkout externo;
- red de proveedores / leads;
- marketplace transaccional;
- eventual SaaS B2B para proveedores;
- piloto manual de reposición (“shadow commerce”) como experimento mínimo;
- monetización por comisión, oportunidad calificada, suscripción, afiliación o posición patrocinada.

### PENDIENTE

- Inventariar costos reales de hosting, base, storage, correo, soporte, trabajo del fundador y adquisición.
- Validar disposición de pago del usuario sin fijar pricing público prematuramente.
- Diseñar scorecard y entrevista para proveedores.
- Identificar y entrevistar 3–8 candidatos en Costa Rica.
- Definir señales y umbrales del piloto antes de ejecutarlo.
- Elegir, con evidencia, si el siguiente paso es no construir, ejecutar un piloto manual o diseñar una capacidad de producto.
- Antes de checkout nativo: resolver explícitamente pagos, facturación, impuestos, garantías, devoluciones, inventario/stock, fulfillment, privacidad y responsabilidad de Proper.

## Contradicciones / coordinación

La única contradicción durable encontrada en este frente era la elección cerrada de “comparador + referral” del plan de agosto frente a la dirección posterior de validar varios modelos. Queda reconciliada como historial: la elección antigua se considera superada como compromiso, no rechazada como hipótesis.

No se detectó una decisión posterior que apruebe pricing, monetización o un marketplace concreto.
