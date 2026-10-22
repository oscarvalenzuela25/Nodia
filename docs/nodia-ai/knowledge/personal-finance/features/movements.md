---
{
  "schema_version": 1,
  "document_id": "personal-finance.movements",
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
      "path": "nodia-server/src/finance-movement/entities/finance-movement.entity.ts",
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
    "content_sha256": "cdf3967b491587b0d48edd785c0a74b44ee139c88f4bc181bd52c3ff24201ad1"
  }
}
---

# Ingresos y gastos — contexto funcional para NodiaAI

Estado actual: esta revisión publica sólo el fragmento «Lecturas disponibles en AI-15». Las secciones de implementación/evidencia anteriores a ese fragmento conservan la trazabilidad de entregas iniciales; sus frases históricas sobre publicación pendiente no sustituyen el frontmatter actual ni habilitan escrituras.

[Producto](../README.md). Metadatos canónicos migrados en [AI-06](../../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); esta revisión tiene autorización específica de publicación para las lecturas enumeradas al final; las demás operaciones conservan sus gates.

## Qué resuelve y qué significa

Registrar un ingreso o gasto personal por categoría; pago de obligación es un movimiento ligado, no otra tabla de pagos.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y aclaración esperada |
|---|---|
| «Registra20000 de comida» | Resolver categoría y preguntar estado si ambiguo; importe string exacto. |
| «Borra un pago de deuda» | Identificar movimiento y advertir aumento de saldo pendiente. |
| «Registra gasto de proveedor» | Aclarar producto: Finanzas no tiene vínculo a proveedor. |

Ejemplos ilustrativos sin resultados ni identificadores reales. Preguntar sólo obligatorios y ambigüedades; los opcionales no bloquean salvo condición del dominio.

## Operaciones y contratos

| Handler y ruta de referencia | Candidato del catálogo40 | Tratamiento vigente |
|---|---|---|
| [FinanceMovementController.list](../../../../../nodia-server/src/finance-movement/finance-movement.controller.ts)<br>`GET /api/v1/finance/movements` | `nodia_finance_movements_list` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [FinanceMovementController.findOne](../../../../../nodia-server/src/finance-movement/finance-movement.controller.ts)<br>`GET /api/v1/finance/movements/:id` | `nodia_finance_movements_get` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [FinanceMovementController.create](../../../../../nodia-server/src/finance-movement/finance-movement.controller.ts)<br>`POST /api/v1/finance/movements` | `nodia_finance_movements_prepare_create` (prepare_change, candidato40) | Candidato; sin publicar |
| [FinanceMovementController.update](../../../../../nodia-server/src/finance-movement/finance-movement.controller.ts)<br>`PUT /api/v1/finance/movements/:id` | `nodia_finance_movements_prepare_update` (prepare_change, candidato40) | Candidato; sin publicar |
| [FinanceMovementController.remove](../../../../../nodia-server/src/finance-movement/finance-movement.controller.ts)<br>`DELETE /api/v1/finance/movements/:id` | `nodia_finance_movements_prepare_delete` (prepare_change, candidato40) | Candidato; sin publicar |

Los aliases de [inventario39](../../../../mvp/nodia-ai-current-endpoints.json) no crean capacidades distintas. Los nombres de operaciones proceden del catálogo documentado en [catálogo40](../../../../mvp/40-nodia-ai-tool-catalog-v1.md): sólo las lecturas enumeradas en esta revisión tienen binding explícito de publicación; las escrituras continúan candidatas.

DTOs de entrada/filtros: [finance-query.dto.ts](../../../../../nodia-server/src/finance-common/dto/finance-query.dto.ts), [finance-id.dto.ts](../../../../../nodia-server/src/finance-common/dto/finance-id.dto.ts), [create-finance-movement.dto.ts](../../../../../nodia-server/src/finance-movement/dto/create-finance-movement.dto.ts), [update-finance-movement.dto.ts](../../../../../nodia-server/src/finance-movement/dto/update-finance-movement.dto.ts)

Delegación actual (casos de uso/servicios según controlador): [get-finance-movements.use-case.ts](../../../../../nodia-server/src/finance-movement/use-case/get-finance-movements.use-case.ts), [get-finance-movement-by-id.use-case.ts](../../../../../nodia-server/src/finance-movement/use-case/get-finance-movement-by-id.use-case.ts), [create-finance-movement.use-case.ts](../../../../../nodia-server/src/finance-movement/use-case/create-finance-movement.use-case.ts), [update-finance-movement.use-case.ts](../../../../../nodia-server/src/finance-movement/use-case/update-finance-movement.use-case.ts), [delete-finance-movement.use-case.ts](../../../../../nodia-server/src/finance-movement/use-case/delete-finance-movement.use-case.ts)

## Datos mínimos y resolución de dudas

| Dato/operación | Obligatorio, condicional u opcional; resolución |
|---|---|
| Crear | name, amount entero positivo string, type income/expense, status y category_id del destinatario. obligation_id opcional; is_active opcional. |
| Duda frecuente | Preguntar pending/paid para gasto y pending/received para ingreso si no está claro; obligación sólo si se trata de liquidación. |

Actor, permisos efectivos, claves de intención, versiones de concurrencia y referencias internas los controla Server; no los inventa ni decide el modelo. DTOs enlazados son fuente de campos, no un JSON Schema estricto de herramienta ya publicado.

## Reglas, acceso y restricciones

expense: pending/paid/cancelled; income: pending/received/cancelled. Categoría una y activa para nuevas asociaciones. Confirmados no vuelven a pending y cancelled no se reabre; dirección de pagos y obligación inmutables. Movimiento inicial se modifica en importe por obligación; DELETE inicial bloqueado.

Destino /tools/finances-personal, key personal_finance según22. AI-08 separa actor/sesión y destinatario owner_id explícito: super_admin activo puede operar datos de otro usuario, sin transferir propiedad ni saltar reglas financieras. Ausencia de destinatario mantiene ámbito propio. Otros roles sólo datos propios. NodiaAI exige además sus módulos conforme AI-07. AI-15 aporta puertos de lectura con manager compartido; esta revisión publica exclusivamente las lecturas enumeradas.

## Filtros e informes

Filtrar name/type/status/created_at [inicio,fin), categorías/grupos/obligación y actividad. No hay proveedor ni occurred_on/currency. Sólo paid/received en totales; is_active es visibilidad. No llamar saldo bancario al neto del conjunto.

El nuevo registro combinable de [contratos41](../../../../mvp/41-nodia-ai-v1-contracts.md) sigue pendiente AI-30/31; filtros REST existentes no autorizan joins, campos o SQL libres. [Política50](../../../../mvp/50-nodia-ai-ai04-runtime-policy.md) acota trabajo del chat y no reemplaza silenciosamente límites del módulo.

## Vista previa, confirmación y recuperación

Preview nombre, importe/dirección/estado/categoría/destinatario y efecto en obligación. DELETE pago altera saldo, no genera inverso. POST sin dedup persistente general: AI-17/21 requiere witness; unknown se concilia antes de repetir.

Desde NodiaAI, preparar es distinto de ejecutar: cambios requieren vista previa exacta y botón humano de41; el switch Web→Agentic no confirma. Conservar efectos completados si falla un paso dependiente y no reenviar un resultado desconocido. Payload del chat caduca según50 sin borrar registros de dominio ni sus journals nativos.

## Integración y evidencia

- [x] Fuentes de producto/backend, diferencias y mínimos revisados estáticamente en AI-05.
- [x] Correspondencia de handlers/candidatos y enlaces comprobada offline; no prueba de autorización/efectos.
- [ ] Schema de herramienta/proyección, autoridad y contexto registrados con AI-06/07 y familia pertinente.
- [ ] Casos de uso reales de acceso/ambigüedad, confirmación, concurrencia y recuperación verificados para NodiaAI.
- [ ] Adaptador/modalidades, publicación y aceptación operativa comprobados.

Pendientes con efecto sobre disponibilidad: AI-08/17/21: transversalidad super_admin e idempotencia; no publicar por tener CRUD.

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

Consultar movimientos financieros con su importe entero exacto, categoría, estado y filtros publicados. No deducir pendiente o pagado de una frase ambigua.

Herramientas de esta sección: `nodia_finance_movements_get`, `nodia_finance_movements_list`.

Resolver entidades, destinatario, intervalo y filtros ambiguos antes de llamar. Usar sólo los campos del schema de la herramienta. Conservar IDs y dinero exactos, cero y falso; ausencia o unknown no equivalen a cero. La paginación y los límites de resultados deben comunicarse y una página no representa el universo completo. En recursos con actividad, iniciar Activo y usar Inactivo/Todos sólo cuando se soliciten; Todos omite el filtro.

Server valida sesión, módulo NodiaAI y todos los módulos destino actuales para usuarios ordinarios; super_admin conserva transversalidad y las reglas de dominio. Datos privados y autoridad se revalidan al devolver o recuperar resultados. Finanzas permite owner_id ajeno sólo a super_admin; Reservas conserva autoridad actual del alojamiento; administración IA conserva ai:manage. No construir SQL libre ni pedir tokens, cookies o secretos.

Esta publicación incluye lecturas y referencias privadas, no preparaciones ni ejecución de escrituras. Cualquier creación, edición, eliminación o confirmación conserva sus herramientas y etapas posteriores. No anunciar informes cruzados, un total por proveedor u otros filtros/agrupaciones si el schema o caso de uso no los soporta. Web permanece conversacional; MCP sólo se ejecuta mediante Agentic verificado, con delegación Web→Agentic opt-in de la misma conexión.

Las observaciones externas se ejecutan fuera de SQL, con deadline/cancelación y verificación posterior de autoridad y configuración. La recuperación de una llamada completada no repite red; una llamada interrumpida no se reintenta ciegamente. Los artefactos son referencias privadas current_on_download: la descarga humana reautoriza chat/recurso, rechaza exceso sin truncar y no conserva el archivo al expirar el chat; el original de factura pertenece al negocio.
