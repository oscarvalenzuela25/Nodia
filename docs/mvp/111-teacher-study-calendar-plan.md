# Calendario de estudio de Nodia Teacher

Borrador de diseño y planificación del 2026-11-22. El usuario aceptó el
mockup de avance por actividad y solicitó iniciar la implementación en
`codex/teacher-study-calendar`. La referencia funcional es **4 semanas
de inglés**, con 28 jornadas de 30 minutos, fuentes por actividad y un
recuento de jornadas completadas.

## 1. Alcance solicitado

- La entrada de Teacher tendrá **Mis planes de estudio**, activa por defecto,
  y **Calendario de estudio** como pestaña secundaria.
- La persona puede crear un calendario propio con título y categorías, elegir
  un rango con inicio y término o indicar una cantidad de días sin fechas.
  El calendario y el recorrido día por día permiten abrir la misma jornada.
- Las casillas tienen datos editables y un estado calculado a partir de
  las marcas de sus actividades. Cada jornada reúne actividades ordenadas
  y cada actividad puede tener una fuente propia.
  Las categorías personales aparecen como chips y sirven para filtrar.
  La administración de categorías toma como referencia el drawer de
  [Negocios → Caja](109-business-cash-ledger-plan.md#7-criterios-de-ui-y-responsive).
- El alta admite edición manual y pegado de un plan preparado fuera de Nodia.
  El formato, estructura y verificación de la creación se proponen en §5.

Como primera entrega, se propone que los calendarios sean registros propios de
Teacher. El plan adaptativo mantiene su ciclo de revisiones, unidades y
evaluaciones. La vinculación opcional a un estudio existente queda pendiente
de diseño. [Plan de Teacher por jornadas](95-studies-adaptive-learning.md#5-plan-de-x-jornadas-y-material-guardado) · [Contratos de aprendizaje](97-nodia-teacher-technical-contracts.md).

## 2. Pantallas para validar en los mockups

| Pantalla | Qué puede hacer la persona |
| --- | --- |
| Calendario de estudio | Ver sus calendarios, filtrar por categoría y seleccionar uno. Reconocer sus categorías, elegir **Cuadrícula** o **Día a día** y consultar avance semanal y total. |
| Nuevo calendario | Poner título y categorías. Con **Rango de fechas**, elegir inicio y término. Con **Días numerados**, indicar cuántas casillas quiere. Luego puede completar cada jornada cuando la abra. |
| Jornada | Abrir una casilla desde cualquiera de las vistas. Editar título, notas y minutos estimados. Añadir, editar o marcar actividades ordenadas con una fuente opcional. Ver el recuento de actividades y el estado resultante. |
| Categorías | Abrir el drawer, crear o editar las categorías propias y ver los chips con los que se identifican los calendarios. Mantener la gestión en el mismo drawer y conservar sus campos ante un error. |
| Pegar un plan | Pegar el formato de §5, revisar los errores y editar la vista previa. Confirmar el resumen de jornadas y categorías que se guardará. |

El detalle de jornada muestra su ordinal o fecha junto a las actividades.
El enlace aparece en la actividad que lo usa. Una práctica personal puede
dejar el enlace vacío. En escritorio se propone un drawer lateral. En móvil
se adapta al ancho y ofrece **Día a día** como lista en el orden del plan,
con acceso a la misma edición. Cerrar una edición devuelve el foco a la
casilla o acción que la abrió.

Cada actividad se puede marcar o desmarcar. **Jornada completada** aparece
automáticamente cuando hay al menos una actividad y todas están marcadas.
Desmarcar una, añadir una pendiente o quitar la última deja la jornada
pendiente. Una jornada vacía sigue disponible para editar. El drawer muestra
el cambio en el borrador y **Guardar jornada** confirma las marcas y
actualiza los recuentos semanales y del calendario. Abrir una fuente
conserva la marca existente. Los minutos declarados son estimados.

## 3. Fechas, orden y avance

| Modalidad | Identificador visible | Creación y orden |
| --- | --- | --- |
| Por fechas | Fecha civil del calendario y ordinal interno | Desde inicio hasta término, ambos incluidos y en orden ascendente. Si coinciden se crea una jornada. |
| Por cantidad de días | Día 1, Día 2, …, Día N | Se crean exactamente N jornadas con ordinal consecutivo. Día 30 queda disponible aunque se comience cualquier día de la semana. |

Se propone materializar todas las jornadas al guardar el calendario. Las
jornadas sin contenido aparecen disponibles para editar. Cuadrícula y Día a
día proyectan las mismas identidades, datos y estado. En modo numerado, la
cuadrícula usa grupos consecutivos de siete días. En modo con fechas, se
propone agrupar de lunes a domingo. Las casillas fuera del rango sólo ayudan
a alinear los días de la semana y quedan fuera del denominador.

El rango usa fechas gregorianas civiles ISO 8601 con granularidad de día.
El cálculo recorre días civiles, incluso al cambiar el horario de verano.
La fecha de una jornada mantiene su día civil al cambiar de dispositivo o
país. La revisión de edición es independiente de la fecha.
Antes de incorporar **Hoy**, reprogramación o recordatorios hay que definir
si la referencia usa la zona del calendario o la zona preferida de la persona.

## 4. Persistencia y autoridad propuestas

La siguiente estructura orienta la migración. Los nombres, restricciones y
shape HTTP se fijarán al empezar el backend. [ADR de persistencia y pegado](../architecture/decisions/ADR-116-teacher-study-calendar-ownership.md).

| Tabla propuesta | Datos clave |
| --- | --- |
| teacher_calendar_plans | ID, propietario, título, modalidad, campos de calendario según modalidad, clave y huella de creación y fecha de alta. |
| teacher_calendar_days | ID, plan, ordinal, título y notas opcionales, minutos estimados opcionales y revisión. |
| teacher_calendar_activities | ID estable, jornada, posición, texto, marca de realización y una fuente opcional con nombre y URL HTTPS. |
| teacher_calendar_categories | ID, propietario, nombre visible y clave normalizada, color de catálogo y actividad. |
| teacher_calendar_plan_categories | Vínculo único entre plan y categoría dentro del mismo propietario. |

Cada actividad conserva su ID al editarla o cambiar su posición. La fuente
se guarda en la actividad. Nombre y URL están ambos presentes o ambos
ausentes. Si en el futuro se necesitan varias fuentes por actividad, se
evaluará una relación propia.

Server calcula las actividades realizadas y el estado de la jornada desde
las filas de actividades. El numerador del calendario cuenta las jornadas
completadas y el denominador es el total de jornadas del plan, incluidas
las vacías. El guardado actualiza la jornada y sus actividades con una
revisión esperada dentro de la misma transacción.

La categoría corresponde al plan. La normalización se usa para detectar
duplicados personales y resolver nombres pegados. Para la primera versión se
propone desactivar categorías conservando los vínculos ya guardados. Un chip
existente puede seguir visible y servir como filtro, mientras la asignación
nueva toma categorías activas. La categoría de Caja tiene autoridad por
negocio y sólo aporta su patrón visual.

El servidor fija el propietario desde la sesión autenticada y aplica el
permiso vigente de Teacher por el destino canónico **/nodia-teacher**. Las
lecturas, mutaciones y recuperaciones validan ese ámbito, incluso si llega
un ID de otro usuario en el filtro o en el body. Las FKs de vínculos y
actividades preservan la pertenencia del grafo. El listado proyecta
categorías y recuentos por conjunto con paginación y orden estable. La
jornada y sus actividades se leen al abrirla.
[Autoridad por destino](../architecture/decisions/ADR-092-stable-module-navigation-routes.md) · [Titularidad de datos](89-module-access-and-user-data-scope.md).

## 5. Formato para pegar un plan

Se propone JSON v1 para que otra herramienta pueda preparar el texto y
la persona pueda revisarlo en Nodia. El ejemplo crea dos casillas y carga
contenido en la primera. Las filas omitidas quedan disponibles para editar.

~~~json
{
  "version": 1,
  "title": "Inglés desde cero",
  "categories": ["Inglés", "Idiomas"],
  "schedule": { "kind": "numbered", "days": 2 },
  "days": [
    {
      "day": 1,
      "title": "Pronombres y to be",
      "notes": "Practicar con frases propias.",
      "minutes": 30,
      "activities": [
        {
          "text": "Ver la lección",
          "source": {
            "label": "Clase 1 de Pacho8a",
            "url": "https://www.pacho8a.com/cursoinglesdesdeceroleccion1/"
          }
        },
        {
          "text": "Completar seis frases",
          "source": {
            "label": "Ejercicio To Be",
            "url": "https://www.curso-ingles.com/practicar/ejercicios/to-be"
          }
        },
        {
          "text": "Practicar en voz alta"
        }
      ]
    }
  ]
}
~~~

En un calendario por fechas, schedule tiene las propiedades **kind** con
valor **dated**, **start** y **end** en formato AAAA-MM-DD. Cada fila indica
**date** y su fecha en lugar de **day**. Ambas modalidades permiten una
lista de jornadas vacía. La vista previa admite corregir título, categorías,
modalidad y jornadas antes de confirmar.

Cada actividad contiene **text** y, si corresponde, **source** con **label**
y **url**. El orden de las actividades sigue el arreglo. Las actividades
creadas por pegado empiezan pendientes. La vista previa
permite revisar y editar el texto y su fuente juntos. La fuente se toma de
lo que la persona ingresa o pega de forma explícita.

El analizador identifica versión desconocida, forma ambigua, fechas
imposibles, índices repetidos o fuera de rango, caracteres inválidos,
fuentes incompletas y enlaces que no sean HTTPS. Debe devolver errores
localizables por jornada, actividad y campo. Los límites del cuerpo y de
los campos se acuerdan y prueban al definir el DTO. El texto pegado se
representa como texto. La vista previa examina el formato de las
referencias y cada visita requiere una acción de la persona.

Las categorías pegadas son nombres. La vista previa distingue reutilización,
alta propuesta y conflicto con una categoría inactiva. La persona decide qué
nombres conservar. Server administra el dueño, los ID internos, la
actividad de una categoría y las marcas de realización. El formato
pegable admite los datos para preparar actividades pendientes.

Al pulsar **Crear calendario** se envía el contenido final revisado. El
servidor vuelve a validar esquema y autoridad. En una transacción registra
plan, jornadas, actividades con sus fuentes y categorías expresamente
incluidas en la confirmación. La creación manual usa el mismo agregado.
La clave de idempotencia y el recibo permiten conciliar una respuesta
perdida sin duplicar filas. Un conflicto o error mantiene el contenido
para corregirlo. El formato puede venir de cualquier agente, y Nodia
interpreta el texto de forma determinista.

## 6. Orden de trabajo y verificación

- [x] Revisar el mockup de avance por actividad. El usuario confirmó que
  una jornada se completa al marcar todas sus actividades y solicitó
  iniciar el desarrollo.
- [x] Acordar el menú de gestión tras crear un calendario y el filtro de
  actividad predeterminado en Activos.
- [ ] Definir las reglas de reprogramación de calendarios con avance.
- [x] Cerrar el contrato de Server y la migración. Cubrir rangos de un día,
  cambio de mes y año, bisiesto, transición DST, exactamente 30 jornadas
  numeradas, días vacíos y rechazos por lotes inválidos. Verificar fuentes
  ausentes, datos incompletos, URL inválida y orden de las actividades.
  Cubrir jornada vacía, progreso parcial, última marca y reapertura.
- [x] Implementar el agregado y sus casos de uso. Verificar
  aislamiento entre usuarios, revocación de acceso, categorías duplicadas,
  transacción completa, reintento idempotente y guardado concurrente.
- [ ] Conectar Client. Probar filtrado por chip, navegación y foco,
  cambio de vista, guardado de jornada y progreso, errores de importación y
  persistencia del borrador con 320 px y escritorio, ES/EN y ambos temas.
- [ ] Verificar extremo a extremo con un plan de 28 días y otro con fechas.
  Confirmar la misma jornada y recuento después de recargar, y comprobar que
  los accesos existentes de Mis planes y sus evaluaciones siguen operativos.

Quedan por precisar las reglas de reprogramación con marcas existentes
y el objetivo de una futura vinculación al plan adaptativo. La edición
de título y categorías está descrita en §10.

## 7. Primer mockup interactivo

Abre el calendario de inglés para revisar la propuesta. El cambio a la
pestaña principal permite comprobar el acceso previsto a Mis planes. La
vista trabaja con datos de ejemplo y conserva los cambios durante la
interacción.

En la versión inicial, Chromium comprobó las dos pestañas y su navegación
por teclado, las 28 jornadas del ejemplo, el cambio entre cuadrícula y Día
a día y la edición de una jornada con una fuente añadida. También se
comprobaron la creación y el filtrado por categoría, la generación exacta
de 30 casillas, el rango inclusivo que contiene el 29 de febrero y el rechazo de JSON
inválido antes de confirmar una importación de ejemplo. Se revisaron los
flujos en escritorio y el ancho de 320 px con tema oscuro. Queda pendiente
la revisión de la propuesta por el usuario y la validación del contrato
contra Server.

En R02 se verificó que el drawer muestra el enlace junto a la actividad
que lo usa. Chromium comprobó la apertura del destino, el alta de una
actividad con enlace, la edición y el retiro de una fuente conservando
las actividades y sus otras referencias. También se comprobó la práctica
sin enlace y el rechazo de una URL HTTP tanto al guardar la jornada como
al previsualizar el JSON. El error de importación indica qué jornada y
actividad corregir. Los pares se conservaron al abrir la jornada tras
importarla. Se revisó el drawer en escritorio y a 320 px en tema oscuro.

[Experiencia de Teacher](106-nodia-teacher-guided-ux-redesign.md#23-propuesta-de-calendario-de-estudio) ·
[Ficha candidata para NodiaAI](../nodia-ai/knowledge/studies/features/study-calendar.md) ·
[Cola de entregas](TODO.md#cola-actual).

## 8. Primer corte de implementación

El API de Teacher incorpora **/api/v1/teacher/calendar** bajo la autoridad
vigente de **/nodia-teacher**. La migración aditiva conserva separado el
calendario personal de las evaluaciones y unidades de estudios adaptativos.

| Ruta relativa | Contrato |
| --- | --- |
| GET /plans | Lista propia de 20 calendarios por página con recuento total y filtro opcional de categoría. |
| POST /plans | Recibe el formato v1, un UUID de solicitud y los nombres nuevos confirmados. Una repetición equivalente recupera el calendario creado. |
| GET /plans/{planId} | Devuelve el calendario propio y el resumen ordenado de sus jornadas, incluido el recuento derivado. |
| GET, PATCH /plans/{planId}/days/{dayId} | Lee o guarda la jornada. PATCH requiere revisión y la colección ordenada de actividades con su estado explícito. |
| GET, POST /categories y PATCH /categories/{categoryId} | Gestionan las categorías propias y su actividad. Se preservan sus vínculos al desactivar. |

Se admiten hasta 366 jornadas, 12 categorías asignadas por calendario y
24 actividades por jornada. El cuerpo de Teacher se limita a 256 KiB.
Títulos y nombres de categoría usan hasta 120 caracteres, los apuntes
hasta 4000, el texto de actividad hasta 512, el nombre de fuente hasta 180
y la URL HTTPS hasta 2048. Los minutos se guardan como entero de 1 a 1440.

El ensayo HTTP ejecutó el Nest compilado sobre PostgreSQL 16.15 aislado,
con identidad de transporte sintética y validación real de sesión, módulo
y propiedad en la base. Se comprobaron migración reversible en vacío,
importación transaccional con reintento concurrente, alcance por usuario,
jornadas vacías y parciales, última marca, reapertura, conflicto de revisión,
fechas bisiestas y revocación del módulo. La prueba reproducible está en
[test:teacher:calendar](../../nodia-server/test/teacher-study-calendar.integration.mjs).

Chromium verificó Client con ese API y una base de prueba separada. La entrada
abrió en **Mis planes de estudio** y cargó el calendario al elegir su
pestaña. Se pegaron un plan de 28 jornadas y otro con fechas que incluían
el 29 de febrero. Se comprobó el filtro por categoría. La jornada cambió
de pendiente a completada y volvió a pendiente tras recargar, abrir en
**Día a día** y desmarcar una actividad. Se revisaron escritorio en español
con tema claro y 320 px en inglés con tema oscuro. La cuenta y los datos del
ensayo son sintéticos. La comprobación de la cuenta en cada entorno sigue
pendiente de adopción.

## 9. Revisión de las categorías y el pegado

Las categorías se muestran como chips de color que se acomodan al ancho
del drawer. Cada chip tiene un botón de lápiz para editar y otro de
encendido para cambiar su estado con confirmación. El filtro de actividad
permite ver y reactivar las categorías inactivas.

El drawer de pegado separa la edición del JSON y la revisión del plan.
El título y las instrucciones tienen espacio propio. El editor ocupa
el área principal y las acciones de plantilla quedan debajo. El pie
prescinde del divisor. La revisión muestra el resumen,
las categorías y las jornadas con sus actividades y fuentes. **Editar
JSON** devuelve el foco al editor y conserva el texto pegado.

La evaluación de impacto corresponde a la presentación y la navegación
del drawer en Client. El formato v1, la confirmación de categorías,
la autoridad de Teacher y el alcance de la ficha candidata para NodiaAI
conservan sus contratos.

Chromium verificó ambos drawers a 1243 px en español con tema oscuro
y a 320 px en inglés con tema claro. En una base de prueba aislada se
comprobaron el foco tras editar una categoría, la desactivación y
reactivación con filtro, el rechazo del JSON inválido y la revisión hasta
la jornada 28. Se volvió al editor con el mismo texto y se confirmó el
calendario en PostgreSQL.

## 10. Gestión del calendario y filtro de actividad

El menú de tres puntos de cada calendario ofrece **Actualizar**,
**Desactivar** o **Activar**, y **Eliminar**. Actualizar permite editar el
título y las categorías, conservando el rango, las jornadas y su avance.
Una categoría inactiva ya vinculada puede mantenerse o quitarse. Para
añadirla se requiere que vuelva a estar activa.

Los calendarios existentes y los nuevos empiezan activos. **Activos** es
la vista inicial. **Todos** e **Inactivos** incluyen los calendarios
desactivados, que siguen disponibles para consulta y edición. El filtro
de estado se combina con el de categoría y cambiar uno devuelve a la
primera página. Desactivar o reactivar requiere confirmación y conserva
todo el contenido y avance. Eliminar requiere otra confirmación y retira
el calendario, las jornadas, las actividades y sus asignaciones de
categoría. Las categorías personales siguen disponibles.

| Ruta relativa | Contrato de gestión |
| --- | --- |
| GET /plans | `status=active\|inactive\|all` filtra antes de paginar y contar. Si se omite se aplica `active`. La respuesta incluye `active`. |
| PATCH /plans/{planId} | Actualiza `title`, `category_ids` o `active` y devuelve el detalle propio. Se requieren identificadores de categorías del propietario. |
| DELETE /plans/{planId} | Devuelve 204 al eliminar el calendario propio o recuperar esa confirmación. Un identificador ajeno o inexistente devuelve 404. Una creación repetida con la clave de un calendario eliminado devuelve 410. |

El recibo de eliminación guarda los identificadores de propietario,
calendario y solicitud de alta para distinguir reintentos de nuevas
operaciones y evitar que un reintento vuelva a crear un calendario
eliminado. La autorización se comprueba contra el destino de Teacher.
El formato de pegado permanece en v1.

Chromium verificó a 1573 px en español y a 320 px en inglés el menú,
los filtros y el titular de Inicio de esta entrega. Con el API y la
base aislados se verificó que un fallo temporal conserva el formulario,
que actualizar y desactivar mantienen el avance y que eliminar conserva
las categorías y bloquea el reintento del alta. La migración conservó el
calendario existente en la instancia local de Teacher.

La tarjeta completa selecciona el calendario. El botón de tres puntos
abre su menú como control aparte. Chromium comprobó el clic en el
espacio libre de la tarjeta, la selección con teclado y el retorno del
foco al cerrar el menú a 1573 px y 320 px. El ajuste corresponde a la
interacción de Client y conserva el contrato y el contexto de NodiaAI.

## 11. Presentación de las actividades en el editor de jornada

La lista alinea el checkbox con la primera línea del título y muestra
la fuente debajo, en el mismo eje. El botón de edición tiene su propia
columna y los campos abiertos se distinguen del resumen de la actividad.
Chrome verificó el editor a 320 y 520 píxeles en tema oscuro, y a
320 píxeles en tema claro. La prueba incluye títulos de varias líneas,
enlaces extensos, foco en el campo de actividad y marcado con teclado.

El cambio se limita a la presentación y al nombre accesible de la
sección. Los conceptos, las operaciones y el significado de los
recuentos en la [ficha aprobada de Calendario, revisión 5](../nodia-ai/knowledge/studies/features/study-calendar.md)
siguen aplicando al editor. La evaluación concluye que el ajuste carece
de impacto sobre el contexto de NodiaAI.
