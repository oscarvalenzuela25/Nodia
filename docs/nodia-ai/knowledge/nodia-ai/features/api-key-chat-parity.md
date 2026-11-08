---
{
  "schema_version": 1,
  "document_id": "nodia-ai.api-key-chat-parity",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 1,
  "document_status": "approved",
  "implementation": {
    "status": "partial",
    "notes": "API chat code and common permission/confirmation/runtime contracts implemented. Real provider/model/media qualification and VM adoption require their separate receipts; documentary approval does not certify all151 operations."
  },
  "integration_status": "verified",
  "maintainer": "Mantenimiento del módulo NodiaAI conforme a AGENTS",
  "sources": [
    {
      "path": "docs/mvp/92-nodia-ai-api-chat-parity.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-084-nodia-ai-api-chat-common-runtime.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/41-nodia-ai-v1-contracts.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/50-nodia-ai-ai04-runtime-policy.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/89-module-access-and-user-data-scope.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/91-ai-provider-onboarding-verification.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-adapter/use-case/api-nodia-ai-adapter.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-adapter/api-nodia-ai-chat-transport.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-adapter/api-nodia-ai-runtime.service.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-adapter/api-nodia-ai-acceptance.service.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-invoice-ocr/adapters/api-invoice-ocr-executor.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/components/ConfigurationDrawer/ConfigurationDrawer.tsx",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-27",
    "evidence_paths": [
      "docs/evidence/api-chat-knowledge-review-r01.json",
      "docs/evidence/api-chat-knowledge-review-r02.json",
      "docs/evidence/api-chat-sql-runtime-r01.json",
      "docs/evidence/api-chat-knowledge-human-approval-r01.json"
    ],
    "notes": "Approved successor/new explanatory revision;19 real isolated PostgreSQL runtime checks and local source/contract regressions verified. Full common-gateway SQL, live API/media and coordinated adoption are separate technical gates. Approved body unchanged from R02."
  },
  "approval": {
    "reference": "docs/evidence/api-chat-knowledge-human-approval-r01.json",
    "revision": 1,
    "content_sha256": "43aac0e69fa57ca5b60f2aa1a7897895094f8a65094a81e3695539bb2fd33a31"
  }
}
---

# API key en el chat NodiaAI — contexto funcional

[Producto NodiaAI](../README.md) · [Especificación92](../../../../mvp/92-nodia-ai-api-chat-parity.md) · [ADR-084](../../../../architecture/decisions/ADR-084-nodia-ai-api-chat-common-runtime.md).

## Qué resuelve y qué significa

La solicitud del usuario amplía el chat a API key de OpenAI y Gemini con las mismas funciones de negocio, permisos y confirmaciones humanas de Agentic. La implementación reutiliza el runtime y la autoridad comunes; no crea un segundo chat ni ejecuta efectos directamente desde la respuesta del proveedor. Sólo existen los modos `agentic` y `api_key`, con selección explícita de conexión, modelo descubierto y esfuerzo cuando corresponda.

API usa REST y function calling, no MCP. `supports_tools` describe soporte de solicitudes de herramientas para la selección actual; `supports_mcp` permanece false para API y conserva su significado nativo en Agentic. Configuración lista, catálogo accesible, clave guardada, autenticación e inferencia completada son hechos distintos. La observación `api_configuration_and_catalog` no es un health remoto ni una prueba de inferencia exitosa.

La documentación no habilita herramientas por estar escrita; aprobación documental, implementación y aceptación técnica se acreditan por separado. Los éxitos históricos de OCR API o de chat Agentic no aceptan el nuevo chat API ni todas las 151 capacidades del catálogo existente.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Datos faltantes/ambigüedad | Aclaración esperada |
|---|---|---|---|
| «Muéstrame mis gastos de este mes usando esta conexión API» | Lectura mediante catálogo y gateway comunes | Ámbito, período/zona o moneda si no son inequívocos | Resolver sólo lo exigido por el contrato; no inferir ámbito ajeno ni convertir monedas |
| «Registra este gasto» | Preparar una propuesta | Mínimos del dominio o estado de pago ambiguo | Completar mínimos, mostrar revisión exacta y esperar el botón humano |
| «Analiza esta factura y compara los costos» | Planificar OCR y lectura autorizada de Productos | Negocio, archivo o proveedor comercial no resueltos | Elegir datos exactos y selección OCR; comparar no guarda |
| «/imagen Una ilustración de una cabaña» | Carril explícito de generación de imagen | Falta modelo/capacidad calificada para la selección actual | Informar capacidad no verificada; no elegir otro modelo o modo por defecto |
| «Esta es mi clave; úsala en el chat» | Solicitud de credencial en canal incorrecto | No procede pedir ni repetir el secreto | Remitir al formulario seguro de la app; no incluir la clave en contexto o historial |
| «Si falla, usa otra cuenta o repítelo» | Fallback/replay no autorizado | El resultado puede ser incierto | Conservar selección e identidad; observar/conciliar, sin envío automático nuevo |

## Operaciones y contratos

| Operación semántica | Clase/efecto | Herramienta y estado real | Endpoint/DTO/caso de uso | Resultado público |
|---|---|---|---|---|
| Elegir y conversar por API | Inferencia externa con coste potencial | Adaptador API; no nueva herramienta de negocio | Rutas comunes de conversación/mensaje y [adaptador API](../../../../../nodia-server/src/nodia-ai-adapter/use-case/api-nodia-ai-adapter.use-case.ts) | Mensaje/estado del mismo run; unknown no equivale a resultado completado |
| Descubrir/seleccionar capacidades | Metadatos y grant acotado | Catálogo publicado y técnico común; no invocador genérico | Registro/ToolGateway y [contratos41](../../../../mvp/41-nodia-ai-v1-contracts.md) | Sólo contratos seleccionados y autorizados; un índice no concede autoridad |
| Consultar o preparar cambios | Lectura o propuesta sin efecto | Las herramientas existentes compatibles, nunca nombres inventados a partir de endpoints | Casos de uso de dominio y gateway comunes | Proyección cerrada o propuesta revisionada |
| Confirmar/ejecutar | Efecto de dominio | Canal humano y ejecutor común; no función del proveedor | Challenge, botón autenticado, ejecución/recibo idempotentes | Estado y recibo/readback bajo autoridad vigente |
| Gestionar credenciales/login | Preparación y flujo humano seguro | [Flujos seguros existentes](../../general-settings/features/secure-ai-interaction.md) | Casos de uso seguros; secreto fuera del canal del modelo | Metadatos/máscaras y estado seguro, nunca key/código |
| OCR y comparación | Inferencia separada y lectura sin efecto comercial | [OCR conversacional](invoice-ocr-product-comparison.md) mediante API | [ApiInvoiceOcrExecutor](../../../../../nodia-server/src/nodia-ai-invoice-ocr/adapters/api-invoice-ocr-executor.ts), `ApiProviderService` y ledger | Extracción revisable; comparación sin guardar |
| Generar imagen | Servicio externo y adjunto privado | [Carril de /imagen](image-generation.md), sujeto a calificación API exacta | Transporte de imagen explícito, persistencia e inspección existentes | Una imagen privada validada; no asociación comercial implícita |

OpenAI Responses y Gemini generateContent transportan funciones del catálogo cerrado. No se conceden herramientas hospedadas, shell, SQL o HTTP arbitrario. Cada POST generativo, incluidas continuaciones de funciones, consume una reserva durable previa dentro de los **tres envíos por run** actuales; no son tres envíos nuevos por invocación. Se conservan los límites comunes de callbacks, contexto y resultados. No mantener una transacción SQL durante la red ni devolver presupuesto tras un dispatch incierto.

## Datos mínimos y resolución de dudas

| Dato/concepto | Obligatorio, condicional u opcional | Significado y fuente contractual | Resolución/aclaración |
|---|---|---|---|
| Conexión y modo | Obligatorios | Instancia habilitada API y selección exacta persistida | No heredar clave/configuración de otra instancia ni cambiar modo por error |
| Modelo | Obligatorio antes de ejecutar | ID de configuración/descubrimiento dinámicos | Sin asignación, pedir configurar; no fijar nombres/versiones de fallback |
| Esfuerzo | Condicional | Preferencia exacta admitida por el carril/proveedor | No deducir soporte por nombre ni retirarlo silenciosamente tras un rechazo |
| Clave | Obligatoria para la vía API | Cifrada en Server, vinculada a instancia y gestionada por canal seguro | Nunca pedirla al modelo ni devolverla al navegador/historial |
| Datos de negocio | Según contrato seleccionado | Campos mínimos, entidad, fecha, moneda y ámbito del dominio | Aclarar ambigüedades; los opcionales no se convierten en obligatorios |
| Archivo/capacidad | Condicional | Original autorizado y MIME calificado para configuración/modelo/esfuerzo/generaciones exactos | Upload listo, visión o texto correcto no califican otros formatos |

El backend fija actor, sesión, grants, hashes, fences y recibos. Un grant no sustituye los permisos actuales. Conservar cero real frente a desconocido; no inventar pagado, importes, impuestos, stock, moneda o resultados para completar una respuesta.

## Reglas, acceso y restricciones

Aplicar [contratos41](../../../../mvp/41-nodia-ai-v1-contracts.md) y [política89](../../../../mvp/89-module-access-and-user-data-scope.md): sesión válida, módulo NodiaAI y módulos de destino para usuarios ordinarios; acciones/roles no añaden bloqueos ajenos a esa política. Propiedad/colaboración delimita datos. `super_admin` conserva el bypass autorizado sin inventar recursos, saltar invariantes o confirmar por otra persona. Los casos de uso revalidan autoridad en cada frontera.

Las llamadas API pasan por el mismo ToolGateway, allowlist/grant y esquemas de argumentos/resultados. Buscar o seleccionar una capacidad no la ejecuta ni amplía el grant de una generación ya iniciada. La revisión/hash exactos y confirmación humana siguen siendo independientes del modo. La clave no viaja a Python ni al modelo como instrucción; se usa privadamente en Server.

Los originales multimedia sólo se habilitan mediante calificación interna real de selección/configuración/MIME exactos, terminal durable y hashes de solicitud/respuesta/contenido. Esa evidencia no la aporta el modelo, un booleano del cliente o un health. OpenAI audio no está implementado en este carril Responses; El transporte Gemini implementa WAV/Ogg/WebM/MPEG; cada MIME requiere calificación real propia antes de habilitar el original. No habilitar MP4 u otros formatos por pertenecer a la categoría audio. Texto revisado, OCR y original nativo conservan procedencias distintas.

`/imagen` requiere prompt explícito sin adjuntos y un modelo capaz/calificado de la selección actual. Visión de entrada no demuestra generación. `supports_image_generation:false` informa al usuario sin bloquear texto ni seleccionar otra cuenta/modelo. Capacidades y coste no entregados por el proveedor permanecen desconocidos; no se promete gratuidad, cuota o cancelación remota.

## Filtros e informes

| Campo/medida | Predicados o agregaciones admitidos | Fecha/moneda/unidad/grano | Relaciones y procedencia | Fuente |
|---|---|---|---|---|
| Datos de un informe | Sólo filtros/agregaciones del contrato de la capacidad seleccionada | Los del dominio, sin conversión implícita | Ámbito autorizado y proyección cerrada; evitar doble conteo | Catálogo/gateway y ficha del producto correspondiente |
| Estado del turno | Observación técnica, no informe comercial | Fecha real de consulta/estado, no vigencia perpetua | Identidad del run e intento exactos | Runtime común y eventos/GET existentes |
| Coste, cuota o modalidad | Sólo datos entregados y comprobados | Unidad/ventana sólo si conocidas | Evidencia del proveedor/modo/modelo exactos | Sin dato, desconocido; no estimación inventada |

Esta función no agrega medidas, joins, SQL libre o informes nuevos. La API cambia transporte; no amplía el alcance de las lecturas publicadas ni vuelve universal un caso de prueba.

## Vista previa, confirmación y recuperación

El modelo consulta y prepara; la persona revisa mínimos, objetivo, campos/efectos y confirma revisión/hash exactos desde la app. Una mutación fallida conserva modal y borrador. Reintentos de comandos de dominio recuperan identidad/recibo según su garantía nativa, sin repetir efectos comprometidos. Pasos parciales quedan visibles; un cambio material exige una propuesta nueva.

El ledger HTTP conserva dueño local, identidad/hash de solicitud, contador de POST y terminal/ACK. El descriptor privado `schema_version:3`/`engine:api_key` distingue `local_transport_closed:true` de `remote_outcome:completed|unknown`. No usa `process_closed` nativo. Abort, timeout o muerte del worker no prueban cancelación remota ni ausencia de coste. Reconciliar exige la identidad y cierre local demostrados; lease vencida o GET200 no bastan. ACK no reenvía una inferencia ni convierte unknown remoto en success.

No hay autoretry de una inferencia incierta ni fallback API↔Agentic. Observar, recargar o recuperar un terminal no consume un nuevo envío para fabricar un resultado. OCR API usa su core/ledger y comparación actual; guardar conserva confirmación humana, no lo hace el parser de la factura.

## Integración y evidencia

La aprobación documental, la implementación de código, la calificación del proveedor y la adopción por entorno son hitos distintos. El estado vigente y sus comprobaciones se registran sólo en el frontmatter y en los informes fechados; registrar una ficha o validar un path no publica un borrador ni concede una capacidad.

Los recibos aplicables deben distinguir:

- Contratos/unidades locales y builds de Client/Server frente a resultados de un proveedor real.
- SQL aislado de ledger, migración, locks/fences, presupuesto por POST, reinicio, terminal/ACK y rollback compatible.
- Texto y herramientas por selección exacta; permisos, propuesta/confirmación, idempotencia y recibo/readback del caso humano autorizado.
- OCR, MIME nativos y generación de imágenes por calificación propia, con payload y terminal ligados al mismo intento.
- Stop/unknown/no replay, UI autenticada y adopción por entorno conforme al [plan91](../../../../mvp/91-ai-provider-onboarding-verification.md).

El [reporte de revisión](../../../../evidence/api-chat-knowledge-review-r02.json) identifica contenido exacto y catálogo de originales. Los recorridos API requieren evidencia propia por selección, modalidad y entorno; los éxitos Agentic o API OCR previos no la sustituyen. Una aceptación acotada tampoco acredita 151 operaciones API reales.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Herramientas/contexto afectados | Compatibilidad/propuestas pendientes |
|---|---|---|---|
| 1 | Solicitud del 2026-10-27, plan92 y ADR084 propuestos; ampliación del runtime/API y Client | Mismo catálogo/gateway/confirmación; metadata tools e imágenes, proof HTTP3 y ledger aditivos | No ejecuta Web ni altera snapshots/recibos históricos. Los cambios de configuración/contrato invalidan calificaciones incompatibles y se reautorizan propuestas; aprobación documental, publicación y aceptación real acreditadas por separado |
