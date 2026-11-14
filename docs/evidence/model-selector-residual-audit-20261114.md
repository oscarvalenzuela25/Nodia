# Selector de modelos: corrección y revisión de residuos — 2026-11-14

Rama local `codex/unify-model-reasoning-selector`, base development `898aec84`.
Fuente funcional: [contrato de proveedores](../mvp/ai-provider-feature-contract.md#selector-de-modelos-y-auditoría-de-residuos--2026-11-14).
No hay inferencias, cambios de configuración operativa, seed/migraciones,
credenciales leídas, publicación o despliegue en esta comprobación.

## Inventario de consumidores

| Consumidor | Hallazgo y resultado local |
| --- | --- |
| ProviderDetail | Ya agrupaba variantes inequívocas Gemini Agentic con IDs reales. |
| SyncModelsModal | Listaba variantes directamente en catálogo/roles/contadores. Corregido por familia; conserva todas las variantes y permite elegir esfuerzo por rol. |
| ComposerSelection | Residuo de listado plano. Usa opciones compartidas; esfuerzo cambia a ID real con elegibilidad exacta independiente. |
| ConfigurationDrawer | Mismo residuo y corrección que el compositor. |
| Teacher SelectionPanel | Ya agrupaba. Extraído algoritmo a `src/utils/modelVariantOptions.ts`; wrapper mantiene exports y reglas. |
| ProviderCard | Resumen de selecciones literales; no enumera opciones. Sin cambios. |
| ProductInvoiceImport/aiSelection | Selecciona conexión/modo y consume el modelo configurado literal; no enumera opciones. Sin cambios. |

La búsqueda se acotó a selectores y consumidores del catálogo del Client actual;
no es una garantía sobre componentes que se incorporen posteriormente. Los IDs
base de presentación nunca se usan como modelos ejecutables ni se hardcodean
versiones. API/OpenAI y familias ambiguas conservan sus opciones individuales.

## Garantías verificadas

- Activar una familia conserva todos sus IDs en `available_models`; búsqueda y
  selección masiva operan sobre la familia completa sin borrar otras selecciones.
- Principal y OCR conservan IDs independientes. Al cambiar el esfuerzo general
  se fija la preferencia OCR previamente heredada para conservar su tupla efectiva.
- Un OCR quitado se serializa como `null`. Los esfuerzos se parchean en el modo
  que dispone de merge Server; no se sobrescribe el mapa raíz de otra sesión.
- Guardado fallido conserva selección/esfuerzo; dos submits pendientes producen
  una petición. Resolver una escritura de A después de abrir B no cierra B.
- Descubrimiento vacío, ausente/inválido, servicio caído y contradicciones
  históricas tienen regresiones; la lectura no repara una preferencia contradictoria.
- El chat exige esfuerzo explícito al elegir una nueva familia y elegibilidad
  de su ID/esfuerzo exactos. No transfiere un resultado de otra variante.

## Checks ejecutados

- Suite global Client: **2.912 pruebas / 355 archivos**, sin fallos. Ese pase
  comenzó durante el lote; los ajustes finales del modal/helper se verificaron
  después en **29 pruebas / 2 archivos**, sin fallos, incluyendo preferencias
  históricas sin modo predeterminado.
- Helper compartido, wrapper Teacher, ComposerSelection y ConfigurationDrawer:
  **41 pruebas / 4 archivos**, sin fallos. Helper de tarjetas existente: cinco
  pruebas correctas en el primer corte.
- TypeScript/build Client correctos. Lint del código correcto con
  `npm run lint -- --ignore-pattern '.tmp/**'`. El comando general detecta un
  experimento previo ignorado en `.tmp/teacher-upgrade-browser/main.tsx` por
  `react-refresh/only-export-components`; no se cambia ese experimento.
- `git diff --check` y UTF-8/LF comprobados para los archivos modificados.

## Navegador local

Fixture `src/test/manual/ai-providers/index.html`, Axios totalmente interceptado;
sesión/identidad/catálogo sintéticos, sin backend o proveedor real. Chromium de
Playwright CLI, ES oscuro, viewports320×900,600×900 y1280×1100. Una tarjeta de
familia y dos roles; High→Medium del principal conserva OCR High. Redimensionar
conservó Medium/High y no añadió sincronizaciones o guardados. El único POST
observado fue la sincronización sintética `persist=false`.

Geometría del documento: clientWidth/scrollWidth320/320,600/600 y1280/1280.
Modal móvil288/288; los selectores de esfuerzo midieron196×44px. Capturas
auxiliares en `output/playwright/model-selector-320-dark-es.png` y
`model-selector-1280-dark-es.png` (ignoradas, no dependencias operativas).

EN claro1280×1100 también mostró una familia, ambos roles High y todos los
controles traducidos, con documento1280/1280. Captura auxiliar
`output/playwright/model-selector-1280-light-en.png`. La comprobación
`knowledge:check` pasó:91fuentes/47excluidas,44documentos/46fragmentos, release
`d48640fe7ff6515aa049a63d62037dbd94f3b68a366a1229d181e5641abd0fb1` conservado.

No acredita teléfono físico, todas las modalidades/selecciones reales,
inferencia, autorización o atomicidad de PostgreSQL. El guardado y los fallos
se comprobaron con transporte sintético; Server y sus contratos no cambiaron.

## Consulta independiente del seed

Se revisó el flujo del rol real `super_admin`, CLI/HTTP, login y autorización.
Resultado documentado en [instalación](../mvp/database-installation.md#configuración-inicial-del-superadministrador--consulta-de-código-2026-11-14).
Se aclararon dos frases históricas: baseline y bootstrap no tienen el mismo
comportamiento sobre registros previos; cuatro asignaciones materiales no
limitan el bypass vigente del superadministrador al catálogo activo. Inspección
de código/documentos solamente; no se ejecutó el seed ni se cambió el backend.
