---
{
  "schema_version": 1,
  "document_id": "personal-finance",
  "product_id": "personal-finance",
  "kind": "product",
  "revision": 8,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "Once capacidades de lectura publicadas desde cuatro fichas funcionales. AI-19/20 incorporan movimiento confirmado y worker con recibo atómico/recuperación. AI-21 amplía a doce escrituras financieras individuales con los escritores nativos y la misma recuperación; evidencia final pendiente de consolidar. Preparadores MCP e informes combinables no publicados. Este resumen permanece draft/unregistered y fuera del bundle."
  },
  "integration_status": "unregistered",
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
    },
    {
      "path": "docs/mvp/65-nodia-ai-ai19-financial-effect.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/66-nodia-ai-ai20-execution-recovery.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/67-nodia-ai-ai21-financial-operations.md",
      "kind": "specification"
    }
  ],
  "verification": {
    "checked_on": "2026-10-17",
    "evidence_paths": [
      "docs/mvp/51-nodia-ai-ai05-product-knowledge.md",
      "docs/evidence/nodia-ai-ai05-knowledge-validation.json",
      "docs/evidence/nodia-ai-ai08-authority-validation.json",
      "docs/evidence/nodia-ai-ai15-live-local.json",
      "docs/evidence/nodia-ai-ai15-live-artifacts.json",
      "docs/evidence/nodia-ai-ai15-live-routing-interrupted.json",
      "docs/evidence/nodia-ai-ai15-live-external-final.json",
      "docs/evidence/nodia-ai-ai19-validation.json",
      "docs/evidence/nodia-ai-ai20-validation.json"
    ],
    "notes": "Índice actualizado según el registro de 67 capacidades y 27 bindings funcionales. Esta ficha de producto conserva document_status:draft, integration_status:unregistered y approval:null; su actualización no aprueba el resumen ni lo publica. La evidencia real separa SQL/CSV positivos, factura R2 no configurado y resultados externos/Web parciales con unknown sin replay. No se certifica cada llamada del modelo ni despliegue productivo completo."
  },
  "approval": null
}
---

# Finanzas personales — contexto de producto para NodiaAI

Metadatos canónicos migrados en [AI-06](../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); este resumen conserva aprobación pendiente y no se publica; las secciones funcionales de lectura publicadas se identifican debajo.

## Propósito y alcance

Registrar ingresos/gastos personales, organizar categorías y grupos, gestionar préstamos/deudas y consultar agregados exactos. No es contabilidad de proveedores ni caja de alojamientos.

El alcance confirmado comprende consultas y CRUD individual donde exista endpoint, con aclaraciones/vista previa y confirmación. Las fichas describen el backend actual y señalan ampliaciones pendientes; ninguna crea herramientas o permisos.

## Conceptos y relaciones

| Concepto | Significado y relación |
|---|---|
| Movimiento | Un ingreso o gasto, una categoría y obligación opcional; importe entero positivo como string. |
| Categoría / grupo | Categoría única del movimiento; grupos muchos a muchos para filtrar, pueden solaparse. |
| Préstamo / deuda | Obligación con movimiento inicial y pagos ligados, sin tabla de pagos adicional ni intereses. |
| Confirmado / activo | received o paid afecta dinero; is_active controla visibilidad, no invalida por sí solo un pago. |

## Módulos y autoridad

Destino /tools/finances-personal, key personal_finance según22. AI-08 separa actor/sesión y destinatario owner_id explícito: super_admin activo puede operar datos de otro usuario, sin transferir propiedad ni saltar reglas financieras. Ausencia de destinatario mantiene ámbito propio. Otros roles sólo datos propios. NodiaAI exige además sus módulos conforme AI-07. AI-15 publica las lecturas mediante puertos con manager compartido; las escrituras no se habilitan.

Rutas de destino trazadas al inventario/catálogo: `/tools/finances-personal`. Resolver sus IDs reales desde Server; la inspección no consulta asignaciones de la BD del usuario. Credenciales/cookies no se incorporan al contexto. Web sólo conversa y Agentic usa MCP conforme [política48](../../../mvp/48-nodia-ai-mode-routing-policy.md); disponibilidad exige evidencia del adaptador exacto.

## Índice de funcionalidades

| Función | Ficha | Implementación | Integración NodiaAI | Destino |
|---|---|---|---|---|
| Ingresos y gastos | [movements](features/movements.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/finances-personal` |
| Categorías y grupos | [categories-and-groups](features/categories-and-groups.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/finances-personal` |
| Préstamos y deudas | [obligations](features/obligations.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/finances-personal` |
| Resúmenes financieros personales | [summaries](features/summaries.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/tools/finances-personal` |
| Efectos financieros confirmados | [confirmed-movement-effect](features/confirmed-movement-effect.md) | Doce puertos internos AI-21 y recuperación AI-20; evidencia final pendiente | Ficha draft/unregistered; preparación MCP sin publicar | `/tools/finances-personal` |

## Interpretación de solicitudes que combinan funciones

«Voy a comprar comida» requiere preguntar importe/categoría y, si hay duda, pending o paid; no asumir por tiempo verbal. «Gastos de proveedor» no puede vincular movimientos por una FK inexistente. Comparar con Reservas sólo con medidas/base temporal compatibles y procedencia separada, sin sumar poblaciones solapadas.

Informes cruzados requieren medidas compatibles y procedencia separada según41; no deducir relaciones sólo porque dos productos usan la palabra gasto/proveedor. Pasos dependientes conservan resultados y se recuperan sin duplicarlos; el modelo no confirma ni ejecuta SQL libre.

## Restricciones y pendientes

Sin currency, fecha económica propia, proveedor, recurrencias/intereses ni propósito oculto. Mes usa created_at sólo después de explicitarlo. POST no tiene journal general de idempotencia; integrar witness/receipts antes de publicar escrituras. DELETE real existe con restricciones; no confundir con desactivar. Transversalidad AI-08 implementada; las lecturas AI-15 están publicadas y los puertos de escritura siguen pendientes.

Publicación de conocimiento, proyecciones y autoridad depende de AI-06/07/08/12 y de la familia de herramientas. Markdown explica, no habilita. No se cargan estos borradores automáticamente al proveedor. Política50 elimina contenido del chat y registros técnicos resueltos sin borrar dominio/preferencias aceptadas.

## Evolución y trazabilidad

| Revisión | Cambio funcional y fuentes | Impacto |
|---|---|---|
| 1 | AI-05: 4 fichas funcionales desde especificaciones/backend e inventario39 | [Cobertura/diferencias/gates](../../../mvp/51-nodia-ai-ai05-product-knowledge.md); sin migraciones/runtime/publicación ni aprobación automática |


Actualización AI-08: [autoridad compartida](../../../mvp/54-nodia-ai-ai08-transversal-authority.md). Destinatarios, actor real y reglas nativas se validan en transacción. En Ajustes Generales se protegen último super_admin, rol reservado, key de módulos y asociaciones atómicas; esto no incorpora herramientas MCP administrativas.


## Puertos de lectura AI-15

Familia tipada de Finanzas con once lecturas individuales: obtener/listar categorías, grupos, movimientos y obligaciones, más resumen general y desgloses por categoría/grupo. Reutiliza los casos de uso nativos; no crea SQL generado por el modelo, permisos o tablas. El scope toma la identidad de sesión y admite owner_id ajeno exclusivamente para super_admin vigente.

Todo puerto exige transacción activa REPEATABLE READ heredada del checkpoint. Importes y IDs conservan strings exactos; fechas se serializan como HTTP. Los schemas son cerrados, listados acotados a100, actividad activa por defecto y all omite el predicado. Los pagos históricos de obligaciones y el solapamiento de grupos conservan las reglas nativas. El resultado guardado vuelve a comprobar autoridad de dueño, scope e identidad del detalle.

Las once capacidades forman parte del registro publicado y conservan pruebas aisladas de sus casos de uso/SQL. Gemini real consultó categorías de Finanzas en el turno multifamilia; eso no afirma que cada una de las once herramientas haya sido llamada por el modelo. Confirmación de escrituras y reportes combinables conservan sus etapas; el resumen de producto no tiene binding.


## Publicación de lecturas AI-15 — estado actual

Once capacidades de lectura publicadas desde cuatro fichas funcionales: categorías/grupos, movimientos, obligaciones y resúmenes nativos. El resumen de producto continúa draft/unregistered y fuera del bundle. Escrituras e informes combinables no se habilitan.

El corpus completo tiene44 fichas:27 funcionalidades approved/published ligadas a67 contratos read/read_artifact y17 fichas draft/unregistered excluidas —cinco resúmenes de producto y doce funciones propias de NodiaAI—. No hay escrituras publicadas. La [autorización específica](../../../evidence/nodia-ai-ai15-publication-authorization.md) alcanza esas secciones funcionales, no este resumen. Los estados del índice describen el alcance publicado de lectura de cada función y no todo su CRUD.

[AI-15](../../../mvp/61-nodia-ai-ai15-product-reads.md) distingue diez comprobaciones SQL con Gemini real y doce de referencias/CSV, observaciones externas con recibos positivos y final incierto, y routing Web parcial. R2 sin configurar no se transforma en descarga verificada; unknown no se reenvía. Los contratos se publican con permisos y límites actuales, sin prometer que todo turno del modelo termine correctamente. Sin cambios visuales ni nuevos bindings de resumen.

[AI-19/65](../../../mvp/65-nodia-ai-ai19-financial-effect.md) implementa un efecto financiero interno con recibo atómico, sin nueva publicación. [Ficha del efecto confirmado](features/confirmed-movement-effect.md).


[AI-20/66](../../../mvp/66-nodia-ai-ai20-execution-recovery.md) conecta el worker al movimiento confirmado, con receipt atómico, recuperación SQL sin replay y cancelación/reanudación humanas. El flujo de preparación MCP sigue pendiente de publicación; esta ficha continúa draft/unregistered.

## Ampliación AI-21 — escrituras financieras individuales

[Entrega67](../../../mvp/67-nodia-ai-ai21-financial-operations.md) incorpora crear/actualizar/eliminar movimientos, categorías, grupos y obligaciones mediante doce puertos internos. Cada propuesta contiene una operación nativa; crear obligación con movimiento inicial o retirar pertenencias comparte transacción con su recibo. Los snapshots, reglas de estado/saldo y asociaciones del mismo propietario se comprueban nuevamente antes del efecto. El acceso transversal de super_admin conserva actor y destinatario reales y no permite confirmar chats ajenos.

La preview muestra efectos compuestos y pertenencias retiradas, también archivadas; más de128 asociaciones supera la política actual y se rechaza sin truncar. Un recibo de eliminación acredita el efecto histórico, sin exigir presencia actual del recurso ni recrearlo. Se conserva identidad/contrato de creación v2 y se reutiliza recuperación/cancelación/reanudación de AI-20. Sin tablas ni columnas nuevas.

Esta ampliación sustituye las menciones anteriores de puertos de escritura pendientes únicamente en el alcance interno descrito. Las once lecturas publicadas continúan; las cuatro fichas aprobadas de lectura no se modifican. La [ficha de efectos](features/confirmed-movement-effect.md), este resumen y las fichas propias de NodiaAI siguen draft/unregistered. Publicación MCP prepare, preparación con Gemini, evidencia final AI-21 e informes combinables mantienen sus gates independientes.
