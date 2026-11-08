---
{
  "schema_version": 1,
  "document_id": "nodia-ai.module-authorization",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 4,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "AI-09: persistencia M1, contratos tipados y composición interna; admisión/runtime/API pendientes. Política89 implementada y desplegada en Server2029/Clienteada el2026-10-26: acceso por módulos sin bloqueo por acciones, super_admin bypass y privacidad por propietario/colaborador. Tres suites PostgreSQL reales y HTTP/navegador super_admin verificados; usuarios ordinarios probados aisladamente. Esta revisión documental sigue sin aprobación o publicación."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento del módulo NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/89-module-access-and-user-data-scope.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-081-module-access-and-business-data-scope.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/53-nodia-ai-ai07-module-authorization.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/41-nodia-ai-v1-contracts.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai/use-case/authorize-nodia-ai.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai/use-case/authorize-nodia-ai-resource.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/mvp/54-nodia-ai-ai08-transversal-authority.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/55-nodia-ai-ai09-conversation-persistence.md",
      "kind": "specification"
    }
  ],
  "verification": {
    "checked_on": "2026-10-26",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai07-authorization-validation.json",
      "docs/evidence/nodia-ai-ai08-authority-validation.json",
      "docs/evidence/nodia-ai-ai09-persistence-validation.json",
      "docs/evidence/module-access-and-user-data-validation-r01.json",
      "docs/evidence/module-access-and-user-data-deployment-r01.json"
    ],
    "notes": "Política89: PostgreSQL real y adopción Server2029/Clienteada comprobados; HTTP y URL directa super_admin sin asignación verificados. Alcance y límites en el recibo; sin aprobar/publicar esta revisión."
  },
  "approval": null
}
---

# Módulo NodiaAI y autorización compartida

## Regla vigente de módulos y privacidad — 2026-10-25

[Política89](../../../../mvp/89-module-access-and-user-data-scope.md) y [ADR081](../../../../architecture/decisions/ADR-081-module-access-and-business-data-scope.md). El módulo habilita funcionalidades y no datos ajenos. Usuarios ordinarios necesitan el módulo y la propiedad o colaboración explícita; super_admin tiene bypass de permisos y acceso global. Las acciones de roles no bloquean. El guard vuelve a Inicio sin módulo. Se conservan sesión, recursos existentes, confirmaciones humanas y atribución del actor; ver un chat ajeno no permite confirmar como su autor. Esta revisión candidata sustituye las referencias históricas a ai:manage y al acceso global entre negocios; no publica conocimiento ni altera aprobaciones anteriores.


[Producto](../README.md). [Contrato AI-07](../../../../mvp/53-nodia-ai-ai07-module-authorization.md).

## Qué resuelve y qué significa

Resolver identidad y módulos actuales antes de entregar contexto o trabajar con datos. Acceso al chat y permiso sobre los datos de destino son comprobaciones distintas. La cuenta del proveedor de IA no es la identidad de la persona en Nodia.

## Solicitudes en lenguaje natural

| Solicitud | Resolución |
|---|---|
| «Muéstrame mis gastos» | Requiere NodiaAI y Finanzas asignados, además de reglas de la familia; integración de herramientas aún pendiente |
| «Combina gastos y reservas» | Exigir todos los destinos necesarios; no entregar información del módulo que falta |
| «Confirma la propuesta del chat de otra persona» | Un administrador puede inspeccionar, pero debe preparar una propuesta propia sin suplantar autor |

## Operaciones y contratos

No añade herramientas MCP ni endpoints. Exporta políticas internas para futuros consumidores. El catálogo registra key nodia_ai/ruta /tools/nodia-ai con IDs resueltos en BD, sin asignaciones automáticas. La página protegida informa indisponibilidad del chat hasta completar su runtime.

## Datos mínimos y resolución de dudas

Actor/sesión proceden de autenticación o de una concesión validada por el backend. Módulos requeridos proceden del registro; las acciones se conservan como metadata sin bloqueo; dueño del recurso se lee de persistencia. No pedir al usuario un actor ID como forma de autenticación. Super_admin que opera datos ajenos debe identificar destinatario; su actor nunca cambia.

## Reglas, acceso y restricciones

Usuario y sesión activos, módulos y grupos activos, rutas inequívocas y asignaciones vigentes para ordinarios. Super_admin omite asignaciones en backend y navegación, conserva reglas de dominio y no suplanta autores. La navegación vuelve a Inicio para ordinarios sin el módulo. Revocación se relee sin caché; AI-08 implementa barreras hasta el commit del efecto.

## Filtros e informes

No define SQL, fuentes o medidas de informes. Un fragmento/informe compuesto requiere la intersección completa de módulos; la autorización de filas y medidas debe aplicarla su familia.

## Vista previa, confirmación y recuperación

Permiso no equivale a confirmación. Confirmar como autor exige propiedad real; ver un chat ajeno no crea aprobación. Una nueva sesión válida puede recuperar recursos propios con autoridad actual; logout, módulo retirado o usuario inactivo impiden las siguientes comprobaciones. No se implementan todavía ejecuciones ni concesiones.

## Integración, evidencia y evolución

Política/SQL y módulo Nest verificados aisladamente según53 y su evidencia. Publicación y consumidores pendientes AI-12/14 y familias. Añadir un destino exige contrato real, módulos correctos y pruebas, no una excepción en Markdown. Modificar autoridad exige actualizar esta ficha e incrementar revisión; no publicar documentos en borrador.


[Autoridad transversal AI-08](shared-authority.md): actor/destinatario, transacciones y NI-13.


[Persistencia AI-09](conversation-persistence.md): once tablas M1, contratos cerrados y creación interna. Mensajes/admisión/retención automática/worker/routing operativo siguen AI-10..12.
