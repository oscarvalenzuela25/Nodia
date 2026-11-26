---
{
  "schema_version": 1,
  "document_id": "nodia-cv",
  "product_id": "nodia-cv",
  "kind": "product",
  "revision": 5,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "Perfiles, revisión, PDF e historial implementados. API key se verificó en VM y ChatGPT Agentic en producción por selección. El cambio de primera generación y reapertura está pendiente de verificación productiva."
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
    "evidence_paths": ["docs/evidence/nodia-cv-pdf-spike-20261124.md", "docs/evidence/nodia-cv-api-key-vm-20261124.md", "docs/evidence/nodia-cv-generation-ui-20261124.md", "docs/evidence/nodia-cv-pdf-versions-20261124.md", "docs/evidence/nodia-cv-pilot-vm-and-ats-20261124.md", "docs/mvp/113-nodia-cv-implementation-plan.md"],
    "notes": "CV-06 verificó API key, lectura de ambos PDF EN por OneATS público y restauración aislada de bajas. Plan113 §18 y §19 registran la verificación productiva de GPT-6.1 Sol en Medio y GPT-6.2 Sol en Alto."
  },
  "approval": null
}
---

# Nodia CV — contexto de producto para NodiaAI

## Propósito y alcance

Nodia CV permite organizar la trayectoria profesional en perfiles y preparar
una versión de currículo para una oferta escrita. El flujo parte
de un perfil guardado, usa Nodia IA desde la interfaz de CV y termina con una
revisión humana del documento. El usuario decide si guarda la versión. El
alcance está descrito en el [Plan113](../../../mvp/113-nodia-cv-implementation-plan.md)
y la [guía UI](../../../features/nodia-cv/ui-design.md).

Las tres secciones son **Perfiles**, **Generar CV** y **CV
guardados**. La versión guardada conserva una copia de los datos del CV y el
vínculo al PDF exacto que se revisó. Las versiones nuevas conservan también
el análisis de requisitos y su evidencia de esa misma revisión.

## Conceptos y relaciones

| Concepto | Significado para el usuario | Relación y fuente |
| --- | --- | --- |
| Perfil profesional | Datos base reutilizables para elaborar CV, con experiencias, proyectos y competencias | Puede haber varios perfiles. [Perfiles](features/profiles.md) |
| Copia de perfil | Formulario de un perfil nuevo con los datos de otro perfil autorizado | Existe como recurso independiente al guardar. [Guía UI](../../../features/nodia-cv/ui-design.md#21-duplicar-y-eliminar) |
| Oferta | Texto pegado por el usuario que orienta el contenido y la revisión | Se procesa como datos externos. [Preparación y versiones](features/tailoring-and-verified-versions.md) |
| Borrador de CV | Propuesta temporal derivada de la oferta y del perfil | La generación se inicia en Nodia CV y la versión se guarda con una acción posterior. [ADR119 propuesto](../../../architecture/decisions/ADR-119-nodia-cv-owned-generation-and-verified-pdf.md) |
| Plantilla | Presentación del mismo contenido con estructura de documento definida | La lectura ATS se comprueba para el archivo final de esa plantilla. [Plan113](../../../mvp/113-nodia-cv-implementation-plan.md) |
| Versión guardada | CV de una revisión concreta con su propio contenido y PDF | Se puede volver a abrir una vez guardada. El borrado de perfiles y el de versiones son operaciones independientes. [Guía UI](../../../features/nodia-cv/ui-design.md#5-cv-guardados-y-confirmaciones) |

El usuario puede decir «currículo», «currículum» o «CV» para referirse al
documento. Si alguien dice «mi perfil», aclarar cuál cuando tenga varios.
La lectura del PDF indica qué contenido fue extraíble con el verificador
usado. La aceptación por un importador o la selección en un proceso de
reclutamiento requiere su propia evidencia.

## Módulos y autoridad

El destino propuesto es `/nodia-cv`. La regla propuesta para el flujo
ordinario combina sesión vigente, acceso al módulo y el ámbito del recurso
resuelto en Server. La autoridad de acceso por módulo y su ámbito
administrativo se rigen por [autoridad89](../../../mvp/89-module-access-and-user-data-scope.md)
y la aplicación específica del [Plan113](../../../mvp/113-nodia-cv-implementation-plan.md).
En administración, distinguir a quien realiza la asignación de la cuenta
que la recibe. El grupo del menú es navegación y el destino canónico
identifica al módulo, conforme al [ADR092](../../../architecture/decisions/ADR-092-stable-module-navigation-routes.md).

Las conexiones de IA se seleccionan desde CV entre las que el flujo
autorice. Esa selección afecta la generación del CV. La asignación del
módulo no cambia los permisos de administración de proveedores ni los
de otras vistas. Identificadores, filtros y versiones históricas se
revalidan en el ámbito autenticado.

## Índice de funcionalidades

| Función | Ficha relativa | Implementación | Integración NodiaAI | Módulos de destino |
| --- | --- | --- | --- | --- |
| Gestionar perfiles y copias | [Perfiles profesionales](features/profiles.md) | Implementada en la rama de CV | Sin herramientas registradas | `/nodia-cv` |
| Preparar, revisar y guardar CV por oferta | [Generación y versiones verificadas](features/tailoring-and-verified-versions.md) | API key, PDF e historial implementados en la rama de CV | Generación desde su interfaz, sin herramientas Chat | `/nodia-cv` |
| Postular, enviar correos o automatizar portales | Exclusión de [generación y versiones](features/tailoring-and-verified-versions.md#reglas-acceso-y-restricciones) | Fuera del alcance descrito | Sin herramientas registradas | No aplica |

## Interpretación de solicitudes que combinan funciones

«Duplica mi perfil y adapta el CV a esta oferta» combina preguntas sobre
el perfil de origen, la copia y el documento final. La copia se guarda
primero en [Perfiles](features/profiles.md). [Generar CV](features/tailoring-and-verified-versions.md)
usa un perfil guardado y la oferta elegida. La preparación de una versión,
su guardado y cualquier borrado son decisiones separadas en la interfaz.

Remitir estas solicitudes a Nodia CV mientras no exista un contrato
conversacional registrado y verificado. Evitar pedir información privada
para intentar reproducir el flujo en el chat.

## Restricciones y pendientes

- La admisión de generación se comprueba en Server por la selección
  exacta de modelo y el ámbito de la persona. El flujo admite el primer
  intento con cualquier selección compatible del catálogo de la conexión.
  [Plan113 §20](../../../mvp/113-nodia-cv-implementation-plan.md#20-primera-generación-y-recuperación-por-versión--2026-11-26).
- El ensayo público OneATS reconoció los datos principales de Clásica
  y Compacta EN. La ubicación estructurada quedó en el país. Quedan
  pendientes Gemini Agentic, la verificación productiva del cambio de
  primera generación y reapertura, y la verificación en tenants autorizados.
- El alcance inicial propone usar texto pegado en la interfaz. La búsqueda
  de ofertas, el envío a terceros y la operación del producto desde el chat
  quedan fuera de esta revisión.
- El [contrato de publicación](../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md)
  mantiene estas fichas en borrador fuera del contexto publicado hasta
  completar los procedimientos aplicables.

## Evolución y trazabilidad

| Revisión | Cambio funcional | Fuentes/evidencia | Impacto en fichas y catálogo |
| --- | --- | --- | --- |
| 5 | Primer intento con selección compatible y análisis recuperable por versión | [Plan113 §20](../../../mvp/113-nodia-cv-implementation-plan.md#20-primera-generación-y-recuperación-por-versión--2026-11-26) | Fichas candidatas, sin registro de herramientas |
| 3 | Piloto VM, lectura pública OneATS y bajas de CV comprobadas en restore | [Plan113 §15](../../../mvp/113-nodia-cv-implementation-plan.md#15-piloto-en-vm-y-lectura-externa-cv-06--2026-11-24) | Fichas candidatas, sin registro de herramientas |
| 2 | PDF verificado en Clásica y Compacta, descarga e historial privado | [Plan113 §14](../../../mvp/113-nodia-cv-implementation-plan.md#14-pdf-verificado-y-cv-guardados-cv-05--2026-11-24) | Fichas candidatas, sin registro de herramientas |
| 1 | Descripción inicial de perfiles, generación en UI y versiones verificables | [Plan113](../../../mvp/113-nodia-cv-implementation-plan.md), [guía UI](../../../features/nodia-cv/ui-design.md) y [ADR119 propuesto](../../../architecture/decisions/ADR-119-nodia-cv-owned-generation-and-verified-pdf.md). Evidencia de producto pendiente | Dos fichas de funcionalidad en borrador, sin registro de herramientas |
