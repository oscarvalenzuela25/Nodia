# Calendario de estudio de Nodia Teacher

Borrador de diseño y planificación del 2026-11-22. Después de revisar los
mockups se decidirá el primer corte de desarrollo. La referencia funcional
es **4 semanas de inglés**, con 28 jornadas de 30 minutos, actividades con
sus fuentes y un recuento de jornadas completadas.

## 1. Alcance solicitado

- La entrada de Teacher tendrá **Mis planes de estudio**, activa por defecto,
  y **Calendario de estudio** como pestaña secundaria.
- La persona puede crear un calendario propio con título y categorías, elegir
  un rango con inicio y término o indicar una cantidad de días sin fechas.
  El calendario y el recorrido día por día permiten abrir la misma jornada.
- Las casillas tienen datos editables y una marca de realización. Cada
  jornada reúne actividades ordenadas. Cada actividad puede tener una
  fuente propia, según la aclaración del 2026-11-22.
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
| Jornada | Abrir una casilla desde cualquiera de las vistas. Editar título, notas y minutos estimados. Añadir o editar actividades ordenadas y asignar a cada una su fuente, con nombre y enlace. Marcar o desmarcar **Jornada completada**. |
| Categorías | Abrir el drawer, crear o editar las categorías propias y ver los chips con los que se identifican los calendarios. Mantener la gestión en el mismo drawer y conservar sus campos ante un error. |
| Pegar un plan | Pegar el formato de §5, revisar los errores y editar la vista previa. Confirmar el resumen de jornadas y categorías que se guardará. |

El detalle de jornada muestra su ordinal o fecha junto a las actividades.
El enlace aparece en la actividad que lo usa. Una práctica personal puede
dejar el enlace vacío. En escritorio se propone un drawer lateral. En móvil
se adapta al ancho y ofrece **Día a día** como lista en el orden del plan,
con acceso a la misma edición. Cerrar una edición devuelve el foco a la
casilla o acción que la abrió.

La propuesta cuenta las jornadas realizadas de cada bloque y del plan. El
avance es «jornadas realizadas / jornadas del plan». Los minutos declarados
son estimados. La marca la controla la persona y acredita su seguimiento:
una casilla abierta o una fuente visitada no produce la marca automáticamente.

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
El timestamp UTC del guardado registra cuándo se realizó una marca; la
fecha de una jornada mantiene su día civil al cambiar de dispositivo o país.
Antes de incorporar **Hoy**, reprogramación o recordatorios hay que definir
si la referencia usa la zona del calendario o la zona preferida de la persona.

## 4. Persistencia y autoridad propuestas

La siguiente estructura orienta la migración. Los nombres, restricciones y
shape HTTP se fijarán al empezar el backend. [ADR de persistencia y pegado](../architecture/decisions/ADR-116-teacher-study-calendar-ownership.md).

| Tabla propuesta | Datos clave |
| --- | --- |
| teacher_calendar_plans | ID, propietario, título, modalidad, campos de calendario según modalidad, revisión y timestamps. |
| teacher_calendar_days | ID, plan, ordinal, título y notas opcionales, minutos estimados opcionales, estado derivado de la marca de realización, revisión y timestamps. |
| teacher_calendar_activities | ID estable, jornada, posición, texto y una fuente opcional con nombre y URL HTTPS. |
| teacher_calendar_categories | ID, propietario, nombre visible y clave normalizada, color de catálogo, descripción opcional, actividad y timestamps. |
| teacher_calendar_plan_categories | Vínculo único entre plan y categoría dentro del mismo propietario. |

Cada actividad conserva su ID al editarla o cambiar su posición. La fuente
se guarda en la actividad. Nombre y URL están ambos presentes o ambos
ausentes. Si en el futuro se necesitan varias fuentes por actividad, se
evaluará una relación propia.

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
y **url**. El orden de las actividades sigue el arreglo. La vista previa
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
nombres conservar. El dueño, los ID internos, la actividad de una categoría
y la fecha de realización se administran en Server y no forman parte del
formato pegable.

Al pulsar **Crear calendario** se envía el contenido final revisado. El
servidor vuelve a validar esquema y autoridad. En una transacción registra
plan, jornadas, actividades con sus fuentes y categorías expresamente
incluidas en la confirmación. La creación manual usa el mismo agregado.
La clave de idempotencia y el recibo permiten conciliar una respuesta
perdida sin duplicar filas. Un conflicto o error mantiene el contenido
para corregirlo. El formato puede venir de cualquier agente, y Nodia
interpreta el texto de forma determinista.

## 6. Orden de trabajo y verificación

- [ ] Revisar mockups. Validar la navegación entre pestañas, los dos tipos de
  calendario, el detalle de jornada con fuente por actividad, el drawer de
  categorías y las pantallas de pegado y revisión. Acordar qué datos se
  pueden cambiar después de crear.
- [ ] Cerrar el contrato de Server y la migración. Cubrir rangos de un día,
  cambio de mes y año, bisiesto, transición DST, exactamente 30 jornadas
  numeradas, días vacíos y rechazos por lotes inválidos. Verificar fuentes
  ausentes, datos incompletos, URL inválida y orden de las actividades.
- [ ] Implementar primero el agregado y sus casos de uso. Verificar
  aislamiento entre usuarios, revocación de acceso, categorías duplicadas,
  transacción completa, reintento idempotente y guardado concurrente.
- [ ] Conectar Client. Probar filtrado por chip, navegación y foco,
  cambio de vista, guardado de jornada y progreso, errores de importación y
  persistencia del borrador con 320 px y escritorio, ES/EN y ambos temas.
- [ ] Verificar extremo a extremo con un plan de 28 días y otro con fechas.
  Confirmar la misma jornada y recuento después de recargar, y comprobar que
  los accesos existentes de Mis planes y sus evaluaciones siguen operativos.

Quedan por precisar los límites de tamaño, las reglas de edición y
reprogramación con marcas existentes y la semántica de una futura
vinculación al plan adaptativo. El primer pendiente es la revisión del
diseño y de estos límites antes de fijar el contrato.

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
