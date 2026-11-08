# Presentación y revisión humana de propuestas NodiaAI

Estado técnico: Client R38 adoptado en la VM, con pruebas y QA sintética/autenticada verificadas por su alcance. El documento sigue en revisión; no constituye aprobación documental ni publicación.

La tarjeta de propuesta resume título con icono, estado, revisión y fechas recibidas del servidor. El evento de observación de esa propuesta utiliza la misma cabecera compacta; los demás resultados de herramientas o ejecuciones conservan su presentación existente. El control outlined de 44 px permite abrir o plegar el contenido; no confirma ni ejecuta. Los datos desconocidos siguen desconocidos: no se completan fechas, estados o cantidades por su apariencia. Una propuesta confirmada acredita admisión de la confirmación; no acredita por sí sola un efecto aplicado. El resultado efectivo permanece en el recibo de ejecución.

## Antes y después

La revisión muestra el valor anterior y el nuevo con etiquetas visibles. En un contenedor ancho se comparan lado a lado; por debajo de 560 px se apilan sin cambiar su contenido. Un campo ausente tiene una representación compacta basada en los flags de presencia del servidor; no equivale a un null real. Cero, false, strings, identificadores, arrays y objetos conservan sus valores y tipos.

Las etiquetas de campos y enums conocidos de presentación son legibles y se presentan recursivamente. Los identificadores y strings arbitrarios no se traducen ni se convierten. Las etiquetas de preparaciones históricas de ventas sólo describen el historial; no habilitan preparar o ejecutar ventas mediante NodiaAI. La política de [ventas/reportes sólo lectura](../../mvp/94-business-point-of-sale-and-product-refactor.md#26-nodiaai-ventas-y-reportes-de-solo-lectura--r17-2026-10-30) permanece vigente.

## Detalles y acciones

La identidad, hash y catálogo exactos permanecen disponibles en un bloque técnico plegable. Plegarlo no elimina ni sustituye el contenido. El resumen y las etiquetas de presentación no cambian la propuesta normalizada, su revisión, hash o la autoridad para actuar.

Confirmar o guardar se presenta como acción contained; editar y cerrar como outlined. Cada acción conserva sus requisitos, handlers y confirmación humana exacta. El modelo no recibe autoridad para pulsar el botón ni ejecutar por el mero hecho de mostrar una tarjeta. Las escrituras comerciales siguen sus permisos y revisión vigentes.

## Borrador y recuperación

Abrir por primera vez carga la vista previa por intención. Corregir propuesta abre el editor disponible. Tras visitar la vista previa, plegar la conserva montada y oculta, junto con el editor si ya estaba abierto; no reinicia su borrador. Durante carga/reconsulta de propuesta o revisión, mutación o resultado humano incierto, se inhiben los controles afectados, incluido el plegado de cabecera. Un error conserva el editor y sus datos para revisar o recuperar el resultado con la identidad original; no provoca replay.

Referencia de autoridad: [contratos41](../../mvp/41-nodia-ai-v1-contracts.md), [plan45](../../mvp/45-nodia-ai-implementation-plan.md) y [publicación52](../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md). La evaluación visual no modifica permisos, grants, capacidades, herramientas o el registro ejecutable; tampoco acredita una inferencia o efecto comercial.

## Verificación y límites

Pasaron 218 regresiones en 4 archivos (los 9 casos del helper están incluidos), tipos/lint globales y build aislado de 1401 entradas/185 outputs. Los últimos ajustes sólo visuales posteriores a esa corrida se revisaron sin cambio de lógica; tipos/lint finales cubren los pins finales, sin afirmar otro rerun de las 218 pruebas. QA sintética ES/EN y claro/oscuro verificó comparación, borrador, teclado y valores; QA autenticada de una propuesta expirada verificó sólo lectura, hash completo y plegado. A 320 px, documento de 310 px, región de 212 px sin desbordamiento y control de 212×44 px. La operación estática hizo una activación/recarga Nginx, verificó 185 outputs y assets de 20 versiones anteriores, miss404 y API200/401; no reinició Server/Native ni emitió SQL o solicitudes de proveedor. Las lecturas autenticadas del navegador son un alcance separado. No hubo mensajes IA, confirmaciones o mutaciones comerciales en esa QA; pestaña/borrador originales intactos. No se ha probado un teléfono físico ni una nueva escritura comercial mediante esta evaluación. [Evidencia consolidada](../../evidence/nodia-ai-proposal-ui-20261107-r01.json).
