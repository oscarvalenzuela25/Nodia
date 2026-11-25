# Teacher — rediseño guiado de UX/UI e implementación por etapas

> Estado documental: en revisión. **TUX-001 cerrado por alcance entregado y
> aceptación humana el2026-11-16; ver§14.** Alta guiada, paneles/selector y revisión
> legible aceptados por el usuario. **TUX-03/05 cerrado por instrucción del
> usuario el 2026-11-17.** Implementación y QA local en §15, cierre en §16.
> Solicitud posterior del mismo día: empezar el desarrollo desde development.
> Esta autorización sustituye el límite documental inicial, sin aprobar el diseño
> completo ni acreditar comprensión humana, inferencia o adopción operativa.
> Solicitud confirmada: el usuario encuentra Teacher engorroso y no entiende cómo
> utilizarlo, especialmente durante la creación. Pide rediseñar la experiencia
> con skills de diseño y documentarla para implementar más adelante.
> La necesidad está confirmada; el flujo, textos y fases siguientes son propuesta,
> sin aprobación integral. Seguimiento central: [TODO](TODO.md), `TUX-001`.

## 1. Resultado esperado y límites

Una persona que llega por primera vez entiende qué debe hacer, qué se guardó,
qué está preparando la IA y qué decisión debe tomar después. Crear un estudio
no exige aprender el vocabulario de la implementación ni configurar herramientas
pedagógicas avanzadas. El recorrido principal conduce de una intención de
aprendizaje a una primera lección utilizable y permite retomar sin reconstruirla.

Rediseñar Mis planes, alta, definición, revisión del plan, espera/recuperación,
primera lección y acceso a herramientas secundarias. La prioridad de construcción
es el arranque; el resto se integra después sin perder las capacidades actuales.
Conservar sidenav/topbar, MobileBottomNav, theme, rutas canónicas, propiedad,
datos/historial y contratos pedagógicos. El corte documental inicial no iniciaba aplicación ni operaciones. La solicitud
posterior autoriza la primera entrega Client de§10; conserva fuera de este lote
migraciones, inferencias, instalaciones, despliegues y nuevas herramientas IA.

## 2. Fuentes y diagnóstico de la experiencia actual

Leer antes de implementar: [95](95-studies-adaptive-learning.md),
[96 §43](96-nodia-teacher-implementation-plan.md#43-alta-de-estudio-razonamiento-recuperable-y-menú-persistente--2026-11-14),
[97](97-nodia-teacher-technical-contracts.md), [98](98-nodia-teacher-start-handoff.md),
[101](101-nodia-teacher-adaptive-upgrade-plan.md),
[102](102-nodia-teacher-phased-implementation-and-final-qa.md),
[ADR100](../architecture/decisions/ADR-100-teacher-first-generation-with-explicit-ai-selection.md),
[autoridad89](89-module-access-and-user-data-scope.md) y
[rutas ADR092](../architecture/decisions/ADR-092-stable-module-navigation-routes.md).

Hecho humano: la dificultad fue reportada por el usuario. Hechos de código:
alta con formulario completo y SelectionPanel; crear con `start_plan:true`
prepara una propuesta; aceptarla y generar material son operaciones posteriores.
PlanReview comienza con edición estructural y el espacio de sesión reúne
conversación, trabajos y herramientas adaptativas.

Las siguientes causas son hipótesis de UX derivadas de esa estructura, pendientes
de contrastar con un recorrido observado: demasiadas decisiones simultáneas,
etiquetas parecidas para propuesta y plan aceptado, herramientas especializadas
presentadas antes de saber qué hacer y falta de una siguiente acción dominante.
Las pruebas técnicas previas y una propuesta GPT/medium generada en producción
no acreditan comprensión del usuario ni cierran este rediseño.

Trazabilidad de baseline, verificada por lectura, no por ejecución de UI:

| Área | Archivos de entrada |
| --- | --- |
| Alta | [TeacherNew](../../nodia-client/src/modules/teacher/pages/TeacherNew/TeacherNew.tsx), [SessionFields](../../nodia-client/src/modules/teacher/components/SessionForm/SessionFields.tsx), [formValues](../../nodia-client/src/modules/teacher/components/SessionForm/formValues.ts) |
| Definición/IA | [Teacher](../../nodia-client/src/modules/teacher/pages/Teacher/Teacher.tsx), [SetupConversation](../../nodia-client/src/modules/teacher/components/SetupConversation/SetupConversation.tsx), [SelectionPanel](../../nodia-client/src/modules/teacher/components/SelectionPanel/SelectionPanel.tsx) |
| Revisión/estudio | [PlanReview](../../nodia-client/src/modules/teacher/components/PlanReview/PlanReview.tsx), [StudyJourney](../../nodia-client/src/modules/teacher/components/StudyJourney/StudyJourney.tsx), [AdaptiveWorkspace](../../nodia-client/src/modules/teacher/components/AdaptiveWorkspace/AdaptiveWorkspace.tsx) |
| Contratos | [DTOs](../../nodia-server/src/teacher/dto/teacher.dto.ts), [entrada de plan](../../nodia-server/src/teacher/policies/teacher-initial-plan.ts), [comandos](../../nodia-server/src/teacher/use-case/execute-teacher-command.use-case.ts), [schemas Client](../../nodia-client/src/modules/teacher/infrastructure/schemas.ts) |

## 3. Principios de interacción y dirección visual

- Una tarea principal por pantalla y una acción principal por estado; acciones
  opcionales próximas a su contexto. Explicar el resultado del botón antes de usarlo.
- Divulgación progresiva: opciones avanzadas accesibles sin convertirse en tareas
  obligatorias del estudiante. El chat asiste cuando se pide; no es el único camino.
- Mostrar progreso real y dónde continuar. No usar el mismo stepper para mezclar
  preguntas del formulario, trabajos remotos y avance de todo el curso.
- Presentación de cuaderno de estudio guiado: jerarquía clara, texto respirable,
  controles visibles y paneles acotados. Evitar dashboard con métricas, menús y
  tarjetas de igual peso compitiendo antes de empezar.
- Lenguaje humano: «propuesta», «usar este plan», «preparar lección», «continuar».
  Hash, CAS, fences y leases quedan fuera del recorrido ordinario; diagnóstico
  técnico accesible cuando ayude a resolver un error, con detalles seguros.

Aplicar skills locales `frontend-design`, `responsive-design`, `accessibility`,
`create-component` y `frontend-quality`. Consultar `composition-patterns` al
separar componentes y `vitest` al crear regresiones. Seguir DESIGN9/10 y plan37.
Usar MUI/Emotion, inputs compartidos y DM Sans/tokens actuales; las sugerencias
creativas de una skill no autorizan cambiar fuentes, theme o navegación global.

## 4. Recorrido propuesto

```text
Mis planes → Nuevo estudio
  1. Qué quieres aprender → 2. Cómo quieres organizarte → 3. Revisar y preparar
    ├─ Guardar borrador y salir → borrador retomable, sin generación
    └─ Crear propuesta → preparación → lectura del plan propuesto
         ├─ Ajustar → revisar nueva versión
         └─ Usar este plan → plan aceptado → preparar primera lección → estudiar

Desde un borrador guardado: aclarar objetivo o evaluar punto de partida (opcionales).
Volver a un estudio existente: continuar desde su estado real, sin repetir el alta.
```

### 4.1 Mis planes: entender y retomar

Conservar búsqueda/paginación/archivo y acceso autorizado. Estado vacío con una
explicación corta y «Crear mi primer estudio». Con datos, «Nuevo estudio» y cada
estudio muestra nombre, objetivo resumido, estado comprensible y siguiente acción.
No llenar la cabecera de métricas de aprendizaje no disponibles.

La tarjeta conduce al trabajo o punto de lectura real: borrador, propuesta pendiente,
lección en curso o problema que requiere atención. «Continuar» no genera contenido
ni cambia la selección IA por abrir la tarjeta. Orden/recomendaciones proceden
de contratos existentes; no inventar «recomendado» o progreso por datos ausentes.

### 4.2 Alta: tres pasos, sin generación al avanzar

Página `/nodia-teacher/new`; paso actual anunciado «Paso 1 de 3». Anterior conserva
todos los campos y errores pertinentes. Los pasos completados se pueden revisar;
no saltar validaciones obligatorias del payload final. No crear sesiones por paso.

| Paso | Contenido visible | Ayuda y resultado |
| --- | --- | --- |
| 1. Qué quieres aprender | Título opcional primero, tema y objetivo obligatorios | Distinguir tema («SQL») y objetivo («consultar y agrupar datos»), como ejemplos ilustrativos, sin insertarlos como respuestas. Etiquetas persistentes y una frase de ayuda por campo |
| 2. Cómo quieres organizarte | Idioma y organización; cantidad de jornadas al elegir esa opción | «Que Teacher proponga», «Por temas», «Por jornadas». Base declarada/contexto en «Añadir contexto (opcional)», sin impedir el camino principal |
| 3. Revisar y preparar | Resumen editable por enlaces a los pasos y selección IA explícita | Explicar que se preparará una propuesta revisable. Conexión/modo/modelo y razonamiento si corresponde, sin esconder una selección obligatoria en un menú sin señal |

En pasos1/2, «Continuar» sólo valida/navega localmente y no genera ni ejecuta
mutaciones. En paso3: principal «Crear propuesta»; secundaria «Guardar borrador
y salir». El guardado no necesita IA lista. Una selección previa se restaura
únicamente si sigue siendo exactamente válida; nunca elegir otra silenciosamente.
Sin conexión/modelo, indicar cómo resolverlo o permitir guardar borrador. No exigir
al usuario el módulo administrativo IA para utilizar una conexión autorizada.

La organización inicial actual es `teacher_suggests`; el idioma inicial viene
de la regla existente de interfaz, se muestra y es modificable. Conservar estos
defaults no acredita capacidad de ningún proveedor. No agregar defaults de modelo.

### 4.3 Datos mínimos y persistencia honesta

| Campo | Contrato Server actual | Tratamiento del wizard |
| --- | --- | --- |
| `topic` | Obligatorio,1–240 | Tema, requerido; conservar límites |
| `objective` | Obligatorio,1–2000 | Qué quiere conseguir, requerido |
| `title` | Opcional,1–120 si se envía | Título primero, marcado opcional; vacío se omite como hoy |
| `explanation_language` | Obligatorio,2–35 y etiqueta válida | Idioma visible; conservar valor histórico/regional válido |
| `declared_base`, `context` | Opcionales/nulos, hasta4000 | Ayuda contextual; no exigir prosa adicional para continuar |
| `organization` | Opcional Server, default teacher_suggests | Elección visible con semántica actual |
| `day_count` | Opcional/nulo,1–365 si se aporta | Sólo visible para jornadas; no imponer obligatoriedad nueva: entrada inicial Server permite null incluso con days |
| `selection` | Opcional para guardar, necesaria al generar | Tupla exacta; mostrar errores junto a la selección |
| `start_plan` | true inicia candidata; false no genera | Ligado a la acción final explícita, nunca a montar/avanzar |

El POST actual de borrador también requiere tema, objetivo e idioma. **El alta
incompleta sólo tiene estado local** en esta propuesta: no anunciar «guardado»
antes del acuse del Server ni prometer restauración tras recarga. Volver entre
pasos, cambiar tema visual o redimensionar conserva ese estado. Antes de salir,
usar guard de cambios no guardados y ofrecer continuar editando o guardar sólo
si el formulario cumple el contrato. No introducir browserstorage para resolverlo.

Autoguardado temprano de un alta incompleta sería una ampliación contractual
separada con privacidad, expiración, idempotencia y compatibilidad propias.
No confundirlo con el autoguardado CAS existente del mensaje de definición en
una sesión ya creada. No duplicar una sesión si el resultado del POST es incierto;
consultar recibo/recuperación existentes antes de admitir una intención nueva.

### 4.4 Borrador guardado: ayuda opcional

Mostrar resumen y «Crear propuesta» como siguiente acción cuando esté permitido.
«Aclarar mi objetivo» abre la conversación contextual; «Evaluar mi punto de
partida» abre el diagnóstico pedagógico opcional. Ninguno es obligatorio para
todos. Banco/mapeos no aparecen como tareas de creación que el alumno debe resolver.

Diagnóstico sólo con banco revisado para ese alcance; si falta, explicarlo y
permitir seguir desde la base declarada. Pausar/omitir no implica nota cero ni
impide indefinidamente crear. Aclarar que no es una prueba final ni un nivel
oficial. Selección técnica de IA y evaluación de conocimientos son cosas distintas.

Un mensaje escrito y no enviado no entra a una propuesta. Explicar junto al botón
la condición actual y permitir enviar, seguir editando o descartar expresamente
el mensaje; no perderlo ni enviarlo al pulsar «Crear propuesta» sin intención.
Pedir una respuesta de IA sigue siendo acción explícita con coste/recuperación.

### 4.5 Preparación, errores y resultado incierto

Pantalla contenida con qué se está preparando, selección utilizada y resultado
esperado; «Puedes volver a Mis planes y retomarlo». Mostrar sólo fases/tiempos
que el backend entrega. Sin porcentaje o ETA inventados, spinner eterno sin salida
ni sugerencia de volver a pulsar Crear para recuperar una generación existente.

| Estado técnico real | Explicación propuesta | Acción permitida |
| --- | --- | --- |
| queued/running | Propuesta en preparación, con fase real si existe | Consultar estado/volver al listado; cancelación sólo si el contrato la ofrece |
| ready con candidata | Tu propuesta está lista para revisar | Revisar propuesta; no autoaceptar |
| failed_known | No se pudo completar, con motivo seguro útil | Corrección y nueva intención sólo según acciones nativas permitidas |
| unknown/cierre pendiente | Estamos comprobando qué ocurrió con la solicitud | Consultar estado/recibo y conciliación; sin replay o cambio automático de IA |
| pérdida de sesión/conflicto | Recuperar acceso o revisar versión guardada | Preservar datos y aplicar la recuperación actual, sin sobreescribir remoto |

Cuando Consultar guardado devuelve 404, Mis planes conserva el acceso al
listado, filtros y apertura de planes. El 404 deja la solicitud original
pendiente. El usuario puede consultar de nuevo o pedir el cierre explícito
de esa clave. Teacher recupera el recibo si la operación ya se guardó. Si el
servidor confirma el cierre, se puede iniciar un nuevo guardado con el
formulario intacto. Ver [el contrato de recibos](97-nodia-teacher-technical-contracts.md#6-dtos-y-rutas-http).

«Actualizar estado» es lectura/conciliación; «Volver a preparar» es otra intención
y no se ofrece cuando no es segura. Mantener los trabajos al salir de la vista
sin prometer cancelación remota. Toast y aviso inline con un único responsable.

### 4.6 Revisar propuesta sin comenzar por el editor completo

Primero lectura: título, objetivo, organización y estructura de secciones/unidades,
base declarada/evidencia/partes sin evaluar cuando existan. «Usar este plan» es
la acción principal; «Pedir un ajuste» y «Editar estructura» son alternativas
visibles de menor énfasis. El editor avanzado conserva toda la capacidad actual
sin exigir que cada alumno edite prerrequisitos o políticas.

La confirmación explica qué plan/revisión se utilizará; reutilizar el mecanismo
exacto de aceptación por hash/revisión. No agregar confirmaciones redundantes sin
riesgo concreto. Aceptar no depende de una inferencia nueva o proveedor disponible.
Conflicto mantiene edición y exige revisar la versión actual; nunca aceptar otra
revisión por actualizar la pantalla. Las modificaciones de un plan aceptado siguen
el flujo versionado propio y conservan historial/material/intentos.

### 4.7 Primera lección y continuidad

Tras aceptar, mostrar «Tu plan está listo» y siguiente unidad real. Si falta
material, «Preparar primera lección» explica que usa IA; no generarlo automáticamente
por aceptar. Si ya existe, «Abrir lección». Leer teoría no genera ni verifica
comprensión. Conservar navegación y finales directas permitidas por contrato.

En estudio: contenido principal y posición actual visibles; «Continuar» retoma
cursor/unidad/intento existentes. Ayuda, práctica, refuerzo y ruta se abren desde
contexto. En secundario, acceso descubrible a repaso, evidencia, fuentes, conceptos,
diagnóstico y configuración; no eliminar funcionalidades para limpiar la pantalla.
Preservar respuestas/borradores al pausar, fallar o cambiar viewport.

## 5. Diseño responsive y accesibilidad verificable

En desktop, formulario principal con resumen lateral sólo cuando el espacio lo
permita; resumen móvil compacto/plegable. Un único estado y orden DOM de lectura,
sin montar dos formularios. Stepper móvil compacto con nombre de paso y3pasos
accesibles, sin scroll horizontal para entenderlo. Botón principal ancho completo
en xs y Anterior/Salir accesibles. No añadir barra fija que compita con MobileBottomNav.

`PageContent` conserva16px vertical, laterales16/24/32px xs/sm/md y reserva móvil.
Sin doble padding; gap vertical24px/horizontal16px. Inputs reutilizables, labels,
errores específicos, targets44px y foco visible. Al avanzar, foco al título del
paso; en error al primer campo inválido con resumen accesible cuando corresponda.
Navegar atrás conserva valores. Contenido/ayudas no depende de hover; teclado,
lectores, zoom y reduced motion contemplados. Estados de carga según Client:
Boneyard sólo contenido inicial, sin skeleton en controles ni reemplazo de datos
durante revalidación. No declarar certificación de accesibilidad por esta guía.

Copy candidata ES/EN, a integrar en `teacher` sin hardcoding al implementar:

| Intención | Español | English |
| --- | --- | --- |
| Comenzar | Nuevo estudio | New study |
| Paso1 | Qué quieres aprender | What you want to learn |
| Paso2 | Cómo quieres organizarte | How you want to study |
| Paso3 | Revisar y preparar | Review and prepare |
| IA explícita | IA para preparar tu plan | AI to prepare your plan |
| Generar candidata | Crear propuesta | Create proposal |
| Guardar sin generar | Guardar borrador y salir | Save draft and leave |
| Aceptar | Usar este plan | Use this plan |
| Material | Preparar primera lección | Prepare first lesson |
| Recuperar lectura | Continuar estudiando | Continue studying |

Los textos finales se validan por comprensión, no por una traducción literal.
Las ayudas aclaran consecuencias, sin instrucciones de implementación en UI.

## 6. Invariantes y compatibilidad

No cambiar90%, final independiente, asistencia/pending, evidencia/historial,
criterios de dominio o presupuesto para hacer más fácil el recorrido visual.
Aplicar `allowed_actions` y autoridad vigente Server en cada operación. Rutas
existentes conservadas, sin prefijos nuevos de menú ni exigencia de NodiaAI.

ADR100: primer intento directo con IA explícita, sin canary obligatorio.
Elegibilidad no equivale a inferencia; ningún siguiente paso, GET o selector
dispara prueba generativa. Tupla exacta, reserva de presupuesto, fences/CAS,
idempotencia/cierre y no-replay conservados; sin modelos estáticos/fallbacks.

El paso de UI se deriva del estado real; no marca como completada una operación
Server ni reinicia sesiones históricas. No añadir tabla de pasos sólo para un
stepper. Al retomar un plan aceptado se entra al estudio, no al nuevo wizard.
No mover herramientas especializadas detrás de permisos nuevos inventados.

Esta propuesta cambia presentación futura y jerarquía; no invalida pruebas de
reglas vigentes ni marca como reprobados sus resultados. Al implementar, actualizar
las secciones de UI afectadas de95/96/97/102 y DESIGN; conservar cortes históricos.
Una modificación de contrato costosa de revertir exige ADR y aceptación propias.

## 7. Plan de implementación futura por entregas

| Fase | Trabajo | Salida y criterio para continuar |
| --- | --- | --- |
| TUX-00 | Reconciliar baseline/entorno y observar el recorrido difícil con usuario | Mapa de tareas/campos/estados reales; decisiones de copy y prototipo contrastadas; no repetir inferencias inciertas |
| TUX-01 | Prototipo de alta3pasos, borrador, preparación, revisión y primera lección | Flujo navegable con fixtures identificados, ambos temas/móvil; validar comprensión antes de fijar componentes |
| TUX-02 | Implementar alta guiada contra DTOs actuales | Validación, elección IA exacta, back/exit, guardado confirmado y creación única con recuperación; sin nuevas inferencias por paso |
| TUX-03 | Borrador/definición opcional, estado y recuperación claros | Próxima acción real, mensaje sin enviar protegido, fallos/cierres inciertos recuperables |
| TUX-04 | Revisión legible, edición progresiva y aceptación | Misma revisión/hash; sin autoaceptación, cambios conservados y planes históricos utilizables |
| TUX-05 | Primera lección, continuidad y herramientas secundarias | Generación material explícita, lectura/pausa/cursor/intento conservados y funciones avanzadas encontrables |
| TUX-06 | QA integrado, comprensión, rendimiento y adopción por entorno | Evidencia por versión/perfil; correcciones y revisión documental antes del despliegue correspondiente |

Reutilizar componentes/normas en sus módulos. Extraer lógica de estado/presentación
en hooks/policies pequeños con valor probado; no duplicar runtime ni importar
componentes de negocio de NodiaAI para conseguir un chat. El rediseño tiene
plan propio: no reiniciar F0–F9 de102 ya verificados para sus alcances.

## 8. Aceptación funcional y de usabilidad

| ID | Garantía observable a comprobar durante implementación |
| --- | --- |
| UX01 | Primera visita identifica objetivo y siguiente acción sin explicación del implementador; crear un estudio con datos mínimos válidos |
| UX02 | Diferencia guardar, generar propuesta, aceptar y preparar material; no cree que la generación acepta o inicia sola el curso |
| UX03 | Volver entre pasos/temas visuales/viewport conserva valores; salida no confirmada advierte y no anuncia guardado inexistente |
| UX04 | Guardar no exige IA lista; crear sí requiere selección exacta; ausencia de modelo/configuración ofrece salida comprensible sin fallback |
| UX05 | No llama IA al avanzar, abrir/retomar o aceptar; material y diagnóstico respetan intención y contratos propios |
| UX06 | Repetir la misma intención tras doble clic/dos pestañas/POST perdido conserva request key y recupera el resultado sin duplicar sesión/trabajo/aceptación; nuevas intenciones expresas pueden crear estudios distintos. Unknown sólo concilia |
| UX07 | Error de formulario/HTTP/selección y conflicto conservan datos; controles/feedback accesibles y sin modal cerrado por fallo |
| UX08 | Plan aceptado existente abre sin repetir onboarding; contenido, intentos, finales y90% conservan reglas |
| UX09 | Diagnóstico opcional sin banco muestra sin evaluar y permite seguir; banco/mapeos no son pasos obligatorios para el alumno |
| UX10 | Propuesta editable y aceptación exacta siguen disponibles; tools secundarias se encuentran sin competir con acción principal |
| UX11 |320/600/900/1440px, ES/EN, claro/oscuro, zoom200%, teclado/foco, textos largos y datos ausentes sin overflow o controles tapados |
| UX12 | Revalidar mantiene contenido y borrador; comparar por ruta/perfil peticiones/tiempos/bundle con baseline, sin carga completa innecesaria |

Pruebas en unidades de validación/transiciones/hooks/componentes atómicos;
integración aislada sólo para garantías que cruzan capas, autorización, CAS y
concurrencia. Sin suites espejo masivas de páginas ni contar tests como objetivo.
Recorrido integrado justificado: alta→propuesta→aceptación→material→pausa/retoma.
Usar fixtures para errores y rutas reales sólo con entorno/selección identificados.

Validación de comprensión con usuario: crear desde cero, guardar sin generar,
retomar borrador, explicar propuesta frente a plan, corregir un dato y abrir/retomar
primera lección. Registrar tropiezos, ayuda requerida y tiempo observado comparado
con baseline; no inventar resultados, porcentajes de mejora o plazos prometidos.
Éxito técnico y aceptación UX son evidencias distintas; cerrar después de revisar
ambas, conservando los límites por dispositivo/proveedor/entorno.

## 9. Checklist de continuidad

- [x] Solicitud, baseline de código, límites y fases documentados.
- [x] Fichas e índices enlazados; TODO central con punto de reanudación.
- [x] TUX-00/01: revisión del candidato entregado cerrada por aceptación funcional
  del usuario en§14; no acredita un estudio observado, tiempos o prototipos adicionales.
- [x] TUX-02: primera entrega Client de alta guiada y regresiones locales; ver§10.
- [x] TUX-04: revisión legible implementada/comprobada en§13 y aceptada por el
  usuario en§14, conservando revisión/hash y edición progresiva.
- [x] TUX-06: cierre del alcance entregado con QA técnica registrada y aceptación
  humana de§14. Entornos/dispositivos específicos no descritos no se dan por probados.
- [x] Evolución fuera del cierre TUX-001: TUX-03/05, definición/espera y primera
  lección/continuidad guiadas implementadas localmente; ver§15.
- [x] QA técnica local integrada de§15; evidencia final enlazada.
- [x] Cierre de TUX-03/05 por instrucción del usuario, ver §16.

El corte inicial fue exclusivamente documental;§10 registra su primera implementación. Ficha candidata:
[experiencia guiada](../nodia-ai/knowledge/studies/features/guided-setup-and-study-experience.md),
enlazada desde [Teacher](../nodia-ai/knowledge/studies/README.md). Sin aprobación
automática, publicación o disponibilidad operativa del rediseño.

Comprobación de esta especificación: contratos de alta/aceptación/material y
checklist revisados; enlaces locales/anclas, frontmatter y UTF-8/LF verificados.
Validación de conocimiento Server correcta; el borrador nuevo se excluye del
corpus publicado. Sin pruebas de aplicación o UI por esta entrega documental.

## 10. Primera entrega local — solicitud de desarrollo2026-11-15

Rama `codex/teacher-guided-ui`, creada desde `origin/development` actualizado
`ae35b02e`, con árbol inicialmente limpio. La solicitud de empezar desarrollo
permite construir el alta mientras observación humana TUX-00 y contraste de
comprensión TUX-01 siguen pendientes explícitos. Este candidato funcional puede
servir para esa revisión; no se inventa un recorrido observado ni una aprobación.

Implementado `/nodia-teacher/new` con tres pasos: objetivo, organización y
revisión. Título opcional, ayudas persistentes y errores específicos; contexto/base
plegables y cantidad de jornadas opcional. Una sola instancia RHF conserva valores
y errores; la selección IA se monta al llegar a revisión y se conserva al volver,
sin sustituir el borrador incompleto de conexión/modelo/esfuerzo. Resumen plegable
con accesos de edición y título del paso antes del resumen en DOM para que el foco
no salte por encima de la revisión en móvil. Theme, navegación y PageContent intactos.

Continuar/Anterior sólo validan y navegan localmente. Guardar usa el contrato
existente `start_plan:false`, sin exigir IA disponible; Crear propuesta utiliza
`true` y la selección exacta elegible. No acepta plan ni genera material. El guard
SPA y beforeunload protegen el alta sin persistencia anunciada: seguir editando,
salir explícitamente o guardar y continuar al destino sólo tras acuse. Error
conserva formulario/modal; resultado incierto mantiene el recibo y bloquea otra
mutación. Salir no cancela el trabajo ni borra la recuperación.

Se reutiliza `useTeacherCommand`: no cambia Server, idempotencia, autoridad,
presupuesto, modelos o perfiles. UX06 se limita a la misma request key: dos altas
independientes en pestañas distintas son intenciones distintas; no se incorpora
una deduplicación por contenido. La recuperación conserva únicamente metadatos
opacos existentes; los campos del wizard no se escriben en browserstorage.

Validación y comparación por perfil en [evidencia del lote](../evidence/teacher-guided-setup-20261115.md).
Comprensión humana, recorrido completo propuesta/aceptación/material del rediseño,
UI autenticada con shell/entorno real, teléfono físico y adopción VM/producción
siguen pendientes. Retomar TUX-03 sin reiniciar los upgrades históricos de102;
revisión legible TUX-04 y primera lección TUX-05 son entregas posteriores.

## 11. Cabecera, drawer adaptativo y selector IA — solicitud2026-11-16

El usuario aceptó los mockups de Teacher y autorizó implementar todos los cambios
en la rama actual `codex/durable-backend-uploads`, conservando los cambios locales
previos de NodiaAI. La última corrección del compositor elimina el botón «+»;
se toma el panel horizontal de configuración de NodiaAI como referencia visual,
sin importar sus herramientas, adjuntos ni runtime de negocio a Teacher.

### Alcance solicitado

- La fila del título asignado ubica el estado de la sesión al extremo derecho,
  también en las otras etapas. En móvil conserva título/estado legibles y orden
  de lectura, sin truncar información ni introducir padding exterior adicional.
- «Mis planes de estudio» utiliza la variante `contained` en todas sus apariciones.
- Se retira el panel adaptativo de la página. Un botón «Aprendizaje adaptativo»
  abre un Drawer lateral derecho inmediatamente después de la acción principal
  Pausar y guardar/Retomar y antes de Opciones de la sesión/Archivar.
- El Drawer conserva los botones de categorías, con filas adaptables y este orden:
  Mis fuentes, Evidencia y diagnóstico, Repasar, Actividades, Conceptos y
  Aclaraciones. Al entrar, Mis fuentes está seleccionado; pulsar otra categoría
  muestra sólo su contenido. Cerrar/cambiar categoría no pierde los borradores;
  reintento local y descarte de aperturas obsoletas conservan las reglas vigentes.
- «Resultado guardado» se ubica a la derecha de Opciones de la sesión o de Archivar
  en la misma barra de acciones. Se retira su botón de recarga contiguo; esto no
  elimina sondeo, errores o recuperación explícita del trabajo cuando correspondan.
  El indicador sigue describiendo un resultado confirmado, no una generación nueva.
- En el chat, el resumen compacto de modelo/modo abre un Popover anclado encima.
  Mantiene el diseño horizontal de «Configuración del chat»: resumen de IA aplicada,
  cierre y cuatro selectores redondeados de conexión, modo, modelo e intensidad.
  Se adapta al ancho disponible sin duplicar el selector. Aplicar/Cancelar,
  selección exacta, borradores, errores y elegibilidad mantienen su contrato.
  El editor Teacher conserva la caja de texto, selector y sus controles actuales
  de dictado/envío; no añade el botón «+» ni adjuntos de NodiaAI.

**Estado:** implementación y QA sintética local verificadas; regresiones,
tipado, lint de código y build correctos por los cortes descritos en evidencia.
La última alineación CSS xs también tiene lint focal y build final correctos,
con la matriz de seis perfiles repetida. La aceptación de los
mockups fija dirección visual y autoriza este desarrollo; no aprueba documentos,
fichas, disponibilidad de proveedores o una adopción productiva. La
[evidencia del lote](../evidence/teacher-drawer-chat-ui-20261116.md) separa los
resultados comprobados de los pendientes.

**Invariantes:** mismas rutas/módulo Teacher, autoridad por sesión/owner,
`allowed_actions`, generación sólo por intención explícita, selección/configuración
exactas, Server/DTOs/CAS/idempotencia, pausa/retoma, límites, confirmación,
recuperación y no-replay. Abrir un Drawer o Popover no implica inferencia,
aceptación de un plan, disponibilidad del modelo o guardado de una selección local.
No se amplían permisos ni se habilitan herramientas por cambiar presentación.

**Impacto de conocimiento:** se actualizan [producto Teacher](../nodia-ai/knowledge/studies/README.md#cabecera-drawer-y-selector-ia--solicitud2026-11-16),
[experiencia guiada](../nodia-ai/knowledge/studies/features/guided-setup-and-study-experience.md#cabecera-drawer-y-selector-ia--solicitud2026-11-16)
y [sesión/definición](../nodia-ai/knowledge/studies/features/session-setup-and-planning.md#cabecera-drawer-y-selector-ia--solicitud2026-11-16).
Sólo cambia la presentación y el acceso a controles existentes, sin nuevos
conceptos operativos, contexto enviado, herramientas o interpretación de resultados.
Las candidatas conservan draft/partial/unregistered/approval:null; no se modifican
fichas aprobadas ni se publican borradores. Este alcance no cierra TUX-00…06
ni hereda el despliegue, QA o inferencia de entregas anteriores.

Comprobación documental inicial: once documentos UTF-8/LF sin BOM y 25 enlaces/
anclas locales pertinentes válidos, diff correcto. Conocimiento check/build
correctos: 95 fuentes, 51 excluidas, 44 documentos/46 fragmentos, mismo release
`9f7cb7e13becc051f1c90d6f2e0014eb18f78e4711a2a820971c38a2df4c77e8`.
Los borradores permanecen excluidos; esto no acredita implementación o UI real.

### Validación local de la continuación

[La evidencia del lote](../evidence/teacher-drawer-chat-ui-20261116.md) registra
31 pruebas del selector y 42 del editor/estado. La suite global pasó 3027 pruebas
/364 archivos en 442,05s antes de la última incorporación de recuperación incierta;
11 regresiones focales posteriores (8+2+1) verifican ese ajuste en 7,58s. El
inventario suma 3028, sin afirmar una segunda ejecución global de esa cifra.
Tipado, lint de código y build correctos tras el ajuste de recuperación; avisos
previos del build conservados. Lint focal y build del último cambio CSS de alineación del chip en xs también
correctos; build final de 13,74s y matriz de seis perfiles repetida correcta.

Chromium sintético en 320–1440px, ES/EN claro/oscuro, comprueba plan, revisión,
lección, práctica, pausa y final: cabecera/acciones, Drawer/Popover, foco,
borradores y errores 503/esquema inválido. El chip conserva su posición a la
derecha al envolver en xs y los botones mantienen ancho completo. La selección
histórica incompleta del ensayo no solicita elegibilidad ni habilita generación;
un retry explícito del fallo conocido conserva tupla exacta.

La recuperación incierta se presenta dentro del Drawer con el mismo comando
propietario, sin duplicado en el fondo. La pérdida de respuesta al guardar fuente
conserva draft y consulta el recibo: un POST original y un GET, sin replay o
inferencia; bloqueo liberado tras acuse. El ensayo de selección 503/retry contiene
dos PATCH exactos. No hay POST/inferencia por abrir los paneles. Las fixtures no
acreditan UI autenticada, teléfono físico, aceptación pedagógica o adopción.

El log Vite de la QA emitió el aviso nativo de ResizeObserver durante resize/
textarea. Origen no aislado contra baseline, sin afirmar que sea previo o que
la consola esté libre de avisos; geometría, borrador, foco y recuperación sí
pasaron. Detalle y límites en la evidencia del lote.

Este párrafo conserva la observación inicial; su corrección posterior se sigue en
el [apartado12](#12-ciclo-de-medición-de-teacherloading--solicitud2026-11-16).

## 12. Ciclo de medición de TeacherLoading — solicitud2026-11-16

El usuario pidió corregir el aviso ResizeObserver en la misma rama sin alterar el
diseño ni perder borradores. La reproducción del recorrido de continuidad produjo
dos avisos nativos sin instrumentar; el diagnóstico por propietario de observador
identificó Boneyard sobre ancestros DIV de workspace/historial y el textarea MUI
en los ciclos afectados. El Skeleton seguía midiendo con `loading=false`.

La corrección limita Skeleton a la carga inicial y conserva LoadingRegion y los
dos wrappers neutros para los datos cargados. El formulario mantiene su nodo,
borrador, foco y caret al revalidar o cambiar ancho. No modifica Boneyard/MUI,
geometría, autosize, recuperación o contratos; no suprime errores globalmente.
El recorrido candidato instrumentado terminó sin avisos y mantuvo continuidad.

Estado: implementación local y regresión atómica de TeacherLoading (3 casos) correctas. Un
navegador nuevo sin parche de ResizeObserver completó tres recorridos de
continuidad y seis perfiles sin avisos nativos de este tipo; los borradores,
editor y recuperación se conservan. El compositor mantiene su textarea, texto,
foco y caret 4…13 en 1280→320→600→1280px y al abrir/cerrar el Drawer; una PATCH de
autoguardado sintética confirmada, sin avisos en ese recorrido. Geometría idéntica a la matriz anterior en
los seis perfiles; cuatro capturas idénticas y dos con diferencias limitadas a
controles, sin afirmar paridad de píxeles universal. La suite global completó
3033/3034 casos y 363/364 archivos; el único fallo corresponde a una versión de
test NodiaAI que cambió concurrentemente después del inicio. Esa revisión no se
modifica aquí. La revalidación focal actual pasa 60/60 casos en cinco suites
(14,18s), incluido el test concurrente; sin segunda global limpia afirmada.
Tipado, lint de código completo y build final correctos; build18,91s con avisos
de chunk grande/timing conservados. La corrección queda verificada por alcance
local. [Evidencia específica](../evidence/teacher-drawer-chat-ui-20261116.md#corrección-del-ciclo-de-medición--solicitud2026-11-16)
conserva el aviso inicial y distingue reproducción, candidato y checks pendientes.
No se traslada una medición local a todos los navegadores o a producción.

Impacto de contexto evaluado: es una corrección técnica sin cambios en conceptos,
operaciones, autoridad o interpretación de resultados de las fichas existentes.
No requiere nuevas fichas/herramientas ni aprobar o publicar candidatas. Sin
inferencia, despliegue o aceptación física nuevos.

## 13. Revisión del plan legible y edición progresiva — solicitud2026-11-16

El usuario encuentra ambigua y abrumadora la segunda etapa, «Revisar el plan»,
cuando se genera la propuesta. Solicita reformarla en la misma rama. Este lote
retoma TUX-04 y la dirección ya prevista en§4.6: primero comprender el recorrido,
después elegir si usarlo, pedir un ajuste o editarlo. No reinicia el alta ni las
entregas comprobadas de§10–12.

### Alcance e interacción

- Lectura inicial con título, objetivo y organización reales del outline y
  conteos derivados de sus secciones/unidades. Si la organización por jornadas
  no trae cantidad, no inventar duración o fechas. Mostrar la revisión exacta.
- Recorrido de secciones con detalles bajo demanda, sin abrir simultáneamente
  todos los campos. Objetivos y unidades siguen accesibles en su sección.
- Principal «Usar este plan» para la candidata actual; conservar «Activar
  revisión» cuando sea una revisión futura. «Editar estructura» y «Pedir un
  ajuste» son alternativas descubribles de menor énfasis, con variantes outlined.
  Usar una propuesta no prepara automáticamente material ni inicia una inferencia.
- Editar abre la estructura completa por intención: título, objetivo,
  organización/jornadas, obligatoriedad, prerrequisitos, objetivos, unidades,
  orden, exclusión, incorporación y política de evaluación mantienen sus reglas.
  Secciones editables plegables conservan IDs y valores al ordenar o cambiar ancho.
- El ajuste con IA se abre por intención y explica que prepara otra propuesta
  para revisar. Conservar borrador y bloqueo por la disponibilidad/acción real;
  escribir o abrir el panel no genera ni aplica cambios automáticamente.
- Con una propuesta disponible, la revisión precede a la conversación de
  planificación. Ésta queda bajo «Ver/Ocultar conversación de planificación» y
  sigue montada mediante `hidden`, conservando borrador, selección y editores.
  Sin propuesta, permanece visible como antes. No permitir plegarla durante
  grabación. El helper de «Usar este plan» explica que se guarda la propuesta y
  después se elige una unidad; no afirma que el material ya esté preparado.
- Guardar cambios manuales conserva la creación de una nueva revisión sin IA.
  Edición local o política inválida bloquean aceptación/ajuste con explicación
  visible y acceso al editor para corregir. Aceptar sigue disponible sin IA lista
  cuando lo permitan `allowed_actions` y los demás bloqueos reales.

### Identidad, borradores y límites

Conservar IDs/hash/revisión y comandos existentes de97. El estado del editor se
mantiene para la misma `proposalView.id`; sólo otra revisión confirmada puede
reemplazarlo mediante el límite de identidad actual. Guardar, aceptar y pedir un
ajuste siguen siendo acciones diferentes; no fusionar sus efectos.

`onSave`/`onAdjust`/`onAccept` devuelven `Promise<void>` y el padre puede resolver
esa promesa tras un `execute` fallido que devuelve `null`. Resolver la promesa
no acredita éxito: no cerrar editores, borrar texto o anunciar persistencia por
ese solo hecho.503/409 y resultado incierto conservan borradores y recuperación
actual, sin replay. `AssessmentPolicyEditor` conserva cantidades textuales
inválidas: mantenerlo montado al plegar o conservar explícitamente ese estado,
sin perderlo ni dejar un bloqueo oculto sin explicación.

Theme, rutas/autoridad, MobileBottomNav/safe area, padding de PageContent y
contratos Server permanecen vigentes. Controles de44px y acciones xs de ancho
completo; una sola instancia del editor/estado, orden de lectura y foco coherentes.
No añade modelos, inferencias, cuotas, evidencia educativa o capacidades supuestas.

### Estado y comprobación de este lote

Implementación local y QA propia comprobadas; TUX-04 queda parcial por alcance,
sin aceptación de comprensión humana o adopción implícita. [Evidencia y tres
capturas nativas](../evidence/teacher-plan-review-20261116/README.md) distinguen
fixtures de una sesión operativa. Chromium157.0.8103.52 completó12perfiles:
320/390/600/899/900/1280px, altura900px, ES oscuro y EN claro con la fixture por
jornadas. Cuatro secciones y12unidades reales de esa fixture; cero inputs de
texto visibles al entrar, CTA44px disponible sin IA, cero escrituras iniciales
y sin overflow horizontal. Cero errores de ventana/avisos ResizeObserver en los
recorridos observados; esto no acredita todos los navegadores.

Edición manual y cantidades inválidas conservan valores/nodos al plegar y
redimensionar.503/409 mantienen editor/borrador y bloquean aceptar. La recuperación
explícita del ensayo produjo tres PATCH: dos rechazados y uno confirmado como
revisión2; un POST de aceptación conserva el ID/hash exactos de esa revisión,
sin IA o preparación automática. Ajuste y conversación conservan sus drafts y
nodos al plegar/reabrir; el ajuste mantiene foco/caret4…9 en1280→390→1280px.

La revisión final detectó que una cantidad inválida sin cambio estructural podía
dejar habilitado el ajuste con IA. Se incorporó `!policyValid` al bloqueo y su
ayuda ES/EN. QA posterior con selección sintética disponible comprobó bloqueo al
invalidar, habilitación al corregir y cero escrituras por esa comprobación.
La regresión histórica posterior verifica revisión futura sin título, con
duración nula y sin secciones: mantiene desconocido/vacío hasta una edición
explícita, no inventa jornadas y respeta `canAccept=false`.

Checks: global365archivos/3039pruebas correcta en306,35s, iniciada **antes** de
ese último guard/helper, su assertion y el caso histórico posterior. Después del ajuste,26focales
de PlanReview/PlanStructureEditor/SetupConversation correctas en12,38s; build
final (tipado+Vite) y lint final correctos, excluyendo sólo `.tmp/**` de
experimentos ignorados. Typecheck independiente previo correcto. No se afirma
otra global posterior al guard final; las regresiones focales cubren el cambio.
Contratos, refetch/recibos y autoridad conservados, sin replay o cambios Server.
Comprensión humana, UI autenticada, teléfono físico y adopción siguen pendientes;
sin inferencia, publicación o aprobación nuevas. No hereda resultados de§10–12.

Impacto evaluado en [producto42](../nodia-ai/knowledge/studies/README.md#revisión-legible-del-plan--solicitud2026-11-16),
[sesión37](../nodia-ai/knowledge/studies/features/session-setup-and-planning.md#revisión-legible-del-plan--solicitud2026-11-16)
y [experiencia guiada4](../nodia-ai/knowledge/studies/features/guided-setup-and-study-experience.md#revisión-legible-del-plan--solicitud2026-11-16):
presentación y acceso progresivo a operaciones existentes; sin nuevos conceptos,
efectos, contexto, herramientas o permisos. Conservan draft/partial/unregistered/
approval:null, sin publicación o aprobación automática de fichas.

## 14. Cierre TUX-001 por aceptación humana — 2026-11-16

El usuario confirma «TUX 001 tambien funciona bien toca cerrarlo». Se registra
su aceptación funcional y se cierra **TUX-001 por el alcance entregado**: alta
guiada de§10, cabecera/Drawer/selector de§11, corrección de medición de§12 y
revisión legible/edición progresiva de§13. La revisión humana deja de ser el
primer pendiente de esas entregas; no se repite su construcción o QA por rutina.

El cierre conserva la evidencia técnica y sus límites. La confirmación no detalla
versión, entorno, navegador o dispositivo, ni acredita por sí sola un recorrido
observado con tiempos, teléfono físico, inferencia o eficacia pedagógica. No se
ejecuta una adopción o despliegue nuevo ni se hereda la adopción de otro alcance.

**Evolución separada, no implementada por este cierre:** TUX-03, para mejorar la
guía de borrador/definición, preparación y recuperación; TUX-05, para primera
lección, continuidad y herramientas secundarias. Sus contratos/capacidades
existentes permanecen, pero el rediseño propuesto de§4.4/4.5/4.7 y§7 no se da por
entregado. Son seguimiento futuro independiente y no reabren TUX-001.

Impacto documental: se concilia aceptación con la
[ficha de experiencia guiada](../nodia-ai/knowledge/studies/features/guided-setup-and-study-experience.md#cierre-funcional-tux-001--2026-11-16),
sin cambiar conceptos, operaciones, contexto, herramientas, permisos o contratos.
El documento sigue en revisión; la ficha sigue draft/partial/unregistered y
approval:null. Aceptar la UI entregada no aprueba integralmente la evolución
propuesta ni publica conocimiento.


## 15. TUX-03/05: guía y continuidad implementadas localmente — 2026-11-16

El usuario solicita continuar lo pendiente desde development. La rama
`codex/teacher-guided-continuity` parte de `origin/development` `6b7f15a5`.
El usuario aclara que se debe mantener o mejorar el diseño nuevo existente,
priorizando UX/UI. Se conservan alta guiada, cabecera, revisión legible, selector
IA, Drawer, temas y pautas responsive; la evolución añade guía y recuperación
sobre esa base, sin sustituir su lenguaje visual.

Se implementan los alcances siguientes en Client, con QA final local en
[evidencia común](../evidence/teacher-guided-continuity-20261116.md). Este desarrollo sucede el pendiente técnico
de TUX-03/05 de§9/§14 y no altera el cierre humano previo de TUX-001.

### Definición, mensaje privado y preparación — TUX-03

«Crear propuesta» es la acción principal, con selección IA visible aunque
«Aclarar mi objetivo» esté cerrado. La ayuda se abre con borrador no vacío o
historial propio; plegar conserva el mismo historial/compositor y su texto,
con controles ocultos inertes. No se puede plegar durante grabación o comando.
La conversación y el diagnóstico son opcionales; enviar o crear una propuesta
siguen siendo intenciones explícitas que utilizan la selección IA existente.

El aviso junto a Crear propuesta explica que un mensaje sin enviar no participa
en ella. Se puede enviar, seguir editando o descartar mediante confirmación
expresa; el descarte conserva el historial enviado y sólo vacía el borrador.
Cambio de sesión/contexto/texto/historial invalida la confirmación abierta.
Se conservan CAS de borrador, límites de texto/bytes, grabación y confirmación
exacta de propuesta; no hay envío, aceptación o generación implícitos.

`JobPanel` distingue propósito real y resultado esperado sin inventar fases,
porcentajes, tiempos o identidad de selección del trabajo. Explica que se puede
volver a Mis planes sin cancelar la solicitud. Actualizar estado consulta el
trabajo existente; una nueva preparación sólo aparece por `allowed_actions`,
respetando `allowNew`, pausa y busy. Unknown mantiene su consulta/conciliación
sin replay o cambio automático de proveedor. Los fallos de lectura conservan
el último dato confirmado; carga inicial y revalidación siguen separadas.

### Diagnóstico opcional con banco comprobado

`DiagnosticEntry` consulta el estado de aprendizaje al abrirse por intención;
no añade una lectura por entrar a la sesión ni inicia un intento al mostrarlo.
`start_diagnostic` sólo permite ofrecer la entrada: no acredita banco revisado.
Un intento nuevo requiere `diagnostic_blueprint.reviewed === true` y consulta
sin error, además de la acción nativa; un diagnóstico activo puede retomarse sin
exigir un banco nuevo. El comando usa `new_attempt:false` y conserva la
confirmación/recuperación del propietario actual. Falta de banco o revisión
no adjudica nota cero ni bloquea crear la propuesta: se puede cerrar y seguir.
Fallar conserva el modal, con carga inicial, error/reintento y bloqueo de doble envío locales.

### Primera lección y continuidad — TUX-05

`StudyContinuation` deriva una siguiente acción del plan, cursor confirmado,
intento restaurado y disponibilidad de material reales. Sin unidad elegida,
propone la primera unidad real del plan; elegirla persiste el cursor y sólo
cambia la vista después del acuse. Elegir o aceptar un plan no prepara material.
Sin material, Preparar primera lección/Preparar material es una intención
separada, sujeta a acción nativa, pausa, selección y bloqueos existentes.

Material disponible ofrece abrir lectura; cursor compatible y bloque existente
ofrecen continuar. El botón enfoca el bloque guardado cuando la versión leída
coincide; de otro modo enfoca la cabecera de la lección. Con intento restaurado,
enfoca su cabecera, sin responder ni iniciar otro intento. El punto de lectura
sólo cambia localmente tras confirmar su guardado. Un cursor o intento de otra
revisión se presenta como histórico: no se redirige silenciosamente a la primera
unidad del plan vigente ni se promete obtener una versión histórica exacta por
el endpoint actual de material.

Cualquier disponibilidad con `job_id` conduce a observar ese trabajo y no a
crear otro, incluso si dice not_prepared. Estados preparing/unknown sin ID
ofrecen consulta; datos ausentes, unidad no encontrada y plan vacío conservan
su explicación sin fabricar contenido ni acciones. Las herramientas secundarias
existentes mantienen su acceso en el Drawer; no se añaden herramientas MCP.

### Implementación, evaluación de impacto y límites

- [x] TUX-03: ayuda opcional, selección visible y mensaje sin enviar protegido.
- [x] TUX-03: propósito/espera, lectura y recuperación según acciones nativas.
- [x] Entrada diagnóstica por intención, banco revisado o intento activo real.
- [x] TUX-05: próxima acción derivada, material manual y estados conservadores.
- [x] TUX-05: selección de unidad/lectura tras acuse y foco de lectura/intento.
- [x] Regresiones atómicas añadidas/actualizadas por los ámbitos implementados.
- [x] Integración y QA técnica local común: Teacher final277/42 y global previa3171/383,
  tipos/build y lint de fuentes correctos; Chromium sintético16perfiles y
  recorridos CAS/borrador/material por [evidencia](../evidence/teacher-guided-continuity-20261116.md).
- [x] Integración y cierre del alcance registrados en §16.

Impacto de presentación, explicación y acceso a operaciones existentes. Se
mantienen DTOs/HTTP, autoridad Teacher, presupuesto, selección exacta, CAS,
versiones/hash, evaluación y recuperación. Sin cambios Server o migraciones,
nuevos conceptos operativos, permisos, herramientas o publicación. La ficha
[guiada revisión6](../nodia-ai/knowledge/studies/features/guided-setup-and-study-experience.md#guía-opcional-y-continuidad--implementación-local2026-11-16),
[sesión revisión38](../nodia-ai/knowledge/studies/features/session-setup-and-planning.md#guía-opcional-y-continuidad--implementación-local2026-11-16)
y [producto revisión44](../nodia-ai/knowledge/studies/README.md#guía-opcional-y-continuidad--implementación-local2026-11-16)
conservan draft/partial/unregistered/approval:null. Código y pruebas locales no
acreditan inferencia real, comprensión humana, teléfono físico, producción,
aprobación del plan completo o publicación del conocimiento. Capturas nuevas
sólo en output/.tmp ignorados; consolidar evidencia textual duradera al finalizar.

## 16. Cierre de TUX-03/05 — 2026-11-17

El usuario solicita cerrar el alcance de guía opcional, diagnóstico, preparación
y continuidad de primera lección descrito en §15. La
[PR 50](https://github.com/oscarvalenzuela25/Nodia/pull/50) integró el cambio en
`development` (`0049b5fc`) y la [PR 51](https://github.com/oscarvalenzuela25/Nodia/pull/51)
en `master` (`d4345ea9`). El cierre queda registrado en el [TODO](TODO.md).

La evidencia funcional disponible cubre QA local. La adopción por entorno,
inferencia real y pruebas en teléfono requieren comprobación propia. El plan
sigue en revisión y las fichas candidatas conservan su estado.

## 17. Progreso en el panel de la lección — 2026-11-17

El usuario aprueba la maqueta e indica implementarla en
`codex/teacher-ui-adjustments`. En la unidad seleccionada, un trabajo de material
confirmado en cola o en ejecución se muestra en el panel **Preparando lección**.
Debajo del título aparecen el chip de estado, el nombre de la lección, la barra
indeterminada y el mensaje sobre el guardado y la vuelta a Mis planes.
Durante ese estado el panel sustituye **Revisar preparación** y la recarga
manual del mismo trabajo.

La consulta automática usa el identificador de trabajo asociado a la unidad
por Server. Un fallo de lectura conserva el estado confirmado e incluye un
reintento de lectura. Al guardarse el material, el panel muestra la lección
disponible. Los trabajos pausados o con resultado pendiente de conciliación
conservan la recuperación existente. Otros trabajos de la sesión se muestran
en su ubicación habitual.

Chromium con transporte sintético verificó seis anchos entre 320 y 1600 px,
en español e inglés y con los temas claro y oscuro. Se comprobó la recuperación
visual tras un 503 y una respuesta inválida, el paso de cola a ejecución y
material guardado tras una sola solicitud explícita, y un resultado incierto
sin reenvío. La vista también mantuvo los controles de otro trabajo concurrente.
La comprobación corresponde a Client local con fixtures.

Pasaron 3287 pruebas de Client en 397 archivos, incluidas 279 pruebas de Teacher
en la ejecución focal. También pasaron tipado, compilación y lint del código
fuente. El lint general detectó cinco errores en prototipos locales de
`nodia-client/.tmp`.

[Evaluación en la ficha de experiencia guiada](../nodia-ai/knowledge/studies/features/guided-setup-and-study-experience.md#evaluación-visual-del-progreso-de-la-lección--2026-11-17).

## 18. Lectura y aclaraciones por tópico — 2026-11-17

El usuario aprueba la maqueta del bloque «Saludar y decir tu nombre» para
implementarla como patrón reutilizable. Cada tópico tiene su cabecera,
marcador de lectura y contenido Markdown. El marcador muestra **Punto
guardado** cuando la sesión confirma la versión y el bloque guardados.
Guardar mantiene la posición de lectura. Al volver a la sesión, se recupera
el punto de la versión exacta.

**Aclarar fragmento** reconoce una selección literal dentro del mismo tópico.
El panel lateral, o inferior en un viewport estrecho, muestra una sola cita,
una pregunta y el coste de enviarla. El historial plegable usa los hilos
de la versión y el bloque, con el paginado existente. Cerrar el panel o
cambiar de ancho conserva el borrador y el hilo del tópico.

Abrir y consultar usan lecturas. El primer **Enviar a Teacher** crea el hilo y
envía la pregunta con la revisión que confirma el recibo de creación. Los
envíos siguientes al mismo hilo reutilizan su ID. Una lectura de conciliación
recupera el recibo de la operación original sin reenviar el POST. El Server
sigue resolviendo permisos, ancla exacta, CAS, presupuesto y bloqueo de
aclaraciones nuevas durante una final.

Chromium con datos sintéticos verificó español e inglés y temas claro y
oscuro, entre 320 y 1600 px. La matriz cubrió selección, foco al cerrar y
abrir, borrador al redimensionar, historial por tópico, conflicto de revisión
en preguntas y cursor, y conciliación por GET de un recibo inválido sin
reenvío. En el panel inferior, un 503 conservó el borrador y un 504 se
concilió por GET. Pasaron 3291 pruebas de la suite general de Client y 283 de Teacher
en la comprobación focal final. Tipado, compilación, lint del código fuente y
`knowledge:check` pasaron. El alcance de la validación fue local.

[Ficha de aclaraciones contextuales](../nodia-ai/knowledge/studies/features/contextual-clarifications.md#aclaraciones-por-tópico-y-marcador-de-lectura--2026-11-17).

## 19. Práctica interactiva durante el estudio — 2026-11-19

El ajuste solicitado abarca los bloques de la lección y las acciones al pie
del contenido. Las pistas y soluciones identificadas por encabezados o
etiquetas explícitas quedan plegadas hasta que la persona las solicite. La
consigna queda disponible en el cuerpo del bloque. El material guardado
conserva su versión y su formato Markdown.

Una serie numerada de espacios con una única clave correspondiente ofrece
campos individuales y **Comprobar mis respuestas**. Client compara cada
respuesta con su clave y permite corregirla. Con claves ambiguas o sin una
correspondencia clara se ofrece la lectura de la solución disponible. Las
respuestas abiertas permiten escribir, **Revisar mi respuesta** y seguir
editando. La revisión muestra los criterios del bloque cuando existen y
orientaciones generales de autoevaluación cuando faltan. El guardado opcional
de los bloques que ya lo admiten conserva su ancla, revisión y recibo.

Estas interacciones consumen cero generaciones. La comparación sirve como
ayuda de estudio y su resultado queda en Client. La nota, la evidencia de
aprendizaje y la verificación de sección siguen el contrato vigente de
Teacher. El material existente y el manifiesto de generación se conservan.
[Contratos de Teacher](97-nodia-teacher-technical-contracts.md),
[evidencia de aprendizaje](../architecture/decisions/ADR-098-teacher-learning-evidence-and-adaptive-progression.md).

Los avisos de generación, error y recuperación se presentan en alertas
separadas por encima de los controles relacionados. La consulta automática
mantiene el progreso al día. Los fallos de lectura conservan un reintento y
las solicitudes inciertas conservan la conciliación del recibo. La acción de
la lección se llama **Generar evaluación final de la sección**. **Ir a la
siguiente sección** aparece al final de la fila cuando hay un destino en el
plan y usa la navegación por cursor. Los permisos y requisitos de la
evaluación final se mantienen en Server.

En Chromium local, el recorrido con datos sintéticos comprobó la solución
oculta, la corrección de 2/3 a 3/3, los criterios y el foco al mejorar
la respuesta abierta, el aviso sobre las acciones y la apertura automática
de la evaluación a partir de una única solicitud. El avance guardó un
único cursor para la siguiente sección. A 390 px se verificó la apertura
de la pista con teclado y el ancho sin desbordamiento horizontal. La
validación se ejecutó sin proveedores de IA ni tráfico de producción.
La suite de Client registró 3326 pruebas aprobadas en 410 archivos. Con
la versión final pasaron 306 pruebas de Teacher, el tipado, el lint, la
compilación y `knowledge:check`.
[Ficha de práctica](../nodia-ai/knowledge/studies/features/lessons-practice-and-review.md#práctica-interactiva-durante-la-lección--2026-11-19),
[ficha de experiencia guiada](../nodia-ai/knowledge/studies/features/guided-setup-and-study-experience.md#acciones-y-avisos-durante-el-estudio--2026-11-19).

## 20. Corrección del quiz, continuidad y Mis fuentes — 2026-11-20

El quiz concentra la pregunta, la respuesta y sus acciones en una tarjeta.
Se retiran del Client el formulario de reflexión, la confianza declarada y
su botón de guardado. El contrato y los valores previamente guardados de
reflexión permanecen disponibles en Server. **Pedir una pista** comparte la
fila de **Guardar borrador** cuando está permitido. **Finalizar práctica**
conserva su jerarquía como acción principal.

La corrección separa los puntos confirmados, la respuesta entregada, la
respuesta esperada o el criterio de una respuesta abierta, la explicación y
el desglose de la rúbrica cuando existen. El siguiente paso de la corrección
es **Siguiente pregunta** si queda una en el quiz de práctica. La evaluación
final conserva las restricciones de ayuda, entrega y revelación del
[contrato97](97-nodia-teacher-technical-contracts.md#4-política-de-evaluación-concreta).
El resumen de práctica ofrece **Continuar con la siguiente lección** como
acción compacta si el plan vigente tiene otra unidad. El avance usa el
guardado y conciliación del cursor con las reglas existentes.

La continuidad de una lectura o evaluación ya abierta se ofrece en la
cabecera junto a **Opciones de la sesión**. Los estados que requieren
iniciar una primera lección, preparar material o resolver una operación
incierta conservan sus acciones contextuales.

En **Aprendizaje adaptativo**, el espaciado y la jerarquía de acciones
facilitan el recorrido de **Mis fuentes**. Se puede pegar texto o adjuntar
un PDF con texto seleccionable de hasta 96 KiB y 12 páginas. Se conserva
el contenido extraído con su procedencia por página. En un PDF mixto, las
páginas sin texto se señalan y un PDF sin capa de texto se rechaza. Para
fotos, capturas y escaneos completos se puede pegar una transcripción.
El contrato actual procesa texto y la prueba de este alcance usa
archivos sintéticos. [Contratos de enriquecimiento](97-nodia-teacher-technical-contracts.md#enriquecimiento-comandos-y-consultas).

La maqueta se capturó desde el Client con datos sintéticos. En Chromium a
1440 y 390 px se comprobó la presentación de la corrección, el acceso de
la cabecera y el avance al foco de la pregunta o lección. Un conflicto de
cursor conservó la corrección visible y permitió reintentar. Al abrir una
final en curso, la corrección y la acción de avance de práctica quedaron
ocultas. En Mis fuentes se probó el envío de un PDF sintético y la
presentación de una respuesta simulada de texto extraído. El panel ajustó
sus controles a 1440, 390 y 320 px y devolvió el foco al cerrar con Escape.
El extractor real pasó siete pruebas, incluido un PDF de una página que
sólo contenía una imagen y produjo `source_no_text`. Pasaron 309 pruebas
de Teacher en Client y la comprobación de publicación de conocimiento.

Esta evolución cambia el recorrido del Client y la explicación de las
capacidades de fuentes. Las fichas conservan el estado candidato y el
catálogo de NodiaAI conserva sus operaciones y permisos.

[Ficha de práctica](../nodia-ai/knowledge/studies/features/lessons-practice-and-review.md#corrección-y-continuidad-del-quiz--2026-11-20),
[experiencia guiada](../nodia-ai/knowledge/studies/features/guided-setup-and-study-experience.md#continuidad-en-la-cabecera-y-panel-adaptativo--2026-11-20) y
[Mis fuentes](../nodia-ai/knowledge/studies/features/learning-sources.md#formatos-y-cobertura-en-mis-fuentes--2026-11-20).

## 21. Edición enfocada de la propuesta — 2026-11-20

En el segundo paso, **Revisar el plan** abre el resumen del recorrido y ofrece
**Usar este plan** o **Activar revisión**, según la propuesta. El editor
manual organiza el trabajo en **Datos del plan**, las secciones y
**Evaluación**. En un contenedor ancho el selector acompaña al formulario.
Cuando hay poco ancho, un selector compacto da acceso a los mismos destinos
y muestra sólo el bloque en edición. Cambiar de bloque, volver al resumen o
redimensionar conserva el borrador de la revisión.

Cada sección agrupa su identificación, objetivos, lecciones y requisitos.
El detalle se abre por intención para separar la lectura del recorrido de
la edición de campos. Agrupar la vista conserva los campos existentes y
sus límites, incluidos los vínculos entre unidades y objetivos, la
obligatoriedad, los prerrequisitos y las jornadas. Añadir, ordenar o
excluir continúa actuando sobre los mismos IDs del plan. La política de
evaluación retiene el texto inválido al cambiar de vista, señala el bloqueo
y se puede corregir desde el selector.

**Guardar cambios** se ofrece en la cabecera del editor y crea una revisión
manual. Un fallo o un resultado incierto mantienen el editor y su borrador.
Se conserva la conciliación del recibo y el uso de la revisión y el hash
exactos. **Pedir un ajuste** prepara otra propuesta cuando la acción está
disponible. Abrir las vistas y recorrer sus bloques no dispara una
generación, una escritura ni la aceptación del plan. El foco acompaña los
cambios de vista que inicia la persona.

### Verificación de esta iteración

Con una propuesta sintética de cuatro secciones y doce unidades, Chromium
comprobó el selector lateral y el compacto sin desbordamiento horizontal a
320, 390, 900 y 1440 px, con recorridos en español oscuro e inglés claro.
También se verificó el foco del encabezado al entrar al editor y elegir
una sección desde la lista lateral.
Un cambio de ancho retuvo el título de la unidad abierta. Cambiar de bloque
mantuvo una cantidad de evaluación inválida y bloqueó el guardado hasta
corregirla. Abrir y editar causó cero escrituras. Un PATCH rechazado con 503
mantuvo el borrador y el siguiente PATCH confirmó una revisión con el hash
esperado y devolvió el resumen. Pasaron 311 pruebas focalizadas de Teacher,
tipado, lint, compilación y la comprobación de conocimiento.

El alcance verificado es Client local con transporte simulado. Las operaciones
y los permisos del [contrato97](97-nodia-teacher-technical-contracts.md#6-dtos-y-rutas-http)
siguen vigentes. Las fichas conservan su estado candidato.

[Experiencia guiada](../nodia-ai/knowledge/studies/features/guided-setup-and-study-experience.md#edición-enfocada-de-la-propuesta--2026-11-20) ·
[Preparación y planificación](../nodia-ai/knowledge/studies/features/session-setup-and-planning.md#edición-enfocada-de-la-propuesta--2026-11-20).

## 22. Piloto de fragmentos interactivos — 2026-11-22

El usuario pidió probar dos fragmentos de su captura dentro de un plan de
inglés ya creado. La vista previa de desarrollo se acota
a esa lección. El objetivo es comprobar si la comparación y las fichas
ayudan a distinguir las dos vocales y seguir el orden del deletreo.

### Recorrido del piloto

1. Abrir el plan existente desde **Mis planes** y entrar a la lección con
   los dos tópicos. En Client con Vite en desarrollo, añadir
   `studyFragments=1` a la consulta de la URL de esa sesión.
2. En **Letras, sonidos y palabras**, comparar **sit** /sɪt/ con **seat**
   /siːt/ lado a lado. Frente a la pregunta de qué palabra contiene /iː/,
   elegir una opción y recibir una explicación que permita volver a probar.
3. En **Deletrear sin omitir caracteres**, recorrer las seis fichas de
   **BEE–22**. Revelar por separado **bee**, **ee**, **ee**, **hyphen**,
   **two** y **two**, incluidos el guion y ambos caracteres repetidos.
   La pregunta de repaso pide identificar el carácter que sigue a la
   segunda E.
4. Volver a la lectura del tópico para guardar el punto o pedir una
   aclaración con las acciones habituales.

### Alcance, contrato y verificación

El [recorrido manual de Client](../../nodia-client/src/test/manual/teacher/README.md)
también reproduce los dos tópicos en un plan sintético ya aceptado.
Sirve para verificar los controles con los ejemplos de la captura. La
prueba con el plan de la persona requiere una sesión autorizada en el
entorno que contiene el material original.

La vista previa se agrega a la lectura online de Teacher y usa el material
existente. Se activa sólo en Vite DEV y cuando los dos títulos exactos y
sus ejemplos coinciden inequívocamente en la misma lección. Retirar el
parámetro devuelve la lectura a su presentación habitual. Se conservan
la versión de contenido, los IDs de bloque, el Markdown original y las
anclas de selección conforme al
[contrato de material](97-nodia-teacher-technical-contracts.md#35-esquemas-json-mantenidos-por-server)
y al [recorrido de aclaraciones](#18-lectura-y-aclaraciones-por-tópico--2026-11-17).

El estado de las fichas y la corrección son locales a la vista del
contenido. La autoevaluación es textual y su feedback cubre reconocer
la vocal y recordar la posición del guion. El puntaje y la evidencia de
aprendizaje siguen sujetos al contrato de evaluación. Abrir la vista
previa, responder y revelar fichas producen cero solicitudes de
generación y cero escrituras. Los permisos de lectura y las acciones
de Teacher conservan sus contratos. [Política de evaluación](97-nodia-teacher-technical-contracts.md#4-política-de-evaluación-concreta).

- [x] Crear la rama aislada `codex/teacher-study-fragment-pilot` a
  partir de `origin/development`.
- [x] Implementar los dos fragmentos en la vista previa acotada.
- [x] Comprobar localmente elección, reintento, revelado con teclado,
  presentación adaptable y recuperación de la vista habitual al quitar
  el parámetro, con un plan sintético ya aceptado.
- [ ] Abrir el plan original con una sesión autorizada y recoger la
  evaluación del usuario antes de ampliar el alcance.

### Verificación local

El recorrido manual abrió una lección del plan sintético ya aceptado en
los componentes de Teacher. En español y tema oscuro, las seis fichas
ocuparon una fila a 1270 px CSS. A 320 px de viewport quedaron en dos
filas de tres, con controles de 53 × 77 px y ancho de contenido de
310 px sin desbordamiento horizontal. El cambio de ancho conservó las
respuestas y las fichas reveladas.

Se comprobaron respuestas incorrectas y corrección en ambos ejercicios.
La segunda E conservó su propio control y se revelaron el guion y el
segundo 2. Tab mostró un foco visible, y Enter y Espacio activaron los
controles. A 320 px también se revisaron los rótulos en inglés y tema
claro. Al quitar el parámetro quedaron el Markdown, los tres controles
de marcador y los tres de aclaración. El piloto permanece disponible en
Client de desarrollo. La prueba autenticada con el material original
y la aceptación del usuario siguen pendientes.

En la suite general pasaron 3441 de 3442 pruebas. La prueba de
revalidación del editor de Reservas excedió el tiempo límite. Pasaron
343 pruebas en la repetición focal de Teacher y Reservas, incluida
esa revalidación. También pasaron tipado, lint, compilación y
`knowledge:check`. El artefacto de producción excluye la activación
del piloto y el plan de prueba.

El impacto se limita a la presentación y el repaso local del material.
La ficha candidata documenta cómo interpretar su feedback. La revisión
del piloto y su posible incorporación a otras lecciones son decisiones
pendientes. [Ficha de lecciones y práctica](../nodia-ai/knowledge/studies/features/lessons-practice-and-review.md#piloto-de-fragmentos-interactivos--2026-11-22).

## 23. Propuesta de Calendario de estudio

La entrada de Teacher conserva **Mis planes de estudio** como pestaña
principal y suma **Calendario de estudio** en la propuesta del 2026-11-22.

La idea inicial permitía elegir un plan y ver sus jornadas por semana.
Cada jornada mostraba actividades, tiempo estimado y enlaces disponibles.
El ejemplo era un plan de inglés de cuatro semanas con seguimiento por
jornada y un recuento semanal y total. La duración y la cantidad de
jornadas pertenecen al plan.

El recorrido de revisión visual, la persistencia personal y el pegado se
documentan en el [Plan111](111-teacher-study-calendar-plan.md). La gestión
del calendario y el avance derivado de las marcas por actividad ya se
verificaron localmente. Queda precisar la reprogramación de calendarios con
avance y validar su adopción. [Gestión y verificación](111-teacher-study-calendar-plan.md#10-gestión-del-calendario-y-filtro-de-actividad).
