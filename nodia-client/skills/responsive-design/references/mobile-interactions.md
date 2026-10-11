# Contenido e interacción móvil

## Listados y comparación

Seleccionar presentación con datos y tareas reales:

| Necesidad | Presentación razonable | Garantía que conservar |
| --- | --- | --- |
| Leer o actuar sobre un registro | Tarjeta/lista con jerarquía propia | Identidad, campos esenciales, estado y acciones |
| Comparar valores entre registros | Tabla con scroll local | Cabeceras, alineación, precisión y navegación |
| Entender relaciones temporales | Calendario adaptado y alternativa de listado cuando aplique | Fechas, contexto y acciones autorizadas |
| Ver totales o tendencias | Panel/gráfico adaptable | Mismos agregados, período y ámbito |

Una tarjeta no es cada celda de tabla apilada. Elegir título, estado, campos que cambian decisiones y acción principal; ofrecer el detalle existente para el resto. No hacer toda la tarjeta un enlace que contenga botones anidados. Separar destino de navegación y controles de acción con semántica apropiada.

Mantener un único fetch y estado de búsqueda/filtros/página fuera de la representación. Si se renderizan variantes, evitar IDs duplicados, elementos ocultos enfocables y dos árboles interactivos activos. Cambiar ancho u orientación no debe reiniciar formulario, selección ni consulta. No disparar lecturas de detalle por cada tarjeta ni obtener todos los registros para paginar en cliente.

En tablas con scroll, mantener paginado y barra de herramientas fuera del área que se desplaza horizontalmente. No reducir fuente ni aplastar columnas para conseguir que todo quepa. Comprobar también menús que podrían quedar recortados por overflow.

## Búsqueda, filtros y acciones

- Apilar controles cuando el ancho no alcance; dar ancho completo a la acción principal según las reglas del proyecto.
- Mantener filtros aplicados y forma visible de quitarlos. Wrapping de chips suele ser preferible a una fila que expanda el documento.
- Si filtros avanzados pasan a un modal/panel inferior, conservar valores, semántica de aplicar/cancelar y contador coherente con el contrato. Usar el componente existente antes de crear un sheet.
- Conservar debounce y paginación del servidor. El cambio de presentación no cambia el conjunto buscado ni el significado de seleccionar todos.
- Distinguir ausencia de registros de ausencia de coincidencias; ofrecer limpiar filtros cuando corresponde. No presentar un error de red como vacío.
- Permisos y estados ocupados deben afectar por igual tarjetas y tablas. Una versión móvil no puede ofrecer una acción bloqueada en escritorio.

## Controles táctiles y dispositivos híbridos

El objetivo recomendado de 44 × 44 CSS px corresponde al área activable, no al icono. Verificar la caja real y que ampliar su hit area no invada otra acción. Separar acciones destructivas de la principal según el patrón de producto.

`pointer` y `hover` describen capacidades del dispositivo primario; `any-pointer` y `any-hover` pueden servir para entradas adicionales. No asumir que `pointer: fine` excluye una pantalla táctil. Mantener accesible la acción mediante toque/clic y teclado; hover puede enriquecer su presentación.

Para controles gestuales, proporcionar una alternativa sin arrastre y gestionar `touch-action` según su eje. No usar `touch-action: none` en toda la página ni deshabilitar zoom para facilitar un control. Probar tanto el gesto del control como el scroll de la página al comenzar sobre él. Usar elementos nativos antes de replicar sus handlers.

## Formularios y modales

- Una columna de campos como base, agrupados por tarea; añadir columnas solo si la asociación sigue siendo clara.
- Labels asociados y errores junto al campo; placeholder no reemplaza al label. Asegurar que nombres largos y helper text no queden cortados.
- Elegir `type`, `inputMode`, `autoComplete` y `enterKeyHint` según el contrato. Códigos, teléfonos e IDs con ceros iniciales no se convierten a número por comodidad.
- Mantener reglas monetarias/fechas del proyecto; un teclado decimal no define separador, escala ni validación del servidor.
- El modal debe permitir alcanzar todos sus campos y acciones con viewport de poca altura, teclado abierto y texto ampliado. Evitar scrolls anidados innecesarios; reutilizar scroll lock, portal y foco del componente base.
- Conservar datos ante error HTTP, refetch o cambio de breakpoint. Cerrar automáticamente tras éxito confirmado; permitir cancelar explícitamente según el flujo.
- Si cambia entre dialog y panel móvil, conservar identidad y estado del formulario. No remontar dos formularios para cambiar la posición del mismo contenido.

## Navegación fija y contexto

Preservar arquitectura de información, historial y links directos. Usar enlaces para navegar y botones para actuar. Mantener nombre completo accesible, indicador de ruta activa y retorno de foco al cerrar menú/dialog.

Una barra inferior solo se añade si la tarea/producto la necesita. Reutilizar la existente cuando la haya. Reservar su espacio incluido safe area y comprobar último registro, paginado, toast y menús. Revisar también navegación con teclado virtual y orientación horizontal.

## Estados remotos

Aplicar la política de carga/feedback del proyecto sin cambiarla por tamaño de pantalla. Contenido previo estable durante revalidación; controles dependientes bloqueados mientras corresponde; vacío informativo y error recuperable. El toast debe ser legible en pantalla estrecha y no tapar la acción relevante.

Ante conectividad deficiente, conservar la intención y los valores. No repetir automáticamente una escritura con resultado incierto ni mostrar éxito por mera desaparición del spinner. Responsive no exige implementar un modo offline que el producto no contempla.
