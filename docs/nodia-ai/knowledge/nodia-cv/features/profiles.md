---
{
  "schema_version": 1,
  "document_id": "nodia-cv.profiles",
  "product_id": "nodia-cv",
  "kind": "feature",
  "revision": 1,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "Alta, edición, copia y borrado comprobados en Chromium, Nest y PostgreSQL aislado. Generación y persistencia de versiones siguen planificadas."
  },
  "integration_status": "unregistered",
  "maintainer": "Nodia",
  "sources": [
    {
      "path": "docs/mvp/113-nodia-cv-implementation-plan.md",
      "kind": "specification"
    },
    {
      "path": "docs/features/nodia-cv/ui-design.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-119-nodia-cv-owned-generation-and-verified-pdf.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/89-module-access-and-user-data-scope.md",
      "kind": "specification"
    }
  ],
  "verification": {
    "checked_on": "2026-11-24",
    "evidence_paths": ["docs/mvp/113-nodia-cv-implementation-plan.md", "docs/evidence/nodia-cv-ui-readiness-20261124.md"],
    "notes": "Integración Nest y PostgreSQL aislado comprueba sesión, ámbito, idempotencia, conflicto de revisión y eliminación. La conservación de versiones se comprueba en su corte de implementación."
  },
  "approval": null
}
---

# Perfiles profesionales — contexto funcional para NodiaAI

## Qué resuelve y qué significa

Un perfil profesional reúne los datos base que la persona quiere reutilizar
al preparar CV. Puede guardar varios perfiles y duplicar uno para conservar
una base al cambiar el cargo objetivo. La copia adquiere identidad
independiente al guardarla. El **Resumen profesional** describe la trayectoria
en el perfil y se incluye en el CV cuando corresponda.

El [Plan113](../../../../mvp/113-nodia-cv-implementation-plan.md) y la
[guía UI](../../../../features/nodia-cv/ui-design.md#2-perfiles)
describen el alcance previsto. Para iniciar [Generar CV](tailoring-and-verified-versions.md)
hace falta elegir un perfil guardado elegible. Las versiones guardadas
conservan su propio contenido y la identidad del PDF revisado.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Datos faltantes/ambigüedad | Aclaración esperada |
| --- | --- | --- | --- |
| «Quiero ver qué perfiles tengo» | Listar perfiles de la cuenta | Puede haber varios perfiles parecidos | Remitir a **Perfiles** de Nodia CV. Identificar por el registro elegido antes de localizar su detalle |
| «Copia mi perfil para una búsqueda distinta» | Crear una copia editable | Perfil de origen y nombre de la copia | Elegir el origen en **Perfiles**, luego **Duplicar perfil** y **Guardar perfil** para crear la nueva ficha |
| «Agrega la experiencia del año pasado» | Editar un perfil | Perfil, trabajo, fechas y datos que la persona pueda confirmar | Elegir el perfil y añadir o actualizar la experiencia desde la UI. Solicitar solo la precisión disponible |
| «Borra el perfil Backend» | Eliminar un perfil | Identidad exacta si el nombre coincide con otro | Seleccionar el registro y confirmar **Eliminar perfil** en Nodia CV |
| «Muéstrame el perfil de otra cuenta» | Acceder a un recurso ajeno | Autoridad y propósito de acceso | Aplicar autoridad vigente en Server. El chat carece de herramienta para resolverlo o consultar esos datos |

Estas solicitudes orientan al usuario hacia el flujo de la UI. La ficha
carece de capacidades ejecutables desde el chat.

## Operaciones y contratos

| Operación semántica | Clase/efecto | Herramienta y estado real | Endpoint/DTO/caso de uso | Resultado público |
| --- | --- | --- | --- | --- |
| Listar perfiles y abrir detalle | Lectura de recursos autorizados | Sin herramienta registrada | [API de perfiles](../../../../mvp/113-nodia-cv-implementation-plan.md#contrato-de-perfiles-cv-01) | Resumen de los perfiles del ámbito o detalle solicitado |
| Crear y editar perfil | Escritura propia desde formulario | Sin herramienta registrada | [API de perfiles](../../../../mvp/113-nodia-cv-implementation-plan.md#contrato-de-perfiles-cv-01) | Registro guardado con identidad y revisión según contrato |
| Duplicar perfil | Preparar un formulario de creación a partir de una lectura autorizada | Sin herramienta registrada | Guía UI y contrato de creación de Plan113 | Edición precargada. El guardado crea otro registro |
| Eliminar perfil | Retirar el perfil seleccionado tras confirmación | Sin herramienta registrada | Plan113 y guía UI de borrado | Confirmación de la baja o error con formulario conservado |

Las operaciones de perfiles exigen el módulo autenticado y validación de
dominio en Server. El catálogo de herramientas Chat permanece sin este
alcance. Crear, editar, copiar y eliminar perfiles no generan un CV por sí
mismos.

## Datos mínimos y resolución de dudas

| Dato/concepto | Obligatorio, condicional u opcional | Significado y fuente contractual | Resolución/aclaración |
| --- | --- | --- | --- |
| Identidad y nombres | Según los mínimos de Plan113 | El nombre de perfil distingue su finalidad y el nombre profesional se proyecta al CV | Confirmar cuál perfil se edita sin deducir identidad por texto |
| Contacto, enlaces y resumen profesional | Opcionales según contrato | Datos elegidos por la persona como contenido del CV, según Plan113 y guía UI | Conservar ausencias. El resumen se edita en el perfil |
| Trabajos y proyectos | Repetibles según contrato | Experiencias, logros, rol, tecnologías y período que puede confirmar el usuario | Agregar o quitar por registro. Mantener la precisión disponible |
| Formación, certificaciones, idiomas y otras secciones | Opcionales según contrato | Formación, credenciales, nivel de idiomas y datos complementarios | Usar la descripción o el dato confirmado. Evitar interpretar un nivel a partir de un nombre |
| Origen de duplicación | Requerido al pedir una copia | Detalle de perfil guardado y autorizado, según guía UI | Pedir la elección si un nombre identifica varias fichas |
| Identidad y revisión guardadas | Administradas por Server | Permiten recuperar el recurso correcto y detectar edición concurrente | Mantener la edición ante conflicto y seguir la recuperación del contrato |

La [sección de perfiles](../../../../features/nodia-cv/ui-design.md#2-perfiles)
describe el formulario. Los DTO, nulabilidad y validaciones definitivos se
verifican en los cortes del [Plan113](../../../../mvp/113-nodia-cv-implementation-plan.md).

## Reglas, acceso y restricciones

Se propone el módulo `/nodia-cv` con sesión vigente y ámbito del recurso
resuelto en Server según [autoridad89](../../../../mvp/89-module-access-and-user-data-scope.md)
y Plan113. Los datos base son privados. Cambiar un ID, una búsqueda o un
nombre no concede acceso. Distinguir asignar el módulo de consultar o
cambiar los datos de un perfil concreto.

El usuario revisa el nombre y el destino al guardar una copia. El nombre
sirve para presentación. Las acciones y ediciones conservan identidad
estable por registro. El borrado de un perfil requiere su confirmación y
se rige por el plan para borradores activos. Las versiones guardadas se
abren por su identidad propia y tienen copias de los datos usados.

## Filtros e informes

| Campo/medida | Predicados o agregaciones admitidos | Fecha/moneda/unidad/grano | Relaciones y procedencia | Fuente |
| --- | --- | --- | --- | --- |
| Perfiles profesionales | Listado autorizado con los filtros y paginado definidos por el contrato | Un perfil por registro | Ámbito personal según Server. El detalle contiene las secciones de la ficha | [Plan113](../../../../mvp/113-nodia-cv-implementation-plan.md) |
| Informes y métricas profesionales | Fuera de esta función | No aplica | Los períodos sirven al contenido del CV | [Guía UI](../../../../features/nodia-cv/ui-design.md#2-perfiles) |

## Vista previa, confirmación y recuperación

El formulario de creación o duplicación muestra los datos editables antes
de **Guardar perfil**. El diálogo de eliminación identifica el perfil
seleccionado y explica el efecto sobre sus versiones archivadas. Cancelar
vuelve al editor. Los cambios terminan al recibir la confirmación de Server.

Ante conflicto o fallo, conservar la edición y la identidad de la operación.
Recuperar o reintentar conforme a [Plan113](../../../../mvp/113-nodia-cv-implementation-plan.md)
y a la [guía UI](../../../../features/nodia-cv/ui-design.md). Las garantías de
concurrencia y recuperación esperan sus pruebas.

### Evaluación del cambio de interfaz — 2026-11-24

El encabezado de Nodia CV comparte la identidad visual de Nodia IA y
Nodia Teacher. La ayuda contextual de cada campo explica los datos y
formatos del editor. Los campos, la validación y las operaciones que
documenta la ficha conservan el mismo significado. El cambio es de
presentación y no afecta el contexto operativo de NodiaAI.
[Guía de interfaz](../../../../features/nodia-cv/ui-design.md#2-perfiles).

## Integración y evidencia

- [ ] Contratos de lectura, escritura y asignación comprobados.
- [ ] Ámbito de los recursos y respuesta a identificadores ajenos comprobados.
- [ ] Datos mínimos, validación de fechas y conservación de edición comprobados.
- [ ] Duplicación, conflicto y eliminación con versiones asociadas comprobados.
- [ ] Recorrido de perfiles íntegro verificado en navegador y Server.

La ficha está en borrador y el alcance inicial usa la interfaz nativa.
La documentación no registra una herramienta ni publica contexto por sí sola.
Toda integración conversacional futura requeriría el contrato y la
verificación del [proceso de publicación](../../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md).

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Herramientas/contexto afectados | Compatibilidad/propuestas pendientes |
| --- | --- | --- | --- |
| 1 | Perfiles, copia editable, eliminación y relación con versiones según [Plan113](../../../../mvp/113-nodia-cv-implementation-plan.md) | Sin registro de herramientas o fragmentos publicados | Implementación, validación y evidencia pendientes |
