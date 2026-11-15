---
{
  "schema_version": 1,
  "document_id": "news",
  "product_id": "news",
  "kind": "product",
  "revision": 2,
  "document_status": "draft",
  "implementation": { "status": "planned", "notes": "Propuesta documental; sin módulo, endpoints ni integración real de Noticias acreditados." },
  "integration_status": "unregistered",
  "maintainer": "Nodia",
  "sources": [
    { "path": "docs/mvp/105-on-demand-tech-news.md", "kind": "specification" },
    { "path": "docs/features/news/editorial-design.md", "kind": "specification" }
  ],
  "verification": { "checked_on": null, "evidence_paths": [], "notes": "Investigación documental en plan105; implementación y proveedor real pendientes." },
  "approval": null
}
---

# Noticias — contexto de producto para NodiaAI

## Propósito y alcance

Intención confirmada: una sección para consultar noticias de tecnología,
programación e IA mediante un botón. [Plan105](../../../mvp/105-on-demand-tech-news.md)
conserva investigación y propuesta, todavía sin implementación ni aprobación.

## Conceptos y relaciones

| Concepto | Significado | Relación y fuente |
| --- | --- | --- |
| Fuente | Proveedor/editor que entrega enlaces y metadatos | Plan105 §2; selección pendiente |
| Noticia | Artículo enlazado con procedencia, sin garantía de veracidad | Plan105 §1 y §3 |
| Actualización | Consulta externa explícita; puede consumir cuota | Plan105 §3 |
| Tema | Interés para seleccionar/filtrar contenido | Confirmados tecnología, programación e IA; taxonomía pendiente |

## Módulos y autoridad

Destino candidato `/news`, no registrado por este documento. PENDIENTE: key,
asignación y política HTTP conforme a [autoridad89](../../../mvp/89-module-access-and-user-data-scope.md)
y [ADR092](../../../architecture/decisions/ADR-092-stable-module-navigation-routes.md).
Feeds y conexiones personales no deben compartirse entre usuarios.

## Índice de funcionalidades

| Función | Ficha | Implementación | Integración NodiaAI | Destino |
| --- | --- | --- | --- | --- |
| Lectura y actualización bajo demanda | [Ficha](features/on-demand-reading.md) | planned | unregistered | `/news` candidato |

## Interpretación de solicitudes que combinan funciones

Pedir noticias no autoriza inferencias, suscripciones, escrituras externas o acceso
a datos de otros productos. Conservar procedencia; no mezclar fecha de publicación
y consulta. No hay herramienta de Noticias disponible para el chat.

## Restricciones y pendientes

Pendientes acceso real daily.dev, condiciones de uso/retención, catálogo de fuentes,
contratos backend y UI. Resúmenes IA, guardados y estados de lectura son posibles
ampliaciones; no presentarlos como funciones disponibles. Ficha draft excluida
de publicación, añadida al registro sólo para validación documental.

La [dirección editorial candidata](../../../features/news/editorial-design.md)
se inspira en Codrops con metadatos legibles de Smashing y filtros de DEV.
Conserva sidenav/topbar, tema y navegación móvil. Es una propuesta de presentación;
no cambia autoridad, habilita fuentes o publica herramientas. daily.dev, DEV,
RSS oficiales y HN mantienen los estados separados del plan105. El usuario pidió
conservar el shell; no ha aprobado por extensión la composición recomendada.

## Evolución y trazabilidad

| Revisión | Cambio | Fuente | Impacto |
| --- | --- | --- | --- |
| 1 | Propuesta inicial y temas confirmados | Plan105 | Nueva candidata; sin herramientas o publicación |
| 2 | Opciones vigentes y dirección editorial dentro del shell existente | Plan105 §5 y especificación visual | Presentación propuesta; sin contratos ni autoridad nuevos |
