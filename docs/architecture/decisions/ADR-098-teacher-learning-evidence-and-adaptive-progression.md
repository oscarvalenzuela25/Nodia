# ADR-098 — Evidencia de aprendizaje y adaptación explícita en Teacher

> Estado: propuesto, sin aprobación documental. Implementación autorizada y55TU verificados para el alcance R02 Windows/API key, con sus límites de entorno y sin despliegue/publicación. [Cierre](../../evidence/teacher-upgrade-acceptance-20261111-r02.md).
> Fecha: 2026-11-11.
> Alcance vigente: el usuario autorizó implementar todas las fases101/102. Código, contratos y QA local se registran en la matriz; no implica aprobación del ADR, adopción operativa, publicación o despliegue. El corte documental inicial fue sucedido por esa autorización.

## Contexto

El [plan101](../../mvp/101-nodia-teacher-adaptive-upgrade-plan.md) prioriza diagnóstico conectado, evidencia por objetivo y práctica adaptativa. [95](../../mvp/95-studies-adaptive-learning.md) ya prevé un diagnóstico revisado y [96§3.3](../../mvp/96-nodia-teacher-implementation-plan.md#33-preparación-y-persistencia-del-paquete) un snapshot acotado; el código actual no conecta sus resultados estructurados con las generaciones siguientes. [97](../../mvp/97-nodia-teacher-technical-contracts.md) conserva las reglas de independencia, final≥90%, versiones, ownership y ejecución común.

LearnHarness aporta interacciones pedagógicas útiles, pero su grafo es memoria de contenido, no evidencia de dominio. Parte de la adaptación se confía al modelo; su arquitectura local y recuperación no son sustitutos del servidor multiusuario de Nodia. Confundir una afirmación registrada, una explicación leída y una verificación de sección introduciría errores de producto y una deuda difícil de corregir en datos históricos.

La identidad/versionado de evidencia y su autoridad afectan diagnóstico, planes, generación, práctica, ayuda, repaso y futuras relaciones entre planes. Elegir esta frontera antes de diseñar tablas/DTOs evita acoplar el progreso a un prompt o a una visualización. Este ADR registra una propuesta de arquitectura; la orden de documentar no aprueba la opción técnica por extensión.

La preferencia posterior de ejecución se registra en [102](../../mvp/102-nodia-teacher-phased-implementation-and-final-qa.md): implementación directa por fases, comprobaciones técnicas acotadas y QA integral/correcciones al final. No exige aprobaciones de cada funcionalidad, no transforma este ADR en aprobado y no considera la construcción como evidencia de aceptación operativa.

## Opciones consideradas

### Opción A — Historial y resumen libre como modelo del alumno

- Ventajas: reaprovecha mensajes, pocos contratos iniciales y adaptación flexible por prompt.
- Desventajas: difícil reproducir qué respuesta fundamentó una decisión; mezcla declaraciones, ayuda y desempeño; resúmenes pierden procedencia. El modelo puede interpretar lectura como dominio o modificar requisitos sin una frontera verificable.

### Opción B — Contenido, observaciones y verificaciones separados; política Server y snapshots

- Ventajas: trazabilidad hasta respuestas/versiones, incertidumbre explícita, adaptación explicable y pruebas atómicas. Preserva las verificaciones vigentes y permite añadir repaso/mapas sin reinterpretar el pasado.
- Desventajas: exige contratos/versiones, proyecciones y migración compatible; identidad y pertinencia necesitan políticas mantenidas. Una proyección técnica correcta no demuestra eficacia pedagógica.

### Opción C — Trasplantar grafo, agentes y runtime local de LearnHarness

- Ventajas: funcionalidad educativa amplia ya descrita en un proyecto de referencia.
- Desventajas: añade otra persistencia/admisión/recuperación, decisiones de confianza local y licencias; algunos workers huérfanos se reejecutan y quizzes reciben claves en navegador. Incompatible como sustitución de no-replay, aislamiento y evaluación privada de Teacher. La integración literal requiere resolver AGPL-3.0-only por separado.

## Decisión

Se propone **B**, desarrollada por etapas sobre los dominios y la infraestructura existentes de Nodia. La implementación local autorizada se registra en101/102 y97; este ADR sigue propuesto y por sí solo no habilita permisos, calificaciones o despliegues.

1. Mantener tres modelos: contenido/conceptos; observaciones/declaraciones/hipótesis con procedencia; y verificaciones de sección del contrato97. Los dos primeros no conceden el estado del tercero.
2. Guardar observaciones de origen inmutable con propietario, sesión, dimensión/objetivo, intento/ítem/respuesta, versiones, fecha, modalidad y asistencia. Interpretaciones e hipótesis son proyecciones versionadas/revisables; corregirlas no reescribe notas ni respuestas.
3. Conservar base declarada, autoexplicación y confianza como señales distintas. Confianza sin intervención es null; ausencia/estilo de explicación no se penaliza. Un acierto con razonamiento dudoso puede justificar otra actividad sin cambiar su corrección original.
4. Antes del plan usar un blueprint diagnóstico propio con dimensiones descriptivas/versionadas e ítems revisados. El mapeo a objetivos posteriores es explícito y revisable. No deducir equivalencia por título ni fabricar plan_revision_id.
5. La política Server determina evidencia apta y actividad admisible, con motivo y versión. La IA prepara candidatos o interpretaciones bajo esquema; no aprueba secciones, modifica requisitos, adquiere permisos o cambia proveedor/modo. Ante insuficiencia, mantener desconocido y alternativas prudentes.
6. Congelar IDs/versiones/hash de evidencia y política al admitir cada propuesta/material. Limitar contexto/lecturas y conservar procedencia; información tardía no altera el snapshot en curso. Resúmenes/compactación no sustituyen el origen probatorio.
7. Cambios en objetivos/cobertura/prerrequisitos requieren revisión y aceptación humana. Una reparación puntual puede quedar como apoyo, sin sobrescribir plan/material/intentos. La final conserva cobertura, independencia, claves privadas y90 exacto; el repaso no invalida verificación histórica.
8. Usar primero relaciones en PostgreSQL y conceptos dentro de un plan. Equivalencias entre planes del mismo usuario son una etapa posterior revisable/reversible; similitud de texto o embeddings sólo puede proponer candidatos. No crear base de grafos, vector store o microservicio por el mapa.
9. Reutilizar el runtime neutral de generación, admisión, reserva por POST, selección exacta, leases/fences, recibos y recuperación sin replay. No añadir otro scheduler de inferencias, supervisor de perfiles ni respawn generativo de unknown. Scheduling de repaso es una política pedagógica separada.
10. Nuevos tipos de actividad y visuales forman un registro interno declarativo, versionado y autorizado. Fuentes propias requieren recursos owner-scoped/citas y límites de extracción; nuevo helper se bloquea durante finales. Shell, HTML/JS arbitrario, código ejecutable, plugins descargables y navegación libre quedan fuera de esta decisión.
11. La elegibilidad de generación distingue el protocolo estable de transporte del manifiesto actual de prompts/política Teacher. Una calificación histórica no se hereda cuando cambia ese manifiesto. El helper requiere además prueba explícita por propósito/ancla; una canary de setup no lo habilita. El cierre/ACK histórico se concilia sin promoverlo a una aceptación nueva ni repetir inferencia.

E0–E3 del plan101 concretarán el contrato de estas fronteras al construir cada fase y antes de sus consumidores o de afectar datos/tráfico. Los nombres de tablas, endpoints, formato exacto de confianza y cotas temporales/numéricas siguen pendientes con responsables en101§15; se resuelven sin aprobación rutinaria por funcionalidad. La aceptación pedagógica/operativa se concentra en QA final102, antes de habilitar el alcance real. No modificar el contrato97 de una sesión histórica para simular estas capacidades.

## Consecuencias

- Consecuencias positivas: recomendaciones explicables; separación de aprendizaje observado, retención y aprobación; mejor integración de diagnóstico/práctica sin sustituir autoridad Server; evolución gradual y memoria privada con procedencia.
- Costos o riesgos aceptados si se adopta: almacenamiento/proyecciones adicionales, políticas de pertinencia y revisión de ítems, coste de interpretaciones abiertas, posibles sesgos de autoexplicación y dificultad de equivalencia semántica. Mitigar con incertidumbre explícita, opcionalidad, cotas y revisión pedagógica.
- Trabajo posterior: contratos E1/E2, políticas E3, migración compatible ensayada, pruebas de autoridad/concurrencia/HTTP perdido/no-replay, muestra pedagógica y calificación por selección/entorno. Después scheduler temporal, aclaraciones y ramas E7/E8 según dependencias.
- Compatibilidad: respuestas antiguas conservan metadatos ausentes; no backfill de confianza, razonamiento o independencia no observada. Nuevos lectores respetan tipos/versiones; publicaciones e intentos anteriores no se recalifican automáticamente.
- Verificación: registrar por separado aceptación documental, lógica técnica, muestra pedagógica, proveedor/entorno y publicación. No hay garantías de eficacia o ahorro por adoptar la arquitectura.
- Corte actual: construcción local y QA técnico/sintético por alcance en la [matriz55TU](../../evidence/teacher-upgrade-acceptance-20261111.md). No hay nueva calificación real, aceptación integral, migración operativa o adopción. Las fichas candidatas permanecen excluidas de publicación; ninguna herramienta o binding nuevo queda habilitado.

## Referencias

- [Plan101: etapas, dependencias, decisiones y TU](../../mvp/101-nodia-teacher-adaptive-upgrade-plan.md).
- [Producto95](../../mvp/95-studies-adaptive-learning.md), [plan96](../../mvp/96-nodia-teacher-implementation-plan.md), [contratos97](../../mvp/97-nodia-teacher-technical-contracts.md) y [traspaso98](../../mvp/98-nodia-teacher-start-handoff.md).
- [ADR089: planes/contenido versionados](ADR-089-versioned-study-plans-and-content.md) y [ADR092: rutas canónicas](ADR-092-stable-module-navigation-routes.md).
- [Privacidad89](../../mvp/89-module-access-and-user-data-scope.md), [calificación91](../../mvp/91-ai-provider-onboarding-verification.md) y [runtime92](../../mvp/92-nodia-ai-api-chat-parity.md).
- [Fichas Teacher](../../nodia-ai/knowledge/studies/README.md).
- [LearnHarness: snapshot inspeccionado](https://github.com/amosblomqvist/learnharness/commit/a63664767ebdd7e5af08f7f501b720e02b2ddc32) y fuentes acotadas en101§16. No se importó código ni prompts.
