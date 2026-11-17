# Negocios: precios, división, OCR y facturas — 2026-11-17

Alcance: [plan94§42](../mvp/94-business-point-of-sale-and-product-refactor.md#42-precios-de-venta-redondeados-división-local-y-proveedores-ocr--solicitud2026-11-17).
Continuación local de la rama `codex/teacher-guided-continuity`, posterior a la
preparación del PR50. No constituye despliegue ni aplicación de DDL operativa.

## Comportamiento comprobado

- Venta normal: escritura libre, sin cálculo por pulsación; al salir del campo
  (`onBlur`) `1444 → 1440` y `1445 → 1450`. Guardado y escritores nativos
  normalizan de nuevo como defensa. Se conserva el valor histórico al abrir el
  editor hasta editar/salir/guardar; no se ejecuta backfill de precios.
- Sugerencias por porcentaje, inicial OCR30% y división de venta redondean una
  sola vez desde el resultado real, sin un redondeo previo a pesos. Ejemplo de
  regresión: `2889 / 2 = 1444,5 → 1440`, no1450. Cero real es válido; ausencia,
  divisor no positivo/no finito y overflow bloquean Aplicar/Guardar.
- La división de neto conserva el dominio previo CLP entero (`1000 / 3 → 333`),
  sin redondeo a decenas; aplica el mismo cálculo de impuesto que editar ese
  costo manualmente. Cambiar venta no cambia costos ni precio alternativo.
- Vinculación manual OCR: editar sólo costos preserva venta no seleccionada
  (incluidos históricos1547 o MAX); editar venta1445 normaliza1450 y la incluye
  en los campos revisados antes de preparar el payload.
- Los labels de neto y venta del producto ofrecen ÷ después de la ayuda. El
  resultado se aplica al borrador, no persiste por abrir/dividir/cancelar. Las
  opciones OCR reutilizan la regla y la calculadora muestra un check.
- Proveedor `use_ocr` booleano, defaultfalse en nuevos e históricos; sólo ese
  selector OCR usa `q.use_ocr_eq=true`, antes de paginar. Facturas y productos
  conservan todos los proveedores. Ocultar las columnas no borra su mapeo.
  PATCH del flag solo conserva impuesto y configuración no enviados. CSV nuevo
  exporta el flag; importar formato antiguo/columna vacía no apaga una selección
  ya guardada. `false` explícito se conserva.
- Factura sin folio almacena `code:null`; omitir code en PATCH lo conserva,
  vacío/null explícito lo limpia. Lecturas, tarjetas y filtros toleran su
  ausencia. Nueva fecha usa hoy civil local; edición conserva la fecha previa.
  Notas precede a Activo y el estado se envía explícitamente incluso false.
- Overview retira sólo el chip Por confirmar; no reclasifica datos desconocidos
  ni cambia los agregados.

## Integridad, contratos y PostgreSQL

La migración `1793680000000-ProviderOcrAndOptionalInvoiceCode` añade el flag y
permite folio nulo sin reescribir facturas o mapeos. El down rechaza una retirada
destructiva sin restauración de respaldo; no inventa folios.

`node test/business-pricing-ocr.integration.mjs` pasó **7 gates PostgreSQL16**
en contenedor propio descartable: migración/defaults; PATCH que conserva tax7 y
mapeo; filtro exacto/paginado y consulta general; CSV; folio omitido/limpiado;
create/update/bulk de productos con logs nuevos exactos y rollback de overflow;
rechazo seguro del down. Los registros previos permanecen intactos. El gate
usa esquema/actor sintéticos, lookup de módulo acotado y autoridad del dominio;
no demuestra migración sobre todo un esquema histórico o DB operativa. El
contenedor fue retirado; log temporal en `output/business-pricing-ocr-backend/`.

NodiaAI normaliza venta antes de construir preview/template/hash. Propuestas
antiguas incompatibles se rechazan antes del escritor y requieren nueva revisión.
El artefacto compartido de escritura se derivó del builder real con un emitter
offline mantenido: sólo cambian dos comentarios `native_preparer` de productos
crear/actualizar; campos, required y autoridad permanecen. Las26 referencias de
la familia y sus bindings apuntan al mismo SHA actualizado, sin alias ni fallback.
`scripts/build-nodia-ai-write-schema.mjs --check` verifica bytes/idempotencia
sin acceder a puertos, DB, cuentas o proveedores.

## Pruebas y build

- Client: global final **3225pruebas/387suites** correcta,269,11s; focal
  OCR final **75/3** incluye el caso de venta no seleccionada. Después se ajustó
  sólo la altura de labels monetarios para alinear inputs con ÷; ese delta
  geométrico se verificó con lint/build y32perfiles Chromium repetidos.
- Focales previas: OCR/helpers/selectores/CSV/Overview97/6; formularios y
  transporte113/14; precios/división96/6. Son ámbitos parcialmente solapados,
  no se suman como pruebas independientes.
- Client: `npm run build` final correcto (incluye `tsc -b`), Vite final correcto;
  `npm run lint -- --ignore-pattern '.tmp/**'` correcto. `.tmp` contiene
  prototipos locales ignorados previos y se conserva fuera del lint de fuentes.
- Server: focal520/53 y regresión de artefacto101/1 correctas. La global inicial
  mostró un artefacto anterior y un timeout5s de montaje Nest en carga paralela;
  el artefacto fue regenerado y ese montaje aislado pasó4/4 sin modificar timeout.
  Global final con2workers: **6143 correctas/358suites,1omitida en Windows**
  (prueba de nacimiento de proceso exclusiva de Linux),440,81s. No se modificó
  el timeout ni se añadió una omisión para conseguir ese resultado.
- Server build/tipado y lint finales correctos; conocimiento58pruebas y pins
  src/dist correctos,44documentos/46fragmentos/153capacidades, release
  derivado mediante los scripts soportados y comprobación de pins src/dist.
  Ningún cuerpo aprobado ni firma se modificó. Las candidatas Negocios55 y
  calculadora/vinculación15 permanecen draft/partial/unregistered/approval:null.

## Navegador y límites

Chromium con componentes reales y transporte sintético: edición/blur, resize
sin perder texto, división inválida y resultado, neto sin decenas, proveedores
de ambos tipos en formularios generales, guardado503 que conserva producto,
OCR desactivado al crear y mapeo preservado al alternar; fecha actual, fecha de
edición preservada y orden Notas/Activo verificados. Matriz32perfiles: cuatro
formularios ×320/600/900/1440 ×ESclaro/ENoscuro; documento y modal sin overflow,
cero mutaciones al montar. Las capturas esperan fuentes y transiciones.

Capturas/scripts/logs intermedios en `output/playwright/business-adjustments-20261117/`
y `.tmp/` ignorados; ninguna imagen nueva en Git. El fixture manual mantenido
sólo incorpora el campo booleano real a sus proveedores. No hubo OCR externo,
inferencia, cuenta real, SQL operativo o teléfono físico. La cobertura Linux del
test de nacimiento de proceso se distingue de Windows, no se simula como éxito.

La ficha aprobada de Facturas rev5 conserva su mínimo histórico. La solicitud
posterior permite folio ausente en el contrato manual actual; la candidata y
plan94§42 documentan la diferencia sin trasladar esa aprobación. No se habilitan
nuevas escrituras de ventas/reportes ni nuevas herramientas publicadas. El corte
anterior del importador conserva su [evidencia propia](invoice-ocr-review-defaults-20261116.md).

Adopción: Server y migración antes del Client. El flag inicia false también para
proveedores existentes; su habilitación posterior es explícita y conserva mapeos.
La aplicación operativa de la migración y aceptación humana no se acreditan aquí.
