# Client CI: frontera del diálogo de registro POS — 2026-11-15

## Fallo confirmado

El [Client del push a development](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43688198898/job/132733116466)
falló en una prueba de `SalesWorkspace`: no encontró el diálogo de registro
después de rechazar un barcode desconocido, escanear de nuevo y confirmar el
registro. Pasaron los otros 2993 casos. El [CI del PR](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43688255378)
pasó sobre el mismo SHA 4f823642; ese éxito no elimina el fallo intermitente.

La frontera simulada de `PosProductRegistration` era un `div` dentro del árbol
de la página. Mientras `ConfirmDialog` terminaba su transición de salida, el
ModalManager de MUI mantenía ese árbol con `aria-hidden`. El formulario real
usa `BaseModal`/Dialog y su portal, por lo que la simulación tenía otra semántica
de accesibilidad y dependía de que acabara la transición antes del timeout.

## Corrección y control de regresión

Sólo cambia el test: su frontera mínima conserva `Dialog`/`DialogTitle` reales,
portal y pila de modales. La transición del registro simulado dura cero; la del
aviso anterior permanece real. Se exige acceso al diálogo inmediatamente tras
la confirmación, sin consultar elementos ocultos o ampliar plazos/reintentos.

Control previo: con esa aserción y el `div` antiguo, el escenario falla en el
mismo diálogo. Con la frontera corregida pasan los 25 casos del componente.
Se conservan barcode exacto, cancelación, lector vacío/enfocado, carrito intacto,
alta incorporada una sola vez y descarte de respuestas de otro contexto.

Validación local: 25 casos, ESLint del archivo y build con TypeScript correctos;
dependencias instaladas desde el lockfile en un worktree independiente. La
validación Linux completa se realizará mediante el nuevo CI del PR 28.

## Alcance

No cambia código de producción, contratos HTTP, reglas POS, permisos, layout
o traducciones. No requiere nuevas fichas funcionales ni modifica conocimiento
aprobado. Conserva [plan 94 §39–40](../mvp/94-business-point-of-sale-and-product-refactor.md#39-alta-de-producto-al-escanear-un-barcode-desconocido--solicitud2026-11-14).
Sin operaciones comerciales o inferencias reales durante esta corrección.
