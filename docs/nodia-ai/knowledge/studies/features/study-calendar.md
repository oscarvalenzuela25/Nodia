---
{
  "schema_version": 1,
  "document_id": "studies.study-calendar",
  "product_id": "studies",
  "kind": "feature",
  "revision": 5,
  "document_status": "approved",
  "implementation": {
    "status": "implemented",
    "notes": "Calendario nativo en Client y Server. Hay contratos y adaptadores candidatos para consultas y propuestas confirmables en NodiaAI."
  },
  "integration_status": "published",
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
    },
    {
      "path": "nodia-server/src/nodia-ai-teacher-operations/calendar-operations.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-11-23",
    "evidence_paths": [
      "docs/mvp/111-teacher-study-calendar-plan.md",
      "docs/evidence/nodia-ai-teacher-catalog-20261123.md"
    ],
    "notes": "Contratos, propiedad y confirmación comprobados en PostgreSQL aislado. La aprobación y la verificación del catálogo se registran en las evidencias enlazadas."
  },
  "approval": {
    "reference": "docs/evidence/nodia-ai-teacher-catalog-approval-20261123.md",
    "revision": 5,
    "content_sha256": "e5ac78c6b11f18401d00b07c2f42c42b0e9838cee64ea940fe411f1f31d8dd07"
  }
}
---

# Calendario de estudio — ficha candidata

[Estudios](../README.md) · [Diseño y planificación](../../../../mvp/111-teacher-study-calendar-plan.md).

## Qué resuelve y qué significa

El calendario de estudio reúne jornadas que la persona crea y
organiza desde la entrada de Teacher. Cada calendario tiene un título,
un rango de fechas o una cantidad de días y categorías personales. Cada
jornada admite actividades ordenadas. Cada actividad tiene texto, una
marca de realización y una fuente opcional con nombre y enlace. Una
jornada con al menos una actividad se completa al marcar todas. Si se
desmarca una, la jornada vuelve a pendiente. Guardar confirma las marcas
y actualiza los recuentos del calendario.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y aclaración |
| --- | --- |
| «Organiza un calendario de inglés de 30 días» | Preparar contenido para 30 casillas numeradas. Preguntar por fechas sólo si la persona quiere usar un calendario fechado. |
| «Quiero estudiar desde el lunes hasta fin de mes» | Aclarar las dos fechas civiles si el período resulta ambiguo. |
| «Arma un plan que pueda pegar en Teacher» | Preparar texto para revisión humana con el [formato propuesto](../../../../mvp/111-teacher-study-calendar-plan.md#5-formato-para-pegar-un-plan). |
| «Pon el video en la actividad de la lección y el enlace de ejercicios en la práctica» | Vincular cada fuente a su actividad. Pedir el enlace que falte si la persona quiere añadirlo. |
| «Marca las actividades que terminé» | Remitir al seguimiento nativo de las actividades y al guardado de la jornada. Las pruebas de Teacher se administran en su flujo de evaluación. |
| «Quiero pausar este calendario» | Remitir a **Desactivar** en el menú de tres puntos. La persona puede recuperarlo desde **Inactivos**. |
| «Quiero borrar un calendario» | Remitir a **Eliminar** en el menú de tres puntos. La persona confirma la eliminación del calendario y su progreso. |

## Operaciones y contratos

| Operación propuesta | Efecto esperado | Estado del contrato |
| --- | --- | --- |
| Listar calendarios y abrir jornada | Leer registros y recuentos propios. Filtrar por estado y categoría | API nativa con Activos como vista inicial. |
| Crear, editar y marcar | Persistir el calendario o el cambio revisado por la persona | Guardado nativo por revisión. Contratos conversacionales candidatos. |
| Actualizar, activar, desactivar o eliminar un calendario | Editar título y categorías, alternar su actividad o eliminar calendario, jornadas y avance | Gestión en Teacher. El estado y el título conservan jornadas y avance. |
| Pegar un plan | Analizar texto y preparar una vista previa local. Confirmar aplica el alta nativa | Esquema v1 con validación e idempotencia de Server verificadas en laboratorio. |

## Operaciones desde NodiaAI

Las herramientas consultan los calendarios, las jornadas y las
categorías de la cuenta autenticada con acceso a Nodia Teacher.
El listado parte de los calendarios activos. Se puede filtrar por
categoría y por estado y recorrer las jornadas y actividades por página.
Una fuente puede incluir un enlace HTTPS que la persona puede abrir.

Una propuesta puede crear un calendario por fechas o días numerados
con el plan v1, actualizar su título y categorías, activarlo,
desactivarlo o eliminarlo. Para editar una jornada se conservan las
actividades que deban seguir en ella. Cada actividad también se puede
marcar o desmarcar individualmente. Teacher calcula si la jornada
queda completa a partir de las marcas vigentes. Las categorías pueden
crearse, editarse, activarse y desactivarse.

La persona revisa y confirma cada propuesta desde el control de NodiaAI.
Para borrar un calendario debe identificar el título y revisar el
impacto en jornadas, actividades y avance. Si cambian el destino o
los datos que justificaron una propuesta, debe prepararse una nueva.

## Datos mínimos y resolución de dudas

Se requiere un título y una modalidad. Por fechas se requieren inicio y
término civiles e inclusivos; por cantidad se requiere un entero positivo.
Las categorías, minutos estimados, actividades y notas son opcionales.
Cada actividad incluida requiere texto. Su fuente es opcional y, cuando
se indica, requiere nombre y URL HTTPS. El propietario se resuelve desde
la sesión. Los recuentos de jornadas se derivan de las marcas persistidas.

## Reglas, acceso y restricciones

Validar acceso vigente a Teacher y propiedad de calendarios, jornadas,
actividades y categorías. Abrir una fuente es una acción voluntaria. El
pegado usa datos estructurados y su efecto se confirma en la interfaz nativa. El
[ADR propuesto](../../../../architecture/decisions/ADR-116-teacher-study-calendar-ownership.md)
explica las fronteras de persistencia.

## Filtros e informes

La vista incluye filtros combinables por categoría propia y por estado
del calendario, con **Activos** como opción inicial. Muestra el recuento
de jornadas completadas sobre el total por calendario y semana.
Las jornadas sin actividades siguen pendientes y cuentan en el total.
Representar las fechas como días civiles y los calendarios sin fecha
por su ordinal. El [contrato HTTP](../../../../mvp/111-teacher-study-calendar-plan.md#8-primer-corte-de-implementación)
recoge paginación y autoridad.

## Vista previa, confirmación y recuperación

La persona puede corregir el texto y revisar jornadas, categorías
y actividades con sus fuentes. Las actividades importadas empiezan pendientes.
**Crear calendario** confirma el agregado revisado. Server registra la
creación en una transacción y recupera el calendario al repetir la misma
solicitud vigente. Si se eliminó, ese reintento devuelve un error terminal.
Para crear otra copia se requiere una confirmación nueva.

## Integración y evidencia

- [x] Confirmar en el mockup el estado de jornada calculado por actividad.
- [x] Fijar contrato y comprobar permisos en PostgreSQL aislado.
- [x] Comprobar rangos, ordinales, autoría, filtros y recuentos.
- [x] Probar pegado, fuentes opcionales o inválidas, rechazo y reapertura
  sin efectos duplicados.
- [ ] Evaluar un alcance de integración de NodiaAI.

## Evolución y compatibilidad

| Revisión | Cambio | Herramientas y compatibilidad |
| --- | --- | --- |
| 1 | Propuesta inicial del [Plan111](../../../../mvp/111-teacher-study-calendar-plan.md). | Capacidad nativa en planificación. Conservar las revisiones, materiales y evaluaciones de Teacher. |
| 2 | Cada actividad admite una fuente propia. El JSON v1 de diseño agrupa el texto con su fuente en cada actividad. | Diseño del formato de intercambio previo al desarrollo. |
| 3 | La jornada se completa al marcar todas sus actividades. El guardado confirma sus marcas. | El JSON de alta empieza con actividades pendientes. |
| 4 | Gestión nativa por calendario y filtro de actividad combinado con categoría. | El pegado conserva el formato v1. La integración de NodiaAI permanece pendiente de evaluación. |
