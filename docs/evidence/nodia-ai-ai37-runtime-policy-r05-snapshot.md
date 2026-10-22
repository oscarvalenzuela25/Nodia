---
{
  "schema_version": 1,
  "document_id": "nodia-ai.runtime-policy",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 4,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "AI-09 conserva su corte histórico. C05-R05 implementa como candidato timeout de observación y retry durable predispatch selectivo con tres identidades estables, sin ampliar120/600. QA local positiva; canario real unknown conciliado y Finance sin ejecutar. Python/Node candidatos no adoptados; baseline061/CLI1.3.1/Node932 restablecido. Sin aprobación ni publicación."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/50-nodia-ai-ai04-runtime-policy.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/41-nodia-ai-v1-contracts.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-037-nodia-ai-admission-and-minimal-retention.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/55-nodia-ai-ai09-conversation-persistence.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-068-nodia-ai-pre-dispatch-observation-timeout.md",
      "kind": "specification"
    },
    {
      "path": "docs/evidence/nodia-ai-ai36-c05-r05-observation-timeout-source.diff",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-19",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai04-runtime-policy-validation.json",
      "docs/evidence/nodia-ai-ai09-persistence-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-r05-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-r05-node-observation-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-r05-observation-timeout-validation.json"
    ],
    "notes": "QA local, aceptación representativa por imagen/compilado y estado operativo se distinguen. Cierre C05-R05 parcial4/7 y29 starts MCP aceptados observados; no adopción del fix candidato ni del Node candidato."
  },
  "approval": null
}
---

# Admisión y conservación — contexto funcional de NodiaAI

Las secciones AI-09/AI-12 y los ensayos R01 siguientes conservan su corte histórico. El anexo C05 al final delimita la implementación candidata y el estado operativo actual; no transfiere pruebas entre entornos.

[Producto](../README.md). Metadatos canónicos migrados en [AI-06](../../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); esta revisión no cambia el estado de aprobación ni publica capacidades.

## Qué resuelve y qué significa

Acota el trabajo sin confundir límites propios con cuotas de Gemini. La página puede cerrarse sin que se pierda trabajo admitido; no crea tiempo/presupuesto infinito. Chat caduca90 días desde el último mensaje nuevo del dueño; mensajes/archivos y registros técnicos resueltos se borran sin archivo adicional. Preferencias aceptadas y registros de los módulos son independientes. Un pendiente incierto no es un resultado fallido ni una autorización para repetirlo.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Datos faltantes/ambigüedad | Aclaración esperada |
|---|---|---|---|
| «Busca el chat donde hablamos del proveedor» | Buscar chats vigentes autorizados | Texto/ámbito si no se identifica | Pedir acotar; no buscar datos de negocio mediante Web |
| «Registra lo de esta nota de voz» | Interpretar y preparar | Obligatorios del módulo y modalidad verificada | Transcribir/interpretar revisablemente y preguntar datos faltantes |
| «Crea estos cien gastos» | Escritura masiva | Fuera de v1 | Explicar exclusión, sin convertirla en cien operaciones individuales automáticas |
| «Inténtalo otra vez, no sé si se guardó» | Recuperar estado incierto | Identidad/outcome de operación anterior | Consultar/conciliar primero; no recrear gasto |

## Operaciones y contratos

| Operación semántica | Clase/efecto | Herramienta y estado real | Endpoint/DTO/caso de uso | Resultado público |
|---|---|---|---|---|
| Admisión/búsqueda/caducidad | Coordinación interna | No nueva herramienta MCP | [Contratos41](../../../../mvp/41-nodia-ai-v1-contracts.md), AI-10/35 pendientes | Estado/cursor/error tipados |
| Delegación Web→Agentic | Inferencia y consultas/preparación | Sin publicación; política48/50 | Wire/snapshot/ERD AI-09/12 pendientes | Procedencia y destino exactos visibles |
| Purga/conciliación | Trabajo operativo interno | Nunca comando libre del modelo | [Arquitectura43](../../../../mvp/43-nodia-ai-execution-architecture.md), AI-11/20/32/36 | Pendiente/resuelto sin exponer contenido/secretos |

## Datos mínimos y resolución de dudas

| Dato/concepto | Obligatorio, condicional u opcional | Significado y fuente contractual | Resolución/aclaración |
|---|---|---|---|
| Archivo/voz | Condicional | 20 MiB/300s, suma/formatos en[configuración](../../../../mvp/nodia-ai-v1-runtime-policy.json) | Rechazar exceso/no soportado sin inventar extracción |
| Destino Agentic | Condicional a switch | Misma conexión, modelo/esfuerzo y viabilidad verificados | Sin destino válido, cambio manual; no API/fallback |
| Campo de dominio | Según DTO vigente | Obligatorios/condicionales del producto correspondiente | Preguntar lo mínimo antes de proponer |

## Reglas, acceso y restricciones

Ordinarios requieren NodiaAI+módulo destino+autoridad del recurso; super_admin no evita límites de recursos ni botón. Web sólo conversa; Agentic consulta/prepara mediante catálogo permitido. La configuración/ficha no habilita modalidades, permisos ni herramientas. Cuotas reales desconocidas se muestran desconocidas; ningún modelo comercial está fijado en esta política.

## Filtros e informes

Búsqueda v1 por título/texto de mensajes, por defecto25/máximo100, excluye vencidos y respeta dueño/ámbito autorizado. Adjuntos/transcripciones no se indexan automáticamente. Informes de negocio conservan filtros/granos/moneda/procedencia de41, máximo100 grupos/20 filtros iniciales; pedir acotar si excede. No sumar fuentes incompatibles ni presentar una página como total.

## Vista previa, confirmación y recuperación

Switch sólo permite delegar una vez; no confirma cambios. Preview exacta y botón siguen41. Presupuestos compartidos por run sobreviven a cambios de fase/proceso. Al expirar, grants revocados y payload purgado; receipts resueltos se eliminan, sin borrar negocio. Sólo descriptores mínimos de cleanup/unknown siguen hasta resolver, sin reejecutar comandos vencidos. Backups/retención remota son gates pendientes, no borrado físico certificado.

## Integración y evidencia

- [x] Configuración y schema cerrados, relaciones y fixtures negativas comprobadas offline en AI-04.
- [x] Decisiones de producto, propuestas técnicas y pendientes separados en50.
- [ ] PostgreSQL/races/fences/presupuestos y puerta compartida OCR/login/chat implementados.
- [ ] Wire de consentimiento/etapas/procedencia y UI publicados.
- [ ] Modalidades/compactación, storage/PUT tardío y backup/restore verificados realmente.
- [ ] Familias de herramientas, autoridad/confirmación y publicación aceptadas.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Herramientas/contexto afectados | Compatibilidad/propuestas pendientes |
|---|---|---|---|
| 1 | Política AI-04, límites propios y cero archivo adicional | Contexto NodiaAI, runtime/routing aún pendientes | Sin nuevas herramientas/tablas/BD; nuevas versiones completas se validan y registran por run |


[Persistencia AI-09](conversation-persistence.md): once tablas M1, contratos cerrados y creación interna. Mensajes/admisión/retención automática/worker/routing operativo siguen AI-10..12.

## Anexo C05-R05: retry previo al envío, candidato no adoptado

El [ADR-068 propuesto](../../../../architecture/decisions/ADR-068-nodia-ai-pre-dispatch-observation-timeout.md) delimita un cambio candidato: el vencimiento externo de la observación no generativa conserva `agentic_timeout`, invalida su snapshot y cierra/libera procesos. Indisponibilidad genérica y cancelación conservan sus categorías; ese timeout no demuestra pérdida de autenticación o cuota.

Sólo un job Agentic directo con contrato Gemini, señal vigente y coincidencia de `resourceKey`, `sessionGeneration` y `configurationGeneration` frente al run puede clasificar ese reason exacto como recuperable antes de `armDispatch`. Reutiliza los dos retries durables existentes de1s/3s, con el mismo run/job y deadline600. La nueva reclamación obtiene intento/fence propios y revalida autoridad/configuración; no se resetean presupuestos ni se envía al proveedor antes del armado. El límite de inferencia120 y la política50 permanecen iguales.

No aplica a admisión/preflight anterior al job, delegación sin resource pin del destino, Web/API, identidad ausente/cambiada, cancelación, errores genéricos ni resultados posteriores al armado. Un `unknown` exige conciliación y nunca replay; el arreglo no trata los stalls postdispatch de preferencias. No autoriza confirmar cambios por texto ni por una llamada MCP.

La [QA Python](../../../../evidence/nodia-ai-ai36-c05-r05-observation-timeout-validation.json), la [QA Node](../../../../evidence/nodia-ai-ai36-c05-r05-node-observation-validation.json) y el [delta compilado](../../../../evidence/nodia-ai-ai36-c05-r05-node-compiled-delta.json) separan código candidato del runtime operativo. El [cierre R05](../../../../evidence/nodia-ai-ai36-c05-r05-validation.json) registra un canario no completado, conciliación/ACK y restauración061; Finanzas no se ejecutó. Python/Node candidatos no se adoptaron. Se conserva4/7 de aceptación acumulada y29 starts MCP aceptados observados, sin medir solicitudes/retries internos del CLI, tokens o facturación.

La precisión de reason mantiene la regla de observación no disponible de Ajustes Generales. Su ficha aprobada/publicada `general-settings.ai-models-and-health` revisión8 queda intacta: no cambia su autorización ni se deduce autenticación del error. La [evaluación de impacto](../../../../evidence/nodia-ai-ai36-c05-r05-knowledge-impact.json) registra la compatibilidad y el release preservado. Esta revisión4 sigue draft/unregistered/approvalnull.

Fuente Python del candidato: [agentic_service.py](../../../../../nodia-gemini-microservice/agentic_service.py); su diff/hash y QA se referencian desde docs para respetar el contrato cerrado de metadatos.
