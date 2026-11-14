# ADR-100 — Teacher: primera generación con selección IA explícita

> Estado: propuesto; decisión funcional confirmada por el usuario el2026-11-14.
> Fecha: 2026-11-14.

## Contexto

El usuario no podía crear un plan ni cambiar razonamiento. Además de pérdida de
metadatos y estados Client incorrectos, la política anterior exigía recibos de
calificación por conexión/modelo/esfuerzo y por algunos propósitos. Cambiar el
esfuerzo podía exigir un canary previo aunque el proveedor ofreciera esa opción.

Consultado expresamente, el usuario eligió **«Permitir crear con la IA elegida,
sin validación previa»**. La propia creación puede ser el primer intento real;
si falla, debe informarse sin perder el borrador ni repetir una inferencia
incierta. Esta decisión es específica de Teacher: no elimina verificaciones de
ingeniería de91 ni gates de otros dominios/modalidades o del chat NodiaAI.

## Opciones consideradas

### Opción A — Exigir un recibo generativo previo por selección

- Ventajas: dispone de una observación de texto anterior para esa combinación.
- Desventajas: bloquea el primer uso y cambios ordinarios de razonamiento;
  obliga a una operación generativa adicional y no garantiza el resultado futuro.

### Opción B — Primer intento directo con selección explícita

- Ventajas: el plan utiliza la IA elegida sin canary obligatorio; la disponibilidad
  no generativa y el resultado del intento tienen estados diferentes.
- Desventajas: el proveedor puede rechazar la primera generación. Requiere
  conservar borrador, categorías de error y recuperación del resultado incierto.

### Opción C — Ejecutar automáticamente un canary al cambiar selección

- Ventajas: automatiza el antiguo requisito.
- Desventajas: consume una inferencia que la persona no solicitó como contenido,
  aumenta coste/latencia y mantiene el acoplamiento al recibo. Descartada.

## Decisión

Aplicar B por solicitud explícita. Elegibilidad significa que se puede solicitar
la generación, no éxito remoto ni calidad pedagógica comprobados. API key valida
configuración/credencial/selección; Agentic observa disponibilidad/sesión/opciones
reales sin generar. El Worker revalida antes del envío. No se inventan modelos,
razonamientos, capacidades o sustituciones ante fallos.

En Agentic la admisión conserva la identidad y generación de configuración;
un job nuevo puede no tener todavía `session_generation`. Antes de claim se
observa el runtime fuera de transacciones. Claim revalida autoridad, selección y
generación y captura la sesión/recurso reales antes de reservar la operación.
La ejecución vuelve a comprobar la identidad observada antes del POST. El proceso
Worker no depende de una caché de elegibilidad del proceso API ni de un recibo
de calificación fabricado. La columna de sesión existente admite null; no se
añade una tabla/migración para fingir evidencia generativa.

Los recibos y diagnósticos históricos se conservan. Las comprobaciones canary
explícitas pueden seguir como diagnóstico opcional, separado de admisión.
No reescribir pruebas/hashes ni transferir una observación de otra selección.
Un trabajo previo o resultado incierto conserva sus límites de recuperación;
esta decisión no autoriza reenviarlo ni cambiar su selección en vuelo.

## Consecuencias

- Crear plan/material usa exactamente conexión, modo, modelo y razonamiento
  elegidos, con el presupuesto, ownership, fences, idempotencia y cierre comunes.
- Un cambio de configuración, sesión o autoridad entre observación y claim/envío
  detiene el intento. Nunca se realiza I/O nativo bajo locks de autoridad/DB.
- Fallos conocidos se muestran y conservan borrador; resultados remotos inciertos
  permanecen unknown con conciliación explícita y sin replay.
- La observación de modelos Teacher está acotada a la conexión seleccionada y
  a identidades configuradas, sin activar modelos ni guardar preferencias.
- La aceptación del código y su adopción/inferencia real se registran por separado
  en96/evidencia. Esta decisión funcional no aprueba este ADR ni publica fichas.

## Referencias

- [Producto95](../../mvp/95-studies-adaptive-learning.md),
  [implementación96](../../mvp/96-nodia-teacher-implementation-plan.md) y
  [contratos97](../../mvp/97-nodia-teacher-technical-contracts.md).
- [Verificación91](../../mvp/91-ai-provider-onboarding-verification.md),
  [política Teacher](../../../nodia-server/src/ai-generation/teacher-qualification-policy.ts)
  y [runtime](../../../nodia-server/src/ai-generation/teacher-generation-runtime.service.ts).
