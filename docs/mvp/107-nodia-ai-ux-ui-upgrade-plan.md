# NodiaAI — evolución UX/UI del chat con referencia DeepSeek

Fecha: 2026-11-15. Revisión: R02. Estado documental: **en revisión**.
Estado de entrega: **implementación local y QA sintética completadas**; revisión humana y adopción por entorno pendientes.
Solicitud: estudiar `deepseek-ai/chat-demo`, mejorar de forma importante la
experiencia de NodiaAI y dejar la implementación futura en el TODO.

Rama: `codex/nodia-ai-ux-ui-upgrade`, creada desde `origin/development`
actualizado en `d2baa8f16f7ca352437cbed0890ac4e7b4e53f2e`. El `development`
local estaba atrasado; no se utilizó como base ni se modificó esa rama.
Seguimiento: **NAIUX-001** en [TODO](TODO.md).

## 1. Resultado buscado y alcance

Convertir el chat en un espacio de trabajo fácil de leer y operar: conversación
como contenido principal, compositor reconocible, navegación discreta y una
distinción clara entre respuesta, resultado consultado, propuesta y efecto
confirmado. La referencia aporta jerarquía y ergonomía; la identidad visual y
el sistema de ejecución siguen siendo los de Nodia.

El corte inicial especificó el trabajo futuro. La solicitud posterior del usuario
implementa ese alcance en la misma rama; §11 y la evidencia separan código/QA
local de aceptación humana y adopción operativa. No hay cambios de proveedores,
dependencias, base de datos o credenciales, inferencias reales ni despliegue.
La autorización de desarrollo no aprueba el documento o publica conocimiento.

**Primera versión implementada localmente:** reorganizar el workspace, historial, lectura de
mensajes, compositor, selección y presentación de estados/resultados utilizando
los contratos existentes. Preservar creación explícita de conversación y carga
de archivos dentro de su conversación. Unificar su lenguaje visual y corregir
la geometría móvil, sin introducir una modalidad nueva de chat.

## 2. Fuentes y calidad de la evidencia

### 2.1. Nodia

Leer [README](README.md), [progreso](00-progress.md) y [TODO](TODO.md) al
retomar; los cortes históricos no sustituyen el estado del checkout/entorno.

- [Diseño07](07-design-constraints.md), [stack08](08-stack-frontend.md),
  [móvil35](35-mobile-cards-shortcuts-plan.md), [rendimiento37](37-web-performance-implementation-plan.md),
  [DESIGN9–10](../../nodia-client/DESIGN.md) y las skills locales de diseño,
  responsive, create-component y frontend-quality.
- [Compositor93](93-nodia-ai-chat-composer-redesign.md), incluida la solicitud
  del 2026-11-14: Stop en compositor, renombrado lateral, sin cabecera de
  título/modelo ni botón «Ver actividad del turno». No se revierte esa decisión.
- [Contratos41](41-nodia-ai-v1-contracts.md), [arquitectura43](43-nodia-ai-execution-architecture.md),
  [política50](50-nodia-ai-ai04-runtime-policy.md), [persistencia55](55-nodia-ai-ai09-conversation-persistence.md),
  [contexto58](58-nodia-ai-ai12-context-execution.md),
  [adjuntos78](78-nodia-ai-ai32-attachments-voice.md), [privacidad89](89-module-access-and-user-data-scope.md)
  y [ADR092](../architecture/decisions/ADR-092-stable-module-navigation-routes.md).
- [Modos90](90-agentic-api-only-web-retirement.md), [proveedores91](91-ai-provider-onboarding-verification.md),
  [paridad92](92-nodia-ai-api-chat-parity.md), [contrato funcional IA](ai-provider-feature-contract.md)
  y [ventas sólo lectura94§26](94-business-point-of-sale-and-product-refactor.md#26-nodiaai-ventas-y-reportes-de-solo-lectura--r17-2026-10-30).
- [Manual de propuestas](../features/nodia-ai/proposal-review-presentation.md),
  [estándar de fichas](../nodia-ai/knowledge/README.md), [producto NodiaAI](../nodia-ai/knowledge/nodia-ai/README.md)
  y [ficha del compositor](../nodia-ai/knowledge/nodia-ai/features/chat-composer-selection.md).

Los componentes y DTO/casos de uso de §3/§8 se revisaron en la base Git indicada.
La investigación inicial no midió la UI. La continuación de §11 añade baseline
y candidato con componentes reales, GuardStrict y transporte sintético, sin
sesión de persona/proveedor real. Las hipótesis se concilian en la evidencia; el
desborde histórico de dictado no se reprodujo en este baseline, sin reescribir93.

### 2.2. Referencia externa fijada

Repositorio observado: [DeepSeek chat-demo, commit 5d5dd754](https://github.com/deepseek-ai/chat-demo/tree/5d5dd754ebc1948e977ddb880a9eb5aa25f37b4c).
La [demo pública](https://deepseek-ai.github.io/chat-demo/) se inspeccionó a
1280×720, oscuro, sin API key ni inferencias: bienvenida, compositor, historial
lateral y ajustes. Se observó una barra lateral de unos 260px y compositor de
unos 776px; son medidas de referencia, no tokens aceptados de Nodia.

| Fuente | Comportamiento comprobado en código | Valor para NodiaAI |
| --- | --- | --- |
| [ChatInput](https://github.com/deepseek-ai/chat-demo/blob/5d5dd754ebc1948e977ddb880a9eb5aa25f37b4c/src/components/chatInput/ChatInput.tsx) | Texto arriba, herramientas abajo, borrador por sesión, Enviar/Stop en el mismo lugar, Enter/IME | Compositor único y controles estables; varias garantías ya existen en Nodia |
| [MessageList](https://github.com/deepseek-ai/chat-demo/blob/5d5dd754ebc1948e977ddb880a9eb5aa25f37b4c/src/components/messages/MessageList.tsx) | Seguimiento condicionado al fondo y conservación de ancla | Preservar intención de lectura; mejorar sólo una brecha demostrada |
| [AssistantMessage](https://github.com/deepseek-ai/chat-demo/blob/5d5dd754ebc1948e977ddb880a9eb5aa25f37b4c/src/components/messages/AssistantMessage.tsx) | Respuesta y bloques auxiliares diferenciados | Jerarquía de resultado y detalles bajo demanda, con fuentes reales |
| [SessionView](https://github.com/deepseek-ai/chat-demo/blob/5d5dd754ebc1948e977ddb880a9eb5aa25f37b4c/src/components/session/SessionView.module.css) | Distribución específica de sesión/compositor según espacio | Estudiar altura útil y teclado; no copiar offsets o safe area sin el shell de Nodia |
| [Cliente API](https://github.com/deepseek-ai/chat-demo/blob/5d5dd754ebc1948e977ddb880a9eb5aa25f37b4c/src/services/api/client.ts) y [store](https://github.com/deepseek-ai/chat-demo/blob/5d5dd754ebc1948e977ddb880a9eb5aa25f37b4c/src/services/chat/store.ts) | API key, rutas Anthropic-compatible de DeepSeek, modelo fijo y herramientas propias | Referencia de UI, no adaptador multiproveedor reutilizable |

Responsive, conversación real, voz, adjuntos, fuentes y ramas del demo se
estudiaron en código; no se verificaron en ejecución. La existencia de botones
no acredita disponibilidad de cada función/proveedor. La [licencia MIT](https://github.com/deepseek-ai/chat-demo/blob/5d5dd754ebc1948e977ddb880a9eb5aa25f37b4c/LICENSE)
exige conservar aviso/licencia si se incorpora software o partes sustanciales.
La propuesta es reimplementar patrones en MUI/Emotion, conservando sus licencias
si finalmente se copia código; no importar assets/marca de DeepSeek.

## 3. Diagnóstico del chat actual

Rutas de Client relativas a `nodia-client/src/modules/nodiaAi/` salvo indicación.
Las referencias de línea describen esta base y pueden cambiar al implementar.

| Área | Hecho comprobado | Fricción o riesgo a validar | Dirección propuesta |
| --- | --- | --- | --- |
| Entrada | `pages/NodiaAI/NodiaAI.tsx:647` muestra bienvenida sin chat; el compositor se monta tras crear conversación | Inicio con poca orientación y separación entre entrar y escribir | Bienvenida breve con CTA explícito; tras crear, compositor centrado en chat vacío |
| Shell | `pages/NodiaAI/NodiaAI.tsx:498` conserva título de página, Nuevo/Historial; cabecera de conversación retirada | Chrome acumulado con topbar y navegación global, especialmente en xs | Acciones existentes compactas; conservar h1 accesible y no crear otra cabecera título/modelo |
| Altura | `pages/NodiaAI/styles.ts:47` usa `calc(100dvh - 11/12/18rem)`, mínimos 580/520px y máximo1200 | Los mínimos/offsets pueden competir con viewport bajo, avisos y teclado | Medir shell real y basar el workspace en espacio disponible; `min-height: 0` en la cadena flex |
| Historial | Panel local de260px, filtros/búsqueda/páginas y selección con dueño común | Dos niveles laterales junto al sidenav; panel roba ancho de lectura | Historial local plegable; overlay existente en anchos insuficientes; sin segundo menú global |
| Superficies | Chat con borde/radio24, mensajes de ambos autores con burbuja/borde/sombra | Capas de tarjetas pueden competir con respuesta y propuesta | Asistente en superficie editorial neutra; usuario en burbuja contenida; propuesta mantiene contenedor reconocible |
| Ritmo | `Messages` tiene gap24 y `components/ChatMessage/styles.ts:14` margen inferior24 | Posible separación acumulada entre mensajes; debe medirse antes de cambiar | Un propietario del ritmo entre mensajes; conservar24px entre paneles y16px horizontal |
| Selección | `ComposerSelection` expone conexión/modo/modelo/esfuerzo con borrador, Aplicar/Cancelar y elegibilidad exacta | La configuración ocupa varias filas aun durante lectura | Resumen compacto de selección aplicada y editor progresivo con controles existentes |
| Compositor | `ChatComposer` usa núcleo compartido, adjuntos, revisión, dictado y Stop existentes | Muchas capas pueden desplazar texto/acciones; maxHeight60dvh requiere comprobarse con avisos | Texto dominante; herramientas secundarias; un solo dueño de estado y un solo compositor |
| Dictado | Plan93/ DESIGN10.10 registran desborde temporal de selectores a320px, hasta61px respecto al formulario | Incidencia conocida sin cierre móvil integral | Regresión explícita durante escucha, texto largo y selección abierta/cerrada |
| Scroll | `pages/NodiaAI/NodiaAI.tsx:198–227,330–355,620–631` ya sigue cerca del fondo y restaura ancla al anteponer | Un nuevo layout puede romper lectura, foco o ancla; no falta general de autoscroll | Mantener comportamiento; botón Volver al final sólo si resuelve necesidad comprobada |
| Markdown | `MessageMarkdown` ya representa contenido y tablas con scroll local | Densidad y anchura de respuesta/código requieren comparación | Mejorar lectura conservando el renderer y la política de seguridad |
| Resultados/propuestas | Proyecciones inline bajo demanda y revisión humana con borrador protegido | Unificar aspecto puede borrar diferencias entre consultar/proponer/ejecutar | Lenguaje visual común, estados y acciones semánticamente distintos |

**Conclusión técnica:** no conviene reemplazar el chat por el demo. Nodia ya
resuelve persistencia, CAS, ownership, propuestas, idempotencia y recuperación
que el ejemplo no modela como flujo de negocio. El salto está en la composición
y en hacer esas garantías comprensibles, conservando sus unidades actuales.

## 4. Dirección de diseño propuesta

### 4.1. Espacio de conversación

Estética sobria y editorial, usando paleta, tipografía y marca de Nodia. Fondo
neutro, una superficie principal y acento para acciones relevantes. Reducir
sombras/bordes redundantes; no cambiar fuentes/theme ni añadir degradados o
animación decorativa. Un título de página discreto sigue identificando el recurso.

El mensaje del usuario conserva alineación derecha y color legible; el asistente
tiene más ancho útil, identidad accesible y respuesta con jerarquía tipográfica.
Timestamps y metadatos reales son secundarios. No ocultar errores, restricciones
o resultados inciertos dentro de menús o de detalles técnicos plegados.

Columna de lectura candidata de48–56rem, a verificar con tablas y textos largos;
no fijar el ancho776px del demo. Bloques estructurados pueden usar más espacio
dentro del workspace y scroll horizontal local. En móvil todo usa el ancho útil.
Las cifras son parámetros de diseño a comparar, no métricas de mejora.

### 4.2. Distribución y navegación

Esquema funcional, no maqueta implementada:

```text
Desktop: shell Nodia conservado
  título de página discreto                       Nuevo / Historial
  historial local plegable | conversación: respuesta y resultados
                          | avisos que requieren actuación
                          | compositor + resumen de selección aplicada

Móvil: shell Nodia y reserva inferior conservados
  identificación / acciones compactas
  conversación a ancho útil (historial por overlay)
  avisos reales relevantes
  texto + adjuntar / dictar / Enviar o Stop
  selección aplicada → editor bajo demanda
  reserva existente de navegación / safe area / teclado
```

Historial conserva búsqueda autorizada, filtros, fijados, archivo, paginado,
menú y renombrado existentes. No agrupar por fecha sin timestamps del contrato,
ni simular búsqueda global filtrando sólo la página cargada. No descargar todos
los chats para producir secciones visuales. Mantener URL del chat, Atrás/Adelante,
selección y estado de lectura al abrir/cerrar o cruzar breakpoints.

La nueva apariencia del panel no crea rutas ni grupos de permisos. Si no cabe
junto al sidenav, se pliega; no comprimir el texto para mantener tres columnas.
Nuevo y demás acciones principales ocupan su ancho disponible en xs; los iconos
del compositor conservan objetivos44px y su composición específica documentada.

### 4.3. Bienvenida y primer mensaje

Sin conversación: bienvenida breve, explicación concreta y CTA a la creación
existente. No crear una conversación por montar la página. Después de éxito de
creación se presenta el compositor vacío como elemento central; tras el primer
mensaje ocupa su posición estable inferior, sin recrear textarea ni perder foco.
No agregar por esta entrega un borrador previo a la conversación ni crear y
enviar en una única operación implícita: eso requeriría contrato propio.

Si se incorporan sugerencias, serán ejemplos traducidos de capacidades vigentes,
filtrados por autoridad real; sólo rellenan texto revisable y nunca autoenvían,
suben archivos o aceptan propuestas. No prometer ventas por IA, capacidades de
modelo, consultas combinadas ni resultados numéricos no respaldados.

### 4.4. Compositor y selección de IA

Un solo componente montado y un solo borrador por conversación. Texto arriba;
adjuntar y dictado junto al control Enviar/Stop. Resumen de selección debajo:
conexión, modo Agentic/API key, modelo e intensidad si existe. Mostrar etiquetas
comprobables y acceso al valor completo; no perder la instancia al abreviar.

Abrir el resumen muestra el editor de selección con `SelectSingleInput` y sus
cuatro dimensiones actuales. Usar un único panel adaptable con foco/escape;
mantenerlo montado después de abrir si es necesario para preservar su borrador,
siguiendo DESIGN10.6. No mantener editores activos duplicados para móvil/desktop.

La selección **aplicada** se distingue del borrador **sin aplicar**. Cerrar el
panel no aplica ni descarta silenciosamente; conserva el borrador y un aviso
visible, con envío bloqueado hasta Aplicar o Cancelar. Un error de escritura
mantiene el panel abierto y los valores. No cerrar por refetch ni tomar una
respuesta tardía de otra conversación como selección actual. El panel no debe
tapar la causa de bloqueo o dejar un error visible sólo al volver a abrirlo.

Con configuración incompleta, mostrar «Sin modelo asignado»/su traducción y la
acción para completar selección. No elegir primer modelo/conexión o esfuerzo
por estética. No trasladar los botones DeepThink/Search: la intensidad actual
no es un interruptor genérico de razonamiento, y buscar requiere herramienta y
autorización reales. Ninguna key se introduce o persiste en este compositor.

### 4.5. Mensajes, actividad y resultados

Respuesta legible primero. Actividad pública real se mantiene dentro del turno
activo, sin recuperar el botón eliminado ni mostrar cadena de pensamiento.
Sólo eventos autorizados/estados reales; no porcentajes ni pasos simulados.
Finalizar retira la actividad transitoria según93, conservando los resultados,
propuestas y recuperación de error/cancelación/incertidumbre.

Client recupera mensajes/eventos mediante GET y polling existentes; esta entrega
no añade SSE al proveedor, streaming de tokens ni una animación que simule datos
que el servidor aún no entregó.

Conservar renderer Markdown seguro. Código, URLs largas y tablas no provocan
scroll del documento; no habilitar HTML arbitrario, Mermaid/KaTeX, iframes o
scripts por copiar el demo. Cualquier ampliación de formatos exige revisión de
seguridad, carga por intención y medición propia en una iniciativa separada.

Propuesta sigue mostrando estado/revisión, Antes/Después, controles humanos y
detalles exactos plegables. Confirmado no se rotula como aplicado sin recibo.
Resultados de sólo lectura, propuesta y ejecución usan diferencias visibles de
texto/acciones además del color. Reutilizar sus loaders por intención/visibilidad;
abrir un historial largo no dispara un fetch por cada tarjeta oculta.

Copiar texto visible es una mejora local candidata, si el componente no lo
ofrece aún: con nombre accesible, disponible con teclado/táctil, manejo de fallo
de Clipboard y feedback Sileo ES/EN. No editar/regenerar/continuar mensajes ni
repetir herramientas desde una acción de apariencia secundaria.

### 4.6. Adjuntos y voz

Adjuntos compactos con miniatura y estado real, sin ocultar revisión requerida,
error o recuperación incierta. Las miniaturas liberan blob URLs como hoy. Abrir
revisión bajo demanda conserva contenido/foco y error abierto. Quitar se dirige
a la entrada exacta; un fallo no limpia el conjunto de archivos ni el texto.

Se conserva upload automático autorizado y sus límites actuales; reducir
fricción visual no elimina validación, revisión, idempotencia o recuperación.
El dictado principal sigue produciendo texto editable por navegador, sin
autoenvío ni cambio al ASR de DeepSeek. Captura/cleanup/scope y callbacks tardíos
siguen bajo el núcleo existente. No usar la animación como prueba de transcripción.

## 5. Estados e invariantes que la implementación debe conservar

| Estado o transición | Presentación y comportamiento exigidos |
| --- | --- |
| Primera carga sin datos | Boneyard en contenido informativo; controles loading/disabled, sin skeleton de inputs |
| Reconsulta con datos | Contenido/borrador montados y carga suave; bloquear controles dependientes |
| Chat vacío | Mensaje útil y compositor tras creación; no confundir con fallo del historial |
| Catálogo ausente/inválido/caído | Estado real, error y reintento; sin completar modelo/modo/esfuerzo |
| Selección sin aplicar | Aviso visible incluso al plegar y envío bloqueado; no ejecutar selección anterior por accidente |
| Adjuntos sin revisar | Revisión accesible y envío conforme a guardas; subida no equivale a interpretación aprobada |
| Dictado activo | Stop de escucha disponible, texto y controles estables; sin envío/selección implícitos |
| Turno queued/running | Enviar se sustituye por Stop de turno; impedir doble intención y conservar selección congelada |
| cancel_requested | Estado real de solicitud; no afirmar reversión de efectos ni cancelación remota |
| Error HTTP conocido | Toast con mensaje permitido del servidor/fallback y error local del bloque informativo; borrador/modal intactos |
| Resultado incierto | Identidad y recovery existentes, sin botón Regenerar/reintento nuevo de inferencia ni desbloqueo por ocultar aviso |
| Cambio chat/usuario/autoridad | Aislamiento del borrador, callbacks y caché existentes; rechazar respuestas obsoletas y respetar revocación/403 |
| Lectura hacia arriba | No llevar al fondo por cada evento; anteponer mensajes conserva ancla y foco |
| Confirmación humana | Revisión/hash/identidad exactos; recibo de ejecución separado del estado confirmado |

Mutaciones y acciones que cambian estado conservan Sileo success/error
internacionalizado y un responsable único del feedback. Cancelación local
intencional de lectura no se presenta como fallo HTTP. No añadir texto hardcoded
ni exponer trazas, secretos o direcciones internas para explicar un bloqueo.

## 6. Compatibilidad y límites de producto

1. **Agentic y API key permanecen.** El demo exige una key; la apariencia elegida
   no impone ese transporte a NodiaAI. Web y token_plan siguen retirados.
2. **Frontend habla con Nodia Server.** No conexión directa a DeepSeek, claves
   en localStorage, IndexedDB como fuente de negocio ni runtime alternativo.
3. **Selección exacta y dinámica.** Instancia/conexión, modo, modelo y esfuerzo
   siguen siendo identidades reales. Configuración/catálogo/login no acreditan
   inferencia; no inventar salud, cuotas, tokens, latencias o capacidad por nombre.
4. **Historial y ownership estables.** No reescribir mensajes, selection_snapshot,
   IDs, contratos firmados, propuestas o revisiones al cambiar presentación.
5. **Autoridad y ventas.** ToolGateway/grants/ámbito y confirmación exacta se
   conservan. Ventas/reportes sólo lectura, incluso en propuestas históricas.
6. **Stop/recuperación.** Reutilizar CAS/idempotencia/recuperación; no reenviar una
   inferencia incierta, repetir escrituras ni asumir cancelación remota.
7. **Teacher aislado.** El núcleo `src/components/MessageComposer`
   también se consume en Teacher. Cambios compartidos requieren regresiones en
   ambos; ningún componente de Teacher empieza a importar el módulo NodiaAI.
8. **Shell y tema.** Rutas canónicas, topbar/sidenav, MobileBottomNav, safe area,
   tipografía, tokens y padding16/24/32px permanecen; sin doble padding exterior.
9. **Rendimiento.** No traer el stack del demo, observers globales nuevos,
   consultas por fila o catálogo entero. Optimizar sólo con baseline/ahorro37;
   no afirmar mejoras por menos tarjetas o por un build correcto.
10. **Extensiones separadas.** Ramas, edición/regeneración/continuación, TTS,
    búsqueda web, fuentes nuevas, export/import ZIP y nuevos renderers quedan
    fuera de la primera versión. Exigen especificación/contratos/gates propios;
    no son pendientes implícitos para completar este rediseño.

No se crea ADR en esta etapa: las decisiones propuestas son presentación
reversible sobre contratos actuales. Si al implementar hace falta cambiar
persistencia, admisión, semántica de historial/ramas o navegación compartida,
registrar esa decisión y sus alternativas en ADR antes del cambio dependiente.

## 7. Plan de implementación futura por entregas

Orden por dependencias dentro de NAIUX-001; no establece prioridad frente a las
otras iniciativas del TODO. Cada entrega debe mantener un chat utilizable y
dejar evidencia/primer pendiente, sin duplicar los cierres históricos de93.

| Entrega | Trabajo y archivos principales | Criterio de salida |
| --- | --- | --- |
| **NAIUX-00 — baseline real** | Conciliar107 con checkout/entorno; capturar vacío, chat activo, selector, dictado, adjuntos y propuesta con componentes reales y fixtures aisladas | Capturas/geometría/requests/bundle por perfiles comparables; problemas medidos y evidencia humana separada |
| **NAIUX-01 — diseño verificable** | Prototipo de composición con componentes/tokens actuales; comparar distribución y escenarios del §9 | Layout desktop/móvil, jerarquía y estados revisables; inventario explícito de lo que cambia/conserva, sin nuevas capacidades |
| **NAIUX-02 — workspace e historial** | `pages/NodiaAI/{NodiaAI.tsx,styles.ts}`, `ConversationHistory`, integración con shell existente | Altura útil sin doble reserva, navegación/filtros/páginas intactos, overlay/foco/URL y scroll estable |
| **NAIUX-03 — lectura y resultados** | `ChatMessage`, `MessageMarkdown`, estilos/adaptadores de observaciones y `ProposalPreview` sólo donde haga falta | Jerarquía uniforme, estados semánticos distintos, lectura/Markdown seguros, queries por intención y borradores protegidos |
| **NAIUX-04 — compositor y selección** | `ChatComposer`, `ComposerSelection`, núcleo compartido sólo si es necesario; ES/EN | Resumen aplicado/editor único, dirty/errors sin pérdidas, Enter/IME/voz/Stop y selección exacta intactos; cierre del desborde conocido |
| **NAIUX-05 — adjuntos y recuperación** | Presentación de adjuntos, loaders/preview, actividad/cancelación y notices existentes | Revisión/upload y recovery inequívocos, errores locales, ausencia de replay y de limpieza prematura |
| **NAIUX-06 — integración y QA** | Unidades/hook tests afectados, comprobación integrada de riesgos concretos, geometría y medición37 | Matriz§9 con resultados por alcance, regresiones Client, build/tipos/lint y knowledge check/build; presupuesto de red sin regresión injustificada |
| **NAIUX-07 — revisión y adopción por entorno** | Recorrido humano, fichas/índices/DESIGN y paquete de entrega conforme planes operativos | Estado de revisión/implementación/aceptación explícito; adopción sólo con procedimiento y evidencia del entorno, sin aprobación heredada |

### Checklist y primer pendiente real

- [x] Solicitud y rama desde development remoto actualizado registradas.
- [x] Referencia fijada, inspección visual acotada y auditorías de código realizadas.
- [x] Capacidades existentes, restricciones y límites de importación identificados.
- [x] Análisis, fases, aceptación y evaluación de impacto en fichas/índices documentados.
- [x] **NAIUX-00:** levantar baseline comparable de NodiaAI con UI real y fixtures
  aisladas; medir primero altura útil, panel lateral, selectores y dictado320px.
- [x] NAIUX-01: producir propuesta visual revisable sobre ese baseline.
- [x] NAIUX-02: integrar workspace/historial conservando navegación y lectura.
- [x] NAIUX-03: integrar jerarquía de mensajes/resultados sin cambiar sus contratos.
- [x] NAIUX-04: integrar compositor/selección y regresión de dictado.
- [x] NAIUX-05: completar adjuntos/recuperación y casos adversos.
- [x] NAIUX-06: cerrar QA y comparación de rendimiento por alcance.
- [ ] NAIUX-07: revisión humana y adopción operativa separadas.

NAIUX-00/06 se cierran por laboratorio con fixtures, según §11; NAIUX-01 se
verificó con el candidato integrado y se descartó su primera variante de tres
filas por restar lectura. NAIUX-07 conserva revisión humana/adopción pendientes.
No repetir la investigación o baseline ya completados. Tampoco
exige inferencias nuevas para medir UI: usar transporte sintético identificado
para los estados. Cualquier validación generativa posterior conserva el alcance
y presupuesto de91/92, sin pruebas automáticas por cada cambio de estilo.

## 8. Mapa de implementación y garantías de backend

| Responsabilidad | Unidades actuales a preservar o ajustar |
| --- | --- |
| Dueño de conversación/URL, scroll y composición | `nodia-client/src/modules/nodiaAi/pages/NodiaAI/` y hooks/infrastructure actuales |
| Navegación local | `components/ConversationHistory`, `ConversationManagement`, renombrado/menú existentes |
| Texto y herramientas de entrada | `components/ChatComposer`, `nodia-client/src/components/MessageComposer/` |
| Selección/editor | `components/ComposerSelection`, `src/utils/modelVariantOptions.ts`, elegibilidad de infraestructura |
| Lectura | `components/ChatMessage`, `MessageMarkdown` y estilos; sin segundo parser |
| Adjuntos/dictado | `components/Attachments/hooks/useAttachmentDrafts.ts`, preview/loaders y hooks compartidos de voz |
| Resultados y ejecución | `ProposalPreview`, `RunActivity`, `ReportObservation`, `ExecutionObservation`, `ArtifactObservation` y loaders existentes |
| Traducciones/pruebas | `src/translate/{es,en}/nodiaAi.json` y rutas espejo bajo `src/test/modules/nodiaAi/`; comprobar nombres vigentes antes de editar |

En Server se contrastaron `nodia-ai-conversation/dto/update-nodia-ai-conversation.dto.ts`
y `update-nodia-ai-selection.dto.ts`: revisión esperada, título256bytes y cambios
explícitos de fijado/archivo; selección anidada exacta. El caso de uso
`update-nodia-ai-conversation.use-case.ts` bloquea revisión conflictiva y
conversación ocupada bajo transacción/autoridad. `admit-nodia-ai-message.use-case.ts`
recupera la intención existente y congela la selección al admitir el run.

Estos contratos respaldan reorganizar controles, no editar mensajes o admitir
regeneración. No se prevé cambio Server/DTO/migración en la primera versión;
si aparece una brecha real, especificarla y probarla antes de ampliar el alcance.
No esconder un409 cambiando selección, descartando revisión o recreando chat.

## 9. Aceptación, regresiones y medición

### 9.1. Criterios observables de la entrega futura

| ID | Garantía que debe comprobarse |
| --- | --- |
| UX01 | La persona identifica dónde escribir, qué IA está aplicada y cómo iniciar/abrir otra conversación sin instrucciones externas |
| UX02 | Escritorio mantiene lectura cómoda; móvil conserva texto/Enviar/Stop y selección accesibles sin scroll horizontal del documento |
| UX03 | Nuevo/chat vacío/primer mensaje no duplica creación, montaje del compositor, envío ni upload |
| UX04 | Abrir/cerrar/redimensionar historial o selector conserva borrador, selección, archivo en revisión y foco adecuado |
| UX05 | Borrador de selección no aplicado nunca envía con la selección anterior inadvertidamente; error mantiene editor abierto |
| UX06 | Modelos/configuración ausentes, históricos o inválidos no inventan selección, disponibilidad ni esfuerzos |
| UX07 | Enter/Shift+Enter/IME, doble clic y dictado mantienen sus guardas; escuchar no autoenvía ni añade archivo |
| UX08 | Dictado a320px con texto largo y selector no produce el desborde conocido; Stop permanece alcanzable |
| UX09 | Stop de turno respeta queued/running/cancel_requested y recovery; no afirma cancelación remota o reversión |
| UX10 | Anteponer historial/actualizar mensajes o eventos/cambiar de ancho conserva lectura; el usuario que sube no es llevado al fondo |
| UX11 | Adjuntos conservan identidad, miniatura, revisión, texto y recuperación ante error/unknown; sin replay automático |
| UX12 | Respuesta, resultado consultado, propuesta y efecto ejecutado se distinguen sin depender sólo del color |
| UX13 | Confirmación/corrección/expiración/uncertainty mantienen hash/revisión, editor y recibos actuales; ventas siguen sólo lectura |
| UX14 | Error, vacío, carga inicial y reconsulta se distinguen; Sileo ES/EN sin duplicados ni modal cerrado por error |
| UX15 | Cambio chat/usuario,403 y respuestas tardías no mezclan datos ni conservan acceso revocado |
| UX16 | Sin consultas por cada tarjeta oculta, descarga ilimitada de catálogo o peticiones generativas por montar/reordenar la UI |
| UX17 | Si cambia el núcleo compartido, Teacher conserva borrador, selección y voz sin dependencia de NodiaAI |
| UX18 | Claro/oscuro, ES/EN, teclado/foco y zoom no ocultan consecuencias, valores, errores o controles |

UX01 requiere observación humana sobre tareas; una captura o un test automatizado
no acredita comprensión. No se inventa un porcentaje de mejora ni número de
usuarios para declararlo aceptado. Registrar tareas, dificultades y resultado.

### 9.2. Verificación proporcional

Perfiles base:320,390,600,900 y1440px, con al menos un viewport bajo en móvil y
escritorio. Usar ES/EN y ambos temas, sin repetir por rutina todo el producto.
Incluir teclado, foco/Escape, zoom200%, nombres largos, código/tabla/URL larga,
error de API, catálogo inválido, selección histórica,403 y callbacks tardíos.
Teclado virtual/orientación/safe area en teléfono físico se registran aparte
de viewport redimensionado o emulación Chromium; no prometer Safari probado.

Priorizar regresiones existentes de `ComposerSelection`, `ChatComposer`,
`ChatMessage`, `MessageMarkdown`, `ConversationHistory`, adjuntos/voz,
`useConversationDraft`, `useRunCancellation`, propuestas/ejecuciones e identidad.
Añadir pruebas en la unidad pequeña que posea el comportamiento cambiado. La
suite de página existente se conserva/evalúa, pero no se crea otra suite grande
para duplicar combinaciones ya cubiertas. Un recorrido integrado concreto sí
se justifica para selector→admisión, prepend→ancla y panel→borrador/foco.

Si cambia el núcleo compartido, incluir `src/test/components/MessageComposer/MessageComposer.test.tsx`,
`src/test/hooks/useVoiceDictation.test.tsx` y las unidades de Teacher
`SetupConversation.test.tsx`/`useSetupDraft.test.ts` afectadas, conservando sus
rutas actuales en Client.

Al implementar: tests adecuados y scripts reales `test`, `typecheck`, `lint` y
`build` de Client según skills. Si se modifica código compartido, incluir las
unidades afectadas de Teacher; si cambia Server, sus garantías requieren pruebas
propias. Validar fichas con `knowledge:check/build` sin publicar drafts.

### 9.3. Comparación y criterios de rendimiento

| Medida | Baseline de esta entrega | Cómo compararla al implementar |
| --- | --- | --- |
| Altura visible de lectura y compositor | Medida en seis perfiles comparables; §11/evidencia | Mismo viewport/shell/avisos/teclado y estado; registrar px antes/después |
| Clicks/acciones para escribir/cambiar IA | Flujo conocido por código; sin medición de uso | Misma tarea, selección aplicada y resultado; no ahorrar un clic eliminando confirmación |
| Scroll/overflow y ancla | Regla actual auditada; incidencia de dictado histórica | Medir documento/contenedores, foco y posición con los mismos fixtures |
| JS/CSS inicial y chunks de la ruta | Builds equivalentes y cierre estático de ruta medidos; §11/evidencia | Build equivalente, bytes bruto/gzip y recursos de ruta; separar propio/terceros |
| Consultas/red por abrir chat/selector/historial | Apertura chat: siete GET idénticos; edición/errores sintéticos en evidencia | Requests por intención/estado con transporte controlado; no inferencias reales |
| Coste de render/scroll con historial largo | No medido; no se reclama ahorro de render/latencia | Fixture del mismo tamaño, entorno/perfil reproducible, sin ampliar page size |

Objetivo: ganar lectura y reducir carga de controles permanentes sin perder
información/acciones ni añadir requests injustificados. No comprometer un ahorro
porcentual sin baseline. Si una extracción/lazy loading no ahorra o regresa,
descartarla conforme37. No añadir virtualización o dependencias por anticipación;
evaluarlas sólo ante un coste demostrado y preservando anclas/accesibilidad.

## 10. Riesgos, continuidad y cierre documental

- Reducir chrome puede ocultar bloqueos importantes: los avisos que requieren
  actuación permanecen visibles junto al compositor/resultado relevante.
- Plegar selección puede descartar o esconder un borrador: dueño estable, dirty
  visible y guard de envío también fuera del panel.
- Cambiar altura/scroll puede afectar shell/teclado y lectura: baseline con
  reserva existente, sin nuevos listeners/offsets globales o segundo scroll total.
- Simplificar tarjetas puede mezclar autoridad: conservar acciones y estados de
  dominio, contratos/propuestas exactos y detalles técnicos consultables.
- Un refactor compartido puede cambiar Teacher: aislamiento por wrapper, tests
  afectados y adopción independiente; no extender el rediseño a Teacher106.

Mantener la implementación en entregas reversibles con commits acotados por
responsabilidad y una verificación integrada final. No envolver todo en un flag
remoto nuevo ni duplicar la aplicación para permitir volver atrás. La adopción
operativa conserva el procedimiento y rollback del entorno; este plan no los
ejecuta ni vuelve a abrir despliegues históricos.

**Evaluación de impacto NodiaAI:** la primera versión cambia presentación y
acceso a controles existentes. No añade conceptos ejecutables, herramientas,
permisos, fuentes de contexto, formatos o inferencias. Actualizar la ficha
existente `nodia-ai.chat-composer-selection` y el producto. El producto permanece
draft/partial; la ficha conserva draft/implemented para el compositor existente,
con la evolución expresamente planificada, sin acreditarla por ese estado previo.
Ambos siguen unregistered/approval:null; no crear una herramienta ni ficha por
estilo. Cualquier función nueva fuera de§6 requiere su propia evaluación.

Validación documental de esta entrega: enlaces locales, metadatos/revisiones,
UTF-8/LF, diff y knowledge check/build. La release publicable debe conservar sus
44 documentos/46fragmentos y su identidad previa; el diseño sigue excluido.
Los resultados efectivos se registran tras ejecutar los checks, sin atribuirles
aceptación de UI. **Próxima acción: NAIUX-07 del§7; ver cierre local en§11.**

### Comprobaciones ejecutadas — 2026-11-15

- Rama/base Git comprobadas; ocho archivos documentales afectados, sin cambios
  de código de aplicación. Checkout inicial limpio.
- 44 enlaces locales añadidos comprobados, incluidos sus anchors; UTF-8/LF sin
  BOM, metadatos y revisiones válidos. `git diff --check` correcto.
- Producto revisión77 y ficha del compositor revisión13 conservan sus estados
  de implementación previos, draft/unregistered/approval:null. El rediseño sigue
  planificado; las notas y los enlaces no lo convierten en operativo.
- `knowledge:check` y `knowledge:build` correctos:95fuentes,51excluidas,
  44documentos/46fragmentos. Release antes/después idéntica:
  `9f7cb7e13becc051f1c90d6f2e0014eb18f78e4711a2a820971c38a2df4c77e8`.
  Ningún borrador añadido al contexto publicable.
- Revisión independiente de Client/plan completada; se corrigieron nombres de
  unidad compartida y la referencia a streaming para respetar el polling actual.
  UI NodiaAI, comprensión humana, rendimiento y dispositivos siguen sin medición
  nueva. Tests/build de aplicación se reservan para las entregas de código.

## 11. Implementación local solicitada en la misma rama — 2026-11-15

El usuario autorizó implementar el plan preservando las funcionalidades. Se
completan NAIUX-00/06 por alcance local; NAIUX-07 conserva revisión humana,
teléfono/teclado físico y adopción del entorno, sin aprobación documental nueva.
[Evidencia consolidada](../evidence/nodia-ai-ux-upgrade-20261115.md).

- Workspace flex que usa el viewport disponible, sin mínimos520/580px u offsets
  por breakpoint. Opt-in `data-page-layout=conversation` en BaseLayout y cadena
  explícita `data-route-guard`/`data-route-view`; otras páginas conservan su layout.
  Padding, navegación y reserva móvil existentes permanecen.
- Historial local plegable en desktop, overlay móvil y menús/filtros/paginado
  actuales. ResizeObserver local y ancla por mensaje preservan fondo/lectura al
  cambiar ancho o altura, sin reemplazar la recuperación del prepend.
- Asistente editorial, usuario a derecha, ritmo24px aplicado a los artículos
  reales dentro del wrapper de Boneyard, Markdown seguro y copia del texto visible
  con Sileo ES/EN. Propuestas/resultados/recibos y cargas por intención conservados.
- Compositor de dos niveles: texto ancho y fila adjuntar/IA aplicada/dictar/Enviar
  o Stop. `MessageComposer.layout=stacked` es optativo; Teacher sigue inline.
  Un solo textarea/dueño de captura. Avisos dirty/error pasan a ancho completo.
- Editor IA en Popover MUI modal, anclado arriba, ancho independiente del resumen,
  scroll local y montaje conservado tras primera apertura. Aplicar/Cancelar,
  elegibilidad exacta, selección aplicada/borrador y errores mantienen sus reglas;
  el foco vuelve al resumen nuevo tras confirmación, sin robarlo en refetch.
- Adjuntos, revisión, dictado, límites, incertidumbre y botones de recuperación
  reutilizan sus contratos; no hay edición/regeneración/ramas ni herramientas nuevas.

### Resultado y validación por alcance

Chrome157/Chromium headless:28 perfiles entre320–1440px, ES/EN y ambos temas,
sin overflow horizontal/excepciones o HTTP real a APIs. GuardStrict real con
adapter sintético conserva textarea/borrador e inert durante revalidación/error.
Selección fallida, plegado dirty, resize, éxito/foco y revisión de adjunto503
conservan datos. Dictado simulado no envía; no acredita micrófono físico.

Lectura desktop1440×900:565→616px;390×844:357→420px. Compositor320px:
195→120px. A320×568, documento870→568px y controles accesibles sobre la reserva;
la región antigua315px desbordaba el viewport, no equivale a144px efectivos nuevos.
Se descarta la variante de tres filas por su coste de altura. Primer baseline no
reprodujo el desborde61px histórico de93; el candidato tampoco lo muestra en el
estado simulado, sin certificar todos los dispositivos.

Suite final Client: **3013 pruebas/363 archivos correctos** con4workers y sin
build/lint concurrentes. Build/tipos y lint de código correctos, excluyendo `.tmp`
generados del lint; el comando sin exclusión encuentra errores previos en esos
experimentos. La ronda global anterior tuvo un timeout RTL del badge OCR bajo
carga; caso/suite aislados pasaron sin cambios de código/assertions/timeout.
La causa concreta no quedó aislada y el recibo conserva ese resultado previo.

Builds production equivalentes: JS total+8792bytes/+1845gzip; CSS idéntico.
Cierre estático de ruta+9273bytes/+2263gzip, sin lazy/cache/latencia medidos.
Los siete GET iniciales se conservan; no se presenta el cambio como ahorro de
red o ejecución IA. La evidencia registra método gzip y límites.

Conocimiento comprobado sin publicar drafts; producto/ficha conservan aprobación
null y estados por alcance. No backend, migraciones, cuentas, inferencias,
cancelaciones reales o despliegue. Los warnings previos de React/Emotion y
bundle>500kB mantienen su alcance. Reanudar en NAIUX-07; no repetir construcción,
baseline o gates históricos por leer el checklist original.
