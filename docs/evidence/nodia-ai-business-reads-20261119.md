# Consultas de Listas de Market y Caja en NodiaAI

## Autorización del 2026-11-19

El usuario autorizó en la conversación de trabajo «Publica las fichas y
habilita en NodiaAI las consultas de solo lectura para Listas de Market y
Caja de Negocios. Reutiliza las consultas existentes y prueba que se
respeten los permisos de cada negocio».

La autorización se registra para los apartados de consulta de
[Listas de Market](../nodia-ai/knowledge/businesses/features/market-shopping-lists.md#consultas-de-solo-lectura-en-nodiaai)
y [Caja](../nodia-ai/knowledge/businesses/features/cash-ledger-and-invoice-expenses.md#consultas-de-solo-lectura-en-nodiaai).

## Verificación local

La compilación de Server generó `nodia-ai-business-pos/5` con 46 fichas,
48 fragmentos y 159 capacidades publicadas. Los dos fragmentos nuevos se
enlazan a seis contratos `read` con esquemas cerrados. El registro verifica los hashes de
los contratos y de las fuentes. El descubrimiento automático usa el catálogo
publicado por sesión. El perfil fijo `published_reads` conserva sus 67
capacidades y su límite de transporte.

Pasaron el build de Server, las auditorías de catálogo y conocimiento y la
suite unitaria con 6 325 pruebas y una omitida. Pasaron también las pruebas
HTTP nativas de Listas, categorías, movimientos y egresos de facturas.

La [integración](../../nodia-server/test/nodia-ai-business-reads.integration.mjs)
probó el registro compilado y el gateway sobre PostgreSQL 16 desechable.
Confirmó el descubrimiento en español y el acceso del propietario y del
colaborador autorizado. Las seis herramientas rechazaron negocios ajenos.
La prueba también rechazó IDs de listas o movimientos cruzados entre dos
negocios autorizados y cubrió
la revocación del módulo o de la colaboración al repetir una llamada, la
concesión por operación, los datos proyectados de Market y el importe exacto
de los egresos de Caja. Entradas sin negocio o con un actor inyectado se
rechazaron antes de leer datos. El workflow de CI incluye esta prueba con
PostgreSQL aislado.

La prueba usó sesiones y datos sintéticos en el gateway compartido. La
verificación por proveedor y el despliegue en producción tienen evidencia
independiente.
