---
{
  "schema_version": 1,
  "document_id": "nodia-cv.tailoring-and-verified-versions",
  "product_id": "nodia-cv",
  "kind": "feature",
  "revision": 13,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "Generación API key, revisión, PDF e historial comprobados en VM. El piloto verificó Agentic con GPT-6.2 Sol y Gemini 4 Hydrogen en Alto. Producción verificó el recorrido de ChatGPT por selección."
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
    "checked_on": "2026-11-26",
    "evidence_paths": ["docs/mvp/113-nodia-cv-implementation-plan.md", "docs/evidence/nodia-cv-api-key-vm-20261124.md", "docs/evidence/nodia-cv-generation-ui-20261124.md", "docs/evidence/nodia-cv-pdf-versions-20261124.md", "docs/evidence/nodia-cv-pilot-vm-and-ats-20261124.md", "docs/evidence/nodia-cv-agentic-baseline-vm-20261125.md", "docs/evidence/nodia-cv-agentic-delivery-20261125.md", "docs/evidence/nodia-cv-first-use-production-20261126.md"],
    "notes": "La VM verificó las dos plantillas mediante OneATS público. Plan113 §20 registra cuatro modelos en producción, junto con apertura, descarga y requisitos de versiones."
  },
  "approval": null
}
---

# Generación y versiones verificadas — contexto funcional para NodiaAI

## Qué resuelve y qué significa

**Generar CV** prepara un borrador a partir de un [perfil guardado](profiles.md)
y el texto de una oferta que aporta el usuario. La interfaz permite elegir
el idioma y aplicar una selección de IA. El flujo muestra qué requisitos
encuentran respaldo y cuáles requieren revisión. La versión guardada nace
cuando el usuario revisa y aprueba el resultado con **Guardar versión**.

La vista del documento ayuda a revisar el contenido. **Texto extraído** y
**Comprobaciones ATS** muestran evidencia de lectura del PDF exacto según
el alcance comprobado. El [Plan113](../../../../mvp/113-nodia-cv-implementation-plan.md),
la [guía UI](../../../../features/nodia-cv/ui-design.md) y el
[ADR119 propuesto](../../../../architecture/decisions/ADR-119-nodia-cv-owned-generation-and-verified-pdf.md)
describen el flujo implementado y los pendientes de aceptación.

Los requisitos enlazan su evidencia con la vista previa. En
**Tecnologías** la persona elige qué conocimientos incluye en el CV,
confirma fuente y uso para un aporte nuevo o marca un recordatorio de
estudio. El PDF incorpora las tecnologías incluidas. Editorial y
Contemporánea se suman a Clásica y Compacta. La extracción interna y
la importación ATS externa tienen comprobaciones distintas.

El editor dispone de cartas separadas para la postulación. La de
presentación se puede editar a partir de la oferta y hechos seleccionados.
La de recomendación puede provenir de un PDF recibido o de un
borrador para revisión y firma. El usuario descarga cada documento
desde el borrador activo. [Plan113 §25](../../../../mvp/113-nodia-cv-implementation-plan.md#25-requisitos-tecnologías-y-documentos-de-postulación--2026-11-27).

## Agentic en el piloto de la VM

El piloto aislado de la VM habilitó GPT-6.2 Sol en Alto y Gemini 4
Hydrogen en Alto en **Generar CV**.
La prueba del piloto registró conexión, modo, modelo, esfuerzo y sesión.
La generación exige perfil guardado y oferta.
La recuperación consulta el recibo sin reenviar.
[Recorrido ordinario comprobado](../../../../evidence/nodia-cv-agentic-delivery-20261125.md).
[Continuación de CV-03](../../../../mvp/113-nodia-cv-implementation-plan.md#17-continuación-de-cv-03--generación-agentic--2026-11-25).

## Agentic en producción

El navegador generó con **ChatGPT → Agentic → GPT-6.1 Sol → Medio**
y leyó el texto del PDF. El recorrido con **GPT-6.2 Sol → Alto**
incluyó guardado, reapertura y descarga.
[Plan113 §18](../../../../mvp/113-nodia-cv-implementation-plan.md#publicación-y-prueba-en-navegador) y [§19](../../../../mvp/113-nodia-cv-implementation-plan.md#19-gpt-61-sol-en-el-selector-agentic--2026-11-26).

## Primera generación y reapertura por versión

El primer borrador puede iniciar la ejecución con la conexión, modo, modelo
e intensidad compatibles elegidos. La disponibilidad real se comprueba
mediante la inferencia y el cierre del transporte.
[QA de producción](../../../../evidence/nodia-cv-first-use-production-20261126.md).
[Plan113 §20](../../../../mvp/113-nodia-cv-implementation-plan.md#20-primera-generación-y-recuperación-por-versión--2026-11-26).

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Datos faltantes/ambigüedad | Aclaración esperada |
| --- | --- | --- | --- |
| «Adapta un CV a esta oferta» | Preparar un borrador | Perfil guardado, oferta, idioma y selección válida | Remitir a **Generar CV**. Allí se eligen y revisan los insumos |
| «Incluye esta habilidad que olvidé» | Revisar un requisito | Habilidad y respaldo que la persona confirma | Usar **Revisar** o actualizar el perfil conforme al flujo. Mantener el requisito pendiente si falta respaldo |
| «¿El CV pasa los filtros ATS?» | Consultar comprobaciones de lectura o importación | Versión exacta y qué importador interesa | Dirigir a las comprobaciones. Explicar el alcance concreto de la evidencia disponible |
| «Abre o borra el CV para Ingeniería» | Abrir una versión o pedir su baja | Identidad de la versión cuando hay varios CV del mismo cargo | Elegir en **CV guardados** por perfil y número de versión. La baja pide confirmación |
| «Envía el CV a esa empresa por mí» | Postular o enviar a un tercero | Destinatario y canal, fuera del alcance | Remitir al usuario a descargar su versión desde Nodia CV y gestionar el envío por su cuenta |

Los ejemplos guían hacia la interfaz. El chat carece de herramientas
registradas para leer la oferta o actuar sobre un borrador o versión.

## Operaciones y contratos

| Operación semántica | Clase/efecto | Herramienta y estado real | Endpoint/DTO/caso de uso | Resultado público |
| --- | --- | --- | --- | --- |
| Generar borrador | Preparación temporal con Nodia IA. Puede consumir uso del proveedor | Sin herramienta registrada | POST /api/v1/nodia-cv/generations con recibo recuperable | Identidad y estado del trabajo. Borrador al completarse en el alcance autorizado |
| Revisar evidencia de un requisito | Escritura de revisión temporal confirmada por el titular | Sin herramienta registrada | PUT /api/v1/nodia-cv/drafts/:id con revisión esperada | Hechos seleccionados y aportes declarados. La vista del contenido refleja el resultado |
| Preparar PDF y observar sus comprobaciones | Artefacto privado y lectura verificable | Sin herramienta registrada | POST /drafts/:id/pdf y GET /drafts/:id/pdf/:artifactId | Archivo y texto extraído ligados a revisión, plantilla y huella |
| Guardar versión | Escritura explícita de una copia revisada | Sin herramienta registrada | POST /versions con clave, generación, revisión, artefacto y hash | Identidad propia de la versión guardada |
| Listar, abrir y descargar versiones | Lectura de metadatos y artefactos privados | Sin herramienta registrada | GET /versions, GET /versions/:id y GET /versions/:id/pdf | Lista del ámbito y versión exacta en su lectura o descarga |
| Editar una copia de una versión guardada | Preparación temporal privada | Sin herramienta registrada | POST /versions/:id/draft-copy | Copia del contenido y el análisis archivados. La selección de IA se aplica antes de pedir la edición |
| Eliminar CV guardado | Baja de la versión elegida tras confirmación | Sin herramienta registrada | DELETE /versions/:id | Baja de la versión y del acceso a sus bytes |

El contrato de la UI autentica y autoriza cada operación. Guardar o borrar
una versión son acciones humanas distintas de preparar o consultar un
resultado. Los endpoints usan el prefijo `/api/v1/nodia-cv` y revalidan
la sesión y el acceso al módulo.

## Datos mínimos y resolución de dudas

| Dato/concepto | Obligatorio, condicional u opcional | Significado y fuente contractual | Resolución/aclaración |
| --- | --- | --- | --- |
| Perfil guardado | Obligatorio para generar | Fuente revisada de la experiencia. La identidad y revisión proceden de Server | Crear o seleccionar el perfil desde Nodia CV. Con cero perfiles, la generación permanece deshabilitada |
| Oferta e idioma | Según los datos mínimos de Plan113 | Texto de la oferta y lenguaje del CV. El idioma de interfaz se configura aparte | Conservar el texto del usuario y revisar los campos que falten |
| Selección de IA aplicada | Obligatoria para usar la generación | Conexión, modo, modelo e intensidad cuando corresponda | Aplicar una selección válida para CV. Distinguir configuración y disponibilidad comprobada |
| Requisito y evidencia | Dependen de la oferta y de los datos confirmados | El respaldo puede proceder de experiencia, proyectos y competencias | Remitir a revisión cuando un requisito quede sin respaldo |
| Plantilla, PDF e identidad de verificación | Según la revisión u operación solicitada | Presentación, bytes y prueba de lectura de un mismo documento | Usar la vista y estado de la identidad exacta |
| Identidad de versión | Requerida al abrir, descargar o eliminar | Snapshot guardado con número y datos para distinguirlo de otros CV | Elegir una versión cuando la referencia por cargo sea ambigua |

Las fechas, campos opcionales y datos ausentes conservan su significado en
la salida. Los esquemas y validaciones se enlazan desde
[Plan113](../../../../mvp/113-nodia-cv-implementation-plan.md).

## Reglas, acceso y restricciones

- Se propone el módulo `/nodia-cv` con sesión vigente. El ámbito de perfiles,
  borradores, versiones y archivos se resuelve en Server conforme a
  [autoridad89](../../../../mvp/89-module-access-and-user-data-scope.md)
  y su aplicación en Plan113.
- El texto de la oferta y los contenidos de perfil son datos. La
  generación usa las instrucciones controladas por el dominio. Un
  requisito de una oferta se muestra para revisión cuando falta evidencia
  que permita atribuírselo a la persona.
- El flujo de CV usa una selección de IA propia de la tarea. Calificación
  de una selección en otro producto y un catálogo cargado no acreditan
  inferencia real de CV. La evidencia por selección y entorno sigue
  [Plan91](../../../../mvp/91-ai-provider-onboarding-verification.md)
  para las pruebas aplicables.
- La verificación de lectura cubre lo comprobado del PDF y el verificador
  usado. La compatibilidad con un ATS externo se describe por importador
  probado. La decisión de contratación queda en el proceso de la empresa.
- El alcance inicial queda en la interfaz de CV, con oferta pegada.
  Automatizar portales, postular, enviar a terceros o consultar los datos
  de CV desde Chat son exclusiones de esta revisión.
- La eliminación de la versión se confirma por su identidad propia. El
  perfil se gestiona en **Perfiles** y conserva su operación de baja
  independiente. La retención y eliminación técnica de datos temporales
  se rige por [ADR119 propuesto](../../../../architecture/decisions/ADR-119-nodia-cv-owned-generation-and-verified-pdf.md)
  y Plan113.

## Filtros e informes

| Campo/medida | Predicados o agregaciones admitidos | Fecha/moneda/unidad/grano | Relaciones y procedencia | Fuente |
| --- | --- | --- | --- | --- |
| CV guardados | Listado autorizado con filtros y paginado definidos por contrato | Una versión por registro | Snapshot y PDF revisados. El perfil de origen puede haberse eliminado | [Plan113](../../../../mvp/113-nodia-cv-implementation-plan.md) |
| Requisitos de la oferta | Evidencia vinculada o revisión pendiente en el borrador | Un requisito del análisis | Oferta y perfil de la generación seleccionada | [Guía UI](../../../../features/nodia-cv/ui-design.md#31-preparación-y-requisitos) |
| Comprobaciones ATS | Lectura del PDF exacto y evidencia por importador cuando exista | Un PDF verificado | Identidad de versión y plantilla, con su resultado | [Guía UI](../../../../features/nodia-cv/ui-design.md#4-vista-previa-y-comprobaciones-ats) |

El alcance descrito incluye navegación y revisión de versiones. El plan
carece de informes combinables de postulaciones, resultados o puntuación
de selección.

## Vista previa, confirmación y recuperación

Elegir perfil y oferta, aplicar la selección de IA y lanzar
**Generar borrador**. La preparación conserva un resultado temporal para
revisión. Mostrar el documento y, cuando exista, el texto extraído
del PDF correspondiente. Si cambian los insumos o se sale de **Generar CV**,
se limpian la vista previa y los requisitos del borrador completado.
Cambiar plantilla mantiene el contenido y permite
preparar y verificar otro PDF con la misma revisión.

Antes de cambiar de sección, de ruta o de generación con un borrador sin
guardar, elegir guardar, descartar o seguir editando. Guardar desde ese
diálogo verifica el PDF de la revisión y deja la versión en **CV
guardados**. Descartar retira el resultado temporal de la vista. Una
referencia de un trabajo anterior se comprueba sin sustituir la oferta
actual ni abrir su borrador.
[Plan113 §21](../../../../mvp/113-nodia-cv-implementation-plan.md#21-guardar-o-descartar-antes-de-salir--2026-11-26).

**Editar con IA** prepara una propuesta temporal a partir del borrador
activo y una instrucción de la persona. Puede seleccionar, omitir y
reordenar datos del perfil. La persona compara el resultado, aplica la
propuesta o conserva el original. Guardar archiva la revisión elegida.
[Plan113 §22](../../../../mvp/113-nodia-cv-implementation-plan.md#22-edición-del-borrador-con-ia--2026-11-26).

Desde **CV guardados**, **Editar una copia** abre una copia temporal en
**Generar CV**. Se conserva la versión de origen y se elige una
selección compatible para pedir cambios. Para empezar otro borrador,
**Limpiar campos** restablece el formulario y pide una decisión si la
revisión actual sigue sin guardar.
[Plan113 §23](../../../../mvp/113-nodia-cv-implementation-plan.md#23-editar-un-cv-guardado-y-limpiar-el-formulario--2026-11-26).

**Guardar versión** confirma la versión concreta que la persona revisó.
Al abrirla después se conserva su snapshot y el PDF exacto. La versión
también muestra los requisitos y la evidencia archivada de solo lectura
cuando contiene ese análisis. **Eliminar CV**
muestra el cargo, número de versión y perfil en su confirmación. Cancelar
vuelve a la vista anterior. La UI conserva contexto y edición frente a
errores recuperables.

Para timeout, pérdida de red o concurrencia, recuperar la intención y su
estado conforme al [Plan113](../../../../mvp/113-nodia-cv-implementation-plan.md).
El resultado incierto queda pendiente de conciliación según el
[ADR119 propuesto](../../../../architecture/decisions/ADR-119-nodia-cv-owned-generation-and-verified-pdf.md).
Revalidar o recargar conserva la relación con esa intención.
Preparar o consultar una versión guardada no genera inferencias. La
verificación interna de lectura conserva su alcance por archivo.

## Integración y evidencia

- [x] Admisión, privacidad y recuperación comprobadas en laboratorios de Server y Client.
- [x] Revisión de requisitos y evidencia comprobadas con casos límite.
- [x] Extracción del PDF exacto comprobada en Clásica y Compacta, en español e inglés.
- [x] Guardado, apertura, descarga y baja de versión comprobados por identidad.
- [ ] Proveedor, modo y modelo comprobados para el alcance real de CV.
- [x] Lectura de Clásica y Compacta EN en el [piloto público de OneATS](../../../../evidence/nodia-cv-pilot-vm-and-ats-20261124.md).
- [ ] Verificación en el tenant de reclutamiento autorizado.

El alcance inicial se ejecuta desde la interfaz de CV. La ficha
permanece en borrador y cualquier integración conversacional futura
requeriría contrato, registro y verificación según el
[proceso de publicación](../../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md).

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Herramientas/contexto afectados | Compatibilidad/propuestas pendientes |
| --- | --- | --- | --- |
| 12 | Copia editable de una versión guardada, limpieza explícita y cambio de modelo ante resultado incierto. [Plan113 §23](../../../../mvp/113-nodia-cv-implementation-plan.md#23-editar-un-cv-guardado-y-limpiar-el-formulario--2026-11-26) | Sin herramientas registradas o fragmentos publicados | Una versión histórica puede carecer del análisis estructurado |
| 10 | Primera generación con selección compatible, limpieza al cambiar de pestaña y análisis por versión. [Plan113 §20](../../../../mvp/113-nodia-cv-implementation-plan.md#20-primera-generación-y-recuperación-por-versión--2026-11-26) | Sin herramientas registradas o fragmentos publicados | PDF histórico disponible cuando falta el análisis |
| 3 | Piloto VM y lectura pública de las dos plantillas en OneATS. Restore con bajas preservadas | Sin herramientas registradas o fragmentos publicados | CI, Agentic y adopción en destino pendientes |
| 2 | Render verificado en Clásica y Compacta, descarga e historial por versión según [Plan113 §14](../../../../mvp/113-nodia-cv-implementation-plan.md#14-pdf-verificado-y-cv-guardados-cv-05--2026-11-24) | Sin herramientas registradas o fragmentos publicados | Agentic y evidencia por importador pendientes |
| 1 | Generación acotada, comprobación del PDF y archivo manual según [Plan113](../../../../mvp/113-nodia-cv-implementation-plan.md) | Sin herramientas registradas o fragmentos publicados | Implementación, pruebas del flujo y evidencia por importador pendientes |
