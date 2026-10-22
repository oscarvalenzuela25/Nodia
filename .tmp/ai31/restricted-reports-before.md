---
{
  "schema_version": 1,
  "document_id": "nodia-ai.restricted-reports",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 1,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "AI-30 implementa registro lógico y motor interno de una fuente, verificados localmente, con PostgreSQL desechable, regresiones y activación en laboratorio privado. AI-31 conserva resultado público, combinación, presentación y publicación."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/76-nodia-ai-ai30-restricted-reports.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/41-nodia-ai-v1-contracts.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/45-nodia-ai-implementation-plan.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-055-nodia-ai-restricted-report-sources.md",
      "kind": "specification"
    }
  ],
  "verification": {
    "checked_on": "2026-10-17",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai30-validation.json",
      "docs/evidence/nodia-ai-ai30-lab-activation.json",
      "docs/evidence/nodia-ai-ai30-source-catalog.json",
      "docs/evidence/nodia-ai-ai30-final-health.json"
    ],
    "notes": "3.202 pruebas Server/202 archivos, con 89 casos focales incluidos; 147 comprobaciones y 118 consultas SQL reales sobre once fuentes en PostgreSQL desechable, más 135 regresiones en cuatro suites. Tipado/build y lint sin errores. Activación con backup, 882 dist idénticos, 944 archivos de paquete, API/worker activos, HTTP200 y cero pendientes. Sin UI, inferencia, publicación MCP ni cambios de esquema."
  },
  "approval": null
}
---

# Fuentes e informes restringidos

[Producto](../README.md) · [Entrega AI-30](../../../../mvp/76-nodia-ai-ai30-restricted-reports.md).

## Qué resuelve y qué significa

Permite describir fuentes lógicas autorizadas y calcular un informe filtrado sobre una fuente, sin enseñar tablas o SQL al chat. Grano es qué representa un hecho: una factura, movimiento o reserva. Un total comercial, cobro, gasto incurrido y gasto pagado son medidas diferentes.

## Solicitudes en lenguaje natural

| Petición | Interpretación y aclaración |
|---|---|
| «Total de gastos pagados por categoría» | Finanzas, dueño actual; pedir período/base si se solicita un mes ambiguo; pesos nativos sin ISO |
| «Gastos de esta casa en enero» | Identificar casa, fechas civiles/zona y si interesa incurrido o pagado |
| «Cuánto pagué al proveedor» | Factura no prueba pago ni moneda; Finanzas/Reservas no tienen relación comercial de proveedor; aclarar o informar semántica no soportada |
| «Suma gastos personales y del alojamiento» | Combinación/procedencia compartida en AI-31; sin suma general ni conversión implícita |
| «Ejecuta este SQL» | Rechazar: sólo campos/medidas/relaciones registrados |

## Operaciones y contratos

DescribeNodiaAiReportsUseCase recibe ReportDescribeInput y devuelve el catálogo detallado autorizado. RunNodiaAiReportUseCase valida ReportQueryInput y ejecuta una fuente con combine=separate. CompileNodiaAiReportUseCase usa sólo mapeos privados revisados. nodia_reports_describe/run son nombres diseñados en40; AI-30 no los publica por documentarlos ni registra endpoints nuevos.

## Datos mínimos y resolución de dudas

Versión actual del catálogo, fuente, alias, ámbito y medidas son obligatorios. Finanzas resuelve al dueño actual salvo destinatario super_admin explícito. Negocios requiere business_id y Reservas property_id. Período, filtros y agrupaciones son opcionales; si hay período, exige dimensión, rango semiabierto y zona. Aclarar unidad, concepto o fecha no disponibles; no crear una moneda/fecha económica ficticia.

## Reglas, acceso y restricciones

Sesión/NodiaAI/módulo destino actuales y política nativa del recurso. Mismos límites super_admin y colaboración de la app. Credenciales, roles/sesiones y JSON de proveedor/factura quedan fuera de las fuentes analíticas. No modifica información, no requiere propuesta de escritura y no consume inferencia de IA por calcular SQL.

## Filtros e informes

Once fuentes explícitas enumeradas en76. Filtros all/any planos y operadores por campo; medidas sum/count, dimensiones registradas, temporalidad y grano declarados. EXISTS evita duplicar padres por hijas; condiciones relacionadas son existencias independientes. Totales sobre todo el filtro antes de paginar grupos. Importes/counts exactos como cadenas; null y cero distintos. Cursor ligado a consulta/versión/actor/ámbito y reautorización por página.

Finanzas: pesos enteros nativos sin moneda ISO. Reservas: CLP según28. Facturas: conteo permitido, suma monetaria no soportada. created_at legacy sin zona no equivale a fecha de compra/emisión y no admite comparación/agrupación temporal. Fuentes cruzadas, alineación mensual derivada y compare_compatible permanecen en AI-31/contratos explícitos.

## Vista previa, confirmación y recuperación

Es lectura, sin cambios de negocio ni vista previa de mutación. Error/timeout no se convierte en resultado cero; debe mostrarse como fallo. Un resultado vacío conocido entrega cero y matched_records=0. No persiste una tabla analítica ni una fotografía entre páginas; la presentación/recuperación de resultados del chat se integrará con AI-31.

## Integración y evidencia

Registro y motor interno implementados y verificados: 3.202 pruebas Server/202 archivos con89 casos focales incluidos, once fuentes,147 comprobaciones y118 consultas PostgreSQL reales del motor con registros sintéticos, más135 regresiones en cuatro suites. [Entrega76](../../../../mvp/76-nodia-ai-ai30-restricted-reports.md) y [activación](../../../../evidence/nodia-ai-ai30-lab-activation.json) registran backup,882 dist idénticos al compilado probado/944 archivos de paquete, API/worker activos, HTTP200 y cero pendientes. La publicación/aceptación con proveedor permanece separada. Sin inferencia nueva ni cambio visual; no afecta layout, estados de cliente ni traducciones. Corpus compilado de54 fuentes documentales/27 excluidas; las67 lecturas/referencias y27 fragmentos publicados conservan su alcance. Mantener draft/unregistered y approval null hasta sus gates explícitos.

## Evolución y compatibilidad

Una fuente nueva o extensión requiere descriptor público, mapeo privado de ámbito/filtros/medidas/relaciones/grano/unidad/fechas y pruebas SQL. El hash del catálogo incluye esas reglas e invalida un cursor obsoleto. No se descubre todo el ORM ni se habilita una capacidad por añadir un Markdown.
