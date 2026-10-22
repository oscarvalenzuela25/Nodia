---
{
  "schema_version": 1,
  "document_id": "personal-finance.obligations",
  "product_id": "personal-finance",
  "kind": "feature",
  "revision": 5,
  "document_status": "approved",
  "implementation": {
    "status": "partial",
    "notes": "Publicación AI-15 de las lecturas/referencias expresamente enumeradas mediante contratos cerrados y reglas nativas. Las escrituras y otras etapas del producto no se habilitan. La disponibilidad de cada dependencia se observa por separado; no se promete éxito de toda inferencia ni acceso a contenido R2 no configurado."
  },
  "integration_status": "published",
  "maintainer": "Mantenimiento de Finanzas personales y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/22-personal-finance-contracts.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/21-personal-finance-erd.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/finance-obligation/entities/finance-obligation.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/mvp/54-nodia-ai-ai08-transversal-authority.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/finance/finance-read.family.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/finance/use-case/execute-nodia-ai-finance-read.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/contracts/finance.schema.json",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-16",
    "evidence_paths": [
      "docs/mvp/51-nodia-ai-ai05-product-knowledge.md",
      "docs/evidence/nodia-ai-ai05-knowledge-validation.json",
      "docs/evidence/nodia-ai-ai08-authority-validation.json",
      "docs/evidence/nodia-ai-ai15-postgres-integration.json",
      "docs/evidence/nodia-ai-ai15-external-validation.json",
      "docs/evidence/nodia-ai-ai15-artifacts-integration.json",
      "docs/evidence/nodia-ai-ai15-live-local.json",
      "docs/evidence/nodia-ai-ai15-live-artifacts.json",
      "docs/evidence/nodia-ai-ai15-live-routing-interrupted.json",
      "docs/evidence/nodia-ai-ai15-live-external-final.json",
      "docs/evidence/nodia-ai-ai15-live-quota-gateway-final.json",
      "docs/evidence/nodia-ai-ai15-live-codex-root-postfix.json"
    ],
    "notes": "Gemini Agentic real completó un turno de cinco familias SQL (10 comprobaciones) y otro de tres referencias (12): dos CSV autenticados correctos; factura devuelve 503 por R2 sin configurar. La emisión de referencia no certifica bytes disponibles. Routing real completó Web conversacional y delegación opt-in SQL; el siguiente turno Web quedó unknown/502 y se concilió sin replay. El ensayo externo final completó recibos health/engines y luego quedó unknown; no se registra como aceptación generativa completa. La regresión Gateway de las cinco salidas usa observaciones sintéticas y cero inferencias. Los fallos permanecen en sus informes, sin atribuirlos a causa no observada. Las demás lecturas conservan su evidencia aislada SQL/HTTP; publicar no garantiza que el modelo siempre construya llamadas válidas."
  },
  "approval": {
    "reference": "docs/evidence/nodia-ai-ai15-publication-authorization.md",
    "revision": 5,
    "content_sha256": "8df7778cf40b10a95d8d67001decf4f1b36e2eda87801a661e0ebd760d4663f3"
  }
}
---

# Préstamos y deudas — contexto funcional para NodiaAI

Estado actual: esta revisión publica sólo el fragmento «Lecturas disponibles en AI-15». Las secciones de implementación/evidencia anteriores a ese fragmento conservan la trazabilidad de entregas iniciales; sus frases históricas sobre publicación pendiente no sustituyen el frontmatter actual ni habilitan escrituras.

[Producto](../README.md). Metadatos canónicos migrados en [AI-06](../../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); esta revisión tiene autorización específica de publicación para las lecturas enumeradas al final; las demás operaciones conservan sus gates.

## Qué resuelve y qué significa

Representar dinero prestado (loan) o recibido en deuda (debt) con movimiento inicial y liquidaciones parciales, sin intereses automáticos.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y aclaración esperada |
|---|---|
| «Presté dinero a…» | Aclarar loan/debt desde perspectiva del usuario y categoría del origen. |
| «Abona a la deuda» | Resolver obligación, importe/estado y dirección; no pagar más del pendiente. |
| «Borra la deuda con sus pagos» | No hay borrado implícito de pagos; explicar bloqueo. |

Ejemplos ilustrativos sin resultados ni identificadores reales. Preguntar sólo obligatorios y ambigüedades; los opcionales no bloquean salvo condición del dominio.

## Operaciones y contratos

| Handler y ruta de referencia | Candidato del catálogo40 | Tratamiento vigente |
|---|---|---|
| [FinanceObligationController.list](../../../../../nodia-server/src/finance-obligation/finance-obligation.controller.ts)<br>`GET /api/v1/finance/obligations` | `nodia_finance_obligations_list` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [FinanceObligationController.findOne](../../../../../nodia-server/src/finance-obligation/finance-obligation.controller.ts)<br>`GET /api/v1/finance/obligations/:id` | `nodia_finance_obligations_get` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [FinanceObligationController.create](../../../../../nodia-server/src/finance-obligation/finance-obligation.controller.ts)<br>`POST /api/v1/finance/obligations` | `nodia_finance_obligations_prepare_create` (prepare_change, candidato40) | Candidato; sin publicar |
| [FinanceObligationController.update](../../../../../nodia-server/src/finance-obligation/finance-obligation.controller.ts)<br>`PUT /api/v1/finance/obligations/:id` | `nodia_finance_obligations_prepare_update` (prepare_change, candidato40) | Candidato; sin publicar |
| [FinanceObligationController.remove](../../../../../nodia-server/src/finance-obligation/finance-obligation.controller.ts)<br>`DELETE /api/v1/finance/obligations/:id` | `nodia_finance_obligations_prepare_delete` (prepare_change, candidato40) | Candidato; sin publicar |

Los aliases de [inventario39](../../../../mvp/nodia-ai-current-endpoints.json) no crean capacidades distintas. Los nombres de operaciones proceden del catálogo documentado en [catálogo40](../../../../mvp/40-nodia-ai-tool-catalog-v1.md): sólo las lecturas enumeradas en esta revisión tienen binding explícito de publicación; las escrituras continúan candidatas.

DTOs de entrada/filtros: [finance-query.dto.ts](../../../../../nodia-server/src/finance-common/dto/finance-query.dto.ts), [finance-id.dto.ts](../../../../../nodia-server/src/finance-common/dto/finance-id.dto.ts), [create-finance-obligation.dto.ts](../../../../../nodia-server/src/finance-obligation/dto/create-finance-obligation.dto.ts), [update-finance-obligation.dto.ts](../../../../../nodia-server/src/finance-obligation/dto/update-finance-obligation.dto.ts)

Delegación actual (casos de uso/servicios según controlador): [get-finance-obligations.use-case.ts](../../../../../nodia-server/src/finance-obligation/use-case/get-finance-obligations.use-case.ts), [get-finance-obligation-by-id.use-case.ts](../../../../../nodia-server/src/finance-obligation/use-case/get-finance-obligation-by-id.use-case.ts), [create-finance-obligation.use-case.ts](../../../../../nodia-server/src/finance-obligation/use-case/create-finance-obligation.use-case.ts), [update-finance-obligation.use-case.ts](../../../../../nodia-server/src/finance-obligation/use-case/update-finance-obligation.use-case.ts), [delete-finance-obligation.use-case.ts](../../../../../nodia-server/src/finance-obligation/use-case/delete-finance-obligation.use-case.ts)

## Datos mínimos y resolución de dudas

| Dato/operación | Obligatorio, condicional u opcional; resolución |
|---|---|
| Crear | name, key, type loan/debt, amount string y category_id para movimiento inicial; descripción/activo opcionales. |
| Liquidar | Movimiento vinculado con dirección correcta: ingreso para loan, gasto para debt; preguntar importe/categoría/estado. |

Actor, permisos efectivos, claves de intención, versiones de concurrencia y referencias internas los controla Server; no los inventa ni decide el modelo. DTOs enlazados son fuente de campos, no un JSON Schema estricto de herramienta ya publicado.

## Reglas, acceso y restricciones

Crear loan origina expense paid; debt origina income received en misma transacción. type inmutable; editar amount actualiza origen y no baja de pagos confirmados. Pending no reserva saldo; no sobrepago. Saldo usa todos los pagos confirmados, incluidos archivados/fuera del período.

Destino /tools/finances-personal, key personal_finance según22. AI-08 separa actor/sesión y destinatario owner_id explícito: super_admin activo puede operar datos de otro usuario, sin transferir propiedad ni saltar reglas financieras. Ausencia de destinatario mantiene ámbito propio. Otros roles sólo datos propios. NodiaAI exige además sus módulos conforme AI-07. AI-15 aporta puertos de lectura con manager compartido; esta revisión publica exclusivamente las lecturas enumeradas.

## Filtros e informes

paid_amount/remaining_amount calculados strings; origen cancelado implica remaining_amount null, no0 ficticio. Filtrar obligaciones por sus propios atributos; período del overview no corta la amortización.

El nuevo registro combinable de [contratos41](../../../../mvp/41-nodia-ai-v1-contracts.md) sigue pendiente AI-30/31; filtros REST existentes no autorizan joins, campos o SQL libres. [Política50](../../../../mvp/50-nodia-ai-ai04-runtime-policy.md) acota trabajo del chat y no reemplaza silenciosamente límites del módulo.

## Vista previa, confirmación y recuperación

Mostrar creación conjunta de obligación+movimiento inicial. DELETE sólo sin ningún pago, incluso pendiente/anulado/archivado, y elimina origen atómicamente. Conservar locks nativos; witness de intención y recuperación NodiaAI todavía pendientes.

Desde NodiaAI, preparar es distinto de ejecutar: cambios requieren vista previa exacta y botón humano de41; el switch Web→Agentic no confirma. Conservar efectos completados si falla un paso dependiente y no reenviar un resultado desconocido. Payload del chat caduca según50 sin borrar registros de dominio ni sus journals nativos.

## Integración y evidencia

- [x] Fuentes de producto/backend, diferencias y mínimos revisados estáticamente en AI-05.
- [x] Correspondencia de handlers/candidatos y enlaces comprobada offline; no prueba de autorización/efectos.
- [ ] Schema de herramienta/proyección, autoridad y contexto registrados con AI-06/07 y familia pertinente.
- [ ] Casos de uso reales de acceso/ambigüedad, confirmación, concurrencia y recuperación verificados para NodiaAI.
- [ ] Adaptador/modalidades, publicación y aceptación operativa comprobados.

Pendientes con efecto sobre disponibilidad: AI-21: integración del puerto y dedup del efecto compuesto; actor/destinatario resuelto en AI-08.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Contexto y propuestas |
|---|---|---|
| 1 | AI-05: explicación inicial a partir de contratos/código enlazados | Sin cambio de backend ni publicación. Al cambiar reglas/DTOs, actualizar ficha/schema/registro, invalidar propuestas incompatibles y mantener recuperación original |


Actualización AI-08: [autoridad compartida](../../../../mvp/54-nodia-ai-ai08-transversal-authority.md). Destinatarios, actor real y reglas nativas se validan en transacción. En Ajustes Generales se protegen último super_admin, rol reservado, key de módulos y asociaciones atómicas; esto no incorpora herramientas MCP administrativas.


## Historial de puertos de lectura AI-15

Familia tipada de Finanzas con once lecturas individuales: obtener/listar categorías, grupos, movimientos y obligaciones, más resumen general y desgloses por categoría/grupo. Reutiliza los casos de uso nativos; no crea SQL generado por el modelo, permisos o tablas. El scope toma la identidad de sesión y admite owner_id ajeno exclusivamente para super_admin vigente.

Todo puerto exige transacción activa REPEATABLE READ heredada del checkpoint. Importes y IDs conservan strings exactos; fechas se serializan como HTTP. Los schemas son cerrados, listados acotados a100, actividad activa por defecto y all omite el predicado. Los pagos históricos de obligaciones y el solapamiento de grupos conservan las reglas nativas. El resultado guardado vuelve a comprobar autoridad de dueño, scope e identidad del detalle.

Once pruebas focales verificadas localmente; fixtures sintéticas no constituyen aprobación de contenido ni publicación. Las once capacidades continúan sin habilitar en el registro real hasta cumplir las barreras de publicación. Confirmación de escrituras, resolución genérica de entidades, reportes combinables y operación Gemini real conservan sus etapas.


## Lecturas disponibles en AI-15

Consultar obligaciones y su saldo conforme a las amortizaciones nativas. No registrar un pago ni inferir saldos a partir de una página parcial.

Herramientas de esta sección: `nodia_finance_obligations_get`, `nodia_finance_obligations_list`.

Resolver entidades, destinatario, intervalo y filtros ambiguos antes de llamar. Usar sólo los campos del schema de la herramienta. Conservar IDs y dinero exactos, cero y falso; ausencia o unknown no equivalen a cero. La paginación y los límites de resultados deben comunicarse y una página no representa el universo completo. En recursos con actividad, iniciar Activo y usar Inactivo/Todos sólo cuando se soliciten; Todos omite el filtro.

Server valida sesión, módulo NodiaAI y todos los módulos destino actuales para usuarios ordinarios; super_admin conserva transversalidad y las reglas de dominio. Datos privados y autoridad se revalidan al devolver o recuperar resultados. Finanzas permite owner_id ajeno sólo a super_admin; Reservas conserva autoridad actual del alojamiento; administración IA conserva ai:manage. No construir SQL libre ni pedir tokens, cookies o secretos.

Esta publicación incluye lecturas y referencias privadas, no preparaciones ni ejecución de escrituras. Cualquier creación, edición, eliminación o confirmación conserva sus herramientas y etapas posteriores. No anunciar informes cruzados, un total por proveedor u otros filtros/agrupaciones si el schema o caso de uso no los soporta. Web permanece conversacional; MCP sólo se ejecuta mediante Agentic verificado, con delegación Web→Agentic opt-in de la misma conexión.

Las observaciones externas se ejecutan fuera de SQL, con deadline/cancelación y verificación posterior de autoridad y configuración. La recuperación de una llamada completada no repite red; una llamada interrumpida no se reintenta ciegamente. Los artefactos son referencias privadas current_on_download: la descarga humana reautoriza chat/recurso, rechaza exceso sin truncar y no conserva el archivo al expirar el chat; el original de factura pertenece al negocio.
