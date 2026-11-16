# OCR manual: defaults y revisión por fila — 2026-11-16

## Alcance y procedencia

Solicitud del usuario y reglas vigentes en
[plan94§41](../mvp/94-business-point-of-sale-and-product-refactor.md#41-revisión-ocr-compacta-defaults-comerciales-y-selección-ia--solicitud2026-11-16).
Candidato local `codex/fixes-invoice-ocr`, creado desde `origin/development`
`d50dc4149018ba041149fafb25f4499391685298`, en worktree aislado; los cambios de la
rama original se conservaron. Esta evidencia registra implementación y pruebas
locales, sin adopción de VM/producción, inferencia o escritura HTTP comercial real.

Nuevo producto copia nombre al alias y comienza disponible; actualización carga
alias de catálogo, permite editarlo y omite disponibilidad. Venta inicial usa
`Math.round(cost_price_tax × 1.3)` CLP para filas nuevas/matches automáticos,
editable con lápiz. La vinculación manual conserva campos no elegidos. Cantidad
siempre junto a alias; disponibilidad y toggle retirados. Modelo/intensidad parten
de defaults persistidos por instancia/modo, con opciones comprobables del catálogo;
configuración y fixture no acreditan disponibilidad real del proveedor.

## Comprobaciones de Client

Tipos, lint y build finales de Client correctos; build14,68s. Advierte chunks
mayores de500KB, sin error. Las primeras focales completaron97casos/5archivos.
Tras añadir badge de modelo predeterminado y traducir intensidad, la primera
global dio3124correctas/1fallida: la aserción esperaba el texto anterior de la
opción. Se corrigió a la etiqueta exacta internacionalizada, conservando la garantía.

La segunda global pasó3125pruebas/378archivos en285,95s, iniciada a20:42:35
America/Santiago. Durante esa ejecución cambió la recuperación de disponibilidad:
«Comprobar disponibilidad» refresca verify y catálogo conjuntamente, conserva
archivo/instancia y no inicia reanálisis. La focal posterior del corte final,
iniciada a20:44:58, pasó124casos/10archivos en82,41s y cubre ese delta: catálogo
inicial unavailable,2GET de catálogo y2verify, recuperación sin reenviar OCR.
Por tanto, la global2 no se presenta como ejecución de todo el árbol final;
la focal final posterior aporta la comprobación específica del último cambio.
No se suman ambas corridas como si fueran pruebas diferentes.

QA Chromium con datos sintéticos y componente real, servidor de fixture sólo
loopback y sin API. Seis perfiles: ES/oscuro320,600,900,1440px;
EN/claro320,1440px. Capturas en `output/playwright/ocr-*.png` y harness temporal
en `.tmp/ocr-qa`, ambos ignorados; las capturas no entran en Git.

| Garantía observada | Resultado |
| --- | --- |
| Defaults de producto | Nuevo: alias igual a nombre y venta311 sobre bruto239. Existente: alias de catálogo conservado y venta1444 sobre1111; histórico1200 y cantidad histórica «—» alineados. |
| Layout | Sin desbordamiento horizontal del documento en los seis perfiles; ancho documento310 a viewport320 y1430 a1440 en EN. Scroll horizontal local: contenedor250/tabla1200 a320. |
| Precio y resize | Editor1440→320 conserva precio399 en borrador; acciones móviles256×44px. Guardar aplica399 sólo a la fila local. |
| Alias y teclado | Alias existente editado por teclado a «Alias revisado local»; conserva borrador320→1440. Guardar devuelve foco al lápiz. |
| Validación y cancelar | Precio−1 bloquea Guardar; Escape conserva399 y devuelve foco al lápiz. |
| Selección IA | Modelo/intensidadhigh predeterminados visibles en ambos idiomas/temas. Elegir «Modelo QA alternativo»/Low conserva ambos al redimensionar a320; cuatro selects únicos210×44px con documento310px. |
| Consola | Cero errores JavaScript; único error de navegador: favicon404 de la fixture. |

La sesión de QA se cerró y su servidor de fixture propio quedó detenido.
La QA no prueba teclado virtual, teléfono físico, autenticación real, ejecución
de un proveedor, atomicidad comercial ni persistencia de productos/factura.
Los tests focales usan fronteras externas simuladas; ningún resultado sintético
se atribuye a disponibilidad o inferencia real de IA.

## Conocimiento y pins locales

`knowledge:check`, build local y `test:nodia-ai:knowledge` verifican el candidato:
58casos,96fuentes/52excluidas,44documentos,
46fragmentos/153capacidades y2118enlaces locales. Los44archivos aprobados
completos permanecen intactos respecto de HEAD. Cambian sólo dos referencias
fuente de documentos publicados: plan94 en `businesses.point-of-sale-and-sales`
y helpers OCR en `nodia-ai.invoice-ocr-product-comparison`. El manifest incorpora
esos hashes aunque los textos publicados no cambien; requiere pins regenerados
por `build-nodia-ai-context.mjs`, sin editar registro ni fichas aprobadas.

Las candidatas Negocios/alias/calculadora conservan draft/unregistered y
approval:null. Validar y construir archivos ignorados no publica capacidades ni
despliega el release. Los pins generados de src/dist y el bundle ignorado se
regeneran mediante scripts soportados después de cerrar las fuentes. El resultado
del último check y release exacto se registra abajo, sin incorporarlo a plan94
para evitar que su propio hash cambie el manifest.

Check final:58/58 casos y verificador de corpus/enlaces/pins correctos;
release local `72af60b7b7cd36933041a5be2dde0b48398b89f3fcd0fbeb5879952994c67f83`,
catálogo `nodia-ai-business-pos/4`, schema
`cc93ecb978c5e74f6a3492661da8bcd4b4bdce0afc0da57efdc678ea21b1d23c`.
Src/dist apuntan al mismo bundle regenerado. No cambia el registro ni los
44archivos aprobados respecto del commit base.

El primer check de cierre rechazó metadata de la candidata Negocios al sumar
33referencias de evidencia frente al límite32. Se trasladó la referencia
histórica inicial a su cuerpo, conservando enlace/archivo y su alcance; el
check final pasó con el contrato intacto. No se amplió el schema para admitirlo.

## Primer pendiente real

Revisión e integración del candidato. Adopción y aceptación por entorno
permanecen separadas; la QA local no acredita cierre productivo.
