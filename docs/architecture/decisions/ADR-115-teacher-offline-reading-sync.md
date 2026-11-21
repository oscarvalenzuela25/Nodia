# ADR-115 — Sincronizar el punto de lectura de Teacher

> Estado: propuesto
> Fecha: 2026-11-21

## Contexto

Teacher permite leer una copia cifrada de material descargado. La persona
necesita retomar su lectura desde otro dispositivo después de recuperar la
red. El estudio conserva un cursor versionado que también usa Teacher en
línea. Una respuesta perdida puede ocultar una escritura ya confirmada.

## Opciones consideradas

- Ordenar los guardados por la hora del dispositivo. Es sencillo, pero un
  reloj desajustado o una conexión tardía puede desplazar una decisión más
  reciente sin que la persona lo vea.
- Guardar una intención por estudio y compararla con la revisión autoritativa
  del cursor. Permite recuperar el resultado y pedir una decisión cuando los
  puntos difieren. Requiere conservar el recibo y mostrar el conflicto.

## Decisión

Registrar el punto de lectura seleccionado explícitamente en una intención
cifrada junto a las copias. Su alcance es la cuenta, la sesión autenticada y
la copia que lo originó. Una intención aún sin enviar puede reemplazarse por
una selección posterior. Antes de que salga a la red, se persiste su UUID y
contenido exacto como un envío pendiente de confirmación.

Con el lector o Teacher abiertos y la sesión vigente, leer primero el recibo
autorizado del UUID. Si falta, enviar el mismo UUID y payload por el endpoint
específico de lectura. Server comprueba acceso a Teacher, ownership, estado
del estudio, revisión del plan, versión de material, bloque y revisión
esperada del cursor dentro de la transacción. El recibo se escribe junto con
el nuevo cursor y se reutiliza al repetir el mismo comando.

Una discrepancia de revisión reúne el punto local y el cursor actual. Si
identifican el mismo bloque y material, se confirma la convergencia. Si
difieren, se conserva cada punto hasta que la persona elija. Confirmar el
punto local crea otro UUID con la revisión mostrada. Conservar el punto del
servidor descarta la intención local. Un cambio concurrente adicional se
presenta de nuevo. El reloj local sólo rige la vigencia de la copia.

## Consecuencias

- El cursor y el conjunto de bloques visitados siguen usando las tablas y
  el modelo de Teacher. La operación admite únicamente posición de lectura
  y protege las evaluaciones activas.
- Una copia histórica sigue siendo legible. Volver a descargarla incorpora
  la revisión necesaria para registrar avance.
- Quitar, caducar o reemplazar la copia detiene nuevos envíos desde esa
  copia. Una escritura que Server ya recibió conserva su resultado.
- La sincronización se recupera en primer plano y también dispone de una
  acción explícita. El despliegue y la verificación en dispositivos físicos
  siguen pendientes.

## Referencias

- [Plan103 §8](../../mvp/103-pwa-progressive-implementation-plan.md#8-pwa-006--escrituras-offline-y-sincronización)
- [Contratos técnicos de Teacher](../../mvp/97-nodia-teacher-technical-contracts.md)
- [ADR-114 — Copias de material de Teacher sin conexión](ADR-114-teacher-offline-study-copies.md)
