# Teacher — primera entrega de alta guiada, 2026-11-15

## Alcance y procedencia

Solicitud: crear una rama desde development y empezar el nuevo UI de Teacher
desde TODO. `codex/teacher-guided-ui` parte de `origin/development` actualizado
`ae35b02e`, con árbol inicialmente limpio. [Plan106§10](../mvp/106-nodia-teacher-guided-ux-redesign.md#10-primera-entrega-local--solicitud-de-desarrollo2026-11-15)
registra la autorización posterior al corte exclusivamente documental.

Primera entrega TUX-02: alta3pasos, mínimos/organización/contexto opcional,
resumen plegable y selección IA explícita en revisión, retroceso sin perder
campos o selección parcial y salida SPA/recarga protegida. Comandos existentes
separan borrador/propuesta; error conserva datos/modal y unknown sólo concilia.
No cambia Server, DB, rutas/permisos, proveedores, credenciales o capacidades.

Código: TeacherNew, useStudySetup y SessionFields. Traducciones ES/EN y fichas
candidatas coherentes. Revisión independiente de contratos Server, recuperación
y riesgos formulario/selector/router; integración final común. Las regresiones
de página existentes se conservan por esos riesgos entre unidades, sin añadir
una suite de toda la sección Teacher.

## Verificación técnica

- `npm run build`: correcto; incluye `tsc -b`. Advertencia de chunks mayores
  de500KB conservada, sin elevar el límite ni cambiar configuración.
- Focales de alta, campos, selección, comandos y ruta:49/49 en5archivos.
  Las10 del alta incluyen jornadas nulas válidas y contexto inválido plegado
  que se abre/recibe foco, además de errores/doble envío/salida.
- Suite Client completa:2999/2999 en362archivos, correcta (231,09s).
  Primera corrida:2996correctos y1fallo por la etiqueta histórica del título
  sin «opcional»; se actualizó esa expectativa preservando campos/payload.
  Los5casos de SessionFields pasaron después en la focal.
  Tras bloquear también el acordeón de resumen durante mutaciones,10/10 del alta,
  build/tipos y lint del código se repitieron correctamente.
- `npm run lint -- --ignore-pattern .tmp/**`: correcto para el código.
  `npm run lint` sin exclusión encuentra4errores en fixtures previas ignoradas:
  `.tmp/pos-registration-auto-add-qa/main.tsx` (2variables sin uso),
  `.tmp/product-alias-qa/ocr.tsx` y `.tmp/teacher-upgrade-browser/main.tsx`
  (Fast Refresh sin exports). Esos experimentos ajenos permanecen intactos.
- `npm run knowledge:check`: correcto;95fuentes,51excluidas,44documentos/46fragmentos publicados conservados, sin publicar borradores.
  UTF-8/LF, enlaces locales y43claves wizard ES/EN comprobados.

## Chromium: componentes reales con transporte sintético

Harness temporal `output/teacher-guided-ui`: TeacherNew/SelectionPanel, RHF,
QueryClient, MUIProvider, traducciones y PageContent reales. Actor/conexión/modelos
son fixtures identificadas; Axios utiliza adaptador sintético. Sin HTTP externo,
API operativa, inferencias, credenciales o datos reales. Destino de sesión
sintético; sin montar BaseLayout/sidenav/topbar/MobileBottomNav completos.
La reserva inferior sí procede de PageContent.

| Viewport | Idioma/tema | Ancho documento: paso1/paso2/revisión | Formularios | Lecturas IA por paso |
| --- | --- | --- | --- | --- |
|320×1000 |ES/oscuro |320/320/320 |1 |0/0/2 |
|600×1000 |EN/claro |600/600/600 |1 |0/0/2 |
|900×1000 |ES/claro |900/900/900 |1 |0/0/2 |
|1440×1000 |EN/oscuro |1440/1440/1440 |1 |0/0/2 |

Cambiar viewport/tema y revisión→objetivo→revisión conserva valores sin remontar
selector ni disparar consultas nuevas en el escenario probado. Foco al título
al avanzar; título antes del resumen en DOM para no saltar sus acciones en móvil.
Resumen plegable conserva toda la información y reduce la altura inicial.

Catálogo vacío, respuesta inválida y servicio caído: crear bloqueado, guardar
borrador disponible y formulario intacto. Unknown: un solo POST sintético,
aviso/Consultar guardado y nuevas mutaciones bloqueadas, sin replay.
Cero errores JavaScript o solicitudes externas durante la matriz.

Texto al200% mediante font-size raíz, claro/320px, tema de240caracteres y
objetivo largo: documento320px y ningún elemento fuera del ancho. Es ampliación
CSS de texto; no acredita zoom nativo, lector, Safari o teléfono físico.
Capturas/logs intermedios ignorados en `output/playwright` y `output/teacher-guided-ui`.

## Comparación de carga y coste

Baseline `ae35b02e`, mismo harness/dataset sintético, Chromium sin extensiones de
usuario. Tres aperturas secuenciales por perfil, ES/oscuro, sin generación:

| Perfil | GET IA iniciales baseline (3corridas) | Actual (3corridas) | POST |
| --- | --- | --- | --- |
|320×1000 |2/2/2 |0/0/0 |0en ambos |
|1440×1000 |2/2/2 |0/0/0 |0en ambos |

Las dos lecturas se difieren a revisión, no se eliminan del recorrido.
Sin atribuir ahorro de latencia/memoria o Core Web Vitals: el harness usa Vite
de desarrollo y no mide rendimiento productivo de campo.

Builds productivos baseline/actual, mismas dependencias instaladas, configuración
sin modificar. JS emitido y gzip local nivel9 por archivo, no bytes transferidos:

| Artefacto | Baseline bytes/gzip | Actual bytes/gzip | Diferencia |
| --- | --- | --- | --- |
|Todos los JS |4131772/1269629 |4151500/1276449 |+19728/+6820 |
|Chunk TeacherNew |5181/2459 |19746/7469 |+14565/+5010 |

El coste adicional corresponde al wizard/guard/resumen/traducciones; no se
presenta como optimización global. Sin nuevas dependencias.

## Límites y continuidad

Sin despliegue, migración, inferencia o publicación. Fichas draft/partial,
unregistered y approval:null. El éxito histórico de Teacher no acepta este UI.
TUX-00 observado con usuario y comprensión TUX-01 pendientes; seguir TUX-03
(definición/espera/siguiente acción), TUX-04 (revisión legible/aceptación) y
TUX-05 (primera lección/herramientas). TUX-06 exige recorrido integrado y
aceptación por entorno/dispositivo; no reiniciar F0–F9 de102.

La idempotencia existente deduplica por actor/request key. Altas independientes
en dos pestañas no comparten intención automáticamente. El alta local incompleta
no persiste campos ni promete restauración tras recargar.
