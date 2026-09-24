# ADR-005 — Sesión Gemini Web para análisis de imágenes

> Estado: propuesto
> Fecha: 2026-09-23

## Contexto

El análisis de imágenes de facturas usa `nodia-server` → `nodia-gemini-microservice` → `gemini-webapi`. La sesión iniciada en el navegador perdía validez después de unos minutos. NestJS intentaba recurrir a `GEMINI_API_KEY`, que no está disponible para este proyecto. Además, la cookie `1PSIDTS` rotada por la librería no persistía para reinicios y la recarga de `.env` podía restaurar una cookie anterior.

## Opciones consideradas

### Opción A: mantener la API key como respaldo

- Ventaja: otra vía de ejecución si falla Gemini Web.
- Desventaja: requiere credenciales y presupuesto que este flujo no tiene; oculta el problema real de sesión.

### Opción B: microservicio Gemini Web como único adaptador Gemini

- Ventaja: conserva el contrato NestJS y permite reparar la sesión en un solo componente.
- Desventaja: depende del comportamiento no oficial de Gemini Web y puede requerir un nuevo login interactivo.

## Decisión

Se implementa la opción B para Gemini. `.env` sirve como credencial inicial o como nuevo login; `session_state/` guarda las cookies renovadas y se monta como volumen en Docker. NestJS no utiliza la API key de Gemini y entrega errores explícitos si falla la sesión o la extracción. El respaldo hacia otros proveedores queda fuera de este cambio.

## Consecuencias

- La sesión se conserva entre reinicios cuando el volumen `session_state/` persiste.
- Una cuenta revocada, un perfil caducado o cambios del servicio web pueden exigir login manual o un reemplazo del adaptador.
- Se requiere una prueba con la cuenta real y una imagen tras varias horas de inactividad; las pruebas locales usan un cliente simulado.

## Referencias

- `nodia-gemini-microservice/README.md`
- `nodia-server/src/common/ai/gemini.service.ts`
