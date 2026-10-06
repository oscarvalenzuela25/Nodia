---
name: frontend-quality
description: "Desarrollar, corregir o revisar frontend con contratos comprobados, identidad estable, estados remotos recuperables y pruebas de escenarios adversos. Usar en cambios de componentes, formularios, hooks, servicios, permisos, paginación, caché o integraciones; adaptar la verificación al alcance. No configura un proyecto desde cero ni sustituye sus reglas de producto o stack."
---

# Frontend Quality

Prevenir interfaces que parecen correctas en el camino exitoso pero ejecutan con otra identidad, pierden datos, presentan cifras incompletas o fallan al reintentar. Aplicar esta skill durante el desarrollo y en la revisión de la entrega.

## Encajar con el proyecto

- Leer las instrucciones aplicables y los contratos necesarios para el cambio. Respetar decisiones aprobadas, arquitectura, componentes reutilizables y skills locales del proyecto. Las instrucciones explícitas del usuario prevalecen sobre esta guía.
- Consultar el manifiesto, lockfile y scripts cuando intervengan librerías o tooling. No imponer framework, versiones, gestor de paquetes, estructura de carpetas, librería de feedback ni proveedor de IA.
- Conservar cambios existentes. No introducir refactorizaciones extensas, instalaciones, cambios de CI o acciones externas por el solo hecho de activar la skill.
- Ajustar el trabajo al riesgo: un cambio de estilo no requiere una auditoría del backend; un cambio de importación o permisos sí requiere revisar sus contratos. No cargar todas las referencias ni ejecutar toda la matriz para cada edición.

## Antes de implementar: contrato y escenarios

1. Identificar los consumidores y el comportamiento que debe cambiar. Consultar esquemas/DTOs, OpenAPI, casos de uso y componentes próximos que realmente intervienen.
2. Confirmar campos requeridos, opcionales, nulos y valores por defecto; tipos de ID; filtros y metadatos de paginación; permisos y ámbito; códigos de error y garantías de escritura.
3. Distinguir hechos del contrato, compatibilidad histórica y supuestos. Si una decisión de negocio o garantía falta, registrarla como pendiente y avanzar solo en trabajo que no dependa de inventarla.
4. Seleccionar los escenarios de fallo pertinentes en [references/regression-scenarios.md](references/regression-scenarios.md). Leer únicamente los apartados afectados al preparar pruebas o revisar flujos con datos y acciones.

Un tipo TypeScript no valida una respuesta remota. Validar en el límite apropiado las entradas no confiables cuando el flujo lo requiera, con las herramientas del proyecto; normalizar una vez y mantener tipos estrictos. No inventar una respuesta válida para ocultar un contrato incompatible.

## Invariantes de implementación

### Identidad, selección y caché

- Usar el ID de instancia para seleccionar, editar, ejecutar, asociar salud y construir claves de componentes/caché. Usar nombre o clave de catálogo únicamente para presentación o clasificación.
- Conservar una selección explícita al buscar, paginar o revalidar. Si desaparece o deja de estar autorizada, informar y bloquear la operación dependiente; no cambiar silenciosamente a otra instancia.
- Aislar configuración por instancia, modo y ámbito. No heredar valores de otro modo ni de una configuración raíz histórica cuando existan configuraciones separadas, salvo migración explícita en el contrato.
- Incluir en las claves de consulta los parámetros que cambian la respuesta. Aislar o limpiar datos al cambiar usuario/negocio según la arquitectura existente; no introducir tokens o secretos en claves de caché.
- Evitar que una respuesta tardía del contexto anterior actualice la selección o el formulario actual. Aprovechar cancelación y gestión de caché existentes antes de añadir estado manual.

### Consultas, estados y feedback

- Distinguir carga inicial sin datos de revalidación con datos. En refetch conservar el contenido y mostrar carga suave según el diseño local; no desmontar la vista ni reemplazarla por skeletons.
- Diferenciar resultado vacío de petición fallida. Los bloques informativos deben ofrecer una salida comprensible y, cuando corresponda, reintento.
- Deshabilitar los controles dependientes durante su petición conforme a las reglas locales. No sustituir inputs por skeletons.
- Dar un único responsable al feedback de cada operación para evitar avisos duplicados entre transporte, auth, caché, hooks y componentes. Conservar el mensaje permitido del servidor o el fallback traducido; no exponer secretos, URLs internas ni trazas.
- Una cancelación intencional no es un fallo HTTP. Un error al solicitar la cancelación sí requiere feedback y recuperación.
- Derivar datos remotos del gestor de consultas. Mantener estado local para edición/intención del usuario; evitar copias sincronizadas por efectos que produzcan bucles o selecciones obsoletas.

### Mutaciones, formularios y reintentos

- Validar antes de enviar. Conservar modal, inputs y selección cuando la operación falle; cerrar automáticamente y limpiar solo después de éxito confirmado. Respetar la cancelación explícita del usuario según el flujo del producto.
- Controlar envíos simultáneos en el handler y los controles. Invalidar las consultas afectadas; no vaciar toda la caché sin una razón comprobada.
- Aplicar actualización optimista solo con una política de rollback/reconciliación que conserve el contexto correcto ante error.
- Tratar trabajos prolongados aparte de la petición que los inició: un trabajo en ejecución puede necesitar una acción de cancelar disponible. Si su estado es desconocido, no asumir que terminó; si cancelar falla, conservarlo y permitir reintento.
- No reintentar automáticamente una escritura cuyo resultado sea incierto por timeout o pérdida de red. Confirmar su resultado o usar la idempotencia definida por el servidor; conservar la misma clave para reintentar la misma intención.
- Varias peticiones coordinadas en el navegador no garantizan atomicidad. Para una operación indivisible, exigir el contrato transaccional del servidor y declarar la dependencia pendiente hasta verificarlo. No afirmar que bloquear doble clic evita duplicados entre sesiones o ante reintentos.

### Validación, paginación y agregados

- Distinguir cero, `false`, cadena vacía, `null`, ausencia y valores no finitos. Evitar conversiones como `Number("")` o defaults con `||` que conviertan un dato inválido/ausente en válido. Aplicar rangos, redondeo, impuestos y precisión según el contrato.
- Conservar como borrador revisable lo incompleto. Mostrar qué requiere corrección; no fabricar cantidad, precio, configuración ni disponibilidad para habilitar una acción.
- Usar búsqueda/paginación del servidor. Reiniciar o ajustar la página cuando cambien filtros/tamaño o desaparezcan registros. Conservar los seleccionados fuera de la página; una acción de seleccionar todos debe indicar si abarca resultados cargados o todo el conjunto.
- Calcular totales globales con agregados completos y autorizados. El total de registros puede venir de metadatos; sumar una página no produce stock, valorización o facturación globales. No resolverlo aumentando un límite arbitrario o descargando todo el conjunto.
- Confirmar qué fecha y zona horaria definen un período y separar valores de transporte del formato de presentación.
- Acotar lecturas auxiliares. Evitar consultas N+1 y descarga ilimitada de catálogo/historial; cuando falte una consulta por conjuntos o agregados, declarar el contrato necesario.

### Permisos y configuración operativa

- Usar las capacidades del actor y ámbito reales del contrato. Aplicarlas en acciones, formularios y navegación directa, y reaccionar a revocación/403 sin conservar autorización obsoleta.
- Ocultar botones no garantiza autorización del endpoint. No declarar cerrado un problema del servidor por un cambio de UI.
- Toda información operativa debe tener una fuente comprobable. Antes de implementar cada dato de la interfaz, verificar su origen en el backend, SDK o respuesta real del proveedor.
- Prohibido inventar cuotas, límites, capacidades, disponibilidad, latencias, fechas de comprobación o funciones no implementadas. No deducir capacidades a partir del nombre del modelo.
- La configuración guardada no demuestra disponibilidad actual. Una sesión autenticada no demuestra que una inferencia funcione.
- Si el servicio no entrega un dato: devolver `null` o un estado explícito de desconocido; ocultar la cifra o capacidad correspondiente en frontend; no agregar valores de respaldo para completar la interfaz; conservar los ceros reales: cero y desconocido son distintos.
- Si el flujo usa recursos descubiertos dinámicamente, ejecutar el recurso configurado o informar que falta/no está disponible. Cumplir las políticas de proveedores del proyecto; esta skill no define presupuesto ni autenticación de IA.

## Verificar y entregar

- Crear o actualizar pruebas de comportamiento donde cambió una garantía. Derivar expectativas del contrato; una regresión debe fallar ante el defecto anterior, no limitarse a replicar la implementación.
- Los datos simulados solo pueden existir en fixtures de pruebas, identificados claramente y separados del código de producción. Simular transporte, servicios externos y sesiones en pruebas unitarias con datos sintéticos; no consumir cuotas ni modificar cuentas reales. Las integraciones reales requieren el entorno y autorización correspondientes.
- Ejecutar los checks que exige el proyecto y los adecuados al cambio usando sus scripts reales. Para código, comprobar lint/tipado/pruebas; ejecutar build cuando cambien imports, rutas, dependencias, configuración o integración. Si solo cambió documentación, validar estructura, referencias y consistencia sin ejecutar la aplicación innecesariamente.
- Si cambian dependencias, revisar lockfile y auditoría; realizar actualizaciones acotadas. Si cambia UI/interacción, verificar los tamaños, temas, traducciones y teclado afectados con las herramientas disponibles.
- No instalar un runner ni reconfigurar CI fuera del alcance. Si falta un check esencial, registrarlo; no presentar su ausencia como una comprobación aprobada.
- No quitar assertions, saltar pruebas ni silenciar reglas para legitimar un defecto. Si cambió el contrato autorizado, actualizar las pruebas explicando el nuevo comportamiento; preservar las garantías vigentes.
- Antes de entregar, probar datos ausentes, respuestas inválidas, servicio caído y configuración histórica.
- Entregar: comportamiento corregido, evidencia ejecutada, limitaciones y qué sigue pendiente. Indicar qué se comprobó realmente y qué continúa pendiente. Distinguir simulación, navegador local e integración real. No afirmar seguridad, atomicidad, disponibilidad, performance ni preparación para producción sin evidencia correspondiente.
