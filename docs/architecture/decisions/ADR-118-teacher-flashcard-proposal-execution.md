# ADR-118 — Ejecución de propuestas de tarjetas en Teacher

> Estado propuesto, 2026-11-23.

## Contexto

La biblioteca prepara texto e ilustraciones desde apuntes propios,
una cita autorizada o la revisión vigente de una tarjeta. La persona
puede aceptar cualquiera de las partes antes de guardar. Una propuesta
puede sobrevivir a una respuesta HTTP perdida y a la caída del Worker.
La generación está sujeta al presupuesto y a la exclusión del recurso
compartidos con los demás flujos de IA.

## Opciones consideradas

### A. Usar el ámbito de una sesión de estudio

Una cita ya tiene sesión y selección de IA. Los apuntes independientes
y las tarjetas libres carecen de sesión. Este enfoque cobraría capacidad
del estudio y obligaría a asignar un estudio cuando la persona sólo
quiere preparar una tarjeta personal.

### B. Reutilizar el permiso y la retención de un chat

El chat tiene transporte y artefactos propios. Incorporar apuntes a un
chat ampliaría la identidad, los permisos y la retención del recorrido.
Validar una salida en ese producto acredita solamente la combinación
y el contexto operativo de dicha prueba.

### C. Usar un propietario de ejecución de biblioteca

La propuesta y sus partes tienen identificadores propios. El journal
común conserva el vínculo exacto a propietario, solicitud, selección,
conexión y recurso. Un adaptador de transporte acotado comparte el
control de presupuesto, cierre local y exclusión del Worker.

## Decisión

Usar la opción C y extender `ai_generation_operations` con el
propietario `flashcard_library`. Una intención admite una etapa de
texto, una de imagen o las dos. Cuando la persona solicita ambas, la
ilustración parte de la pregunta y respuesta propuestas. El texto
queda revisable aunque falle la ilustración. Una imagen sola parte
de los campos de la revisión guardada.

Límite de una solicitud al proveedor por etapa, dos etapas por
intención, dos intenciones pendientes por persona y veinte etapas
admitidas por persona en 24 horas. La exclusión por recurso y
el cupo global se comparten con chat y Teacher. Todas las solicitudes
quedan vinculadas a una selección exacta. Un resultado incierto se
consulta por GET y conserva el historial para impedir el replay.

El carril de biblioteca usa API key con selecciones explícitas de
texto e imagen. La imagen exige evidencia propia de una sola llamada
sintética cerrada y reconocida bajo esa cuenta, conexión, modelo,
esfuerzo, clave y generación de configuración. El operador registra
la evidencia en la herramienta de calificación. Se preserva el
recorrido de texto con la selección de la lección, incluido Agentic.

La vista previa usa una miniatura WebP privada de hasta 144 KiB.
Las propuestas expiran a las 24 horas. El Worker limpia la cita,
el prompt, la respuesta y los bytes, y conserva el recibo mínimo de
identidad y cierre. Aplicar incorpora campos al editor. Guardar aplica
el escritor existente con propiedad y revisión vigente.

## Consecuencias

- Los apuntes tienen ámbito de biblioteca. Pueden generar una
  propuesta sin crear una sesión de estudio.
- El procesamiento de la imagen se limita a texto de la tarjeta.
  La edición generativa con una imagen de referencia requiere
  aceptación independiente.
- La verificación de una selección real necesita configuración y
  evidencia específica del entorno. Los resultados de pruebas con
  transporte sintético acreditan los contratos locales.

## Referencias

- [Plan de tarjetas](../../mvp/112-teacher-flashcards-plan.md)
- [Propiedad de las tarjetas](ADR-117-teacher-flashcard-library.md)
- [Verificación de proveedores](../../mvp/91-ai-provider-onboarding-verification.md)
- [Contratos de modalidades API](../../mvp/92-nodia-ai-api-chat-parity.md)
