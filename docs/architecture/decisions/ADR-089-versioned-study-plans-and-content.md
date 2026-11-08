# ADR-089 — Nodia Teacher y generación compartida de contenido versionado

> Seguimiento2026-11-01: diseño materializado localmente en `src/teacher` y `src/ai-generation` de Server, y `src/modules/teacher` de Client. La [evidencia local](../../evidence/teacher-local-implementation-20261101-r01.json) y [plan96 §21](../../mvp/96-nodia-teacher-implementation-plan.md#21-implementación-local-y-evidencia) distinguen implementación, pruebas y pendientes. Este ADR conserva su estado propuesto; implementar no equivale a aprobación documental, publicación o adopción VM.

> Estado: propuesto, pendiente de revisión; no adoptado.
> Fecha inicial: 2026-10-29. Revisión R03: 2026-11-01, blueprint técnico97 y paquete de implementación. Sigue propuesto; completar el diseño no aprueba este ADR.

## Contexto

Nodia Teacher será el producto general de Estudios. Cada usuario crea una sesión de cualquier tema mediante formulario y chat breve; Teacher propone jornadas o tópicos, registra el plan y genera material/preguntas progresivamente. Inglés cotidiano y tecnológico es una referencia personal, no un módulo ni temario obligatorio. R02 sustituye esa organización propuesta en R01.

Generar todo el curso inicialmente aumenta espera y consumo y puede desperdiciar material si cambia el plan. Generar siempre al abrir vuelve el estudio dependiente de la disponibilidad IA y puede alterar una evaluación ya iniciada. El progreso no puede depender de un mensaje de chat ni de que una IA declare dominado un objetivo.

La decisión afecta persistencia, trabajo durable, calidad del contenido, costes, recuperación, evaluación y experiencia Client. Por eso se registra antes del ERD; este ADR no lo sustituye ni aprueba las políticas pedagógicas.

## Opciones consideradas

### Opción A Generar todo al crear el plan

- Ventajas: recorrido y material completos desde el inicio; fácil inspección del contenido preparado.
- Desventajas: mayor tiempo de preparación y consumo inicial; adaptación posterior puede descartar contenido. Guardar en Server no implica uso offline.

### Opción B Generar al abrir cada lección

- Ventajas: aprovecha el desempeño reciente y reduce preparación anticipada.
- Desventajas: esperas al estudiar, dependencia del proveedor y riesgo de regeneraciones accidentales. Requiere igualmente versiones y persistencia para reanudar.

### Opción C Plan completo y paquetes de jornadas por etapas

- Ventajas: objetivos y recorrido revisables, material preparado reutilizable y adaptación de contenido futuro.
- Desventajas: estados parciales, presupuesto y coordinación de trabajos; ventana de preparación y política de replanteo por definir.

## Decisión propuesta

Recomendar la opción C para materializar la generación progresiva solicitada. Crear el recorrido estructurado completo después del formulario/chat y aceptar su revisión mediante acción del usuario. Preparar la primera unidad por intención autorizada y conservarla; las siguientes se preparan según avance/intención bajo alcance y presupuesto explícitos. Jornadas y tópicos organizan las mismas unidades con IDs estables. No iniciar una cadena ilimitada al abrir una pantalla.

Cada paquete tiene versión y contiene objetivos, teoría, ejemplos y práctica. Evaluaciones y solucionarios se conservan en Server y los intentos fijan sus versiones. Reabrir reutiliza el material; regenerar crea una revisión futura sin reescribir preguntas activas, respuestas o resultados históricos.

Separar contenido, respuestas, evidencia por objetivo, elegibilidad para avanzar y repasos. Las reglas de corrección y avance son políticas explícitas y versionadas; el modelo produce candidatos y feedback con procedencia, sin asignarse autoridad para cambiar progreso arbitrariamente. La validación de estructura no sustituye la revisión pedagógica.

Mantener Teacher como dominio modular del Server actual, sin microservicio ni motor independiente por tema. Teacher posee sus sesiones, conversación de definición, planes, tópicos, material, respuestas y cursor. La infraestructura IA compartida posee selección/credenciales, capacidad por perfil/conexión, reserva antes del POST, transporte y prueba terminal/conciliación.

La inspección R02 confirma que el runtime API actual enlaza intentos/jobs/runs/slots de NodiaAI y su worker sólo ejecuta etapas/efectos del chat. La propuesta exige **extraer una frontera interna de generación con identidad durable de origen chat o Teacher**, preservando wrappers conversacionales y restricciones actuales. [97](../../mvp/97-nodia-teacher-technical-contracts.md) concreta una operación neutral ligada por XOR/FKs al intento real de chat o Teacher y la extensión del slot canónico, sin otra tabla de locks de perfiles ni conversaciones/runs ficticios. TH-01/02 materializan y ensayan su transición contra el baseline.

Copiar el runtime a Teacher duplicaría credenciales, presupuestos y reconciliación; adaptar identidades falsas al runtime del chat acoplaría autoridad/retención y falsearía su ownership. La frontera común elegida preserva un único control de capacidad y permite mantener wrappers históricos. Su coste aceptado como propuesta es una migración aditiva y un cambio coordinado del worker; primero se comprueban trabajos/slots y lectores legacy, sin deducir que un lease vencido canceló la inferencia.

El puerto interno nuevo no cambia por conveniencia los contratos cerrados ya existentes: mantener lectores/proof históricos y sus garantías, y usar la identidad Teacher real en su carril autorizado. El transporte/reserva comunes no incluyen herramientas de producto; la lane de Teacher debe demostrar restricciones también sobre capacidades nativas Agentic. La matriz de97 y regresiones de96 son requisito de adopción técnica, sin aprobación/publicación documental implícita.

El catálogo y la elegibilidad Teacher necesitan autoridad de su módulo y una proyección pública propia sobre las fuentes compartidas; no llamar a endpoints que exigen el módulo de chat ni conceder Ajustes IA. La lane inicial Teacher no recibe herramientas de negocio ni capacidades nativas de archivos, comandos, agentes o red autónoma. Si un adaptador no puede demostrar esa restricción, queda sin calificar para Teacher.

Los prompts conservan plantilla/version/hash, variables validadas y snapshot del contexto de cada generación. El prompt efectivo o su plantilla/variables inmutables se guardan privadamente, sin depender del código de la última release ni incluir secretos o razonamiento privado. Las preferencias del plan son datos, nunca instrucciones que amplíen permisos. Parser y JSON Schema del servidor validan las salidas: el transporte actual devuelve texto y pedir JSON no configura por sí solo una salida estructurada garantizada.

## Consecuencias

- Consecuencias positivas: reanudación estable, trazabilidad del aprendizaje y reutilización de contenido; lectura/corrección determinista sin nuevas inferencias cuando no hacen falta.
- Costos o riesgos aceptados si se adopta: persistencia y control de revisiones; calidad factual y pedagógica de contenido generado; diagnóstico sin calibrar; presupuesto de preparación y tratamiento de fallos parciales.
- Trabajo posterior: cerrar duración/calendario, políticas de evaluación, formatos de guardado/exportación, voz, retención y autoridad; diseñar contratos y garantías transaccionales; comprobar selección IA exacta y recuperación sin replay.

Pausar conserva material y progreso, detiene nuevos envíos y concilia el trabajo ya iniciado. Un resultado remoto desconocido no se reejecuta automáticamente ni se presenta como cancelado remotamente. Cada POST al proveedor de IA debe consumir presupuesto antes de enviarse; no se cambia de modelo, modo o proveedor como fallback.

## Referencias

- [Propuesta de Estudios95](../../mvp/95-studies-adaptive-learning.md).
- [Plan de implementación96](../../mvp/96-nodia-teacher-implementation-plan.md).
- [Modelo y contratos97](../../mvp/97-nodia-teacher-technical-contracts.md).
- [Contexto funcional candidato](../../nodia-ai/knowledge/studies/README.md).
- [Acceso y privacidad89](../../mvp/89-module-access-and-user-data-scope.md).
- [Arquitectura común43](../../mvp/43-nodia-ai-execution-architecture.md), [contratos41](../../mvp/41-nodia-ai-v1-contracts.md) y [API chat92](../../mvp/92-nodia-ai-api-chat-parity.md).
- [Verificación por proveedor91](../../mvp/91-ai-provider-onboarding-verification.md).
