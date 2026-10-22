---
{
  "schema_version": 1,
  "document_id": "businesses.active-invoice-analysis",
  "product_id": "businesses",
  "kind": "feature",
  "revision": 1,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "AI36-C03 implementa un candidato MCP de análisis en la generación activa y un contrato privado puro que reutiliza el parser nativo. Publicación y aceptación generativa real pendientes."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Negocios y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/82-nodia-ai-ai36-integral-coverage.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-062-nodia-ai-active-invoice-analysis.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/contracts/invoice-analysis.json",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-invoice-analysis/use-case/build-nodia-ai-invoice-analysis-tool.use-case.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-18",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai36-c03-validation.json",
      "docs/evidence/nodia-ai-ai36-c03-python-linux-validation.json"
    ],
    "notes": "Evidencia por capas: contrato/parser nativo, gateway y SQL desechable. No inferencia real ni despliegue operativo; esta ficha draft no habilita el candidato."
  },
  "approval": null
}
---

# Análisis de factura en el turno activo — contexto funcional para NodiaAI

## Qué resuelve y qué significa

Convierte una imagen/PDF original del mensaje actual en una extracción revisable. Es un candidato de AI36-C03; todavía no está publicado. Complementa la [ficha del OCR y lecturas existentes](invoice-analysis.md), sin cambiar sus secciones aprobadas ni afirmar que el OCR legacy se ejecuta desde MCP. Un proveedor comercial es una entidad de Negocios, no una conexión de IA.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Aclaración necesaria |
|---|---|---|
| Analiza esta factura para mi negocio | Extraer datos del adjunto actual | Resolver negocio y archivo si hay ambigüedad |
| Usa la plantilla del proveedor | Aplicar mapeos nativos | Resolver proveedor comercial del mismo negocio |
| Guarda la factura extraída | Crear un registro posterior | Pedir mínimos nativos y preparar propuesta con botón humano |
| Analiza el audio o la factura de otro chat | Fuera del contrato | Pedir imagen/PDF original en el mensaje actual autorizado |

## Operaciones y contratos

| Operación | Clase/efecto | Contrato y estado | Resultado público |
|---|---|---|---|
| Preparar análisis | Lectura de contexto e instrucciones; sin efecto comercial | `nodia_invoices_analyze`, acción `prepare`, candidato cerrado | analysis_id, negocio/proveedor, metadatos públicos del adjunto y selección real, instrucciones nativas |
| Completar análisis | Validación/normalización pura; recibo durable | Mismo candidato, acción `complete` | Extracción revisable, `review_required:true`, procedencia `active_agentic_generation` |

[Contrato cerrado](../../../../../nodia-server/src/nodia-ai-products/contracts/invoice-analysis.json). La extracción ocurre en la generación Agentic que recibió el archivo. El [parser privado](../../../../../nodia-gemini-microservice/invoice_mcp_contract.py) reutiliza las reglas nativas; no realiza otra inferencia. Ninguna acción crea una factura, producto, borrador o propuesta de escritura.

## Datos mínimos y resolución de dudas

`prepare` necesita negocio y adjunto del mensaje actual; proveedor comercial es opcional y debe pertenecer al negocio. `complete` necesita el analysis_id y la estructura exacta de extracción. Preguntar ante referencias ambiguas o datos comerciales obligatorios ausentes. La selección de conexión/modo/modelo/intensidad pertenece al intento armado por Server, incluida delegación autorizada; no se recibe del modelo.

Aplicar los cinco mapeos nativos de proveedor, su impuesto y las reglas de cantidades/precios del parser. Cero es un dato válido y null significa desconocido; no inventar fechas, códigos, cantidades o importes. Fechas civiles ISO válidas o vacías. Hasta100 ítems; instrucciones de hasta32 KiB y contratos JSON de64 KiB. Los totales extraídos no acreditan pago ni gasto registrado.

## Reglas, acceso y restricciones

Requiere NodiaAI, el módulo de destino y autoridad nativa sobre el negocio; super_admin conserva su transversalidad. Se revalidan permisos, relación proveedor/negocio, configuración y archivo al ejecutar/recuperar. Sólo imagen/PDF original listo y vigente del mismo chat y epoch, efectivamente enviado en el intento actual. Texto revisado, audio, archivos antiguos o ajenos y archivos mayores de10 MiB se rechazan. No hay URLs, storage keys, rutas, SQL, actor ni credenciales como argumentos.

La acreditación privada de generación/hash/epoch se guarda en el contexto del intento; nunca se muestra al modelo. No se eleva el límite general de20 MiB del chat ni los techos MCP existentes. Los adjuntos siguen la purga del chat; crear una factura con archivo requiere su copia independiente y confirmación posterior.

## Filtros e informes

No agrega informes ni filtros de datos persistidos. Los ítems son observaciones extraídas del documento, no movimientos financieros, productos almacenados ni medidas combinables de un informe. Las consultas de facturas existentes conservan sus herramientas de lectura publicadas.

## Vista previa, confirmación y recuperación

El resultado queda pendiente de revisión. Una solicitud de creación posterior sigue mínimos y reglas nativas, propuesta exacta y botón humano; el análisis no confirma operaciones. La preparación y su único completion se enlazan al finalizar la transacción del recibo. Repetir un callback completado recupera su resultado exacto. La normalización pura puede repetirse tras ACK incierto con otro callback, sin otra inferencia o efecto comercial; sólo una finalización se compromete por análisis. La recuperación humana del recibo terminado reautoriza el recurso y no normaliza ni vuelve a inferir, incluso tras terminar el run; chats/archivos expirados no habilitan acceso.

## Integración y evidencia

La [entrega82](../../../../mvp/82-nodia-ai-ai36-integral-coverage.md) y [evidencia C03](../../../../evidence/nodia-ai-ai36-c03-validation.json) distinguen tests de contrato/parser real, SQL desechable con transporte y normalizador sintéticos, y disponibilidad real pendiente. El [ADR-062](../../../../architecture/decisions/ADR-062-nodia-ai-active-invoice-analysis.md) explica las alternativas y la prevención del OCR anidado. Publicación selectiva, despliegue del endpoint privado y aceptación con Gemini real permanecen pendientes; no se concede aprobación documental por implementar.

## Evolución y compatibilidad

Revisión1: contrato específico de análisis en generación activa, separado del OCR legacy y de las escrituras C01. No cambia esquemas/bindings publicados ni habilita mutaciones automáticas. Cambios futuros invalidan las revisiones y recibos incompatibles conforme los contratos comunes.
