# Progreso del MVP — Nodia

**Aviso de venta y consulta de precios en NodiaAI — 2026-11-21.** La rama
`codex/fixes-pos-nodia-ai` incorpora el cierre local del aviso de venta y
corrige el descubrimiento en español del listado de productos y sus precios.
Chromium verificó el aviso en cuatro anchos y dos idiomas. En la VM, el
gateway compilado verificó precios de catálogo, paginado y alcance por
negocio en PostgreSQL 16 aislado. OpenAI API key completó un turno con
el modelo configurado y once precios cotejados con el catálogo del negocio.
[Evidencia en la VM](../evidence/nodia-ai-products-real-api-20261121.md).
[Plan94 §45](94-business-point-of-sale-and-product-refactor.md#45-cerrar-el-aviso-de-venta-guardada--2026-11-21)
y [catálogo40](40-nodia-ai-tool-catalog-v1.md#descubrimiento-de-productos-y-precios--2026-11-21).

**Experiencia del lector offline de Teacher — 2026-11-21.** En producción
se sirven la presentación formateada, la acción persistente para abrir la
copia y la comparación de los puntos en conflicto. Chrome comprobó el
recorrido offline y el foco en laboratorio. CI, CD y los archivos del
lector publicado pasaron la verificación. [Plan103 §8.4](103-pwa-progressive-implementation-plan.md#84-lectura-y-resolución-de-conflictos-más-claras--2026-11-21).

**Avance de lectura de Teacher sin conexión — 2026-11-21.** PWA-006 está
publicado. Dos perfiles Chrome con una misma cuenta verificaron persistencia
sin red, reintento tras un fallo de transporte y ambas elecciones de conflicto.
El cursor avanzó de 3 a 5 y la opción de conservar el punto del servidor no
generó otra escritura. El piloto local verificó además el reenvío idempotente.
[Plan103 §8.3](103-pwa-progressive-implementation-plan.md#83-publicación-https--2026-11-21).

**Material de Teacher sin conexión — 2026-11-21.** Chrome verificó PWA-005
con descargas de dos cuentas de prueba en el mismo perfil. El lector abrió
sin red desde una pestaña nueva, retiró la copia anterior al cambiar de cuenta
y comprobó caducidad, eliminación y revocación conocida. El origen publicado
confirmó descarga y reapertura sin red en dos perfiles de Chrome para Windows.
[Plan103 §7](103-pwa-progressive-implementation-plan.md#7-pwa-005--lectura-offline-por-módulo).

**Recuperación de conexión de la PWA — 2026-11-21.** PWA-003 se publicó con
Teacher. Chrome en laboratorio verificó la distinción entre desconexión y HTTP
503 con red, el reintento de lectura, el arranque sin red desde un registro
previo y la conservación del formulario real de Proveedores. El servidor de
prueba registró un solo guardado, iniciado por el operador tras recuperar la
conexión. [Plan103 §5](103-pwa-progressive-implementation-plan.md#5-pwa-003--desconexión-y-recuperación-comprensibles).

**Actualizaciones de la PWA — 2026-11-21.** PWA-002 se publicó con Teacher.
El build vincula el HTML, el worker y el manifiesto público
de versión. La persona puede aplazar la actualización y conservar la pestaña
con una edición abierta. El registro raíz continúa gestionando Web Push.
Chromium comprobó el cambio entre dos builds con un formulario en edición,
el guardado posterior y la conservación de la suscripción de prueba. Queda
pendiente repetir el cambio y la reversión en producción. [Plan103 §4](103-pwa-progressive-implementation-plan.md#4-pwa-002--caché-estática-y-actualizaciones-controladas).

**Contactos y recordatorios de visitas — 2026-11-20.** El alcance de Contactos
distingue una visita con hora por confirmar de un día sin visita. El contrato
y su verificación por canal se registran en
[Plan31](31-provider-contacts-proposal.md#día-de-visita-con-hora-por-confirmar--2026-11-20).
El [Plan103 §6.1](103-pwa-progressive-implementation-plan.md#61-regla-de-hora-y-destinatario)
registra el contrato de alarma opcional por proveedor, preferencia personal por
negocio y alta/baja por instalación. La [implementación local 004.02](103-pwa-progressive-implementation-plan.md#64-implementación-local-de-server--00402)
incorpora los contratos en Server, cálculo horario y planificación persistente.
Pasaron los ensayos HTTP y de concurrencia con PostgreSQL 16 aislado. La
[entrega 004.03](103-pwa-progressive-implementation-plan.md#65-entrega-web-push-desde-server--00403)
comprobó destinatarios, firma, cifrado, caducidad y recuperación del envío
con transporte sintético. La
[entrega 004.04](103-pwa-progressive-implementation-plan.md#66-client-y-apertura-del-negocio--00404)
incorporó el formulario, el consentimiento por negocio e instalación y la
apertura del destino bajo los permisos actuales. El
[piloto HTTPS 004.05](103-pwa-progressive-implementation-plan.md#67-piloto-https-y-retirada--00405)
verificó la entrega real en Chrome para Windows con la pestaña cerrada y
la apertura del negocio autorizado al pulsar el aviso del sistema. La baja
desde la interfaz HTTPS confirmó la revocación y retirada de la suscripción
local. Una visita de control posterior a la revocación por API completó su
ventana con cero intentos. En Edge para Windows, WNS aceptó el envío real y
el worker lo recibió con el sitio cerrado. En Chrome para Android, el
operador recibió el aviso con Nodia cerrada y abrió el negocio correcto desde
el aviso del worker instrumentado del piloto. Tras la baja por API, una nueva
visita completó su ventana con cero intentos. Quedan por verificar en Android
la apertura con el worker original y la baja desde la interfaz, además del
clic nativo en Edge.

**Grafana, emisión automática de CD comprobada — 2026-11-20.** El
[CD 44673206896](https://github.com/oscarvalenzuela25/Nodia/actions/runs/44673206896)
activó el [reportero 44673802429](https://github.com/oscarvalenzuela25/Nodia/actions/runs/44673802429).
Loki aceptó el evento y Explore mostró `succeeded` con ambos componentes en
`complete`. El fallo y la entrega parcial quedaron verificados en ensayos
sintéticos. OBS-002 queda cerrado por ese alcance.
[Plan104 §16](104-logs-and-monitoring-grafana-cloud.md#16-g7-eventos-del-recibo-de-entrega--2026-11-19).

**Grafana, medición operativa y reversión G6 comprobadas — 2026-11-19.** Explore
registró 294 series recientes, 103.991 bytes de líneas de logs en tres horas y
40 ejecuciones de sondas. Alloy promedió 0,91 % de una vCPU y su cgroup alcanzó
52,19 MiB. El retiro y la restauración pasaron en laboratorio. Queda pendiente
conciliar el acumulado mensual del proveedor. [Plan104 §15](104-logs-and-monitoring-grafana-cloud.md#15-g6-consumo-observado-y-reversión-ensayada--2026-11-19).

**Grafana, G5 de paneles y correo verificado — 2026-11-19.** El tablero de
observabilidad y cuatro reglas operativas quedaron activos. La prueba aislada
entregó fallo y recuperación al buzón administrador y quedó pausada.
[Plan104 §14](104-logs-and-monitoring-grafana-cloud.md#14-g5-paneles-y-correo-comprobados--2026-11-19).

**Grafana, G4 de logs HTTP verificado — 2026-11-19.** El VPS produjo
eventos saneados HTTP 200, 401 y 404. Loki confirmó los tres y registró
cero entradas fuera del esquema y cero coincidencias de los canarios.
[Plan104 §13](104-logs-and-monitoring-grafana-cloud.md#13-g4-logs-http-saneados--2026-11-19).

**Grafana Cloud Free, sondas externas verificadas — 2026-11-19.** Web y API
quedaron habilitadas con frecuencia de cinco minutos desde São Paulo y Norte
de Virginia. Grafana registró HTTP 200 y éxito para ambos destinos en ambas
ubicaciones. [Plan104 §12](104-logs-and-monitoring-grafana-cloud.md#12-sondas-externas-de-web-y-api--2026-11-19).

**Grafana Cloud Free, primeras métricas del VPS — 2026-11-19.** Alloy `1.22.0-1`
quedó activo y habilitado. Explore comprobó 56 series de CPU, memoria, disco
y estado de recolectores y unidades. API, worker y Nginx conservaron sus PID.
[Plan104 §11](104-logs-and-monitoring-grafana-cloud.md#primera-ingesta-comprobada).

**Teacher, edición enfocada de la propuesta — 2026-11-20.** El
[Plan106 §21](106-nodia-teacher-guided-ux-redesign.md#21-edición-enfocada-de-la-propuesta--2026-11-20)
registra el selector de bloques, el guardado desde la cabecera y la
conservación del borrador al recorrer el editor. La comprobación de la
integración se registra en ese apartado.

**Teacher, corrección del quiz y continuidad — 2026-11-20.** El
[Plan106 §20](106-nodia-teacher-guided-ux-redesign.md#20-corrección-del-quiz-continuidad-y-mis-fuentes--2026-11-20)
registra el rediseño de preguntas y resultados, el acceso para retomar desde
la cabecera y la revisión de **Mis fuentes**. La maqueta usa datos
sintéticos y la verificación de la integración se registra en ese apartado.

**Teacher, práctica interactiva en la lección — 2026-11-19.** El alcance
incluye pistas y soluciones plegadas, comprobación de respuestas con clave
explícita y revisión guiada para respuestas abiertas. La navegación por
secciones y los avisos de preparación se registran en
[Plan106 §19](106-nodia-teacher-guided-ux-redesign.md#19-práctica-interactiva-durante-el-estudio--2026-11-19).

**Noticias con sesión — 2026-11-19.** Client requiere sesión validada para
mostrar el enlace y abrir `/news`. Las visitas anónimas a ese destino llevan
a Login. Inicio sigue disponible para visitantes sin el aviso de modo demo.
Las fuentes se configuran por usuario en la vista personal. La verificación
y adopción del ajuste se registran en
[Plan105 §19](105-on-demand-tech-news.md#19-noticias-con-sesión-y-ajuste-de-inicio--2026-11-19).

**NodiaAI, consultas de Market y Caja — 2026-11-19.** La publicación de
esta rama añade dos lecturas de Listas de Market y cuatro de Caja. Los
lectores nativos reutilizan la transacción del gateway. PostgreSQL aislado
verificó los accesos permitidos, el aislamiento entre negocios y la
revocación de permisos. [Evidencia](../evidence/nodia-ai-business-reads-20261119.md).

**OPS-05, custodia y segunda copia verificadas — 2026-11-19.** Con
la llave cifrada descargada de la bóveda privada de Obsidian en
GitHub, Docker sin red restauró el ZIP del release activo descargado
de R2. Coincidieron el SHA-256 del ZIP y las 25 001 entradas del árbol.
El alcance de retirada, retención y custodia queda cerrado. Los
originales siguen en el VPS.
[Plan99 §37](99-production-deployment-and-cicd-plan.md#segunda-copia-de-la-clave-de-custodia).

**OPS-05, bloqueo en R2 verificado — 2026-11-19.** Los 25 cifrados y
tres catálogos del bucket privado quedan bajo una regla de 90 días.
Se verificaron los catálogos y la descarga del cifrado del release
activo después del cambio.
[Plan99 §37](99-production-deployment-and-cicd-plan.md#bloqueo-de-objetos-de-custodia-en-r2).

**OPS-05, custodia de 25 ZIP verificada en R2 — 2026-11-19.** Se
completó la copia cifrada de los seis ZIP restantes. Docker recuperó
los 25 originales del inventario byte por byte en los ensayos desde
R2. Los originales siguen en el VPS.
[Plan99 §37](99-production-deployment-and-cicd-plan.md#custodia-en-r2-verificada-para-los-25-zip).

**OPS-05, custodia en R2 verificada para 19 ZIP — 2026-11-19.** El
bucket privado dedicado contiene 19 cifrados. Docker recuperó los 19
ZIP descargados de R2 byte por byte y reconstruyó tres releases.
Quedan seis del último inventario por cotejar o copiar desde el VPS.
[Plan99 §37](99-production-deployment-and-cicd-plan.md#custodia-cifrada-y-restauración-aislada).

**OPS-05, copia cifrada y restauración aislada — 2026-11-19.** Se
prepararon 19 ZIP cifrados en almacenamiento privado del PC. Docker
recuperó los 19 byte por byte y reconstruyó tres releases, incluido el
activo del inventario. Quedan seis ZIP del último inventario y la
validación desde el destino permanente. Los originales siguen en el VPS.
[Plan99 §37](99-production-deployment-and-cicd-plan.md#custodia-cifrada-y-restauración-aislada).

**OPS-05, inventario de retirada completado — 2026-11-19.** La tanda
autorizada retiró 25 rutas de 11 grupos y recuperó 6,42 GiB. Los 11 ZIP
originales conservaron su SHA-256. API, worker y conciliación pasaron por
grupo. Sigue pendiente la custodia externa permanente.
[Plan99 §37](99-production-deployment-and-cicd-plan.md#retirada-en-bloque-y-cierre-del-inventario-de-ops-05).

**OPS-05, lista única preparada — 2026-11-19.** Se cotejaron los
11 originales y las referencias de las 25 rutas restantes (6,42 GiB
brutos). Docker las restauró en aislamiento. El VPS se usó en modo
lectura y la retirada sigue pendiente de autorización en bloque.
[Plan99 §37](99-production-deployment-and-cicd-plan.md#lista-única-para-los-11-grupos-restantes).

**OPS-05, quinto lote retirado — 2026-11-19.** Las tres rutas autorizadas
liberaron 1,08 GiB. Se verificó el ZIP original, la API respondió HTTP 200,
el worker mantuvo su PID y la conciliación siguió habilitada. Quedan 11
grupos para preparar.
[Plan99 §37](99-production-deployment-and-cicd-plan.md#retirada-efectiva-y-cierre-del-quinto-lote).

**OPS-05, quinto lote preparado — 2026-11-19.** Se cotejaron las
referencias, originales y copias de los 12 grupos. El lote 5 reúne tres
rutas de `20baee851cc3` (1,08 GiB brutos). Docker reconstruyó las tres
desde el ZIP original. La retirada queda pendiente de autorización.
[Plan99 §37](99-production-deployment-and-cicd-plan.md#revisión-de-los-12-grupos-y-quinto-lote).

**OPS-05, cuarto lote retirado — 2026-11-19.** Las tres rutas autorizadas
liberaron 1,08 GiB. Se conservó y verificó el ZIP original. La API
respondió HTTP 200, el worker mantuvo su PID y la conciliación siguió
habilitada. Quedan 12 grupos para preparar por tandas.
[Plan99 §37](99-production-deployment-and-cicd-plan.md#retirada-efectiva-y-cierre-del-cuarto-lote).

**OPS-05, cuarto lote preparado — 2026-11-19.** Se revisaron las
referencias y los ZIP originales de los 13 grupos pendientes. El lote 4
reúne tres rutas de `3beeedbcbf10` (1,08 GiB brutos). Docker reconstruyó
las tres desde el ZIP original. La retirada queda pendiente de autorización.
[Plan99 §37](99-production-deployment-and-cicd-plan.md#revisión-de-los-13-grupos-y-cuarto-lote).

**OPS-05, tercer lote retirado — 2026-11-19.** Las tres rutas autorizadas
liberaron 1,08 GiB. El ZIP original conservó su SHA-256, la API respondió
HTTP 200, el worker mantuvo su PID y la conciliación siguió habilitada.
Quedan 13 grupos para preparar por tandas.
[Plan99 §37](99-production-deployment-and-cicd-plan.md#retirada-efectiva-y-cierre-del-tercer-lote).

**OPS-05, tercer lote preparado — 2026-11-19.** Se cotejaron los originales,
copias y referencias de los 14 grupos pendientes. El lote 3 reúne tres
rutas de `bb83fd262a10` (1,08 GiB brutos). Docker reconstruyó las tres
desde el ZIP original. El VPS se consultó en modo lectura y la retirada
queda pendiente de autorización.
[Plan99 §37](99-production-deployment-and-cicd-plan.md#revisión-de-los-14-grupos-y-tercer-lote).

**OPS-05, segundo lote retirado — 2026-11-19.** Las tres rutas autorizadas
liberaron 1,09 GiB en el VPS. El ZIP original se verificó por SHA-256, la
API respondió HTTP 200, el worker siguió activo y la conciliación quedó
habilitada. [Plan99 §37](99-production-deployment-and-cicd-plan.md#retirada-efectiva-y-cierre-del-segundo-lote).

**OPS-05, política de retención y segundo lote — 2026-11-19.** Se definió
la conservación de releases, ZIP originales, diagnósticos y evidencias.
El lote 2 reúne tres rutas de `dd01e211e63b` con 1,09 GiB brutos y reversión
probada en Docker. Pendiente el cotejo privilegiado previo a ejecutar.
[Plan99 §37](99-production-deployment-and-cicd-plan.md#política-permanente-de-retención-de-despliegues).

**OPS-05, primer lote retirado — 2026-11-19.** Las tres rutas autorizadas
liberaron 1,09 GiB en el VPS. Se verificó el ZIP original por SHA-256, la API
respondió HTTP 200, el worker siguió activo y la conciliación quedó habilitada.
[Plan99 §37](99-production-deployment-and-cicd-plan.md#retirada-efectiva-y-cierre-del-primer-lote).

**OPS-05, primer lote simulado — 2026-11-19.** Se cotejaron tres rutas en el
VPS en modo lectura. Suman 1,09 GiB y se repusieron desde el ZIP original en
Docker local. El resultado incluye hashes, referencias y un plan de reversión.
[Plan99 §37](99-production-deployment-and-cicd-plan.md#primer-lote-en-simulación-y-plan-de-reversión).

**OPS-05, restauración y conciliación aisladas — 2026-11-19.** Tres ZIP
originales coincidieron con el inventario. La recuperación pasó de 57 a 58
migraciones y entre dos releases equivalentes de 58, con ambas API en HTTP
200. Los lectores de estado y conciliación pasaron en dos casos con las
copias secundarias y el directorio histórico ausentes del entorno de prueba.
[Plan99 §37](99-production-deployment-and-cicd-plan.md#ensayo-aislado-de-restauración-y-conciliación).

**OPS-05, inventario privilegiado del VPS — 2026-11-19.** El estado de
despliegue ocupa 15,14 GiB. La revisión por referencia y SHA-256 identificó
ocho directorios de release y 32 archivos secundarios para ensayar su
retirada. La lista suma 11,83 GiB brutos y conserva los ZIP originales y
la evidencia. [Plan99 §37](99-production-deployment-and-cicd-plan.md#inventario-privilegiado-y-lista-de-revisión).

**OPS-05, inventario inicial del VPS — 2026-11-19.** El disco estaba al 36 %
y 26 releases más dos candidatos sumaban 19,18 GiB. Se compararon los
manifiestos y se registró la propuesta de conservación. Queda por medir
los archivos privados y comprobar referencias. [Plan99 §37](99-production-deployment-and-cicd-plan.md#37-ops-05--inventario-de-disco-y-propuesta-de-retención--2026-11-19).

**Ensayo de migración con paquetes reales — 2026-11-19.** CI de `master`
incluye el ensayo antes de publicar el paquete de Server cuando cambia el
esquema. Con los dos ZIP originales de Caja, PostgreSQL 16.15 validó la
instalación limpia, la actualización 52→56 con datos, el rollback ante un
commit rechazado y el arranque de la API. La ejecución en Actions sigue
pendiente. [Plan99 §36](99-production-deployment-and-cicd-plan.md#36-continuidad-del-servicio-y-reintento-por-fase).

**Caja, Listas y Noticias personales — 2026-11-19.** El usuario confirmó
que CASH-001, LISTA-001 y NEWS-001 quedaron listos. El
[TODO](TODO.md#entregas-cerradas-por-alcance) registra el cierre de las tres
entregas y enlaza sus planes y evidencias.

**Revisión móvil de Client — 2026-11-18.** Se corrigieron controles táctiles,
oclusiones del compositor y de diálogos, navegación entre secciones y
recuperación de errores en pantallas estrechas. La
[evidencia móvil](../evidence/mobile-ui-review-20261118.md) identifica los
recorridos locales y el alcance de la emulación.

**Retoque transversal de Client — 2026-11-18.** La rama
`codex/ui-refresh` desde `origin/development` ajusta las superficies, la
jerarquía y el foco de los módulos. Pasaron 3345 pruebas de Client, la
compilación y los recorridos de Chromium con datos sintéticos.
[Diseño](../../nodia-client/DESIGN.md#11-retoque-transversal--2026-11-18) y
[evidencia de Client](../evidence/ui-refresh-20261118.md).

**daily.dev — piloto personal local, 2026-11-18.** Se implementó el circuito de
lectura manual breve para un solo dueño en desarrollo. Pasaron la vista por
fuente en Chromium, el build de ambos componentes y la comprobación de acceso,
aislamiento y migración aditiva con HTTP y PostgreSQL. El actualizador aislado
validó 59→60 y 77 entidades. La base local de pruebas avanzó al ledger 60 y la
vista habilita daily.dev para el dueño configurado. La lectura con PAT real,
el uso distribuido y OAuth conservan sus comprobaciones propias.
[Plan105 §18.8](105-on-demand-tech-news.md#188-piloto-personal-local-de-dailydev).

**Noticias personales — implementación local, 2026-11-18.** El corte de
[Plan105 §18](105-on-demand-tech-news.md#18-plan-de-noticias-personales) en
`codex/dev-news-sources` agrega el piloto DEV por dueño, retira web.dev y Node.js
del catálogo activo y conserva la respuesta pública vacía. En ese primer corte
daily.dev estaba pendiente. Pasaron el ensayo en navegador, las comprobaciones HTTP con PostgreSQL
16 y el actualizador real de CD en Linux aislado. El actualizador validó ledger
58→59 y esquema de 77 entidades. El fallo sintético de R2 restauró la API y
mantuvo bloqueado el CD antes de migrar. Consulta pública Forem 200, con el
recorrido con PAT real, PR/CI y adopción pendientes. El ensayo RSS queda en
`d373920e`, con la migración de laboratorio fuera de esta entrega.
[Resultados](105-on-demand-tech-news.md#185-implementación-y-verificación-local)
y [ADR110 propuesto](../architecture/decisions/ADR-110-personal-news-connection-ownership.md).

**Recuperación del CD antes de migrar — 2026-11-18.** El VPS adoptó el
actualizador y la política que pasaron el fallo de respaldo simulado en systemd
aislado. El ensayo confirmó el regreso de la API y el bloqueo del CD mientras
R2 seguía incierto. La adopción conservó el release y ambos procesos activos.
[Evidencia](../evidence/cd-backup-failure-recovery-20261118.md) y
[Plan99 §36](99-production-deployment-and-cicd-plan.md#36-continuidad-del-servicio-y-reintento-por-fase).

**Listas de Market — implementación verificada, 2026-11-18.** Alta, edición,
actividad, copiado y marcas compartidas implementadas en
`codex/market-shopping-lists`. Pasaron el recorrido de navegador, cinco
grupos de integración HTTP y el ensayo de instalación/actualización en
PostgreSQL 16. El actualizador SQL de producción verificó 56→57 y 76
entidades en Linux aislado con TLS. La CI ejecuta ambas comprobaciones de DB
antes de empaquetar. [Plan110](110-market-shopping-lists-plan.md),
[evidencia](../evidence/market-shopping-lists-20261118.md) y
[cierre de LISTA-001](110-market-shopping-lists-plan.md#10-cierre-de-lista-001--2026-11-19)
conservan el alcance y la evidencia de entrega.

**Entrega técnica de Caja, CASH-07 — 2026-11-17.**
[Plan109 §16](109-business-cash-ledger-plan.md#16-verificación-de-entrega--cash-07-2026-11-17)
registra los contratos HTTP y SQL, la comprobación móvil y la recuperación
de recibos de Caja, Facturas y OCR. El resultado de Nodia CI corresponde
al SHA de entrega en GitHub. El
[cierre de CASH-001](109-business-cash-ledger-plan.md#18-cierre-de-cash-001--2026-11-19)
registra el CD y la confirmación del usuario.

**Topbar y OCR de Negocios — 2026-11-17.** Corrección local en
`codex/business-cash-ledger`. El [estado IA](../features/ai-providers/topbar-mode-health.md#estado-de-ia-para-negocios--2026-11-17)
usa una proyección mínima para Negocios y el [selector OCR](94-business-point-of-sale-and-product-refactor.md#44-modelos-ocr-con-acceso-de-negocios--2026-11-17)
consulta su lectura exacta por conexión/modo. **Actualizar información** en
el avatar recarga la URL actual en el [alcance de plan103 §16](103-pwa-progressive-implementation-plan.md#16-recargar-la-página-desde-el-avatar--2026-11-17).

**CASH-01 cerrado por alcance documental — 2026-11-17.** La rama
`codex/business-cash-ledger` define contrato HTTP, cantidades exactas en CLP,
fecha civil de Santiago, autorización por negocio, orden de locks y recibos.
El [Plan109 §§6.2–6.4](109-business-cash-ledger-plan.md#62-factura-manual-revisiones-y-compatibilidad)
fija edición desde Facturas y un guardado OCR compuesto. Este corte define
los contratos que usan CASH-02 y las fases siguientes.

**PCON-001, OCR-001, BIZ-042 y TUX-03/05 cerrados — 2026-11-17.** El usuario
solicita el cierre por alcance. Contactos y OCR se integraron por PR 48 y 49,
y precios/proveedores OCR y Teacher por PR 50 y 51. La base verificada para la
rama `codex/business-cash-ledger` es `origin/development` `0049b5fc`, que
incorpora las cuatro entregas y el plan de Caja. El [TODO](TODO.md) recoge
los cierres. Las comprobaciones funcionales por
entorno, incluida la migración BIZ-042 en DB operativa, conservan sus límites.

**Caja de Negocios — plan/vistas2026-11-17:** [Plan109](109-business-cash-ledger-plan.md)
y [ADR106 propuesto](../architecture/decisions/ADR-106-business-cash-invoice-expense-consistency.md)
registran categorías compartidas, ingreso/egreso con categoría obligatoria,
filtros diarios/actividad, resumen filtrado y egreso único por factura manual/OCR.
Ampliación del usuario: dos cards mensuales de ingresos/egresos en Overview.
Sin implementación: los controles de las vistas son simulación local, no una
garantía SQL/HTTP. La planificación de [CASH-001](TODO.md) precede el cierre
documental de CASH-01. CASH-04 exige confirmación OCR identificada,
transaccional y recuperable. Ficha planned/draft/unregistered/approval:null,
sin aprobación documental, operaciones de BD, inferencias o despliegue nuevos.
R02 del mismo día sustituye la recomendación de impedir quitar categoría:
al guardar vacía se retira el egreso, sin aparecer tampoco en actividad Todos.
X/+ y modal contextual conservan borradores, validan nombres sin diferencias de
mayúsculas/espaciados y seleccionan la categoría nueva. Cierres manuales como
ingresos; sólo facturas automáticas como egresos. Actualización de plan/maqueta,
no implementación. Caja2 y Negocios57 identifican el corte previo de las fichas.

**Negocios: precios redondeados, división y proveedores OCR — solicitud2026-11-17:**
[Plan94§42](94-business-point-of-sale-and-product-refactor.md#42-precios-de-venta-redondeados-división-local-y-proveedores-ocr--solicitud2026-11-17)
registra venta manual libre hasta onBlur y normalización al guardar; sugerencias
por porcentaje y división de venta ya redondeadas a decenas. Neto conserva CLP
entero. `use_ocr` defaultfalse y filtro exclusivo del selector OCR; columnas
ocultas conservan mapeos, demás formularios muestran todos los proveedores.
Folio opcional, fecha civil inicial de hoy, Notas/Activo al final y Overview
sin chip Por confirmar. Migración1793680000000 preparada/verificada en PG16
sintético,7gates; sin SQL operativo. Client3225/387, focal OCR75/3, tipos/lint/build y Chromium32perfiles correctos;
Server6143/358 y1caso Linux omitido en Windows. Candidato de PR50 actualizado.
[Evidencia y límites](../evidence/business-pricing-ocr-adjustments-20261117.md).
NodiaAI muestra venta normalizada antes de confirmar; propuestas incompatibles
requieren revisión nueva. Candidatas Negocios55/calculadora15 sin nueva aprobación
ni publicación. Cierre e integración registrados en el plan94§43.

**Teacher: TUX-03/05 implementados y verificados localmente — 2026-11-16:**
[Plan106§15](106-nodia-teacher-guided-ux-redesign.md#15-tux-0305-guía-y-continuidad-implementadas-localmente--2026-11-16)
registra conversación/diagnóstico opcionales, borrador protegido, preparación y
recuperación explícitas, primera lección y continuidad desde contexto real.
Rama `codex/teacher-guided-continuity` desde development `6b7f15a5`.
Teacher final277/42 y global previa3171/383, tipos/build y lint de fuentes correctos;
Chromium sintético16perfiles320/600/900/1440 ES/EN y errores CAS/respuesta
verificados por [evidencia](../evidence/teacher-guided-continuity-20261116.md).
No hay generación automática, cambios Server/DB ni inferencia/despliegue nuevos.
Cierre e integración registrados en el plan106§16. Fichas candidatas
actualizadas sin aprobación/publicación.

**Proveedores: apertura recuperable de Contactos — incidencia2026-11-16:**
[Plan31](31-provider-contacts-proposal.md#apertura-recuperable-de-contactos--incidencia-de-producción2026-11-16) registra error/404 reportado en producción.
El usuario confirma que recargar la página corrige el fallo observado.
Assets/importación anónimos actuales correctos; causa exacta aún no aislada. Reproducción local de import404 confirmó escape al error global;
candidato contiene descarga/fallo con lista y borradores intactos, retry local y
scope vigente. Focal67/9 y QA fresh320/600/1440 de fallo/recuperación correctas;
global3139/380, tipos/lint/build y pins locales correctos por
[evidencia](../evidence/providers-contacts-opening-20261116.md). El plan31
registra el cierre por alcance. Si reaparece el fallo, capturar petición/error
autenticados antes de atribuir causa.

**OCR manual: defaults y selección exacta — solicitud2026-11-16:**
[Plan94§41](94-business-point-of-sale-and-product-refactor.md#41-revisión-ocr-compacta-defaults-comerciales-y-selección-ia--solicitud2026-11-16) documenta alias nuevo desde nombre,
alias existente editable/conservado, disponibilidad nueva true y updates intactos;
venta inicial30% sobre bruto editable, cantidad junto al alias y sin toggle.
Modelo/intensidad desde defaults persistidos por instancia/modo. Implementación
local, tipos/lint/build y QA Chromium sintética6perfiles correctos por
[evidencia](../evidence/invoice-ocr-review-defaults-20261116.md). Global2:3125/378;
focal posterior124/10 cubre último delta de recuperación. Tipos/lint/build finales
y conocimiento/pins locales correctos. Cierre e integración registrados en plan94§43.
Sin inferencia ni aprobación/publicación nuevas.

**News publicado; aceptación funcional pendiente — 2026-11-16:**
[105§15](105-on-demand-tech-news.md#15-promoción-y-publicación-comprobadas--2026-11-16)
concilia PR46/development y PR47/master ya integradas. Master03206aa1,
[CI43967669633](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43967669633)
y [CD43969486953](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43969486953)
correctos; backend/Client complete para el mismo SHA y10recursos PWA verificados.
GET News anónimo posterior200/TLS normal, ambas fuentes y0artículos, sin éxito
o error de refresh registrados. No se ejecutó POST ni se disparó otra entrega.
Primer pendiente: actualización explícita super_admin y lectura/UI/aceptación
en producción, con teléfono/inspección visual nativa pendientes. TODO sucede
los estados inferiores de PR abierta o adopción aún no realizada.

**PR News a development y capturas archivadas — solicitud2026-11-16:**
[105§14](105-on-demand-tech-news.md#14-pr-a-development-y-capturas-fuera-de-git--solicitud2026-11-16)
conserva [PR46](https://github.com/oscarvalenzuela25/Nodia/pull/46), ya abierta y
lista para revisión. CI funcional8886e42f correcto: Client3104/376,
Server6092/355 sin omisiones y40checks de esquema. La actualización excluye
247capturas/16486902bytes del árbol, manteniendo originales locales ignorados,
SHA256/permalinks y JSON históricos según [catálogo](../evidence/validation-images-archive-20261116.md).
Sólo enlaces/procedencia cambian; contenidos44/fragmentos46/capacidades153 y
aprobaciones preservados. Sin modificaciones de aplicación, fusión, despliegue
o reescritura del historial. TODO actualizado: integración/promoción News después
del CI exacto de la actualización, QA manual/adopción separados; OPS-05 en cola.

**Noticias: NEWS-06 preparación técnica terminada — solicitud2026-11-16:**
[105§13](105-on-demand-tech-news.md#13-news-06-validación-final-y-preparación-de-entrega--solicitud2026-11-16)
y [evidencia final](../evidence/news-final-validation-20261116.md) consolidan
13gates HTTP con JWT/SQL reales de laboratorio, y14opt-in con dos POST admin/RSS
reales y110noticias recuperadas por GET anónimo. Sin tokens reales, Google,
DB configurada, inferencias o despliegue. UI del build: adversas/teclado/logout
correctos; defecto inicial Boneyard0px corregido y revalidado220px en320/900/1440,
41focales/5archivos, tipos/lint/build correctos. Globales de NEWS-04 conservan su
alcance anterior al fix; CI debe verificar el SHA final de la PR.
Zoom nativo200% geométrico/teclado correcto; captura visual fallida, teléfono y
sesión humana no acreditados. [Guía de entrega](../features/news/deployment-readiness.md)
Server→Client/migraciones, ledger append-only y recuperación explícita lista.
Fichas revisión8 implemented local/draft/unregistered/approval:null. NEWS-001 queda
como candidato preparado, con CI/promoción/adopción por sus fases; la preparación
no aprueba ADR105 ni sustituye aceptación humana.

**Noticias: NEWS-04 implementado localmente — solicitud2026-11-16:**
[105§12](105-on-demand-tech-news.md#12-news-04-segunda-fuente-rss-nodejs--solicitud2026-11-16)
integra segundo RSS Node.js con lectura pública y fetch exclusivo super_admin
por fuente explícita. Reservas/estado independientes, URLs agrupadas con
procedencias y metadata primaria correcta al filtrar. Aviso MIT completo con
atribución; sólo título/URL/fecha Node, sin extractos/cuerpos/medios.
[Evidencia por alcance](../evidence/news-nodejs-integration-20261116.md):27focales
Server y40Client, tipos/lint/build correctos;11gates SQL/HTTP en PostgreSQL
descartable, rollback conserva web.dev; adaptador compilado real100normalizadas
sin persistencia. UI sintética público oscuro ES/admin claro EN en320/600/900/1440
sin overflow, POST sólo Node mientras lectura filtra web.dev y503 conserva feed.
Fichas revisión7, draft/unregistered/approval:null. Sin adopción, migración de DB
configurada, publicación de conocimiento o aprobación del ADR105. Globales comunes:
Client3103/375, Server6091/355+1omitida histórica Linux; conocimiento96/52/44/46
conservado. NEWS-06 es el
primer pendiente; estados inferiores se conservan como cortes históricos.

**OPS-001 cerrado; OPS-05 independiente — solicitud2026-11-16:**
[99§33](99-production-deployment-and-cicd-plan.md#33-cierre-ops-001-y-separación-de-ops-05--2026-11-16)
concilia la instrucción del usuario con evidencia de entrega productiva y cierre
administrativo ya registrados en§32. Transporte v2 y archivo automático cerrados;
retención global/releases/diagnósticos y disco físico/offload siguen como OPS-05
en [TODO](TODO.md). Sin consultas productivas, limpieza, traslado o despliegue
nuevos. Las entradas inferiores conservan sus cortes históricos y se suceden
por esta separación de seguimiento.

**Cierre por aceptación humana — 2026-11-16:** el usuario informa que THEME-001
pasó QA y que PWA-001, TUX-001 y NAIUX-001 funcionan bien, y pide cerrarlos.
Se cierran por el alcance entregado en [108](108-user-theme-presets.md),
[103](103-pwa-progressive-implementation-plan.md),
[106](106-nodia-teacher-guided-ux-redesign.md) y
[107](107-nodia-ai-ux-ui-upgrade-plan.md). Esta aceptación sucede los pendientes
humanos de los cortes inferiores; no modifica sus resultados técnicos ni
acredita dispositivos/entornos no detallados. PWA-002…006 y Teacher TUX-03/05
conservan alcances futuros separados en [TODO](TODO.md). Sin nuevo código,
inferencia, migración o despliegue, ni aprobación documental de fichas/ADR.
News continúa por [105§11](105-on-demand-tech-news.md#11-pendientes-reales-de-news--conciliación2026-11-16):
segunda fuente RSS y aceptación/adopción; daily.dev sigue deshabilitada.
OPS-001 conserva únicamente la política global de disco/offload y retención
pendiente, según [99§32](99-production-deployment-and-cicd-plan.md#32-retención-automática-y-continuación-de-uploads--solicitud2026-11-16).

**Noticias: cierre editorial NEWS-05 local — solicitud2026-11-16:**
[Plan105§10](105-on-demand-tech-news.md#10-news-05-composición-editorial-y-chips-de-temas--2026-11-16)
completa la composición solicitada: chips visibles de selección única y foco
recuperable, barra editorial, grid por contenedor580/1020px y gaps24/16px,
titulares/metadatos y conteo real. Contratos, lectura pública/fetch super_admin
conservados. Global Client3087/375, focales24/4, tipos/lint/build y QA Chromium
10perfiles320–1440px correctos por [evidencia propia](../evidence/news-editorial-design-20261116.md),
incluidos teclado, paginado, sidenav colapsado, reflow720px y503 sintético.
Primera global interrumpida al corregir foco de limpiar; la final sigue al último
cambio. Sólo UI/documentación, sin nuevo Server/DB/RSS real, despliegue o aprobación.
Fichas revisión6, draft/unregistered/approval:null; evaluación visual sin cambio
de contexto/herramientas. NEWS-04 sigue segunda fuente; NEWS-06 aceptación humana,
zoom nativo200% (reflow no lo acredita), sesión auténtica/teléfono y adopción.

**Noticias pública y fetch super_admin — primera fuente local2026-11-16:**
[Plan105§9](105-on-demand-tech-news.md#9-obtención-exclusiva-super_admin-y-primera-integración-rss--2026-11-16)
registra la restricción posterior del usuario: cualquiera lee caché pública,
sólo super_admin vigente obtiene datos externos. Home→Noticias implementado,
GET público y POST administrativo con reserva durable/fencing; web.dev primero,
daily.dev deshabilitada y Node/GitHub candidatas por [catálogo](../features/news/source-catalog.md).
En `codex/news-implementation`, desde development `2585b767`, NEWS-02/03 locales
verificados: Client3078/374 y Server6088/1omitido histórico/355, tipos/lint/build
correctos por alcance;9gates SQL/HTTP descartables y lectura real de10artículos
por adaptador, sin credenciales. QA Chromium sintética8perfiles320–1440px,
ES/EN/claro/oscuro, filtros/drawer y503 con tarjetas conservadas según
[evidencia propia](../evidence/news-public-rss-implementation-20261116.md).
Migración179367 sólo ensayada en DB descartable; sin adopción de BD configurada,
VM/producción, aceptación humana o publicación/aprobación de fichas/ADR.
Revisión5 producto partial/función implemented por web.dev, unregistered y
approval:null; corpus44documentos/46fragmentos conservado.
[ADR105 propuesto](../architecture/decisions/ADR-105-public-news-and-source-access-tiers.md).
[NEWS-001](TODO.md) continúa segunda fuente y QA/adopción propios; no repetir
primera integración ni habilitar daily.dev por ser super_admin.

**Temas personales desde el topbar — solicitud2026-11-16:**
[Plan108](108-user-theme-presets.md) registra desarrollo autorizado de
44opciones: Nodia y43presets de tweakcn incorporados, con modo claro/oscuro
independiente y preferencia del navegador accesible a todos los roles.
Implementación y verificación local completadas: 86 paletas importadas con
contraste mínimo por alcance, QA Chromium sintética12perfiles, almacenamiento
denegado/rollback/reintento y selección sin conexión correctos. Global3059/370;
después del feedback final,27focales/7archivos, tipos/lint/build correctos por
[evidencia y límites](../evidence/user-theme-presets-20261116.md). Lint excluye
experimentos `.tmp` históricos y build conserva aviso>500kB. Primer pendiente:
aceptación visual humana con UI/sesión auténtica y teléfono; después adopción
por entorno si se solicita, sin repetir catálogo/construcción/QA local.
[Ficha candidata](../nodia-ai/knowledge/general-settings/features/interface-theme-presets.md)
draft/unregistered/approval:null, sin herramienta IA o despliegue nuevos.

**Teacher: revisión legible del plan — solicitud2026-11-16:**
[106§13](106-nodia-teacher-guided-ux-redesign.md#13-revisión-del-plan-legible-y-edición-progresiva--solicitud2026-11-16)
retoma TUX-04: resumen/recorrido primero, «Usar este plan» principal y edición o
ajuste con IA bajo demanda. Todos los campos, borradores, cantidades inválidas y
aceptación exacta conservan sus contratos. Implementación y QA sintética local
verificadas:12perfiles320–1280px y borradores/nodos/foco conservados, incluso
ante503/409. Global3039/365 previa al guard final y al caso histórico;26focales
posteriores y build/lint finales correctos. [Evidencia propia](../evidence/teacher-plan-review-20261116/README.md).
TUX-04 parcial: comprensión humana/UI autenticada/dispositivo y adopción
pendientes; sin inferencia, publicación o aprobación nuevas.

**NodiaAI: historial móvil desde cabecera — solicitud2026-11-16:**
[107§15](107-nodia-ai-ux-ui-upgrade-plan.md#15-historial-móvil-desde-cabecera--solicitud2026-11-16)
registra la petición de retirar la barra lateral por debajo de900px y abrir el
historial desde un icono de cabecera; fila móvil con «Nuevo chat» compacto a la
derecha. Escritorio conserva el panel colapsable; chat/borrador/URL y búsqueda
conservados en [QA Chromium sintética](../evidence/nodia-ai-mobile-history-20261116/README.md),
incluso al redimensionar y ante503. Implementación local, tipos/lint/build
correctos;84focales y global3035/364 correctos. Capturas anteriores
con barra móvil históricas, sin aprobar fichas o desplegar esta revisión.

**NodiaAI: claridad del historial y filtros — continuación2026-11-16:**
retomado NAIUX-001 desde [107§14](107-nodia-ai-ux-ui-upgrade-plan.md#14-continuidad-del-historial-y-filtros--continuación2026-11-16).
Vacío filtrado diferenciado, criterios activos/restablecimiento visibles,
selección accesible y Drawer móvil con nombre. QA Chromium sintética en cinco
perfiles correcta, con borrador/chat/foco y recuperación de consulta conservados;
global3034/364 y tipos/lint/build correctos. [Evidencia](../evidence/nodia-ai-history-filters-20261116.md).
UI autenticada/dispositivo y adopción de esta revisión pendientes; no se
modifican contratos, IA o autoridad ni se aprueban/publican fichas.

**Teacher: ResizeObserver — corrección local verificada2026-11-16:** solicitud en
la misma rama, sin cambiar diseño o borradores. [106§12](106-nodia-teacher-guided-ux-redesign.md#12-ciclo-de-medición-de-teacherloading--solicitud2026-11-16)
limita la medición Boneyard a la carga inicial tras reproducir el aviso; regresión
atómica (3 casos) y QA independiente de tres recorridos/seis perfiles sin avisos;
geometría conservada.
Revalidación focal actual 60/60, tipado, lint y build finales correctos por alcance;
global con fallo de test concurrente y revalidación posterior detallados en [evidencia](../evidence/teacher-drawer-chat-ui-20261116.md#corrección-del-ciclo-de-medición--solicitud2026-11-16).
Sin inferencia, despliegue o publicación de contexto.

**Teacher: cabecera, drawer y selector IA — solicitud2026-11-16:** mockups
aceptados y desarrollo autorizado en la rama actual `codex/durable-backend-uploads`.
[Plan106§11](106-nodia-teacher-guided-ux-redesign.md#11-cabecera-drawer-adaptativo-y-selector-ia--solicitud2026-11-16) registra estado a la derecha del título,
acciones/resultado integrados, aprendizaje adaptativo en Drawer con Mis fuentes
inicial y selección IA horizontal en Popover, sin botón «+». Implementación y QA sintética de seis perfiles/
continuidad verificadas; pruebas/tipos/lint/build finales correctos por alcance
(incluida la última alineación CSS xs); [evidencia propia](../evidence/teacher-drawer-chat-ui-20261116.md).
Contratos/autoridad/recuperación conservados; sin inferencia, despliegue o
aprobación/publicación de fichas por este lote.

**NodiaAI: historial compacto y burbujas — solicitud2026-11-16:** mockups
aceptados e implementación local en la rama actual `codex/durable-backend-uploads`.
[Plan107§13](107-nodia-ai-ux-ui-upgrade-plan.md#13-historial-compacto-y-burbujas--solicitud2026-11-16)
registra marca34px estilo Teacher, historial colapsado en iconos con tooltips,
compositor16px, selector según texto y respuestas en globo con copia sólo por
icono. [QA sintética6perfiles/continuidad correcta](../evidence/nodia-ai-sidebar-bubbles-20261116.md);
tipos/lint/build finales correctos y pruebas globales con corrección/revalidación
focal posterior. Contratos/contexto/autoridad conservados.
Sin adopción de este nuevo alcance, inferencia o aprobación/publicación de fichas.

**CD: entrega95b completada con upload v2 — 2026-11-16:**
[99§32](99-production-deployment-and-cicd-plan.md#32-retención-automática-y-continuación-de-uploads--solicitud2026-11-16)
y [recibo/evidencia](../evidence/durable-backend-uploads-20261116.md): PR39/40
integrados, CI master43878077045 y CD43879692520 completos correctos. Backend/
Client95b publicados con árbolesc01/bbb5 sin variación; transferencia v2 de
215982275bytes verified, recovered:false y sin fallos inyectados en producción.
SSH nuevo deployment_ready/blocked:false y writers activos; HTTPS API200/auth401/
Client200 con TLS0, Pages01ee1156 y PWA10recursos correctos. El mantenimiento previo
de adopción conservó6ba/PIDs sin restart; esta entrega normal activó95b.
Prueba root final: un archivo automático de215986320bytes, bytes/referencias
íntegros; inventario9ZIPs/1943826973bytes, tres archivos y un ledger verified,
sin parcial. Sudo invalidado, tmux cerrado y SSH posterior95b/blocked:false/activos.
Alcance v2 entregado y cierre administrativo completo. [TODO OPS-001](TODO.md)
continúa con política de disco físico/offload y retención global de releases/
diagnósticos. Fallos y reanudación probados en CI aislado; transferencia productiva
normal (recovered:false).
[ADR104 propuesto](../architecture/decisions/ADR-104-durable-upload-continuation-and-incoming-retention.md),
sin aprobación documental, inferencia IA, cambios de conocimiento o replay histórico.

**CD y NodiaAI: entrega productiva completada — 2026-11-16:**
PR36→development y PR37→master6ba2afb7, con CI correctos. CI43798403214 y
CD43799433169 correctos: backend6ba/c01 complete y Client6ba/bbb5 publicado,
PWA10recursos verificados. SSH nuevo confirma current, API/worker activos y
blocked:false; HTTPS API200/auth401/Client200 con TLS verificado.
[99§31](99-production-deployment-and-cicd-plan.md#312-entrega-nueva-completada-en-producción--2026-11-16)
y [evidencia/recibos](../evidence/deploy-upload-reconciliation-20261115.md)
separan mantenimiento sin restart de la entrega normal que sí activó release y
reinició servicios. No-op no usado por cambiosops; código integrado, caso remoto
elegible aún sin ensayar. CD antiguo/recibo unknown intactos, sin replay.
[TODO](TODO.md): NAIUX adopción operativa realizada, comprensión/UI real y teléfono
pendientes; OPS conserva preflight, ledger/reanudación y retención automática.
Sin nueva inferencia, aceptación humana o aprobación/publicación de fichas.
Sudo invalidado y tmux administrativo cerrado, comprobación SSH correcta.

**NodiaAI UX/UI — implementación local, 2026-11-15:** misma rama
`codex/nodia-ai-ux-ui-upgrade`. [Plan107§11](107-nodia-ai-ux-ui-upgrade-plan.md#11-implementación-local-solicitada-en-la-misma-rama--2026-11-15)
y [evidencia](../evidence/nodia-ai-ux-upgrade-20261115.md): workspace flex/historial
plegable, lectura editorial, compositor2niveles y selección modal progresiva.
Selección exacta, borradores/errores, adjuntos, voz, Stop, propuestas y recuperación
conservados; Teacher mantiene variante inline. Client3013/363, tipos/build y
lint de código correctos;28perfiles sintéticos, foco/ancla/GuardStrict y errores
comprobados. Lectura1440:565→616px; compositor320:195→120px; JS+1845bytes gzip,
sin ahorro de red afirmado. Una ronda global previa agotó espera RTL OCR; caso/
suite aislados y global final4workers pasaron sin alterar assertions/timeout.
Sin inferencia/despliegue o aprobación/publicación. [TODO](TODO.md): continuar
NAIUX-07, revisión humana/UI real/dispositivo y adopción propia del entorno.

**NodiaAI UX/UI — corte documental inicial, 2026-11-15:** sustituido en alcance
de implementación por la continuación superior. Rama
`codex/nodia-ai-ux-ui-upgrade`, creada desde origin/development actualizado
`d2baa8f1`. [Plan107](107-nodia-ai-ux-ui-upgrade-plan.md) fija referencia DeepSeek,
auditoría Client/contratos, dirección visual y entregas con aceptación/medición.
Compositor/Stop/scroll y propuestas actuales se preservan; selección progresiva,
jerarquía de mensajes y altura móvil son mejoras propuestas. Dictado320px tiene
una incidencia previa documentada; el resto de fricciones requiere baseline.
Sin código UI, inferencias o despliegue; [TODO NAIUX-001](TODO.md) empieza en
NAIUX-00, medición comparable con fixtures, y NAIUX-01, propuesta visual.
Evaluación en producto draft/partial y ficha draft/implemented para el compositor
vigente, ambos unregistered; el upgrade sigue planificado, sin aprobación o
publicación. Las decisiones vigentes de93 y los dos modos Agentic/API key siguen.

**CD: cuota de upload reparada, despliegue pendiente — 2026-11-15:**
CI43753748903 pasó; CD43754640640 rechazó backend antes de submit/publicación.
Incoming1,94GB más ZIP216MB excedía el límite2GiB, sin falta de disco.
Archivado reversible de un ZIP histórico complete deja8ZIPs/1727842713bytes,
con hash/recibos intactos; currente2c2eca3 y API/worker activos, sin nuevo deploy.
[99§30](99-production-deployment-and-cicd-plan.md#30-upload-de-backend-cuota-activa-y-diagnóstico--2026-11-15)
y [evidencia](../evidence/production-upload-quota-20261115.md). Candidato distingue
rechazos conocidos de unknown sin replay;130Node+27receiver+16archivo Linux
correctos. Gateway productivo no actualizado por esta intervención; siguiente
promoción/CI/CD nuevos y adopción operatoria propia del diagnóstico, sin repetir
el intento fallido. sudo invalidado y sesión administrativa cerrada.

**Teacher UX/UI — primera entrega local, 2026-11-15:** rama
`codex/teacher-guided-ui` desde `origin/development` actualizado en `ae35b02e`.
[106§10](106-nodia-teacher-guided-ux-redesign.md#10-primera-entrega-local--solicitud-de-desarrollo2026-11-15)
implementa alta3pasos, contexto opcional, resumen/edición y selección IA explícita
conservados al volver; pasos locales sin POST. Borrador sin IA y propuesta con
tupla exacta usan comandos existentes; guard SPA/recarga y salida con guardado
sólo tras acuse. [Evidencia local](../evidence/teacher-guided-setup-20261115.md)
registra Client2999/362, build/tipos/lint del código y Chromium sintético
320/600/900/1440; consultas IA iniciales2→0, JS total+6820bytes gzip. Sin cambio Server,
inferencia o despliegue. Observación/comprensión humana TUX-00/01 pendiente;
continuar TUX-03, después revisión/primera lección TUX-04/05. Fichas candidatas,
sin aprobación/publicación o aceptación heredada del Teacher histórico.

**Teacher UX/UI y núcleo de pendientes — especificación, 2026-11-15:** el usuario
reporta dificultad de uso, especialmente al crear un estudio, y pide documentar
un rediseño para implementar después. [Plan106](106-nodia-teacher-guided-ux-redesign.md)
propone alta3pasos, definición/diagnóstico opcionales, revisión primero legible y
primera lección con acciones explícitas. Contratos actuales/ADR100 conservados;
borrador de alta incompleto no se presenta como persistido. Sin UI o inferencias.
[TODO central](TODO.md) enlaza PWA, Grafana, Noticias y Teacher con estados,
dependencias y primer pendiente, sin prioridad nueva ni especificaciones duplicadas.
PWA-001: código y artefacto publicado verificados por103§12; instalación física,
standalone/auth y aceptación por dispositivo pendientes. No repetir deploy antiguo.
Fichas Teacher candidatas, sin aprobación/publicación. Este corte documental es anterior a la solicitud de desarrollo y entrega local
registradas arriba; su límite de no ejecutar quedó sustituido por esa solicitud.

**Noticias bajo demanda — investigación, 2026-11-15:** el usuario propone una
sección con botón para obtener noticias y confirma tecnología, programación e IA.
[Propuesta105](105-on-demand-tech-news.md) compara daily.dev, RSS, HN y DEV;
recomienda daily.dev más RSS, con conservación de resultados y control de cuota.
Discrepancia entre documentación Free y precios Plus de daily.dev pendiente de
cuenta real; condiciones de exhibición/retención y conexión por usuario también.
[Producto](../nodia-ai/knowledge/news/README.md) y
[función candidata](../nodia-ai/knowledge/news/features/on-demand-reading.md)
draft/planned/unregistered/approval:null, sólo registradas para validación.
Sin implementación, credenciales, consultas autenticadas, publicación o despliegue.
Continuación: cambios trasladados byte a byte a `codex/news-section-design`,
desde `origin/development` actualizado en `4e73a1ed`.
[Diseño editorial candidato](../features/news/editorial-design.md) inspirado en
Codrops, con metadatos de Smashing y filtros DEV; conserva sidenav/topbar,
theme y navegación móvil. Fichas revisión2, sin aprobación/publicación.
Maqueta local con fixtures en output: seis perfiles320/600/1440 claro/oscuro,
filtros/vacío y simulación sin HTTP correctos; sin overflow/errores JS. Shell
esquemático: no acredita la UI integrada, permisos, cuentas o teléfono físico.
Siguiente: revisar alcance/diseño/fuentes y resolver acceso/condiciones antes
de fijar contratos y construir una primera fuente de extremo a extremo.

**Teacher GPT: runtime productivo activo —2026-11-14/15:**
release `backend-3beeedbcbf10-d096d1b33274` confirmado; usuario ejecutó refresco
CAS de operadores y prepare del host release79960da7. Recibos/hashes comprobados,
API/worker/PID/current/keyrings/timers intactos durante preparación. Build release
offline y CLI del artefacto correctos;11 pruebas Cargo release correctas. Ensayo
DB actual sintético comprobó49 migraciones/68 entidades/102 tablas y cleanup.
Integración final113 casos Python Linux root sin omisiones, NodeCI15 y cinco
regresiones Node históricas, más bundle
correctos, con revisión independiente. Clave original localizada en su custodia
local protegida. Respaldo875a4409 y restore local exacto comprobados para49
migraciones/68 entidades/102 tablas, con GCM y cleanup completos. Ventana
aed9a8b7 completada:72 activo en ambos consumidores, nuevos PID877005/877006,
current/keyrings/timers conservados y nueve contadores quietos antes/después
de la parada. HTTPS200/auth401 comprobados. Usuario confirmó desaparición del
aviso y propuesta GPT/medium generada desde Teacher; alcance humano acotado a
ese escenario, sin login nuevo, fallback o aceptación de otras modalidades.
[99§29](99-production-deployment-and-cicd-plan.md#29-teacher-sigue-bloqueado-tras-el-cd-aprovisionamiento-separado--2026-11-14)
y [evidencia](../evidence/teacher-production-runtime-20261114.md).

**Favicon como PWA — añadido a PR25, 2026-11-14:** misma N esencial compartida,
URLs favicon versionadas por el hash del SVG para solicitar la marca actual;
sin cambiar los bytes de imagen o el manifiesto. Build/tipos,31checksLinux sin
omisiones y validación de10assets construidos correctos. [103§13](103-pwa-progressive-implementation-plan.md#13-favicon-web-igual-a-la-marca-pwa--2026-11-14).
Sólo visual/metadatos, sin nuevo despliegue ni aceptación de instalación/caché
de usuario. PR conserva base development y no se fusiona por esta solicitud.

**Alta POS con incorporación automática — VM development2026-11-14:** el usuario
retira el reescaneo del primer corte: guardar completamente añade una unidad
a la misma venta local y limpia/enfoca el lector; callback separado de cancelar,
guard de contexto y una sola incorporación por intención. [Plan94§40](94-business-point-of-sale-and-product-refactor.md#40-añadir-el-producto-recién-guardado-a-la-venta-actual--solicitud2026-11-14)
y [evidencia nueva](../evidence/pos-product-registration-autoadd-20261114.md).
Client2994/362,57focales/3archivos, build/tipos/lint y QA sintética320ESdark/
1280ENlight correctos. Client VM adoptado con213recursos exactos/212históricos
HTTP; procesos/env/timers intactos, rollback preparado y recibo propio. Siguiente:
revisión humana de UI autenticada VM/lector físico, sin heredarla de fixtures.
El cierre§39 siguiente es histórico y no acepta automáticamente autoadd.

**Lector POS: registro de barcode desconocido — VM development2026-11-14:**
404 product:not_found abre Registrar/No/Asociar existente. Registrar usa el
formulario nativo con barcode textual precargado y foco útil en nombre; No o
cancelar limpia y devuelve foco, sin cambiar carrito. [Plan94§39](94-business-point-of-sale-and-product-refactor.md#39-alta-de-producto-al-escanear-un-barcode-desconocido--solicitud2026-11-14)
y [evidencia](../evidence/pos-unknown-barcode-registration-20261114.md).
Client2986/362 y regresiones finales correctos; build/tipos/lint y Chromium
sintético320/600/1280 ES/dark y EN/light correctos. Client adoptado en VM:
213recursos exactos y212históricos direccionables, Nginx CAS/un reload y rollback
preparado; Server/DB/procesos/env/timers conservados. Sin migración, proveedor,
venta real, publicación IA o aprobación documental nueva. Siguiente: revisión
humana de UI autenticada VM/lector físico; no heredarla de la QA sintética.

**Alias de productos — VM development2026-11-14:** implementados alias independiente,
revisión OCR humana, búsqueda nombre OR alias, CSV/historial y filtros de
presencia de código/barcode. [Plan94§38](94-business-point-of-sale-and-product-refactor.md#38-alias-humano-de-productos-y-revisión-ocr--solicitud2026-11-14),
[ADR102 propuesto](../architecture/decisions/ADR-102-human-product-alias-and-code-completeness.md)
y [evidencia](../evidence/product-alias-and-code-completeness-20261114.md).
Client2964/360 y Server6063/353 correctos, una omisión Windows comprobada en
Linux;48Server finales tras ajustar whitespace SQL. Builds, lint del código,
cuatro gates HTTP aislados y Chromium sintético320/600/1280 correctos. SQL aislado
Linux:cinco gates correctos y cuatro HTTP adicionales, sin DB operativa ni proveedor.
Migración179366 adoptada una vez48→49 en VM,13productos/33logs preservados,
aliasNULL sin backfill. Respaldo final DB/configuración cifrado/restaurado con
igualdad exacta. Cierre de servicios/timers en recibo operativo de evidencia;
UI real VM pendiente de revisión manual por rechazo automático Chrome/túnel.
No producción, inferencia OCR, publicación ni rediseño POS.

**Chat compacto y GPT Agentic — VM development2026-11-14:** rama
`codex/nodia-ai-chat-space-gpt-selection` desde origin/development. Stop en el
compositor, sin botón de actividad ni cabecera título/modelo; renombrado lateral,
padding vertical16px y laterales16/24/32px. Preferencias GPT recuperables sin
inventar modelos/disponibilidad, elegibilidad Teacher con diagnóstico preciso.
Host Teacher existente preservado y overlay adoptado en VM: catálogo GPT con
seis preferencias, elegibilidad exacta y una creación normal start_plan:true
gpt-6.1-sol/medium pasaron. Un dispatch reservado/iniciado, trabajo ready con
propuesta de dos secciones; cierre Native/local y ACK persistidos. Sin aceptar
plan, fallback, replay o cambios de credenciales. El aviso inicial de sesión fue
causado por el harness sin el bind del bus que sí usa la API, no por logout.
[Evidencia y cierre operativo](../evidence/nodia-ai-chat-space-gpt-selection-20261114.md).
La revisión automática rechazó Chrome personal y el túnel SSH; interfaz real VM
pendiente de revisión manual, QA visual local sintética separada. La adopción no
acredita producción o publicación. El host ausente en rutas productivas revisadas
requiere su entrega propia según99§28; no se ejecutó CD. Los conteos de pruebas
locales previos conservan su recibo; la suite con productos se registra arriba.

Actualizado el 2026-11-14. Síntesis del estado y pendientes por alcance; no es una consulta en vivo de la VM ni acredita despliegue en Truobox. El upgrade Teacher tiene construcción y QA55/55 por alcance R02 del2026-11-11; los restantes QA citados conservan la fecha explícita de su evidencia.

La navegación está en el [índice del MVP](README.md). Las cronologías, checklists superados e incidencias anteriores se conservan en el [historial consolidado](00-progress-history.md), sin convertir sus «siguientes pasos» antiguos en tareas actuales.

## Próxima acción recomendada

**CD: convergencia pública de Pages, 2026-11-14:** CI43620970891 de
masterbb83fd26 pasó; CD43622185230 completó backend y publicó Pages, pero la
lectura inmediata PWA falló en digest. El ZIP original Client14125035031, con
SHA256 oficial comprobado, coincide después por HTTPS en los diez recursos,
incluido HTML. En `codex/fix-production-deploy`, desde development59118f99,
se añade verificación de snapshots completos durante120segundos/hasta25intentos,
sólo GET sin credenciales y conservando MIME/tamaño/SHA256 exactos. Fallo
permanente conserva deployment, ruta permitida y contador; no autoriza replay.
Ver [99§27](99-production-deployment-and-cicd-plan.md#27-pages-publicado-verificación-pública-durante-la-transición--2026-11-14)
y [evidencia](../evidence/pages-public-convergence-20261114.md).
Siguiente: PR hacia development y promoción a master con CI/CD nuevos;
no reejecutar CD43622185230 ni operación017edb5724bd1f86c6835130c7cc97cd.
Validación:28focales y108Node Linux/Node24.22.2 sin omisiones; control de una
sola ronda rechazado y módulo restaurado, más HTTPS del paquete original.

**Logs y monitoreo — documentación previa, 2026-11-14:** el usuario elige Grafana
Cloud Free y pide comprenderlo antes de instalar. Rama
`codex/plan-grafana-cloud-monitoring` desde development0639f0d9.
[Plan104](104-logs-and-monitoring-grafana-cloud.md) conserva la comparación,
límites oficiales, inventario del repositorio, flujo y casos Pages/endpoint500/
host caído; propone Alloy en VPS, almacenamiento/alertas Cloud y sondas externas.
Separar el futuro evento de CD: Alloy no ve por sí solo el runner de GitHub.
Saneamiento de logs HTTP/Redis requerido antes de exportar. Selección de
proveedor confirmada; plan en revisión y [ADR101 propuesto](../architecture/decisions/ADR-101-grafana-cloud-observability.md),
sin cuenta/stack/tokens, instalación, ingesta o cambios productivos en esta
entrega. Siguiente: revisar funcionamiento y continuar G1 con cuenta/región,
plan Free efectivo y correo receptor; configuración e integración por etapas.

**Teacher: alta y primer intento, 2026-11-14:** continuación en
`codex/unify-model-reasoning-selector`, sin canary previo por decisión expresa
del usuario. Opciones de razonamiento recuperadas desde catálogo real por
conexión, metadata advisory preservada al leer/guardar, mensajes de selección
precisos y edición durante elegibilidad. Formulario con título primero, ayudas
ES/EN y botones contained; marca igual al listado. Menú lateral/móvil conserva
el destino visible más específico en subrutas, sin ampliar acceso.
[96§43](96-nodia-teacher-implementation-plan.md#43-alta-de-estudio-razonamiento-recuperable-y-menú-persistente--2026-11-14),
[ADR100 propuesto](../architecture/decisions/ADR-100-teacher-first-generation-with-explicit-ai-selection.md)
y [evidencia](../evidence/teacher-ai-selection-first-generation-20261114.md)
separan pruebas locales, navegador y PostgreSQL descartable de proveedor real.
Client global2934 más focales finales53, Server261/31archivos, API32SQL y
Agentic36SQL pasaron; builds/lint del código y knowledge:check correctos. Chromium
320/600/1280 confirmó cambio de razonamiento y una creación sintética exacta.
Fichas draft/partial/unregistered/approval:null; sin despliegue, migración
operativa, inferencia real o publicación. La decisión sustituye el gate previo
de Teacher, conservando configuración, autoridad, presupuesto, cierre y no-replay.

**Selector de modelos y seed, 2026-11-14:** en
`codex/unify-model-reasoning-selector` desde development898aec84 se cerraron los
listados separados de sincronización, compositor y configuración; Teacher
comparte algoritmo. Preserva IDs/esfuerzos exactos, OCR efectivo y elegibilidad,
con regresiones de fallos y cambios de contexto. Suite global2912, finales29,
helper/Teacher/chat41, build/tipos y lint de código correctos; Chromium sintético
320/600/1280 sin overflow. Lint general conserva un fallo en un experimento
previo ignorado. [Evidencia](../evidence/model-selector-residual-audit-20261114.md).
La [consulta del seed](database-installation.md#configuración-inicial-del-superadministrador--consulta-de-código-2026-11-14)
documenta `super_admin`, cuatro asignaciones y bypass del catálogo activo; no
ejecutó bootstrap/migraciones. Candidato local sin commit/push, despliegue,
inferencia o publicación; siguientes pasos Git/aceptación por entorno separados.

**Pages: contrato real y preflight corregidos, 2026-11-14:** [99§25](99-production-deployment-and-cicd-plan.md#25-pages-respuesta-válida-rechazada-y-preflight-antes-del-backend--2026-11-14). CD43547384570 (CI43546497935/1, master0f69d505) completó backend y rechazó un check-missing HTTP200/success:true porque errors no estaba presente. Respuesta real y fuente Wrangler4.161.0 confirman el defecto; fixtures corregidos. Rama codex/fix-pages-protocol-contract añade validación correcta, preflight Pages antes del backend y recibo durable saneado. Preflight real del artefacto original verificado pasó sin rebuild/upload/deploy;13pruebas directas y101Node en Linux correctas, sin omisiones; actionlint correcto. SSH confirma API/worker activos, blocked=false y operación64c9a2f383709ee93ca5e584a9bc5b52 completa; Pages siguef01 sin marcador del CI fallido. Siguiente: PR/CI, promoción y CD nuevos, sin repetir la operación completa ni reejecutar el CD anterior. [Evidencia](../evidence/pages-protocol-contract-20261114.md). Publicación real pendiente; las entradas inferiores conservan sus cortes anteriores.

**CD parcial y Pages corregido, 2026-11-13:** PR14/PR13 integrados; CI43535099739 de master174c2ca5 pasó. CD43536680525 completó backend (SSH: API/worker activos, blocked=false) y falló antes de publicar Client. Pages sigue en f01. Causa reproducida con lectura real: deployments/per_page100 devuelve HTTP400/8000024;25 devuelve200. Rama codex/fix-pages-delivery desde development23982da9 corrige paginado25/80, conserva detección de duplicados/no-replay y añade operación/HTTP al error sin secretos. Validación y pasos en [99§24](99-production-deployment-and-cicd-plan.md#24-pages-paginación-rechazada-antes-de-publicar--2026-11-13) y Obsidian26.28. Siguiente: PR hacia development y promoción a master con CI/CD nuevos; no repetir el apply completado ni reejecutar el CD anterior. Las entradas inferiores conservan sus cortes históricos.

**CI de propuestas retenidas, 2026-11-13:** PR13 development→master se detuvo en Client/tests, después de lint/build correctos. useProposal.test leía el render inmediatamente después de refetch403; TanStack notifica al observador React por lotes. En codex/fix-proposal-readiness, desde developmente39cfc65, se espera el error exacto y fetch terminado para500 y401/403/404/410, conservando assertions inmediatas de ambas entradas de caché borradas. Se corrige también la observación de503 en un test cercano de detalle. Sólo pruebas: hooks, contratos y permisos permanecen iguales.62pruebas enfocadas, lint/build y suite global2895/353 correctos, sin pendientes; experimento local omitiendo limpieza hizo fallar los4rechazos y restauró íntegro el fuente. Promoción por PR hacia development, actualizando después PR13; CI remoto del fix conserva resultado propio. Ver [99§23](99-production-deployment-and-cicd-plan.md#23-prueba-de-propuestas-esperar-el-rechazo-observado--2026-11-13). No se ejecutó otro CD.

**Incidente CD/CORS cerrado operativamente, 2026-11-13:** CI43471624414 de master2cfce73d pasó; CD43473542741 falló al comprobar una parada SIGTERM satisfactoria. Se recuperó el mismo f01 tras verificar45migraciones, cero pendientes/trabajos y TLS; API/worker y timers activos, preflight público204 y401 anónimo con CORS correcto. Updater/política/receptor corregidos instalados y conciliación privada validada por ambos gates: SSH devuelve deployment_ready/blocked=false. El intento f452dfa… y BLOCKED siguen intactos y el ID no se puede repetir.60pruebas Python sin skips +4SQL/Node;28checks systemd del shutdown. CI ejecuta ahora los tests de ownership en contenedor aislado fijado por digest para evitar skips. Sudo invalidado y sesión cerrada. Siguiente: revisión/PR de codex/fix-backend-shutdown-recovery hacia development y posterior promoción a master con CI/CD nuevos; no reejecutar el intento anterior. Ver [99§22](99-production-deployment-and-cicd-plan.md#22-parada-limpia-por-sigterm-recuperación-de-disponibilidad-y-conciliación--2026-11-13) y [ADR099 propuesto](../architecture/decisions/ADR-099-pre-migration-deployment-reconciliation.md). Esta entrada sucede al estado preflight de abajo.

**PWA-001, candidato local 2026-11-13:** [plan103§11](103-pwa-progressive-implementation-plan.md#11-candidato-local-pwa-001--2026-11-13), rama `codex/pwa-001-installation` desde development actualizado a a780099b. Opción1 seleccionada explícitamente: N vectorial, favicon SVG/ICO/PNG, iconos192/512/Apple180 y variantes maskable; manifiesto/metadatos y validación CI/CD del mismo artefacto. Build con TypeScript,90regresiones auth y82checks CI/CD correctos;10checks Linux pendientes. Lint del código correcto excluyendo `.tmp/**`; el comando general detecta un experimento previo ignorado. Chrome/Edge locales interpretan el manifiesto sin errores de instalación, con archivos200/MIME correcto y guard anónimo conservado; no equivale a instalar la app. [Evidencia](../evidence/pwa-001-local-20261113.md) y [guía](pwa-installation-guide.md). Siguiente: PR/CI Linux, instalación y auth standalone Chrome/Edge, Android físico y publicación/verificación HTTPS. iOS sin verificar. Plan en revisión y ficha draft/partial con approval:null, sin publicación IA, SW/offline/push o deploy.

**CD backend: preflight corregido, 2026-11-13:** CI master60494715 correcto; CD43374689583 falló durante preparación sin efectos del flujo/migraciones. Causa confirmada: WRITABLE_STATE bajo ProtectSystem=strict en node_job; se conceden sólo home/codex como en las unidades de aplicación. Updater703791f5… instalado con pin y originales protegidos;70pruebas Python root y25checks systemd, preflight real con PostgreSQL TLS/Redis/R2 correctos. SQL45→48/3pendientes, sin migrar o activar candidato; f01/API/worker conservados y operación fallida intacta. Siguiente: versionar/promover por PR y generar una intención CI/CD nueva revisada, sin repetir/resetear la anterior. Ver [99§21](99-production-deployment-and-cicd-plan.md#21-primer-cd-preparación-fallida-y-diagnóstico-protegido--2026-11-13). El plan PWA se incorpora ahora a la misma promoción documental, sin implementar la función.

**CI de importación CSV, 2026-11-13:** master6b02816d pasó baseline/pipeline y lanes de backend/Python/native; Client falló en una consulta prematura al botón después de seleccionar CSV. Se corrigen tres tests para esperar FileReader/render y se añade una regresión de lectura pendiente/sin escritura implícita.57pruebas enfocadas (22de importación y35de helpers/precios), lint completo y build Client correctos; la suite global del commit nuevo se comprueba en GitHub y su resultado se registra en PR/Obsidian26.17. Rama codex/fix-product-import-test-readiness desde development, separada del plan PWA aún sin commit del checkout principal. Ver [99§20](99-production-deployment-and-cicd-plan.md#20-importación-csv-esperar-el-resultado-del-lector--2026-11-13). Sin cambio del importador productivo ni de contratos/autoridad.

**Siguiente promoción, 2026-11-13:** PR7 ya integrado en developmenta3d5bf38. El intento2 de master pasó baseline/pipeline, Server/worker, Python y host nativo; Client falló en la prueba del rechazo histórico. Se reprodujo y corrigió la sincronización de esa prueba con el render React, conservando limpieza de caché y datos ocultos para401/403/404/410. Rama codex/fix-observation-access-rejection desde development;13 casos, lint y build Client correctos, suite global en verificación al preparar el commit. Promoción development→master por PR sin merge automático; resultados finales en ese PR/Obsidian26.15. Ver [99§19](99-production-deployment-and-cicd-plan.md#19-prueba-de-rechazo-de-acceso-histórico-y-siguiente-promoción--2026-11-13). No cambia comportamiento/contratos ni fichas NodiaAI.

**Baseline CD corregido, 2026-11-13:** PR5/PR6 ya integrados, development80666e6a y master7aa1da88. El run43362648327 falló porque el receptor SSH rechazaba los drop-ins IA registrados; se corrigió reutilizando la política estricta del updater. Instalación sudo y SSH restringido verificadas: mismo f01/PID, deployment_ready y servicios activos. Reejecución sólo de jobs fallidos: baseline verde en intento2/job131684277110, pasos siguientes en curso, sin afirmar build/apply completos. [PR7 hacia development](https://github.com/oscarvalenzuela25/Nodia/pull/7) versiona arreglo,10+21 pruebas y29 comprobaciones aisladas; Obsidian actualizado. Ver [99§18](99-production-deployment-and-cicd-plan.md#18-promoción-a-master-y-baseline-detenido--2026-11-13). Las notas de preparación de PR inferiores conservan su corte histórico.

**Entrega Git y limpieza, 2026-11-13:** lote `codex/enable-ai-provider-login` preparado para PR hacia development, integrando su tip1cc7621d/PR4. El snapshot del checkout principal coincide con fe55638e, ya incorporado por PR3; no queda otro WIP de ese checkout sin representar. El merge conserva los dos arreglos de UI/auth y pasa build/lint Client y393pruebas en52archivos afectados. Limpieza100§9 consolida cinco JSON; el registro conserva un comprobante Markdown técnico bajo docs/evidence porque ese prefijo es obligatorio para los7 contratos. Fichas aprobadas intactas. Primero integrar este PR en development; después promover development a master mediante otro PR. Crear los PR no acredita CI remoto verde, migración o calificación Teacher; producción conserva f01.

**Teacher e indicador Agentic locales:** formulario con ayudas, selector de idiomas y campos IA de 48px; título con line-height normal. Cabecera Codex usa observación viva compartida por instancia/sesión, además de health snapshot; login y calificación Teacher permanecen separados. Build/lint y 382 regresiones afectadas correctos, QA Chromium320/1280 sin overflow. Diagnóstico SQL READ ONLY productivo confirmado: f01/45migraciones,0recibos Agentic y sin tabla por propósito; no se ha generado, cambiado configuración o desplegado este lote. Ver [96§42](96-nodia-teacher-implementation-plan.md#42-alta-guiada-selección-visible-y-estado-agentic--candidato-local-2026-11-12) y [verificación consolidada](96-nodia-teacher-implementation-plan.md#verificación-local-y-diagnóstico-de-producción--2026-11-13).

**Ajustes IA locales:** `codex/enable-ai-provider-login` incorpora acciones contained, navegación desde el contexto del actor actual y acceso ordinario NodiaAI por identidad exacta `nodia_ai`/`/nodia-ai`, con bypass super_admin preservado. Agrupa variantes explícitas Gemini Agentic conservando IDs reales y selección OCR independiente; OpenAI API admite xhigh/max como preferencias, con Ultra deshabilitado/rechazado. Build Server, autorización60, HTTP74 y API249 correctos; build/lint Client, ProviderDetail38/helper5 y QA visual correctos; suite global Client consolidada: 2812 casos/349 archivos, dos fixtures de Home corregidos y revalidados; ProviderDetail38 separado. Sin despliegue ni nueva inferencia acreditada, y sin causa productiva del síntoma de acceso probada. Ver [contrato](ai-provider-feature-contract.md#ajustes-locales-de-interfaz-acceso-y-preferencias--2026-11-12) y [verificación consolidada](ai-provider-feature-contract.md#verificación-consolidada-de-preferencias-y-acceso--2026-11-12).

**Login IA:** infraestructura Codex/Antigravity instalada y activa desde `codex/enable-ai-provider-login` (base origin/development9495751a). API/worker reiniciados con el mismo f01; keyring/handshake/contención/HTTP y guard CD estricto verificados. Codex y Antigravity conectan según pruebas del usuario; inferencia por alcance pendiente. Ver [99§17](99-production-deployment-and-cicd-plan.md#17-login-de-codex-y-antigravity-infraestructura-preparada--2026-11-12) y [operador](../../ops/production/ai-runtime/README.md).

**Fixes UI IA actuales:** rama codex/fix-ai-provider-state-ui desde development (9495751a). Sin controles de potencia Gemini cuando faltan modelos; recarga Codex mediante icono/tooltip; observaciones protegidas por sesión y fin del sondeo ante 401/403. El 503 no se oculta. Ver [contrato](ai-provider-feature-contract.md#ajustes-de-presentación-y-consultas-autenticadas--2026-11-12) y [verificación consolidada del alcance PR4](ai-provider-feature-contract.md#verificación-consolidada-del-arreglo-ui-incorporado-desde-pr4). Implementación local, sin despliegue o calificación IA nueva.

**Validación GitHub iniciada:** [PR3](https://github.com/oscarvalenzuela25/Nodia/pull/3), rama codex/development-ci-validation → development, snapshot completo autorizado. Primer run detectó skip transitivo y se corrigieron condiciones de lanes; comprobar Checks de la revisión actual antes del merge. El checkout local development conserva su WIP. Los cortes «sin commit/push» inferiores describen la preparación previa; no acreditan CI integral verde. Ver [99§16](99-production-deployment-and-cicd-plan.md#16-pr-completo-hacia-development-y-primera-ejecución-github--2026-11-12).

1. Continuar [producción99§15](99-production-deployment-and-cicd-plan.md#15-transporte-instalado-y-cierre-de-cicd-en-curso--2026-11-12): transporte/updater ya **instalados**, SSH nuevo con host pin verificado y sudo administrativo invalidado/sesión cerrada. Producción conserva f01; API/worker activos y HTTPS200, sin apply de otra app. Pasaron systemd real20, SSH/sudo real25, SQL47 con45→48 Teacher y Python34, con fronteras sintéticas documentadas. Código CI/CD implementado y probado localmente en **development**, sin commit/push/master, con TypeScript sólo en cada build y paquetes sin rebuild en CD. Validación:74Node Linux, actionlint5workflows y helper SSH real desde el PC. Siguiente: usuario termina/versiona development, reconcilia commits operativos de master remoto, verifica CI del SHA final y promueve cuando corresponda para acreditar la primera entrega real. [Preparación](../evidence/production-cd-preparation-20261112-r01.json). Secrets/variables reportados completos; GitHub default_branch=development comprobado. [Instalación viva](../evidence/production-cd-transport-live-20261112-r01.json). Rotación PostgreSQL expuesta, calificación IA91, monitoreo/logs, segunda copia offline y retención de paquetes/diagnósticos siguen pendientes propios. Obsidian§25.16–25.17 actualizado.
2. Retomar [limpieza100](100-repository-cleanup-and-documentation-consolidation-plan.md): L02 de estos dos índices consolidado; quedan auditoría general de dependencias/temporales L01 y L03–L05 según checklist. No borrar `ops/lab/artifacts` por patrón.
3. Antes de incluir cada feature en el piloto, abrir su plan y resolver/reconciliar sus gates actuales. Un pipeline verde no cierra OCR, Teacher, recuperación o calificación IA por entorno.
4. Teacher upgrade: QA55/55 cerrado por alcance R02 Windows/API key exacta. ServerR14/ClientR41 adoptados en la VM de development, con autenticación Google normal y recorrido SQL desde la UI comprobados para la selección OpenAI Agentic configurada. Diagnóstico, evidencia por objetivo, propuesta/material, ayuda anclada, práctica y final quedaron registrados; el respaldo final posterior al QA pasó restauración de DB/configuración; la comprobación operativa y recarga de UI tras reanudar servicios pasaron. Se preservan48migraciones/102tablas y los13unknown históricos cerrados; las correcciones R14/R40/R41 se revalidaron por alcance. Práctica12/14 (escrita6/6), final40/40 (escrita24/24) y ajuste candidato no activado comprobados; son respuestas del agente de QA, no eficacia educativa humana. Seguir [102§13](102-nodia-teacher-phased-implementation-and-final-qa.md#13-cierre-pendiente-en-development--2026-11-11) y [recibo VM](../evidence/teacher-upgrade-development-vm-20261111-r01.json). El cierre funcional está comprobado; queda revisión/versionado Git editorial; mantener development, sin master y separado de producción99.

## Checklist

- [x] Separar índice, estado actual e historia de README/00-progress conservando decisiones, límites y referencias.
- [x] Preparar plan99 y workflow CI por componentes en development; primer run auxiliar revisado y correcciones locales preparadas. CD y aprobación integral conservan sus gates.
- [x] Preparar plan100 con clasificación y límites de conservación; no se han ejecutado borrados de temporales/código.
- [ ] Completar los siguientes lotes de limpieza según100, sin editar fuentes publicadas/hashes para simular igualdad.
- [ ] Verificar CI del próximo SHA de development y completar checks/protecciones, CD, secretos y paquetes de release según99; promoción a master a cargo del usuario.
- [ ] Completar monitoreo y pendientes operativos según99; instalación, primer despliegue, TLS y backup/restore ya tienen evidencia por alcance.
- [ ] Resolver los bloqueadores funcionales por alcance y comprobar las modalidades IA que se habiliten en el entorno destino.

## Estado operativo

| Alcance | Último estado acreditado | Continuidad / fuente |
| --- | --- | --- |
| Producción | Frontend y API públicos sobre f01; API/worker habilitados, backup R2 y restore aislado verificados. Login y uso general confirmados por el usuario. | [Corte vivo](../evidence/production-backend-live-20261112-r01.json), [frontend](../evidence/production-frontend-live-20261112-r01.json) y [plan99](99-production-deployment-and-cicd-plan.md). CI preparado sin commit en development; ejecución integral del próximo SHA pendiente. Transporte/updater instalados según99§15; primer run real de CI/CD del SHA final, proveedores IA, logs, monitoreo y seguridad adicional pendientes. |
| NodiaAI | Agentic y API key operativos por alcances documentados; seis puntos Agentic cerrados en laboratorio y cierre técnico Linux de AI40. ClientR38 incorpora propuestas compactas y Antes/Después con borrador/guards conservados. | [Modos90](90-agentic-api-only-web-retirement.md), [verificación91](91-ai-provider-onboarding-verification.md), [API92](92-nodia-ai-api-chat-parity.md), [cobertura82](82-nodia-ai-ai36-integral-coverage.md) y [Linux86](86-nodia-ai-ai40-codex-acceptance.md). No extrapolar disponibilidad a otros modelos, modalidades o entornos. |
| OCR manual Gemini | La recuperación identificada y el cierre local están implementados; después de una extracción sintética válida, R15/R16 vuelven a HTTP 504 tras 240 s y la lectura del PNG, sin resultado. | Extracción real bloqueada; causa no aislada. [Plan94](94-business-point-of-sale-and-product-refactor.md) y [evidencia R16](../evidence/invoice-gemini-timeout-20261107-r02.json). Archivo conservado, sin replay ni guardado comercial. |
| Teacher | Upgrade101/102 F0–F9 y55TU cerrados para Windows/API key exacta; recorrido VM OpenAI Agentic sobre R14/R41 comprobado con diagnóstico, evidencia, material, ayuda, práctica y final. | [Matriz R02](../evidence/teacher-upgrade-acceptance-20261111-r02.md), [recibo R02](../evidence/teacher-upgrade-local-20261111-r02.json) y [recibo VM](../evidence/teacher-upgrade-development-vm-20261111-r01.json); respaldo/restauración y estado operativo final comprobados; revisión/versionado Git editorial pendiente. Sin eficacia humana,55nuevos TU VM o aceptación de otras selecciones; unknown históricos intactos. |
| Productos y POS manual | Precios normal/oferta independientes, sugerencia local explícita y mejoras de presentación adoptadas en laboratorio. ServerR11/ClientR28 suceden al arranque fallido R10; no repetir su migración. | [Plan94](94-business-point-of-sale-and-product-refactor.md) y [evidencia de precios](../evidence/business-product-pricing-20261106-r01.json). Vinculación OCR manual comprobó búsqueda/comparación/borrador, sin guardado comercial final; lector/teléfono/impresión física y compatibilidad mantienen su alcance propio. |
| Recuperación | Backups cifrados, journal externo y restauraciones aisladas comprobados por cortes concretos. | [Aceptación84](84-nodia-ai-ai38-environment-acceptance.md) mantiene pendientes de evidencia la retención real de siete días y la eliminación física en 24 h. [Operador](../../ops/nodia-ai-backups/README.md); el transcurso del tiempo no demuestra cierre. |
| Dictado | Implementación y pruebas sintéticas; la prueba real anterior de reconocimiento no fue positiva. | Servicio operativo y habla/Stop reales pendientes según [plan93](93-nodia-ai-chat-composer-redesign.md); no atribuir captura real a otras mejoras del chat o Teacher. |
| Finanzas y Reservas | Implementaciones y entregas locales/aisladas registradas, con evidencia por capa y evolución posterior del entorno. | Reconciliar los gates específicos en [Client24](24-personal-finance-client-plan.md), [Client30](30-rental-reservations-client-plan.md) y sus planes Server. FC-24/RC-38 históricos no justifican repetir instalaciones ya sucedidas ni acreditar aceptación universal. |
| Core y rendimiento | Acceso/privacidad y orden de módulos tienen fuentes propias; optimizaciones visuales y móviles acreditadas por perfil/ruta. | [Política89](89-module-access-and-user-data-scope.md), [plan87](87-core-feedback-module-order-plan.md), [rendimiento37](37-web-performance-implementation-plan.md) y [DESIGN Client](../../nodia-client/DESIGN.md). Mantener gates de concurrencia, sesión y aceptación por entorno de cada fuente. |

## Bloqueos actuales

- **OCR manual Gemini:** timeout real posterior a lectura, sin resultado ni causa confirmada. Conservar archivo/estado incierto y diagnosticar con la evidencia existente; no ampliar plazos, cambiar proveedor o repetir inferencias automáticamente.
- **Teacher V1:** feedback escrito Gemini unknown y framing de generación posterior, identificados en96§32. No confundir correcciones de UI o éxito de una unidad con cierre integral.
- **Aceptación de recuperación:** retención/limpieza física y demás gates efectivos de84 necesitan evidencia propia, además de un backup o restore puntual.
- **Dictado real y modalidades:** verificar reconocimiento positivo cuando se retome; API imagen está pospuesta en92, no es una invitación a consumir claves ni un bloqueo general de API chat/OCR.
- **Piloto productivo:** despliegue/transporte y restore Truobox verificados por el corte2026-11-12; login/uso general reportados; refresh/cookies y aceptación por feature conservan alcance propio. CI preparado en development, CD/logs/monitoreo/seguridad adicional pendientes; credenciales PostgreSQL expuestas aún sin rotar. La calificación IA conserva gates propios de99.

Las listas generales de P0 y «siguientes pasos» de cortes antiguos están en el historial. Reconciliar [revisión19](19-prelaunch-review.md) con sus cierres posteriores y el alcance que se lanzará; esta síntesis no declara todos esos hallazgos resueltos ni los reabre por antigüedad.

## Corte histórico Teacher R01: integración local y QA parcial — 2026-11-11

Este corte precede al cierre R02 de55TU registrado en el estado operativo y al final del documento; sus pendientes de proveedor/muestra/performance se resolvieron para ese alcance.

El usuario autorizó todas las fases después del corte documental inicial. [101 R03](101-nodia-teacher-adaptive-upgrade-plan.md) y [102 R02](102-nodia-teacher-phased-implementation-and-final-qa.md) registran construcción F0–F9 integrada y aceptación separada: evidencia por objetivo, diagnóstico previo al plan con banco manual revisable y mapeos explícitos, recomendaciones/práctica contextual, bloques prediction/check, repaso teacher-intervals/1, hilos, fuentes privadas, actividades/visuales declarativos y conceptos/equivalencias propios. No hay FSRS, banco automáticamente validado, hipótesis pedagógicas estructuradas automáticas ni transferencia de notas/verificaciones entre planes.

QA observado: Server133tests/25suites, Client174/29; SQL core8, enriquecimiento10incluido restore aislado, dominio14, runtime29con3POSTs locales sintéticos y HTTP nuevo9; builds Server/Client pasados. Conocimiento en modo check conserva87fuentes/43excluidas,44documentos/46fragmentos aprobados y release sin cambio. [Recibo](../evidence/teacher-upgrade-local-20261111-r01.json) y [matriz55TU](../evidence/teacher-upgrade-acceptance-20261111.md) delimitan resultados; estos conteos no son55TU aprobados. Restore comprobó igualdad del contenido ordenado de todas las tablas en PostgreSQL descartable, sin workers/POST al restaurar; no es backup operativo.

Navegador de paneles320/1280px y lote P2 revalidados por alcance; calificación por manifiesto/propósito protegida mediante protocolo de operador y13checks SQL sintéticos. Pendientes: muestra pedagógica de dos temas, proveedor/selección/propósito real91/92 y baseline medido de rendimiento. Sigue sin eficacia educativa o cierre V1 integral acreditados. ADR098 permanece propuesto; fichas draft/partial/unregistered/approval:null; sin publicación/despliegue ni cambios en base operativa. Continuar correcciones y QA por lotes sin aprobación por función; producción99 conserva sus gates independientes.

## Decisiones que invalidaron pasos posteriores

| Decisión vigente | Consecuencia |
| --- | --- |
| [Agentic/API key90](90-agentic-api-only-web-retirement.md) y [paridad API92](92-nodia-ai-api-chat-parity.md) | Web y `token_plan` están retirados. El antiguo pendiente «API chat no soportado» no describe el runtime actual. |
| [Ventas sólo lectura94, R17](94-business-point-of-sale-and-product-refactor.md#26-nodiaai-ventas-y-reportes-de-solo-lectura--r17-2026-10-30) | NodiaAI consulta ventas/reportes; no prepara ni ejecuta mutaciones de ventas, tampoco desde propuestas antiguas. POS manual conservado. |
| [Privacidad89](89-module-access-and-user-data-scope.md) y [ADR092](../architecture/decisions/ADR-092-stable-module-navigation-routes.md) | Autoridad por destino canónico y ámbito real; mover/renombrar grupos no concede acceso. Teacher tiene dominio propio. |
| [Piloto99](99-production-deployment-and-cicd-plan.md) | Truobox reemplaza Instabox Free como destino; PostgreSQL sigue en Northflank Free por elección explícita. Un volumen pequeño no acredita garantías comerciales ni autoriza upgrades automáticos. |

La aprobación humana de las seis revisiones R02 de API corresponde a sus selecciones/alcances y no aprueba automáticamente ADRs, fichas o modalidades adicionales. Las aprobaciones de otros dominios permanecen en sus fuentes; no derivarlas de un checkbox de implementación.

## Seguimiento técnico

| Trabajo | Fuente y evidencia de entrada |
| --- | --- |
| Propuestas ClientR38 | [Manual visual](../features/nodia-ai/proposal-review-presentation.md) y [QA2026-11-07](../evidence/nodia-ai-proposal-ui-20261107-r01.json) |
| OCR Gemini R16 | [Timeout y diagnóstico](../evidence/invoice-gemini-timeout-20261107-r02.json) |
| Productos/POS | [Plan94](94-business-point-of-sale-and-product-refactor.md) y [vinculación manual](../evidence/invoice-manual-match-qa-20261107-r01.json) |
| Teacher | Upgrade [101](101-nodia-teacher-adaptive-upgrade-plan.md)/[102](102-nodia-teacher-phased-implementation-and-final-qa.md), [matriz55TU](../evidence/teacher-upgrade-acceptance-20261111.md) y [recibo local](../evidence/teacher-upgrade-local-20261111-r01.json); historia en [96](96-nodia-teacher-implementation-plan.md) y [QA V1 con bloqueos](../evidence/teacher-final-qa-20261105-r01.json) |
| Proveedores IA | [Contrato recuperado](ai-provider-feature-contract.md) y [matriz obligatoria91](91-ai-provider-onboarding-verification.md): inferencia real por selección/modelo/esfuerzo/modalidad/entorno, sin fallback ni replay |
| Despliegue | [Plan99](99-production-deployment-and-cicd-plan.md), [runbook18](18-security-deployment-runbook.md) e [instalación](database-installation.md), con reconciliación del release vigente |
| Mantenimiento | [Plan100](100-repository-cleanup-and-documentation-consolidation-plan.md) y [registro](../../ops/maintenance/README.md) |

La consolidación documental de estos índices no ejecuta despliegues ni inferencias. El lote Teacher enlazado sí incluye builds y cambios de datos sintéticos en bases descartables; se distingue de base operativa/entorno destino. La comprobación del conocimiento se realiza en modo check, sin publicación; cada resultado conserva su alcance en la evidencia correspondiente.

## Historial

[00-progress-history.md](00-progress-history.md) conserva el contenido previo de progreso y los párrafos únicos del antiguo índice. Las evidencias originales y sus hashes no se reescriben. Las entradas nuevas deben resumir el estado vigente aquí y enlazar el detalle en su plan, evitando duplicar narraciones entre índices.

<details>
<summary>Referencias de cortes anteriores</summary>

Anclas conservadas para enlaces anteriores; cada entrada lleva a su registro histórico.

- <a id="productos-serverr11-y-clientr28-activos-y-comprobados--2026-11-06"></a>[Productos: ServerR11 y ClientR28 activos y comprobados — 2026-11-06](00-progress-history.md#progress-001)
- <a id="teacher-material-gemini-r11-listo-y-proceso-codex-probado--2026-11-03"></a>[Teacher: material Gemini R11 listo y proceso Codex probado — 2026-11-03](00-progress-history.md#progress-002)
- <a id="gemini-teacher-selección-calificada-en-native-r10--2026-11-02"></a>[Gemini Teacher: selección calificada en Native R10 — 2026-11-02](00-progress-history.md#progress-003)
- <a id="cierre-v1-teacher-auditado--r07-unknown--r08-local-2026-11-02"></a>[Cierre V1 Teacher auditado — R07 unknown / R08 local, 2026-11-02](00-progress-history.md#progress-004)
- <a id="corte-histórico-oauth-real-y-corrección-r07-preparada--2026-11-02"></a>[Corte histórico: OAuth real y corrección R07 preparada — 2026-11-02](00-progress-history.md#progress-005)
- <a id="corte-histórico-inicial-de-teacher-vm--2026-11-01"></a>[Corte histórico inicial de Teacher VM — 2026-11-01](00-progress-history.md#progress-006)
- <a id="teacher-en-vm-con-ambos-proveedores-agentic--en-curso-2026-11-01"></a>[Teacher en VM con ambos proveedores Agentic — en curso, 2026-11-01](00-progress-history.md#progress-007)
- <a id="teacher-activación-local-por-operador--2026-11-01"></a>[Teacher: activación local por operador — 2026-11-01](00-progress-history.md#progress-008)
- <a id="teacher-y-navegación-estable--implementación-local2026-11-01"></a>[Teacher y navegación estable — implementación local2026-11-01](00-progress-history.md#progress-009)
- <a id="teacher-inicio-en-contexto-nuevo-y-ampliación-de-rutas--2026-11-01"></a>[Teacher: inicio en contexto nuevo y ampliación de rutas — 2026-11-01](00-progress-history.md#progress-010)
- <a id="teacher-plan-de-implementación-completo--2026-11-01"></a>[Teacher: plan de implementación completo — 2026-11-01](00-progress-history.md#progress-011)
- <a id="teacher-final-de-sección-y-umbral-confirmado--r05-2026-11-01"></a>[Teacher: final de sección y umbral confirmado — R05, 2026-11-01](00-progress-history.md#progress-012)
- <a id="teacher-ciclo-de-primera-lección--r04-2026-11-01"></a>[Teacher: ciclo de primera lección — R04, 2026-11-01](00-progress-history.md#progress-013)
- <a id="teacher-detalle-de-revisión-y-guardado--r03-2026-11-01"></a>[Teacher: detalle de revisión y guardado — R03, 2026-11-01](00-progress-history.md#progress-014)
- <a id="nodia-teacher--planificación-r02-2026-11-01"></a>[Nodia Teacher — planificación R02, 2026-11-01](00-progress-history.md#progress-015)
- <a id="editor-de-precio-y-bloqueo-de-cambios--r26-2026-10-31"></a>[Editor de precio y bloqueo de cambios — R26, 2026-10-31](00-progress-history.md#progress-016)
- <a id="nombres-en-el-menú-lateral-colapsado--r25-2026-10-31"></a>[Nombres en el menú lateral colapsado — R25, 2026-10-31](00-progress-history.md#progress-017)
- <a id="precios-por-partida-y-salida-segura-del-pos--r24-2026-10-31"></a>[Precios por partida y salida segura del POS — R24, 2026-10-31](00-progress-history.md#progress-018)
- <a id="acciones-del-último-recibo--r23-2026-10-31"></a>[Acciones del último recibo — R23, 2026-10-31](00-progress-history.md#progress-019)
- <a id="vale-y-detalle-opcional--r22-adoptado-2026-10-30"></a>[Vale y detalle opcional — R22 adoptado, 2026-10-30](00-progress-history.md#progress-020)
- <a id="ajustes-pos-y-chrome-de-caja--r21-implementado-y-desplegado-2026-10-30"></a>[Ajustes POS y Chrome de caja — R21 implementado y desplegado, 2026-10-30](00-progress-history.md#progress-021)
- <a id="ticket-manual80mm-y-presentación--r20-implementado-y-desplegado-2026-10-30"></a>[Ticket manual80mm y presentación — R20 implementado y desplegado, 2026-10-30](00-progress-history.md#progress-022)
- <a id="unidades-y-cantidades-de-venta--r19-implementado-y-desplegado-2026-10-30"></a>[Unidades y cantidades de venta — R19 implementado y desplegado, 2026-10-30](00-progress-history.md#progress-023)
- <a id="nodiaai-ventas-de-solo-lectura--r17-2026-10-30"></a>[NodiaAI: ventas de solo lectura — R17, 2026-10-30](00-progress-history.md#progress-024)
- <a id="negocios-en-móvil--r16-2026-10-30"></a>[Negocios en móvil — R16, 2026-10-30](00-progress-history.md#progress-025)
- <a id="ventas-y-reportes-filtros-y-tabla-estándar--r15-2026-10-30"></a>[Ventas y Reportes: filtros y tabla estándar — R15, 2026-10-30](00-progress-history.md#progress-026)
- <a id="pos-lista-de-compra-y-producto-manual--r14-2026-10-30"></a>[POS: lista de compra y producto manual — R14, 2026-10-30](00-progress-history.md#progress-027)
- <a id="estudios-e-inglés--borrador-r01-2026-10-29"></a>[Estudios e Inglés — borrador R01, 2026-10-29](00-progress-history.md#progress-028)
- <a id="pos-varias-ventas-locales--r13-2026-10-29"></a>[POS: varias ventas locales — R13, 2026-10-29](00-progress-history.md#progress-029)
- <a id="pos-controles-y-checkout-sin-draft-ui--r12-2026-10-29"></a>[POS: controles y checkout sin draft UI — R12, 2026-10-29](00-progress-history.md#progress-030)
- <a id="productos-visor-y-reemplazo-de-imagen--r11-2026-10-29"></a>[Productos: visor y reemplazo de imagen — R11, 2026-10-29](00-progress-history.md#progress-031)
- <a id="editor-de-producto-imagen-y-recuperación--r10-2026-10-29"></a>[Editor de producto: imagen y recuperación — R10, 2026-10-29](00-progress-history.md#progress-032)
- <a id="resumen-de-negocio-filas-de-paneles--r09-2026-10-29"></a>[Resumen de negocio: filas de paneles — R09, 2026-10-29](00-progress-history.md#progress-033)
- <a id="presentación-markdown-y-recarga--r08-2026-10-29"></a>[Presentación Markdown y recarga — R08, 2026-10-29](00-progress-history.md#progress-034)
- <a id="dictado-prueba-real-de-la-app--2026-10-29"></a>[Dictado: prueba real de la app — 2026-10-29](00-progress-history.md#progress-035)
- <a id="dictado-del-navegador--vm-r07-2026-10-29"></a>[Dictado del navegador — VM R07, 2026-10-29](00-progress-history.md#progress-036)
- <a id="título-editable-en-cabecera--vm-2026-10-29"></a>[Título editable en cabecera — VM, 2026-10-29](00-progress-history.md#progress-037)
- <a id="ajustes-del-chat-adoptados-en-vm--2026-10-29"></a>[Ajustes del chat adoptados en VM — 2026-10-29](00-progress-history.md#progress-038)
- <a id="punto-de-venta-nodiaai--verificación-natural-acotada-2026-10-28"></a>[Punto de venta NodiaAI — verificación natural acotada 2026-10-28](00-progress-history.md#progress-039)
- <a id="punto-de-venta-y-refactor-de-productos--implementación-local-2026-10-28"></a>[Punto de venta y refactor de productos — implementación local 2026-10-28](00-progress-history.md#progress-040)
- <a id="chat-completo-en-vm-para-pruebas-humanas--2026-10-28"></a>[Chat completo en VM para pruebas humanas — 2026-10-28](00-progress-history.md#progress-041)
- <a id="backend-local-para-prueba-humana-del-chat--2026-10-28"></a>[Backend local para prueba humana del chat — 2026-10-28](00-progress-history.md#progress-042)
- <a id="rediseño-local-del-chat--2026-10-28"></a>[Rediseño local del chat — 2026-10-28](00-progress-history.md#progress-043)
- <a id="ampliación-solicitada-api-key-en-el-chat--2026-10-27"></a>[Ampliación solicitada: API key en el chat — 2026-10-27](00-progress-history.md#progress-044)
- <a id="decisión-actual--retirada-web-autorizada-el-2026-10-27"></a>[Decisión actual — retirada Web autorizada el 2026-10-27](00-progress-history.md#progress-045)
- <a id="adenda-vigente-cierre-de-seis-puntos-agentic-por-alcance--2026-10-27"></a>[Adenda vigente: cierre de seis puntos Agentic por alcance — 2026-10-27](00-progress-history.md#progress-046)
- <a id="adenda-anterior-agentic-guardado-idempotencia-y-cancelación-por-alcance--2026-10-26"></a>[Adenda anterior Agentic: guardado, idempotencia y cancelación por alcance — 2026-10-26](00-progress-history.md#progress-047)
- <a id="corte-anterior-ai41-imágenes-reales-codex-y-antigravity-verificadas-por-alcance--2026-10-26"></a>[Corte anterior AI41: imágenes reales Codex y Antigravity verificadas por alcance — 2026-10-26](00-progress-history.md#progress-048)
- <a id="corte-previo-ocr-aceptación-natural-agentic-por-alcance-r05-y-p1-adoptados--2026-10-26"></a>[Corte previo OCR: aceptación natural Agentic por alcance; R05 y P1 adoptados — 2026-10-26](00-progress-history.md#progress-049)
- <a id="corte-anterior-r03-aceptación-acotada-del-chat-ocr-con-codex--2026-10-26"></a>[Corte anterior R03: aceptación acotada del chat OCR con Codex — 2026-10-26](00-progress-history.md#progress-050)
- <a id="corte-anterior-r02-ocr-publicado-y-adoptado-comparación-en-investigación--2026-10-26"></a>[Corte anterior R02: OCR publicado y adoptado; comparación en investigación — 2026-10-26](00-progress-history.md#progress-051)
- <a id="corte-anterior-control-mcp-real-aceptado-en-la-nueva-época--2026-10-26"></a>[Corte anterior: control MCP real aceptado en la nueva época — 2026-10-26](00-progress-history.md#progress-052)
- <a id="corte-anterior56f6-continuidad-spa-y-observaciones-de-gemini"></a>[Corte anterior56f6: continuidad SPA y observaciones de Gemini](00-progress-history.md#progress-053)
- <a id="cortes-anteriores-inmediatos-adopciones-y-control-previo"></a>[Cortes anteriores inmediatos: adopciones y control previo](00-progress-history.md#progress-054)
- <a id="finanzas-personales--estado-de-client"></a>[Finanzas personales — estado de Client](00-progress-history.md#progress-059)
- <a id="tools--reservas-de-alojamiento"></a>[Tools — reservas de alojamiento](00-progress-history.md#progress-060)
- <a id="reservas-de-alojamiento--continuidad"></a>[Reservas de alojamiento — continuidad](00-progress-history.md#progress-063)

</details>

## Teacher — cierre vigente del upgrade R02

Cierre técnico del upgrade2026-11-11:55/55TU verificados para Windows y la selección API key exacta configurada.18POST reales, revisión de47ítems, QA HTTP/JWT/SQL y rendimiento comparado, correcciones y restore final comprobados. Alcance y límites en la [matriz R02](../evidence/teacher-upgrade-acceptance-20261111-r02.md) y el [recibo R02](../evidence/teacher-upgrade-local-20261111-r02.json). No adopta otros proveedores/entornos, no acredita eficacia humana ni despliega/publica o aprueba ADR/fichas.

El corte parcial de construcción anterior se conserva como historia. No reiniciar F0 ni repetir un resultado incierto. El siguiente hito operativo requiere paquete/configuración/credenciales/sesión propios del entorno adoptado; los18POST reales y la restauración de102tablas/37secuencias/827restricciones pertenecen al laboratorio documentado.

### Continuación VM del upgrade: cierre funcional y operativo comprobado

ServerR14/ClientR41 adoptados en la VM de development, con autenticación Google normal y recorrido SQL desde la UI comprobados para la selección OpenAI Agentic configurada. Diagnóstico, evidencia por objetivo, propuesta/material, ayuda anclada, práctica y final quedaron registrados; el respaldo final posterior al QA pasó restauración de DB/configuración; la comprobación operativa y recarga de UI tras reanudar servicios pasaron. La práctica obtuvo12/14 (escrita6/6); la final40/40 (escrita24/24), con passed/assisted=false persistido y ambas confirmaciones nativas del job escrito. Las respuestas pertenecen al agente de QA y no prueban aprendizaje humano. El ajuste real generó una candidata sólo de título que no se activó; el plan aceptado y sus objetivos/política no cambiaron. El detalle de R14/R40/R41, la selección exacta y sus límites se conserva en [102§13](102-nodia-teacher-phased-implementation-and-final-qa.md#13-cierre-pendiente-en-development--2026-11-11) y el [recibo VM](../evidence/teacher-upgrade-development-vm-20261111-r01.json). No son55aceptaciones nuevas de VM. Revisión/versionado Git pendientes; development sin promoción a master, aprobación/publicación o cambios de producción99.
