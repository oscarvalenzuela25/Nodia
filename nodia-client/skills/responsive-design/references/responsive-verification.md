# Verificación responsive proporcional al cambio

Elegir los escenarios afectados y ejecutar los checks exigidos por el proyecto. No instalar un runner ni reconfigurar CI por el solo hecho de invocar esta skill.

## Matriz de layout

Como base reutilizable: ancho mínimo soportado (320 CSS px si no hay otro definido), un móvil representativo, ambos lados de los breakpoints afectados, tablet y escritorio. Agregar orientación horizontal o altura reducida cuando existan modales/barras fijas. No convertir estos anchos en una lista de dispositivos ni en una garantía de compatibilidad.

En Nodia, para cambios amplios de shell/listados, reutilizar 320/360/390/430, 599/600, 768, 899/900 y 1280/1440 px; añadir otros bordes solo si el componente cambia en ellos. Alternar claro/oscuro y ES/EN en los casos que estresan más el diseño. Un ajuste acotado puede probar mínimo, borde afectado y regresión escritorio.

Verificar con contenido corto y largo, IDs/URLs sin espacios, importes reales de prueba, cero frente a ausencia y errores extensos. Las fixtures deben estar identificadas y aisladas del producto.

## Criterios observables

| Área | Comprobación |
| --- | --- |
| Documento | Sin scroll horizontal accidental; comparar scrollWidth/clientWidth y revisar elementos fuera del viewport |
| Scroll local | Tabla/diagrama desplaza su contenido; cabecera contextual y paginado siguen disponibles; ningún menú queda cortado |
| Contenido | Títulos, etiquetas y valores esenciales legibles; el texto completo relevante es accesible sin hover |
| Acciones | Hit areas medibles, sin intersecciones; acción principal alcanzable y bloqueo ocupado equivalente entre variantes |
| Breakpoint | Cambiar ancho conserva valores, selección, filtros y página; una sola representación interactiva y sin fetch nuevo innecesario |
| Teclado y overlays | Foco visible, orden coherente, Escape/cancelar y retorno de foco; control enfocado/última acción accesibles |
| Datos | Carga inicial, refetch con datos, vacío, error inicial y error de escritura distinguibles; editor preservado |
| Medios | Proporción reservada, variante cargada adecuada, documento sin recortes informativos |

Una medida global de overflow no detecta contenido recortado mediante `overflow: hidden`, colisiones ni botones cubiertos. Combinar geometría, inspección visual e interacción. No usar snapshots de clases como prueba de usabilidad.

## Zoom, texto y entrada

- Probar aumento de texto al 200% y reflow en 320 CSS px equivalentes (por ejemplo, viewport de 1280 CSS px al 400% de zoom). Son comprobaciones distintas; excepciones de contenido bidimensional aplican según el criterio W3C.
- No usar `user-scalable=no` ni `maximum-scale=1`. Revisar foco/labels ampliados y contenido final bajo barras fijas.
- Cuando haya gestos, probar el gesto completo y scroll que empieza sobre el control. Una captura o ancho reducido no demuestra entrada táctil.
- Para teclado virtual, navegador con barras dinámicas y notch, probar un teléfono físico si está disponible. Si no, registrar lo pendiente y entregar la evidencia alcanzable; no bloquear una entrega por hardware inaccesible.
- Estas comprobaciones apoyan el diseño; no declarar conformidad WCAG completa sin una auditoría correspondiente. En Nodia, respetar el alcance práctico de 07 y no introducir una certificación/auditoría global como condición de esta skill.

## Automatización existente

Tests de componentes cubren cambios de lógica: conservación del formulario al redimensionar, equivalencia de handlers/permisos, bloqueo ocupado y recuperación tras fallos. JSDOM no demuestra geometría ni media queries reales sin un entorno/mocking adecuado.

Si existe automatización de navegador, configurar viewport y, para interacción, contexto táctil con los parámetros soportados por el motor. El nombre de un preset no demuestra Safari real; registrar Chromium/Firefox/WebKit utilizado. Aprovechar la infraestructura disponible y las fixtures existentes.

En Nodia, las regresiones con lógica viven en `src/test` como espejo de `src`; ejecutar test/typecheck/lint y build cuando cambien imports, rutas, dependencias o integración. Para una edición exclusiva de instrucciones, comprobar frontmatter, enlaces, coherencia y ausencia de scaffolds; no ejecutar suites de aplicación sin motivo.

## Performance cuando el cambio la afecta

Medir carga inicial y red con el escenario declarado, revisar dimensiones/shift de medios y evitar duplicación de árboles, consultas o descargas. Si se modifica un listado largo o medio pesado, usar throttling o profiling disponible para comparar; no imponer virtualización por un número arbitrario de filas.

No atribuir latencia, consumo de memoria, Core Web Vitals aprobados ni preparación para producción a una captura. Distinguir laboratorio de mediciones de campo y describir condiciones del ensayo.

## Evidencia de entrega

Registrar ruta/flujo, ancho y altura, motor/navegador, tema/idioma, fuente de datos y tipo de entrada probado. Adjuntar capturas o mediciones útiles. Indicar checks ejecutados y pendientes concretos (por ejemplo, teclado Safari físico), sin presentar emulación como aceptación real del usuario.
