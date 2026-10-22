# NodiaAI — AI-05: fichas de productos y funcionalidades actuales

Actualización AI-07: el [inventario39](39-nodia-ai-current-capabilities-inventory.md) incorpora el host NodiaAI sin nuevos handlers. Su reconciliación conserva procedencia de tres hashes modificados y añade el módulo: 176 fuentes actuales verificadas, frente a 175 en el cierre original AI-05. Cobertura de los cuatro productos/27 funcionalidades y 175 handlers de producto sin cambios; esto no publica herramientas.

> Estado: entrega documental contrastada/validada offline; fichas draft/unregistered, sin aprobación automática ni publicación
> Fecha: 2026-10-15
> Fuentes: [plan45](45-nodia-ai-implementation-plan.md), [estándar](../nodia-ai/knowledge/README.md), [inventario39](39-nodia-ai-current-capabilities-inventory.md), [catálogo40](40-nodia-ai-tool-catalog-v1.md), [contratos41](41-nodia-ai-v1-contracts.md), [política50](50-nodia-ai-ai04-runtime-policy.md)

## Entrega y cobertura

Actualización de formato AI-06: [contrato52](52-nodia-ai-ai06-knowledge-publication-contract.md) migra metadatos de tabla Markdown a frontmatter único, sin cambiar estados a aprobado/publicado. El validador AI-05 y su evidencia se adaptan a ese formato; la cobertura4/27/175+2 y los hechos funcionales de esta revisión se conservan. El texto siguiente describe la entrega inicial y sus dependencias posteriores.

Se crean **4 fichas de producto y27 fichas de funcionalidad**, con la partición de AI-05. Las fichas existentes del propio NodiaAI se conservan aparte; no se cuentan como uno de los cuatro productos actuales. Cada explicación incluye conceptos, solicitudes/ambigüedades/rechazos, mínimos, operaciones, fuentes backend, autoridad, informes, preview/recuperación y gates reales de integración.

| Producto | Ficha de producto | Funcionalidades | Fuentes de partida y autoridad |
|---|---|---:|---|
| Negocios | [businesses](../nodia-ai/knowledge/businesses/README.md) | 7 | PRD inicial borrador, decisiones posteriores de19 y contactos31; DTOs/entidades/servicios actuales |
| Finanzas personales | [personal-finance](../nodia-ai/knowledge/personal-finance/README.md) | 4 | Contratos22 y backend existente; acceso super_admin ampliado confirmado pero pendiente de AI-08 |
| Reservas | [reservations](../nodia-ai/knowledge/reservations/README.md) | 9 | Especificación26/contratos28; ERD27 conserva aprobación propia, que no aprueba fichas ni toda especificación |
| Ajustes Generales | [general-settings](../nodia-ai/knowledge/general-settings/README.md) | 7 | PRD Core02 aprobado históricamente, decisiones posteriores de19 y contrato IA vigente; NI-13 pendiente |

La [matriz de correspondencia](nodia-ai-ai05-knowledge-coverage.json) contiene **177 handlers**:175 vinculados una vez a una ficha y2 exclusiones técnicas explicadas, liveness y bootstrap. Incluye coordinación interna y flujos seguros, sin convertirlos en herramientas directas del modelo. Los aliases se conservan en el inventario; el enlace de referencia de cada ficha muestra una ruta por handler.

Se trazan las **141 herramientas de dominio candidatas y4 entradas seguras** a sus funcionalidades; las11 herramientas comunes futuras permanecen bajo los contratos/fichas del nuevo NodiaAI, no se simulan como endpoints existentes de estos productos. Las7 escrituras bulk/import tienen explicación en sus fichas y conservan su exclusión de v1. Un flujo proveedor→contacto con pasos individuales no se confunde con importar un lote.

La matriz es **cobertura documental, no registry ejecutable**: no repite reglas funcionales ni permite publicar documentos. Los metadatos de autoría viven únicamente en la tabla de cada Markdown conforme a las plantillas actuales. AI-06 definirá su representación única en frontmatter, descriptor del registro, schema/publicador y artefactos generados; esta entrega no anticipa otra fuente de metadatos ni publica borradores.

## Revisión de significado y diferencias encontradas

| Caso | Hecho comprobado en fuente | Tratamiento en ficha y publicación |
|---|---|---|
| Proveedor comercial frente a IA | providers pertenece a negocio; ai_providers es conexión de catálogo | Resolver producto/entidad antes de pedir campos o herramientas |
| «Agrega un número a proveedor» | Teléfonos están en contacto, PUT completo normaliza opcionales omitidos a vacío; version/request_key nativos | Preguntar contacto o nombre si nuevo; leer/mezclar colección y mostrar final, no borrar otros teléfonos/horarios |
| Precios y snapshots | ProductService guarda producto y después snapshot posterior con saves separados | No afirmar snapshot del estado previo ni atomicidad/witness ya implementados; AI-22 |
| ID de product_log | Entidad tiene UUID; RANSACK_POLICIES.product_log.id declara bigint | No publicar filtro id de logs hasta resolver/verificar binding/tipo en AI-14/22; producto conserva bigint |
| «Gastado a proveedor» | Factura tiene total registrado/proveedor; Finanzas no tiene provider_id ni fecha económica propia | Aclarar fuente, pago frente a facturado y base temporal; no suma inventada ni join entre campos inexistentes |
| Factura/extracción/archivo | analyze devuelve datos para revisión; no guarda factura/productos. Create con archivo tiene recovery de objeto | Extraer no confirma cambios; archivo promovido a dominio independiente del chat; schema estricto de data y witness pendientes |
| Colecciones administrativas | Usuario roles/modules y grupo categorías reemplazan colecciones; colaboradores de negocio procesa usuarios enviados y actions vacía inactiva cada uno | Preview del estado final según contrato; no aplicar un único patch genérico a todos los recursos |
| PRD Negocios y Core históricos |19 registra acceso global autenticado intencional y descarta RBAC granular universal; negocio conserva guard dueño/super_admin para datos/colaboradores, IA conserva ai:manage | Explicar reglas posteriores con fuentes, sin reintroducir permisos descartados ni quitar guards reales |
| Finanzas | amount string entero, estados por dirección, grupos solapados, created_at como único tiempo de período | Preguntar estado/semántica de mes, no asumir pagado ni SUM de grupos/página; dedup general de POST pendiente |
| Reservas | Create draft no ocupa; paid no confirma; horarios propios, DST validado; archive no libera ocupación | Preguntar todos los mínimos; confirm revalida bajo lock, no hold automático ni DELETE inventado |
| Dinero de alojamiento | Gastos listan por incurred_on, caja por paid_on; Airbnb recibe neto y comisión deducida no es además otro gasto pagado | Declarar fecha/población y procedencia, no sumar dos veces la comisión |
| Super_admin total |38 confirma ampliación;22/28 conservan implementación anterior por usuario/pertenencia y recovery por actor original | Requisito confirmado distinto de capacidad disponible; AI-08/26 debe separar actor/destinatario sin suplantación |
| Credenciales/modelos/salud | Claves cifradas y modelos por modo dinámicos; sesión/flags/catalogo no prueban inferencia/MCP | Secretos sólo en canal humano seguro; cero modelos/ventanas/cuotas supuestos; AI-03 es spike exacto, no runtime publicado |
| Retención |50 borra chat y técnicos resueltos; journals nativos de dominio tienen ciclo propio | No borrar audit/rental_operations al caducar chat ni conservar payload como protección de duplicados |

Estas diferencias no son aprobación de nuevos campos ni una reparación de backend dentro de AI-05. El filtro id de product_log queda registrado como gate concreto. NI-13 (último super_admin, claves reservadas/inmutables, asociaciones atómicas) y los gaps de idempotencia/autoridad ya trazados a45 permanecen abiertos.

## Cómo se incorporará el contexto al chat

AI-05 entrega contenido de autoría enlazado desde especificaciones e índices. **No basta crear un archivo Markdown para habilitar una función.**

1. AI-06 define schema de metadatos y descriptor tipado con document_id/path/revisión/hash, módulos y bindings reales; comprueba fuentes y versión de capacidades.
2. El build de Server compila sólo documentos explícitamente elegibles/revisados en un release inmutable, excluyendo plantillas, borradores, secretos y contenido de usuarios. Sin explorar toda la carpeta en cada mensaje ni nuevas tablas de conocimiento/vectores.
3. AI-07/08 resuelve actor, módulos de destino y autoridad; un módulo de Ajustes no habilita los otros cuatro y una ficha no concede acceso.
4. AI-12 selecciona resumen de producto y funciones pertinentes permitidas, carga detalle bajo demanda y conserva manifiesto/hash por turno. Los datos actuales de BD se obtienen por herramientas publicadas, no copiando tablas al contexto.
5. Un nuevo feature actualiza especificación/ficha/índices, contrato/registro y pruebas. Nuevo release se descubre al siguiente turno; incompatibilidades invalidan propuestas pendientes y los recibos no se reejecutan. Modelos y modos requieren su propia evidencia.

No subir manualmente estos documentos por conversación, ni prometer lectura dinámica de endpoints/SQL. Esta entrega mantiene draft/unregistered hasta cumplir el contrato de publicación y revisión correspondiente. Las modalidades Web/Agentic conservan48: Web conversa, Agentic usa MCP; API más adelante.

## Verificación y continuidad

Ejecutar `node docs/evidence/scripts/validate-nodia-ai-ai05.cjs --write` y después sin `--write`. El [validador](../evidence/scripts/validate-nodia-ai-ai05.cjs) comprueba partición contra45, identidades/secciones/estados/índices, correspondencia175+2 con177 handlers y sus aliases, candidatos de40, excepciones bulk, backlinks de especificación,175 hashes de fuentes del inventario y enlaces locales. Fixtures negativas rechazan omisiones/duplicados, herramientas inexistentes, paths incorrectos y aprobación/publicación automática. El modo sin escritura contrasta evidencia registrada con el contenido actual.

[Evidencia sanitizada](../evidence/nodia-ai-ai05-knowledge-validation.json). La revisión semántica es estática sobre contratos/DTOs/entidades/casos de uso/servicios citados; los checks de texto no demuestran integridad de negocio. No se ejecutan DB, login, inferencias, servicios ni migraciones para redactar fichas; pruebas existentes de las fuentes se citan sin volver a atribuirlas a esta entrega.

AI-05 se cierra como entrega documental; **siguiente AI-06**, contrato de publicación/compilación del conocimiento. AI-07/08 y las familias de implementación conservan sus gates; no capacidades/productos habilitados ni documentos aprobados automáticamente.
