# AI-17 — Borradores y revisiones de propuestas

Estado documental: en revisión. Implementación solicitada expresamente el2026-10-16; no implica aprobación de fichas ni publicación de herramientas. [Plan45](45-nodia-ai-implementation-plan.md), [catálogo40](40-nodia-ai-tool-catalog-v1.md), [contratos41](41-nodia-ai-v1-contracts.md), [ERD42](42-nodia-ai-erd.md), [arquitectura43](43-nodia-ai-execution-architecture.md), [política50](50-nodia-ai-ai04-runtime-policy.md) y [ADR-044](../architecture/decisions/ADR-044-nodia-ai-frozen-proposal-revisions.md) delimitan esta entrega. Evidencia: [validación AI-17](../evidence/nodia-ai-ai17-validation.json).

## Preparación y límites

`nodia-ai-proposal/` implementa un puerto interno tipado para preparadores registrados. Recibe el manager de la transacción de su llamador; no abre una transacción anidada ni admite un endpoint genérico para SQL/comandos. Revalida identidad, chat, módulos, acciones y ámbito nativo. Solicitar aclaraciones o generar una propuesta no llama a un escritor del negocio.

El primer preparador real es `nodia_finance_movements_prepare_create`, registrado **sólo internamente**. Reutiliza `CreateFinanceMovementDto`, reglas de FinanceLedger y su autoridad, categoría activa del destinatario, relación con obligación y capacidad de abono. Solicita nombre, importe, tipo, estado y categoría cuando faltan. No adivina pagado/pendiente. Sólo aplica los defaults nativos `obligation_id:null` e `is_active:true`; la procedencia distingue entrada humana y default del contrato. IDs bigint e importes siguen strings, incluido el máximo admitido por Finanzas.

`needs_clarification` guarda comando parcial y preguntas; su continuación usa el mismo `draft_id` y revisión esperada. La respuesta puede contener sólo el dato que faltaba: el preparador del dominio combina campos registrados con el estado previo y conserva destinatario y procedencia. El borrador listo almacena el comando normalizado completo, no únicamente la última respuesta. Una revisión obsoleta produce409. El registro de preparadores determina campos editables, campos vinculables y tipos de outputs. El wrapper de comando/orígenes es privado, versionado y estricto; el cliente no controla actor, destinatario, permisos ni paths de JSON.

AI-17 no publica ese preparador en MCP: el catálogo exige el circuito humano de confirmación y recuperación durable antes de habilitar preparación operativa. El release publicado conserva67 lecturas/referencias y27 fragmentos. Gemini real sigue usando ese conjunto de lectura. La confirmación corresponde a AI-18 y el primer efecto nativo a AI-19. No se añaden desafíos, ejecuciones, lotes, workflows operativos ni un tool que confirme.

## Persistencia M2 incremental

Migración `1792400000000-CreateNodiaAiProposalPersistence`: cuatro tablas del ERD existente, `nodia_ai_drafts`, `nodia_ai_proposals`, `nodia_ai_proposal_revisions` y `nodia_ai_proposal_steps`. No hay tabla de edges, catálogo duplicado, envelope JSONB adicional ni copia separada de la vista previa. Las tablas de desafíos/ejecución del resto de M2 permanecen pendientes.

La identidad lógica apunta mediante FK diferida a su revisión vigente. Cada revisión conserva catálogo, hash, canonicalización, plazo y estado; cada paso conserva comando normalizado, scope, precondiciones, proyección pública, dependencias/bindings y contrato del preparador. Los IDs de pasos son nuevos al revisar y las referencias internas se remapean dentro de la nueva revisión.

Antes de sellar `ready` se insertan pasos bajo estado transitorio `draft` en la misma transacción. Triggers impiden cambiar contenido sellado, volver a draft, insertar pasos tardíos y borrar piezas individualmente. Permiten la cascada al borrar el chat. Los borradores y propuestas no sobreviven a la retención ni crean un archivo de auditoría adicional. Las restricciones relacionales, estados y límites JSON son independientes de la UI.

## Integridad y tiempo

El compilador reconstruye `PublicProposal` desde los pasos y verifica su hash; no consulta nuevos datos de negocio para cambiar lo que se revisó. El envelope incluye chat/actor, revisión, catálogo/canonicalización, fechas, contratos y todos los comandos, scopes, precondiciones y proyecciones. El estado de lifecycle queda fuera del hash: cancelar o superseder no altera el contenido original.

Canonicalización `jcs-rfc8785/1`, conforme a [RFC8785](https://www.rfc-editor.org/rfc/rfc8785.html): orden UTF-16 de claves, números ECMAScript finitos, Unicode sin normalización y arrays en orden. Se rechazan Unicode inválido, valores no JSON, ciclos, accessors, objetos especiales y límites de política excedidos. La entrada JSON textual al canonicalizador rechaza claves duplicadas; los comandos ya normalizados son objetos JSON estrictos. El validador de dominio, no JCS, exige strings para dinero/IDs.

Se valida orden posicional, dependencias únicas anteriores y bindings tipados a outputs registrados. Refs futuras, propias, ajenas, ciclos y bindings incompatibles se rechazan. Objetos/arrays se muestran como `ReviewValue`; presencia, null, vacío, cero y false son distintos. Claves repetidas de cambios/proyecciones se rechazan.

El plazo inicial es el menor entre900 segundos desde la preparación y la expiración del chat, según política. Editar conserva ese vencimiento; GET, cancelación y eventos no renuevan ni la propuesta ni los90 días del chat. Una nueva preparación explícita deberá producir una identidad/versionamiento válido, sin resucitar propuestas vencidas.

## HTTP y observación

Tres rutas de [coordinación](nodia-ai-v1-coordination-api.json), todas con `Cache-Control:no-store`:

| Ruta bajo `/api/v1/nodia-ai` | Entrada/salida | Garantía |
|---|---|---|
| `GET proposals/:id?revision=N` | `ProposalVersionQuery` → `PublicProposal` | Revisión histórica exacta o vigente, con autoridad actual |
| `PATCH proposals/:id` | `ProposalUpdateRequest` → `PublicProposal` | Revisión/hash esperados; campos registrados; nueva revisión atómica |
| `POST proposals/:id/cancel` | `ProposalCancelRequest` → `PublicProposal` | Canal humano; cancela la propuesta y no un registro de negocio |

PATCH serializa mediante la misma barrera de conversación; dos dispositivos que editan la misma revisión no sobrescriben cambios. Error o mínimos incompletos revierten la nueva revisión. Inspeccionar como super_admin conserva identidad real y auditoría de lectura ajena; no permite editar el chat de otra persona como su dueño.

La preparación interna con un recibo origen válido puede emitir `proposal_ready`, con sólo ID/revisión/hash y scope de módulos, dentro de la transacción original. Sin origen real no se inventa un run. El feed de AI-16 añade comprobación de referencias históricas, hash y permisos actuales con lecturas por lotes; un evento no concede autorización ni reemplaza GET. Revocación cambia la huella de visibilidad y exige reiniciar el cursor. El cambio de versión de esa huella puede reiniciar un cursor anterior sin repetir herramientas.

## Cliente

Un evento `proposal_ready` permite abrir una vista previa de sólo lectura bajo intención. El cliente pide la revisión exacta y comprueba ID/revisión/hash; no presenta la vigente como si fuera la anterior. Caché separada por actor/sesión/chat/ref, sin contenido en localStorage. Denegación limpia la proyección; error recuperable mantiene contexto y ofrece reintento con feedback traducido.

La proyección muestra campos antes/después, presencia y procedencia, scope, orden y dependencias. No convierte importes/IDs a number ni transforma strings en URLs arbitrarias. Respeta el borrador y foco del compositor. No incluye aún botones de confirmar/editar/cancelar: el contrato backend de revisión queda preparado para AI-18.

## Verificación y continuidad

La evidencia distingue tests de casos de uso, PostgreSQL/HTTP desechable, build/tipado/lint, harness UI sintético y activación del laboratorio. Una propuesta sintética no acredita que Gemini la haya generado ni ejecutado. La conexión real no recibe herramientas de escritura por esta entrega. R2, aceptación completa externa/routing, multimodalidad y producción pública conservan sus pendientes anteriores.

Entrega verificada:1.739 pruebas Server/167 archivos; suite Client1.274/199 antes de seis casos adicionales, cubiertos por el subset final75/7; builds/tipado/lint correctos. PostgreSQL/HTTP final52 comprobaciones, más48 de regresión de observación. La barrera JSON sigue el routing de Express incluso con mayúsculas. UI comprobada en ES/dark desktop y EN/light390px, con entrada habilitada al esperar aclaraciones. [Activación con backup](../evidence/nodia-ai-ai17-lab-activation.json) y [código final](../evidence/nodia-ai-ai17-code-deployment.json):22 migraciones,15 tablas NodiaAI,0 trabajos/intentos/slots pendientes; API/worker activos y Gemini sin reiniciar. La suite completa incluye la continuación incremental; la integración HTTP compilada verifica también el casing del router. No se ejecutó inferencia nueva ni escritura de negocio en la BD configurada.
