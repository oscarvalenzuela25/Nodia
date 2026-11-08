---
{
  "schema_version": 1,
  "document_id": "businesses.business-data-privacy",
  "product_id": "businesses",
  "kind": "feature",
  "revision": 1,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "Ámbito SQL y autoridad actual implementados en REST, preparadores, referencias y recuperación NodiaAI. Tres suites PostgreSQL16 desechables correctas; Server2029/Clienteada desplegados y verificados. No equivale a probar todas las combinaciones HTTP o R2; revisión documental sin publicar."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Negocios y NodiaAI conforme AGENTS",
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
      "path": "nodia-server/src/business-access/business-access.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/product/product.service.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/provider/provider.service.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/invoice/invoice.service.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/business/use-case/read-nodia-ai-business.use-case.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-26",
    "evidence_paths": [
      "docs/evidence/module-access-and-user-data-validation-r01.json",
      "docs/evidence/module-access-and-user-data-deployment-r01.json"
    ],
    "notes": "Política89: PostgreSQL real y adopción Server2029/Clienteada comprobados; HTTP y URL directa super_admin sin asignación verificados. Alcance y límites en el recibo; sin aprobar/publicar esta revisión."
  },
  "approval": null
}
---

# Privacidad de datos de Negocios

[Producto](../README.md) · [Regla vigente89](../../../../mvp/89-module-access-and-user-data-scope.md).

## Qué resuelve y qué significa

El módulo Negocios permite usar funcionalidades, pero sus datos pertenecen al negocio autorizado. Usuarios ordinarios consultan negocios propios o compartidos expresamente mediante colaboración activa. super_admin activo conserva acceso global. Esta regla sustituye el acceso global histórico de productos, proveedores y facturas; no añade permisos por acciones de rol.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Resolución |
|---|---|
| «Muéstrame los productos de mi negocio» | Resolver un negocio autorizado; consultar datos actuales. |
| «Consulta la factura del negocio de otra persona» | Rechazar si no existe colaboración activa ni super_admin; conocer un ID no concede acceso. |
| «Usa esta factura en otro negocio mío» | Exigir acceso a origen y destino; conservar el protocolo de copia de archivo y confirmación humana. |
| «Vuelve a mostrar el resultado anterior» | Revalidar acceso actual; una revocación puede impedir recuperar datos históricos. |

## Operaciones y contratos

Listas, detalles, filtros y CSV se limitan en SQL antes de contar, paginar o exportar. Altas, cambios, importación y bulk HTTP comprueban negocios de origen/destino antes de escribir; ninguna de estas rutas habilita automáticamente herramientas bulk en NodiaAI. Los preparadores existentes comprueban el ámbito antes de mostrar vistas previas. Ejecutar exige además la confirmación y las precondiciones nativas.

La regla se aplica a productos, logs, proveedores, contactos y facturas. Las fichas de cada recurso conservan sus campos y contratos; esta ficha no registra herramientas ni cambia esquemas de entrada/salida.

## Datos mínimos y resolución de dudas

Actor y sesión proceden de autenticación real; el modelo no elige el usuario. Los IDs de negocio/recurso identifican objetivos y no son permisos. Preguntar por el negocio cuando la intención sea ambigua. Los filtros enviados por el cliente se intersectan con el ámbito autorizado y no lo reemplazan.

## Reglas, acceso y restricciones

NodiaAI requiere su módulo y el de Negocios para usuarios ordinarios. No exige acciones de rol. super_admin no necesita asignaciones individuales y conserva existencia, integridad, atribución del actor y confirmación humana. Una colaboración revocada deja de conceder acceso; las asociaciones de un recurso no deben hidratar datos de otro negocio.

Los archivos de factura usan el namespace de su negocio. Antes de subir o firmar una descarga se comprueba pertenencia; una URL ya entregada mantiene su vigencia nativa, sin promesa de revocación instantánea.

## Filtros e informes

Se conservan filtros, orden, paginado y límites de cada contrato. El predicado de propiedad/colaboración se aplica también a conteos y exportaciones; no se filtra una página descargada en memoria ni se inventan agregados nuevos.

## Vista previa, confirmación y recuperación

La propuesta no puede revelar datos ajenos antes de guardar. Al recuperar un recibo se verifica autoridad actual sin exigir que el registro conserve todos sus valores históricos. Si un recurso existente se trasladó a un ámbito ajeno, se bloquea; si se borró, puede conservarse el recibo propio mientras el negocio original siga autorizado. Un resultado incierto no se reejecuta.

## Integración y evidencia

Implementación y adopción del [plan89](../../../../mvp/89-module-access-and-user-data-scope.md), con [PostgreSQL real y comprobaciones del entorno](../../../../evidence/module-access-and-user-data-deployment-r01.json). Ficha en borrador, sin binding ni publicación; los documentos aprobados históricos conservan sus hashes. Los usuarios ordinarios se probaron en SQL desechable; HTTP/navegador operativos se comprobaron con super_admin, sin mutaciones de negocio o R2 en vivo.

## Evolución y compatibilidad

Revisión1: decisión confirmada el2026-10-25 y contratos de privacidad actuales. Las propuestas se revalidan con autoridad vigente; no se amplían herramientas publicadas ni se suplantan autores de confirmaciones.
