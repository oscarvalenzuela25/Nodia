---
{
  "schema_version": 1,
  "document_id": "nodia-ai.knowledge-publication",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 5,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "Contratos/build AI-06 y loader/ContextBuilder autorizados AI-12 implementados; índice técnico verificado con Gemini real. Corpus43 borradores excluidos; aprobación/publicación de contenido, herramientas de negocio y gates productivos independientes."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento del módulo NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/52-nodia-ai-ai06-knowledge-publication-contract.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-038-nodia-ai-compiled-knowledge-contract.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/scripts/nodia-ai-knowledge/contracts.schema.json",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/scripts/nodia-ai-knowledge/compiler.mjs",
      "kind": "implementation"
    },
    {
      "path": "docs/mvp/54-nodia-ai-ai08-transversal-authority.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/58-nodia-ai-ai12-context-execution.md",
      "kind": "specification"
    }
  ],
  "verification": {
    "checked_on": "2026-10-16",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai06-knowledge-publication-validation.json",
      "docs/evidence/nodia-ai-ai08-authority-validation.json",
      "docs/evidence/nodia-ai-ai11-ai12-final-regression.json",
      "docs/evidence/nodia-ai-ai11-ai12-live-validation.json"
    ],
    "notes": "Loader, permisos, detalle por IDs y releases verificados con fixtures; índice técnico vacío comprobado con Gemini real. No hay fichas/capacidades aprobadas ni publicadas."
  },
  "approval": null
}
---

# Metadatos y publicación del conocimiento — NodiaAI

[Producto](../README.md).

## Qué resuelve y qué significa

Mantener una sola fuente de metadatos por ficha y construir contexto inmutable coherente con capacidades del backend. Escribir/aprobar una ficha explica el producto; no crea endpoints, herramientas, permisos ni disponibilidad de un modelo.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Interpretación y aclaración |
|---|---|
| «Añade un nuevo feature al contexto» | Actualizar especificación/ficha/índices, contrato y binding de código; revisar/aprobar el contenido exacto antes de publicar |
| «Qué productos conoces» | AI-12 selecciona explicaciones publicadas y autorizadas; no enumera borradores ni sustituye datos actuales de BD |
| «Activa esta herramienta con un Markdown» | No se puede: registro del backend y evidencia de su familia son independientes de la ficha |

## Operaciones y contratos

El proceso de autoría/publicación no añade endpoint ni herramienta de negocio. [Contrato52](../../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md), [schemas](../../../../../nodia-server/scripts/nodia-ai-knowledge/contracts.schema.json) y [registro de build](../../../../../nodia-server/config/nodia-ai-knowledge.registry.json) describen autoría, bindings y manifiesto. `knowledge:check` valida; `knowledge:build` emite assets después del build Nest. AI-12 incorpora por separado las lecturas MCP técnicas de índice/detalle conforme a [context-execution](context-execution.md).

## Datos mínimos y resolución de dudas

Identidad/producto/tipo/revisión/estados, responsable, fuentes, verificación y aprobación son obligatorios en frontmatter JSON. Aprobación es null hasta confirmación explícita; luego referencia/revisión/hash exacto. El binding de código elige secciones, capacidad/revisión/schemas y módulos, no secretos ni credenciales. Paths son controlados y no se descubren por explorar carpetas durante un mensaje.

## Reglas, acceso y restricciones

Borradores/plantillas/retirados no se publican. Una ficha aprobada sin integración verificada no se entrega al modelo. Revisión/hash o schema incompatible bloquean build. Registro vacío actual significa cero capacidades/contexto publicados; no se rellena con candidatos40. Fuente/capacidad existente no demuestra aceptación operativa.

AI-07 implementa el módulo/política compartida según [53](../../../../mvp/53-nodia-ai-ai07-module-authorization.md); AI-08 completa transversalidad/barreras y [AI-12](context-execution.md) filtra fragmentos por actor/módulos antes de leerlos. El scope del run nunca se amplía por asignaciones posteriores. El compilador comprueba bindings estáticos, sin conceder acceso a un usuario. No concatenar AGENTS/runbooks/archivos del usuario al prompt ni conservar datos privados dentro de assets públicos.

## Filtros e informes

No define medidas financieras. Los fragmentos de semántica de informe requieren las mismas capacidades/contratos/módulos que sus fuentes; no exponen toda la ficha de otro módulo por compartir producto. Informes actuales se consultan con herramientas, no con el Markdown.

## Vista previa, confirmación y recuperación

Publicar conocimiento es un paso de build/release, no una confirmación de cambios de negocio. El botón humano de41 sigue independiente. Nueva release invalida propuestas incompatibles según43; nunca recrea efectos. El manifiesto fija revisión/hash y contratos del turno, sin leer el repositorio en VPS. Fallar build conserva el último bundle válido; sólo un build exitoso puede desplegarse.

## Integración y evidencia

- [x] Frontmatter único y contratos cerrados; fichas existentes migradas sin aprobación automática.
- [x] Compilador real de archivos/build con selección explícita; pruebas sintéticas de publicación/errores separadas del corpus actual.
- [ ] Alguna ficha/capacidad real aprobada, verificada y publicada: actualmente ninguna.
- [x] KnowledgeRegistry/ContextBuilder y autorización runtime por usuario, módulos/recursos y release integrados AI-07/08/12 para texto y MCP técnico verificados; otras modalidades conservan sus etapas.
- [x] Artefacto compilado y worker independiente comprobados en VM con Gemini real; el corpus vacío permanece excluido correctamente.
- [ ] Aceptación productiva, backups, conservación remota y despliegue AI-36..38.

Ver [evidencia AI-06](../../../../evidence/nodia-ai-ai06-knowledge-publication-validation.json) para el compilador aislado y [aceptación AI-11/12](../../../../evidence/nodia-ai-ai11-ai12-live-validation.json) para Gemini/MCP técnico con estado SQL desechable. Esta última comprueba el índice real vacío; contenido publicado y sus permisos se ejercitan mediante fixtures sintéticos, sin aprobar los borradores.

## Evolución y compatibilidad

| Revisión | Cambio | Impacto |
|---|---|---|
| 1 | Contrato de autoría/bindings/manifiesto y compilador AI-06 | Actual37 fichas draft/unregistered; pipeline sin contenido publicado ni tablas nuevas |
| 2 | AI-07 registra ruta NodiaAI y política compartida | Corpus de 38 borradores; consumidores runtime y barreras pendientes, sin publicación |
| 5 | AI-12 integra loader, contexto e índice/detalle técnicos; aceptación Gemini real | Corpus43 borradores, cero documentos/fragmentos publicados; aprobación e integración documental independientes |


[Autoridad transversal AI-08](shared-authority.md): actor/destinatario, transacciones y NI-13.
