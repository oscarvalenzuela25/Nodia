---
{
  "schema_version": 1,
  "document_id": "nodia-ai.runtime-policy",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 3,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "AI-09: persistencia M1, contratos tipados y composición interna; admisión/runtime/API pendientes."
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
    }
  ],
  "verification": {
    "checked_on": "2026-10-15",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai04-runtime-policy-validation.json",
      "docs/evidence/nodia-ai-ai09-persistence-validation.json"
    ],
    "notes": "AI-09 verifica contratos/persistencia local aislada, sin publicación o aprobación automática."
  },
  "approval": null
}
---

# Admisión y conservación — contexto funcional de NodiaAI

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
