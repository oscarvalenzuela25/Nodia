# ADR-068 — Timeout de observación y retry durable previo al envío

> Estado: propuesto
> Fecha:2026-10-19

## Contexto

[C05-R04](../../evidence/nodia-ai-ai36-c05-r04-acceptance.md) acredita el loop MCP de CLI1.4.2, pero preferencias vuelve a agotar el plazo y Finanzas se detiene antes de dispatch: la lectura no generativa vence a12,050s con reason agentic_unavailable. Se restauró1.3.1 y no se atribuye a esta comparación una causa upstream ni una mejora estable de latencia.

El adaptador Python combina /usage y models bajo un presupuesto de12s. Si vence el runner individual, conserva ServiceError(agentic_timeout); si vence el contexto externo, TimeoutError se convierte en agentic_unavailable. Ese resultado pierde la distinción entre timeout y otros fallos. ProcessStage agrupa la observación no disponible con cambios de identidad bajo eligibility_changed no reintentable. Por eso no utiliza la política existente de dos retries seguros previos al armado.

## Opciones consideradas

### Reintentar cualquier indisponibilidad o ampliar el plazo de inferencia

- Ventajas: puede superar fallos transitorios.
- Desventajas: confunde pérdida de sesión/configuración con timeout; ampliar120 no corrige el preflight de12 y exige otra política/version/hash/drain. No autoriza reenvíos de inferencias inciertas. Se descarta para este arreglo.

### Conservar categoría y aplicar la política predispatch sólo con identidad estable

- Ventajas: corrige una diferencia reproducible sin nuevos contadores, plazos o fallback; reutiliza retry durable, fence y deadline existentes.
- Desventajas: no resuelve la latencia del proveedor ni los preflights de admisión sin job; exige distinguir con precisión antes/después de armDispatch.

## Decisión

Implementar la segunda opción en el alcance autorizado. Python mapea el TimeoutError externo de _observe a agentic_timeout, invalida snapshot y conserva cierre/liberación. ServiceError mantiene su código, OSError conserva indisponibilidad y CancelledError se propaga. No se inventan autenticación, catálogo o cuota ante timeout.

ProcessStage sólo convierte una observación no disponible en retryable antes de armDispatch si el reason es exactamente agentic_timeout, el contrato es Gemini, el modo es Agentic directo, la señal no está cancelada y resourceKey/sessionGeneration/configurationGeneration siguen coincidiendo con el run. Cambios o ausencias de identidad, sesión/modelo/configuración diferentes, errores genéricos, Web/API y resultados inciertos permanecen sin ese retry.

Reutilizar exclusivamente los dos retries durables1s/3s de la política50: mismo run/job, selección y deadline600; el checkpoint valida el fence vigente y la siguiente reclamación crea su propio intento/fence. No reutilizar un dispatch, reiniciar presupuestos ni llamar al modelo antes de armar. Al recuperar el intento se revalidan autoridad, observación y datos antes del envío. Después de armDispatch el resultado puede ser incierto: conciliar, nunca aplicar esta regla para reenviar.

La delegación no persiste resource_key del destino en el snapshot vigente. Se conserva sin este retry hasta disponer de un contrato que permita contrastar esa identidad; no añadir una excepción implícita o DDL para este arreglo. La admisión/preflight anterior al job tampoco recibe un retry de worker: conserva fallo preciso/503 y no afirma que consumió su política durable.

## Consecuencias

- Un vencimiento de metadatos conserva categoría comprobable, sin presentarse como pérdida de sesión.
- La recuperación selectiva queda acotada por la infraestructura existente; no se cambia120/600, CLI, modelo, intensidad, rol, herramientas, confirmación o recibos.
- Las pruebas deben fallar contra la fuente anterior y cubrir cleanup, cancelación, snapshot, identidad, deadline, fence, máximo de retries, agotamiento y ausencia de dispatch/efectos.
- La aceptación de capacidades sigue exigiendo callbacks, terminal cerrado, ACK y semántica completa. Este cambio no acredita los dos preparadores de preferencias ni explica sus stalls postdispatch.
- Despliegue de Python, compilado Node de laboratorio y Node operativo se informan por separado. No se adopta un compilado completo para encubrir una entrega parcial.

## Referencias

- [Política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md), [ADR-064](ADR-064-nodia-ai-dispatch-deadline-boundary.md), [ADR-067](ADR-067-nodia-ai-pinned-cli-compatibility-experiment.md).
- [R05](../../evidence/nodia-ai-ai36-c05-r05-acceptance.md).
