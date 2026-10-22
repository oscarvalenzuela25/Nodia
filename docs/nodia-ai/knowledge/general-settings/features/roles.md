---
{
  "schema_version": 1,
  "document_id": "general-settings.roles",
  "product_id": "general-settings",
  "kind": "feature",
  "revision": 5,
  "document_status": "approved",
  "implementation": {
    "status": "partial",
    "notes": "Publicación AI-15 de las lecturas/referencias expresamente enumeradas mediante contratos cerrados y reglas nativas. Las escrituras y otras etapas del producto no se habilitan. La disponibilidad de cada dependencia se observa por separado; no se promete éxito de toda inferencia ni acceso a contenido R2 no configurado."
  },
  "integration_status": "published",
  "maintainer": "Mantenimiento de Ajustes Generales y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/02-prd-v1.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/19-prelaunch-review.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/ai-provider-feature-contract.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/role/entities/role.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/role/role.service.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/mvp/54-nodia-ai-ai08-transversal-authority.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/role/use-case/save-role.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/core-settings/core-settings-read.family.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/core-settings/use-case/execute-nodia-ai-core-settings-read.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/contracts/core-settings.schema.json",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-16",
    "evidence_paths": [
      "docs/mvp/51-nodia-ai-ai05-product-knowledge.md",
      "docs/evidence/nodia-ai-ai05-knowledge-validation.json",
      "docs/evidence/nodia-ai-ai08-authority-validation.json",
      "docs/evidence/nodia-ai-ai15-postgres-integration.json",
      "docs/evidence/nodia-ai-ai15-external-validation.json",
      "docs/evidence/nodia-ai-ai15-artifacts-integration.json",
      "docs/evidence/nodia-ai-ai15-live-local.json",
      "docs/evidence/nodia-ai-ai15-live-artifacts.json",
      "docs/evidence/nodia-ai-ai15-live-routing-interrupted.json",
      "docs/evidence/nodia-ai-ai15-live-external-final.json",
      "docs/evidence/nodia-ai-ai15-live-quota-gateway-final.json",
      "docs/evidence/nodia-ai-ai15-live-codex-root-postfix.json"
    ],
    "notes": "Gemini Agentic real completó un turno de cinco familias SQL (10 comprobaciones) y otro de tres referencias (12): dos CSV autenticados correctos; factura devuelve 503 por R2 sin configurar. La emisión de referencia no certifica bytes disponibles. Routing real completó Web conversacional y delegación opt-in SQL; el siguiente turno Web quedó unknown/502 y se concilió sin replay. El ensayo externo final completó recibos health/engines y luego quedó unknown; no se registra como aceptación generativa completa. La regresión Gateway de las cinco salidas usa observaciones sintéticas y cero inferencias. Los fallos permanecen en sus informes, sin atribuirlos a causa no observada. Las demás lecturas conservan su evidencia aislada SQL/HTTP; publicar no garantiza que el modelo siempre construya llamadas válidas."
  },
  "approval": {
    "reference": "docs/evidence/nodia-ai-ai15-publication-authorization.md",
    "revision": 5,
    "content_sha256": "dcfcf89555b02a3f0314d624981f89b05a5d50d126365ef4a290a5d8f3b78bc4"
  }
}
---

# Roles y asociaciones de acciones — contexto funcional para NodiaAI

Estado actual: esta revisión publica sólo el fragmento «Lecturas disponibles en AI-15». Las secciones de implementación/evidencia anteriores a ese fragmento conservan la trazabilidad de entregas iniciales; sus frases históricas sobre publicación pendiente no sustituyen el frontmatter actual ni habilitan escrituras.

[Producto](../README.md). Metadatos canónicos migrados en [AI-06](../../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); esta revisión tiene autorización específica de publicación para las lecturas enumeradas al final; las demás operaciones conservan sus gates.

## Qué resuelve y qué significa

Gestionar roles reutilizables y acciones asociadas, sin deducir que editar una asociación habilita un guard no implementado.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y aclaración esperada |
|---|---|
| «Crea rol operador» | Pedir key y aclarar acciones cuando se soliciten, no inventar catálogo. |
| «Quita una acción del rol» | Leer colección actual y mostrar todas las restantes. |
| «Borra super_admin» | Rechazar operación reservada y no dejar cero administradores. |

Ejemplos ilustrativos sin resultados ni identificadores reales. Preguntar sólo obligatorios y ambigüedades; los opcionales no bloquean salvo condición del dominio.

## Operaciones y contratos

| Handler y ruta de referencia | Candidato del catálogo40 | Tratamiento vigente |
|---|---|---|
| [RoleController.create](../../../../../nodia-server/src/role/role.controller.ts)<br>`POST /api/v1/role` | `nodia_roles_prepare_create` (prepare_change, candidato40) | Candidato; sin publicar |
| [RoleController.findAll](../../../../../nodia-server/src/role/role.controller.ts)<br>`GET /api/v1/role` | `nodia_roles_list` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [RoleController.findOne](../../../../../nodia-server/src/role/role.controller.ts)<br>`GET /api/v1/role/:id` | `nodia_roles_get` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [RoleController.update](../../../../../nodia-server/src/role/role.controller.ts)<br>`PUT /api/v1/role/:id` | `nodia_roles_prepare_update` (prepare_change, candidato40) | Candidato; sin publicar |
| [RoleController.updatePatch](../../../../../nodia-server/src/role/role.controller.ts)<br>`PATCH /api/v1/role/:id` | `nodia_roles_prepare_update` (prepare_change, candidato40) | Candidato; sin publicar |
| [RoleController.remove](../../../../../nodia-server/src/role/role.controller.ts)<br>`DELETE /api/v1/role/:id` | `nodia_roles_prepare_delete` (prepare_change, candidato40) | Candidato; sin publicar |

Los aliases de [inventario39](../../../../mvp/nodia-ai-current-endpoints.json) no crean capacidades distintas. Los nombres de operaciones proceden del catálogo documentado en [catálogo40](../../../../mvp/40-nodia-ai-tool-catalog-v1.md): sólo las lecturas enumeradas en esta revisión tienen binding explícito de publicación; las escrituras continúan candidatas.

DTOs de entrada/filtros: [create-role.dto.ts](../../../../../nodia-server/src/role/dto/create-role.dto.ts), [get-roles.dto.ts](../../../../../nodia-server/src/role/dto/get-roles.dto.ts), [update-role.dto.ts](../../../../../nodia-server/src/role/dto/update-role.dto.ts), [role-id.dto.ts](../../../../../nodia-server/src/role/dto/role-id.dto.ts)

Delegación actual (casos de uso/servicios según controlador): [create-role.use-case.ts](../../../../../nodia-server/src/role/use-case/create-role.use-case.ts), [get-all-roles.use-case.ts](../../../../../nodia-server/src/role/use-case/get-all-roles.use-case.ts), [role.service.ts](../../../../../nodia-server/src/role/role.service.ts), [update-role.use-case.ts](../../../../../nodia-server/src/role/use-case/update-role.use-case.ts), [delete-role.use-case.ts](../../../../../nodia-server/src/role/use-case/delete-role.use-case.ts)

## Datos mínimos y resolución de dudas

| Dato/operación | Obligatorio, condicional u opcional; resolución |
|---|---|
| Crear | key; acciones/traducciones/actividad opcionales. Resolver IDs de acciones válidas, sin confundir business_actions. |
| Editar | Rol bigint exacto y valores solicitados; actions omitido conserva y lista reemplaza, [] vacía. |

Actor, permisos efectivos, claves de intención, versiones de concurrencia y referencias internas los controla Server; no los inventa ni decide el modelo. DTOs enlazados son fuente de campos, no un JSON Schema estricto de herramienta ya publicado.

## Reglas, acceso y restricciones

super_admin es reservado: proteger clave/borrado y conservar al menos uno activo según PRD. AI-08 protege rol/último administrador y guarda asociaciones/traducciones atómicamente. Administración global autenticada sin imponer RBAC granular descartado en19.

Cinco destinos distintos: /settings/users, /settings/roles, /settings/actions, /settings/modules y /settings/ai-providers. No habilitar todos por asignar uno. Administración global autenticada intencional en19, sin inventar permisos por acción; IA conserva su requisito real ai:manage o super_admin. NodiaAI aplica su módulo más cada destino (AI-07) y salvaguardas NI-13/AI-08.

## Filtros e informes

Filtros key/actividad y acciones permitidas; incluir todas las acciones del rol aunque el filtro lo haya seleccionado por una sola. No tratar conteo de roles como permisos efectivos de una cuenta sin resolver contexto actual.

El nuevo registro combinable de [contratos41](../../../../mvp/41-nodia-ai-v1-contracts.md) sigue pendiente AI-30/31; filtros REST existentes no autorizan joins, campos o SQL libres. [Política50](../../../../mvp/50-nodia-ai-ai04-runtime-policy.md) acota trabajo del chat y no reemplaza silenciosamente límites del módulo.

## Vista previa, confirmación y recuperación

Preview acciones finales y revocaciones; DELETE real tiene precondiciones, no desasignación silenciosa. Revalidar autoridad/invariantes y revocar grants/cachés afectados; sin replay automático de cambios de privilegios.

Desde NodiaAI, preparar es distinto de ejecutar: cambios requieren vista previa exacta y botón humano de41; el switch Web→Agentic no confirma. Conservar efectos completados si falla un paso dependiente y no reenviar un resultado desconocido. Payload del chat caduca según50 sin borrar registros de dominio ni sus journals nativos.

## Integración y evidencia

- [x] Fuentes de producto/backend, diferencias y mínimos revisados estáticamente en AI-05.
- [x] Correspondencia de handlers/candidatos y enlaces comprobada offline; no prueba de autorización/efectos.
- [ ] Schema de herramienta/proyección, autoridad y contexto registrados con AI-06/07 y familia pertinente.
- [ ] Casos de uso reales de acceso/ambigüedad, confirmación, concurrencia y recuperación verificados para NodiaAI.
- [ ] Adaptador/modalidades, publicación y aceptación operativa comprobados.

Pendientes con efecto sobre disponibilidad: AI-08/27: NI-13, locks entre escritores y esquema de acciones final; destino /settings/roles.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Contexto y propuestas |
|---|---|---|
| 1 | AI-05: explicación inicial a partir de contratos/código enlazados | Sin cambio de backend ni publicación. Al cambiar reglas/DTOs, actualizar ficha/schema/registro, invalidar propuestas incompatibles y mantener recuperación original |


Actualización AI-08: [autoridad compartida](../../../../mvp/54-nodia-ai-ai08-transversal-authority.md). Destinatarios, actor real y reglas nativas se validan en transacción. En Ajustes Generales se protegen último super_admin, rol reservado, key de módulos y asociaciones atómicas; esto no incorpora herramientas MCP administrativas.


## Historial de implementación local AI-15

Capacidades implementadas como candidatas tipadas: `nodia_roles_get`, `nodia_roles_list`. La integración real permanece unregistered, documento draft y approval null; estas marcas no habilitan herramientas.

El gateway exige NodiaAI y el módulo de destino actual. Los recursos Core conservan consulta global autenticada conforme al contrato del producto; no se inventa un aislamiento por usuario para estos catálogos. Cada puerto relee la sesión y trabaja con el EntityManager READ COMMITTED del checkpoint; datos, traducciones y asociaciones de detalle usan ese manager. No hay transacciones independientes, Redis ni HTTP en las lecturas.

Listados: page desde1, limit hasta100, actividad activa por defecto; inactive filtra inactivos y all omite el predicado. Las herramientas no aceptan all=true ni includes: devuelven el principal paginado con proyección permitida y sin expandir asociaciones. Los filtros de clave/texto/relaciones ya admitidos por el DTO nativo se validan con schema cerrado y política Ransack explícita; se agrega desempate por ID para orden estable. La selección de actividad se expresa mediante active, sin otro predicado is_active público dentro de q.

Las proyecciones excluyen campos ORM arbitrarios, datos de autenticación y secretos. Usuarios devuelve identidad pública, nombre/correo/imagen/actividad/fechas; no google_sub, cookies, sesiones, roles o módulos anidados. El detalle de rol conserva sus acciones y el de módulo conserva su grupo, bajo schema cerrado y presupuesto de respuesta; un exceso se rechaza, nunca se trunca silenciosamente. Los detalles también validan que la identidad guardada corresponda a la solicitada al recuperar un resultado.

La suite focal usa los servicios/casos de uso nativos y traducciones reales con repositorios sintéticos. Verifica que el manager global no pueda ser consultado, los filtros/defaults/tamaño de página, revocación de sesión, ausencia nativa y proyección sin secretos. No prueba producción, Redis desplegado, publicación, escrituras o nuevas inferencias Gemini.

Antes de hidratar las acciones de un rol, el puerto cuenta sólo hasta límite+1 mediante subconsulta SQL parametrizada con LIMIT; superar json_collection_items de la política común rechaza context_limit antes del join y las traducciones. El Gateway proporciona el límite actual (128 en la política vigente), sin cambiar el contrato HTTP nativo. Las pruebas comprueban rechazo con129 y aceptación con128, además de autoridad y proyección.


## Lecturas disponibles en AI-15

Consultar roles y asociaciones públicas acotadas. La lectura no modifica el rol reservado, asociaciones ni invariantes del último super_admin activo.

Herramientas de esta sección: `nodia_roles_get`, `nodia_roles_list`.

Resolver entidades, destinatario, intervalo y filtros ambiguos antes de llamar. Usar sólo los campos del schema de la herramienta. Conservar IDs y dinero exactos, cero y falso; ausencia o unknown no equivalen a cero. La paginación y los límites de resultados deben comunicarse y una página no representa el universo completo. En recursos con actividad, iniciar Activo y usar Inactivo/Todos sólo cuando se soliciten; Todos omite el filtro.

Server valida sesión, módulo NodiaAI y todos los módulos destino actuales para usuarios ordinarios; super_admin conserva transversalidad y las reglas de dominio. Datos privados y autoridad se revalidan al devolver o recuperar resultados. Finanzas permite owner_id ajeno sólo a super_admin; Reservas conserva autoridad actual del alojamiento; administración IA conserva ai:manage. No construir SQL libre ni pedir tokens, cookies o secretos.

Esta publicación incluye lecturas y referencias privadas, no preparaciones ni ejecución de escrituras. Cualquier creación, edición, eliminación o confirmación conserva sus herramientas y etapas posteriores. No anunciar informes cruzados, un total por proveedor u otros filtros/agrupaciones si el schema o caso de uso no los soporta. Web permanece conversacional; MCP sólo se ejecuta mediante Agentic verificado, con delegación Web→Agentic opt-in de la misma conexión.

Las observaciones externas se ejecutan fuera de SQL, con deadline/cancelación y verificación posterior de autoridad y configuración. La recuperación de una llamada completada no repite red; una llamada interrumpida no se reintenta ciegamente. Los artefactos son referencias privadas current_on_download: la descarga humana reautoriza chat/recurso, rechaza exceso sin truncar y no conserva el archivo al expirar el chat; el original de factura pertenece al negocio.
