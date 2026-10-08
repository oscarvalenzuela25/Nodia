# ADR-016 — Adaptador de sesión agéntica mediante Antigravity CLI

> Estado: propuesto documentalmente; implementación autorizada y validada Windows local. Operación con cuenta Linux/VPS pendiente.
> Fecha: 2026-10-07

## Contexto

El adaptador Antigravity de Nodia devuelve indisponibilidad explícita según ADR-009. El usuario solicita reemplazar las operaciones agénticas completas —estado, salud, modelos, sincronización, verificación y análisis— conservando el frontend actual. La investigación identificó el CLI oficial como candidato de sesión; el SDK examinado no demuestra acceso al plan personal sin credenciales API.

El login implementado en Nodia es de Gemini Web. La integración no puede atribuirle autenticación ni cuotas agénticas. La sesión CLI será compartida por las conexiones agénticas configuradas, mientras cada conexión conserva sus modelos/opciones en BD.

## Opciones consideradas

### Opción A: adaptar el CLI oficial dentro del microservicio existente

- Ventajas: utiliza un cliente oficial y conserva el límite de transporte actual entre Client, Server y microservicio.
- Desventajas: dependencia de un binario, autenticación operativa y aislamiento de herramientas; requiere comprobar transporte de documentos, estado no generativo y procedencia de modelos.

### Opción B: integrar SDK o proxy comunitario OAuth

- Ventajas: interfaz de programación más directa en algunos proyectos.
- Desventajas: el SDK investigado requiere modalidades de autenticación diferentes; los proxies añaden protocolos no verificados, mapas de modelos y comportamientos de fallback que deben auditarse. No resuelven por sí mismos la identidad ni el aislamiento.

### Opción C: conservar la indisponibilidad actual

- Ventajas: evita informar un soporte inexistente o consumir Web en lugar de Agentic.
- Desventajas: no satisface el análisis mediante el plan agéntico solicitado.

## Decisión

Implementar A por autorización explícita del usuario, con viabilidad Windows/extracción comprobadas en [plan 32](../../mvp/32-agentic-cli-implementation-plan.md). Conservar C en entornos sin configuración/adaptador/sesión verificados; la evidencia local no activa Linux-VPS automáticamente.

Mantener los contratos públicos, el token/red privados de ADR-007/008 y un solo worker. Implementar un adaptador tipado y un ejecutor de procesos acotado dentro del microservicio; un contexto independiente por análisis, sin acceso al workspace de Nodia. Modelo explícito y dinámico, sin cambio de motor/modelo/cuenta tras fallar.

Login CLI administrado en el entorno del servicio; el botón Web conserva su finalidad. La ampliación autorizada del 2026-10-07 añade un botón Agentic separado y puente OAuth remoto del CLI según [ADR-017](ADR-017-gemini-agentic-remote-login.md), sin cambiar el transporte de análisis ni la sesión compartida. Cuota desconocida se publica como nula mientras no exista una fuente automatizable comprobada. No usar prompts para health/verificación de sesión. La extracción real y validada constituye evidencia adicional, distinta de autenticación y descubrimiento.

## Consecuencias

- Consecuencias positivas: Client permanece agnóstico al transporte; estado, modelos y ejecución agénticos utilizan la misma dependencia. Se conserva configuración y funcionalidades IA recuperadas.
- Costos o riesgos aceptados: operación/versionado de CLI, aislamiento Windows/Linux, persistencia/renovación de credenciales y posible falta de una interfaz de cuotas. Si faltan estado fiable o lectura de documentos, el candidato puede no satisfacer el contrato y deberá revisarse.
- Trabajo posterior: ejecutar AG-01..12, probar cuenta/documentos reales, completar runbook y reconciliar ADR-009, contrato de funcionalidades e instrucciones del microservicio al habilitarlo. No se requieren nuevas tablas ni un servicio público.

## Referencias

- [Plan 32 y checklist](../../mvp/32-agentic-cli-implementation-plan.md).
- [ADR-009: hechos y alternativas investigadas](ADR-009-truthful-gemini-engines.md).
- [ADR-007: acceso interno](ADR-007-gemini-internal-access.md), [ADR-008: microservicios privados](ADR-008-internal-microservices-only.md), [ADR-015: recuperación API](ADR-015-ai-api-provider-recovery.md).
- [Autenticación oficial CLI](https://www.antigravity.google/docs/cli/install/), [ejecución headless](https://www.antigravity.google/docs/cli/headless/), [cuotas](https://www.antigravity.google/docs/cli/commands/usage).

## Evidencia posterior

CLI 1.3.1 fijado/verificado, estado/cuota no generativos, catálogo dinámico y PDF/PNG correctos por NestJS/FastAPI con sesión real. Hooks de documento exacto/finalización, ownership/cierre acotados, modelo/esfuerzo exactos y `useG1Credits:false`. Frontend intacto y sin migración de BD. [Runbook](../../mvp/agentic-cli-runbook.md) con pruebas, operación/rollback y pendientes. No se aprueba automáticamente el ADR ni se acredita operación VPS/revocación real.

Seguimiento 504 del mismo día: [incidencia 19](../../mvp/19-prelaunch-review.md#segunda-incidencia-de-análisis-webagentic--2026-10-07) coordina deadlines de upload/análisis/CLI/Server/Client y permite reutilizar en análisis la observación de la misma sesión durante su TTL de 30 s, conservando autenticación del CLI y comprobación exacta de `/model`. La lectura caducada/fallida no habilita análisis. Inferencia High con PDF sintético correcta; fallos intermitentes de observación aún pueden impedir ejecutar. No se cambian cuenta, cuota, motor ni modelo para ocultarlos.
