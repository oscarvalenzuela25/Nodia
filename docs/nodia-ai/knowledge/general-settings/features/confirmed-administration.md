---
{
  "schema_version": 1,
  "document_id": "general-settings.confirmed-administration",
  "product_id": "general-settings",
  "kind": "feature",
  "revision": 2,
  "document_status": "approved",
  "implementation": {
    "status": "partial",
    "notes": "AI36-C05 publica sólo la sección adicional enumerada bajo autorización humana específica; los apartados previos conservan su fecha y alcance. Contratos internos y publicación no prueban despliegue, inferencia o aceptación productiva."
  },
  "integration_status": "published",
  "maintainer": "Mantenimiento de Ajustes Generales y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/41-nodia-ai-v1-contracts.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/54-nodia-ai-ai08-transversal-authority.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/73-nodia-ai-ai27-core-administration.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/user/dto/create-user.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/role/dto/create-role.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/action/dto/create-action.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/business-action/dto/create-business-action.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/module/dto/create-module.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/module-group/dto/create-module-group.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-core-operations/use-case/build-nodia-ai-core-operations.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/architecture/decisions/ADR-051-nodia-ai-core-exclusive-execution.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/74-nodia-ai-ai28-provider-configuration.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-write-tools/use-case/build-nodia-ai-write-tools.use-case.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-24",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai27-validation.json",
      "docs/mvp/73-nodia-ai-ai27-core-administration.md",
      "docs/evidence/nodia-ai-ai27-client-validation.json",
      "docs/evidence/nodia-ai-ai27-ui-validation.json",
      "docs/evidence/nodia-ai-ai28-validation.json",
      "docs/evidence/nodia-ai-ai36-c01-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-write-publication-r02-validation.json"
    ],
    "notes": "Publicación offline con builders nativos y schemas cerrados. El fragmento adicional es el único alcance nuevo; no equivale a cuenta real ni a una aceptación de todos sus efectos."
  },
  "approval": {
    "reference": "docs/evidence/nodia-ai-ai36-c05-write-publication-r02-authorization.md",
    "revision": 2,
    "content_sha256": "688a9888a46b0199c3e9f31477850e9a5b7c4e2e78c7cafb2bc8a817dddbd428"
  }
}
---

# Administración Core confirmada — contexto funcional para NodiaAI

## Qué resuelve

Crear y editar usuarios permitidos y administrar roles, acciones, acciones de negocio, módulos y grupos. Las asociaciones y la actividad afectan acceso y navegación; no son etiquetas decorativas. [AI-27/73](../../../../mvp/73-nodia-ai-ai27-core-administration.md) integra escritores nativos mediante propuesta exacta y confirmación humana. No administra claves o sesiones IA.

## Solicitudes ilustrativas

| Solicitud | Intención y aclaración |
|---|---|
| «Crea un usuario con este correo» | Requiere correo; pedirlo si falta. Nombre, imagen y asociaciones son opcionales según DTO. No solicitar contraseña Google. |
| «Dale Finanzas a esta persona» | Resolver usuario y módulo real; mostrar la colección final conservando otras asignaciones no retiradas explícitamente. |
| «Quita este rol» | Distinguir retirar una asociación de eliminar el catálogo de roles. Mostrar personas y acceso afectados. |
| «Renombra este módulo» | Distinguir traducción visible de key inmutable. La clave no se cambia para renombrar la etiqueta. |
| «Borra este usuario» | Rechazar por falta de DELETE nativo; aclarar si se desea desactivar mediante actualización. |

## Operaciones y mínimos

| Recurso | Preparador interno | Mínimo y efecto |
|---|---|---|
| users | `nodia_users_prepare_create/update` | Crear: email. Update: ID existente y campos explícitos; roles/modules son colecciones finales. |
| roles | `nodia_roles_prepare_create/update/delete` | Crear: key. Actions identifica asociaciones finales; rol reservado y último administrador protegidos. |
| actions | `nodia_actions_prepare_create/update/delete` | Crear: key; descripción y traducciones según DTO. Eliminación expone retiro de asociaciones. |
| business_actions | `nodia_business_actions_prepare_create/update/delete` | Crear: key; has_description/is_active nativos. El modo real de eliminación conserva restricciones de referencias. |
| modules | `nodia_modules_prepare_create/update/delete` | Crear: key, module_group_id y link. Key inmutable al editar. |
| module_groups | `nodia_module_groups_prepare_create/update/delete` | Crear: key; mostrar módulos/usuarios afectados cuando corresponda. |

Los sufijos de la tabla enumeran identidades individuales, no una herramienta que acepte operaciones arbitrarias. No hay DELETE/GET individual de usuarios ni lotes. Los endpoints y DTOs están enlazados en73; el código nativo es la fuente de campos, nulabilidad y defaults, siempre visibles en preview.

## Acceso y restricciones

NodiaAI y módulo de destino para ordinarios; super_admin transversal con actor real. No inventar RBAC granular donde el backend conserva administración global autenticada. NI-13 protege último super_admin activo, rol reservado, módulo inmutable y asociaciones completas atómicas. Omitido, null y colección vacía no son intercambiables.

Mostrar IDs string bigint sin conversión numérica, etiquetas resueltas, colección final, usuarios afectados y asociaciones retiradas. `resolved_existing` distingue upsert; `deletion_mode` diferencia delete/deactivate. Impacto y detalles son readonly generados por Server. Traducciones estructuradas por key/es/en; no JSON libre ni credenciales en contexto. La integración acota100 asociaciones/traducciones,255 bytes por clave de traducción,5000 por ES/EN y64KiB por comando; no redefine validaciones nativas.

## Filtros e informes

No se añaden informes en esta etapa. Las diez lecturas Core publicadas conservan sus contratos y permisos, filtros y paginado. Estas herramientas no agregan dinero ni mezclan métricas de productos.

## Vista previa y recuperación

Preparar no ejecuta efectos. Revisión material cambia hash y exige botón sobre la nueva propuesta. La frontera administrativa exclusiva reúne autorización, precondiciones, efecto y recibo. Un recibo comprometido se recupera sin repetir el writer; el resultado incierto se concilia. En una secuencia, lo completado se conserva y el resto revalida permisos actuales. Cancelar no revierte efectos anteriores.

## Integración y evidencia

- [x] Fuentes/DTOs nativos contrastados y límites documentados.
- [x] Integración interna con autoridad, concurrencia y recuperación; evidencia y límites en73.
- [ ] Publicación de preparadores MCP y aceptación de escritura Gemini.
- [ ] Aprobación documental explícita.

La ficha permanece draft/unregistered y approval null. Markdown no habilita herramientas o permisos. El [resumen](../README.md) distingue publicación de lectura, implementación de escritura y evidencia real.

## Evolución

Revisión1, AI-27: diecisiete puertos internos para seis recursos. Cambios materiales de datos/asociaciones o reglas invalidan propuestas; no se interpretan nuevas funcionalidades desde Markdown sin registro/contrato y publicación verificados.


Verificación Client: Client1571/205, focal280/7, tipado/lint/build correctos y11 QA sintéticas/6 capturas. [Evidencia Client](../../../../evidence/nodia-ai-ai27-client-validation.json) y [QA](../../../../evidence/nodia-ai-ai27-ui-validation.json) distinguen interfaz sintética de efectos SQL/proveedor. Confirmación delete no exige campos editables; los403 de negocio NI-13 conservan borrador y propuesta, y las revocaciones de autoridad conservan su tratamiento propio.


Continuidad AI-28: traducciones Core se agregan o actualizan por clave; claves omitidas se conservan. La propuesta muestra la colección resultante y rechaza quitar claves ya guardadas. Un marcador material exige nueva revisión de propuestas previas afectadas; los recibos completados continúan legibles. [Detalle74](../../../../mvp/74-nodia-ai-ai28-provider-configuration.md).

## Core: administración publicada en AI36-C05

Este fragmento añade sólo estas preparaciones publicadas:

- `nodia_actions_prepare_create`
- `nodia_actions_prepare_delete`
- `nodia_actions_prepare_update`
- `nodia_business_actions_prepare_create`
- `nodia_business_actions_prepare_delete`
- `nodia_business_actions_prepare_update`
- `nodia_module_groups_prepare_create`
- `nodia_module_groups_prepare_delete`
- `nodia_module_groups_prepare_update`
- `nodia_modules_prepare_create`
- `nodia_modules_prepare_delete`
- `nodia_modules_prepare_update`
- `nodia_roles_prepare_create`
- `nodia_roles_prepare_delete`
- `nodia_roles_prepare_update`
- `nodia_users_prepare_create`
- `nodia_users_prepare_update`

Cada herramienta recibe un partial cerrado, devuelve mínimos faltantes o propuesta revisable y permite continuar sólo con draft_id/revisión CAS exactos. No aplica el cambio de dominio. Consulta las referencias reales; nunca inventes IDs o enlaces. Sólo el botón humano sobre revisión/hash exactos admite la ejecución y su recibo nativo. No se aceptan SQL, comandos arbitrarios, secretos ni bulk/importación. Los cambios de usuarios, roles, acciones, módulos y asignaciones conservan autoridad Core, reglas de último administrador y precondiciones actuales. Una propuesta no concede su propia autoridad.

El backend exige NodiaAI y cada módulo/acción de destino vigentes, reautoriza al ejecutar y conserva recuperación/idempotencia. Publicación, selección del intento, disponibilidad, despliegue y aceptación real son estados distintos. Los apartados anteriores son históricos y no amplían este lote.
