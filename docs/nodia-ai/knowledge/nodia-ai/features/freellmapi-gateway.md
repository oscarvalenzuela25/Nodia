---
{
  "schema_version": 1,
  "document_id": "nodia-ai.freellmapi-gateway",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 1,
  "document_status": "draft",
  "implementation": {
    "status": "planned",
    "notes": "Candidato posterior a OpenCode para un gateway privado en modo API key. El piloto sintético y la calificación por selección están pendientes."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento del módulo NodiaAI conforme a AGENTS",
  "sources": [
    {
      "path": "docs/mvp/116-freellmapi-integration-plan.md",
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
    "notes": "Pendientes la validación del contrato del gateway, el piloto sintético y las pruebas por selección y entorno."
  },
  "approval": null
}
---

# Gateway privado FreeLLMAPI en NodiaAI

## Qué resuelve y qué significa

La propuesta permite evaluar FreeLLMAPI como intermediario privado del
modo API key. Una conexión configurada fija el proveedor de salida, su destino,
el modelo y la credencial. Nodia conserva la selección, la ejecución autorizada
de herramientas y la confirmación humana de los efectos. La implementación
se planifica después de OpenCode. Los modelos gratuitos de chat de OpenCode
permanecen en su runtime oficial. [Plan de FreeLLMAPI](../../../../mvp/116-freellmapi-integration-plan.md) ·
[Plan de OpenCode](../../../../mvp/115-opencode-provider-implementation-plan.md).

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Aclaración esperada |
| --- | --- | --- |
| «Quiero usar el modelo del gateway para esta conversación». | Seleccionar una conexión y un modelo. | Si hay varias selecciones, pedir la conexión y el modelo y orientar al selector. La opción depende de la calificación del carril. |
| «¿Este modelo puede leer mi factura en PDF?». | Consultar una capacidad concreta. | Distinguir acceso al catálogo, lectura de un PDF y OCR de Facturas. Remitir al selector del flujo si falta una selección calificada para ese formato. |
| «Te pego la clave para que configures el gateway». | Administrar una credencial. | Remitir al flujo seguro de Ajustes IA y mantener el secreto fuera de la conversación. |

## Operaciones y contratos

| Operación | Efecto y fuente |
| --- | --- |
| Configurar y observar una conexión desde Ajustes IA. | Alcance propuesto conforme al [contrato de proveedores](../../../../mvp/ai-provider-feature-contract.md). La observación de catálogo, autenticación e inferencia son comprobaciones separadas. |
| Enviar una solicitud de inferencia. | Alcance propuesto conforme al [runtime común API](../../../../mvp/92-nodia-ai-api-chat-parity.md). Se consume presupuesto antes del envío. Las herramientas disponibles conservan su autoridad y esquema. |
| Consultar el resultado y recuperar la operación. | El historial y la revisión pertenecen a Nodia. Recuperar un resultado persistido reutiliza su recibo. El gateway permanece como transporte privado de las operaciones existentes. |

## Datos mínimos y resolución de dudas

La selección requiere una conexión API key habilitada, el proveedor y destino
de salida autorizados, el modelo explícito y la referencia privada de la
credencial. Las opciones de esfuerzo y el formato dependen del contrato
comprobado para ese propósito. La credencial de Nodia para acceder al gateway
y la credencial del proveedor de salida se gestionan por separado. Ajustes
sólo proyecta el estado y la máscara permitidos. El catálogo y el ensayo real documentan
hechos distintos. [Matriz de aceptación](../../../../mvp/91-ai-provider-onboarding-verification.md).

## Reglas, acceso y restricciones

Server conserva la autoridad de la conexión y permite un único destino fijado
para cada ejecución. Las solicitudes tienen cero reintentos y cero fallbacks
de proveedor, credencial, modelo o modo. Una respuesta vacía, inconclusa
o de otra selección sigue las reglas de error y cierre del runtime común.
Las lecturas de negocio validan módulo, actor y recurso. Las escrituras
admitidas conservan revisión y confirmación humana. Las ventas y reportes
de NodiaAI conservan sus permisos de lectura. [Catálogo vigente](../../../../mvp/40-nodia-ai-tool-catalog-v1.md) ·
[Política de ejecución](../../../../mvp/50-nodia-ai-ai04-runtime-policy.md).

## Filtros e informes

Los filtros e informes conservan los permisos, medidas y fuentes de cada
módulo. Cualquier cifra de cuota o coste mostrada debe provenir de la
selección y su fuente autorizada. Cuando falte un dato, se declara
desconocido. [Catastro de recorridos](../../../../mvp/114-ai-model-usage-inventory.md).

## Vista previa, confirmación y recuperación

Las operaciones revisables conservan el borrador y el botón de confirmación
del flujo existente. Una pérdida de respuesta después del envío preserva
el resultado remoto desconocido. La conciliación valida la identidad y el
cierre local antes de registrar el ACK. El ACK reutiliza la evidencia
persistida. [Contrato de recuperación](../../../../mvp/92-nodia-ai-api-chat-parity.md#prueba-terminal-y-recuperación).

## Integración y evidencia

- [ ] Validar el contrato y el aislamiento del gateway.
- [ ] Comprobar que un rechazo de credencial, cuota o red mantiene la ruta fijada.
- [ ] Ejecutar el piloto con datos sintéticos y un envío real de inferencia válido.
- [ ] Calificar las operaciones aplicables del catastro por selección, propósito y entorno.

La propuesta queda en borrador. La disponibilidad en un entorno requiere
evidencia de la selección correspondiente y la publicación tiene su propio
proceso. [Plan de implementación](../../../../mvp/116-freellmapi-integration-plan.md).

## Evolución y compatibilidad

La revisión 1 describe el candidato de API key. La conexión del gateway
conserva la selección explícita y los contratos de las operaciones de NodiaAI.
Un cambio de proveedor, destino, modelo, credencial o versión de contrato
obliga a revalidar las capacidades afectadas.
