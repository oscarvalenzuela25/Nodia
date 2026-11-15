# Producto creado desde POS → venta actual — 2026-11-14

Ampliación explícita del usuario posterior al primer corte de registro POS.
[Plan94§40](../mvp/94-business-point-of-sale-and-product-refactor.md#40-añadir-el-producto-recién-guardado-a-la-venta-actual--solicitud2026-11-14)
sustituye únicamente el reescaneo tras guardar: éxito completo incorpora una
unidad a la misma venta local y limpia/enfoca el lector. Cancelación, errores y
contextos distintos no añaden partidas. Los recibos de§39 son históricos y no
demuestran autoadd.

Rama `codex/nodia-ai-chat-space-gpt-selection`. No hay migración ni cambio de
Server. El precio efectivo/origen proceden de productResponse/catalogPrice,
el guardado final de useDeferredProductSave y la aceptación de addCartProduct/
motor local de venta. No se confirma/cobra la venta ni se inventa un precio.

## Regresiones focales

57pruebas/3archivos correctos: ProductModal, wrapper nativo y SalesWorkspace.
Callback sólo después del resultado completo de saving.save; separado de
cancelar. Callback pendiente/rechazado no repite POST, y una segunda llamada
del mismo registro no incrementa cantidad. Carrito previo2000 intacto más
producto1200 produce3200, dos partidas con cantidad1 y lector limpio/enfocado.
Se comprueba aceptación del motor local, hidratación exacta de un resultado
histórico sin proyección, error de GET, producto no disponible y setLines=false;
en esos rechazos no se altera carrito y se informa catálogo guardado.
Contexto obsoleto ignora la lectura/callback/cierre tardíos.
Lint focal y diff-check correctos.

Fuentes probadas SHA256:

- SalesWorkspace: `7bca037487e21a39ab03ea0253bdf26942d842512d5f86e754442dc33af267cb`.
- ProductModal: `ec0cf9534c3cc60b1d73e33e8aff6c243f22be142baace4919d9f6a218e1bf3c`.
- PosProductRegistration: `75cd412dbfcc56fc846b869677f6659135f7fcb344cfe1fbb2e573e897afe818`.

## Navegador aislado

320×900 ES/dark y1280×900 EN/light, Edge/Chromium headless Windows; geometría
previa del modal288/640px y documento320/1280px sin overflow. Barcode255con
ceros iniciales exacto.400de creación conserva nombre/barcode/precio/borrador
sin incorporar; doble click en reintento produce un único éxito (2POST totales
incluyendo400), dos partidas/cantidades1/1 y3200sin reescaneo. No/cancelar sigue
sin agregar. Lector limpio y enfocado al terminar.

Respuesta actual decorada requiere0GET adicional. Resultado histórico sin
precio exige1GET del ID exacto; si también carece de precio, no se inventa ni
se repite alta, informa guardado/no agregado y conserva una partida/2000.
CREATEA retenido, desmontaje deA y montaje deB con carrito propio, liberación
tardía deA: carritoB permanece con una partida/2000 y no recibe el producto.
La prueba de callback duplicado es unitaria; el navegador comprueba doble click
real. No se presentan como una garantía de atomicidad entre catálogo y venta.

Resumen/capturas intermedios en `output/playwright/pos-registration-auto-add/`,
inspeccionados visualmente y con hashes de fuentes coincidentes. Navegador y
Vite5196 propios cerrados, puerto/procesos ausentes. Advertencia transitoria
aria-hidden/foco conocida del modal; cero errores de aplicación en navegador
fresco. Fallos iniciales de un reset del harness y localizador de fondo oculto
se corrigieron sólo en la fixture y se repitió el escenario en navegador fresco.
Sin certificación global de accesibilidad.

Toda petición fue interceptada por adapter sintético, Vite sin proxy y red
externa/API bloqueada. Sin DB, producto/venta/proveedor reales, credenciales,
CUA, túneles o lector/teléfono/teclado virtual físicos. Suite global/build y
adopción sólo Client en VM se consolidan debajo, con recibo separado.

## Cierre local

Suite global Client2994pruebas/362archivos correctos,274,13s, sobre fuente final
sin cambios posteriores de runtime. Build con TypeScript y lint global del
código correctos. Lint excluye `.tmp/**`, manteniendo el fallo previo de un
experimento ignorado; no se presenta ese experimento como código entregable.
Los57focales no se suman a2994como casos únicos. Sin nuevos tests/SQL de Server:
el cambio consume contratos existentes y preserva su comportamiento.

## Adopción sólo Client en VM de development

Freeze fuente Client SHA256
`fcb48d9b20b42291b58d70d7b43163afdc37e613357af48fe8c505d1b23b096f`;
dist `53693072dc92d9c0a4d77d044b1e13e6757c8b0343ce50ef56e68c1313a6362a`;
paquete `b4c9b7a2745d68da39d495eedb71e60ec0b5039c8bd048c1e8ea54f2b61e3324`,
2513969bytes. Tres fuentes coinciden con los hashes probados anteriores.
Las notas documentales finales posteriores no reconstruyen ni readoptan paquete.

Una captura de preflight sobre la release POS anterior, staging inmutable y
activación CAS, un reload.213/213recursos nuevos exactos,212históricos
direccionables por HTTP y213anteriores exactos en disco; el HTML raíz es nuevo.
Nginx6b6dae3e…447e→e755430e…d54b, copia anterior exacta local y rollback
preparado/no ejecutado. Server, procesos/PID/startticks/unidades/env y timers
exactamente iguales a preflight; API200 y Teacher anónimo401. No hubo SQL ni
consultas/recomparación de filas, reinicios, venta/producto/proveedor/login/JWT
o respaldoDB/perfiles duplicado: sólo estáticos/Nginx reversibles.

[Recibo operativo](pos-create-autoadd-client-development-vm-20261114-r01.json).
Sin CUA, túneles o UI autenticada VM/lector físico. No cambia producción ni los
fallos y desfase de reloj preexistentes del laboratorio. Catálogo de recuperación
conserva la release previa y sus dependencias de estáticos/runtime intactas.
