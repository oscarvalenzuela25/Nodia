---
{
  "schema_version": 1,
  "document_id": "nodia-ai.opencode-provider",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 1,
  "document_status": "draft",
  "implementation": {
    "status": "planned",
    "notes": "Integración de OpenCode en Agentic y API key en planificación. El ensayo de texto Agentic gratuito devolvió 429. Los recorridos de producto se califican por selección, propósito y entorno."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento del módulo NodiaAI conforme a AGENTS",
  "sources": [
    {
      "path": "docs/mvp/115-opencode-provider-implementation-plan.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/114-ai-model-usage-inventory.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/91-ai-provider-onboarding-verification.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/92-nodia-ai-api-chat-parity.md",
      "kind": "specification"
    }
  ],
  "verification": {
    "checked_on": null,
    "evidence_paths": [],
    "notes": "Pendientes adaptadores y calificación en cada consumidor. El resultado 429 figura como antecedente del plan."
  },
  "approval": null
}
---

# OpenCode como proveedor de NodiaAI

## Qué resuelve y qué significa

La propuesta agrega OpenCode a las conexiones de IA que podrán elegir los
usuarios autorizados en NodiaAI, Facturas, Teacher y CV. En Agentic, Nodia
coordina una sesión del runtime oficial. En API key, Server llama al endpoint
de Go o Console correspondiente a la conexión elegida. La selección explícita
determina modelo, esfuerzo si aplica y capacidades comprobadas.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Duda y resolución |
| --- | --- | --- |
| «Quiero usar un modelo de OpenCode para este chat». | Cambiar la selección del chat. | Solicitar el modo y modelo si faltan. Llevar al selector para aplicar el cambio. |
| «Analiza esta factura con OpenCode». | Analizar el original de una factura. | Pedir el proveedor comercial o archivo si falta. Usar una selección calificada para el formato y mostrar el resultado para revisión. |
| «Aquí está mi clave de OpenCode, actívala». | Configurar la credencial. | Orientar al canal seguro de Ajustes IA. La clave queda fuera de la conversación. |

## Operaciones y datos mínimos

| Operación | Fuente y efecto |
| --- | --- |
| Descubrir modelos, elegir selección y observar conexión. | [Contrato de proveedores](../../../../mvp/ai-provider-feature-contract.md). Requiere instancia, modo y acceso correspondiente. La observación muestra datos obtenidos de su fuente y los desconocidos. |
| Generar una respuesta o proponer una acción desde un flujo de producto. | [Catastro y recorridos de QA](../../../../mvp/114-ai-model-usage-inventory.md). Requiere modelo descubierto, propósito y formato elegibles, contexto autorizado y el esfuerzo cuando corresponda. Puede consumir cuota de esa selección. |
| Revisar, confirmar y recuperar. | [Runtime común de NodiaAI](../../../../mvp/92-nodia-ai-api-chat-parity.md). Un humano autorizado confirma la revisión y el escritor nativo devuelve el recibo. Verificar estado previo al dispatch y conservar incertidumbre después de un envío sin resultado final. |

Las herramientas de negocio conservan los contratos, permisos y ámbitos
publicados. OpenCode cambia el transporte al modelo. Ventas y reportes
permanecen en sólo lectura para NodiaAI. La credencial y el perfil pertenecen a
la conexión y sólo se gestionan desde los flujos autorizados de Ajustes IA.
El catálogo puede mostrar metadata de modalidades y razonamiento. La aceptación
por conexión, modo, modelo, propósito y entorno permite ofrecer el uso.

## Filtros e informes

El proveedor no define informes ni medidas nuevos. Las consultas y filtros que
una persona puede pedir conservan su fuente y permisos en el
[catálogo de NodiaAI](../../../../mvp/40-nodia-ai-tool-catalog-v1.md).

## Vista previa, confirmación y recuperación

El cambio de proveedor se aplica explícitamente desde el selector. Los
resultados que requieren revisión conservan su borrador y confirmación nativa.
El transporte acredita el cierre local correspondiente y conserva el
resultado incierto y su identidad si se pierde la respuesta después de enviar.

## Integración y evidencia

El [plan de implementación](../../../../mvp/115-opencode-provider-implementation-plan.md)
describe runtime, configuración, recuperación y verificación para ambos modos.
Quedan pendientes el adaptador, los resultados reales por selección y los
recorridos autenticados. La ficha candidata sólo se incluye en la validación
del corpus. La publicación y la aprobación tienen pasos propios.

## Evolución y compatibilidad

La revisión 1 introduce la propuesta. Las conexiones existentes, su historial
y los permisos conservan sus contratos actuales. Validar el retiro o cambio
de modelo con historial legible y calificaciones ligadas a la selección
exacta antes de activar el proveedor.
