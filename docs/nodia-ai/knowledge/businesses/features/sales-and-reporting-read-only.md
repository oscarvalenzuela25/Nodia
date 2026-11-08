---
{
  "schema_version": 1,
  "document_id": "businesses.sales-and-reporting-read-only",
  "product_id": "businesses",
  "kind": "feature",
  "revision": 1,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "R17 implementado y adoptado en VM: NodiaAI sólo consulta ventas/reportes; cinco preparadores y sus puertos activos retirados, históricos autorizados sin writer. Dos lecturas y dos fuentes de informes verificadas con DI y SQL desechable; POS manual conserva sus funciones. Server/KB selectivos, respaldo cifrado previo y posterior, 70 tablas/35 migraciones y Client R16 preservados. Nueva ficha draft/unregistered/approval:null; POS5 aprobado conserva sus bytes y sólo proyecta Filtros e informes."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Negocios y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/94-business-point-of-sale-and-product-refactor.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/52-nodia-ai-ai06-knowledge-publication-contract.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/89-module-access-and-user-data-scope.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/business/sales-tool-family.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-reports/config/report-sources.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-proposal/nodia-ai-proposal.module.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-write-tools/types/write-tool-contract.types.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-sales/use-case/build-nodia-ai-historical-sales-readers.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/config/nodia-ai-knowledge.registry.json",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-30",
    "evidence_paths": [
      "docs/evidence/nodia-ai-sales-readonly-20261030-r01.json"
    ],
    "notes": "R17: Server5685 pruebas correctas/1 omitida previa; catálogo47, conocimiento58 y contratos3. Linux6 garantías y SQL desechable13+3 correctos, una venta manual sólo en fixture. VM completada: manifestc38b16bd…c231/KB ea03686c…e5b, dos lecturas/cero writers, 70 tablas y ledger35 idénticos, respaldos verificados. Sin inferencia de proveedor ni aprobación/publicación de esta ficha candidata."
  },
  "approval": null
}
---

# Ventas y reportes de solo lectura — contexto funcional para NodiaAI

## Qué resuelve y qué significa

Por indicación expresa del usuario del 2026-10-30, NodiaAI sólo obtiene y muestra información de ventas y reportería. Esta decisión sustituye el alcance conversacional anterior que permitía preparar cambios de ventas. La gestión comercial continúa en el punto de venta y en las pantallas manuales.

«Solo lectura» se refiere a los datos comerciales: ventas, partidas, precios registrados, estado comercial y eventos de venta. No prohíbe la persistencia técnica necesaria del chat, presupuestos, autorizaciones de consulta, trazabilidad o artefactos de reportes. Una petición HTTP POST no implica por sí misma una escritura comercial.

## Solicitudes en lenguaje natural

| Solicitud | Comportamiento permitido | Aclaración o límite |
|---|---|---|
| «Muéstrame las ventas de esta empresa de octubre» | Consultar y mostrar ventas autorizadas | Resolver empresa y año si hay ambigüedad; America/Santiago |
| «Muéstrame el detalle de esta venta» | Leer cabecera y partidas históricas | Identidad de venta y negocio exactos; sin editarla |
| «¿Qué productos se vendieron más?» | Consultar ranking de agregados | Aclarar período y unidades o importe cuando sea necesario |
| «Compara las ventas de estos meses» | Obtener y presentar información comparable | Conservar moneda, filtros, estados y procedencia |
| «Crea, modifica, confirma o anula esta venta» | Rechazar la operación comercial en NodiaAI | Indicar que debe hacerse manualmente; no crear una propuesta ni pedir confirmación para ejecutarla |
| «Ejecuta la propuesta de venta antigua que quedó pendiente» | No ejecutar | Se puede mostrar el historial autorizado; una confirmación humana no restaura una operación retirada |

## Operaciones y contratos

| Operación | Herramienta | Límite |
|---|---|---|
| Listar ventas | `nodia_sales_list` | Negocio autorizado, filtros y paginación del servidor |
| Obtener una venta | `nodia_sales_get` | Detalle autorizado con precios congelados y CLP exactos |
| Describir fuentes de reportes | `nodia_reports_describe` | Fuentes, medidas y campos declarados; no SQL libre |
| Consultar reportes | `nodia_reports_run` | Fuentes `business_sales` y `business_sale_items`, agregados autorizados y resultado verificable |

Se retiran `nodia_sales_prepare_create`, `nodia_sales_prepare_update`, `nodia_sales_prepare_complete`, `nodia_sales_prepare_cancel` y `nodia_sales_prepare_discard`. No están disponibles para descubrimiento, preparación, actualización, workflows, confirmación, ejecución o reintento comercial. Los esquemas e identidades históricos se conservan para leer y conciliar resultados anteriores, sin reactivarlos.

## Datos mínimos y resolución de dudas

Empresa e identidad exactas, período y medida cuando correspondan. No inventar productos, importes, disponibilidad ni resultados ausentes. Las consultas usan servicios y esquemas del servidor, con parámetros admitidos y autoridad del actor; el modelo no recibe conexión ni credenciales de base de datos.

## Reglas, acceso y restricciones

Conservar sesión, módulos NodiaAI/Negocios y propiedad o colaboración según la política89; el bypass de superadministrador no habilita escrituras de ventas retiradas. La restricción se aplica por igual a Agentic y API key mediante el gateway común y los puertos de ejecución.

Las lecturas no deben crear ventas, modificar cantidades o precios, confirmar, anular o descartar ventas. Tampoco deben cambiar catálogo, disponibilidad o imágenes como efecto secundario de consultar un informe. Esta decisión no retira operaciones de otros módulos ajenas a ventas.

## Filtros e informes

CLP con escala0 y America/Santiago. Ventas confirmadas y partidas usan sus snapshots, no precios actuales del catálogo. Importes registrados no acreditan cobro ni saldo de caja. Unidades vendidas, total, promedio y ranking conservan el grano, filtros y semántica de las fuentes; cero real se distingue de resultado desconocido o error. No ordenar sólo una página como si contuviera toda la población.

## Vista previa, confirmación y recuperación

No hay vista previa ejecutable ni confirmación comercial de ventas en NodiaAI. Las propuestas retiradas se pueden consultar bajo la autoridad vigente, sin reenviar escrituras. Una ejecución anterior con resultado incierto sólo puede conciliar su recibo existente; nunca se repite la mutación para averiguar si ocurrió.

## Integración y evidencia

[Plan94, sección26](../../../../mvp/94-business-point-of-sale-and-product-refactor.md#26-nodiaai-ventas-y-reportes-de-solo-lectura--r17-2026-10-30) y [recibo](../../../../evidence/nodia-ai-sales-readonly-20261030-r01.json) separan código, pruebas, publicación técnica y adopción en VM.

La ficha POS revisión5 aprobada conserva sus bytes como antecedente. Su fragmento publicado se reduce a la sección ya aprobada «Filtros e informes», vinculado únicamente a las dos lecturas. Esta ficha nueva permanece draft/unregistered/approval:null; no se publica contenido nuevo sin aprobación exacta conforme52.

## Evolución y compatibilidad

R17 retira cinco capacidades y sus preparadores, conserva las dos lecturas y las fuentes de reportes, y cierra propuestas antiguas a nuevas confirmaciones o efectos. No cambia tablas, endpoints manuales del POS, reglas de precios ni contratos históricos de recibos. La numeración y los estados de ventas existentes permanecen intactos.
