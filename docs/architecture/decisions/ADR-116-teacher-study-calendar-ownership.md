# ADR-116 — Persistencia de calendarios personales de Teacher

> Estado propuesto el 2026-11-22.

## Contexto

El calendario de estudio requiere casillas editables por fecha o por orden
relativo, categorías personales y creación en bloque a partir de texto
pegado. Cada actividad de una jornada puede tener su propia fuente.
Teacher ya persiste unidades, revisiones aceptadas y progreso evaluado.
El calendario permite organizar recursos externos incluso antes de crear
una sesión adaptativa.

## Opciones consideradas

### A. Extender las revisiones del plan adaptativo

- Permite reutilizar unidades y material vinculado desde el inicio.
- La edición de notas o el seguimiento manual quedarían acoplados al
  versionado de contenido, al ciclo de aceptación y a la semántica evaluada.
  Los calendarios manuales requerirían crear una sesión que simule ese ciclo.

### B. Agregado propio dentro de Teacher

- Permite calendario por fechas o ordinales, propiedad personal, alta
  manual y pegado con un ciclo de edición propio.
- Requiere persistencia adicional y definir un contrato posterior si se
  vinculan sesiones de Teacher.

### C. Servicio transversal de calendarios

- Facilita compartir un motor con otros módulos si surge otro alcance.
- Generaliza autoridad, categorías, estados y sincronización sin un segundo
  caso de uso definido. Aumenta el coste de integración del primer corte.

## Decisión propuesta

Elegir la opción B para el primer corte. Conservar **/nodia-teacher** como
destino de autoridad y validar el propietario en cada acceso. Crear
calendarios, jornadas, actividades ordenadas, categorías personales y sus
relaciones en tablas del dominio Teacher. La identidad de cada jornada se
mantiene entre las dos presentaciones. El ordinal es estable. En la
modalidad con fechas, la fecha es civil y puede proyectarse desde el
inicio y el ordinal.

Normalizar el nombre de las categorías por propietario y proteger la
coherencia de relaciones con FKs de alcance. Cada actividad guarda su
marca. La jornada se calcula como completada cuando tiene actividades y
todas están marcadas. Server proyecta ese cálculo y los recuentos desde las
filas persistidas. El guardado de una jornada usa una revisión esperada y
una sola transacción para sus actividades. La evidencia pedagógica
conserva su contrato propio.

Representar el pegado mediante un contrato de datos versionado. La interfaz
prepara una vista previa editable. La confirmación usa la misma escritura
atómica del alta manual, con validación de Server y recibo idempotente.
Cada fuente está asociada a la actividad que la usa. Se guarda con nombre
y URL HTTPS en el registro de la actividad. Una futura ampliación para
varias fuentes por actividad se puede resolver con una relación.

El estado activo de un calendario controla su inclusión en la lista
predeterminada. Cambiarlo conserva el agregado completo. La eliminación
confirmada retira el calendario y sus dependencias, y conserva un recibo
acotado al propietario, la identidad del calendario y su clave de alta.
El recibo permite recuperar una eliminación confirmada y rechazar el
reintento de creación original. Las categorías son reutilizables y
permanecen en el catálogo del propietario.

## Consecuencias

- La migración puede ser aditiva. La autoridad existente y los contratos de
  estudios adaptativos conservan sus identidades.
- Mantener la comprobación de propiedad, la integridad de las FKs y la
  confirmación idempotente de altas y eliminaciones.
- Revisar política de reprogramación, límites y objetivo de una vinculación
  futura después de validar los flujos visuales.

## Referencias

- [Plan111](../../mvp/111-teacher-study-calendar-plan.md)
- [Plan95 §5](../../mvp/95-studies-adaptive-learning.md#5-plan-de-x-jornadas-y-material-guardado)
- [ADR-089](ADR-089-versioned-study-plans-and-content.md)
- [ADR-092](ADR-092-stable-module-navigation-routes.md)
