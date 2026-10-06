# Finanzas personales — plan de implementación Nodia Client

> Estado: frontend implementado y verificado localmente; FC-24 integración completa pendiente. Revisión documental conservada.
> Fecha: 2026-10-04
> Dependencias: [contratos 22](22-personal-finance-contracts.md), [plan Server 23](23-personal-finance-backend-plan.md), 03, 05, 06, 07, AGENTS Client

## Experiencia solicitada

Backend 23 completado y verificado localmente el 2026-10-04. Los contratos 22, [fixtures HTTP](../../nodia-server/test/fixtures/finance-api.json) y [OpenAPI](../../nodia-server/test/fixtures/finance-openapi.json) ya están disponibles. Antes de probar contra la BD objetivo, aplicar migración y seed de navegación; la prueba aislada no cambió esa BD. No implementar retries automáticos de mutaciones: no existe deduplicación persistente.

Ruta /finances/personal, constante única PERSONAL_FINANCE_ROUTE disponible en catálogo APP_AVAILABLE_ROUTES de Modules. GuardStrict, BaseLayout y lazyWithRetry. Tabs General inicial, Movimientos, Préstamos y deudas, Categorías y Grupos de categorías. General es el centro de mando: indicadores, últimos movimientos y resúmenes por categoría/grupo.

Información en tablas. Toda tabla: InputSearch arriba izquierda, Crear arriba derecha, última columna Acciones con menú de tres puntos Actualizar y Activar/Desactivar. Create/update en BaseModal; toggle en ConfirmDialog. Filter en cada sección, aplicado active al entrar y al limpiar. Diseño Settings; inputs existentes, RHF/Zod desde DTOs. No nuevas páginas CRUD ni arquitectura alternativa.

## Reglas para agentes

Leer skills locales frontend-quality y create-component; añadir react-best-practices/vitest según alcance. Stack real en package.json, sin copiar APIs de versiones viejas de skills. Componentes con folder PascalCase: componente/styles/index; hooks/infrastructure/types solo si necesarios. Todos los tests con lógica van en src/test espejo. Textos de UI/toasts es/en; feedback una vez por operación y modales preservados al fallar.

El QueryCache actual notifica errores GET. Mutaciones finance tienen dueño explícito para success/error; no duplicar avisos en componentes. Boneyard solo contenido sin datos iniciales; refetch mantiene datos. Inputs/menús/botones disabled/loading en busy. Empty/error visual en tablas/paneles. No all=true, no sumas globales desde páginas ni Number para bigint.

## Orden y paralelismo

1. FC-01; FC-02, FC-03, FC-04 en scopes distintos con contrato Server ya definido.
2. FC-05, FC-06 shell+route; FC-07, FC-08 patrones y FC-18 selectores. Archivos compartidos solo un agente.
3. Tablas FC-09, FC-12, FC-14, FC-16 paralelizables; luego modales FC-10, FC-13, FC-15, FC-17 y acciones FC-11 con sus dependencias.
4. Overview FC-19, FC-20 y composición FC-21 después de reutilizables. Cada tab comparte infraestructura HTTP, query keys y feedback; no duplica esas capas.
5. FC-22, FC-23 regresiones y QA; FC-24 requiere FB-25; FC-25 documenta.

Cada asignación usa el ID de tarea, enumera scope y dependencias y exige evidencia. No despachar creación de chats/PRs ni cambios compartidos no autorizados por la asignación.

## Tareas asignables

### FC-01 — Tipos Client alineados con Server

- Estado: completada localmente — evidencia en entrega al final de este documento.
- Dependencias: FB-01 y contrato 22 fijado.
- Archivos/alcance exclusivo: nodia-client/src/modules/finances/types.ts; contratos locales de respuesta.
- [x] Crear tipos de listas/meta, movimientos/categorías/grupos/obligaciones/overview, IDs/montos strings y remaining_amount nullable para origen anulado.
- [x] Consultar entidades/DTOs/casos de uso implementados antes de integrar; fixtures coherentes con Swagger, no campos inventados.
- [x] Mantener estados por type y active enum del contrato; no agregar purpose/cancellation_reason/currency/occurred_on.
- Cierre/pruebas: Typecheck; pruebas de payloads y proyecciones relevantes bajo src/test espejo.

### FC-02 — Formato y validación de pesos enteros

- Estado: completada localmente — evidencia en entrega al final de este documento.
- Dependencias: FC-01.
- Archivos/alcance exclusivo: src/modules/finances/utils/money.ts; src/test/modules/finances/utils/.
- [x] TextInput guarda string de entrada; validar entero positivo/rango bigint sin parseFloat ni Number no acotado.
- [x] Formato visual con agrupación de miles y símbolo de pesos según locale, manteniendo transporte decimal puro; usar entero exacto.
- [x] Distinguir vacío, cero, negativo, decimal/exponente, overflow y neto negativo de overview; no redondear entradas inválidas.
- Cierre/pruebas: Casos sobre MAX_SAFE_INTEGER, separadores, límite bigint, cero informativo y amount obligatorio.

### FC-03 — Servicios HTTP y query keys por usuario

- Estado: completada localmente — evidencia en entrega al final de este documento.
- Dependencias: FC-01, contratos FB-05, FB-07, FB-09, FB-11, FB-19.
- Archivos/alcance exclusivo: src/modules/finances/infrastructure/services.ts y useServices.ts; sin otra instancia Axios.
- [x] Usar mainInstance desde config/api, pasar AbortSignal y mapear GET/POST/PUT de 22.
- [x] Query keys incluyen userId, recurso, ID/filtros/page/limit; enabled requiere sesión activa y panel visible cuando aplica.
- [x] keepPreviousData solo dentro del mismo usuario; cancelar/limpiar al cambiar sesión sin mostrar datos anteriores.
- [x] Mutaciones sin retry automático; invalidar recursos afectados/listas/overview/saldos. Error GET lo notifica QueryCache existente; no duplicar toast.
- Cierre/pruebas: Tests servicios/hooks de filtros/usuario/AbortSignal, invalidación y cero consultas sin sesión; no red real.

### FC-04 — Traducciones de Finanzas y etiquetas de ruta

- Estado: completada localmente — evidencia en entrega al final de este documento.
- Dependencias: FC-01.
- Archivos/alcance exclusivo: src/translate/es/finance.json; en/finance.json; translate/index.ts; módulos/home/layout claves necesarias.
- [x] Registrar namespace finance y claves simétricas para tabs, columnas, filtros, estados, modales, vacíos, errores y toasts.
- [x] Etiquetas de grupo/módulo/ruta siguen i18n y fuente Core; nombres personales se muestran literalmente.
- [x] Mensajes exactos de servidor compatibles con finance:* y fallback core:server_error_toast; sin texto hardcodeado/defaultValue.
- Cierre/pruebas: Paridad de keys y render es/en; filtros/diálogos/menús sin claves faltantes.

### FC-05 — Página contenedora y tabs

- Estado: completada localmente — evidencia en entrega al final de este documento.
- Dependencias: FC-01, FC-04.
- Archivos/alcance exclusivo: src/modules/finances/pages/PersonalFinance/{PersonalFinance.tsx,styles.ts,index.ts}; tabs shell.
- [x] General inicial y tabs Movimientos/Préstamos y deudas/Categorías/Grupos de categorías, con labels traducidas y IDs accesibles.
- [x] Estado de tab y filtros por sección; tab opcional en query string validado. No rutas CRUD ni store duplicado de datos remotos.
- [x] No doble padding: BaseLayout/PageContent ya aplica 16/24/32; panels con rowGap24/columnGap16.
- [x] No montar todas las consultas de tabs ocultos; conservar filtros sin copiar la data de Query a state.
- Cierre/pruebas: Test espejo de tab inicial, navegación/refresh y consultas habilitadas solo para panel seleccionado.

### FC-06 — Ruta constante, guard y catálogo de Modules

- Estado: completada localmente — evidencia en entrega al final de este documento.
- Dependencias: FC-04, FC-05.
- Archivos/alcance exclusivo: src/modules/finances/constants/routes.ts; src/routes/index.tsx; Modules/constants/routes.ts; tests de ruta/catalogo.
- [x] Crear PERSONAL_FINANCE_ROUTE=/finances/personal, importar mismo valor en router y APP_AVAILABLE_ROUTES.
- [x] Página lazyWithRetry/Suspense con GuardStrict modulePath y BaseLayout, siguiendo Business/Settings.
- [x] Probar URL directa sin sesión/sin módulo/con módulo y presencia de opción traducida en ModuleModal.
- [x] Coordinar link de módulo con FB-21; no duplicar menú manual ni asignaciones globales en Client.
- Cierre/pruebas: Tests guard y catálogo; typecheck/build por cambio de ruta; ninguna página vacía placeholder.

### FC-07 — Filter con activos por defecto y estado borrador

- Estado: completada localmente — evidencia en entrega al final de este documento.
- Dependencias: FC-03, FC-04.
- Archivos/alcance exclusivo: hooks de filtro finance; components/Filter si requiere disabled opcional; tests espejo afectados.
- [x] Draft y applied comienzan active; abrir/cancelar filtro no aplica cambios; Limpiar restaura active y página 1.
- [x] Mapear active/inactive/all al contrato, chips y contador; búsqueda de InputSearch reinicia página.
- [x] Filtros por tipo/estado/categoría/grupo/obligación según sección; no copiar appliedFilterActive=null de Users.
- [x] Reutilizar Filter; si necesita disabled añadir prop opcional compatible y controles internos bloqueados en busy, con traducción del nombre accesible.
- Cierre/pruebas: Tests consulta inicial solo activos, cancelar conserva aplicada, limpiar vuelve activos, borrador y contador coherentes.

### FC-08 — Estructura visual de tablas y barra superior

- Estado: completada localmente — evidencia en entrega al final de este documento.
- Dependencias: FC-04.
- Archivos/alcance exclusivo: componentes reutilizables pequeños bajo modules/finances/components; styles compartidos solo donde aporten valor.
- [x] InputSearch arriba izquierda y Crear arriba derecha en cada tabla; en xs botón principal ancho completo.
- [x] MUI Table/TableContainer y última columna Acciones con tres puntos; menú Actualizar y Activar/Desactivar.
- [x] minWidth650 y overflowX auto con track transparente, sin flechas, thumb6px redondeado/alpha y estándar Firefox.
- [x] Boneyard solo tabla informativa en carga inicial; barra/inputs/acciones disabled, datos conservados con soft loading en refetch.
- Cierre/pruebas: Checks de estructura y keyboard de menú; no crear framework CRUD genérico ni copiar 1000 líneas de Users.

### FC-09 — Tabla de movimientos

- Estado: completada localmente — evidencia en entrega al final de este documento.
- Dependencias: FC-03, FC-07, FC-08.
- Archivos/alcance exclusivo: PersonalFinance/components/MovementsTable/ y test espejo.
- [x] Columnas nombre/tipo/importe/estado/categoría/obligación/creación/activo/acciones; formatos exactos y labels i18n.
- [x] Listado paginado real con InputSearch/Create/Filter; category_group_ids filtra sin duplicar; reset page al cambiar filtro.
- [x] Empty State con CTA, Alert con reintento y contenido conservado al fallar refetch; no usar users.length como total global.
- [x] Seleccionar edición por ID estable y conservar row mientras menú abierto hasta mutación confirmada.
- Cierre/pruebas: Test más de una página, filtro grupo, errores inicial/refetch y menú de fila correcto.

### FC-10 — Modal de movimiento

- Estado: completada localmente — evidencia en entrega al final de este documento.
- Dependencias: FC-02, FC-03, FC-04, FC-18, DTOs FB-10, FB-13, FB-14.
- Archivos/alcance exclusivo: PersonalFinance/components/MovementModal/{component,styles,schema,types,index} y tests espejo.
- [x] RHF+Zod desde DTO: TextInput nombre/amount, SelectSingleInput tipo/estado/categoría y obligación opcional.
- [x] Al vincular obligación, dirección de pago se deriva loan→income/debt→expense; estado se ajusta sin combinación inválida.
- [x] Editar conserva seleccionados fuera de página e inactivos históricos; no sustituir por primera opción. Importe inicial se modifica desde modal de obligación según API.
- [x] Switch activo como UserModal: tarjeta, labelPlacement start, etiqueta600 y switch verde. Sin campos retirados ni propietario editable.
- Cierre/pruebas: Tests valores inválidos, pago pendiente/confirmado, relación histórica y failure con todos los inputs preservados.

### FC-11 — Mutaciones, menú y ConfirmDialog de movimientos

- Estado: completada localmente — evidencia en entrega al final de este documento.
- Dependencias: FC-09, FC-10, FB-14, FB-16, FB-17.
- Archivos/alcance exclusivo: hook de acciones de MovementsTable y su modal/confirmación.
- [x] Create/update en modal; toggle activo con ConfirmDialog. La mutación es el único dueño de sileo.success/error para cada escritura.
- [x] Cerrar modal/confirmación solo después de mutateAsync exitoso; fallo conserva formulario/registro seleccionado.
- [x] Busy bloquea search/filter/menú/envío dependientes; handle protege doble clic antes del rerender.
- [x] Invalidar movimientos/overview/obligaciones afectadas sin vaciar toda caché; timeout conserva borrador y requiere revisar resultado, sin retry automático.
- Cierre/pruebas: Tests doble submit, fallo específico/fallback, cierre solo éxito, activar/desactivar y saldo actualizado tras invalidación.

### FC-12 — Tabla de préstamos y deudas

- Estado: completada localmente — evidencia en entrega al final de este documento.
- Dependencias: FC-03, FC-07, FC-08, FB-11.
- Archivos/alcance exclusivo: PersonalFinance/components/ObligationsTable/ y test espejo.
- [x] Una tabla con filtro loan/debt; columnas nombre/tipo/monto inicial/liquidado/pendiente/activo/acciones.
- [x] remaining_amount null se presenta Anulada; cero es liquidada y no missing. Montos del backend, nunca sumas de movimientos visibles.
- [x] InputSearch/Create y menú actualizar/toggle, paginación/default activos; vínculos históricos no implican descarga all.
- [x] Crear pago se hace desde MovementModal seleccionando obligación; no inventar calendario ni cuotas automáticas.
- Cierre/pruebas: Tests préstamo100000 pagado40000 pendiente60000, saldo cero/anulado, archivado y búsqueda.

### FC-13 — Modal de obligación y actualización de principal

- Estado: completada localmente — evidencia en entrega al final de este documento.
- Dependencias: FC-02, FC-03, FC-04, FC-18, FB-12, FB-15.
- Archivos/alcance exclusivo: PersonalFinance/components/ObligationModal/ y tests espejo.
- [x] RHF/Zod para nombre/key/type/amount/description y categoría del movimiento inicial al crear; inputs existentes y switch Core.
- [x] Crear con una sola POST: no POST movimiento desde Client. Editar amount deja al backend sincronizar el inicial.
- [x] Type fijo al editar según DTO; error sobrepagos conserva valores para corregir. Campos permitidos cambian entre create/update.
- [x] Toasts/invalidation/cierre siguen FC-11, incluidos overview y movimientos iniciales.
- Cierre/pruebas: Tests una petición al crear, DTO distinto al editar, amount conflict, inputs preservados y ambos recursos revalidados.

### FC-14 — Tabla de categorías

- Estado: completada localmente — evidencia en entrega al final de este documento.
- Dependencias: FC-03, FC-07, FC-08, FB-05.
- Archivos/alcance exclusivo: PersonalFinance/components/CategoriesTable/ y tests espejo.
- [x] Columnas nombre/key/activo/acciones; search/create y Filter siempre activos al entrar.
- [x] Paginación servidor y menú update/activar-desactivar con ConfirmDialog.
- [x] Empty/error/loading propios y composición reusable en General; no traducir nombre del usuario como key de UI.
- Cierre/pruebas: Tests default/reset activos, última columna/menu y etiqueta personal literal en es/en.

### FC-15 — Modal y mutaciones de categorías

- Estado: completada localmente — evidencia en entrega al final de este documento.
- Dependencias: FC-03, FC-04, FC-14, FB-06.
- Archivos/alcance exclusivo: PersonalFinance/components/CategoryModal/ y actions de tabla; tests espejo.
- [x] TextInput nombre/key, schema DTO y switch Core; no TranslationInput para contenido personal simple.
- [x] Create/update en BaseModal, deduplicación de toast y ConfirmDialog para toggle.
- [x] Invalidar catálogo/selectores/grupos/overview/movimientos que muestran nombre; fallo no borra borrador.
- Cierre/pruebas: Tests key duplicada, mismo valor de otro usuario no mezclado y modal persistente tras error.

### FC-16 — Tabla de grupos de categorías

- Estado: completada localmente — evidencia en entrega al final de este documento.
- Dependencias: FC-03, FC-07, FC-08, FB-07.
- Archivos/alcance exclusivo: PersonalFinance/components/CategoryGroupsTable/ y tests espejo.
- [x] Nombre/key/cantidad de categorías/activo/acciones; InputSearch/Create/Filter y paginación.
- [x] Count del servidor y badges sin cargar categorías con una request por fila.
- [x] Menú actualizar/toggle coherente con Settings; grupo vacío es registro válido.
- Cierre/pruebas: Tests count exacto, cero miembros, error recuperable y default activos.

### FC-17 — Modal y selección de categorías del grupo

- Estado: completada localmente — evidencia en entrega al final de este documento.
- Dependencias: FC-03, FC-04, FC-16, FC-18, FB-08.
- Archivos/alcance exclusivo: PersonalFinance/components/CategoryGroupModal/ y actions de tabla; tests espejo.
- [x] TextInput name/key, SelectMultipleInput category_ids y switch Core; group puede guardarse con lista vacía.
- [x] Hidratar seleccionadas actuales por detalle, buscar/cargar por páginas y preservar selección fuera de resultados.
- [x] Enviar lista completa elegida al cambiar miembros; omitido no modifica, [] vacía. No perder miembros ocultos al seleccionar todos cargados.
- [x] POST/PUT una operación atómica; error conserva selección e inputs. Invalidar grupos, filtros y overview.
- Cierre/pruebas: Tests categoría fuera de página/inactiva existente, vaciar grupo, fallo rollback representado y límite de selección.

### FC-18 — Adaptadores para selectores remotos existentes

- Estado: completada localmente — evidencia en entrega al final de este documento.
- Dependencias: FC-03, FC-04, FB-05, FB-07, FB-11.
- Archivos/alcance exclusivo: hooks/selectors finance; SelectMultipleInput solo prop opcional para alcance de seleccionar todos; tests espejo.
- [x] Usar onSearchChange/onLoadMore/hasMore/loadingOptions existentes en Single/Multiple, sin segunda librería de select.
- [x] Debounce/cancelación y acumulación por ID; respuesta tardía no mezcla usuario/búsqueda; hidratar ID seleccionado por GET detalle.
- [x] Seleccionar todos significa opciones cargadas cuando hay paginación, con texto explícito; preservar IDs seleccionados fuera de página.
- [x] Cambios a componentes comunes son compatibles/opt-in y tienen regresiones Settings; sin descarga all=true.
- Cierre/pruebas: Tests búsqueda remota, página extra, seleccionado oculto, errores con inputs normales y cambio de usuario.

### FC-19 — Indicadores de General

- Estado: completada localmente — evidencia en entrega al final de este documento.
- Dependencias: FC-02, FC-03, FC-04, FB-19.
- Archivos/alcance exclusivo: PersonalFinance/components/OverviewSummary/ y tests espejo.
- [x] Mostrar ingresos/gastos/neto del filtro, conteos y pendientes de préstamos/deudas del contrato overview.
- [x] Etiquetar alcance/created_at para no presentar una suma filtrada como saldo bancario; amortización considera historia completa.
- [x] Boneyard en primer fetch, soft loading/error con reintento y ceros reales; no fabricar métricas si endpoint falta/falla.
- [x] Diseño Settings, tokens claros/oscuros y grid responsive; sin gráficos obligatorios fuera del pedido de tablas.
- Cierre/pruebas: Tests valores mayores a una página, cero/neto negativo, pendiente con pago archivado y fallo no convertido en cero.

### FC-20 — Tablas de resumen por categoría y grupo

- Estado: completada localmente — evidencia en entrega al final de este documento.
- Dependencias: FC-02, FC-03, FC-07, FC-08, FC-15, FC-17, FB-19.
- Archivos/alcance exclusivo: PersonalFinance/components/CategorySummaryTable y GroupSummaryTable; tests espejo.
- [x] Consumir breakdowns paginados reales con nombre/ingresos/gastos/neto/cantidad de movimientos y acciones últimas.
- [x] Cada tabla tiene búsqueda arriba izquierda y Crear arriba derecha; crear/update abre mismos modales de mantenedores, no versiones duplicadas.
- [x] Menu de tres puntos actualiza o activa/desactiva registro real por ID; filtros activos/inactivos explicitan alcance.
- [x] Indicar que grupos se solapan; no sumar filas de grupos para total general ni descargar todo el conjunto.
- Cierre/pruebas: Tests doble pertenencia sin duplicar total, filas cero, búsqueda/paginación y apertura del modal por ID correcto.

### FC-21 — Composición del centro de mando

- Estado: completada localmente — evidencia en entrega al final de este documento.
- Dependencias: FC-05, FC-09, FC-11, FC-13, FC-19, FC-20.
- Archivos/alcance exclusivo: PersonalFinance/components/OverviewTab/ y coordinación de modales en página.
- [x] General muestra indicadores, últimos movimientos y resúmenes de categorías/grupos como centro de mando.
- [x] Últimos movimientos usa tabla reusable con tamaño acotado/orden fecha; CTA Ver todos lleva a tab Movimientos conservando filtros pertinentes.
- [x] Create/update en General reutiliza modales/acciones existentes; cada tabla conserva el ID seleccionado y utiliza los mismos modales, evitando formularios divergentes.
- [x] Cargar solo consultas necesarias en General y deshabilitar controles dependientes; no recargar tabs ocultos sin motivo.
- Cierre/pruebas: Tests General inicial, abrir modales desde resumen, transición a Movimientos y datos anteriores durante refetch.

### FC-22 — Regresiones de sesión, ruta y filtros entre tabs

- Estado: completada localmente — evidencia en entrega al final de este documento.
- Dependencias: FC-06, FC-11, FC-13, FC-15, FC-17, FC-21.
- Archivos/alcance exclusivo: src/test/modules/finances/; tests routes y Modules afectados.
- [x] Direct URL con/sin módulo y sesión; cambio/logout no deja caché ni modales del usuario anterior.
- [x] Cada tab comienza activo, limpiar restaura active, draft cancelado no se aplica y búsqueda reinicia página.
- [x] Página final vacía tras desactivar ajusta/refetch a página válida; no dejar usuario atrapado.
- [x] Fallo inicial/refetch, selector, mutación y contexto de sesión tienen recuperación y un solo toast por operación.
- Cierre/pruebas: Regresiones que fallan ante defecto real, no snapshots/copias de implementación; todos los tests en src/test espejo.

### FC-23 — QA visual responsive y coherencia Settings

- Estado: completada localmente — evidencia en entrega al final de este documento.
- Dependencias: FC-21, FC-22.
- Archivos/alcance exclusivo: estilos finance y evidencia navegador local; shared styles solo si hay defecto del alcance.
- [x] Verificar xs<600, sm600-899 y md>=900, Light/Dark y es/en; padding16/24/32 heredado, gaps24/16 y botones principales 100% en xs.
- [x] Tablas minWidth650 con scroll horizontal transparente/sin flechas, modales accesibles en móvil y labels legibles.
- [x] Comparar TableTopBar/menús/BaseModal/switches con Settings; foco de tres puntos/ConfirmDialog/inputs y retorno al cerrar.
- [x] Si se usa navegador/computer-use, leer skill correspondiente en esa tarea; evidencia de UI no declara segura la API.
- Cierre/pruebas: Capturas/evidencia local reproducible y correcciones acotadas; no servicios externos ni cuentas reales para QA sintética.

### FC-24 — Integración local Client/Server y checks finales

- Estado: en progreso; checks y contratos verificados, flujo completo sobre BD objetivo pendiente.
- Dependencias: FC-22, FC-23, FB-25.
- Archivos/alcance exclusivo: integración finance; fixtures locales sintéticos, sin deploy.
- [ ] Crear categoría/grupo/obligación100000 y dos pagos20000; verificar pendiente60000 en tabla/General.
- [ ] Editar amount de obligación, confirmar pendiente/pago/cancelación/toggle y probar otro usuario; no repetir writes automáticamente.
- [x] Ejecutar npm run test, npm run typecheck, npm run lint y npm run build en nodia-client.
- [x] Registrar qué fue simulado vs API/PostgreSQL reales; no usar tests UI como prueba de FK/concurrencia.
- Cierre/pruebas: Flujo local integrado y cuatro checks; dependencias backend/staging pendientes expresas.

### FC-25 — Documentar entrega y preparar siguiente asignación

- Estado: completada localmente — evidencia en entrega al final de este documento.
- Dependencias: FC-24.
- Archivos/alcance exclusivo: docs/mvp/00-progress.md, 05, 06, 22, 24 y evidencias.
- [x] Marcar tasks terminadas solo con archivos/checks reales y mantener futuras/pending sin completar.
- [x] Reconciliar ruta/contratos/labels con navegación creada y API efectiva; actualizar pendientes sin aprobar documentos por cuenta propia.
- [x] Entregar lista de diferencias/limitaciones y tareas libres; no publicar ni crear chats de subagentes como efecto lateral.
- Cierre/pruebas: Documentos/enlaces coherentes y estado real de implementación/BD/despliegue registrado.

## Plantilla para encargar una tarea a un subagente

Implementa [ID y título] del plan de Finanzas. Lee AGENTS y las skills locales aplicables; usa 03/20/21/22 como contrato y conserva las decisiones simplificadas. Dependencias terminadas: [IDs/evidencia]. Trabaja únicamente en [archivos asignados], conserva cambios de otros agentes y coordina cualquier archivo común antes de editarlo. Completa cada checklist y sus pruebas de valor. Devuelve archivos tocados, comportamiento implementado, comandos/checks con resultados, límites de evidencia y pendientes. No marcar documentación aprobada ni ejecutar migración/deploy fuera del entorno aislado de la tarea.

## Entrega Client — 2026-10-04

Implementación autorizada por el usuario, con tres agentes para tablas/filtros, modales/selectores y General, más integración compartida. FC-01 a FC-23 completadas localmente; FC-25 registra esta entrega. FC-24 permanece abierta para el flujo completo Client/API/BD objetivo. No se aprobaron documentos automáticamente.

Los scopes del plan se consolidaron para evitar tablas CRUD duplicadas:

- Tipos: [types.ts](../../nodia-client/src/modules/finances/types.ts). Transporte, schemas Zod y hooks en infrastructure; formatters money/dates en utils. IDs/importes strings, límites positivos bigint por fila y agregados exactos sin límite de fila; períodos de creación America/Santiago con día final inclusivo y límite UTC exclusivo, incluidos cambios DST.
- Ruta: [constante](../../nodia-client/src/modules/finances/constants/routes.ts), router lazy/GuardStrict/BaseLayout y catálogo Modules usan el mismo valor. Tabs conservan filtros por sección y sólo montan consumidores del panel visible.
- [FinanceResourceTab](../../nodia-client/src/modules/finances/components/FinanceResourceTab/FinanceResourceTab.tsx) compone las cuatro tablas con FinanceTable/FinanceFilters, detalle por ID antes de editar y ConfirmDialog. No consulta detalles por fila para construir listas. Paginación 1-based, activos por defecto, limpiar restaura activos; corrección de página fuera de rango al archivar.
- FinanceCatalogModal, FinanceGroupModal, FinanceMovementModal y FinanceObligationModal comparten inputs existentes, RHF/Zod, switch Core y FinanceWriteReview. Se omiten asociaciones/type inmutables al actualizar; el principal inicial se edita desde obligación. Seleccionar opciones cargadas conserva categorías históricas fuera de página, mediante prop selectedOptions opt-in del SelectMultipleInput existente.
- [FinanceOverview](../../nodia-client/src/modules/finances/components/FinanceOverview/FinanceOverview.tsx) muestra agregados del servidor, saldos históricos, últimas operaciones acotadas, resúmenes paginados y acceso a todos los movimientos con el alcance aplicado. Explicita solapamiento de grupos y diferencia entre neto filtrado y saldo bancario.
- Caché por usuario; placeholder sólo para el mismo principal. Queries cancelables y sin descarga ilimitada. Writes retry=false; un único dueño de feedback. Éxito invalida Finanzas del usuario; fallo conserva modal/datos. Pérdida de respuesta o validación de respuesta impide reenviar hasta revisar resultado; una revisión GET fallida mantiene bloqueo. Esto no equivale a deduplicación persistente del servidor.
- Namespace finance con 140 claves simétricas ES/EN. Los mensajes finance:* del servidor se traducen con el interceptor existente; nombres personales se muestran literalmente. Filtros, controles de paginación y limpieza de selección tienen nombres accesibles traducidos.

### Evidencia y límites

- Suite completa Client: 612 pruebas/91 archivos; typecheck, lint y build correctos. Build separa PersonalFinance por ruta. Pruebas nuevas cubren DTOs/payloads, fixtures HTTP versionados del servidor, BigInt, DST, usuario/caché, acceso de ruta/asignación, paginación, modales, doble envío, confirmación y revisión incierta.
- Navegador con harness temporal aislado y fixtures sintéticos: escritorio1270, tablet768 y móvil390; Light/Dark y ES/EN; General, tablas y búsqueda de selector, formulario persistente tras error simulado. Contenido de tabla mínimo650 con scroll interno; ancho de página no excede viewport. Padding exterior heredado16/24/32; botones principales100% móvil; paginación envuelve sus controles. Harness detenido y retirado; sin datos reales ni cambios de sesión Google.
- API/PostgreSQL real: evidencia del Backend23 y fixtures22 de la entrega anterior; en esta entrega el cliente valida esos contratos con HTTP simulado. No se ejecutó un flujo desde navegador contra Nest/PostgreSQL real ni Google/Redis/staging.
- Pendiente FC-24: migrar/seed en BD objetivo, asignar personal_finance al usuario desde Settings y probar categoría/grupo/préstamo100000 más pagos20000+20000 → pendiente60000; principal120000 → pendiente80000, pendiente/confirmación/anulación, visibilidad y aislamiento con segunda cuenta. Los tests de Client no prueban FK, rollback ni concurrencia de PostgreSQL.
- No se modificó .env, no se aplicaron migraciones/seed a la BD configurada, no se hizo deploy ni commit. Los cambios Backend/documentación anteriores se conservaron.
