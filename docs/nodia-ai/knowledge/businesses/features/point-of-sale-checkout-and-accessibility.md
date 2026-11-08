---
{
  "schema_version": 1,
  "document_id": "businesses.point-of-sale-checkout-and-accessibility",
  "product_id": "businesses",
  "kind": "feature",
  "revision": 2,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "R17 implementado y adoptado en VM: NodiaAI sólo consulta ventas/reportes; cinco preparadores y sus puertos activos retirados, históricos autorizados sin writer. Dos lecturas y dos fuentes de informes verificadas con DI y SQL desechable; POS manual conserva sus funciones. Server/KB selectivos, respaldo cifrado previo y posterior, 70 tablas/35 migraciones y Client R16 preservados. Nueva ficha draft/unregistered/approval:null; POS5 aprobado conserva sus bytes y sólo proyecta Filtros e informes."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Negocios y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/94-business-point-of-sale-and-product-refactor.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-087-atomic-point-of-sale-checkout.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/89-module-access-and-user-data-scope.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/sale/dto/sale-command.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/sale/use-case/mutate-sale.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/sale/sale.controller.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/migrations/1793420000000-AddDirectSaleCheckout.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/BusinessDetail.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/styles.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/SalesWorkspace/SalesWorkspace.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/infrastructure/useSaleDraft.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/infrastructure/usePosCatalog.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/infrastructure/salesServices.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/SalesWorkspace/PosProductCatalog/PosProductCatalog.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/SalesWorkspace/PaymentMethodButtons/PaymentMethodButtons.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/business/pages/BusinessDetail/components/SalesWorkspace/PaymentMethodButtons/styles.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-30",
    "evidence_paths": [
      "docs/evidence/business-pos-accessibility-20261029-r01.json",
      "docs/evidence/nodia-ai-sales-readonly-20261030-r01.json"
    ],
    "notes": "R17: Server5685 pruebas correctas/1 omitida previa; catálogo47, conocimiento58 y contratos3. Linux6 garantías y SQL desechable13+3 correctos, una venta manual sólo en fixture. VM completada: manifestc38b16bd…c231/KB ea03686c…e5b, dos lecturas/cero writers, 70 tablas y ledger35 idénticos, respaldos verificados. Sin inferencia de proveedor ni aprobación/publicación de esta ficha candidata."
  },
  "approval": null
}
---

# Checkout y accesibilidad del POS — contexto funcional candidato

## Alcance actual de NodiaAI sobre ventas — R17

R17 (2026-10-30): NodiaAI queda limitado a obtener y mostrar ventas/reportes. Retiradas cinco preparaciones comerciales; el POS manual y las dos lecturas/fuentes de informes se conservan. Registro, ejecución histórica y adopción se verifican por alcance; no se publica la ficha candidata nueva ni se cambia la aprobación de POS5. Véase [Ventas y reportes de solo lectura](sales-and-reporting-read-only.md) y Plan94 §26. Las referencias inferiores a escrituras de ventas por IA describen cortes anteriores y no las rehabilitan.

## Qué resuelve y qué significa

La nueva instrucción del usuario de plan94 R12 cambia el flujo de **nuevas ventas desde la UI POS**: carrito local y Confirmar venta producen directamente una venta completed mediante checkout atómico Server, sin guardar primero un borrador. Sustituye esa parte de la definición UI anterior, sin reescribir la ficha POS5 aprobada ni convertir/borrar históricos. Draft/create y sus operaciones siguen disponibles para compatibilidad y herramientas NodiaAI ya publicadas, con sus gates.

La revisión también mejora controles de pago, confirmación, cabecera, escaneo y búsqueda/catálogo. CLP, medios sólo informativos, cash inicial, disponibilidad manual, precio por flag y snapshots conservan su significado. No se añade un proveedor o modelo IA ni se infiere disponibilidad por configuración.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Aclaración o límite |
|---|---|---|
| «Confirma esta venta en el punto de venta» | Intención del operador en UI | Revisar carrito/medio y pulsar Confirmar; texto del chat no ejecuta checkout. |
| «Crea un borrador por IA» | Flujo IA histórico | Mantener create/propuesta/confirmación existentes; no sustituir por checkout ni completarlo automáticamente. |
| «Nueva venta» | Empezar otro carrito | Sólo cuando el estado anterior permite nueva intención; no descartar una operación incierta para repetirla. |
| «Oculta la información del negocio» | Espacio de pantalla | Control visual local; no cambia sección, carrito, consultas o permisos. |

## Operaciones y contratos

| Operación | Clase/efecto | Herramienta y estado | Contrato y resultado |
|---|---|---|---|
| Confirmar carrito nuevo en POS | Escritura comercial del operador | Sin herramienta IA nueva; implementado y probado localmente | POST /businesses/:businessId/sales/checkout, CheckoutSaleDto/MutateSaleUseCase; completed+partidas/evento/recibo en una transacción. |
| Consultar resultado incierto | Conciliación de la misma intención | Contrato vigente; no autoriza otra venta | Recibo de sale_mutation_requests por request_key y actor/negocio; no inventar rollback por ausencia. |
| Crear/editar/completar/descartar draft histórico o por IA | Compatibilidad comercial | Herramientas/gates publicados existentes intactos | Contratos create/update/complete/discard actuales, sin cambio automático de operación. |
| Colapsar cabecera | Presentación local | Sin herramienta ni persistencia remota | IconButton44px con Tooltip y aria-expanded/controls; MUI Collapse sólo info/acciones. |
| Buscar/elegir/escanear productos | Carrito local previo a confirmar | Lecturas autorizadas existentes | Catálogo paginado con búsqueda/imagen y scroll infinito; escáner consulta barcode exacto, sin fallback por code. |

## Datos mínimos y resolución de dudas

| Dato | Regla y procedencia |
|---|---|
| Negocio/actor | Ámbito autenticado y permisos actuales, revalidados por Server. |
| request_key | UUID de la misma intención fijada antes de enviar; operación/payload canónicos no cambian al recuperar. |
| Partidas | Producto, cantidad positiva, versión y precio esperado; checkout no admite carrito vacío y exige total positivo. |
| Precio/moneda | CLP exacto, flag normal/alternativo y snapshots nativos; sin impuestos/recargos inventados. |
| Medio | cash inicial para nueva venta; cash, transferencia, débito, crédito u otro informativos, no comprobante de cobro. Descripción de otro opcional, máximo500 caracteres. |
| Resultado desconocido | Conservar identidad/carrito; no volver a crear con otra clave ni afirmar cancelación remota. |

## Reglas, acceso y restricciones

Módulos/ownership y confirmación IA conservan sus reglas. La nueva ruta de operador no se publica como herramienta por existir backend o esta ficha. Las44 fichas aprobadas, incluida POS5, permanecen intactas; la autorización funcional del usuario no aprueba automáticamente ADR087 o este borrador. No se eliminan drafts ni propuestas previas.

Se retira Guardar borrador del flujo de nuevas ventas y el Alert cart_empty; se conservan errores y barreras para confirmar vacío. Medios principales usan botones grandes con iconos (efectivo/débito/crédito), conservando acceso a transferencia/otro. Confirmar y Nueva venta usan mínimo56px; Confirmar ocupa todo el ancho. Los cinco medios usan mínimo84px: desde sm, tres principales y dos secundarios en la fila siguiente; en xs, efectivo/débito comparten fila y crédito/transferencia/otro ocupan ancho completo.

## Filtros e informes

No crea reportes, medidas o fuentes IA nuevas. Las ventas completed del checkout entran a las fuentes vigentes con las mismas reglas de estado, fecha America/Santiago, CLP y exclusión por anulación. No sumar carritos locales/drafts como ventas completadas. La paginación interna del catálogo sigue siendo acotada aunque se retire el paginador visual.

## Vista previa, confirmación y recuperación

El usuario revisa carrito/medio antes del botón explícito Confirmar venta. El Server revalida y realiza un único commit completed, partidas, snapshots, evento y recibo; no hace dos peticiones create→complete en Client. Fallos de validación/autoridad revierten la operación; incertidumbre conserva su clave y requiere conciliación segura. Una nueva intención no sirve para eludir esa recuperación.

La cabecera se pliega desde el extremo derecho del breadcrumb, conservando tabs/selector y sección montada; estado por negocio, sin guardar permisos/preferencias remotas. El escáner toma foco al entrar al POS o iniciar Nueva venta y procesa Enter localmente; no debe robar foco al editar cantidades/medios o por un refetch. Búsqueda Select e imagen/información del catálogo comparten consultas paginadas con scroll infinito, sin descargar todo ni duplicar árboles.

## Integración y evidencia

- [x] Solicitud nueva y contradicción con el draft UI anterior registradas, sin modificar aprobado.
- [x] Cabecera local:8 pruebas de página/lint focal correctos; estado montado conservado mediante fixture POS de estado mínimo.
- [x] Checkout validado por34 comprobaciones PostgreSQL16/HTTP aisladas; no usa la BD objetivo.
- [x] Ajustes POS/catálogo, suites Server5682/313 más1omitida y Client2261/273, tipos/lint/build y QA sintética8perfiles correctos.
- [x] Migración/adopción Server VM:35 migraciones/70 tablas,69 de dominio preservadas y sólo dos CHECKs ampliados; Server73be36…/KBcde7…, API2263533/worker2263534 estables30.276s, respaldo previo BD/config cifrado/verificado y Native/keyring/timers conservados,0ventas/proveedores nuevos.
- [x] Client R02 activo y UI autenticada verificada;173archivos/169assets actuales/32previos, manifiesto08dcdfbc…ece9. R02 sólo corrige estilos de pagos tras hallazgo de label partido R01;18focales posteriores a la suite2261, lint/tipos/build y QA adicional320/600/1280 correctos.
- [ ] Lector y teléfono físicos según evidencia disponible.
- [ ] Revisión/aprobación documental; esta ficha no habilita ni publica capacidades.

[Recibo R12](../../../../evidence/business-pos-accessibility-20261029-r01.json):0overflow, controles56px, imágenes80px, cinco medios y estado conservado al resize/paneles con0GETextra. Fallo400 preserva revisión;503 posterior al commit conserva el journal y recupera completed por1GET del recibo, sin replay/POST draft o complete. No prueba pago, lector/teléfono físicos o persistencia comercial en VM. La migración amplía CHECKs de operación/evento para checkout; down se bloquea si ya hay recibos/eventos de ese tipo, sin borrar datos. No afirmar reversibilidad con ventas nuevas sólo porque existe down.

La inspección autenticada final R02 en navegador integrado1280px confirma Transferencia162.59×84px y label20.796875px/lineHeight20.8 (una línea), New/Confirm56px a ancho completo, cinco medios84px, foco del lector, colapso/tabs y0overflow.0ediciones/guardados/inferencias; pestaña temporal cerrada y trabajo del usuario intacto. R01/Server/KB/PIDs/Native preservados; respaldo posterior READY conciliado sin replay y quiet final0. El hallazgo R01 está corregido, sin afirmar una venta real o pago en VM.

## Evolución y compatibilidad

| Revisión | Cambio | Compatibilidad |
|---|---|---|
| 1 | Plan94 R12 y ADR087 propuesto: checkout atómico y nueve ajustes UI | Sustituye únicamente el draft previo de nuevas ventas UI. Históricos, herramientas IA y cuerpos aprobados intactos; draft/partial/unregistered/approval:null. |
