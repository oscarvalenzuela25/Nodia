# Teacher Codex en producción: activación pendiente — 2026-11-14/15

Solicitud actual del usuario: Teacher continúa bloqueado después de integrar
PR25/26. La captura muestra el motivo específico `codex_host_unconfigured`.
Rama de corrección `codex/fix-teacher-production-runtime`, desde development
080a948827cffb530a8aa578f0918992218eeba9. No cambiar modelo/esfuerzo ni modo.

## Hechos de lectura

SSH con host pin existente confirma producción en
`backend-3beeedbcbf10-d096d1b33274`, código de master3beeedbcbf101c6bcd1338f405266edbd75c48a2.
API/worker activos y drop-ins70Codex/71Gemini;72Teacher no está instalado.
Las rutas accesibles `/usr/local/lib/nodia/teacher-runtime` y
`/usr/local/lib/nodia/ai-runtime/prepare-teacher-runtime.py` no existen.
Updater y register instalados no tienen soporte72. El transporte compilado
coincide con el manifiesto y contiene el guard host_unconfigured.

No se pudieron leer como administrador sin sudo el entorno protegido ni el
registro consumers: inaccesible no significa ausente. No se leyó runtime.env,
perfiles, claves o sesiones. No se atribuye a expiración de login. Sudo no
interactivo no está autenticado; no hubo cambios privilegiados ni SQL/inferencia.
Recibo intermedio `output/production/teacher-host-incident-20261114-r01/public-readonly.json`,
SHA256 `8f214d2e6665948217e8b9fc6664541ef86684a2890f0e72a61478c34ecfa708`.

El despliegue de aplicación no instala operadores ni el host Teacher. El éxito
de VM del corte anterior usa un host ya existente en ese entorno; no demuestra
aprovisionamiento productivo. El login y el app-server Codex del chat son otra
pieza y no sustituyen el binario text-only de ADR093.

## Preparación en curso

Se inició Docker Desktop mediante CLI y se reutilizan imagen Bookworm fijada,
toolchain1.95, Cargo.lock y volúmenes propios de Teacher. Compilación release
offline con dosCPU y un trabajo Cargo; ninguna cuenta/perfil/proveedor. Comenzó
con tresGB; al compilar Core se amplió en vivo el límite a cuatroGB, sin reinicio
ni OOM y tras comprobar seisGB físicos libres. No cambia el código o los pins.
Debe pasar protocolo sintético, capabilities, hashes/ABI y manifiesto de release;
no se relabela el dev histórico ni se toma su calificación como nueva.

El refresco existente exige una operación fallida preparing sin efectos, y el
instalador inicial rechaza versiones distintas: ninguno habilita refresco sano.
Se prepara un operador CAS específico con dos locks, fuentes/hashes antiguos
y nuevos, respaldo privado y pins coherentes; sin inventar una operación CD
fallida. Incluye revisión de runtime-preflight/update-backend-action instalados:
activar importa ese contrato, no el dist de la aplicación nueva.

El helper específico `upgrade-teacher-operators.py` está implementado, sin
ejecución productiva: reemplaza únicamente updater/register, crea prepare y
actualiza el pin del updater. Verifica los siete archivos de unidades base,
PID/inicio de procesos y estado habilitado de timers, además de hashes y
locks. Respalda originales antes del primer efecto; una interrupción conserva
su reserva y exige conciliación privada. Las fuentes se compilan desde bytes
ya verificados, sin reabrir un path que pudiera cambiar. No toca70/71, perfiles,
registro de consumidores, release o servicios. Revisión independiente cerró
dos hallazgos sobre mapas de hashes y unidades/timers antes de la entrega.

Verificación: runner de política92/92 en Linux root aislado, sin red; después
dos regresiones adicionales del mismo helper dejan14/14 focales correctas
(backend no sano y entorno Teacher preexistente abortan antes de reservar).
Roundtrip del bundle correcto, incluyendo alteración de prepare/upgrade
detectada por hashes. Estas pruebas usan systemd/receiver sintéticos; no
acreditan una instalación real. No se repiten como nueva inferencia las
pruebas históricas de VM.

Antes de producción: paquete exacto revisable, elevación privada del operador,
actualización de operadores, prepare sin cuentas, respaldo/drenaje/quietud,
activación72 con consumidores parados, comprobación de registro y arranque
explícitos. Después elegibilidad y una creación normal exacta, con presupuesto,
cierre y ACK; sin replay, fallback, nuevo JWT o confirmación implícita del plan.
Este documento no acredita todavía instalación ni inferencia productivas.

## Lectura protegida y candidato cerrado

El usuario ejecutó el lector sanitizado desde su terminal privada con sudo;
el agente recuperó únicamente su JSON. SHA256 del lector
`f2c92c087652393e98aa97f0d19ede05ec155f759fba31872d00c341410ed2c3`;
recibo `private-readonly.json` SHA256
`81043406114d538f2a15d700595bd9ed76f5e372bb0f4ff78b97ba33f3648893`.
Ahora sí están confirmadas como ausentes tanto la carpeta del host como
`/etc/nodia/teacher-runtime.env`. Los siete hashes de unidades base y los
70/71 de ambas unidades coinciden con sus pins; timers activos/habilitados.
No se cargaron secretos, perfiles o código de operadores.

El marcador BLOCKED existe; su presencia sola no acredita un bloqueo activo
porque el receiver interpreta las conciliaciones históricas. No se elimina ni
se da por resuelto: el helper exige `deployment_status.blocked:false` bajo ambos
locks antes de reservar o escribir. Se conservan las protecciones existentes.

Candidato público desde commit `3e3f86f33edfe8fc1592c14c1d6a05610bf95da6`:
helper SHA256 `bdb432360273384c61c4d308bdd17fd689bc16be5dc8dd4ed57988c7755dc632`,
manifiesto cerrado SHA256
`6313fd278c9f5c02bb3dcc1307749ea5d8d4607384dbedee72d70a77bc9ebfb9`.
CAS de metadatos: settings
`516203c58b8f20a27b3b75a5cf96a4d63e2ec9e1938ca0eeb54b6411e8d01e32`,
receiver-settings `e2fdd62ee2da08d9a5c30f25b4cf4e3403c1f29ea6347435825df879d6406ae6`,
consumers `fd19a67e88c5b3665fd4fa03921cbd9632333ab654ce481d26f762121837917c`.
Se contrastaron también los tres assets inmutables con el commit exacto;
no se reemplazan. El candidato no acredita ejecución ni activación.

La adopción requiere respaldo cifrado y ensayo de restauración conforme ADR093.
El restore histórico está fijado a f01/45 migraciones y no prueba el release
actual. Se prepara un ensayo offline acotado sobre el respaldo nuevo sin
arrancar aplicaciones/proveedores; no se generaliza la recuperación legacy.
La cobertura pendiente de keyring/perfiles sigue documentada en el runbook,
sin tocar esos archivos ni convertirla en una nueva plataforma de este incidente.

## Ensayo nuevo de igualdad DB — 2026-11-15 UTC

`restore-teacher-backup.mjs` y `fingerprint-teacher-restore.mjs` conservan el
restaurador histórico intacto. El helper nuevo admite256 tablas acotadas;
el límite histórico100 no cubre las102 tablas actuales. Conserva límites de
filas/bytes/tiempo, rechazo de RLS y de objetos de extensión, TLS y transacción
READ ONLY REPEATABLE READ. El ensayo comprueba identidad de release/Node,
ledger completo y columnas antes de comparar la huella; no llama a prepare,
migraciones o AppModule. No se declara recuperación operativa/journal.

Se exportó sólo la lista pública del manifiesto vía SSH con el pin existente,
sin crear archivos en el servidor ni incluir archivos extra del árbol. Se
verificaron24.573 entradas (24.572 más el manifiesto), tipos/modos/bytes/hashes,
symlinks internos y el digest canónico del inventario. No es el ZIP original
de CI. Archivo público SHA256
`f8f566afbc9c6c8760681fdb8386a23230f0ea73c674220575bc9bca0fe98462`,
210.075.111 bytes. Export del único binario Node SHA256
`86fbf353cbadcde68f5a4cf5ee23c41de08e77f4f1fb1e16af22ca5dc70e1908`,
44.807.313 bytes, ejecutable coincidente con el pin del manifiesto.

Prueba Docker real exclusivamente sintética con esos artefactos:49 migraciones,
68 entidades ORM y102 tablas públicas, GCM íntegro y huella restaurada exacta
`d04b05e7efc60b90e559a0cefe8ac7153f74476e74257aeed251a8590c2a9120`.
Contenedores512MB/1CPU, imágenes locales fijadas y red interna sin puertos.
Cleanup completo de cuatro contenedores/una red/cinco volúmenes; fixture y
RSA efímera también eliminados. Recibo sintético SHA256
`1954b43542e3b0d71a853a57d07b70d5ae1e49e10ac674b7fed4a0eb1715117f`.
No se usaron datos, cuentas, claves o inferencias de producción.

Revisión independiente corrigió el límite de ruta `..custody` dentro del repo
y cleanup SIGINT/SIGTERM antes del cierre. Diez regresiones nuevas más cinco
históricas pasan; lint y UTF-8/LF correctos. Integración CI del test nuevo con
update-backend-action:14/14 correctos. SIGKILL/daemon caído requieren inspección
manual; no se promete limpieza automática en esos casos. Fuentes finales:
restore SHA256 `aa840bb8bb8a74356a0c71e7e8c0594ed4a2b5f79c32f5b3aa4e1a16db6612d6`,
fingerprint `e4d899a31df33ca40f3e663369d7b3419577c530779cdb54c318f82ac9acf191`.
Ensayo del respaldo productivo y custodia de su clave privada aún pendientes.

## Preparación productiva comprobada — 2026-11-15 UTC

Build release optimizado offline completado en47m39s, sin cambios del source,
Cargo.lock o pins. Binario148.327.248 bytes SHA256
`79960da7671727241ffadf8a9d828903bdddec209f63ca8ea545c90eb0a38c1b`;
manifiesto SHA256 `72db0b69e052f57543b112eec29bcd72895697cf236f2604c75e7cdd51371c38`.
ELF64x86_64, GLIBC máximo2.34 y todas las bibliotecas resueltas. Capabilities
exactas y argumentos inválidos comprobados sobre ese artefacto como UID65534,
sin red, rootfs de lectura y sin perfil/cuenta. Tests Cargo release de protocolo
en curso; no se atribuye todavía su resultado. El artefacto está sin calificar
para selecciones reales de producción.

El usuario ejecutó la receta de preparación revisada desde su terminal privada:
`prepare-reviewed.sh`, SHA256
`bb56eb444991ba7e7a0e87ece3a90aee9e0f1571090af043a5ecd13e2dec71d4`.
Los dos recibos recuperados confirman `teacher_operators_upgraded` y
`teacher_runtime_prepared`. El helper aceptó la conciliación histórica por el
estado semántico del receiver, sin borrar BLOCKED ni simular otro CD.
Settings después SHA256
`9556cd0353679c780df5e893221cd691d75c2c5695334bbb43bea411696725bb`;
receiver/consumers permanecen iguales. Current, manifiesto y PID de API/worker
conservados, al igual que keyrings/timers; todavía sólo70/71 activos.

Host instalado root0755 por SHA512
`104407c763e028060be7d7b3f7976347bb464de475d19b091f4378e667e3dbfa735862248a473b2913c35bce8a098ef73e03fbe532fb1dbe600de28f835a8c26`,
comprobado también desde el archivo público. Recibo preparado SHA256
`4b85c191f52ce93b7c895ec063965385a1529195e1127ba49739dc4178b1c3c0`.
El SHA256 esperado del entorno staged
`83665ded99e69dfb3182b8d355383d01278b5f195426bcf4da72068b6b81abc5`
es derivado determinísticamente de las dos variables/host; el administrador no
pudo leerlo directamente. La ventana deberá contrastar sus bytes root reales.
No hubo reinicio, activación, login o inferencia por esta preparación.

La clave de recuperación original se localizó mediante el default documentado
del generador, fuera del repositorio. Metadatos y SPKI público coinciden con
`f7af9aea7868daa71a9500f9bbd91f35a3fe6fea396f82d5f5a9c78ab8510bbd`;
DACL protegida, un permiso exclusivo del usuario actual. No se imprimió/leyó
el contenido privado ni se copió al VPS; el restore la leerá únicamente en RAM.
Se conservan la clave original y su custodia; no se regenera otra pareja.

Captura fresh y ventana coordinada están implementadas y revisadas por un par,
todavía sin ejecutar. Captura usa dos locks, CAS e InvocationID/cursor nuevos y
huellas completas antes/después; no detiene servicios. Ventana usa dos locks,
respaldo ensayado ligado al release y GCM, mantenimiento, drenaje de nueve
contadores, cgroups vacíos, activación/registro exactos antes del único arranque,
smokes y timers conservados. Interrupciones preservan recibos/reserva y nunca
reinician o repiten automáticamente. Dieciocho regresiones nuevas pasan en
Linux root. Integración final:110 casos Python en Linux root sin omisiones,
roundtrip del bundle correcto y14 casos Node del paso CI correctos. Captura y
ventana conservan su adopción operativa pendiente; no heredan el éxito sintético.
