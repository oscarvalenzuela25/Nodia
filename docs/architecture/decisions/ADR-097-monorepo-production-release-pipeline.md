# ADR-097 — Promoción develop/master y entrega coordinada del monorepo

> Estado: propuesto
> Fecha: 2026-11-08

## Contexto

El usuario decide un ambiente productivo en Truobox para feedback de stakeholders, manteniendo PostgreSQL en Northflank Free, y solicita develop como rama predeterminada/integración y master para producción. El remoto todavía usa main y no hay workflows versionados. Client, Server/Worker, servicio Python y host nativo Rust tienen empaquetados diferentes pero contratos y dependencias de build compartidos. El corpus/políticas del Server también consumen archivos de docs y referencias de otros componentes.

Una automatización que haga git pull, compile en el VPS o despliegue cada carpeta sin coordinar contratos puede publicar assets incompatibles, omitir cambios compartidos o interrumpir una migración/inferencia. La fuente de identidad debe ser el artefacto verificado, no el nombre mutable de una rama o una imagen latest.

## Opciones consideradas

### Opción A — Pipelines separados por carpeta y auto-deploy nativo de Pages

- Ventajas: configuración inicial sencilla y aislamiento por destino.
- Desventajas: no coordina versiones/contracts ni el orden backend/frontend; filtros ingenuos omiten documentación compilada. Required checks filtrados pueden quedar pendientes.

### Opción B — GitHub Actions como orquestador, checks por unidad y manifiesto de release

- Ventajas: conserva monorepo, permite pruebas paralelas y despliegue selectivo con dependencias explícitas, identidad por SHA/digest y orden de activación.
- Desventajas: requiere clasificador probado, paquetes Linux reproducibles, permisos/secrets y manejo explícito de entregas parciales entre VPS y Pages.

### Opción C — Plataforma de despliegue adicional o runner propio en el VPS

- Ventajas: una plataforma puede simplificar interfaz y operaciones repetitivas.
- Desventajas: añade recursos y mantenimiento; un runner que ejecute PR públicas en la máquina productiva amplía acceso a secretos/datos. No existe una necesidad que justifique esa capa para el piloto.

## Decisión

Se propone B. Las decisiones humanas de destino y ramas no equivalen a aprobación de todos sus detalles:

1. Features se integran en develop con CI; una PR de promoción a master decide la publicación. El push resultante verifica el SHA final y dispara CD. Merge commit para promoción entre ramas largas y sincronización posterior hacia develop; hotfixes se devuelven a integración.
2. CI siempre produce un check estable CI para PR requeridas, con jobs por unidad calculados por dependencias. No filtrar el evento del workflow requerido por paths ni aprobar diffs incompletos.
3. Construir una vez los artefactos del SHA final, con locks/runtime/base Linux compatibles, y transferirlos por identidad. API/Worker y CLI de recuperación comparten paquete; imágenes Python y host nativo cambian sólo cuando corresponde.
4. Comparar cada candidato con el manifiesto de unidades realmente desplegadas, registrar estados parciales y serializar activación con concurrency más lock del destino. No cancelar una migración/activación iniciada por un nuevo push ni suponer FIFO.
5. Para actualizaciones, backup/journal con escritores verificados antes de detenerlos, drenaje, migración única, activación compatible, readiness y smoke preceden a la publicación Client cuando exista dependencia. La primera instalación verifica destino vacío, prepara journal/configuración y bootstrap probado, y acredita su primer backup/restore con escritores operativos antes de abrir acceso. Una BD con datos sin manifiesto requiere inventario/respaldo apropiado, no la excepción de destino vacío. Pages usa assets precompilados desde Actions, sujeto a verificar el proyecto real y evitar auto-deploy duplicado.
6. Ramas/roles, secrets mínimos y host SSH se configuran explícitamente. No ejecutar código de PR con credenciales productivas ni alojar el runner público de CI en el VPS. La promoción por PR no añade por defecto una segunda aprobación manual de despliegue.
7. Rollback de código sólo con esquema compatible; ninguna reversión/restore automática de DB. Mantener journal, privacidad, no-replay y calificación IA por selección/modelo/modo/entorno. Un deploy no habilita capacidades.

## Consecuencias

- Positivas: no se divide el repositorio por necesidades de deploy; se evita reiniciar backend ante cambios exclusivamente visuales y se conserva evidencia de versiones efectivas.
- Costos/riesgos: VPS único y Northflank Free no acreditan SLA ni alta disponibilidad; el piloto debe tener recuperación comprobada. Publicación entre Pages y VPS no es atómica; requiere compatibilidad hacia atrás y tratamiento de fallos parciales.
- Trabajo posterior: [plan99](../../mvp/99-production-deployment-and-cicd-plan.md) contiene inventario, migración de ramas, workflows, secretos, paquetes, instalación y verificaciones. No se crean ramas ni se habilita CD sólo por registrar el ADR; no se declara aprobado.

## Referencias

- [Plan de producción y CI/CD](../../mvp/99-production-deployment-and-cicd-plan.md).
- [Stack DevOps](../../mvp/10-stack-devops.md), [historial de despliegue](../../mvp/vps-first-test-deployment.md), [operador de backups](../../../ops/nodia-ai-backups/README.md).
- [GitHub required checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks), [concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency), [Pages CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/).
