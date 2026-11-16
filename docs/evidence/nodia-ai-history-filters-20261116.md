# NodiaAI: continuidad del historial y filtros — 2026-11-16

Alcance: [plan107§14](../mvp/107-nodia-ai-ux-ui-upgrade-plan.md#14-continuidad-del-historial-y-filtros--continuación2026-11-16),
continuación de NAIUX-001 en la rama actual `codex/durable-backend-uploads`.
Se conservan la implementación previa de historial compacto/burbujas y los
cambios locales de Teacher. Esta revisión añade claridad y recuperación de los
filtros existentes; no acredita una nueva adopción productiva.

## Resultado

- Vacío inicial y ausencia de coincidencias tienen textos distintos en ES/EN.
  El error mantiene aviso/reintento; la carga inicial no anuncia un vacío falso.
- Criterios activos y Restablecer permanecen junto a la búsqueda aunque los
  filtros avanzados estén plegados. El contador usa criterios locales reales,
  incluido ámbito sólo si el actor dispone de ese control.
- Defaults compartidos: búsqueda vacía, Sin archivar, sin Sólo fijadas y Mis
  conversaciones. Restablecer conserva chat, selección IA, mensajes y borrador;
  devuelve el foco al buscador y respeta el bloqueo durante revalidación.
- La lista expandida identifica el chat actual con `aria-current="page"`;
  Drawer móvil con nombre traducido, Escape y retorno de foco conservados.

Contrato de consulta contrastado con
`nodia-server/src/nodia-ai-conversation/dto/nodia-ai-conversation-query.dto.ts`:
search, is_archived, is_pinned, view y cursor mantienen su transporte. No se
implementa filtrado local de la página recibida en producción ni se descargan
todas las conversaciones. Una query anterior puede conservar páginas en caché;
la primera lectura al volver a sus criterios empieza sin cursor anterior.

## Verificación de comportamiento

ConversationHistory: 16 casos correctos, incluidas cinco regresiones nuevas de
vacíos, restablecimiento por teclado/foco, criterios/permisos, revalidación y
selección accesible. Prueba integrada existente de paginado ampliada para
restablecimiento, criterios transportados, Drawer con nombre y borrador/chat
conservados: correcta. El resto de la página se incluye en la corrida global.

La primera focal informó dos fallos en los nuevos checks: user-event rechazaba
clic sobre un botón disabled con pointer-events:none, y la expectativa de la
query restaurada asumía que la última lectura sería la primera página. Se
corrigieron las pruebas: evento sobre disabled sin callback, primera lectura
nueva sin cursor y posteriores páginas de caché conservadas. Un ajuste posterior
distingue cursor ausente de propiedad undefined; se comprueba su valor sin
exigir una clave no emitida por el servicio. La regresión integrada final pasó.
No se cambiaron contratos ni caché para satisfacer esas expectativas.

Suite global final `npm run test -- --maxWorkers=4`: **3034/3034 pruebas y
364/364 archivos correctos**,481,41s. Incluye el árbol local y sus cambios
preexistentes; no se atribuye todo ese alcance a las cinco regresiones nuevas.
`npm run typecheck`, lint completo de código con exclusión de `.tmp/**` ignorado
y `npm run build` (tsc-b+Vite) correctos. No se cambian reglas de lint o timeouts.
El build conserva el warning previo de chunks>500kB; no se afirma sin warnings.
La corrida global conserva avisos de APIs no implementadas en jsdom
(navegación, canvas y medios), sin fallos.

`knowledge:check` y `knowledge:build` correctos:95fuentes,51excluidas,
44documentos/46fragmentos. Release compilada sin variación
`9f7cb7e13becc051f1c90d6f2e0014eb18f78e4711a2a820971c38a2df4c77e8`.
Las fichas candidatas81/17 permanecen excluidas. Documentos UTF-8/LF sin BOM,
frontmatter JSON y `git diff --check` correctos.

## Navegador local con transporte sintético

Playwright CLI/Chromium, componentes y wrappers actuales, escenario optativo
`history-filters`. No hay llamadas a proveedor, API productiva o persistencia
comercial. El adapter sólo simula el límite de búsqueda para esta comprobación;
sus respuestas no acreditan autorización HTTP real.

| Viewport CSS px | Idioma/tema | Documento px | Restablecer ancho × alto px | GET tras buscar/restablecer |
| --- | --- | --- | --- | --- |
| 1440×900 | ES/oscuro | 1440/1440 | 95,27×44 | 9 |
| 900×900 | EN/claro | 900/900 | 55,36×44 | 9 |
| 899×900 | ES/oscuro | 899/899 | 95,27×44 | 9 |
| 390×844 | ES/oscuro | 390/390 | 95,27×44 | 9 |
| 320×568 | EN/claro | 320/320 | 55,36×44 | 9 |

En todos: sin overflow horizontal de documento, control dentro del viewport,
restablecimiento con Enter, foco de búsqueda recuperado, chat y texto
«Borrador QA conservado» intactos. Tres perfiles móviles verifican Drawer
«Conversaciones»/«Conversations», Escape y foco en Expandir. Los nueve GET
incluyen las lecturas iniciales y las consultas explícitas de búsqueda/reset;
ninguna mutación o inferencia. No son métricas de rendimiento.

Recorrido adicional: revalidación del historial falla con503 sintético teniendo
una fila previa; fila actual y borrador permanecen, no aparece vacío filtrado y
Reintentar recupera el panel. Sólo GET. Capturas desktop/móvil inspeccionadas;
scripts/capturas intermedios en `output/playwright/nodia-ai-history-20261116/`.
Los avisos previos de React setState durante render y Emotion first-child
permanecen; no se afirma una consola limpia.

## Continuidad y límites

Evaluación registrada en producto candidato81 y ficha17: navegación/presentación
de datos existentes, sin cambio de contexto, herramientas, conceptos de
autoridad o interpretación de resultados. Draft/unregistered/approval:null.
No se publica conocimiento, se amplía autorización ni se cambian proveedores.

Siguen pendientes NAIUX-07: uso autenticado/humano, teléfono/teclado físico y
adopción de las revisiones §13–14 por entorno. Una prueba de viewport no acredita
dispositivo físico o inferencia. No se repiten despliegues o turnos inciertos.
