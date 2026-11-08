---
{
  "schema_version": 1,
  "document_id": "personal-finance.confirmed-movement-effect",
  "product_id": "personal-finance",
  "kind": "feature",
  "revision": 5,
  "document_status": "approved",
  "implementation": {
    "status": "partial",
    "notes": "AI36-C05 publica sólo la sección adicional enumerada bajo autorización humana específica; los apartados previos conservan su fecha y alcance. Contratos internos y publicación no prueban despliegue, inferencia o aceptación productiva."
  },
  "integration_status": "published",
  "maintainer": "Mantenimiento de Finanzas personales y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/22-personal-finance-contracts.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/65-nodia-ai-ai19-financial-effect.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/finance-movement/use-case/create-finance-movement.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-finance-effect/use-case/execute-nodia-ai-finance-movement-effect.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-execution/use-case/execute-nodia-ai-financial-execution.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/mvp/66-nodia-ai-ai20-execution-recovery.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/67-nodia-ai-ai21-financial-operations.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-finance-catalog/use-case/build-nodia-ai-finance-catalog-operations.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-finance-ledger/use-case/build-nodia-ai-finance-ledger-operations.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-write-tools/use-case/build-nodia-ai-write-tools.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-proposal/use-case/prepare-nodia-ai-finance-movement.use-case.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-24",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai19-validation.json",
      "docs/evidence/nodia-ai-ai20-validation.json",
      "docs/evidence/nodia-ai-ai36-c01-validation.json",
      "docs/evidence/nodia-ai-ai36-c04-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-write-publication-r02-validation.json"
    ],
    "notes": "Publicación offline con builders nativos y schemas cerrados. El fragmento adicional es el único alcance nuevo; no equivale a cuenta real ni a una aceptación de todos sus efectos."
  },
  "approval": {
    "reference": "docs/evidence/nodia-ai-ai36-c05-write-publication-r02-authorization.md",
    "revision": 5,
    "content_sha256": "a8bbfa23c08f12c41967cfc1f34a9dd173d4d912a663725dc53b603866b7554b"
  }
}
---

# Efectos financieros confirmados con recibo atómico

Estado actual AI36-C05: sólo se publica la sección «Preparación de movimientos publicada en AI36-C05». Los apartados anteriores documentan etapas históricas; sus referencias a draft o publicación pendiente no revocan este fragmento ni habilitan otras capacidades.

[Producto](../README.md), [movimientos y lecturas publicadas](movements.md) y [especificación AI-21](../../../../mvp/67-nodia-ai-ai21-financial-operations.md). Se conserva la identidad documental y ubicación de la ficha creada en AI-19, ampliando su cobertura. Permanece draft/unregistered; no modifica las cuatro fichas de lectura aprobadas de AI-15.

## Qué resuelve y qué significa

Una escritura financiera individual y su recibo se confirman en la misma transacción PostgreSQL. Consultar una ejecución completada devuelve su identidad original, incluso después de eliminar el recurso, y nunca repite el efecto. Los casos de uso nativos conservan todas las reglas financieras; no existe otro ledger de NodiaAI.

## Solicitudes en lenguaje natural

| Ejemplo ilustrativo | Resolución |
|---|---|
| «Registra un gasto de comida» | Preguntar nombre, importe, estado y categoría que falten o sean ambiguos; no inferir que fue pagado. |
| «Crea ese gasto» | Preparar una revisión y requerir su botón humano; decirlo en el chat no concede aprobación. |
| «¿Quedó creado?» | Recuperar el estado y recibo autorizados; no reenviar la escritura. |
| «Cambia el importe y confírmalo tú» | Una corrección exige otra revisión/hash y confirmación humana. |
| «Crea un grupo para estas categorías» | Resolver categorías del mismo dueño y selección completa; aclarar mínimos, mostrar pertenencias y confirmar. |
| «Actualiza el importe de esta deuda» | Preparar la obligación y mostrar el cambio atómico de su movimiento inicial y saldo calculado. |
| «Elimina esta categoría» | Identificarla, bloquear si tiene movimientos y mostrar las pertenencias que se retirarán antes del botón humano. |

Son intenciones objetivo de herramientas de preparación. AI-21 implementa los puertos internos; su publicación MCP sigue pendiente y no se acredita que Gemini ya pueda prepararlas.

## Operaciones y contratos

| Operación | Implementación y estado | Resultado |
|---|---|---|
| Crear/actualizar/eliminar movimientos | Preparadores `nodia_finance_movements_prepare_*` → escritores `finance-movement/use-case/`; un paso sin dependencias/bindings | Efecto nativo, witness y referencia histórica con bigint string |
| Crear/actualizar/eliminar categorías y grupos | Preparadores `nodia_finance_categories_prepare_*` y `nodia_finance_category_groups_prepare_*` → escritores de ambos recursos | Actividad y asociaciones coherentes, sin borrar movimientos o categorías al eliminar un grupo |
| Crear/actualizar/eliminar obligaciones | Preparadores `nodia_finance_obligations_prepare_*` → escritores `finance-obligation/use-case/` | Movimiento inicial compuesto y principal coherentes; pagos existentes protegen eliminación |
| Observar una ejecución | `GET /nodia-ai/operations/:id`, con autoridad actual | Recibo histórico cerrado, sin reconstruir datos actuales ni crear registros |

`*` representa las tres operaciones explícitas create/update/delete. El coordinador admite una operación por propuesta, aunque el escritor nativo afecte varias filas. No hay nuevo endpoint de ejecución, SQL libre, nuevo proveedor ni herramienta MCP publicada. La creación de movimiento v2 conserva catálogo, binding y recibo originales de `nodia-ai-ai19-finance-effect/1`; los once puertos nuevos usan `nodia-ai-ai21-finance/1` y no reinterpretan aprobaciones anteriores.

## Datos mínimos y dudas

Movimiento nuevo requiere nombre, importe positivo decimal, tipo, estado y categoría. Obligación nueva exige nombre, clave, tipo loan/debt, importe y categoría inicial. Categoría exige nombre y clave; grupo exige además `category_ids`, que puede ser vacío. Descripción de obligación es opcional y nullable. Actualizar requiere ID y al menos un campo; eliminar, ID inequívoco. Sólo se usan defaults nativos, sin inferir pagado ni pedir opcionales innecesarios; importes/IDs no pasan por Number.

Las asociaciones pertenecen al destinatario y las nuevas deben estar activas. Omitir selección de grupo conserva sus miembros, `[]` los desactiva y una selección reemplaza atómicamente; pertenencias históricas inactivas no seleccionadas se conservan. Una relación antigua inactiva no impide editar un nombre cuando no se está reemplazando. Actor, destinatario confirmado, claves del efecto y grants los verifica Server.

## Reglas, acceso y restricciones

Se requieren NodiaAI, el módulo de Finanzas y las reglas actuales del backend. Super_admin puede preparar en su propio chat para otro destinatario, conservando actor y propietario reales; no confirma chats ajenos. Grant, sesión, epoch, hash, catálogo, job y plazo deben coincidir con lo admitido. Una propuesta contiene un paso financiero local; no habilita secuencias ni replay de efectos externos.

Cambiar datos materiales del objetivo, categoría, asociaciones, obligación, movimiento inicial o saldo exige nueva revisión. El snapshot incluye valores concretos; no depende sólo de la precisión temporal de TypeORM. La carga de pertenencias se limita a la política de colecciones, actualmente128; el exceso se rechaza sin ocultar parte de la eliminación.

Un pago confirmado no puede exceder el saldo y archivar no lo excluye de liquidación. Importe del movimiento inicial se edita desde la obligación; eliminarlo directamente está protegido. No se borra obligación con ningún pago existente, incluidos pendientes/cancelados/inactivos. Categoría con cualquier movimiento vinculado está protegida. Eliminar categoría libre retira pertenencias; eliminar grupo conserva categorías y movimientos.

## Confirmación, fallos y recuperación

La confirmación sigue [AI-18](../../../../mvp/64-nodia-ai-ai18-human-confirmation.md). El manager compartido incluye todos los efectos nativos, recibo mínimo, cierre del paso/ejecución/job, revocación del grant, liberación del chat y evento. Crear obligación/movimiento inicial, propagar principal o retirar pertenencias sigue siendo una operación nativa atómica. La preview muestra sus efectos compuestos mediante valores estructurados; no son campos arbitrarios editables.

Un fallo conocido revierte el conjunto. Un COMMIT incierto se observa mediante la misma identidad y nunca provoca reenvío automático. Recuperar no llama al escritor; rollback local probado permite reanudación humana con el comando original, sesión y permisos actuales. Cancelar conserva lo ya comprometido sin compensarlo. Cambios materiales exigen propuesta y botón nuevos.

Los nuevos recibos conservan versión, recurso, operación, ID y destinatario. El original de creación v2 mantiene sus cuatro campos, sin añadirle operación retroactivamente. Hash, clave nativa y tiempos tienen columnas propias. Los triggers congelan binding/resultado completed. Un recibo de eliminación es histórico y se lee sin exigir la existencia actual del objetivo; no lo restaura. Expirar el chat borra el recibo resuelto, sin borrar ni restaurar registros financieros. No se añaden tablas/columnas.

## Informes y evolución

Las once lecturas y resúmenes existentes conservan filtros, fechas, unidades y procedencia. Los saldos se derivan del ledger, no se escriben directamente ni se añade fecha económica. Lotes, pasos dependientes e informes combinables conservan sus etapas. La evidencia final de AI-21 está pendiente de consolidar en67; aprobación/publicación MCP y prueba de preparación con Gemini son gates separados. Markdown no habilita permisos ni herramientas.


## Extensión AI-20: ejecución local y recuperación

[Entrega66](../../../../mvp/66-nodia-ai-ai20-execution-recovery.md) estableció worker y recuperación para un movimiento. [AI-21/67](../../../../mvp/67-nodia-ai-ai21-financial-operations.md) reutiliza ese protocolo para las doce operaciones nativas individuales, sin cambiar la retención ni publicar preparación MCP. Secuencias de pasos y aceptación productiva mantienen sus gates.

## Preparación de movimientos publicada en AI36-C05

`nodia_finance_movements_prepare_create` prepara un ingreso o gasto individual. No crea el movimiento: devuelve un borrador con mínimos faltantes o una propuesta pública revisable. Se requieren nombre, importe entero positivo, tipo, estado compatible y categoría activa; una obligación sólo se vincula conforme a las reglas financieras nativas. No adivines pagado frente a pendiente: pregunta cuando la intención no lo determine. El destinatario debe quedar resuelto y autorizado; un usuario ordinario no puede nominar otro dueño.

Un parcial vacío permite conocer los campos obligatorios. Para continuar un borrador usa su draft_id y expected_draft_revision exactos; un conflicto requiere volver a consultar/revisar, nunca repetir una escritura. Sólo el botón humano sobre la propuesta exacta admite ejecución y recibo financiero atómicos. Editar, borrar o registrar pagos de obligaciones siguen fuera de este lote. Se requiere NodiaAI y el módulo Finanzas personal vigente; super_admin conserva la autoridad transversal y el mismo botón de confirmación.

Este contrato sólo se ofrece cuando esté publicado, seleccionado en el intento y autorizado. La publicación no acredita disponibilidad ni inferencia real del proveedor.

## Finanzas: preparaciones adicionales publicadas en AI36-C05

Este fragmento añade sólo estas preparaciones publicadas:

- `nodia_finance_categories_prepare_create`
- `nodia_finance_categories_prepare_delete`
- `nodia_finance_categories_prepare_update`
- `nodia_finance_category_groups_prepare_create`
- `nodia_finance_category_groups_prepare_delete`
- `nodia_finance_category_groups_prepare_update`
- `nodia_finance_movements_prepare_delete`
- `nodia_finance_movements_prepare_update`
- `nodia_finance_obligations_prepare_create`
- `nodia_finance_obligations_prepare_delete`
- `nodia_finance_obligations_prepare_update`

Cada herramienta recibe un partial cerrado, devuelve mínimos faltantes o propuesta revisable y permite continuar sólo con draft_id/revisión CAS exactos. No aplica el cambio de dominio. Consulta las referencias reales; nunca inventes IDs o enlaces. Sólo el botón humano sobre revisión/hash exactos admite la ejecución y su recibo nativo. No se aceptan SQL, comandos arbitrarios, secretos ni bulk/importación. Categorías, grupos, movimientos y obligaciones conservan dueño autorizado, referencias, estados y restricciones financieras. No inventar importes, categoría ni estado pagado; preguntar por mínimos ausentes.

El backend exige NodiaAI y cada módulo/acción de destino vigentes, reautoriza al ejecutar y conserva recuperación/idempotencia. Publicación, selección del intento, disponibilidad, despliegue y aceptación real son estados distintos. Los apartados anteriores son históricos y no amplían este lote.
