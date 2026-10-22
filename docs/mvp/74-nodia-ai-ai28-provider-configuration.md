# NodiaAI AI-28 — configuración no secreta de proveedores IA

> Estado documental: en revisión; sin aprobación automática.
> Fecha: 2026-10-17.
> Estado técnico: cuatro efectos locales implementados y verificados en laboratorio privado; sincronización remota del chat y escrituras MCP conservan gates, aceptación Gemini pendiente.
> Dependencias: [plan45](45-nodia-ai-implementation-plan.md), [contrato de proveedores IA](ai-provider-feature-contract.md), [contratos41](41-nodia-ai-v1-contracts.md), [autoridad54](54-nodia-ai-ai08-transversal-authority.md), [confirmación64](64-nodia-ai-ai18-human-confirmation.md) y [recuperación66](66-nodia-ai-ai20-execution-recovery.md) y [ADR-052](../architecture/decisions/ADR-052-nodia-ai-provider-configuration.md).

## Alcance y separación de responsabilidades

Cuatro puertos internos preparan crear/editar conexiones IA y entradas de su catálogo. Reutilizan casos de uso nativos, propuestas exactas, confirmación humana y recibos atómicos; no son herramientas MCP publicadas. No se añaden operaciones DELETE ni administración de secretos. Una selección conversacional cambia solamente el chat; esta etapa permite proponer una modificación global de la conexión de forma explícita.

| Recurso | Preparadores internos | Datos principales |
|---|---|---|
| ai_providers | nodia_ai_providers_prepare_create/update | Crear requiere catalog_id. Nombre, modos habilitados, modo predeterminado nullable, rotación, conexión predeterminada, actividad y traducciones según contrato nativo. |
| ai_provider_catalog | nodia_ai_providers_prepare_catalog_create/catalog_update | Crear requiere key y name; flags can_use_* configurables. Actualizar conserva clave y permite nombre, flags y actividad. |

Los nombres de la tabla abrevian dos identidades individuales por fila. El catálogo y el proveedor son recursos distintos; IDs bigint se conservan como strings sin conversión numérica. El mínimo de creación no exige campos opcionales. Catálogo y clave quedan inmutables durante actualización según su contrato.

## Modelos e intensidad por modo

La actualización de conexión admite doce paths cerrados: api_key, token_plan_web y token_plan_agentic, cada uno con selected_model, ocr_model, ocr_focus_model y thinking_level. Los modelos se validan contra configuración persistida o descubrimiento autorizado; no hay lista fija, modelo de respaldo o herencia silenciosa entre modos. Crear una conexión no inventa modelos. Al crear, un default_mode explícito null se normaliza al modo que realmente resuelve el escritor nativo según los canales habilitados, con origen contract_default visible; actualizar con null sí conserva null. Omitir un campo conserva su semántica nativa; null elimina la asignación correspondiente; en thinking_level elimina la preferencia general y la del modelo seleccionado. Guardar intensidad actualiza ambas preferencias cuando existe un modelo seleccionado. La vista previa muestra las preferencias resultantes sin afirmar soporte.

Los modelos son texto nullable con máximo255 bytes; intensidad máximo128; nombre128, key de catálogo64, traducciones hasta100 entradas y comando64KiB. Estas cotas pertenecen al contrato de integración y no acreditan capacidades ni cuotas del proveedor.

## Autoridad, propuesta y ejecución

El actor ordinario requiere NodiaAI, el módulo de destino /settings/ai-providers y ai:manage donde aplica; super_admin conserva identidad y acceso transversal. La admisión y cada efecto vuelven a comprobar autoridad, configuración material, revisión/hash y estado vigente. La propuesta muestra catálogo resuelto, predeterminados previos, conexiones afectadas y disponibilidad desconocida; estos datos derivados son readonly.

Los escritores nativos y el recibo mínimo deben compartir una transacción. La recuperación consulta el recibo original y no repite efectos comprometidos. Una respuesta incierta no autoriza reenvío automático. Los cambios de configuración no autentican sesiones ni prueban inferencia, y la configuración no secreta no llama al proveedor externo dentro de la transacción.

## Compatibilidad y concurrencia

Los escritores nativos usan una autoridad SHARE previa a lecturas; en conjuntos mixtos con Core heredan la frontera exclusiva. Un manager heredado debe mantener los locks actuales de las nueve relaciones de autoridad: estar activo no basta. No reinicia timeouts ni abre un commit independiente. Catálogo y conexiones se bloquean en un orden compartido; predeterminados, traducciones y recibo son atómicos.

Los parches omiten únicamente undefined y conservan false/null/0 conforme al contrato. La configuración histórica plana se conserva en su modo original al introducir el primer canal, incluido enable_extended_thinking. La persistencia nativa de descubrimiento remoto relee y combina solamente los modelos del canal observado, con límites SQL propios, preservando ediciones realizadas durante la llamada externa. No habilita el preparador MCP de sincronización.

Traducciones son upsert por clave, no reemplazo ni borrado. Las claves existentes omitidas se conservan y se muestran en la propuesta; retirarlas o vaciar una colección existente se rechaza antes de confirmar. La misma corrección se aplica a roles, acciones, acciones de negocio, módulos y grupos Core. El marcador material translation_semantics=upsert-preview/1 invalida las propuestas previas afectadas antes del escritor y conserva sus recibos históricos sin cambiar el contrato de identidad.

Nuevas activaciones explícitas de OpenAI Web se rechazan conforme a la retirada previa del producto. Datos históricos ajenos a un patch se preservan; ningún flag crea un adaptador o una sesión.

## Client y navegación

Client traduce cuatro operaciones y dos recursos, reutiliza editores registrados de texto, booleanos, enum nullable y traducciones estructuradas. No ofrece JSON libre ni entradas de credenciales. Los paths por modo se codifican como identidades de campo en React Hook Form, preservando aislamiento de valores. Modelo ausente se presenta sin asignación y sin copiar el de otro modo. Errores conservan editor, borrador y foco, con toast ES/EN; peticiones bloquean controles.

El recibo muestra ID exacto, advertencia histórica y enlace real. Conexión: /settings/ai-providers?provider=<id>; catálogo: /settings/ai-providers, sin inventar editor de catálogo por URL. Sólo efectos completados invalidan consultas administrativas IA y disponibilidad/catálogo del chat del actor actual; nunca sustituyen la selección persistida ni conceden autoridad localmente.

La [ficha nueva](../nodia-ai/knowledge/general-settings/features/confirmed-ai-configuration.md) permanece draft/unregistered, approval null. Los cuerpos aprobados de lectura se conservan. Markdown explica capacidades y no habilita herramientas.

## Verificación y pendientes

La [evidencia consolidada](../evidence/nodia-ai-ai28-validation.json) registra:

- Server:2.893 pruebas/193 archivos; build, tipado y lint correctos, con tres advertencias previas. Incluye68 focales nativas y155 de preparadores (66 IA/89 Core), además de198 del coordinador.
- SQL/HTTP/procesos:25 comprobaciones nuevas y407 de regresión,432 en total;389 peticiones HTTP nativas contadas y dos suites adicionales correctas sin contador (API/cifrado/selección y CLI Agéntico con fixture loopback). Cuatro operaciones, pérdida de ai:manage, concurrencia de predeterminado/claves, migración histórica, locks heredados, rollback de traducciones/recibo, SIGKILL/resume y respuesta de COMMIT perdida verificados. Contenedores sintéticos desechables eliminados; no se modificó la BD de negocio configurada ni se usaron cuentas o proveedores reales.
- [Client](../evidence/nodia-ai-ai28-client-validation.json):1.589 pruebas/205 archivos y241 focales/3; tipado/lint/build correctos (Vite12.97s, aviso de chunks previo). [QA sintético](../evidence/nodia-ai-ai28-ui-validation.json):9 comprobaciones/3 capturas ES/EN/móvil, foco/borrador preservados, null explícito, canales aislados, revisión/hash nuevos y recibo histórico con ID/enlace exactos. Las fixtures no acreditan SQL o inferencia.
- Contratos:138 definiciones comunes,184 de dominio,134 contratos cerrados,490 fixtures y741 hashes de implementación; modelo completo23 tablas/298 columnas/62 FKs,8 hashes y16 fixtures negativas correctos. Inventario74 módulos/43 controladores/204 handlers/323 rutas, sin endpoints nuevos.
- Laboratorio:backup previo y activación con851 dist idénticos al compilado SQL probado; paquete897 archivos,69 ejecutores,25 migraciones/18 tablas NodiaAI/241 columnas y0 trabajos/attempts/slots pendientes. API/worker/nginx, Client5174 y túnel3100 activos/HTTP200. Cero tablas, columnas o migraciones nuevas. Entorno, dependencias, perfil y contenedor Gemini conservados.
- Conocimiento:52 fuentes/25 excluidas y67 lecturas/27 fragmentos conservados;53 checks del compilador correctos. Nueva ficha draft sin publicar; cambia el registry y la procedencia del servicio IA, manteniendo bytes de documentos aprobados, fragmentos y contratos públicos. [Delta](../evidence/nodia-ai-ai28-knowledge-delta.json).

El catálogo candidato `nodia_ai_providers_prepare_sync_models` continúa pendiente de preparación/ejecución bajo el protocolo externo de observación, admisión y conciliación; no forma parte de los cuatro ejecutores SQL. La API nativa de sincronización conserva su operación y se verificó su persistencia concurrente con fixtures. Este pendiente permanece trazado para AI-29/publicación; no se presenta como una herramienta MCP implementada o aceptada por Gemini.

Siguiente desarrollo: **AI-29**, canal seguro y pausa por interacción humana. Documento74 y ADR-052 siguen en revisión/propuestos; fichas draft/unregistered sin aprobación automática.

Secretos, API keys, cookies, códigos y login se reservan a AI-29 y su canal seguro. Sincronización de modelos, salud viva, cierres de sesión y otras acciones externas conservan sus gates propios; esta entrega no los convierte en configuración SQL. Publicación MCP, aceptación con proveedor real, AI-15/22/32 y aceptación productiva siguen separados.
