# Listas de Market — verificación del 18 de noviembre de 2026

Alcance de `codex/market-shopping-lists` desde `development` `4ea75274`.
El árbol previo de Server y migraciones es el mismo que en `master`
`69aeecc7`. El [plan110](../mvp/110-market-shopping-lists-plan.md) enlaza
el contrato funcional y las fases. Las pruebas usan datos sintéticos.

## PostgreSQL y despliegue

| Prueba | Resultado observado |
| --- | --- |
| Instalación limpia y actualización | Pasaron 47 comprobaciones con PostgreSQL 16 desechable y migraciones compiladas. La actualización añadió `CreateBusinessShoppingLists1793730000000` a las 56 entradas previas. Conservó las filas sintéticas de usuario, negocio, producto y categoría de Caja. Instalación limpia y actualizada coincidieron en las columnas de las tres tablas, incluidos tipos, nulabilidad, valores por defecto y precisión. |
| Fallo SQL | Una colisión al crear la tabla de recibos se produjo después del DDL de las otras dos tablas. La transacción conservó el esquema y ledger anteriores y la fila del fixture en conflicto. El ensayo volvió a pasar tras retirar el fixture. |
| Reversión | En laboratorio, `down` retiró las tres tablas vacías y restauró el ledger anterior. Con una lista guardada rechazó la reversión y conservó tanto la lista como el ledger. |
| Acción de producción en Linux | Se ejecutó el [verificador y actualizador SQL de producción](../../ops/production/update-backend-action.mjs) con Node `24.22.2`, usuario sin privilegios UID 900 y PostgreSQL 16 en una red Docker interna. `inspect` confirmó 56 → 57 y trabajos en cero. `migrate` aplicó una migración con TLS `verify-full` y validó las columnas persistentes de 76 entidades. `verify` confirmó cero pendientes en sólo lectura. Un hostname ajeno al certificado y una segunda llamada a `migrate` fueron rechazados. La fila previa se conservó y el actualizador no ejecutó seed. |

El hash del ledger de entrada en el ensayo Linux fue
`634d9db2209e4af8d3ac0df1335510d79b471b8390373654533d9edfd3c98718`, igual
al ledger operativo de 56 migraciones registrado en
[plan99 §34](../mvp/99-production-deployment-and-cicd-plan.md#ledger-confirmado-y-activación-autorizada).
El candidato produjo el hash
`da87d046c95a5a1887d33d75663567e13846d713373fedb64b22eb21afd18d7d`.
Se verificó que la rama conserva los 56 archivos de migración del corte Git
previo. El ensayo Linux usó dos releases sintéticos de la compilación
local con el mismo prefijo compilado y dependencias Linux del laboratorio.
La CI calcula la evidencia del SHA que se integre y el CD vuelve a comparar
ese prefijo con el artefacto operativo antes de aplicar la migración.

## API, reglas y concurrencia

Pasaron cinco grupos de [integración HTTP](../../nodia-server/test/market-shopping-lists.integration.mjs)
con Nest compilado, JWT y PostgreSQL 16. Cubren alta simultánea y recibo
original por actor, búsqueda literal sin tildes, paginado, precisión decimal e
identificadores bigint, rechazo de productos ajenos y desactivados, rollback
si falla el recibo, conflictos de revisión, marcas simultáneas en distintas
partidas y edición concurrente. También comprobaron revocación mientras una
escritura esperaba un lock y preservación del nombre histórico al desactivar
o trasladar Productos. Pasaron diez pruebas adicionales de categorías de Caja
que comparten el fixture HTTP.

Server pasó 6327 pruebas en 370 archivos con una omisión preexistente en
Windows. Compilación y lint correctos por código, con una advertencia de lint
en un fixture histórico ajeno a Market. Pasaron los cinco tests del verificador
SQL. La comprobación de activos y contratos compilados de CI pasó con 146
casos y dos omisiones de plataforma en Windows. El build de conocimiento
conserva 44 documentos publicados y 46 fragmentos, con pins verificados.

## Recorrido en Chromium

Client de Nodia usó HTTP real del módulo de Listas, JWT y PostgreSQL aislado.
El entorno de prueba suministró el inicio de sesión y las respuestas de las
secciones ajenas a Listas para evitar depender de servicios operativos.

- En español y tema oscuro se comprobó búsqueda por nombre, alta por pasos,
  cantidad inicial 1, decimal con coma, cancelación y confirmación al quitar
  un producto, edición, desactivación y reactivación. La copia alternativa
  dejó texto seleccionable y devolvió el foco al botón de origen.
- Un 504 después de confirmar la transacción preservó el borrador. El
  editor recuperó el recibo mediante GET, con un solo POST observado para
  la intención. Un 503 al marcar conservó la última marca confirmada. El
  reintento guardó la marca, recuperó el foco del checkbox y permitió cerrar
  con Escape. La marca se mantuvo al volver a abrir la lista.
- Se comprobaron 320, 390, 599, 600 y 1440 px, con pruebas en inglés y tema
  claro. Las tarjetas móviles y las acciones de 44 px se mantuvieron
  utilizables. La tabla desde 600 px conservó el ancho mínimo y el scroll
  queda contenido en su panel. En 320 px el editor y el drawer quedaron
  dentro del viewport. En inglés una respuesta inválida mostró reintento y
  se comprobó el estado vacío filtrado posterior.

Capturas en `output/playwright/market-lists/`, fuera de Git. Actionlint
validó todos los archivos de workflow. La suite general de Client pasó
3298 pruebas en 401 archivos. La comprobación focal final pasó 16 pruebas,
incluida la recuperación de foco. El build y el lint del código fuente
pasaron. El lint de toda la carpeta detectó cinco errores de prototipos
locales en `.tmp`, excluidos del árbol Git y del artefacto.

## Entorno operativo

La CI ejecuta instalación limpia, actualización desde el esquema previo y
contratos HTTP antes de empaquetar Server. La aplicación operativa del
artefacto y el recorrido con usuarios autorizados del negocio se verifican
en la entrega. Este ensayo se realizó contra bases desechables. Para una
reversión de release con listas guardadas, se conserva el esquema aditivo y
se sigue la conciliación documentada en el [runbook de producción](../../ops/production/README.md).
