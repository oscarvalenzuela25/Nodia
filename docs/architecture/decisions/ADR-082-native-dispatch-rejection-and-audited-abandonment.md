# ADR-082 — Rechazo previo al inicio nativo y abandono operativo auditado

> Estado: propuesto
> Fecha: 2026-10-26

## Contexto

La barrera SQL reserva presupuesto antes de enviar al receptor. El receptor puede rechazar `/nodia-ai/agentic/mcp/start` con HTTP409 `runtime_busy` antes de armar su ledger. En ese caso no existe terminal nativo que conciliar ni ACK que emitir. El contrato actual conserva correctamente como `unknown` toda operación armada sin terminal, pero no representa ese rechazo conocido. No se debe resolver inventando un `NativeTerminalProof` ni degradando cualquier error de transporte.

El intento `efcf2c07-ad6a-4f15-bce7-d30bbbd97dc4` acredita por separado un rechazo de3ms y un cancel404; los logs lo correlacionan por tiempos y flujo de código, no mediante un recibo contemporáneo con digest de la solicitud. No puede convertirse retroactivamente en la nueva prueba tipada.

## Opciones consideradas

### Opción A — Convertir cualquier `not_dispatched` en fallo conocido

- Ventaja: modificación pequeña.
- Desventaja: confunde una clasificación local con evidencia del receptor, permite liberar una reserva después de errores ambiguos y no resuelve la correlación de identidad.

### Opción B — Evidencia privada de rechazo y recuperación excepcional separada

- Ventaja: distingue rechazo autenticado, terminal nativo e incertidumbre; no altera el protocolo de terminal/ACK.
- Costo: añade una variante privada y exige validación por identidad antes de liberar SQL.

## Decisión propuesta

Implementar B como candidato pendiente de revisión y adopción. La primera variante sólo admite el contrato demostrado de HTTP409 `runtime_busy` de `/nodia-ai/agentic/mcp/start`. El transporte privado liga intento, recurso, sesión, configuración, ruta, estadoHTTP, `request_id` coincidente en body/header y digests de los bytes enviados/recibidos. El checkpoint valida identidad y fence, conserva presupuesto y cierra el turno fallido sin reintento automático ni trabajo de ACK. No aplicar esta regla a OCR, otros endpoints o códigos por coincidencia textual.

Errores de red, cuerpo inválido, redirección, identidad o correlación inválida y cualquier operación potencialmente aceptada siguen `unknown`. Los terminales nativos existentes y su ACK conservan el contrato actual de43/50.

Para el incidente anterior se permite únicamente un operador raíz de abandono infraestructural auditado y exacto, revisado antes de ejecutarse. Debe detener API/worker tras capturar su entorno legítimo, comprobar cierre físico sin SDK, fijar fuentes/época/identidad/fences/evidencias y persistir un witness0600 con fsync antes de SQL. Una única transacción marca el run fallido con `outcome_unknown`, revoca grants, libera slot incrementando fence, limpia `active_job_id` y deja el job `done`, conservando ambos intentos y el descriptor histórico. No borra historial, no crea recibo nativo, no invoca ACK y no reenvía inferencia. Un resultado de commit incierto permite sólo lectura posterior, nunca repetir automáticamente la mutación.

## Consecuencias

- El fallo conocido conserva coste/cuota internos desconocidos y la reserva de presupuesto consumida; no habilita otro proveedor, modelo, plazo ni permiso.
- La prueba de rechazo pertenece al transporte privado; DTOs públicos y modelos no pueden suministrarla.
- El abandono excepcional es una ruptura auditada del requisito de recibo, limitada al operador de infraestructura. No se publica un endpoint de force-close ni una herramienta para usuarios/modelos.
- Las pruebas locales no acreditan locks PostgreSQL, recuperación operativa, disponibilidad o inferencia real. Esas comprobaciones quedan pendientes del operador raíz.
- Estado propuesto: no aprueba ni reescribe43/50 ni las fichas publicadas.

## Referencias

- [Arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md).
- [Política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md).
- [Paquete local y evidencia](../../../ops/lab/artifacts/invoice-ocr-known-rejection-recovery-r01/README.md).
