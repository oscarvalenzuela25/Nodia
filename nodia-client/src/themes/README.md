# Temas de Nodia y presets tweakcn

Catálogo local de 44 opciones: Nodia predeterminado y los 43 temas integrados de
[tweakcn](https://tweakcn.com/editor/theme): 42 presets nombrados más su Default.
La fecha de adquisición de esta revisión es 2026-11-16. No incluye temas de
comunidad ni contenido asociado a una cuenta externa.

Fuente fijada: [jnsahaj/tweakcn, commit
a3b47b37cba97dd637de517aab52c45ec0f83456](https://github.com/jnsahaj/tweakcn/tree/a3b47b37cba97dd637de517aab52c45ec0f83456).
Los colores proceden de
[`utils/theme-presets.ts`](https://github.com/jnsahaj/tweakcn/blob/a3b47b37cba97dd637de517aab52c45ec0f83456/utils/theme-presets.ts)
y [`config/theme.ts`](https://github.com/jnsahaj/tweakcn/blob/a3b47b37cba97dd637de517aab52c45ec0f83456/config/theme.ts).
El [helper original](https://github.com/jnsahaj/tweakcn/blob/a3b47b37cba97dd637de517aab52c45ec0f83456/utils/theme-preset-helper.ts)
define la combinación de defaults y estilos parciales que reproduce el importador.
La licencia Apache-2.0 y la atribución se distribuyen en
[`public/licenses/tweakcn.txt`](../../public/licenses/tweakcn.txt), copiado por Vite
al build público.

## Contrato

Cada archivo con el nombre del tema exporta por defecto un `AppThemePreset` con
`id`, `name`, `light` y `dark`. Sus paletas son `PaletteOptions` de MUI y completan
los contratos Nodia `background.surface`, `text.inverse`, `tertiary` y `border`.
`index.ts` registra el catálogo y resuelve IDs desconocidos, ausentes o históricos
al tema Nodia. Los IDs son estables e independientes de los nombres mostrados.

La composición completa permanece en `MUIProvider`; todos los temas comparten la
tipografía, tamaños, radios, breakpoints, transiciones, componentes y scrollbars
de Nodia. El catálogo modifica colores. Las fuentes remotas, geometría, sombras,
spacing y estilos de componentes shadcn no se importan.

## Adaptación de los colores

| Fuente tweakcn | Destino MUI |
| --- | --- |
| `background`, `card`, `popover` | `background.default`, `paper`, `surface` |
| `foreground`, `muted-foreground` | `text.primary`, `text.secondary` |
| `primary` / `primary-foreground` | Color y texto de acciones principales |
| `secondary-foreground` | Acciones secundarias; la superficie neutral de shadcn no es un color de texto MUI |
| `accent-foreground` | Acciones `tertiary` |
| `destructive` / `destructive-foreground` | `error` |
| `border` | `border.default` y `divider` |

Success, warning e info conservan los colores semánticos de Nodia y reciben la
misma corrección de legibilidad. `action` deriva sus transparencias de los colores
del tema. Los colores de charts y sidebar de shadcn no habilitan nuevos contratos
MUI; la navegación existente consume las paletas compartidas de Nodia.

La conversión OKLCH → OKLab → sRGB D65, clipping y redondeo a 8 bits se realiza al
generar los archivos; la aplicación recibe colores hexadecimales compatibles con
MUI, incluido su uso en `alpha`, sin conversión CSS en el navegador. El importador
rechaza formatos que no reconoce, en lugar de sustituir colores silenciosamente.

Las paletas importadas verifican contraste WCAG de al menos 4.5:1 para texto normal
primario/secundario sobre las tres superficies; también para colores de acciones
y estados sobre esas superficies, incluso con el hover MUI de 4%/8%. Se conserva
el color de origen cuando cumple. Si falla, se mezcla lo mínimo necesario hacia
negro o blanco (objetivo 4.6 para margen de redondeo). El texto de botones usa el
foreground original si cumple 4.5; en caso contrario, negro/blanco. Las variantes
main/light/dark mantienen 4.5 con ese texto, incluido el hover contained.
Estas comprobaciones de tokens no certifican todas las combinaciones posibles de
componentes, gradientes, gráficos ni estados de la aplicación.

`nodia.ts` conserva las referencias exactas a las paletas anteriores. Hay
excepciones históricas de contraste en Nodia claro: texto blanco sobre secondary
`#14b8a6` ≈2.49:1, error `#ef4444` ≈3.76:1 y success `#22c55e` ≈2.28:1.
El primario original `#4f46e5` con blanco ≈6.29:1. Esta entrega conserva el tema
predeterminado solicitado; las garantías nuevas cubren los 43 temas importados.

## Regeneración y ampliaciones

Desde `nodia-client`, con sus dependencias instaladas:

```sh
node scripts/import-tweakcn-themes.mjs
npm run test -- src/test/themes
npm run typecheck
```

El [importador mantenido](../../scripts/import-tweakcn-themes.mjs) descarga sólo
los tres archivos de la revisión fija, valida sus SHA-256, combina defaults,
normaliza colores y utiliza `adaptTweakcn.ts` para generar paletas estáticas.
Incluye la licencia pública y el índice; no modifica `nodia.ts`. No ejecutar la
regeneración después de añadir temas manuales sin revisar el índice generado.
Actualizar la revisión requiere investigar el nuevo catálogo y actualizar sus
hashes; las pruebas verifican la integridad y legibilidad de las nuevas paletas.

Los archivos generados llevan colores ya corregidos para evitar búsquedas de
contraste al importar el catálogo. Comparación local Node 24.20.0, 12 evaluaciones
del bundle Rolldown ESM con MUI precargado: variante con adaptación en runtime,
47.0 KB /8.15 KB gzip y mediana 68.1 ms; variante estática elegida 145.99 KB
/15.88 KB gzip y mediana 12.1 ms (mínimo 7.3 ms). Son medidas de laboratorio sin minificar, no
latencias de navegador o rendimiento productivo. La variante runtime se descartó
por su mayor trabajo síncrono inicial.

Para un tema propio: crear su archivo `AppThemePreset`, exportarlo por defecto,
añadirlo al índice y comprobar ambos modos. `adaptTweakcn.ts` y `contrast.ts` son
herramientas de generación y pruebas; el catálogo final no las importa.
