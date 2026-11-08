---
{
  "schema_version": 1,
  "document_id": "businesses.active-invoice-analysis",
  "product_id": "businesses",
  "kind": "feature",
  "revision": 3,
  "document_status": "approved",
  "implementation": {
    "status": "partial",
    "notes": "Candidato MCP implementado; contrato privado puro adoptado y comprobado en la VM Linux local el2026-10-25. Reutiliza el parser nativo sin OCR anidado. Publicación y aceptación del recorrido generativo específico siguen pendientes."
  },
  "integration_status": "published",
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
    "checked_on": "2026-10-25",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai36-c03-validation.json",
      "docs/evidence/nodia-ai-ai36-c03-python-linux-validation.json",
      "docs/evidence/nodia-ai-ai36-c03-native-contract-adoption-r01.json"
    ],
    "notes": "Contrato/parser y SQL desechable históricos separados de la adopción real8320. Cinco HTTP privados reales comprueban401/200/200/413/422 y cero/null, sin inferencia, R2 o efectos. La recalificación general de Gemini y la aceptación MCP del analizador son gates independientes. La ficha sigue draft/unregistered, approval:null; no habilita el candidato."
  },
  "approval": {
    "reference": "docs/evidence/nodia-ai-ai36-c03-publication-authorization-r01.json",
    "revision": 3,
    "content_sha256": "9fe8459c3831be7458a92b5636c50f0c6989b3a94019dff2a4f42bb24661098d"
  }
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

La [entrega82](../../../../mvp/82-nodia-ai-ai36-integral-coverage.md) y [evidencia C03](../../../../evidence/nodia-ai-ai36-c03-validation.json) distinguen tests de contrato/parser real, SQL desechable con transporte y normalizador sintéticos, y disponibilidad real pendiente. El [ADR-062](../../../../architecture/decisions/ADR-062-nodia-ai-active-invoice-analysis.md) explica las alternativas y la prevención del OCR anidado. El [endpoint privado fue adoptado y comprobado en la VM Linux local](../../../../evidence/nodia-ai-ai36-c03-native-contract-adoption-r01.json) el2026-10-25. El despliegue conserva parser, SDK, credenciales y configuración; añade sólo el contrato puro y su registro/límite HTTP. Publicación selectiva y aceptación del analizador con Gemini real permanecen pendientes. Los cinco HTTP no demuestran el recorrido adjunto→generación→MCP ni conceden aprobación documental.

## Evolución y compatibilidad

Revisión1: contrato específico de análisis en generación activa, separado del OCR legacy y de las escrituras C01. No cambia esquemas/bindings publicados ni habilita mutaciones automáticas. Cambios futuros invalidan las revisiones y recibos incompatibles conforme los contratos comunes.

Revisión2: registra adopción real del contrato privado y sus cinco comprobaciones HTTP, incluido el fallo de precedencia systemd y su recuperación explícita. Sin nueva publicación, aprobación, capacidad o cambio funcional del contrato.

## Uso del análisis en la generación activa

El análisis de una factura utiliza `nodia_invoices_analyze` en dos acciones: `prepare` obtiene instrucciones nativas y `complete` valida y normaliza la extracción realizada por la misma generación Agentic. No inicia otra inferencia ni crea facturas, productos, gastos o propuestas de escritura.

Se necesita un negocio autorizado y una imagen o PDF original listo del mensaje actual, de hasta10 MiB, que la conexión, modelo y configuración actuales puedan recibir con soporte verificado. El proveedor comercial es opcional y debe pertenecer al mismo negocio. Si hay varios negocios, proveedores o archivos posibles, se debe preguntar antes de analizar. Audio, texto revisado, archivos de otros mensajes o chats y formatos sin verificar no sustituyen el original.

La preparación y la finalización quedan vinculadas al archivo, su contenido y la generación activa. No se aceptan credenciales, rutas, URLs, SQL ni identidades elegidas por el modelo. Se requieren NodiaAI, Negocios y la autoridad sobre el recurso; los permisos, la selección y la procedencia se revalidan antes de ejecutar o recuperar el resultado.

El resultado es una extracción pendiente de revisión humana: conserva ceros reales y valores desconocidos, admite hasta100 ítems y no acredita pagos ni registros comerciales. No se deben inventar fechas, códigos, cantidades, precios o importes. La lectura de un resultado terminado reautoriza el acceso y devuelve el recibo existente sin volver a inferir. Guardar datos después requiere completar los campos obligatorios y confirmar una propuesta exacta mediante el botón humano.
