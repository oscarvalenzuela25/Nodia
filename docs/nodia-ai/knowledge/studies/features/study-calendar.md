---
{
  "schema_version": 1,
  "document_id": "studies.study-calendar",
  "product_id": "studies",
  "kind": "feature",
  "revision": 1,
  "document_status": "draft",
  "implementation": {
    "status": "planned",
    "notes": "Propuesta de calendario personal de Teacher. Los contratos y la implementación del producto están pendientes de definición y comprobación."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Estudios y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/111-teacher-study-calendar-plan.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/89-module-access-and-user-data-scope.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-116-teacher-study-calendar-ownership.md",
      "kind": "specification"
    }
  ],
  "verification": {
    "checked_on": null,
    "evidence_paths": [],
    "notes": "PENDIENTE revisar los mockups, fijar contrato y comprobar implementación, acceso y persistencia."
  },
  "approval": null
}
---

# Calendario de estudio — ficha candidata

[Estudios](../README.md) · [Diseño y planificación](../../../../mvp/111-teacher-study-calendar-plan.md).

## Qué resuelve y qué significa

El calendario de estudio propuesto reúne jornadas que la persona crea y
organiza desde la entrada de Teacher. Cada calendario tiene un título,
un rango de fechas o una cantidad de días y categorías personales. Cada
jornada admite material escrito por la persona y enlaces. La marca manual
significa jornada realizada. La evaluación pedagógica conserva su propio
flujo.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y aclaración |
| --- | --- |
| «Organiza un calendario de inglés de 30 días» | Preparar contenido para 30 casillas numeradas. Preguntar por fechas sólo si la persona quiere usar un calendario fechado. |
| «Quiero estudiar desde el lunes hasta fin de mes» | Aclarar las dos fechas civiles si el período resulta ambiguo. |
| «Arma un plan que pueda pegar en Teacher» | Preparar texto para revisión humana con el [formato propuesto](../../../../mvp/111-teacher-study-calendar-plan.md#5-formato-para-pegar-un-plan). |
| «Marca todas las jornadas y aprueba las evaluaciones» | Remitir al seguimiento nativo de la jornada y al flujo de evaluación de Teacher. La marca voluntaria acredita seguimiento personal. |

## Operaciones y contratos

| Operación propuesta | Efecto esperado | Estado del contrato |
| --- | --- | --- |
| Listar calendarios y abrir jornada | Leer registros y recuentos propios | Endpoints y DTO pendientes. |
| Crear, editar y marcar | Persistir el calendario o el cambio revisado por la persona | Flujo nativo propuesto. Herramientas de NodiaAI pendientes de evaluación. |
| Pegar un plan | Analizar texto y preparar una vista previa local. Confirmar aplica el alta nativa | Esquema de intercambio v1 propuesto. Validación e idempotencia de Server pendientes. |

## Datos mínimos y resolución de dudas

Se requiere un título y una modalidad. Por fechas se requieren inicio y
término civiles e inclusivos; por cantidad se requiere un entero positivo.
Las categorías, minutos estimados, actividades, notas y fuentes son
opcionales. Un enlace se expresa con nombre y URL HTTPS. El propietario
se resuelve desde la sesión y los recuentos proceden de las jornadas.

## Reglas, acceso y restricciones

Validar acceso vigente a Teacher y propiedad de calendarios, jornadas y
categorías. Abrir una fuente es una acción voluntaria. El pegado usa datos
estructurados y su efecto se confirma en la interfaz nativa. El
[ADR propuesto](../../../../architecture/decisions/ADR-116-teacher-study-calendar-ownership.md)
explica las fronteras de persistencia.

## Filtros e informes

La propuesta contempla filtro por categoría propia y recuento de jornadas
realizadas sobre jornadas totales por calendario y semana mostrada.
Representar las fechas como días civiles y los calendarios sin fecha
por su ordinal. Paginación, filtros exactos y API quedan pendientes.

## Vista previa, confirmación y recuperación

La persona puede corregir el texto y revisar jornadas y categorías.
**Crear calendario** confirma el agregado revisado. El contrato propuesto
usa una transacción y concilia el recibo de la solicitud si se pierde la
respuesta. Los detalles de recuperación y su evidencia quedan pendientes.

## Integración y evidencia

- [ ] Revisar el diseño y fijar contrato y permisos.
- [ ] Comprobar rangos, ordinales, autoría, filtros y recuentos.
- [ ] Probar pegado, rechazo y reapertura sin efectos duplicados.
- [ ] Evaluar un alcance de integración de NodiaAI.

## Evolución y compatibilidad

| Revisión | Cambio | Herramientas y compatibilidad |
| --- | --- | --- |
| 1 | Propuesta inicial del [Plan111](../../../../mvp/111-teacher-study-calendar-plan.md). | Capacidad nativa en planificación. Conservar las revisiones, materiales y evaluaciones de Teacher. |
