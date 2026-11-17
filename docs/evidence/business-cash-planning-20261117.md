# Caja de Negocios — planificación y vistas locales, 2026-11-17

> La sección inicial conserva el corte R01 y su hash histórico. El fragmento
> vigente fue actualizado por R02; su hash y comprobaciones están al final.

## Alcance comprobado

[Plan109](../mvp/109-business-cash-ledger-plan.md),
[ADR106 propuesto](../architecture/decisions/ADR-106-business-cash-invoice-expense-consistency.md),
[TODO CASH-001](../mvp/TODO.md) y
[ficha candidata](../nodia-ai/knowledge/businesses/features/cash-ledger-and-invoice-expenses.md)
registran el pedido y la ampliación de cards mensuales en Overview. Rama actual
`codex/teacher-guided-continuity`. Es planificación para retomar2026-11-18;
no hay implementación de Caja, operaciones de BD, inferencias ni despliegue.

Revisión de contratos reales: Caja requiere recursos propios por negocio;
`business_actions` es catálogo de permisos. Factura tiene total entero y fecha
en JSON. Guardado OCR actual usa varias peticiones; nueva confirmación nativa
atómica/idempotente es dependencia CASH-04, no garantía ya disponible.

## Maqueta y comprobación en Chromium

Fragmento local de este chat:
`C:/Users/Oscar/.codex/visualizations/2026/11/16/01a1e5a5-176a-7ca2-9b96-6569df08fd3c/caja-negocios.html`.
SHA256 `009ca43164dbf424add08d06b09919da0d34c0a3c82471a6a736271c1625ec05`.
Datos sintéticos y estado en memoria; las acciones no llaman APIs de negocio.
Las reglas duraderas están en plan109; el checkout no necesita ese archivo local
para reconstruir el diseño o retomar contratos.

- Vistas Caja, Overview, Facturas y Productos con OCR; Drawer de categorías,
  filtros, formulario de egreso y menú de acciones.
- Search y categoría modifican ambos paneles; paginar conserva el agregado.
  Fixture diaria:3ingresos/218000CLP y3egresos/104300CLP. Mensual activa:
  4ingresos/316000CLP y4egresos/146300CLP, independiente del filtro diario.
- Guardado local de categoría y movimiento manual comprobados;1445CLP se
  conserva como1445, sin regla de decenas del precio de venta.
- Borrador de factura conservado al navegar; recategorizar y cambiar total
  mantiene3egresos en la fixture. Desactivar refleja el nuevo total filtrado.
  Esto sólo prueba el simulador; no demuestra integridad ni concurrencia SQL.
- Anchos320/600/900/1440 sin overflow horizontal del documento; tabla con scroll
  local y tarjetas en móvil. Capturas adicionales390/claro y1024/oscuro.
  Foco dentro del diálogo, Escape y retorno al botón de apertura comprobados.
- Fallo inicial del submit bajo sandbox corregido mediante acciones locales con
  validación; no se relajó CSP/sandbox. Recaptura tras renovación del contenido
  descartó el HTML antiguo de caché. Corridas finales sin errores JavaScript.

Nueve capturas enfocadas en `output/playwright/cash-planning-20261117/`, ignoradas
por Git: Caja escritorio/móvil/oscuro, filtros, Drawer, nuevo egreso, Overview,
factura y OCR. Navegador y servidor propios cerrados al terminar. No se versionan
imágenes ni se atribuye esta revisión a producción o a un teléfono físico.

## Documentación y conocimiento

- UTF-8/LF y frontmatter JSON de candidatas comprobados; enlaces locales nuevos
  correctos y `git diff --check` correcto.
- `knowledge:check/build`, preparación de pins mediante builder soportado y
  `test:nodia-ai:knowledge`:58casos correctos, sin omisiones.
- 97fuentes/53excluidas;44documentos/46fragmentos/153capacidades publicadas
  conservadas. Caja planned/draft/unregistered/approval:null queda excluida.
- Release local derivado del índice:
  `313a016b1ecd554e76f5091445253bedb01f5cf54ba6c5d2f5b1e1729a533365`.
  No se modifican cuerpos/aprobaciones existentes ni se publica Caja en runtime.

No se ejecuta la suite global de aplicación por este cambio exclusivamente de
planificación/maqueta. Los tests de DB/HTTP, atomicidad OCR, autorización, ES/EN
con componentes reales y adopción siguen en CASH-02…07.

## R02 — selectores, creación rápida y retiro de egreso

Ampliación expresa del usuario del mismo día: X para limpiar categoría; + para
crear nombre/descripción desde factura nueva/editar, OCR o ingreso/egreso;
duplicados ignorando mayúsculas/espaciados; retirar egreso al guardar factura
sin categoría. Sólo las facturas generan egresos automáticos y los cierres de
caja se registran manualmente como ingresos. Plan109/ADR106, TODO y fichas
Caja2/Negocios57 actualizados; se sustituye la recomendación anterior de impedir
limpiar una categoría ya vinculada. Sin implementación productiva ni aprobación.

Fragmento actualizado en la misma ruta local. SHA256 R02:
`2f932ba29aae3f2aaed8373437fa1c1f2afa1bb76f8e619f6a6e4e1e4f650b70`.
Drawer y modal tienen accesos de vista explícitos; no se requieren pasos ocultos
para ver ambos diseños. Capturas enfocadas y scripts temporales en
`output/playwright/cash-planning-20261117/r02/`, ignorados; ochoPNG fuera de Git.

Comprobaciones finales Chromium, exclusivamente sobre datos sintéticos:

- Factura nueva sin categoría no agrega egreso; con categoría agrega uno;
  existente sin categoría empieza a generar uno al asignarla; recategorizar
  conserva ID/conteo y quitarla al guardar retira el efecto.
- X sólo cambia el borrador y muestra consecuencia pendiente; antes de guardar
  no cambia Caja. Retiro excluido incluso en actividad Todos y Overview mensual.
  Restauración conserva ID7, sin duplicar; vuelve activo si estaba retirado.
  Recategorizar un egreso vigente inactivo conserva su actividad.
- Retirar categoría de factura con total0 permitido. No aplicar la exigencia
  de egreso positivo a facturas que ya no producen ese efecto.
- Duplicados rechazados en Drawer y creación rápida; incluye mayúsculas,
  espacios internos, NBSP/FEFF y categoría existente inactiva. El formulario
  conserva descripción/nombre ante error. NFKC/minúsculas españolas/whitespace
  se prueban sólo en el simulador, no como constraint SQL implementado.
- Alta rápida selecciona la categoría nueva por ID, conserva folio de factura,
  borrador de movimiento y selección al cancelar. Un único diálogo activo.
  OCR permite crear/seleccionar/limpiar sin persistir factura real.
- Cierre de caja manual ingresado como ingreso1445CLP, conservando pesos enteros.
  Tablas/resúmenes calculan fixtures en memoria; no hay integración POS.
- Drawer/modal sin overflow del documento en320/600/900/1440; capturas móviles390
  y oscuro1024. Cero errores JavaScript en la corrida de matriz y formularios.

Documentación: UTF-8/LF/JSON/enlaces y diff check correctos;
`test:nodia-ai:knowledge`58/58 correcto y check final válido. Se corrigió
`implementation.notes` del borrador Negocios que excedía4096caracteres,
consolidando texto redundante sin cambiar aprobaciones. Corpus97/53 y publicación
44/46/153, release313a016b… conservados. No se ejecutan SQL/HTTP del módulo,
tests globales de aplicación ni inferencias por esta revisión de plan/maqueta.

## Preparación del commit y PR — solicitud2026-11-17

Se conserva la [fuente editable de la maqueta R02](../features/businesses/cash-ledger-preview.fragment.html)
en el repositorio como texto UTF-8/LF, con el mismo SHA256 R02 documentado.
El fragmento corresponde a una fixture visual local; no es código de Client
integrado ni implementación de Caja. Imágenes/HTML renderizado/logs intermedios
permanecen ignorados. [PR50](https://github.com/oscarvalenzuela25/Nodia/pull/50)
ya abierto contra development recibe la documentación y conserva los alcances
anteriores Teacher/Negocios. Primer pendiente real de Caja: CASH-01 para retomar
2026-11-18; este envío no autoriza fusión ni despliegue.
