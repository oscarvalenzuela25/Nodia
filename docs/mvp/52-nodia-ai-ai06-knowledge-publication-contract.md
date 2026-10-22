# NodiaAI — AI-06: contrato de metadatos y publicación del conocimiento

> Estado histórico AI-06: contrato/compilador implementados y comprobados offline; cierre original con corpus draft/unregistered y sin contexto publicado. Estado vigente de publicación en AI-15/61.
> Fecha: 2026-10-15
> Fuentes: [estándar](../nodia-ai/knowledge/README.md), [AI-05/51](51-nodia-ai-ai05-product-knowledge.md), [plan45](45-nodia-ai-implementation-plan.md), [catálogo40](40-nodia-ai-tool-catalog-v1.md), [contratos41](41-nodia-ai-v1-contracts.md), [arquitectura43](43-nodia-ai-execution-architecture.md)
> Decisión propuesta: [ADR-038](../architecture/decisions/ADR-038-nodia-ai-compiled-knowledge-contract.md). Contexto: [ficha funcional](../nodia-ai/knowledge/nodia-ai/features/knowledge-publication.md).

Actualización posterior [AI-15/61](61-nodia-ai-ai15-product-reads.md): instrucción humana específica de publicación para 67 capacidades de lectura/referencia, 27 fichas/fragmentos y 17 documentos excluidos. Registro/bindings y compilador reales comprobados por el [validador vigente](../evidence/nodia-ai-ai15-publication-validation.json); activación y cuenta real se distinguen en el [reporte de laboratorio](../evidence/nodia-ai-ai15-lab-activation.json). Los recuentos de 37, módulo null y corpus vacío siguientes describen el cierre original de AI-06; su harness histórico no es aceptación de la publicación actual. No aprobación documental general automática.

## Resultado y límites

Una ficha mantiene metadatos canónicos en frontmatter JSON delimitado por líneas `---`, seguido de Markdown. Se retiran las tablas anteriores para evitar dos versiones de estados/revisión/fuentes. Se migran36 fichas existentes, incrementando revisión y conservando su estado/evidencia; se añade la ficha de esta función. Las37 permanecen **draft/unregistered**, sin aprobación documental implícita. Las plantillas usan el mismo formato y no son entradas de publicación.

El [compilador](../../nodia-server/scripts/nodia-ai-knowledge/compiler.mjs) y su[CLI](../../nodia-server/scripts/build-nodia-ai-knowledge.mjs) son herramientas de build del mismo Server. No crean un servicio, tabla de conocimiento, vector store, endpoint o nueva dependencia. Usan Node y Ajv ya declarados como devDependencies; no importan Nest/DB/SDKs de proveedores ni hacen peticiones remotas. La lectura síncrona acotada pertenece al build, no al request path.

En el cierre original, la [configuración del registro](../../nodia-server/config/nodia-ai-knowledge.registry.json) enumeraba37 paths exactos, con `capabilities:[]`, `bindings:[]` y módulo NodiaAI aún sin resolver. **Ese manifiesto era válido y vacío**, con cero documentos/fragmentos/capacidades publicados. El catálogo de diseño40 no constituye por sí solo un ToolRegistry operativo.

## Contratos tipados y fuente única

La autoridad estructural es[contracts.schema.json](../../nodia-server/scripts/nodia-ai-knowledge/contracts.schema.json), JSON Schema2020-12 cerrado y validado sin coerción ni defaults. No se mantiene otra copia de interfaces/metadatos editables. Las propiedades/arrays/cardinalidades obligatorias y enums se derivan de ese schema; los checks semánticos adicionales se ejecutan en el compilador.

| Contrato | Dueño y contenido | Invariante |
|---|---|---|
| Metadata | Autoría Markdown: document_id/product_id/kind/revision, estados separados, implementation/notes, maintainer, sources, verification y approval | Una sola tabla conceptual en frontmatter; no tabla Markdown paralela ni metadatos duplicados en la matriz AI-05 |
| Registry | Código Server: catalog_release, context_module_route, source_paths, capabilities y bindings | Lista explícita, sin glob/exploración en runtime; no se modifica desde texto del modelo |
| Capability | Contrato publicado por familia: ID/revisión/clase, módulos, fuentes de implementación con hashes, schemas input/output y evidencia | No certifica semántica por sí solo; la familia requiere tests y publicación reales. Todo contrato declarado debe compilar y estar vinculado a contexto |
| Binding | document_id/fragment_id/purpose/sections, requisitos de capacidades con revisión y hashes input/output, módulos requeridos | Referencia código→documento, no otra copia de metadatos. Debe coincidir con la unión exacta de módulos de sus capacidades |
| DocumentDescriptor | Generado: ID/path controlado/revisión/hash del contenido y fuentes con hash | Snapshot de release, nunca fuente de autoría; no exige el repo en VPS |
| FragmentDescriptor | Generado: secciones seleccionadas/asset/hash/bytes, capacidades/revisiones/schemas y módulos | Sólo fragmentos elegibles, sin frontmatter ni anexos de trazabilidad privados; requiere NodiaAI más módulos destino |
| ReleaseManifest | Generado: release_id, hashes de registro/schema, catalog_release, documentos/fragmentos/contratos | Identidad determinista sin fecha de build inventada; el pin de release esperado procede del despliegue de confianza |

Los IDs documentales son `product-key` o `product-key.feature-key`; coinciden con paths `docs/nodia-ai/knowledge/<producto>/README.md` o `features/<feature>.md`. No son IDs de BD ni permisos. Las rutas de módulos se vinculan a contratos reales de cada capacidad; AI-07 resolverá sus IDs/asignaciones. `context_module_route:null` bloquea cualquier publicación no vacía hasta registrar ese módulo, no lo crea ni concede acceso.

El JSON estricto rechaza claves repetidas —incluidas equivalencias escapadas—, números no seguros, profundidad excesiva y tipos/campos desconocidos; no acepta sintaxis YAML, coerción o claves alternativas. Los archivos de autoría se limitan a256 KiB UTF-8; índice y JSON a1 MiB/32 niveles. Son límites técnicos del compilador, no cuotas ni ventana del proveedor. Se rechazan UTF-8 inválido, paths ocultos/traversal/symlinks y entradas de plantillas. No se leen credenciales ni archivos fuera de raíces controladas.

## Aprobación, compatibilidad y estados

1. `draft/in_review/retired` no se incluyen en el bundle. Un binding activo a esos documentos falla; no se publica parcialmente ni se cambia su estado automáticamente.
2. `approved` requiere `approval:{reference,revision,content_sha256}`, verification.checked_on real y evidencia enlazada. Fecha null sólo sirve mientras aún no exista esa comprobación. La referencia debe existir, la revisión debe coincidir y el hash fija metadatos —salvo el propio approval— más cuerpo normalizado a LF. Una edición material invalida el hash y exige revisar/incrementar revisión; no se regenera aprobación durante build.
3. El registro de aprobación remite a evidencia humana real guardada en documentación. Comprobar archivo/hash **no demuestra por sí solo que una persona aprobó**: la procedencia se revisa conforme AGENTS y control de cambios. No existe API/LLM que pueda marcar aprobado o modificar este registro.
4. Aprobar documentación no publica herramientas. Para emitir un binding, implementation debe ser partial/implemented e integración verified/published; además capacidad/contrato/evidencia/módulos deben coincidir. `registered` solo no basta. Aprobado aún unregistered puede seguir fuera del bundle mientras se implementa.
5. Cada fuente y referencia debe existir; fuentes de un documento aprobado y links del cuerpo se comprueban antes de publicar, sin incluir sus contenidos por concatenación. Los schemas de capacidades se compilan con Ajv y sus hashes deben corresponder a archivos exactos. Revisión o hashes de contrato distintos del requisito del binding detienen build, sin elegir otra capacidad/default.
6. Una capacidad publicada sin binding, o documento aprobado verified/published sin binding, hace fallar compilación. Evita anunciar una capacidad o contexto desconectados. Los metadatos/registro son declarativos: sus verificaciones no sustituyen pruebas de autoridad, atomicidad o disponibilidad de la familia.

El comparador opcional contra un manifiesto anterior rechaza bajar revisión o cambiar hash sin incrementarla. El CLI usa el bundle local anterior cuando existe, antes de que Nest limpie dist. La CI/despliegue deberá proporcionar/comparar con su release anterior de confianza (AI-36/38); un checkout nuevo sin baseline no puede probar historia global de revisiones. No se incorpora un ledger/tabla para eso.

Hashes de fuentes permiten trazabilidad de bytes; el cuerpo aprobado fija su explicación y el binding fija compatibilidad de schemas/capacidad. Un hash no sustituye revisión semántica ni descubre cambios de negocio compatibles en forma. Cambios de reglas exigen actualizar fichas conforme AGENTS; no atribuir esa detección a un validador estructural.

## Selección y compilación

El compilador carga sólo los paths enumerados y verifica identidades únicas, ubicación, metadata y fuentes. Para cada binding elegible:

- Resuelve capacidades del registro backend publicado, con revisión y schemas exactos; no del Markdown ni de candidatos40.
- Selecciona únicamente secciones `##` explícitas. Falta/duplicación de título o fence sin cerrar detiene compilación; respeta carácter/longitud de fences para no tratar un heading de código como sección. Los comentarios HTML no pertenecen al subconjunto de publicación admitido y se rechazan; no es un renderer Markdown general ni entrega el documento entero como fallback.
- Quita destinos de enlaces de la proyección del fragmento, conservando texto explicativo. La trazabilidad queda en el manifiesto, no en el prompt. No sigue URLs ni concatena AGENTS/runbooks/archivos de usuarios.
- Emite fragmentos por SHA-256 y byte_length; deduplica contenido idéntico sin mezclar bindings/autoridad. Un fragmento sólo se autoriza si el actor satisface **todos** sus módulos y requisitos.
- Genera manifiesto determinista con documentos/fragmentos ordenados y sin timestamps de build, nombres de modelo, cuotas o inferencias inventadas. Misma entrada produce los mismos bytes/hash.

Secciones y requisitos deben ser pequeños/coherentes. En Ajustes Generales no cargar el resumen de cinco módulos con permiso para sólo uno: seleccionar un fragmento revisado con módulos precisos o exigir la unión completa. La compilación valida correspondencia estática; AI-12 debe resolver autoridad del actor antes de leer/entregar cada fragmento y contrastar release con ToolRegistry. Un archivo no contiene grant/actor/JWT ni datos actuales de BD.

## Build, bundle y recuperación de publicación

Comandos en `nodia-server`:

```text
npm run knowledge:check
npm run knowledge:build
npm run test:nodia-ai:knowledge
npm run build
```

El build ejecuta check antes de `nest build` y emite después, porque Nest configura deleteOutDir. Salida propia: `dist/nodia-ai/knowledge/manifest.json` y sólo fragmentos referidos bajo `fragments/<hash>.md`. No se copia el corpus de borradores, plantillas, metadatos no elegibles, código backend ni fuentes completas al paquete de contexto.

La emisión usa directorio temporal y lock de build local. Escribe/verifica bundle completo antes de reemplazar el anterior, restaura el previo si falla el reemplazo y elimina sus temporales propios verificando paths dentro de dist. Un segundo escritor falla sin disputar la salida. Lock huérfano tras crash exige diagnóstico/limpieza de operador; no se reclama por TTL suponiendo muerto otro proceso. Este lock de archivos no es el slot/fence del runtime de43/50.

El verificador de bundle exige release_id esperado y catalog_release, valida estructura/hashes y cada asset/byte_length; no necesita docs/repo de autoría. No se debe aceptar el pin leído del mismo manifiesto como autenticación de origen. Aun con checksums, sólo desplegar un build exitoso y release de confianza. No recompilar sobre un directorio que el runtime esté consumiendo: desplegar releases inmutables y activar por el procedimiento operativo.

AI-12 implementará KnowledgeRegistry/ContextBuilder/startup y sus políticas de lectura/revocación. Las utilidades actuales son de build y prueba, con Ajv dev; no afirmar que el proceso productivo ya carga/valida el contexto tras `npm prune`. El runtime necesitará su composición/validación empaquetada y el pin de ToolRegistry propio.

## Evolución de un producto o feature

1. Actualizar especificación y ficha existente o crear una nueva desde plantilla; subir revisión cuando cambien reglas/contenido. Mantener un único frontmatter y parent/index links.
2. Añadir un path explícito al registro si la ficha es nueva. Eso sólo habilita validación, no publicación. Mantener cobertura de handlers/candidatos cuando corresponda; AI-05 es matriz de documentación, no metadata duplicada.
3. Implementar/testear la familia, schemas, fuentes y autoridad; registrar su contrato publicado/evidencia y binding compatible. Registrar aprobación humana del contenido exacto, sin aprobar por el mero hecho de ejecutar una tarea.
4. Build/CI verifica y emite nuevo release. Incompatibilidad requiere revisar binding/ficha y propuestas pendientes; no reescribir el contexto del turno en vuelo ni repetir efectos históricos.
5. AI-12 aplica nuevas capacidades/explicaciones al siguiente turno y conserva manifiesto/hash por checkpoint. Retirar una capacidad elimina su binding y contexto en la siguiente release de forma coordinada; no conserva un documento como fallback.

Sin cambios a BD ni migraciones. El modelo42/43 sigue usando context_manifest por run; no se añade una tabla por producto, versión de ficha o fragmento.

## Evidencia y siguiente tarea

[Validador AI-06](../evidence/scripts/validate-nodia-ai-ai06.cjs) ejecuta el compilador real con fixtures sintéticas aisladas y filesystem temporal: publicación controlada, exclusión de borradores, duplicados/metadata/approval, schemas incompatibles, módulos, paths, revisiones, determinismo, corrupción, conflicto de escritor y reemplazo sin assets obsoletos. Las aprobaciones/capacidades sintéticas nunca se copian al registro real ni cuentan como herramientas publicadas.

[Evidencia sanitizada histórica](../evidence/nodia-ai-ai06-knowledge-publication-validation.json). El corpus de ese cierre producía0 documentos/fragmentos/capacidades y el build completo de Server se comprobó aparte. Los validadores AI-04/05 se adaptaron/regeneraron por la migración de formato sin repetir inferencias/cuentas ni alterar sus hechos históricos. No hubo pruebas de DB, autorización por usuario, MCP, runtime desplegado o aceptación operativa en esa entrega.

AI-06 cierra contrato/compilación de build; **siguiente AI-07**, módulo y autorización compartida. Publicación efectiva, carga por actor y startup siguen bajo sus gates AI-07/08/12/36..38. Fichas/ADR/documentos conservan revisión y aprobación pendiente.


### Compatibilidad estructural AI36-C04

El ensayo SQL detectó que Capability.kind del schema canónico de publicación sólo enumeraba cinco clases, aunque los contratos comunes y TypeScript ya distinguían prepare_workflow y prepare_preference_change. Se añaden esas dos clases explícitas, preservando las cinco previas y el rechazo de valores desconocidos. Cambia contract_schema_sha256 y la release compilada por procedencia; no añade bindings ni aprueba/publica candidatos. El loader real verifica ambos tipos nuevos y rechaza uno desconocido, y se repite la integración SQL con el nuevo build. No se modifica la identidad semántica de las preparaciones para eludir la validación.
