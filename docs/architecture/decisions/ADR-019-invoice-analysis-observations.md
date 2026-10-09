# ADR-019 — Observación acotada de análisis de facturas

> Estado: propuesto; implementación local autorizada por el usuario, sin aprobación documental automática
> Fecha: 2026-10-08

## Contexto

El POST multipart de análisis devuelve la extracción JSON, mientras una consola necesita hitos durante la ejecución. Observar no debe iniciar, reintentar ni cancelar inferencias, ni publicar texto del documento, prompts, argumentos CLI, secretos o razonamiento. El resultado sigue siendo un borrador revisable.

## Opciones consideradas

### Reserva y polling autenticado

- Ventajas: conserva Axios, renovación de sesión, multipart y JSON existentes; permite consultar por cursor, cerrar errores de Multer/DTO y recuperar solamente el observador.
- Desventajas: hasta dos segundos de demora ordinaria y GET adicionales; el almacenamiento inicial es efímero.

### SSE o respuesta principal en streaming

- Ventajas: entrega inmediata sin polling periódico.
- Desventajas: otra estrategia de autenticación/reconexión y manejo de proxies; acoplar eventos y extracción al mismo transporte cambia el contrato multipart/JSON y confunde desconexión con cancelación.

### Jobs durables con cola y almacenamiento compartido

- Ventajas: recuperación tras reinicios y múltiples réplicas; permite recuperar el resultado.
- Desventajas: persistencia de documentos/resultados, política de retención, workers e idempotencia de inferencias; excede el alcance de observación de una petición actual.

## Decisión

Conservar POST `/api/v1/invoices/analyze` y añadir reserva POST `/analysis-observations` y lectura GET `/analysis-observations/:id?after=N` bajo el mismo recurso. Mantener aliases singular/plural. El header `X-Nodia-Analysis-Id` es opcional para clientes anteriores. El interceptor reclama el identificador antes de Multer; el caso de uso comprueba que el contexto validado sea idéntico al reservado. El actor se obtiene de AuthGuard; otra identidad recibe 404 y un segundo claim recibe 409 antes de ejecutar el adaptador. Ambas lecturas y respuestas del análisis usan `Cache-Control: no-store`.

Estados: `reserved → running → succeeded | failed | cancelled`. Éxito significa extracción validada, nunca factura guardada. Una reserva dura 120 s, una ejecución se retiene como máximo 420 s sin finalizar y un terminal 300 s. Cada proceso conserva hasta 1000 observaciones, Server hasta 10 por actor; cada registro tiene un ring de 256 categorías deduplicadas consecutivas y etiquetas acotadas. No conserva archivos ni resultados de extracción. Una lectura informa cursor, huecos y modelo resuelto; identidad inicialmente `null`.

Client consulta incrementalmente cada 2 s mientras analiza y está visible, con una petición en vuelo y backoff hasta 16 s. Conserva eventos en errores, ofrece actualizar seguimiento y no repite el POST. Pausa durante renovación del token; logout, cambio de actor/sesión/negocio o desmontaje abortan únicamente su principal y observador. Una respuesta principal perdida se considera incierta aun si el snapshot terminó. Los toasts de observación tienen un responsable local por episodio; la caché global respeta esa metadata.

Gemini usa un identificador privado distinto, asignado por Server y reclamado en la admisión autenticada de Python. GET privado exige `X-Nodia-Service-Token`, conserva ADR-008 y usa el mismo ring/TTL. El puente Node consume únicamente categorías permitidas, acota el cuerpo a 128 KiB y falla sin reenviar o invalidar la inferencia. Agentic publica categorías del parser NDJSON; Web publica comprobaciones/envío/respuesta de su adaptador. Codex publica eventos del contexto efímero, excluye turnos ajenos y detiene un perfil al cancelar únicamente si adquirió su lease. API/Gemini reciben la señal principal además de sus deadlines existentes.

## Consecuencias

- La consola representa hechos observables y puede permanecer esperando; no fabrica etapas, porcentajes de razonamiento, tiempos estimados ni modelos.
- Reiniciar un proceso pierde su registro: 404 implica seguimiento no disponible, sin recuperación ni replay del resultado.
- **Requisito de despliegue:** un proceso por capa para este store. Antes de múltiples workers/réplicas, implementar almacenamiento compartido con TTL o afinidad comprobada tanto en Server como en Python. No se acredita soporte distribuido por esta entrega.
- Los límites elegidos acotan memoria por categorías, pero no constituyen un benchmark de capacidad del VPS. Medir carga y ajustar política antes de escalar.
- Cuenta/modelo real, runtime Codex Windows y operación VPS siguen pendientes de comprobación en el entorno correspondiente.

## Referencias

- [Plan 34](../../mvp/34-invoice-analysis-console-plan.md)
- [Contrato IA](../../mvp/ai-provider-feature-contract.md)
- [Seguridad interna](../internal-microservice-security.md)
- [Codex Agentic](../../features/ai-providers/openai-codex-agentic.md)
