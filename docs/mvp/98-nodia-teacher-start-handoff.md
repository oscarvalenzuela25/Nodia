# Entrega para iniciar la implementación de Nodia Teacher

> Cierre técnico del upgrade2026-11-11:55/55TU verificados para Windows y la selección API key exacta configurada.18POST reales, revisión de47ítems, QA HTTP/JWT/SQL y rendimiento comparado, correcciones y restore final comprobados. Alcance y límites en la [matriz R02](../evidence/teacher-upgrade-acceptance-20261111-r02.md) y el [recibo R02](../evidence/teacher-upgrade-local-20261111-r02.json). No adopta otros proveedores/entornos, no acredita eficacia humana ni despliega/publica o aprueba ADR/fichas.

> Continuación vigente del upgrade, 2026-11-11: el usuario autoriza implementar todas las fases F0–F9 de [102](102-nodia-teacher-phased-implementation-and-final-qa.md), seguidas de QA final y correcciones por lotes. Esta solicitud sucede al corte documental inferior. Seguir101/102 y el baseline real, preservando contratos V1; no repetir el arranque/migraciones históricos ni desplegar o publicar automáticamente.

> Corte documental histórico, sucedido por la autorización superior del2026-11-11: esa entrega fue **sólo documentación, sin implementar código**. [101](101-nodia-teacher-adaptive-upgrade-plan.md) conserva alcance/criterios y [102](102-nodia-teacher-phased-implementation-and-final-qa.md) define la implementación futura directa por fases F0–F9, controles técnicos mínimos, QA integral al final y correcciones por lotes, sin aprobaciones por funcionalidad. [ADR098](../architecture/decisions/ADR-098-teacher-learning-evidence-and-adaptive-progression.md) sigue propuesto. El mensaje copiable inferior describe el traspaso V1; no ejecutarlo como orden del trabajo documental actual ni atribuir sus evidencias al upgrade. Sin migraciones, inferencias, adopción o publicación por esta entrega.

> Recorrido Gemini completo: práctica14/14 → final20/40=50% → refuerzo focal real de unidad2/práctica14/14 → intento nuevo con variantes40/40=100%, sin asistencia. Server verificó sección y sesión completed; UI final y DB POST/GCM/restore comprobados; runtime operativo y ambos cifrados CFG copiados/GCM íntegro mediante auditoría y reanudación fresh independientes. La captura original fallida y el corte del catálogo externo se conservan, sin aprobación documental implícita. [Seguimiento27](96-nodia-teacher-implementation-plan.md#27-recorrido-completo-gemini--continuación-solicitada).

> Plazo autorizado el 2026-11-03: máximo300s sólo para material y evaluaciones (`learning_packet`/`assessment_only`); los demás propósitos conservan120s. Implementación local verificada y NativeR11/ServerR03 adoptados; nueva calificación Gemini válida y API/Worker reanudados y estables tras conciliar el intento original; no extiende jobs existentes ni habilita reenvío. [Contrato97](97-nodia-teacher-technical-contracts.md).

> Continuidad 2026-11-03: Gemini R11 generó plan/material real por Worker, ready/completed/cierre/ambos ACK y un POST upstream/FINISH DONE; material137,688941s con máximo300s autorizado, cuatro bloques revisados y primera pregunta2/2 con pausa guardada. No práctica/final Gemini completas. Codex mantiene elegibilidad actual sin otra inferencia y acredita recorrido por jornadas/final directa12/40/refuerzo/material/práctica14/14; seis borradores técnicos archivados. Los nueve unknown permanecen cerrados/ACK sin replay. ClientR03 adoptado/verificado restaura latest_job_id/cursor del contrato existente, con bookmark escritorio/móvil y quiz conservados sin inferencia. Compatibilidad Chat actual pasada; respaldo DB final/restore/GCM y captura privada final/copia/GCM/reanudación pasados. [Evidencia](../evidence/teacher-v1-vm-process-20261103-r01.json) y [96 §26](96-nodia-teacher-implementation-plan.md#26-recorrido-directo-vm--2026-11-03). Sin aprobación/publicación de ADR/fichas ni extrapolación a otras modalidades. Los bloques inferiores son históricos.

> Cierre V1 pendiente, corte R10 calificado: [96 §25](96-nodia-teacher-implementation-plan.md#25-checklist-de-cierre-v1-por-capa--corte-r07-unknown--r08-local) separa TH/AC por capa. Native R10/SDK R05 adoptados y selección Gemini Agentic exacta calificada, con diagnóstico ligado de un POST upstream/FINISH DONE/cierre y ACK SQL/Native. El mensaje normal por DI y el mismo Worker terminó unknown/cerrado/ambos ACK, sin respuesta: lifecycle/cli_timeout, journal SDK reserved y contador desconocido. La canary sigue calificada; Worker normal no pasó y no se repite. Faltan recorrido VM completo y contenido revisado, compatibilidad/recovery/backup final y docs. Suite611total/601PASS/10omisiones. Siete unknown preservados sin replay; no aprobación/publicación implícita. [Evidencia](../evidence/teacher-gemini-sdk-vm-20261102-r01.json).

> Continuidad vigente VM: adopción posterior autorizada y asignación individual conservada. Codex acredita Worker/publisher/smoke previos y Gemini R10 calificación exacta con OAuth separado. NodiaAI texto/MCP necesita observar la identidad final y sólo recalificar si perdió vigencia. PRE R10 DB/restore y copia GCM verifican el baseline anterior, no el POST final. Los apartados inferiores son históricos; no repetir probes o intentos consumidos ni transferir aprobación/publicación.

> Seguimiento de implementación local2026-11-01: código Teacher/rutas implementado y verificado localmente por capas. [Plan96 §21](96-nodia-teacher-implementation-plan.md#21-implementación-local-y-evidencia) y [recibo](../evidence/teacher-local-implementation-20261101-r01.json) separan hechos, calificación y pendientes. Los cortes documentales inferiores mantienen su fecha/estado; este seguimiento no aprueba/publica fichas ni adopta VM.

> Actualizada el 2026-11-01: el usuario solicita comenzar ahora en un chat nuevo con contexto limpio. Incluye la independencia de rutas y su migración en BD antes de integrar Teacher. La autorización de implementación no equivale a aprobación documental integral ni demuestra ejecución de código.

## Solicitud vigente para comenzar ahora

La instrucción del usuario del 2026-11-01 amplía el paquete y sustituye la ruta candidata anterior. Implementar estos cambios junto con Teacher:

- La entrada de Client es `/nodia-teacher`, con detalle `/nodia-teacher/:sessionId`. Debe aparecer en el selector de URLs del mantenedor de módulos. El usuario asignará el módulo mediante ese mantenedor; no concederlo masivamente ni imponer el grupo Estudios como requisito de acceso.
- Teacher es un dominio propio en el filesystem: `nodia-client/src/modules/teacher/` y recurso vertical `nodia-server/src/teacher/`. No alojarlo en `tools`, `utils` ni una carpeta dependiente del nombre de una sección del menú. Reutilizar infraestructura común mediante contratos explícitos.
- Quitar los prefijos de sección de todas las rutas funcionales de Client, incluyendo los actuales `/tools/`, `/settings/` y los históricos `/general-settings/` que todavía tengan referencias ejecutables o persistidas. Cada destino debe tener una URL estable e independiente de su grupo de navegación; los segmentos propios del recurso, como un ID de detalle, se conservan. No renombrar las APIs HTTP por arrastre de esta modificación de navegación.
- Empezar con un inventario y un mapa explícito origen/destino sin colisiones. Actualizar router, constantes, selector de URLs, navegación móvil/escritorio, guards, políticas HTTP y referencias activas. Migrar en BD los enlaces y referencias realmente existentes, conservando IDs, relaciones, permisos y asignaciones. No usar un reemplazo SQL global ni recrear módulos/usuarios. Probar migración, repetición segura y rollback en BD descartable; distinguir ese ensayo de su aplicación al entorno autorizado. Los enlaces antiguos pueden redirigir a su destino canónico sin añadir permisos o mantener dos identidades de módulo.
- Verificar que renombrar un grupo o mover un módulo desde el mantenedor no cambia URL, carpeta ni autorización. Mantener la restricción de ventas NodiaAI sólo lectura durante la migración y no ensanchar sus capacidades.
- Usar la [imagen aportada por el usuario](../design/references/nodia-teacher-dashboard-reference-20261101.png) únicamente como referencia de composición: acceso a lección, práctica y progreso. Adaptar a MUI, tema claro/oscuro, tipografía y componentes de Nodia. No copiar su marca ni convertir las cifras, nivel, racha o examen semanal ilustrados en requisitos o datos operativos. La entrada sigue siendo Mis planes. Compatibilidad móvil forma parte de la entrega, con pruebas responsive, teclado y accesibilidad.

Registrar el mapa y la decisión transversal en un ADR conforme a la plantilla. Reconciliar los documentos dependientes y fichas candidatas con las rutas nuevas, preservando versiones/evidencia histórica y la publicación aprobada hasta su transición controlada. El orden inicial es inventario y migración de rutas, verificación de autoridad, y después TH-01..16 sobre la base reconciliada. No terminar tras entregar otro plan.

## Paquete que se debe entregar

1. [95: producto y diagramas](95-studies-adaptive-learning.md): qué hace Teacher y los flujos acordados/propuestos;≥90% final está confirmado por el usuario.
2. [96: plan de ejecución](96-nodia-teacher-implementation-plan.md):16 tareas, dependencias, puertas G0..G6, ámbitos y aceptación AC-01..16.
3. [97: modelo y contratos técnicos](97-nodia-teacher-technical-contracts.md): campos/constraints, estados, DTOs/respuestas, política V1 y puente de runtime compartido.
4. [ADR089 propuesto](../architecture/decisions/ADR-089-versioned-study-plans-and-content.md): razones y consecuencias de contenido versionado e infraestructura IA común.
5. [Fichas Teacher](../nodia-ai/knowledge/studies/README.md): contexto candidato que se mantiene al implementar, sin publicarlo por defecto.

Primero leer los AGENTS aplicables y los índices MVP actuales. El entorno y otros cambios pueden avanzar antes del inicio: contrastar contratos con el checkout vigente y registrar diferencias sin alterar decisiones confirmadas o trabajo ajeno.97 concreta diseño técnico;96 ordena la entrega. No se necesita otra entrevista para escoger detalles rutinarios cubiertos por el paquete.

## Mensaje para copiar en el chat de implementación

```text
Comienza la implementación completa de Nodia Teacher en este repositorio.
Lee AGENTS.md, docs/mvp/README.md y docs/mvp/00-progress.md vigentes.
Lee primero la sección «Solicitud vigente para comenzar ahora» de
docs/mvp/98-nodia-teacher-start-handoff.md: amplía este alcance e incluye la
migración de rutas y BD. La ruta es /nodia-teacher, disponible en el selector
del mantenedor; Teacher vive en módulos/recursos propios, independiente del menú.
Quita los prefijos de sección de las demás rutas Client con un mapa explícito
y una migración que preserve IDs, permisos y asignaciones. No cambies las APIs
por arrastre. Usa la imagen enlazada sólo como diseño adaptado a Nodia y móvil.
Después sigue este paquete:
- docs/mvp/95-studies-adaptive-learning.md
- docs/mvp/96-nodia-teacher-implementation-plan.md
- docs/mvp/97-nodia-teacher-technical-contracts.md
- docs/architecture/decisions/ADR-089-versioned-study-plans-and-content.md

El alcance es Estudios → Nodia Teacher → sesiones privadas de tema libre.
Entrada Mis planes; crear mediante formulario y chat breve, Teacher propone
jornadas/tópicos, se revisa y acepta un plan, y se prepara cada unidad por avance
e intención. Guarda guías/prompts internos versionados, material, evaluaciones,
respuestas y punto de continuación. Inglés y otra materia son casos de prueba;
no construyas un curso fijo ni un módulo por idioma.

Implementa teoría, práctica y quizzes con feedback por respuesta. La prueba final
es de la sección completa y puede abrirse directamente sin generar sus lecciones.
Durante esa final no reveles claves/puntos/explicaciones; al entregar todo muestra
la respuesta correcta y porqué. El usuario confirmó ≥90% para aprobar:90 exacto
pasa, no redondees para aprobar ni exijas100%. Si no alcanza, conserva historial,
ofrece refuerzo focal y otra final con variantes de cobertura completa. No sumes
puntos entre intentos. Pendientes o ítems inválidos no se convierten en cero.

Si una corrección queda irrecuperable, aplica close-pending de97 sólo tras probar
cierre local: conserva su nota pendiente y permite otra final con variantes,
sin repetir la inferencia incierta sobre las mismas respuestas ni bloquear todo.

Retomar recupera versión/fase/pregunta/orden y borradores confirmados, sin volver
a generar. Pausar guarda cursor/respuestas y estado juntos; no digas guardado
si falló. Separar borrador de envío y entrega final; proteger frente a dos pestañas,
autosaves tardíos, acceso revocado y respuesta HTTP perdida.

Reutiliza proveedores, configuración y credenciales Server de NodiaAI. Aplica la
frontera compartida de97: dueños Teacher reales, un solo control de perfiles,
reserva antes de cada POST, leases/fences, prueba terminal y conciliación sin
replay de unknown. No fabriques conversaciones/runs del chat, otro lock o bypass
de módulos. Teacher no tiene herramientas comerciales, SQL o herramientas nativas.
Sin modelos hardcodeados ni fallback/sustitución de proveedor, modo o selección.
Preserva contratos/lectores históricos y ventas NodiaAI sólo lectura de94 R17.

Empieza por TH-01 contrastando97 con la base actual; luego ejecuta TH-02..16 y
puertas G0..G6 de96. Usa el paralelismo autorizado con propietarios de archivos
claros; integra secuencialmente runtime, autorización, migraciones y DI. Respeta
skills locales, patrón vertical, tests de lógica atómica y contratos Server/Client.
No pares a pedir permiso por decisiones técnicas rutinarias: fundaméntalas y
documéntalas. Consulta sólo un conflicto material con el producto/fuentes.

Entrega código local funcional, migraciones ensayadas en DB descartable, pruebas
atómicas e integraciones de autoridad/integridad/concurrencia/presupuesto/unknown,
regresiones del chat, UI ES/EN responsive/accesible y evidencia de los criterios
AC-01..16. Califica cada selección/modo que habilites según91/92 con prueba real
acotada; una key, catálogo o fixture no demuestra Teacher operativo.

Mantén95..98, ADR y fichas coherentes con hechos/pendientes. No apruebes ni
publiques fichas por implementar. No borres/reviertas cambios ajenos ni modifiques
keys, perfiles, vault Obsidian, datos o procesos operacionales para las pruebas.
Archivo es reversible; V1 no incluye purga automática o botón Eliminar.

La entrega inicial es implementación/verificación local; esta orden no despliega
en VM/producción. Su adopción será una operación posterior con entorno y respaldo
definidos. Persiste hasta completar el alcance local o documentar un bloqueo real,
sin declarar éxito de modo/proveedor/función que no se haya comprobado.
```

## Primer resultado que debe producir ese trabajo

TH-01 debe devolver el baseline real y la correspondencia del modelo/contratos97 con el código, los cambios técnicos necesarios y el orden de migraciones. Después continúa implementando; no terminar esa tarea tras entregar otro plan equivalente. Las preguntas ya resueltas por95/97 no son bloqueos para comenzar.

## Informe de cierre esperado

- Funciones implementadas y alcance efectivamente utilizable, con enlaces a código/contratos.
- TH y AC verificados por capa; comandos/resultados y fallos conocidos, sin usar cantidad de tests como objetivo.
- Selecciones/modos calificados realmente frente a los no disponibles y su causa; cero credenciales en evidencia.
- Integridad, recuperación sin replay, compatibilidad y preservación de los contratos de NodiaAI.
- UI y flujo de dos temas, ambos recorridos, final directa,90%, refuerzo y pausa/retorno.
- Estado del empaquetado local, fichas y pendientes de adopción separados de aprobación documental/publicación.

Este archivo sirve a la entrega entre personas/agentes de desarrollo. No es una plantilla interna de Teacher ni una fuente que se deba enviar automáticamente al modelo educativo. No se añade a source_paths de conocimiento publicado ni programa trabajo para mañana.
