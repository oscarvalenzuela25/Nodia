---
{
  "schema_version": 1,
  "document_id": "news",
  "product_id": "news",
  "kind": "product",
  "revision": 9,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "Catálogo revisado en la rama: Go, Rust y Kubernetes sustituyen web.dev y Node.js. Lectura pública de caché y actualización manual por fuente para super_admin. Preparado para CI y promoción."
  },
  "integration_status": "unregistered",
  "maintainer": "Nodia",
  "sources": [
    {
      "path": "docs/mvp/105-on-demand-tech-news.md",
      "kind": "specification"
    },
    {
      "path": "docs/features/news/editorial-design.md",
      "kind": "specification"
    },
    {
      "path": "docs/features/news/source-catalog.md",
      "kind": "specification"
    },
    {
      "path": "docs/features/news/http-contract.md",
      "kind": "specification"
    },
    {
      "path": "docs/features/news/deployment-readiness.md",
      "kind": "specification"
    }
  ],
  "verification": {
    "checked_on": "2026-11-18",
    "evidence_paths": [
      "docs/evidence/news-source-discovery-20261116.md",
      "docs/evidence/news-public-rss-implementation-20261116.md",
      "docs/evidence/news-editorial-design-20261116.md",
      "docs/evidence/news-nodejs-source-review-20261116.md",
      "docs/evidence/news-nodejs-integration-20261116.md",
      "docs/evidence/news-final-validation-20261116.md",
      "docs/evidence/news-final-ui-20261116.md",
      "docs/evidence/news-dev-source-refresh-20261118.md"
    ],
    "notes": "La revisión verificó los tres feeds oficiales por HTTPS y sus fuentes de atribución. Los cortes anteriores conservan las pruebas de la primera entrega."
  },
  "approval": null
}
---

# Noticias — contexto de producto para NodiaAI

## Renovación de fuentes — 2026-11-18

[Plan105 §16](../../../mvp/105-on-demand-tech-news.md#16-renovación-del-catálogo-de-noticias-dev--2026-11-18)
y el [catálogo](../../../features/news/source-catalog.md) registran Go y Rust
en Programación y Kubernetes en Tecnología. La rama deja fuera de lectura
pública los snapshots de web.dev y Node.js. La lectura conserva acceso público
y la obtención externa sigue reservada a cada clic de un super_admin vigente.
La evidencia del catálogo anterior se conserva en las secciones históricas.

## NEWS-06: candidato preparado — 2026-11-16

[Plan105§13](../../../mvp/105-on-demand-tech-news.md#13-news-06-validación-final-y-preparación-de-entrega--solicitud2026-11-16), [evidencia final](../../../evidence/news-final-validation-20261116.md) y [guía de entrega](../../../features/news/deployment-readiness.md) registran preparación técnica local, con JWT/SQL reales de laboratorio y dos POST que obtuvieron RSS reales para lectura pública. No se equipara el JWT efímero con Google o sesión humana. Carga inicial corregida con huesos Boneyard geométricos, sin noticias ficticias; refetch conserva contenido. UI adversa y teclado correctos. Zoom nativo200% medido con teclado; captura visual fallida, teléfono y aceptación humana pendientes.

La primera versión RSS está implementada; CI/promoción por SHA y adopción son fases separadas. No desplegar Client antes de Server/migraciones; recuperación conserva ledger append-only. Este contexto no ejecuta ni autoriza despliegues. Sin cambios de capacidad, operaciones, autoridad o herramientas; ficha draft/unregistered/approval:null. Los cortes inferiores conservan su evidencia y pendientes históricos, sucedidos por esta revisión8 para preparación local.


## Segunda fuente RSS Node.js — NEWS-04, 2026-11-16

[Plan105§12](../../../mvp/105-on-demand-tech-news.md#12-news-04-segunda-fuente-rss-nodejs--solicitud2026-11-16), [contrato](../../../features/news/http-contract.md) y [evidencia](../../../evidence/news-nodejs-integration-20261116.md) registran dos fuentes locales: web.dev y Node.js. Lectura pública sólo caché; cada actualización exige fuente explícita y super_admin activo vigente. Filtro de lectura y fuente a actualizar independientes, sin POST implícito o batch. Snapshots/estado/validadores/reservas por fuente; fallo de una conserva la otra. Una URL compartida muestra todas las procedencias/licencias vigentes, con metadata primaria de la fuente filtrada o el orden estable web.dev/Node.js.

Node.js aporta sólo título/URL/fecha y mantiene autor/extracto null. Aviso MIT completo accesible desde sus tarjetas; no cuerpos, imágenes o logos. Límites locales:1MiB/10s, raw500web.dev/2000Node,100artículos y7días lógicos por fuente. La segunda migración amplía CHECK sin precargar feed; rollback elimina caché Node y preserva web.dev. NEWS-06 completa preparación local y conserva aceptación/adopción; daily.dev deshabilitada y GitHub candidata, sin bloquear entrega RSS. Impacto: ampliar fuentes/procedencias de la función existente, sin herramienta IA, autoridad o escritura nueva. Draft/unregistered/approval:null; no se publica contexto. Esta continuación sucede las referencias históricas a Node como candidata y primera fuente única.


## Propósito y alcance

Intención confirmada: una sección para consultar noticias de tecnología,
programación e IA mediante un botón. [Plan105](../../../mvp/105-on-demand-tech-news.md)
conserva la investigación, el contrato y el historial de la primera entrega.
El usuario confirmó en §8 lectura pública bajo Home y
fuentes con cupo sólo para sesiones Nodia válidas. La solicitud posterior de §9
reserva toda obtención externa a super_admin activo; otros usuarios leen resultados
conservados de la capa que les corresponda. La lectura pública no requiere módulo.

## Conceptos y relaciones

| Concepto | Significado | Relación y fuente |
| --- | --- | --- |
| Fuente | Editor que entrega enlaces y metadatos | Plan105 §16; Go, Rust y Kubernetes en el catálogo actualizado |
| Noticia | Artículo enlazado con procedencia, sin garantía de veracidad | Plan105 §1 y §3 |
| Actualización | Consulta externa explícita; puede consumir cuota | Plan105 §3 |
| Tema | Interés para seleccionar o filtrar contenido | Go y Rust en Programación. Kubernetes en Tecnología. IA para futuras fuentes autorizadas |

## Módulos y autoridad

Destino `/news` público implementado localmente. Enlace fijo debajo
de Home; no exige sesión/asignación de módulo. Fuentes con cupo exigen sesión real
de cualquier usuario para lectura, además de condiciones del proveedor. Toda
obtención externa, incluso RSS público, exige super_admin activo y sesión real,
sin conceder el permiso por un módulo o por un ID/email fijo en código.
La excepción está en [autoridad89](../../../mvp/89-module-access-and-user-data-scope.md)
y [ADR105 propuesto](../../../architecture/decisions/ADR-105-public-news-and-source-access-tiers.md).
Otros módulos privados conservan sus guards. Sólo se comparte caché pública de
fuentes autorizadas; feeds/conexiones limitados no se comparten entre actores ni
se vuelven públicos por guardar sus resultados.

## Índice de funcionalidades

| Función | Ficha | Implementación | Integración NodiaAI | Destino |
| --- | --- | --- | --- | --- |
| Lectura y actualización bajo demanda | [Ficha](features/on-demand-reading.md) | Go, Rust y Kubernetes integrados en la rama | unregistered | `/news` |

## Interpretación de solicitudes que combinan funciones

Pedir noticias no autoriza inferencias, suscripciones, escrituras externas o acceso
a datos de otros productos. Conservar procedencia; no mezclar fecha de publicación
y consulta. No hay herramienta de Noticias disponible para el chat.

## Restricciones y pendientes

El [catálogo](../../../features/news/source-catalog.md) define tres fuentes
públicas. Las demás candidatas requieren revisar sus propios términos y
condiciones. Los [contratos](../../../features/news/http-contract.md) separan
GET público de caché y POST de actualización super_admin.
Resúmenes IA, guardados y estados de lectura son posibles
ampliaciones; no presentarlos como funciones disponibles. Ficha draft excluida
de publicación, añadida al registro sólo para validación documental.

La [dirección editorial candidata](../../../features/news/editorial-design.md)
se inspira en Codrops con metadatos legibles de Smashing y filtros de DEV.
Conserva sidenav/topbar, tema y navegación móvil. Variante sin medios implementada
localmente por NEWS-05, sin aprobación documental por extensión; no cambia
autoridad, habilita fuentes o publica herramientas. daily.dev, DEV,
RSS oficiales y HN mantienen los estados separados del plan105. El usuario pidió
conservar el shell; no ha aprobado por extensión la composición recomendada.

## Evolución y trazabilidad

NEWS-05 [plan105§10](../../../mvp/105-on-demand-tech-news.md#10-news-05-composición-editorial-y-chips-de-temas--2026-11-16)
completa presentación local: chips de temas existentes, composición editorial
por contenedor, metadatos legibles y foco recuperable. Evaluación visual: no
cambia conceptos, contratos, interpretación de resultados, autoridad o herramientas.
El contador usa total ya entregado por Server; tema/autor siguen siendo datos
reales del artículo. Sin portadas inventadas o nuevas capacidades del chat.

La continuación [plan105§7](../../../mvp/105-on-demand-tech-news.md#7-rama-y-secuencia-de-implementación--2026-11-16)
registró la rama `codex/news-implementation` y las etapas NEWS-01–06. Primero
fuentes/condiciones/ámbito, después contratos/autoridad, primera fuente completa,
RSS/resiliencia, cierre editorial y aceptación por entorno. La recomendación sigue
siendo daily.dev y RSS; DEV/HN siguen candidatas. Impacto de planificación:
en aquel corte no había contratos implementados. La continuación §9 implementa
los de primera fuente RSS con evidencia local, sin herramienta NodiaAI o adopción.

| Revisión | Cambio | Fuente | Impacto |
| --- | --- | --- | --- |
| 1 | Propuesta inicial y temas confirmados | Plan105 | Nueva candidata; sin herramientas o publicación |
| 2 | Opciones vigentes y dirección editorial dentro del shell existente | Plan105 §5 y especificación visual | Presentación propuesta; sin contratos ni autoridad nuevos |
| 3 | Rama dedicada y secuencia NEWS-01–06 | Plan105 §7 | Planificación; fuentes/autoridad/retención pendientes, sin implementación o aprobación nuevas |
| 4 | Acceso público, posición bajo Home y clasificación de fuentes | Plan105 §8, catálogo y ADR105 propuesto | Regla funcional confirmada; RSS externos comprobados, sin integración Nodia, aprobación documental o publicación nuevas |
| 5 | Obtención exclusiva super_admin y primer RSS implementado localmente | Plan105 §9, contratos y evidencia local | Sucede fetch por cualquier sesión/anónimo; producto parcial, sin adopción, herramienta o aprobación nuevas |
| 6 | NEWS-05: chips y composición editorial local | Plan105 §10, diseño y evidencia visual | Presentación/interacción de filtros existentes; contexto y herramientas conservados, aceptación/adopción pendientes |
