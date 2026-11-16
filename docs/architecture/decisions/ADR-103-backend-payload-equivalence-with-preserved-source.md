# ADR-103 — Equivalencia acotada de payload backend con fuente real conservada

> Estado: propuesto, sin aprobación documental
> Fecha: 2026-11-15

## Contexto

El CD43791568791 terminó con `backend_upload_outcome_unknown` antes de solicitar
deploy o publicar Client. El recibo conserva el mismo `package_tree_sha256` para
el backend actual y el candidato, con SHA de fuente y release distintos. No se
conoce la causa de recepción de este intento; el incidente de cuota anterior no
la demuestra. Ver [plan99§31](../../mvp/99-production-deployment-and-cicd-plan.md#31-upload-incierto-y-equivalencia-acotada-de-payload--2026-11-15).

Una promoción Client/documental puede seleccionar checks y empaquetado Server
por sus dependencias sin producir bytes runtime distintos. Reinstalar ese
payload consume cuota, transporte y una ventana de mantenimiento innecesarios.
Sin embargo, igualdad del árbol no prueba igualdad de todo el manifiesto,
toolchain, infraestructura, configuración externa o intención de actualización.

## Opciones consideradas

### Opción A — Instalar siempre el release del SHA nuevo

- Ventajas: conserva el circuito existente y actualiza la fuente registrada en
  cada adopción, incluso cuando los archivos de aplicación coinciden.
- Desventajas: repite uploads y reinicios sin cambio de payload; no resuelve la
  incertidumbre del transporte ni la cuota acumulativa.

### Opción B — Omitir efectos por equivalencia de payload con elegibilidad calculada

- Ventajas: evita efectos de una entrega redundante, conserva fuente real y usa
  el protocolo `status` existente, sin extender permisos o modificar el host.
- Desventajas: exige distinguir candidato de ejecutado, limita el tipo de diff
  elegible y conserva el costo de construir/verificar Server.

### Opción C — Usar un switch manual o sólo comparar el árbol

- Ventajas: omisión más amplia y sencilla de activar.
- Desventajas: puede eludir cambios de runtime, empaquetado u operadores que no
  forman parte del árbol; una preferencia manual no demuestra equivalencia.

## Decisión

Se propone B, limitada a las siguientes condiciones conjuntas:

1. CI de `push/master` válido y vigente, intento exacto y artefacto original
   verificado por digest, procedencia, inventario y contenido completo. Se
   conservan los preflights y la política de runtime no gestionado existentes.
2. `server_content_equivalence_allowed` se calcula a partir del diff Git completo
   de `serverBase` realmente desplegado a `head`, incluyendo ambos destinos de
   renombres/borrados. Es `true` sólo si **todos** los paths pertenecen a
   `docs/**` o `nodia-client/**`. Ausente, no booleano o cualquier otro path no
   habilitan la omisión. No se usa sólo el último commit/evento ni un input manual.
3. Cambios `ops/**`, `.github/**`, `nodia-server/**`, runtime nativo/Python,
   `.nvmrc` y cualquier path desconocido impiden esta equivalencia aunque el árbol
   coincida. La documentación compilada no se presume inocua: sus bytes finales
   tienen que seguir coincidiendo en el artefacto verificado.
4. Antes de subir bytes se consulta la operación derivada del artefacto/CI.
   Operaciones existentes conservan su consulta/conciliación; un estado incierto
   no se transforma en éxito. Un CD previo que exige conciliación sigue
   bloqueando una intención nueva; esta comparación no habilita replay.
5. Un `status` nuevo valida esquema, ausencia de bloqueo, API/worker activos y
   release/fuente/árbol exactamente iguales al baseline esperado. Se conserva el
   control de versión esperada; una discrepancia detiene el flujo.
6. El árbol candidato y el actual son hashes SHA256 completos de 64 caracteres
   e idénticos. No basta el prefijo del release o la coincidencia del SHA Git.
7. El resultado local `content_unchanged` declara `deployment_requested:false`
   y `deployment_performed:false`. No envía upload/deploy, reinicia, migra,
   modifica `current`, reescribe manifiestos ni cambia la fuente del servidor.

El recibo conserva `source_sha`, `release_id` y `package_tree_sha256` observados
del backend real, y distingue `candidate_source_sha`. Client sólo puede avanzar
con esta confirmación exacta y sus propios gates; no se presenta el candidato
como instalado ni se altera el resultado del CD histórico fallido.

El árbol se calcula sobre los archivos runtime antes de escribir
`release-manifest.json`: cubre `package.json`, lockfile, `dist` completo
(migraciones/políticas/pins/corpus incluidos), scripts operativos empaquetados y
dependencias/binaries/symlinks. Incluye path, tamaño, modo y hash de archivo, o
destino/hash del enlace. Excluye el propio manifiesto, sus metadatos de
fuente/runtime/tooling/checks, operadores externos y directorios vacíos. El
resultado significa equivalencia del payload registrado, no adopción de esos
metadatos ni una auditoría nueva del filesystem vivo.

## Consecuencias

- Positivas: promociones elegibles evitan una transferencia y ventana backend
  redundantes sin perder identidad, CI ni garantías de incertidumbre.
- Costos o riesgos aceptados: el SHA backend permanece anterior y los siguientes
  CI siguen comparando desde él; pueden volver a construir/verificar Server.
  No se promete ahorro de build ni se actualiza artificialmente el baseline.
- La **primera promoción que introduce esta corrección cambia `ops/**`** y por
  ello no es elegible. Necesita entrega backend normal conforme a sus gates;
  la solución no puede justificar su propia omisión ni resolver el upload previo.
- No arregla causa de recepción, cuota, reanudación o diagnóstico del gateway.
  Capacidad/protocolo, journal durable de upload, retención segura y adopción de
  operadores tienen seguimiento propio en99§31/OPS-001.
- Trabajo posterior: probar los negativos del flag/diff, hashes distintos,
  baseline cambiado, operación previa y CD incierto, además del recibo con dos
  fuentes distintas. Verificar por entorno antes de afirmar adopción.
- Impacto NodiaAI: infraestructura de entrega; sin cambio de contratos,
  permisos, herramientas, modelos, conocimiento publicado o fichas funcionales.
  No se publica conocimiento ni se heredan aceptaciones IA por esta decisión.

## Referencias

- [ADR097 propuesto](ADR-097-monorepo-production-release-pipeline.md).
- [ADR099 propuesto](ADR-099-pre-migration-deployment-reconciliation.md).
- [Plan99§30–31](../../mvp/99-production-deployment-and-cicd-plan.md#31-upload-incierto-y-equivalencia-acotada-de-payload--2026-11-15).
- [Evidencia del incidente](../../evidence/deploy-upload-reconciliation-20261115.md).
- [Packager](../../../ops/production/package-backend-release.mjs),
  [verificador](../../../ops/ci/artifact-release.mjs),
  [selección](../../../ops/ci/cd-selection.mjs) y [transporte](../../../ops/ci/cd-vps.mjs).
