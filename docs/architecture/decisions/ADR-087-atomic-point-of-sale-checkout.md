# ADR-087 — Checkout atómico del punto de venta y compatibilidad de borradores

> Estado: propuesto
> Fecha: 2026-10-29
> Alcance: instrucción funcional explícita del usuario para nuevas ventas desde POS; no aprobación de este ADR, de fichas o de publicación IA. Implementación local, suites y QA sintética correctas;34 comprobaciones PostgreSQL/HTTP aisladas correctas. Server VM/postbackup y Client R02/UI autenticada verificados por alcance; sin nueva venta o inferencia en VM.

## Contexto

El POS inicial de plan94/POS5 guarda primero una venta draft y después la completa. El usuario solicita ahora retirar «Guardar borrador» y que las nuevas ventas de esta UI se confirmen sin dejar un borrador persistido. Dos peticiones y transacciones sucesivas no satisfacen ese requisito: si falla la segunda, puede quedar una cabecera draft. La decisión afecta Client, validación/transacciones/idempotencia Server, eventos/recibos y la compatibilidad de la integración IA ya publicada.

POS5 aprobado y los contratos NodiaAI de crear/editar/completar/descartar conservan su alcance histórico. La nueva instrucción reemplaza el flujo de nuevas ventas en la UI POS; no autoriza borrar datos o retirar herramientas por deducción. CLP, cinco medios informativos, cash inicial, snapshots, precio seleccionado y total positivo conservan sus reglas.

## Opciones consideradas

### Opción A — Ocultar el botón y coordinar create + complete desde Client

- Ventajas: reutilización inmediata de dos operaciones existentes.
- Desventajas: dos commits permiten un borrador entre fases o tras fallo; rollback desde Client no es atómico ni seguro ante respuesta incierta. No cumple la petición.

### Opción B — Operación Server de checkout que crea directamente completed en una transacción

- Ventajas: cabecera final, partidas/snapshots, evento y recibo pertenecen al mismo commit; conserva autoridad, revalidación e identidad idempotente nativas. Un fallo revierte toda la operación sin exponer un draft intermedio persistido.
- Desventajas: amplía la operación/evento tipados y sus CHECKs, exige pruebas PostgreSQL de atomicidad, carreras, receipts y revocación, y una migración compatible.

### Opción C — Retirar draft del dominio y convertir o eliminar los históricos

- Ventajas: reduce un estado para consumidores futuros.
- Desventajas: cambia datos y contratos aprobados/IA, elimina compatibilidad y excede la instrucción sobre esta UI. No se elige.

## Decisión

Aplicar B como `POST /businesses/:businessId/sales/checkout`, con DTO tipado y operación checkout del caso de uso nativo. Revalidar módulo/ownership, productos y versiones/precios; generar completed, snapshots, total y fecha/actor de confirmación junto al evento y recibo dentro de la transacción. No implementar create→complete en el navegador. No es un cobro ni una pasarela: el medio sigue informativo.

El carrito nuevo sigue local hasta la intención humana de Confirmar venta. La request_key representa esa intención y queda fijada antes del envío; operación/payload canónicos y resultado guardado permiten recuperar el mismo efecto. Ante incertidumbre se conserva la identidad y se concilia por el contrato vigente; no se crea otra intención ni se declara rollback por una lectura ausente. Nueva venta no elude una operación incierta pendiente.

Mantener draft/create/update/complete/discard para datos y consumidores históricos, incluida NodiaAI con sus herramientas y gates actuales. Checkout es una ruta del operador; no añade ni publica una herramienta IA. El estado o un texto del chat nunca sustituye confirmación humana.

La migración `1793420000000-AddDirectSaleCheckout` amplía sólo los CHECKs de operación en sale_mutation_requests y evento en sale_events. No transforma ventas históricas. Down bloquea si existen recibos/eventos checkout; no borra filas para aparentar reversibilidad. La entrega operativa debe respetar ese límite y un respaldo verificable.

## Consecuencias

- La UI nueva retira Guardar borrador y confirma una sola venta completed. Históricos y propuestas/contratos IA previos siguen diferenciados.
- Una respuesta perdida no obliga a repetir el efecto: la misma identidad y recibo conservan idempotencia. La garantía requiere integración real de DB, no sólo bloquear el botón.
- El catálogo paginado, escaneo y accesibilidad de plan94 R12 no amplían permisos ni capacidades de proveedores.
- ADR y ficha candidata quedan en revisión. Implementar o desplegar no aprueba su contenido ni publica capacidad nueva; no se modifica POS5 aprobado.

## Verificación por alcance

El [recibo R12](../../evidence/business-pos-accessibility-20261029-r01.json) distingue las34 comprobaciones PostgreSQL16/HTTP del candidato aislado de la BD objetivo. Suite Server5682/313 más1 omitida y Client2261/273 correctas; tipos/lint/build finales correctos. QA sintética de ocho perfiles verifica controles y conservación de estado; ante503 posterior al commit conserva journal y recupera completed con1GET del recibo, sin replay ni POST draft/complete. No acredita pago, inferencia o lector/teléfono físicos. La procedencia técnica renueva19 entradas sobre tres fuentes, preservando contratos públicos,158 capacidades,44 cuerpos aprobados y46 fragmentos. Server VM adoptado/verificado con35migraciones/70tablas,69tablas de dominio preservadas y sólo los dos CHECKs ampliados; Server73be36…/KBcde7…, API/worker estables30.276s, respaldos previos BD/config cifrados/verificados y Native/keyring/timers conservados,0ventas/proveedores nuevos. Respaldo posterior READY conciliado sin replay, quiet final0. Client R02 activo/verificado corrige sólo estilos de pagos tras label Transferencia partido en R01;18focales posteriores a la suite2261, lint/tipos/build y QA320/600/1280 correctos. UI autenticada final IAB1280 verifica label1línea, cinco medios84px, CTA56px, foco/collapse y0overflow, con0ediciones/guardados/inferencias.173archivos/169assets actuales/32previos, manifiesto08dcdfbc…ece9; R01/Server/KB/PIDs/Native preservados. No se acredita una venta real en VM o aceptación física.

## Referencias

- [Plan94 R12](../../mvp/94-business-point-of-sale-and-product-refactor.md#21-ajustes-del-pos-y-checkout-atómico-r12--2026-10-29).
- [Ficha candidata](../../nodia-ai/knowledge/businesses/features/point-of-sale-checkout-and-accessibility.md) y [POS5 aprobado](../../nodia-ai/knowledge/businesses/features/point-of-sale-and-sales.md).
- [ADR085 propuesto](ADR-085-business-sales-and-product-availability.md), [autoridad89](../../mvp/89-module-access-and-user-data-scope.md) y [arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md).
- [DTO de checkout](../../../nodia-server/src/sale/dto/sale-command.dto.ts), [caso de uso](../../../nodia-server/src/sale/use-case/mutate-sale.use-case.ts) y [migración](../../../nodia-server/src/migrations/1793420000000-AddDirectSaleCheckout.ts).
- [Recibo de la revisión](../../evidence/business-pos-accessibility-20261029-r01.json).
