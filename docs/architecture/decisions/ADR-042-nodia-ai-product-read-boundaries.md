# ADR-042 — Límites de ejecución y publicación de lecturas NodiaAI

> Estado: propuesto; implementación local en verificación, sin aprobación automática
> Fecha: 2026-10-16

## Contexto

AI-15 incorpora puertos reales de lectura. El GET de un controlador no demuestra ausencia de efectos ni de I/O externo. Finanzas exige snapshots REPEATABLE READ; las lecturas de perfiles/proveedores usan admisión externa; archivos/exportaciones necesitan referencias privadas. La recuperación debe revalidar también recursos contenidos en los listados.

## Opciones consideradas

### Invocar controladores o servicios sin contexto transaccional

Reduce adaptación inicial, pero pierde autoridad, manager, snapshot, proyección y garantías del checkpoint. No se adopta.

### Ejecutar cualquier GET dentro del checkpoint

Mantendría una apariencia uniforme, pero sostendría locks durante red, refresh de perfiles o exportaciones. Tampoco permite tratar datos almacenados después de revocar pertenencia. No se adopta.

### Puertos tipados compartidos con los casos de uso y publicación explícita

Permite validar contratos, transmitir actor/manager, preservar snapshot y revisar autoridad actual de entrada y resultado. Las operaciones externas/artefactos conservan un gate específico hasta implementar su límite adecuado. Se implementa esta opción.

## Decisión

Los exports de familia son candidatos. La composición incluye sólo IDs ligados al manifiesto aprobado y el loader verifica contratos exactos. El runtime no publica puertos por introspección de endpoints o lectura libre de Markdown. Un build vacío no instancia las dependencias de todos los productos.

Cada capacidad conserva el aislamiento exigido por su dominio: Finanzas declara REPEATABLE READ; Reservas, Negocios y Ajustes conservan READ COMMITTED. Forzar RR global habría conservado un snapshot de membresía anterior a una revocación confirmada mientras el lector de Reservas esperaba el lock del alojamiento. Los demás checkpoints mantienen su aislamiento. El plazo SQL interno se transmite a las barreras nativas sin ampliar el límite ni introducir SELECT antes del LOCK de autoridad. El presupuesto durable permanece separado; una lectura rechazada no borra su coste. Las familias con resultados cuya autoridad puede cambiar declaran una comprobación de los recursos devueltos, aplicada también al recuperar, después de validar el schema.

Las consultas externas y artefactos utilizan un puerto explícito de tres fases: `external.prepare` captura entradas/configuración y un fingerprint bajo autoridad SQL; su closure ejecuta fuera del checkpoint con señal/plazo; `verify` relee autoridad y configuración en un checkpoint nuevo antes de completar el recibo. El hash del contrato incluye este límite. El recibo pasa a `validated` antes del trabajo externo y luego a `completed`; una interrupción no autoriza despachar otra vez el mismo call ID. Recuperar un resultado completado exige preparar/verificar el snapshot actual sin nueva llamada remota. El presupuesto se consume también al rechazar o recuperar. No se reemplazan observaciones por configuración ni se cambia de proveedor/modo por fallo.

Los archivos utilizan referencias regenerables basadas en el recibo existente. La descarga humana autenticada revalida chat vigente, actor, módulo de destino, entrada y recurso antes y después del I/O. CSV significa datos actuales al descargar, sin promesa de snapshot histórico. Facturas se transmiten mediante proxy privado con límite de bytes y señal; no se expone una URL firmada al modelo ni al navegador. No se crean tablas u objetos adicionales. Borrar/expirar el chat elimina la referencia; los archivos originales del negocio conservan su ciclo propio. Las exportaciones reutilizan el límite de filas de la política y sus límites nativos; el exceso se rechaza sin truncar.

La entrega inicial verificó 64 herramientas (59 lecturas y cinco técnicas). La ampliación de AI-15 conserva un catálogo completo acotado de 72 herramientas (67 de dominio y cinco técnicas), medido y probado con sus schemas reales, y mantiene 128 KiB de metadatos; argumentos/resultados/RPC mantienen 64 KiB. La frontera se actualiza de forma explícita con la ampliación comprobada, sin selección arbitraria ni truncamiento. Se descarta introducir para estas ocho operaciones un mini-planificador, varios dispatches o hot-loading que el CLI actual no demuestra. Los tests stdio reales son aislados y no acreditan inferencia Gemini ni Linux. Un catálogo posterior necesita medición y revisión de límites o selección explícita antes de publicar; este cambio no promete crecimiento ilimitado.

## Consecuencias

- Se comparten las reglas del producto y se evitan transacciones anidadas o consultas fuera del manager autorizado.
- Pueden ocurrir conflictos de serialización concurrentes: no se convierten en un éxito ni en repetición de efectos. La prueba aislada no demuestra rendimiento bajo carga.
- Los productos necesitan schemas/proyecciones y evidencia por capacidad. La aprobación documental y aceptación del adaptador siguen independientes.
- El catálogo MCP completo y sus límites se medirán y probarán antes de publicar más herramientas que las admitidas por el transporte anterior. No se amplía el tamaño de argumentos/resultados por ampliar metadatos.

## Referencias

[Entrega61](../../mvp/61-nodia-ai-ai15-product-reads.md), [arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md), [registro60](../../mvp/60-nodia-ai-ai14-capability-registry.md), [ADR-038](ADR-038-nodia-ai-compiled-knowledge-contract.md), [ADR-039](ADR-039-shared-authority-transactions.md).
