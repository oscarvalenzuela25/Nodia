# Piloto productivo en Truobox y CI/CD del monorepo

> Estado: en revisión; decisiones del usuario identificadas abajo. Diseño técnico y checklist pendientes de implementar/verificar; no se acredita despliegue ni aprobación integral de lanzamiento.
> Fecha: 2026-11-08.
> Dependencias: [stack10](10-stack-devops.md), [arquitectura11](11-architecture-overview.md), [runbook18](18-security-deployment-runbook.md), [revisión19](19-prelaunch-review.md), [instalación](database-installation.md), [historial de despliegue](vps-first-test-deployment.md), [ADR097 propuesto](../architecture/decisions/ADR-097-monorepo-production-release-pipeline.md).

## 1. Alcance confirmado y situación real

El usuario solicita pasar del ensayo de hosting a un **ambiente productivo para feedback de stakeholders**, inicialmente dos personas. Elige Truobox para la máquina y confirma conservar **Northflank Free para PostgreSQL** por el volumen inicial; si resulta insuficiente se evaluará otro servicio o PostgreSQL en el VPS. Cloudflare Pages para Client, Redis local privado y R2 para archivos/recuperación mantienen el destino previsto, con configuración real pendiente.

La referencia del mensaje a que «Truobox no sirve para pruebas sin cortes» se interpreta por contexto como **Instabox Free**: las pausas/max-run discutidas pertenecen a Instabox. Truobox es la elección explícita de destino. La comparación y los ensayos previos se conservan como historia, no como recetas listas para producción.

También se confirma el flujo deseado de ramas: **develop** será la predeterminada y de integración; **master** contendrá lo que se publica en producción. «Main» en la petición describe el rol principal de develop, no una tercera rama de integración obligatoria. GitHub Actions se propone como orquestador del monorepo y de sus destinos de despliegue; el diseño de detalle permanece en revisión.

### Hechos inspeccionados, no supuestos

- El conector GitHub confirma `oscarvalenzuela25/Nodia`, repositorio público y rama predeterminada **main**. La consulta paginada de ramas devolvió `main` y `advances`; no se crearon develop/master ni se alteraron ajustes.
- El checkout local está en `main`. No hay workflows versionados bajo `.github/` ni paquete/workspaces raíz. Client y Server tienen manifiestos y lockfiles npm independientes; Python y Rust conservan sus propios manifiestos/locks.
- API y Worker salen de **nodia-server** y comparten versión/recursos compilados. El servicio Python y el host nativo de Teacher/Codex tienen empaquetados independientes; no todos requieren un cambio de versión por cada cambio visual.
- La entrega activa del laboratorio no acredita operación en Truobox. No se compró VPS, crearon recursos, cambiaron ramas, aplicaron migraciones ni ejecutaron inferencias en esta revisión.
- Se revisaron scripts/manifiestos y fuentes; no se ejecutaron suites ni builds del producto para redactar este documento. Los resultados históricos pertenecen a su release/entorno.

### Northflank Free: elección explícita del piloto

El usuario confirma mantenerlo después de informar que la [guía Sandbox](https://northflank.com/docs/v1/application/billing/pricing-on-northflank) lo destina a pruebas y no lo recomienda para aplicaciones productivas. La elección limita el alcance del piloto: no transforma Free en un servicio con garantías comerciales. Pocos registros no demuestran capacidad, conexiones, seguridad o recuperación. No es una decisión pendiente de escoger proveedor ni autoriza subir de plan automáticamente.

Usar PostgreSQL como único addon; mantener Redis en Truobox. Comprobar región, cuota real, conexiones, almacenamiento, egress y backups desde la cuenta. La disponibilidad de backups automáticos/retención sin costo y el comportamiento ante excedentes siguen sin acreditarse. Revisar el [incidente de seguridad de Northflank](https://status.northflank.com/) al provisionar: la consulta anterior del 2026-11-08 lo dejó en seguimiento; no se declara resuelto. Usar secretos exclusivos del entorno y atender la rotación de los previamente alcanzados. La elección de hosting no aprueba pérdida de datos ni sustituye un restore ensayado.

## 2. Topología objetivo

| Unidad | Destino | Operación propuesta |
| --- | --- | --- |
| Client React/Vite | Cloudflare Pages | Assets compilados en CI, publicación coordinada por Actions |
| API NestJS y Worker | Truobox Ubuntu LTS x86-64 | Dos servicios systemd, mismo paquete/versionado |
| Redis | Docker en Truobox | Persistencia, autenticación, loopback y política que preserve cuotas |
| Adaptador Gemini | Docker privado en Truobox | Imagen identificada por digest; perfil/sesión externos a la imagen |
| Host nativo Teacher/Codex, si se habilita | Truobox | Binario Linux/metadata identificados y protocolos compatibles |
| PostgreSQL | Northflank Free | Endpoint externo y puerto reales, TLS con certificado validado |
| Archivos, journal y backups | R2 conforme a contratos vigentes | Configuración de entorno exclusiva; privada RSA fuera del VPS |

Nginx es la entrada HTTPS del API; microservicios sólo accesibles desde Server con credenciales exclusivas conforme a ADR-008. Verificar cadena real de proxies, IP efectiva/rate limiting, límites de subida y SSE. Teacher conserva dominio/destinos canónicos según ADR092; no asumir que sólo un origen del Client basta para todas sus rutas.

Truobox: plan/región/versión exacta de Ubuntu, capacidad y contratación pendientes. Sus precios publicitados equivalentes a prepago no son una cotización mensual. systemd no aporta failover entre máquinas; un único VPS concentra fallos. No dimensionar únicamente por el número de usuarios: medir también procesos IA, compilación, memoria, disco y backups.

## 3. Ramas y promoción de versiones

```text
feature/* o codex/* → PR → develop → PR de promoción → master → despliegue
                            CI              CI             CI + CD
```

- **develop:** rama predeterminada, destino de integración; sus pushes pasan CI y no despliegan producción. No hace falta desplegar un segundo ambiente en esta primera entrega. Una preview futura usará datos/secrets propios, nunca producción por defecto.
- **master:** promoción deliberada por PR; el merge solicitado por el operador dispara CD después de pasar las verificaciones del commit final. No añadir por defecto una segunda aprobación manual de despliegue que duplique esa decisión.
- Proteger ambas ramas mediante PR y check requerido `CI`, sin force-push ni borrado accidental. El primer circuito puede operarlo el único desarrollador: no imponer una aprobación de un segundo reviewer inexistente. Revisores/CODEOWNERS y cualquier excepción quedan explícitos según roles reales.
- Para promociones entre ramas largas usar **merge commit**, conservando ancestros; después integrar master de vuelta a develop para mantener historia común y devolver hotfixes. No squash/rebase de la promoción periódica sin rediseñar ese flujo. Las PR de features pueden tener otra política de merge documentada.
- Hotfix: rama desde master, PR/CI a master y devolución a develop. El pipeline no cambia permisos de negocio ni confirmaciones de NodiaAI.
- Migración de ramas propuesta: fijar SHA de main, reconciliar trabajo no publicado/advances, crear develop sin perder commits, activar CI y cambiar predeterminada/referencias. Conservar main temporalmente hasta inventariar consumidores. Crear master desde el primer corte validado, con CD aún sin activar hasta tener destino y configuración comprobados. No copiar ciegamente el estado local ni borrar advances.

## 4. CI del monorepo

### Orquestación propuesta

Un workflow raíz `ci.yml` se dispara en PR a develop/master y push a ambas. **No filtrar su evento por paths**: un job inicial `changes` calcula componentes y dependencias; después ejecuta jobs separados con su directorio de trabajo. Un job final requerido y estable llamado **CI** comprueba el conjunto aplicable.

El check final debe ejecutarse aunque otro job falle, rechazar fallos/cancelaciones de trabajos aplicables y aceptar skipped sólo para trabajos realmente no afectados. Fallo de detección, diff incompleto/base ausente o componente desconocido debe fallar cerrado o ejecutar todos los checks pertinentes, nunca un verde vacío. Si se habilita merge queue, añadir `merge_group` antes de usarla. No convertir mensajes skip-ci en una forma de omitir un required check.

En CI se puede cancelar una ejecución antigua de la misma PR. No usar esa política para una activación productiva ya comenzada. PR no confiables no reciben secretos ni permisos de despliegue; no ejecutar su código con credenciales mediante `pull_request_target`. Preferir runners hospedados; no instalar un runner público de PR en el VPS productivo.

### Mapa inicial de dependencias

| Cambio | Validación/rebuild candidato |
| --- | --- |
| `nodia-client/**` | Client; también validar referencias del conocimiento si corresponden, sin asumir Server inalterado |
| `nodia-server/**` | Server/API/Worker; host Rust adicional si cambian sus fuentes/locks/protocolo |
| `nodia-gemini-microservice/**` | Python/imagen; compatibilidad Server si cambia su contrato, más referencias de conocimiento |
| `docs/nodia-ai/knowledge/**`, registry y paths publicados referenciados | Compilador/pins y artefactos Server si cambian sus entradas; nunca publicar drafts por el despliegue |
| `docs/mvp/nodia-ai-v1-runtime-policy.json`, su schema, schema common-contracts y validadores consumidos | Server y checks de contratos; no tratarlos como documentación prescindible |
| `.github/**`, herramientas de release, contratos/infra compartidos | Validar pipeline y unidades afectadas; decidir de forma conservadora según dependencia real |
| Prosa administrativa sin consumo en build/runtime | Links/formato/documentación; no reiniciar servicios por rutina |

Este mapa es una propuesta a convertir en clasificador probado. El build Server lee también `docs/evidence/scripts/validate-nodia-ai-ai04.cjs` y las referencias exactas del registry/compiler. Usar checkout completo aunque un job trabaje dentro de un subdirectorio. Un path desconocido se revisa; no excluir todo `docs/**`. Un cambio sólo visual puede desplegar únicamente Client **si** la integridad/pin del Server permanece igual.

### Checks y artefactos por unidad

| Unidad | Comandos/garantías a concretar en Linux aislado |
| --- | --- |
| Client | `npm ci`, lint, Vitest, typecheck/build con su lockfile; Node compatible con `engines >=24.20.0`; assets y rutas SPA verificados |
| Server | `npm ci`, lint, Vitest, tipos de producción y build completo; checks de conocimiento/contratos/assets según dependencias |
| PostgreSQL/Redis | Integraciones puntuales con servicios desechables para migración desde cero, upgrades, transacciones, auth, reservas e idempotencia |
| Gemini | Dependencias fijadas, runner offline `run_tests.py` con `test_support`, compatibilidad instalada y build de imagen privada |
| Host nativo | Rust toolchain/Cargo.lock, fmt/clippy/tests y paquete Linux cuando sus fuentes/protocolo cambien |

Los comandos de tipo y suites deben comprobarse en el checkout candidato antes de declararlos gates. No ocultar errores de WIP con exclusiones generales ni usar el typecheck de producción como prueba de que todos los fixtures están bien. No añadir tests espejo ni recorridos de páginas por rutina: priorizar unidades de lógica y las integraciones de riesgo concretas.

CI rutinario usa configuración sintética sin `.env` operativo, proveedores falsos/offline y ningún secreto de inferencia. El runner Python existente instala su aislamiento antes del discovery; conservarlo. Las pruebas reales de proveedores/modelos/modos se ejecutan separadas conforme a plan91, con presupuesto e intención controlados; login, catálogo o build no prueban inferencia.

`npm run build` del Server incluye políticas, conocimiento y contexto; entregar **dist completo**, package.json ESM, dependencias runtime Linux y scripts operativos requeridos. Preservar el check de assets antes de que otro build pueda reparar ausencias. API/Worker y CLI de recuperación salen del mismo paquete. No existe actualmente un Dockerfile general Server: empaquetar un release Linux compatible es trabajo pendiente, no una imagen ya disponible.

## 5. CD desde master

### Un solo punto de coordinación

Propuesta: workflow `release-production.yml` sobre push a master, con CI requerido del **mismo SHA final** y artefactos construidos/verificados para ese commit. Reusable workflows pueden evitar duplicación. No tomar un verde de otro SHA o sólo del merge sintético de la PR como prueba de ese paquete. Los ficheros de workflow citados todavía no existen.

Comparar el candidato con el **manifiesto de versiones efectivamente desplegadas**, no sólo con HEAD anterior. Si una ejecución falló o quedó sustituida, la siguiente debe incluir los componentes pendientes. Registrar por unidad su SHA/digest, schema/migraciones y estado: una publicación parcial no puede quedar como release completo. Primer despliegue sin manifiesto requiere inventario y entrega íntegra.

Serializar producción mediante `concurrency` sin cancelación en curso **y lock de operador en el destino**. No asumir orden FIFO ni que todas las ejecuciones pendientes llegarán a correr. Un job nuevo reconsulta manifiesto y elegibilidad antes de tocar procesos; rechazar promociones obsoletas, salvo rollback explícito compatible. Publicar artefactos y descargar por identidad, sin `git pull`/build de producción en el VPS ni imágenes `latest` como identidad de release.

### Secuencia de entrega

1. Construir/probar componentes afectados y sus contratos; empaquetar manifiesto, hashes y artefactos desde fuentes versionadas del SHA final. Cachear descargas por lockfile/plataforma, nunca perfiles, secretos o estado de DB.
2. Transferir release a un directorio nuevo, con usuario de despliegue limitado y host SSH verificado por un canal confiable; no confiar en `ssh-keyscan` recién ejecutado como única autenticación del servidor. Imágenes por digest y binarios con metadata Linux comprobada.
3. Bajo lock, verificar espacio/RAM/versiones, configuración, conectividad DB/Redis, release activo, journal y recuperación. Distinguir **primera instalación** de **actualización**. En actualización, preparar backup con escritores vigentes verificables **antes de detenerlos**: el runner actual exige API/Worker activos en el paquete correcto. En instalación nueva, comprobar que el destino está realmente vacío, preparar journal/configuración y ejecutar el bootstrap controlado probado; acreditar el primer backup y restore aislado cuando escritores/recuperación estén operativos, antes de abrir el piloto a stakeholders. Ausencia de manifiesto no demuestra BD vacía: si contiene datos, inventariar procedencia y recuperación y obtener el respaldo apropiado antes de modificarla; no improvisar un bypass del runner. El manifiesto debe resolver los servicios como `nodia-api.service` y `nodia-ai-worker.service`, no copiar el nombre histórico `nodia-server.service`.
4. Preparar mantenimiento/drenaje para el alcance necesario; no matar inferencias desconocidas y asumir que se cancelaron remotamente. Preservar fences, journals y estado de recuperación. No prometer cero downtime en un VPS único.
5. Aplicar migraciones pendientes una vez con el artefacto validado y credencial apropiada; sin recompilar durante el corte. La ruta actual `migration:run` recompila: preparar y verificar un comando para el paquete inmutable. `db:setup` pertenece a primera instalación, no al deploy rutinario. Nunca `synchronize:true`.
6. Activar coordinadamente API y Worker del mismo paquete. Si cambian protocolo/servicio interno/host nativo, respetar compatibilidad y orden registrados; no reiniciar componentes intactos ni destruir volúmenes/perfiles.
7. Comprobar readiness real, versiones y smoke externo autenticado sin efectos comerciales/inferencia automática. Un HTTP200 raíz sólo prueba liveness; DB/Redis y readiness del release siguen siendo trabajo pendiente.
8. Si corresponde, publicar el artefacto Client en Pages después de que el backend compatible esté listo. Mantener compatibilidad con clientes antiguos que sigan abiertos/en caché; no prometer atomicidad entre Pages y VPS. Cambios incompatibles requieren plan de transición, no sólo ordenar jobs.
9. Registrar versiones por componente, resultado, ventana/interrupción y evidencia sin secretos. Liberar lock y reactivar timers comprobando sus estados. Un fallo conserva diagnóstico y la versión realmente activa.

Los cambios exclusivamente frontend omiten el mantenimiento/reinicio/migración del Server cuando el mapa y el manifiesto lo demuestren. Una ejecución manual de recuperación puede seleccionar un artefacto previamente verificado desde master; no aceptar código arbitrario de develop/PR con secretos de producción ni repetir efectos inciertos.

### Cloudflare Pages

Preferir publicación de assets precompilados mediante [Direct Upload/Wrangler desde Actions](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/) para compartir gates/orden con VPS. Comprobar si ya existe proyecto Git-integrated, su rama productiva y la ruta soportada para controlar auto-deploy; no prometer convertir el tipo del proyecto en sitio. Evitar dos mecanismos publicando lo mismo. Root lógico `nodia-client`, salida real comprobada, producción master y variables públicas por entorno; ningún secreto DB/API-key en `VITE_*`.

### Rollback

Retener artefacto anterior y comprobar compatibilidad con esquema actual. Rollback de código/Client no equivale a restaurar datos; no ejecutar automáticamente `migration:revert`, borrar volúmenes ni restaurar DB si falla un smoke. Restauración exige procedimiento aislado, journal externo y conciliación de borrados para no resucitar información ni reejecutar inferencias. La política NodiaAI actual conserva siete días, no 30 por defecto. [Operador de backups](../../ops/nodia-ai-backups/README.md).

## 6. Lista de pendientes en orden de ejecución

### P01 — Inventario y decisiones de destino

- [x] Registrar Truobox productivo, Northflank Free para piloto con stakeholders y flujo develop/master.
- [x] Inspeccionar repositorio GitHub/local y dependencias de build; documentar diferencias con lo deseado.
- [ ] Elegir plan/región/Ubuntu LTS y cotización real de Truobox; compra y acceso siguen sin ejecutar.
- [ ] Inspeccionar Northflank Free efectivo, seguridad, endpoint/puerto/TLS, cuotas, backups y condiciones de costos. Conservar elección del usuario sin upgrades automáticos.
- [ ] Definir dominios de Client/API/Teacher, cuenta/proyecto Pages y R2; inventario de datos a crear y usuarios autorizados, sin copiar datos privados del laboratorio por defecto.

### P02 — GitHub y ramas

- [ ] Inventariar main/advances, trabajo pendiente, integraciones y SHA inicial; materializar develop y master sin pérdida de historia.
- [ ] Cambiar rama predeterminada a develop y actualizar referencias, templates, badges, permisos y PR existentes.
- [ ] Crear/verificar check estable CI y después reglas de PR/protección; comprobar un fallo real bloqueante y una PR sólo documental que no quede pendiente.
- [ ] Configurar entorno production limitado a master, variables/secrets mínimos y permisos por job. Revisar protecciones disponibles en el plan real; no exigir reviewer adicional por defecto.

### P03 — CI y paquetes reproducibles

- [ ] Implementar clasificador de cambios y reusable workflows por unidad; probar cambios client-only, shared-docs, Server, Python, Rust, renombres/borrados y diff no disponible.
- [ ] Fijar versiones compatibles de Node/Python/Rust/CLI, acciones por SHA revisado y locks; especificar base Linux/arquitectura y dependencias nativas del paquete.
- [ ] Ejecutar checks acordados en Linux limpio, PostgreSQL/Redis desechables y transporte offline de IA; separar calificación real.
- [ ] Construir y validar paquetes, manifiesto de componentes, assets, scripts recovery y comandos efectivos de arranque/migración.

### P04 — Infraestructura y secretos

- [ ] Preparar usuario SSH/deploy, permisos acotados, firewall/puertos externos y acceso administrativo; inventariar fingerprint confiable.
- [ ] Preparar systemd API/Worker con mismo release/cwd, drenaje, reinicio y configuración fuera del paquete; configurar Redis privado/persistente y adaptadores internos.
- [ ] Implementar/probar TLS PostgreSQL en runtime, migraciones y recovery sin desactivar verificación de certificado; pools/timeouts y roles separados cuando corresponda.
- [ ] Configurar HTTPS, TRUST_PROXY/IP real, CORS/cookies/Google OAuth, dominios canónicos, límites de upload/SSE y expiración TLS.
- [ ] Provisionar secretos exclusivos por entorno fuera de Git/imágenes/logs. El pipeline no cambia modelos/proveedores ni copia perfiles personales del laboratorio por defecto.

### P05 — Instalación y operación

- [ ] Cerrar instalación desde cero y upgrade del release elegido en PostgreSQL desechable; comparar baseline real, no las 18 migraciones de la receta histórica.
- [ ] Preparar readiness DB/Redis y versión efectiva, métricas/alertas, rotación de logs y espacio, jobs/timers y recuperación de uploads.
- [ ] Comprobar backup cifrado externo, privada fuera del VPS, restore aislado, journal vigente y alertas de fallo/retención conforme a contratos existentes.
- [ ] Reconciliar hallazgos de revisión19 con cierres posteriores y features realmente incluidas; no tratar diagnósticos históricos como pendientes actuales sin verificar ni aprobar todo por un build verde.

### P06 — Despliegue y aceptación del piloto

- [ ] Implementar CD/lock/manifiesto, migración única, promoción Pages y manejo de fallo parcial; ensayar dos releases consecutivos y rollback compatible.
- [ ] Verificar primera entrega controlada en Truobox, auth/refresh/aislamiento de ambos usuarios, errores DB/Redis, reinicio, red privada y actualización de versión.
- [ ] Calificar selecciones/modos IA habilitados en el entorno objetivo conforme a plan91; un bloqueo limita el alcance de la feature y no se oculta con un proveedor de respaldo.
- [ ] Probar migración con trabajo activo/drenaje, despliegues superpuestos, ejecución obsoleta, desconexión SSH y recuperación sin replay. No reutilizar un resultado remoto unknown como éxito o permiso de retry.
- [ ] Registrar feedback, consumo/latencia y capacidad real. Definir señales observables para migrar PostgreSQL: cuota/conexiones, latencia sostenida, necesidad de restore/disponibilidad y condiciones del servicio; no inventar umbrales antes de medir.

**Primer paso incompleto:** P01, cotización/acceso/capacidad reales. El diseño de CI puede implementarse en paralelo sin tocar producción. No hay certificados de disponibilidad, CI/CD ejecutado ni cambios remotos hechos por escribir este plan.

### Continuidad para la próxima sesión

Retomar los checkboxes anteriores sin repetir decisiones confirmadas. Se puede comenzar por P02/P03 (inventario de ramas, develop/master, check CI y detección por componentes) mientras se concretan VPS/cuentas/dominios de P01; habilitar CD requiere completar sus dependencias de infraestructura y recuperación. No activar un despliegue por crear master antes de tener destino listo.

Este plan centraliza los pendientes **de producción y CI/CD**, no certifica un inventario exhaustivo de todas las features del proyecto. Para los pendientes funcionales, bloqueos y evidencias vigentes, consultar primero [progreso general](00-progress.md) e [índice del MVP](README.md), y después el checklist de cada feature. Reconciliarlos en P05 según el alcance real del piloto; no dar por resueltos OCR, Teacher u otros gates por terminar el pipeline. El código de los workflows y los cambios de GitHub todavía no están implementados.

La limpieza y centralización solicitadas el 2026-11-09 se siguen en [plan100](100-repository-cleanup-and-documentation-consolidation-plan.md). Pueden avanzar en paralelo; el empaquetado CI/CD debe excluir salidas/secretos y resolver cualquier dependencia mantenida en temporales antes de retirarla. Consolidar historia no es un requisito para declarar todas las features listas ni un motivo para borrar evidencias de aceptación.

## 7. Estado documental y conocimiento NodiaAI

Destino productivo, PostgreSQL Free para stakeholders y nombres/función de ramas son decisiones explícitas del usuario. El ADR097 y este diseño siguen propuestos/en revisión; no se atribuye aprobación a otros ADR o gates existentes. Los documentos de ensayo inferiores quedan históricos para el objetivo de lanzamiento.

Evaluación de impacto: operación/entrega del software, sin nueva herramienta ni contrato funcional NodiaAI. No publicar conocimiento nuevo por cambiar hosting. Cuando una implementación altere configuración, disponibilidad, recuperación o contratos, actualizar sus fuentes/fichas conforme al estándar y distinguir implementación de calificación real. Build/deploy no amplían autoridad, no habilitan ventas mutables y no reactivan Web.

## Fuentes de plataforma

- [GitHub: sintaxis y filtros](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) y [required checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).
- [GitHub: concurrencia](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency) y [ramas protegidas](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).
- [Cloudflare: CI y Direct Upload](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/).
- [Truobox](https://www.truobox.com/vps-barato/), [Northflank Sandbox](https://northflank.com/docs/v1/application/billing/pricing-on-northflank) e [Instabox max-run](https://instabox.sh/docs/machines/auto-pause).
