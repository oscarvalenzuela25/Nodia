# AI-38 — worker standalone y retorno al resultado

Fecha: 2026-10-20. Estado: verificado en la VM Linux mediante PostgreSQL y Redis desechables, sin adoptar el paquete en los servicios operativos.

## Evidencia

[Intento02 correcto](nodia-ai-ai38-worker-process02.json): once comprobaciones y cinco peticiones HTTP. Se ejecuta el archivo compilado real `dist/nodia-ai-worker.js` del candidato01, con manifiesto `0751160bb8cb146acec9dda21daa0226875a2c40f1c898a9c649e69a9583b8e3`. El proceso hijo no utiliza overrides de Nest, un coordinador inline o una copia del bucle del worker.

1. Una API fixture con autenticación sintética prepara un gasto de 21.000 y emite el challenge de la revisión/hash exactos. La confirmación HTTP202 admite la ejecución y todavía no hay movimientos.
2. Se cierra esa API antes de arrancar el worker. El proceso standalone consume la ejecución y crea el movimiento, recibo mínimo y cierre del job. Conserva nombre, dueño, categoría, importe, tipo y estado confirmados.
3. Se detiene el hijo con SIGTERM, sin SIGKILL, y se abre otra composición HTTP contra la misma BD desechable. Operación y movimiento aparecen mediante sus endpoints reales HTTP200. Repetir la misma confirmación devuelve la misma ejecución, sin otro efecto.
4. El cierre SQL muestra un movimiento, un recibo y cero jobs pendientes, intentos abiertos o slots retenidos. Se retiran los dos contenedores propios y el grupo de procesos queda vacío.

El guard de red del hijo registra cinco conexiones a PostgreSQL y una a Redis desechables, cero fetches, cero conexiones denegadas y cero listeners. Sólo admite loopback y los dos puertos aleatorios exactos del fixture; persiste cada contador incluso si una dependencia absorbiera el error. El entorno del hijo no contiene credenciales del proveedor/R2 ni configuración de la BD operativa; dotenv apunta a `/dev/null`. Redis usa la imagen local registrada en el recibo, con `--pull=never`.

## Antecedente preservado

[Intento01 fallido](nodia-ai-ai38-worker-process01.json) verificó seis comprobaciones, incluido el efecto por el proceso real, pero el GET de retorno dio HTTP500. El arnés reutilizaba para la API una conexión observadora creada con `entities:[]`, incompatible con repositorios TypeORM. Se corrigió exclusivamente el arnés para registrar las entidades reales en esa conexión; el segundo intento completo pasó. El recibo y los logs privados del primer intento permanecen intactos. No se modificó código productivo ni se atribuyó ese HTTP500 a Gemini.

## Fuentes y límites

- [Arnés](../../nodia-server/test/nodia-ai-ai38-worker-process.mjs), SHA256 `9f86e2c211bd5f17f0d0c8a0de5e12754fe733d7e4163ef43362165a53f7bd03`.
- [Driver](scripts/nodia-ai-ai38-worker-process.py), SHA256 `4295622c31a3eebcbb2862e06728e38b04dcbcfea0f52a5dabff0b73832ab5d9`.
- Recibo02 SHA256 `a7962e2db8f2fe2359ab05ab9a391e3d50a8179109e2ad00bac026169fadeb94`; recibo01 SHA256 `09f42e32f5ed03c0986f7611c852e14015195fcde28790d8b7c897368ade8577`. Copiados byte a byte desde la VM.

Sintaxis Node/Python y Oxlint focal correctos. Los logs completos, guard y contadores permanecen privados en `/opt/nodia/verification/ai38-worker-process02/`; el directorio anterior conserva el fallo. Dependencias reutilizadas de la instalación existente; no se ejecutó `npm ci`.

Esta prueba cierra el recorrido aislado de ejecución local por el worker standalone y recuperación HTTP del resultado. La identidad y el gesto de confirmación son fixtures; no prueba login completo, UI física, generación que origine la propuesta, MCP del worker, R2 o un despliegue/reversión operativos. No se accedió a la BD configurada ni se tocó el perfil IA, y hubo cero inferencias o modificaciones de servicios operativos.
