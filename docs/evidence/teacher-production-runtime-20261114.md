# Teacher Codex en producción: host pendiente — 2026-11-14

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
offline con dosCPU/tresGB y un trabajo Cargo; ninguna cuenta/perfil/proveedor.
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
