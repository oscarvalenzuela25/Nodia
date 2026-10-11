# Patrones de implementación

Aplicar solo los patrones necesarios. Adaptar ejemplos al sistema de estilos y tokens existente; no copiar dimensiones a ciegas.

## Contracción y distribución

Un hijo Flex/Grid puede conservar su ancho mínimo intrínseco aunque el padre mida 100%. Revisar el ancestro que impide contraerse, no solo el texto que desborda.

```css
.content { min-inline-size: 0; }
.panels {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  row-gap: var(--panel-row-gap);
  column-gap: var(--panel-column-gap);
}
.record-name { overflow-wrap: anywhere; }
.media { max-inline-size: 100%; block-size: auto; }
```

Usar `overflow-wrap` para identificadores/URLs; permitir wrapping normal para prosa. Aplicar ellipsis solo cuando exista acceso al valor completo por una interacción disponible también en móvil. Un tooltip por hover no lo garantiza.

Para una colección de tarjetas con ancho mínimo justificado por su contenido:

```css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: var(--card-gap);
}
```

No aplicar este patrón a listados que requieren una sola columna en móvil. No usar `width: 100vw` dentro de una página con padding, sidebar o scrollbar; preferir el ancho del padre. Usar `max-inline-size` para limitar líneas de lectura amplias sin añadir otra capa de padding exterior.

## Viewport o contenedor

- **Viewport:** shell, navegación, padding de pantalla y elección de representación de una página.
- **Contenedor:** una tarjeta o panel que cambia según el espacio recibido en un modal, sidebar o columna.
- **Sin query:** Flex con wrapping o Grid intrínseco cuando el contenido ya se distribuye correctamente.

```css
.record-slot {
  container-type: inline-size;
  container-name: record;
  min-inline-size: 0;
}
.record-content { display: grid; gap: var(--record-gap); }
@container record (min-width: 28rem) {
  .record-content { grid-template-columns: minmax(0, 1fr) auto; }
}
```

El elemento consultado debe ser descendiente del contenedor; una query no permite que un elemento se consulte a sí mismo. Evaluar cómo el containment afecta el dimensionamiento intrínseco. Mantener una presentación base válida y comprobar soporte con la política de navegadores instalada. Evitar un observador de resize si CSS basta.

En MUI, usar `sx` con claves de breakpoint o `theme.breakpoints` en `styled`. Si la versión instalada ofrece helpers de container queries, confirmar su API antes de usarlos. En Nodia: `down("sm")` representa xs; `down("xs")` no significa móvil.

## Tipografía fluida

Conservar la familia y escala del theme. Para un título que necesite crecer de forma gradual, un ejemplo es `font-size: clamp(1.5rem, 1rem + 2vw, 2.5rem)`. Verificar zoom y texto real: tener términos en rem no garantiza por sí solo crecimiento suficiente. No introducir un generador de escala ni modificar la raíz de rem por un único componente.

Los espacios de pantalla y entre paneles pueden ser discretos según tokens. No sustituirlos por una escala fluida si el proyecto ya prescribe 16/24/32 px u otros valores.

## Altura, safe area y teclado

- Usar altura según contenido para páginas; evitar `height` rígido que corte formularios. `min-height` permite crecer.
- `svh` representa el viewport pequeño y ofrece una base estable ante barras del navegador; `dvh` acompaña su variación y puede provocar relayout. Elegir según el componente, con fallback conforme al soporte requerido. `lvh` puede dejar contenido bajo las barras.
- El teclado puede reducir el viewport visual sin reducir el viewport de layout. `dvh` no es una garantía de adaptación al teclado. Probar la implementación y reutilizar el observador de `visualViewport` existente si hay elementos fijos afectados.
- Con `viewport-fit=cover`, considerar los cuatro insets, incluyendo orientación horizontal. Un responsable por borde aplica `env(safe-area-inset-*, 0px)`; evitar contarlo dos veces.
- Compartir entre barra fija y contenido el token de espacio reservado. Mantener el fondo en el área segura y revisar z-index del theme, overlays y avisos sin recurrir a valores enormes.
- El control enfocado y la acción de guardar deben poder entrar en el área visible; usar scroll-padding/scroll-margin cuando corresponda. No bloquear el scroll general para enmascarar un problema de altura.

En Nodia, reutilizar `MOBILE_NAV_RESERVED_HEIGHT`, la reserva de `PageContent` y la lógica de teclado de MobileBottomNav; no copiar su altura a cada página ni añadir un detector distinto.

## Imágenes y otros medios

1. Confirmar que las variantes realmente existen. No inventar parámetros de transformación de un servidor/CDN.
2. Reservar proporción con atributos `width`/`height` reales o una relación de aspecto conocida; mantener `max-width: 100%` y altura apropiada.
3. Usar `srcSet` con descriptores acordes a los archivos y `sizes` que describa el ancho renderizado, descontando padding/columnas. Usar `picture` para diferentes recortes o formatos, con fallback.
4. Diferir imágenes fuera de pantalla. No poner `loading="lazy"` a la candidata LCP; usar prioridad alta únicamente cuando exista esa necesidad comprobada.
5. No recortar comprobantes o documentos con `object-fit: cover`; puede ocultar información. Usar `contain` o un visor cuando la tarea exige leer el documento completo.
6. En gráficos, adaptar etiquetas/leyendas sin eliminar datos relevantes; mantener alternativa textual o en tabla cuando corresponda. Un scroll local intencional puede ser mejor que reducir todo a ilegibilidad.

No asumir que ocultar la versión de escritorio elimina la descarga. Revisar red y DOM para evitar medios, listeners o vistas pesadas duplicados.
