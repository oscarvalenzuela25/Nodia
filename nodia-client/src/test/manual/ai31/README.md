# AI-31: presentación sintética aislada

Desde `nodia-client`, ejecutar `npm run dev -- --host 127.0.0.1 --port 5195 --mode qa-ai31` y abrir `http://127.0.0.1:5195/src/test/manual/ai31/index.html`.

El origen es exclusivo para QA para aislar el almacenamiento de sesión. El adaptador Axios rechaza toda petición salvo la lectura sintética del recibo. No consulta BD, API ni Gemini. La ruta productiva no importa este harness.

Parámetros: `lang=es|en`, `theme=light|dark`, `scenario=compare` (por defecto, informe parcial). El componente real muestra cifras mayores que Number.MAX_SAFE_INTEGER, cero y desconocido, fuentes separadas, grupos locales y comparación. Controles del harness permiten fallar transporte, recuperar y revocar acceso.

Verificar 320/390/599/600/900/1440 px, ambos idiomas y temas, teclado, scroll horizontal local y ausencia de overflow de documento; conservar grupos durante refetch/503 y ocultar importes ante 403. La comprobación sintética no acredita disponibilidad del proveedor ni autorización SQL real.
