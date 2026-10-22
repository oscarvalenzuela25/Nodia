# AI-38 — instalación nueva de dependencias productivas

Fecha: 2026-10-20. Estado: verificada en un directorio aislado de la VM Linux; sin adopción o cambios en dependencias/servicios operativos.

[Recibo congelado](nodia-ai-ai38-dependencies-r01.json), SHA256 `b125da80b41d1a20b014bcea6a1e136be6cbf5778a7600db9c6b02b484d06a1c`. [Driver](scripts/nodia-ai-ai38-dependencies.py), SHA256 `cd5fa00c5e7494ba2d10d8d72c0631963814d449ac4a35f302cdd019d443b34c`.

## Instalación

Una sola invocación de `npm ci --omit=dev`, exit0, con Node `v24.20.0` y npm `11.19.0`. Lifecycle scripts y comprobación TLS permanecen habilitados. No hay actualización de paquetes, registro alternativo, fallback o retry de instalación.

Se copian físicamente package/lock y los 2.827 outputs del candidato01 en `/opt/nodia/verification/ai38-dependencies-r01/nodia-server/`. `node_modules` es un directorio nuevo de esa instalación. HOME, caché y ambos npmrc están vacíos y privados al comenzar; el entorno no hereda tokens ni configuración del usuario operativo. La instalación conserva los hashes de package/lock y las versiones instaladas coinciden con el lock: 30 dependencias directas y 262 registros instalados. La dependencia de desarrollo `@nestjs/testing` está ausente, como corresponde a este perfil.

Antes de instalar se observan 6.912.069.632 bytes de memoria disponible y 6.719.553.536 bytes libres de disco. Sólo el proceso npm lleva límite de heap de 512 MiB para preservar margen de los procesos concurrentes del laboratorio. El conjunto termina en 35,293 segundos, dentro del presupuesto exterior de 300 segundos.

## Runtime comprobado

- Los 979 assets de runtime y los 2.827 outputs copiados conservan sus hashes. Esto verifica integridad; no significa ejecutar individualmente todos los archivos.
- Los grafos estáticos ESM de los entrypoints reales `main.js` y `nodia-ai-worker.js` cargan con las dependencias productivas nuevas. Ambos rechazan la cuarentena en su gate ordinario, antes de crear el contexto Nest y con cero sockets, fetches o listeners.
- Un control financiero adicional ejecuta el worker standalone con el `dist` físico nuevo. El driver redirige exclusivamente la línea de entrada del arnés anterior a esa ruta; el proceso hijo resuelve sus módulos desde el `node_modules` nuevo. La composición HTTP y herramientas de test del proceso padre conservan sus dependencias de desarrollo existentes; no se presentan como dependencias productivas instaladas.
- Ese worker pasa nuevamente las once comprobaciones y cinco HTTP del [control standalone](nodia-ai-ai38-worker-process.md): efecto y recibo únicos, API cerrada durante ejecución, recuperación por endpoints al volver y confirmación repetida sin duplicar el efecto. SIGTERM limpio; seis conexiones PostgreSQL y una Redis desechables, cero fetches, sockets denegados o listeners.

El cierre muestra cero grupos de procesos y contenedores propios pendientes, sin limpieza forzada. No se accedió a la BD configurada, proveedores, R2, credenciales o perfiles; hubo cero inferencias y modificaciones de servicios operativos. Los ficheros y logs completos permanecen privados en el directorio aislado. El resultado acredita esta instalación Linux y el recorrido financiero local probado; no sustituye la aceptación generativa, UI física, despliegue/reversión por entorno o infraestructura externa de conservación.
