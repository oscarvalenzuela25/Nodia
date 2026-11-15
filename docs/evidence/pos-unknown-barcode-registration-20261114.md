# Registro desde el lector POS — 2026-11-14

Este recibo conserva el corte que exigía reescaneo tras crear. La ampliación
posterior de [autoadd](pos-product-registration-autoadd-20261114.md), solicitada
explícitamente, tiene fuente, QA y adopción separadas; no cambia estos resultados.

Solicitud adicional al alias de productos. Rama
`codex/nodia-ai-chat-space-gpt-selection`; no añade migraciones ni cambia Server.
La migración179366 y los respaldos de la entrega anterior conservan su recibo;
no se presentan como una prueba nueva de este flujo.

## Contrato

[Plan94§39](../mvp/94-business-point-of-sale-and-product-refactor.md#39-alta-de-producto-al-escanear-un-barcode-desconocido--solicitud2026-11-14).
Lookup por barcode exacto/negocio.404 `product:not_found` permite ofrecer alta;
un404 genérico, error HTTP o respuesta incompatible no significan producto nuevo.
Registrar abre ProductModal con barcode textual precargado y foco útil en nombre;
No/cerrar/cancelar limpia y devuelve foco al lector. Se conserva la asociación
explícita con un producto existente. Guardar producto usa el contrato de catálogo,
no modifica carrito ni confirma/cobra la venta; se vuelve a escanear para añadir.

Se conservan campos, borrador y recuperación tras error; no hay retry automático
de una escritura incierta. El contexto exacto y bloqueo síncrono evitan doble
lookup, respuestas tardías y acciones paralelas mientras los overlays están
abiertos. Sin nuevos permisos, herramientas IA o autoridad por Markdown.

## Regresiones focales

66pruebas/4archivos correctas: lookup exacto con ceros iniciales, doble Enter y
suspensión síncrona tras miss hasta cierre explícito;404 específico frente a
404genérico/403/500, respuestas200 inválidas/cruzadas, actor/sesión/negocio/venta
y salida/vuelta al mismo contexto. No/cancelar conserva carrito y devuelve
foco; alta real con adaptador aislado mantiene formulario tras error/reintento,
priorizando un journal incierto anterior sin repetir creación.

La QA con el transporte real del cliente detectó que el interceptor traduce
`response.data.message`. Se reutilizó su `getServerErrorCode` ya existente,
sin modificar configuración HTTP global, para reconocer product:not_found y
product:version_conflict. La recuperación409 consultó revisión vigente y
conservó diálogo/código: ningún retry automático, segunda confirmación explícita
con revisión nueva.19pruebas SalesWorkspace correctas tras ese ajuste; el caso
nuevo se repitió filtrado después de estabilizar su espera observable.
Hash de fuente SalesWorkspace final
`441d6611fd5f6fcf66f3e208b273e29cfc6db1e451a5f971fee216f5786e3fda`;
test final `c67fea6f28aa3a49d1b211ba11702225c28c5f270181f3e9bd6352caedb7b21b`.
Lint focal y diff-check correctos. Suite global/build y QA se consolidan debajo.

Estas pruebas usan transporte/actor/productos sintéticos; no acreditan
autorización HTTP, unicidad/concurrencia DB, lector físico, nueva inferencia o
venta real. No se ejecuta de nuevo Server/SQL: sus contratos no cambian.

## Suite, tipado y build

Suite global Client:2986pruebas/362archivos correctos,297,61s. Se inició antes
del último ajuste409; éste tiene sus19regresiones posteriores y el caso nuevo
revalidado por separado. No se suman ambas corridas como pruebas únicas.
El primer build detectó dos opciones `exact` no admitidas por los tipos de
Testing Library en las consultas nuevas. Se retiraron esas opciones (el nombre
string ya coincide exactamente):2regresiones del wrapper correctas, lint del
test y build final con TypeScript correctos. Runtime no cambió por ese ajuste.
Lint global del código correcto con `.tmp/**` excluido, conservando el fallo
previo del experimento ignorado del alcance anterior.

## Navegador local aislado

Edge157/Chromium157 headless Windows, ES/dark y EN/light a320/600/1280px.
Documento/scrollWidth320/600/1280; pregunta288px en320 y460px desde600,
modal nativo288/536/640px. Barcode255con000iniciales íntegro y envuelto,
nombre enfocado. No/X de pregunta y Cancelar/X del formulario limpian y devuelven
foco; Tab permite salir del lector sin un modal cerrado atrapándolo.

Un400 sintético conservó nombre/barcode/borrador al redimensionar. El reintento
explícito cerró tras éxito y no agregó una partida. Asociación final comprobada
tras recarga completa de fuente441d6611…:409traducido, GETproducto402/revisión2
y segunda confirmación expected_version2 frente a1inicial. Carrito de una
partida/cantidad1/total2000 intacto; ninguna petición de mutación de ventas.

Se reutiliza geometría del formulario: acciones44px enxs y36,5px desde sm.
Se observó un warning transitorio aria-hidden/descendiente enfocado al abrir;
foco final de nombre y retorno al lector comprobados, cero errores de consola
en la recarga final. No equivale a certificación global de accesibilidad.
Resumen/capturas intermedios en `output/playwright/pos-barcode-registration/`,
visualmente inspeccionados. Navegador temporal y Vite5196 cerrados.

Adapter interceptó todo HTTP; Vite sin proxy y red del navegador limitada a GET
estáticos locales. Sin navegador personal, credenciales, CUA, túnel, proveedor,
DB, escrituras reales o lector/teléfono/teclado virtual físicos. Los recibos de
UI local y adopción estática VM tienen alcances separados.

## Adopción sólo Client en VM de development

Freeze fuente Client SHA256
`d4417d56b240a0cf30b87f4a292365083c94977d700c280e2650248ab564733a`;
dist `3d569af059007020557f8681452721dd934ab2c1431e9d8d80935c6133c64dce`;
paquete `d639f9cee62d955f0b1b74ee7322983ee31245ba0b66a97c95701e61e50405b7`,
2513090bytes. Código final SalesWorkspace coincide con el hash probado.
Notas documentales de cierre posteriores al freeze no se reconstruyen/adoptan.

Nueva release estática inmutable, copia exacta de Nginx y release anterior
conservada; activación única con CAS/pins y rollback explícito preparado.
213/213recursos nuevos exactos,212históricos direccionables por HTTP y
213anteriores intactos en disco: el HTML raíz es de la nueva release, no se
presenta como recurso histórico servido.62rutas hash nuevas frente a62antiguas.
Un reload, procesos/entorno/unidades/pins/timers intactos, sin reiniciar Server,
worker o keyrings ni modificar DB/perfiles. No se repite el respaldo562MB de la
fase anterior: permanece restaurado y válido para DB/runtime sin cambios; esta
operación guarda Nginx exacto y conserva todos los estáticos necesarios para
recuperar la release anterior. Rollback preparado, no ejecutado.

[Recibo operativo](pos-barcode-client-development-vm-20261114-r01.json).
Cero escrituras de ventas/productos, inferencias, logins o JWT durante adopción;
sin CUA, navegador personal o túnel. La UI de VM autenticada/lector físico
requiere revisión humana; la QA sintética local anterior no acredita ese flujo.
Producción sin cambios. Fallos previos de Gemini, backup principal y desfase de
reloj conservan su diagnóstico anterior y no se modifican por esta entrega.
