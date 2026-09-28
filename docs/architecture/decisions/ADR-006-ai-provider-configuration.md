# ADR-006 — Configuración global de proveedores de IA y sesión remota

> Estado: propuesto
> Fecha: 2026-09-25

## Contexto

El análisis de facturas permite elegir Gemini o Mistral. Gemini usa hoy un microservicio con sesión web persistida en el host y Mistral usa una API key de entorno. Para publicar Nodia con NestJS y el microservicio en VPS, un administrador autorizado debe poder recuperar la sesión Gemini de forma remota, elegir manualmente Gemini Web o Gemini API, configurar claves y observar fallos. Las decisiones funcionales están documentadas en `docs/mvp/15-ai-providers-interview.md`.

`ADR-005` describió el estado actual de Gemini Web sin API key como respaldo automático. Esta propuesta amplía la capacidad futura: el modo API es una elección manual, no un fallback silencioso.

## Opciones consideradas

### Opción A: mantener configuración en entorno y operar el navegador por acceso al VPS

- Ventajas: menos tablas y cambios iniciales.
- Desventajas: cambios requieren operación del servidor/reinicio, delegación mediante acceso al host y estado disperso. No satisface el panel solicitado.

### Opción B: configuración global en BD y sesión web en volumen del microservicio

- Ventajas: control por roles desde Nodia, selección explícita de modo, keys múltiples con auditoría, continuidad de perfil/cookies en reinicios.
- Desventajas: requiere cifrado de keys, migración de configuración existente, sincronización de estado y un navegador remoto protegido en VPS.

## Decisión propuesta

Adoptar opción B con simplificación de dominio 1:1: Consolidar en PostgreSQL directamente en la entidad `ai_providers` los campos de configuración operativa (`mode`, `fields`, `fields_version`, `auto_rotate_api_keys`, `is_active`), eliminando la tabla redundante `ai_provider_connections` que generaba restricciones y colisiones innecesarias. Asociar el pool de llaves `ai_api_keys` y los registros de auditoría `ai_provider_events` directamente a `provider_id`.
Persistir allí campos no secretos tipados por adaptador/modo (`available_models`, `selected_model`, `ocr_model`) y política de rotación; guardar keys cifradas individuales en `ai_api_keys` y eventos administrativos en `ai_provider_events`. Persistir el perfil/cookies de Gemini Web en el microservicio dedicado (`nodia-gemini-microservice`). La clave maestra de cifrado permanece fuera de PostgreSQL (AES-256-GCM). NestJS media toda operación de administración y autoriza por acciones. El microservicio y el canal gráfico no se exponen directamente al público.

Para el login remoto, proponer una pestaña temporal de Nodia que permita controlar un navegador visible ejecutado en el VPS, con sesión de corta vida y una persona a la vez. La tecnología concreta del visor (por ejemplo noVNC) queda sujeta a una prueba de viabilidad con la cuenta real antes de implementar la interfaz completa.

Gemini Web y Gemini API no hacen fallback mutuo. Las API keys de un mismo proveedor pueden rotar en la misma factura si el switch de rotación está activado y el error corresponde a credencial/cuota. No hay fallback automático entre proveedores.

### Actualización 2026-09-27: Catálogo maestro y soporte multi-instancia
Se desacopló `ai_provider_catalog` (`id`, `key`, `name`, `is_active`) como tabla maestra de proveedores de IA soportados del mercado (`gemini`, `openai`, `anthropic`, `mistral`, `deepseek`, `groq`, `perplexity`, etc.) respecto de las instancias operativas en `ai_providers` (`catalog_id`, `name`, `key` no única). Esto permite registrar múltiples instancias o conexiones para un mismo proveedor (ej. cuenta headless con plan web ilimitado + API Key de contingencia). Los modelos se sincronizan dinámicamente bajo demanda (`POST /ai-providers/:id/sync-models`), sin listas estáticas hardcodeadas. Se incorpora soporte para Razonamiento Extendido (Extended Thinking) en modelos con capacidad `reasoning`, así como un switch informativo de Foco OCR (`ocr_focus_model`), preservando `selected_model` como el ejecutor estricto de inferencia.

## Consecuencias

- `verify-ia-providers` debe comprobar la vía seleccionada y dejar de devolver Mistral como disponible por constante.
- Mistral debe dejar de fijar `MISTRAL_API_KEY` al construirse; Gemini necesita adaptador de API oficial adicional al microservicio web.
- Los errores deben clasificarse por causa y las keys con problemas deben quedar visibles sin revelar secretos.
- El flujo de login web queda sujeto a cambios del proveedor y a sus condiciones de uso; no se asume que el login remoto funcionará en VPS hasta probarlo.
- El despliegue de NestJS cambia de Northflank a VPS; Cloudflare Pages, R2 y servicios gestionados para PostgreSQL/Redis continúan.
- `docs/mvp/05-sitemap.md`, `06-route-specs.md`, `10-stack-devops.md`, `11-architecture-overview.md`, `12-kanban.md`, `13-readiness-review.md` y `ADR-005` requieren reconciliación antes de aprobación.

## Referencias

- [Entrevista](../../mvp/15-ai-providers-interview.md)
- [Especificación para agente](../../mvp/16-ai-provider-management-handoff.md)
- [ADR-005 — Sesión Gemini Web](ADR-005-gemini-web-session.md)
