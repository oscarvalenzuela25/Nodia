# Teacher — rediseño guiado de UX/UI y plan de implementación futura

> Estado: en revisión; especificación del 2026-11-15, sin implementación.
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
datos/historial y contratos pedagógicos. No iniciar ahora cambios de aplicación,
migraciones, inferencias, instalaciones, despliegues ni nuevas herramientas IA.

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
- [ ] TUX-00: observar y contrastar recorrido con usuario sobre una versión concreta.
- [ ] TUX-01: crear/revisar prototipo específico Teacher; la maqueta Noticias no aplica.
- [ ] TUX-02…05: implementación por entregas y actualización de contratos/fichas afectadas.
- [ ] TUX-06: QA técnico/UX, comparación por perfil y adopción por alcance.

Entregable actual exclusivamente documental. Ficha candidata:
[experiencia guiada](../nodia-ai/knowledge/studies/features/guided-setup-and-study-experience.md),
enlazada desde [Teacher](../nodia-ai/knowledge/studies/README.md). Sin aprobación
automática, publicación o disponibilidad operativa del rediseño.

Comprobación de esta especificación: contratos de alta/aceptación/material y
checklist revisados; enlaces locales/anclas, frontmatter y UTF-8/LF verificados.
Validación de conocimiento Server correcta; el borrador nuevo se excluye del
corpus publicado. Sin pruebas de aplicación o UI por esta entrega documental.
