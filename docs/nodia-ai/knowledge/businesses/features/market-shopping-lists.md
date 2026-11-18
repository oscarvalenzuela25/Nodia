---
{
  "schema_version": 1,
  "document_id": "businesses.market-shopping-lists",
  "product_id": "businesses",
  "kind": "feature",
  "revision": 1,
  "document_status": "draft",
  "implementation": {
    "status": "planned",
    "notes": "Maqueta navegable aceptada el 2026-11-18 y marcas compartidas confirmadas. Modelo, API, Client y verificación por entorno pendientes."
  },
  "integration_status": "unregistered",
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
    }
  ],
  "verification": {
    "checked_on": null,
    "evidence_paths": [],
    "notes": "La aceptación de la maqueta valida el flujo propuesto. La matriz del plan debe comprobar persistencia compartida, concurrencia y autorización con los servicios reales."
  },
  "approval": null
}
---

# Listas de Market — contexto funcional para NodiaAI

## Qué resuelve y qué significa

Listas de Market permitirá organizar compras de un negocio con partidas de
su catálogo y cantidades. La marca de cada partida representa avance en la
lista y se comparte entre los usuarios autorizados del negocio. El copiado
exporta sólo el nombre y la cantidad de cada producto para pegar manualmente.
La [especificación y sus pruebas pendientes](../../../../mvp/110-market-shopping-lists-plan.md)
describen una función futura.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Datos faltantes o ambigüedad | Aclaración esperada |
| --- | --- | --- | --- |
| «Muéstrame la lista de reposición» | Consultar la composición | Negocio y lista si hay homónimas | Pedir el negocio o la lista exacta cuando el contexto no los resuelva. |
| «Agrega dos de este producto a la lista» | Editar una lista | Lista y producto de catálogo exactos | Pedir los mínimos que falten y orientar al editor nativo cuando esté disponible. |
| «Marca el arroz como comprado» | Cambiar una marca compartida | Lista y partida exactas | Confirmar que la solicitud corresponde a Listas de Market y orientar al drawer cuando esté disponible. |
| «Envía la lista por WhatsApp» | Compartir con terceros | Destinatario y canal | El flujo previsto permite copiar texto y pegarlo manualmente en otro lugar. |

## Operaciones y contratos

| Operación | Clase y efecto previstos | Herramienta y estado | Contrato propuesto |
| --- | --- | --- | --- |
| Buscar y abrir | Lectura por negocio con paginación | Pendiente en Client y Server | [Listado y detalle](../../../../mvp/110-market-shopping-lists-plan.md#4-contratos-http-propuestos) |
| Crear, editar o cambiar actividad | Escrituras nativas de composición | Pendiente en Client y Server | [Alta, edición y actividad](../../../../mvp/110-market-shopping-lists-plan.md#4-contratos-http-propuestos) |
| Marcar o desmarcar | Escritura nativa de una partida compartida | Pendiente en Client y Server | [Marca y control de revisión](../../../../mvp/110-market-shopping-lists-plan.md#4-contratos-http-propuestos) |
| Copiar | Lectura y copia local de nombres y cantidades | Pendiente en Client | [Flujo de copiado](../../../../mvp/110-market-shopping-lists-plan.md#1-flujo-aprobado) |

La ficha documenta una función nativa futura. El registro de capacidades y
las herramientas publicadas conservan sus alcances actuales.

## Datos mínimos y resolución de dudas

Para crear se necesita un negocio autorizado y el nombre de la lista. Para
agregar se elige el producto del negocio y se indica la cantidad. La maqueta
empieza con cantidad 1. La identidad de la lista y de la partida permite
distinguir nombres coincidentes y conservar las marcas correctas.

## Reglas, acceso y restricciones

El módulo canónico `/business` y el ámbito vigente del negocio gobiernan
lecturas y escrituras. Propietario y colaboradores autorizados comparten la
marca de la misma partida. La actividad de la lista conserva sus datos y
permite reactivarla. Los datos de venta y stock se rigen por sus respectivos
contratos. Ver [política de negocio](../../../../mvp/89-module-access-and-user-data-scope.md).

## Filtros e informes

La primera entrega prevé búsqueda paginada por nombre dentro del negocio y
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
- [ ] Contratos, autorización y concurrencia comprobados con Server.
- [ ] Recorrido Client y adopción por entorno comprobados.

## Evolución y compatibilidad

| Revisión | Cambio y fuente | Integración |
| --- | --- | --- |
| 1 | Plan de Listas de Market a partir de la maqueta aprobada y la decisión de marcas compartidas. | Ficha candidata para validación documental. |
