---
{
  "schema_version": 1,
  "document_id": "businesses.market-shopping-lists",
  "product_id": "businesses",
  "kind": "feature",
  "revision": 4,
  "document_status": "approved",
  "implementation": {
    "status": "implemented",
    "notes": "Función nativa entregada. NodiaAI reutiliza las consultas nativas autorizadas y proyecta sólo los datos de lectura declarados."
  },
  "integration_status": "published",
  "maintainer": "Mantenimiento de Negocios y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/110-market-shopping-lists-plan.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-108-business-shopping-list-shared-checklist.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/89-module-access-and-user-data-scope.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/business-shopping-list/business-shopping-list.controller.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/migrations/1793730000000-CreateBusinessShoppingLists.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/ListsTab/ListsTab.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/business-shopping-list/shopping-lists-tool-family.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/contracts/business-shopping-lists.schema.json",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/business-shopping-list/shopping-list-scope.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-11-19",
    "evidence_paths": [
      "docs/evidence/market-shopping-lists-20261118.md",
      "docs/evidence/nodia-ai-business-reads-20261119.md"
    ],
    "notes": "Las dos consultas usan el gateway compilado y el caso de uso nativo en PostgreSQL aislado con usuarios sintéticos."
  },
  "approval": {
    "reference": "docs/evidence/nodia-ai-business-reads-20261119.md",
    "revision": 4,
    "content_sha256": "68c5f9450d6734ca207824fa3d35b853789cfaa5019a5eedb5e74de6098001f8"
  }
}
---

# Listas de Market — contexto funcional para NodiaAI

## Qué resuelve y qué significa

Listas de Market organiza compras de un negocio con partidas de
su catálogo y cantidades. La marca de cada partida representa avance en la
lista y se comparte entre los usuarios autorizados del negocio. El copiado
exporta sólo el nombre y la cantidad de cada producto para pegar manualmente.
El [plan de implementación](../../../../mvp/110-market-shopping-lists-plan.md)
recoge el flujo nativo, el contrato y las pruebas por entorno.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Datos faltantes o ambigüedad | Aclaración esperada |
| --- | --- | --- | --- |
| «Muéstrame la lista de reposición» | Consultar la composición | Negocio y lista si hay homónimas | Pedir el negocio o la lista exacta cuando el contexto no los resuelva. |
| «Agrega dos de este producto a la lista» | Editar una lista | Lista y producto de catálogo exactos | Pedir los mínimos que falten y orientar al editor nativo. |
| «Marca el arroz como comprado» | Cambiar una marca compartida | Lista y partida exactas | Confirmar que la solicitud corresponde a Listas de Market y orientar al checklist. |
| «Envía la lista por WhatsApp» | Compartir con terceros | Destinatario y canal | Desde la lista se puede copiar el texto para pegarlo manualmente en ese canal. |

## Operaciones y contratos

| Operación | Clase y efecto | Estado | Contrato |
| --- | --- | --- | --- |
| Buscar y abrir | Lectura por negocio con paginación | Client y Server | [Listado y detalle](../../../../mvp/110-market-shopping-lists-plan.md#4-contratos-http) |
| Crear, editar o cambiar actividad | Escrituras nativas de composición | Client y Server | [Alta, edición y actividad](../../../../mvp/110-market-shopping-lists-plan.md#4-contratos-http) |
| Marcar o desmarcar | Escritura nativa de una partida compartida | Client y Server | [Marca y control de revisión](../../../../mvp/110-market-shopping-lists-plan.md#4-contratos-http) |
| Copiar | Lectura y copia local de nombres y cantidades | Client | [Flujo de copiado](../../../../mvp/110-market-shopping-lists-plan.md#1-flujo-aprobado) |

Las operaciones nativas se usan en **Negocios → Market → Listas**.
Market agrupa también **Proveedores**, **Productos** y **Facturas**. La
búsqueda por nombre queda encima de la tabla, con la misma presentación
de los listados de Productos y Proveedores.

## Consultas de solo lectura en NodiaAI

- `nodia_business_shopping_lists_list` busca listas por nombre dentro de un
  negocio autorizado. Devuelve una página de listas activas e inactivas con
  su identidad y cantidad de partidas. Usa `nodia_businesses_list` si falta
  resolver el negocio y el usuario tiene acceso a esa consulta.
- `nodia_business_shopping_lists_get` abre una lista por su ID y el ID del
  mismo negocio. Devuelve una página de partidas con nombre, cantidad,
  disponibilidad en catálogo y marca de compra compartida. Para responder
  «¿qué falta comprar?», usa las partidas sin marcar y consulta las páginas
  que falten antes de presentar un recuento completo. Distingue la marca de
  compra de la disponibilidad del producto.
- Si hay varios negocios o listas que coinciden, pide al usuario que elija.
  Si falta autorización, explica que se necesita el módulo Negocios y acceso
  al negocio. El checklist manual permite crear, editar, marcar y desmarcar.

## Datos mínimos y resolución de dudas

Para crear se necesita un negocio autorizado y el nombre de la lista. Para
agregar se elige el producto del negocio y se indica la cantidad. La maqueta
empieza con cantidad 1. Se admiten cantidades de hasta tres decimales. La identidad de la lista y de la partida permite
distinguir nombres coincidentes y conservar las marcas correctas.

## Reglas, acceso y restricciones

El módulo canónico `/business` y el ámbito vigente del negocio gobiernan
lecturas y escrituras. Propietario y colaboradores autorizados comparten la
marca de la misma partida. La actividad de la lista conserva sus datos y
permite reactivarla. Si el producto deja de estar activo en el negocio,
se conserva el nombre registrado al agregarlo y se indica la falta de
disponibilidad en el catálogo. Los datos de venta y stock se rigen por sus respectivos
contratos. Ver [política de negocio](../../../../mvp/89-module-access-and-user-data-scope.md).

## Filtros e informes

El listado ofrece búsqueda paginada por nombre dentro del negocio y
conteo de productos por lista. Las cantidades son de cada partida y el
avance muestra cuántas partidas están marcadas. Ambos datos pertenecen a la
lista consultada.

## Vista previa, confirmación y recuperación

El mismo editor muestra nombre y cantidades antes de guardar. Quitar una
partida o cambiar actividad requiere confirmación. En el drawer cada checkbox
guarda y revalida la partida. La recuperación consulta el recibo de alta o el
estado vigente de la marca según la operación y conserva el borrador de edición.
Ver [carreras y fases](../../../../mvp/110-market-shopping-lists-plan.md#6-verificación-de-aceptación).

## Integración y evidencia

- [x] Maqueta y decisión de marcas compartidas confirmadas.
- [x] Contratos, autorización y concurrencia comprobados con Server en laboratorio.
- [x] Recorrido Client verificado en laboratorio.
- [x] Integración local de las dos lecturas en NodiaAI con permisos por negocio.
- [ ] Verificación operativa de NodiaAI por entorno y modalidad.

## Evolución y compatibilidad

| Revisión | Cambio y fuente | Integración |
| --- | --- | --- |
| 1 | Plan de Listas de Market a partir de la maqueta aprobada y la decisión de marcas compartidas. | Ficha candidata para validación documental. |
| 2 | Función nativa, persistencia y verificación en laboratorio. | Candidata sin registrar, con adopción operativa pendiente. |
| 3 | Ajustes visuales de búsqueda, editor y checklist. | Conserva el contrato de la función nativa. |
| 4 | Búsqueda y detalle paginado en el chat por negocio. | Se publica el apartado de solo lectura con los dos contratos vinculados. |
