# NodiaAI AI-27 — administración Core

> Estado documental: en revisión; sin aprobación automática.
> Fecha: 2026-10-17.
> Estado técnico: implementado y verificado en laboratorio privado; escrituras MCP sin publicar y aceptación Gemini pendiente.
> Dependencias: [plan45](45-nodia-ai-implementation-plan.md), [contratos41](41-nodia-ai-v1-contracts.md), [autoridad54](54-nodia-ai-ai08-transversal-authority.md), [confirmación64](64-nodia-ai-ai18-human-confirmation.md), [recuperación66](66-nodia-ai-ai20-execution-recovery.md) y [conjuntos69](69-nodia-ai-ai23-dependent-workflows.md) y [ADR-051](../architecture/decisions/ADR-051-nodia-ai-core-exclusive-execution.md).

## Alcance y límites

Diecisiete preparadores internos reutilizan escritores Core, revisión inmutable, botón humano sobre hash exacto y recibo atómico. No se añaden endpoints nativos, tablas o migraciones. La configuración de proveedores IA corresponde a AI-28/29; esta etapa no cambia modelos, credenciales ni sesiones de proveedores.

| Recurso | Operaciones | Destino de navegación |
|---|---|---|
| users | create, update | /settings/users |
| roles | create, update, delete | /settings/roles |
| actions | create, update, delete | /settings/actions |
| business_actions | create, update, delete | /settings/actions |
| modules | create, update, delete | /settings/modules |
| module_groups | create, update, delete | /settings/modules |

Identidad interna: `nodia_<recurso>_prepare_<operación>`. No se inventan DELETE o GET individual de usuarios. No hay escrituras masivas. Que una ficha o un writer exista no publica herramientas MCP.

## Resolución y vista previa

El comando público usa DTOs cerrados y mínimos nativos. Crear usuario requiere correo; roles, módulos y acciones se identifican por IDs bigint como strings. Las asociaciones explícitas representan la colección final, no un append implícito. Omitir una asociación conserva la semántica nativa; un array vacío significa retirar la colección según las invariantes nativas.

La preparación muestra los campos finales, asociaciones resueltas con IDs y etiquetas, usuarios afectados y pérdida de acceso. `resolved_existing` expone la reutilización de un registro por el upsert nativo. `deletion_mode` distingue eliminación de desactivación cuando el writer nativo preserva referencias. El modelo no puede editar los datos derivados de impacto ni usarlos para concederse acceso.

Las traducciones son entradas estructuradas `{key,es,en}`; no JSON libre. Las revisiones NodiaAI acotan asociaciones y traducciones a100 entradas; key de traducción255 bytes, cada ES/EN5000 bytes y comando64KiB, límites propios de la integración. Los DTOs y casos de uso del recurso siguen siendo la fuente de validaciones nativas.

Fuentes: [DTO usuario](../../nodia-server/src/user/dto/create-user.dto.ts), [rol](../../nodia-server/src/role/dto/create-role.dto.ts), [acción](../../nodia-server/src/action/dto/create-action.dto.ts), [acción de negocio](../../nodia-server/src/business-action/dto/create-business-action.dto.ts), [módulo](../../nodia-server/src/module/dto/create-module.dto.ts), [grupo](../../nodia-server/src/module-group/dto/create-module-group.dto.ts) y [traducción](../../nodia-server/src/translation/dto/translate-item.dto.ts).

## Autoridad y ejecución

NodiaAI exige su módulo y el destino correspondiente al actor ordinario; super_admin conserva identidad real. Las reglas compartidas NI-13 preservan último super_admin activo, rol reservado, clave de módulo inmutable y asociaciones atómicas. Los endpoints Core mantienen su autoridad nativa; esta etapa no inventa RBAC por acción.

La frontera administrativa exclusiva debe englobar reautorización, precondiciones, writer y recibo, sin upgrade de un lock compartido a exclusivo. Cambios materiales de permisos/asociaciones invalidan la propuesta y exigen revisión y otro botón. La recuperación observa el recibo comprometido y no repite el efecto; cancelar no revierte un commit anterior. Las secuencias conservan los pasos completados y reautorizan los pendientes.

Implementación: [módulo](../../nodia-server/src/nodia-ai-core-operations/nodia-ai-core-operations.module.ts), [factory](../../nodia-server/src/nodia-ai-core-operations/use-case/build-nodia-ai-core-operations.use-case.ts) y [tipos](../../nodia-server/src/nodia-ai-core-operations/types/core-operation.types.ts). Se amplía el protocolo existente; no hay ledger paralelo.

## Client y conocimiento

Client traduce17 operaciones y6 recursos, muestra el impacto readonly y enlaza recibos históricos al destino Settings real. Revisión de asociaciones usa SelectMultipleInput y alta explícita de ID string; guardar una nueva revisión resuelve el ID en backend. No descarga catálogos ilimitados ni convierte IDs a Number. Traducciones usan TranslationInput por fila con ES/EN. Los errores conservan editor, valores y foco con toast internacionalizado; durante peticiones se bloquean controles.

Un recibo completado invalida catálogos Core, contexto de autorización del actor actual y observación del chat. No se concede autoridad por recibir un resultado ni se invalida el contexto de otro actor. El backend continúa siendo la autoridad para todo efecto y observación.

La [ficha de administración confirmada](../nodia-ai/knowledge/general-settings/features/confirmed-administration.md), el [resumen de Ajustes Generales](../nodia-ai/knowledge/general-settings/README.md) y el [índice](../nodia-ai/knowledge/README.md) distinguen escrituras internas de lecturas publicadas. Nueva ficha draft/unregistered, approval null. El build documental verifica51 fuentes/24 excluidas, conservando67 lecturas/27 fragmentos.

## Verificación y pendientes

La [evidencia consolidada](../evidence/nodia-ai-ai27-validation.json) registra:

- Server: 2.760 pruebas/194 archivos, build y lint correctos (tres advertencias previas). Incluye71 casos del preparador Core y112 regresiones nativas en22 archivos. Revisión independiente sin hallazgos bloqueantes.
- PostgreSQL/procesos:36 comprobaciones nuevas con las17 operaciones y371 regresiones de12 suites,407 en total;389 peticiones HTTP nativas. NI-13 concurrente, revocación mientras espera el lock, pérdida del propio módulo, rollback de asociaciones/traducciones/recibo, SIGKILL/resume y respuesta de COMMIT perdida verificadas. Datos sintéticos en contenedores descartables; no se escribieron registros de negocio en la BD configurada.
- Client: 1.571 pruebas/205 archivos y280 focales/7; tipado/build/lint correctos. [QA sintético](../evidence/nodia-ai-ai27-ui-validation.json):11 comprobaciones/6 capturas ES/EN/móvil; IDs exactos, asociaciones, traducciones obligatorias, foco/borrador, revisión nueva, delete sin campos editables y confirmación que queda queued. No representa efecto SQL o inferencia real.
- Contratos:137 definiciones comunes,184 de dominio,134 contratos cerrados,477 fixtures y733 hashes fuente; modelo completo23 tablas/298 columnas/62 FKs,8 hashes y16 negativos correctos. Sin tablas, columnas, migraciones o rutas nuevas.
- Laboratorio: backup previo, activación y843 archivos dist idénticos al compilado SQL probado; paquete887 archivos. Registro65 ejecutores,25 migraciones/18 tablas NodiaAI/241 columnas y0 jobs/attempts/slots pendientes. API/worker/nginx, Client5174 y túnel3100 activos/HTTP200. Dependencias, entorno, perfil y contenedor Gemini preservados.
- Conocimiento:51 fuentes/24 excluidas y67 lecturas/27 fragmentos conservados;53 comprobaciones del compilador correctas. Nueva ficha draft sin publicar. Cambia la procedencia de cuatro escritores nativos y el registry; los bytes de documentos aprobados, fragmentos y contratos de lectura permanecen iguales. [Delta trazable](../evidence/nodia-ai-ai27-knowledge-delta.json).

La barrera exclusiva se obtiene antes de cualquier lectura de ejecución y se conserva por manager en un callback acotado; el hint exterior no autoriza y una selección SHARE obsoleta rechaza Core sin elevar el lock. Escritores heredados no reinician timeouts ni abren otro commit; caché Redis se invalida después de terminar SQL. BusinessAction DELETE desactiva y una actualización parcial conserva su inactividad. La resolución de roles diferencia claves numéricas e IDs.

La preparación MCP de escritura, su publicación y aceptación con Gemini conservan gates propios; las fixtures Client no certifican autorización o atomicidad Server. Tampoco resuelven AI-15/22/32. No se acredita aceptación productiva, carga, teléfono físico o escritura por proveedor real.

Regresiones Client verifican que un403 de negocio NI-13 conserve el borrador, mientras un403 de autoridad revoca la observación. También comprueban comparación semántica de traducciones, IDs exactos, datos remotos inválidos y confirmación delete sin campos editables. [Logs y hashes Client](../evidence/nodia-ai-ai27-client-validation.json).

Siguiente desarrollo del plan: **AI-28**, configuración no secreta de IA. Documento y ficha permanecen en revisión/borrador hasta aprobación explícita.
